import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, ArrowLeft, Download, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
}

interface RealtimeChatProps {
  language: Language;
  onBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Audio utilities
class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  constructor(private onAudioData: (audioData: Float32Array) => void) {}
  
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }
  
  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

// Audio Queue for sequential playback
class AudioQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(audioData: Uint8Array) {
    console.log('Adding audio chunk to queue, size:', audioData.length);
    this.queue.push(audioData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private createWavFromPCM(pcmData: Uint8Array): Uint8Array {
    // Convert bytes to 16-bit samples
    const int16Data = new Int16Array(pcmData.length / 2);
    for (let i = 0; i < pcmData.length; i += 2) {
      int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
    }
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + int16Data.byteLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, int16Data.byteLength, true);

    // Combine header and data
    const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
    wavArray.set(new Uint8Array(wavHeader), 0);
    wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);
    
    return wavArray;
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      console.log('Audio queue empty, stopping playback');
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;
    console.log('Playing audio chunk, size:', audioData.length);

    try {
      const wavData = this.createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        console.log('Audio chunk finished playing');
        this.playNext();
      };
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.playNext(); // Continue with next segment even if current fails
    }
  }
}

const RealtimeChat: React.FC<RealtimeChatProps> = ({ language, onBack }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const currentTranscriptRef = useRef('');
  const sessionInitializedRef = useRef(false);

  // Translation helper
  const getTranslation = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      medicalAssistant: {
        hi: 'चिकित्सा सहायक',
        bn: 'মেডিকেল সহায়ক',
        te: 'వైద్య సహాయకుడు',
        ta: 'மருத்துவ உதவியாளர்',
        mr: 'वैद्यकीय सहाय्यक',
        gu: 'તબીબી સહાયક',
        kn: 'ವೈದ್ಯಕೀಯ ಸಹಾಯಕ',
        ml: 'മെഡിക്കൽ അസിസ്റ്റന്റ്',
        pa: 'ਮੈਡੀਕਲ ਅਸਿਸਟੈਂਟ',
        en: 'Medical Assistant'
      },
      voiceConversation: {
        hi: 'वॉयस बातचीत',
        bn: 'ভয়েস কথোপকথন',
        te: 'వాయిస్ సంభాషణ',
        ta: 'குரல் உரையாடல்',
        mr: 'आवाज संवाद',
        gu: 'અવાજ વાતચીત',
        kn: 'ಧ್ವನಿ ಸಂಭಾಷಣೆ',
        ml: 'വോയ്സ് സംഭാഷണം',
        pa: 'ਆਵਾਜ਼ ਗੱਲਬਾਤ',
        en: 'Voice Conversation'
      },
      clickToSpeak: {
        hi: 'बोलना शुरू करने के लिए क्लिक करें',
        bn: 'কথা বলা শুরু করতে ক্লিক করুন',
        te: 'మాట్లాడటం ప్రారంభించడానికి క్లిక్ చేయండి',
        ta: 'பேசத் தொடங்க கிளிக் செய்யவும்',
        mr: 'बोलणे सुरू करण्यासाठी क्लिक करा',
        gu: 'બોલવાનું શરૂ કરવા માટે ક્લિક કરો',
        kn: 'ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಲು ಕ್ಲಿಕ್ ಮಾಡಿ',
        ml: 'സംസാരിക്കാൻ തുടങ്ങാൻ ക്ലിക്ക് ചെയ്യുക',
        pa: 'ਬੋਲਣਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਕਲਿੱਕ ਕਰੋ',
        en: 'Click to start speaking'
      }
    };
    
    return translations[key]?.[language.code] || translations[key]?.['en'] || '';
  };

  const initializeSession = () => {
    if (sessionInitializedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    console.log('Initializing OpenAI session...');
    sessionInitializedRef.current = true;

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are a helpful multilingual medical assistant. The patient speaks in ${language.name} (${language.native}). Please respond in ${language.name} when possible, but you can use English if needed for medical clarity. Be empathetic, ask relevant follow-up questions, and provide helpful medical guidance while always recommending professional medical consultation for serious concerns.`,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    };

    wsRef.current.send(JSON.stringify(sessionConfig));
    console.log('Session configuration sent');
  };

  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    audioQueueRef.current = new AudioQueue(audioContextRef.current);
    
    // Connect to WebSocket - Use the correct Supabase project URL
    const wsUrl = 'wss://vjelsuxiuyzszirfrpnl.supabase.co/functions/v1/realtime-chat';
    console.log('Attempting to connect to WebSocket:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connected to realtime chat');
      setConnectionStatus('connected');
      toast({
        title: "Connected",
        description: "Voice conversation is ready",
      });
      
      // Initialize session after connection
      setTimeout(() => initializeSession(), 100);
    };
    
    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('Received message:', data.type, data);
      
      if (data.type === 'session.created') {
        console.log('Session created, initializing...');
        initializeSession();
      } else if (data.type === 'session.updated') {
        console.log('Session updated successfully');
      } else if (data.type === 'response.audio.delta') {
        // Play audio chunk
        console.log('Received audio delta, size:', data.delta?.length);
        if (data.delta) {
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          await audioQueueRef.current?.addToQueue(bytes);
        }
      } else if (data.type === 'response.audio_transcript.delta') {
        currentTranscriptRef.current += data.delta;
        console.log('Audio transcript delta:', data.delta);
      } else if (data.type === 'response.audio_transcript.done') {
        if (currentTranscriptRef.current.trim()) {
          console.log('Full AI transcript:', currentTranscriptRef.current);
          const newMessage: Message = {
            id: Date.now().toString(),
            type: 'assistant',
            content: currentTranscriptRef.current,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, newMessage]);
          
          // Update clinical notes
          setClinicalNotes(prev => prev + `\nAssistant: ${currentTranscriptRef.current}`);
        }
        currentTranscriptRef.current = '';
      } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
        console.log('User transcript:', data.transcript);
        const userMessage: Message = {
          id: Date.now().toString(),
          type: 'user',
          content: data.transcript,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Update clinical notes
        setClinicalNotes(prev => prev + `\nPatient: ${data.transcript}`);
        
        // Extract symptoms (simple keyword matching)
        const symptomKeywords = ['दर्द', 'pain', 'बुखार', 'fever', 'सिरदर्द', 'headache', 'खांसी', 'cough'];
        const foundSymptoms = symptomKeywords.filter(keyword => 
          data.transcript.toLowerCase().includes(keyword.toLowerCase())
        );
        if (foundSymptoms.length > 0) {
          setSymptoms(prev => [...new Set([...prev, ...foundSymptoms])]);
        }
      } else if (data.type === 'error') {
        console.error('OpenAI API Error:', data.error);
        toast({
          title: "AI Error",
          description: data.error?.message || 'An error occurred with the AI service',
          variant: "destructive"
        });
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Could not connect to voice service. Check console for details.",
        variant: "destructive"
      });
    };
    
    wsRef.current.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      setConnectionStatus('error');
      if (event.code !== 1000) { // Not a normal closure
        console.error('WebSocket closed unexpectedly:', event);
        toast({
          title: "Connection Lost",
          description: `Voice service disconnected (Code: ${event.code}). Please refresh.`,
          variant: "destructive"
        });
      }
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [language]);

  const toggleRecording = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection Error",
        description: "Please wait for connection to establish",
        variant: "destructive"
      });
      return;
    }

    if (!isRecording) {
      try {
        console.log('Starting recording...');
        recorderRef.current = new AudioRecorder((audioData) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const base64Audio = encodeAudioForAPI(audioData);
            wsRef.current.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: base64Audio
            }));
          }
        });
        
        await recorderRef.current.start();
        setIsRecording(true);
        
        toast({
          title: "Recording Started",
          description: "Speak now, the AI will respond when you pause",
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Microphone Error",
          description: "Could not access microphone. Please allow microphone permissions.",
          variant: "destructive"
        });
      }
    } else {
      console.log('Stopping recording...');
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      setIsRecording(false);
    }
  };

  const downloadClinicalNote = () => {
    const noteContent = `Clinical Note - ${new Date().toLocaleDateString()}\n` +
      `Language: ${language.name}\n` +
      `\nSymptoms: ${symptoms.join(', ')}\n` +
      `\nConversation:\n${clinicalNotes}\n\n` +
      `---\nThis clinical note was generated automatically and requires doctor review for diagnosis and treatment.`;
    
    const blob = new Blob([noteContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-note-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    setMessages([]);
    setSymptoms([]);
    setClinicalNotes('');
    currentTranscriptRef.current = '';
    
    toast({
      title: "History Cleared",
      description: "All conversation history and clinical notes have been cleared",
    });
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢 Connected';
      case 'connecting': return '🟡 Connecting...';
      case 'error': return '🔴 Connection Error';
      default: return '⚪ Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-secondary-light/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 medical-gradient rounded-full">
              <span className="text-white font-bold">🩺</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Medical Assistant</h1>
              <p className="text-xs text-muted-foreground">{getTranslation('medicalAssistant')}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-lg">{language.flag}</span>
                {language.native}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearHistory}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear History
              </Button>
            )}
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConnectionStatusColor()}`}>
              {getConnectionStatusText()}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Chat Interface */}
          <Card className="card-shadow border-0">
            <CardHeader className="text-center">
              <CardTitle>Voice Conversation</CardTitle>
              <p className="text-xs text-muted-foreground">{getTranslation('voiceConversation')}</p>
              <p className="text-sm text-muted-foreground">
                Click to start speaking, AI will respond naturally
              </p>
              <p className="text-xs text-muted-foreground">{getTranslation('clickToSpeak')}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recording Button */}
              <div className="flex justify-center">
                <Button
                  onClick={toggleRecording}
                  disabled={connectionStatus !== 'connected'}
                  size="lg"
                  className={`rounded-full p-6 ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : connectionStatus === 'connected'
                        ? 'medical-gradient hover:scale-105'
                        : 'bg-gray-400 cursor-not-allowed'
                  } transition-all duration-300`}
                >
                  {isRecording ? (
                    <MicOff className="h-8 w-8 text-white" />
                  ) : (
                    <Mic className="h-8 w-8 text-white" />
                  )}
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {connectionStatus !== 'connected' 
                  ? 'Connecting to voice service...'
                  : isRecording 
                    ? 'Listening... AI will respond when you pause' 
                    : 'Click microphone to start conversation'}
              </p>
              <p className="text-center text-xs text-muted-foreground">
                {isRecording 
                  ? 'सुन रहा है... • শুনছি... • వింటున్నా...' 
                  : 'माइक्रोफोन पर क्लिक करें • মাইক্রোফোনে ক্লিক করুন • మైక్రోఫోన్‌పై క్లిక్ చేయండి'}
              </p>
            </CardContent>
          </Card>

          {/* Patient Summary */}
          <Card className="card-shadow border-0">
            <CardHeader>
              <CardTitle>Patient Summary</CardTitle>
              <p className="text-xs text-muted-foreground">रोगी सारांश • রোগীর সারসংক্ষেপ • రోगి సారాంశం</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {symptoms.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Reported Symptoms</h3>
                  <p className="text-xs text-muted-foreground mb-2">रिपोर्ट किए गए लक्षण</p>
                  <div className="flex flex-wrap gap-2">
                    {symptoms.map((symptom, index) => (
                      <Badge key={index} variant="secondary" className="bg-red-100 text-red-800">
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-medium mb-2">Additional Info</h3>
                <p className="text-xs text-muted-foreground mb-2">अतिरिक्त जानकारी</p>
                <p className="text-sm text-muted-foreground">
                  Patient reports symptoms in {language.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Patient reports symptoms in {language.native}
                </p>
              </div>

              {clinicalNotes && (
                <div className="pt-4">
                  <Button 
                    onClick={downloadClinicalNote}
                    className="w-full medical-gradient"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Clinical Note
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    क्लिनिकल नोट डाउनलोड करें
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Conversation History - Moved Below */}
        {messages.length > 0 && (
          <div className="mt-6">
            <Card className="card-shadow border-0">
              <CardHeader>
                <CardTitle>Conversation History</CardTitle>
                <p className="text-sm text-muted-foreground">Your conversation with the medical assistant</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-primary/10 ml-8'
                          : 'bg-secondary/10 mr-8'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="font-medium text-sm">
                          {message.type === 'user' ? 'You' : 'Assistant'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                      <p className="mt-1">{message.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealtimeChat;
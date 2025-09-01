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
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;

    try {
      const wavData = this.createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => this.playNext();
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const currentTranscriptRef = useRef('');

  useEffect(() => {
    // Initialize audio context
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    audioQueueRef.current = new AudioQueue(audioContextRef.current);
    
    // Connect to WebSocket
    const wsUrl = `wss://vjelsuxiuyzszirfrpnl.supabase.co/functions/v1/realtime-chat`;
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Connected to realtime chat');
      toast({
        title: "Connected",
        description: "Voice conversation is ready",
      });
    };
    
    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('Received message:', data.type);
      
      if (data.type === 'response.audio.delta') {
        // Play audio chunk
        const binaryString = atob(data.delta);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        await audioQueueRef.current?.addToQueue(bytes);
      } else if (data.type === 'response.audio_transcript.delta') {
        currentTranscriptRef.current += data.delta;
      } else if (data.type === 'response.audio_transcript.done') {
        if (currentTranscriptRef.current.trim()) {
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
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Could not connect to voice service",
        variant: "destructive"
      });
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket connection closed');
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
  }, []);

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
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
          description: "Could not access microphone",
          variant: "destructive"
        });
      }
    } else {
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
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="text-lg">{language.flag}</span>
                {language.native}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear History
                </Button>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                  🟢 Active Session
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Chat Interface */}
          <Card className="card-shadow border-0">
            <CardHeader className="text-center">
              <CardTitle>Voice Conversation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Click to start speaking, AI will respond naturally
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recording Button */}
              <div className="flex justify-center">
                <Button
                  onClick={toggleRecording}
                  size="lg"
                  className={`rounded-full p-6 ${
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'medical-gradient hover:scale-105'
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
                {isRecording 
                  ? 'Listening... AI will respond when you pause' 
                  : 'Click microphone to start conversation'}
              </p>

              {/* Messages */}
              {messages.length > 0 && (
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
              )}
            </CardContent>
          </Card>

          {/* Patient Summary */}
          <Card className="card-shadow border-0">
            <CardHeader>
              <CardTitle>Patient Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {symptoms.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Reported Symptoms</h3>
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
                <p className="text-sm text-muted-foreground">
                  Patient reports symptoms in {language.name}
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RealtimeChat;
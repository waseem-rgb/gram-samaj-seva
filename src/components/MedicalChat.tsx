import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mic, 
  MicOff, 
  FileText, 
  Download,
  Bot,
  User,
  ArrowLeft,
  Heart,
  Activity,
  Volume2
} from 'lucide-react';

interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ClinicalNote {
  patientConcerns: string[];
  symptoms: string[];
  duration: string;
  severity: string;
  additionalInfo: string;
  suggestedQuestions: string[];
}

interface MedicalChatProps {
  language: Language;
  onBack: () => void;
}

export default function MedicalChat({ language, onBack }: MedicalChatProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: language.code === 'hi' 
        ? 'नमस्ते! मैं आपका चिकित्सा सहायक हूं। कृपया अपनी स्वास्थ्य संबंधी चिंताओं के बारे में बोलें।'
        : language.code === 'bn'
        ? 'নমস্কার! আমি আপনার চিকিৎসা সহায়ক। অনুগ্রহ করে আপনার স্বাস্থ্যগত উদ্বেগের কথা বলুন।'
        : 'Hello! I am your medical assistant. Please speak about your health concerns.',
      timestamp: new Date()
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [clinicalNote, setClinicalNote] = useState<ClinicalNote>({
    patientConcerns: [],
    symptoms: [],
    duration: '',
    severity: '',
    additionalInfo: '',
    suggestedQuestions: []
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Play welcome message on component mount
  useEffect(() => {
    const playWelcomeMessage = async () => {
      try {
        const welcomeText = messages[0].content;
        await playTextToSpeech(welcomeText);
      } catch (error) {
        console.error('Error playing welcome message:', error);
      }
    };

    playWelcomeMessage();
  }, []);

  const playTextToSpeech = async (text: string) => {
    try {
      setIsPlayingAudio(true);
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, language: language.code }
      });

      if (error) throw error;

      // Create audio element and play
      const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audioRef.current.play();
    } catch (error) {
      console.error('Error playing text-to-speech:', error);
      setIsPlayingAudio(false);
      toast({
        title: "Audio Error",
        description: "Could not play audio response",
        variant: "destructive"
      });
    }
  };

  const handleVoiceMessage = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);

      // Convert audio to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Speech to text
      const { data: sttData, error: sttError } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio, language: language.code }
      });

      if (sttError) throw sttError;

      const userText = sttData.text;
      if (!userText.trim()) {
        toast({
          title: "No Speech Detected",
          description: "Please try speaking again",
          variant: "destructive"
        });
        return;
      }

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: userText,
        timestamp: new Date()
      };

      setMessages(prev => {
        const newMessages = [...prev, userMessage];
        
        // Get response
        setTimeout(async () => {
          try {
            const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-medical-response', {
              body: { 
                userMessage: userText, 
                language: language.code,
                conversationHistory: newMessages.slice(1) // Exclude welcome message
              }
            });

            if (aiError) throw aiError;

            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              type: 'assistant',
              content: aiData.response,
              timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
            updateClinicalNote(userText);
            
            // Play response
            await playTextToSpeech(aiData.response);
          } catch (error) {
            console.error('Error getting response:', error);
            toast({
              title: "Error",
              description: "Could not generate response",
              variant: "destructive"
            });
          }
        }, 500);

        return newMessages;
      });

    } catch (error) {
      console.error('Error processing voice message:', error);
      toast({
        title: "Processing Error",
        description: "Could not process your voice message",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateClinicalNote = (userInput: string) => {
    // Simulate clinical note extraction
    setClinicalNote(prev => ({
      ...prev,
      patientConcerns: [...prev.patientConcerns, userInput].slice(-5),
      symptoms: prev.symptoms.concat(['Fever', 'Headache']).slice(-10),
      duration: '2-3 days',
      severity: 'Moderate',
      additionalInfo: 'Patient reports symptoms in local language'
    }));
  };

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        audioChunksRef.current = [];
        mediaRecorderRef.current = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          handleVoiceMessage(audioBlob);
          
          // Clean up stream
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
        
        toast({
          title: "Recording Started",
          description: "Speak your health concerns..."
        });
        
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast({
          title: "Microphone Error",
          description: "Could not access microphone",
          variant: "destructive"
        });
      }
    }
  };

  const exportClinicalNote = () => {
    const noteContent = `
CLINICAL NOTE - MULTILINGUAL MEDICAL ASSISTANT
Generated: ${new Date().toLocaleString()}
Language: ${language.name} (${language.native})

PATIENT CONCERNS:
${clinicalNote.patientConcerns.join('\n')}

REPORTED SYMPTOMS:
${clinicalNote.symptoms.join(', ')}

DURATION: ${clinicalNote.duration}
SEVERITY: ${clinicalNote.severity}

ADDITIONAL INFORMATION:
${clinicalNote.additionalInfo}

CONVERSATION HISTORY:
${messages.map(m => `${m.type.toUpperCase()}: ${m.content}`).join('\n')}

---
This clinical note was generated automatically and requires doctor review for diagnosis and treatment.
    `;

    const blob = new Blob([noteContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-note-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-secondary-light/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 medical-gradient rounded-full">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">Medical Assistant</h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{language.flag}</span>
                    <span>{language.native}</span>
                  </div>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="bg-secondary-light">
              <Activity className="h-3 w-3 mr-1" />
              Active Session
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] card-shadow border-0">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <Bot className="h-5 w-5" />
                  Conversation
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col h-full p-0">
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${
                          message.type === 'user' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <div className={`p-2 rounded-full ${
                          message.type === 'user' 
                            ? 'warm-gradient' 
                            : 'medical-gradient'
                        }`}>
                          {message.type === 'user' ? (
                            <User className="h-4 w-4 text-white" />
                          ) : (
                            <Bot className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div className={`max-w-[80%] ${
                          message.type === 'user' ? 'text-right' : ''
                        }`}>
                          <div className={`p-4 rounded-lg ${
                            message.type === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                {/* Voice Interface */}
                <div className="border-t p-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        {language.code === 'hi' 
                          ? 'अपनी स्वास्थ्य समस्याओं के बारे में बोलें'
                          : language.code === 'bn'
                          ? 'আপনার স্বাস্থ্যগত সমস্যার কথা বলুন'
                          : 'Speak about your health concerns'
                        }
                      </p>
                      {isProcessing && (
                        <p className="text-xs text-primary">
                          {language.code === 'hi' 
                            ? 'प्रोसेसिंग...'
                            : language.code === 'bn'
                            ? 'প্রক্রিয়াকরণ...'
                            : 'Processing...'
                          }
                        </p>
                      )}
                    </div>
                    
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      size="lg"
                      onClick={toggleRecording}
                      disabled={isProcessing || isPlayingAudio}
                      className={`w-20 h-20 rounded-full transition-all duration-300 ${
                        isRecording ? 'animate-pulse' : 'medical-gradient hover:scale-105'
                      }`}
                    >
                      {isRecording ? (
                        <MicOff className="h-8 w-8" />
                      ) : isPlayingAudio ? (
                        <Volume2 className="h-8 w-8" />
                      ) : (
                        <Mic className="h-8 w-8" />
                      )}
                    </Button>
                    
                    <p className="text-xs text-center text-muted-foreground max-w-xs">
                      {isRecording 
                        ? (language.code === 'hi' 
                           ? 'रिकॉर्डिंग... बोलना बंद करने के लिए फिर से दबाएं'
                           : language.code === 'bn'
                           ? 'রেকর্ডিং... থামতে আবার চাপুন'
                           : 'Recording... Press again to stop')
                        : (language.code === 'hi' 
                           ? 'माइक्रोफ़ोन दबाएं और बोलें'
                           : language.code === 'bn'
                           ? 'মাইক্রোফোন চাপুন এবং বলুন'
                           : 'Press microphone and speak')
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Clinical Notes Panel */}
          <div>
            <Card className="h-[600px] card-shadow border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-secondary">
                  <FileText className="h-5 w-5" />
                  Clinical Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Patient Concerns</h4>
                  <div className="space-y-1">
                    {clinicalNote.patientConcerns.map((concern, index) => (
                      <p key={index} className="text-sm bg-muted p-2 rounded">
                        {concern}
                      </p>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2">Symptoms</h4>
                  <div className="flex flex-wrap gap-1">
                    {clinicalNote.symptoms.map((symptom, index) => (
                      <Badge key={index} variant="secondary">
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div>
                    <span className="font-semibold text-sm">Duration: </span>
                    <span className="text-sm">{clinicalNote.duration}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-sm">Severity: </span>
                    <Badge variant="outline">{clinicalNote.severity}</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2">Additional Info</h4>
                  <p className="text-sm text-muted-foreground">
                    {clinicalNote.additionalInfo}
                  </p>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={exportClinicalNote}
                    variant="healing"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Clinical Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
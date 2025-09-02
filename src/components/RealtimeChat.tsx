import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mic, MicOff, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { RealtimeChat as RealtimeChatClient } from '@/utils/RealtimeAudio';

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
  timestamp: number;
}

const RealtimeChat: React.FC<RealtimeChatProps> = ({ language, onBack }) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  
  // Refs for managing connections and audio
  const chatClientRef = useRef<RealtimeChatClient | null>(null);
  const currentTranscriptRef = useRef<string>('');

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
      },
      patientSummary: {
        hi: 'रोगी सारांश',
        bn: 'রোগীর সারসংক্ষেপ',
        te: 'రోగి సారాంశం',
        ta: 'நோயாளி சுருக்கம்',
        mr: 'रुग्ण सारांश',
        gu: 'દર્દીનો સારાંશ',
        kn: 'ರೋಗಿಯ ಸಾರಾಂಶ',
        ml: 'രോഗിയുടെ സംഗ്രഹം',
        pa: 'ਮਰੀਜ਼ ਦਾ ਸਾਰ',
        en: 'Patient Summary'
      },
      reportedSymptoms: {
        hi: 'रिपोर्ट किए गए लक्षण',
        bn: 'রিপোর্ট করা উপসর্গ',
        te: 'నివేదించబడిన లక్షణాలు',
        ta: 'தெரிவிக்கப்பட்ட அறிகுறிகள்',
        mr: 'नोंदवलेली लक्षणे',
        gu: 'રિપોર્ટ કરેલા લક્ષણો',
        kn: 'ವರದಿ ಮಾಡಿದ ಲಕ್ಷಣಗಳು',
        ml: 'റിപ്പോർട്ട് ചെയ്ത ലക്ഷണങ്ങൾ',
        pa: 'ਰਿਪੋਰਟ ਕੀਤੇ ਲੱਛਣ',
        en: 'Reported Symptoms'
      },
      downloadNote: {
        hi: 'नोट डाउनलोड करें',
        bn: 'নোট ডাউনলোড করুন',
        te: 'నోట్ డౌన్‌లోడ్ చేయండి',
        ta: 'குறிப்பை பதிவிறக்கவும்',
        mr: 'नोट डाउनलोड करा',
        gu: 'નોંધ ડાઉનલોડ કરો',
        kn: 'ಟಿಪ್ಪಣಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
        ml: 'കുറിപ്പ് ഡൗൺലോഡ് ചെയ്യുക',
        pa: 'ਨੋਟ ਡਾਊਨਲੋਡ ਕਰੋ',
        en: 'Download Note'
      }
    };
    
    return translations[key]?.[language.code] || translations[key]?.['en'] || '';
  };

  const initializeSession = async () => {
    try {
      setConnectionStatus('connecting');
      
      const instructions = `You are a multilingual medical assistant for rural Indian patients. 
      - Always respond in the same language the user speaks (${language.name})
      - Be empathetic and understanding
      - Ask relevant follow-up questions about symptoms
      - Provide general health guidance but remind users to consult a doctor
      - Keep responses conversational and supportive
      - Adapt to the user's language automatically`;

      chatClientRef.current = new RealtimeChatClient((message) => {
        console.log('Received message:', message.type, message);

        switch (message.type) {
          case 'session.created':
            console.log('Session created successfully');
            setIsConnected(true);
            setConnectionStatus('connected');
            toast({
              title: "Connected",
              description: "Voice interface is ready",
            });
            break;
            
          case 'session.updated':
            console.log('Session updated successfully');
            break;

          case 'input_audio_buffer.speech_started':
            console.log('Speech started detected');
            break;

          case 'input_audio_buffer.speech_stopped':
            console.log('Speech stopped detected');
            break;

          case 'response.created':
            console.log('Response started');
            break;

          case 'response.audio_transcript.delta':
            // Handle streaming transcript
            if (message.delta) {
              currentTranscriptRef.current += message.delta;
            }
            break;

          case 'response.audio_transcript.done':
            // Complete transcript received
            if (currentTranscriptRef.current.trim()) {
              const assistantMessage: Message = {
                id: Date.now().toString(),
                type: 'assistant',
                content: currentTranscriptRef.current.trim(),
                timestamp: Date.now()
              };
              
              setMessages(prev => [...prev, assistantMessage]);
              setClinicalNotes(prev => prev + `\nAssistant: ${currentTranscriptRef.current.trim()}`);
              
              // Extract symptoms from assistant response
              const symptomKeywords = ['pain', 'fever', 'headache', 'nausea', 'fatigue', 'cough', 'breathing', 'chest', 'stomach'];
              const newSymptoms = symptomKeywords.filter(symptom => 
                currentTranscriptRef.current.toLowerCase().includes(symptom)
              );
              
              if (newSymptoms.length > 0) {
                setSymptoms(prev => [...new Set([...prev, ...newSymptoms])]);
              }
              
              currentTranscriptRef.current = '';
            }
            break;

          case 'conversation.item.input_audio_transcription.completed':
            if (message.transcript) {
              const userMessage: Message = {
                id: Date.now().toString(),
                type: 'user',
                content: message.transcript,
                timestamp: Date.now()
              };
              
              setMessages(prev => [...prev, userMessage]);
              setClinicalNotes(prev => prev + `\nPatient: ${message.transcript}`);
              
              // Extract symptoms from user input
              const symptomKeywords = ['दर्द', 'pain', 'बुखार', 'fever', 'सिरदर्द', 'headache', 'खांसी', 'cough'];
              const foundSymptoms = symptomKeywords.filter(keyword => 
                message.transcript.toLowerCase().includes(keyword.toLowerCase())
              );
              if (foundSymptoms.length > 0) {
                setSymptoms(prev => [...new Set([...prev, ...foundSymptoms])]);
              }
            }
            break;

          case 'response.done':
            console.log('Response completed');
            break;

          case 'error':
            console.error('OpenAI API error:', message);
            toast({
              title: "API Error",
              description: message.error?.message || 'An error occurred',
              variant: "destructive",
            });
            break;

          default:
            console.log('Unhandled message type:', message.type);
        }
      });

      await chatClientRef.current.init(instructions, 'nova');
      
    } catch (error) {
      console.error('Error initializing session:', error);
      setConnectionStatus('error');
      toast({
        title: "Initialization Error",
        description: error instanceof Error ? error.message : "Failed to initialize chat",
        variant: "destructive",
      });
    }
  };

  // Initialize session when component mounts
  useEffect(() => {
    initializeSession();
    
    return () => {
      // Cleanup
      if (chatClientRef.current) {
        chatClientRef.current.disconnect();
      }
    };
  }, []);

  const toggleRecording = async () => {
    if (!chatClientRef.current) {
      toast({
        title: "Connection Error",
        description: "Please wait for connection to be established",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!isRecording) {
        setIsRecording(true);
        console.log('Recording started');
        toast({
          title: "Recording Started",
          description: "Speak now, the AI will respond when you pause",
        });
      } else {
        setIsRecording(false);
        console.log('Recording stopped');
      }
    } catch (error) {
      console.error('Error toggling recording:', error);
      setIsRecording(false);
      toast({
        title: "Recording Error",
        description: error instanceof Error ? error.message : "Failed to access microphone",
        variant: "destructive",
      });
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
      description: "All conversation data has been cleared",
    });
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {getTranslation('medicalAssistant')}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-2xl">{language.flag}</span>
                <span>{language.native}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} />
                  <span>{getConnectionStatusText()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voice Interface */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{getTranslation('voiceConversation')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Messages */}
                <ScrollArea className="h-96 border rounded-md p-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {getTranslation('clickToSpeak')}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-lg ${
                            message.type === 'user' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Microphone Button */}
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={toggleRecording}
                    disabled={!isConnected}
                    className={`w-20 h-20 rounded-full transition-all duration-200 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                        : 'bg-primary hover:bg-primary/90'
                    }`}
                  >
                    {isRecording ? (
                      <MicOff className="h-8 w-8" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                  </Button>
                </div>

                {connectionStatus === 'connecting' && (
                  <p className="text-center text-sm text-muted-foreground">
                    Connecting to voice service...
                  </p>
                )}
                
                {connectionStatus === 'error' && (
                  <p className="text-center text-sm text-destructive">
                    Connection failed. Please refresh the page.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Patient Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {getTranslation('patientSummary')}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadClinicalNote}
                      disabled={messages.length === 0}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearHistory}
                      disabled={messages.length === 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">{getTranslation('reportedSymptoms')}</h4>
                  {symptoms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No symptoms reported yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {symptoms.map((symptom, index) => (
                        <Badge key={index} variant="secondary">
                          {symptom}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Clinical Notes</h4>
                  <ScrollArea className="h-32">
                    {clinicalNotes ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {clinicalNotes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No notes recorded yet
                      </p>
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealtimeChat;
import React, { useState, useEffect, useRef } from 'react';
import { useConversation } from '@11labs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, ArrowLeft, Download, Trash2, Volume2, VolumeX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
}

interface ElevenLabsChatProps {
  language: Language;
  onBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const ElevenLabsChat: React.FC<ElevenLabsChatProps> = ({ language, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.8);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs conversation');
      toast({
        title: "Connected",
        description: "Voice conversation is ready - start speaking!",
      });
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs conversation');
      setIsConnecting(false);
    },
    onMessage: (message) => {
      console.log('Received message:', message);
      
      if (message.source === 'user') {
        const userMessage: Message = {
          id: Date.now().toString(),
          type: 'user',
          content: message.message,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        setClinicalNotes(prev => prev + `\nPatient: ${message.message}`);
        
        // Extract symptoms (simple keyword matching)
        const symptomKeywords = ['दर्द', 'pain', 'बुखार', 'fever', 'सिरदर्द', 'headache', 'खांसी', 'cough', 'पेट', 'stomach'];
        const foundSymptoms = symptomKeywords.filter(keyword => 
          message.message.toLowerCase().includes(keyword.toLowerCase())
        );
        if (foundSymptoms.length > 0) {
          setSymptoms(prev => [...new Set([...prev, ...foundSymptoms])]);
        }
      } else if (message.source === 'ai') {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: message.message,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        setClinicalNotes(prev => prev + `\nAssistant: ${message.message}`);
      }
    },
    onError: (error) => {
      console.error('ElevenLabs conversation error:', error);
      toast({
        title: "Connection Error",
        description: "Voice conversation failed. Please try again.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  });

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
        hi: 'स्वचालित वॉयस बातचीत',
        bn: 'স্বয়ংক্রিয় ভয়েস কথোপকথন',
        te: 'ఆటోమేటిక్ వాయిస్ సంభాషణ',
        ta: 'தானியங்கி குரல் உரையாடல்',
        mr: 'स्वयंचलित आवाज संवाद',
        gu: 'સ્વચાલિત અવાજ વાતચીત',
        kn: 'ಸ್ವಯಂಚಾಲಿತ ಧ್ವನಿ ಸಂಭಾಷಣೆ',
        ml: 'ഓട്ടോമാറ്റിക് വോയ്സ് സംഭാഷണം',
        pa: 'ਆਟੋਮੈਟਿਕ ਆਵਾਜ਼ ਗੱਲਬਾਤ',
        en: 'Automatic Voice Conversation'
      },
      startConversation: {
        hi: 'बातचीत शुरू करें',
        bn: 'কথোপকথন শুরু করুন',
        te: 'సంభాషణ ప్రారంభించండి',
        ta: 'உரையாடலைத் தொடங்கவும்',
        mr: 'संवाद सुरू करा',
        gu: 'વાતચીત શરૂ કરો',
        kn: 'ಸಂಭಾಷಣೆ ಪ್ರಾರಂಭಿಸಿ',
        ml: 'സംഭാഷണം ആരംഭിക്കുക',
        pa: 'ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ',
        en: 'Start Conversation'
      },
      stopConversation: {
        hi: 'बातचीत बंद करें',
        bn: 'কথোপকথন বন্ধ করুন',
        te: 'సంభాషణ ఆపండి',
        ta: 'உரையாடலை நிறுத்தவும்',
        mr: 'संवाद थांबवा',
        gu: 'વાતચીત બંધ કરો',
        kn: 'ಸಂಭಾಷಣೆ ನಿಲ್ಲಿಸಿ',
        ml: 'സംഭാഷണം നിർത്തുക',
        pa: 'ਗੱਲਬਾਤ ਬੰਦ ਕਰੋ',
        en: 'Stop Conversation'
      },
      speaking: {
        hi: 'बोल रहा है...',
        bn: 'কথা বলছে...',
        te: 'మాట్లాడుతున్నా...',
        ta: 'பேசுகிறது...',
        mr: 'बोलत आहे...',
        gu: 'બોલી રહ્યું છે...',
        kn: 'ಮಾತನಾಡುತ್ತಿದೆ...',
        ml: 'സംസാരിക്കുന്നു...',
        pa: 'ਬੋਲ ਰਿਹਾ ਹੈ...',
        en: 'Speaking...'
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
        bn: 'রিপোর্ট করা লক্ষণ',
        te: 'నివేదించిన లక్షణాలు',
        ta: 'அறிக்கையிடப்பட்ட அறிகுறிகள்',
        mr: 'नोंदवलेली लक्षणे',
        gu: 'રિપોર્ટ કરેલા લક્ષણો',
        kn: 'ವರದಿ ಮಾಡಿದ ಲಕ್ಷಣಗಳು',
        ml: 'റിപ്പോർട്ട് ചെയ്ത ലക്ഷണങ്ങൾ',
        pa: 'ਰਿਪੋਰਟ ਕੀਤੇ ਲੱਛਣ',
        en: 'Reported Symptoms'
      },
      exportClinicalNote: {
        hi: 'क्लिनिकल नोट डाउनलोड करें',
        bn: 'ক্লিনিক্যাল নোট ডাউনলোড করুন',
        te: 'క్లినికల్ నోట్ డౌన్‌లోడ్ చేయండి',
        ta: 'மருத்துவ குறிப்பை பதிவிறக்கவும்',
        mr: 'क्लिनिकल नोट डाउनलोड करा',
        gu: 'ક્લિનિકલ નોંધ ડાઉનલોડ કરો',
        kn: 'ಕ್ಲಿನಿಕಲ್ ನೋಟ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ',
        ml: 'ക്ലിനിക്കൽ നോട്ട് ഡൗൺലോഡ് ചെയ്യുക',
        pa: 'ਕਲੀਨਿਕਲ ਨੋਟ ਡਾਊਨਲੋਡ ਕਰੋ',
        en: 'Export Clinical Note'
      },
      clearHistory: {
        hi: 'इतिहास साफ़ करें',
        bn: 'ইতিহাস মুছুন',
        te: 'చరిత్రను క్లియర్ చేయండి',
        ta: 'வரலாற்றை அழிக்கவும்',
        mr: 'इतिहास साफ करा',
        gu: 'ઇતિહાસ સાફ કરો',
        kn: 'ಇತಿಹಾಸವನ್ನು ತೆರವುಗೊಳಿಸಿ',
        ml: 'ചരിത്രം മായ്ക്കുക',
        pa: 'ਇਤਿਹਾਸ ਸਾਫ਼ ਕਰੋ',
        en: 'Clear History'
      }
    };
    
    return translations[key]?.[language.code] || translations[key]?.['en'] || '';
  };

  const startConversation = async () => {
    try {
      setIsConnecting(true);
      
      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone permission granted');
      } catch (permError) {
        console.error('Microphone permission denied:', permError);
        throw new Error('Microphone access is required for voice conversation');
      }
      
      // Get signed URL from our edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-agent', {
        body: { language: language.code }
      });

      if (error) throw error;
      
      setSignedUrl(data.signed_url);
      console.log('Starting conversation with URL:', data.signed_url);
      
      // Start conversation with signed URL
      const conversationId = await conversation.startSession({
        signedUrl: data.signed_url
      });
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Connection Error", 
        description: error instanceof Error ? error.message : "Could not start voice conversation. Please check microphone permissions.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  const stopConversation = async () => {
    try {
      await conversation.endSession();
      setIsConnecting(false);
    } catch (error) {
      console.error('Error stopping conversation:', error);
    }
  };

  const adjustVolume = (newVolume: number) => {
    setVolume(newVolume);
    conversation.setVolume({ volume: newVolume });
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
            {conversation.status === 'connected' && (
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                🟢 Live Conversation
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Chat Interface */}
          <Card className="card-shadow border-0">
            <CardHeader className="text-center">
              <CardTitle>Automatic Voice Conversation</CardTitle>
              <p className="text-xs text-muted-foreground">{getTranslation('voiceConversation')}</p>
              <p className="text-sm text-muted-foreground">
                Seamless conversation - just start talking naturally
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Control Buttons */}
              <div className="flex justify-center gap-4">
                {conversation.status !== 'connected' ? (
                  <Button
                    onClick={startConversation}
                    disabled={isConnecting}
                    size="lg"
                    className="medical-gradient hover:scale-105 transition-all duration-300"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    {isConnecting ? 'Connecting...' : getTranslation('startConversation')}
                  </Button>
                ) : (
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={stopConversation}
                      size="lg"
                      variant="destructive"
                    >
                      <MicOff className="h-5 w-5 mr-2" />
                      {getTranslation('stopConversation')}
                    </Button>
                    
                    {/* Volume Control */}
                    <div className="flex items-center gap-2">
                      <VolumeX className="h-4 w-4" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => adjustVolume(parseFloat(e.target.value))}
                        className="w-20"
                      />
                      <Volume2 className="h-4 w-4" />
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center">
                {conversation.status === 'connected' && (
                  <p className="text-sm">
                    {conversation.isSpeaking ? (
                      <span className="text-primary font-medium animate-pulse">
                        🔊 {getTranslation('speaking')}
                      </span>
                    ) : (
                      <span className="text-green-600">
                        🎤 Ready - Start speaking naturally
                      </span>
                    )}
                  </p>
                )}
              </div>

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
              <p className="text-xs text-muted-foreground">{getTranslation('patientSummary')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {symptoms.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Reported Symptoms</h3>
                  <p className="text-xs text-muted-foreground mb-2">{getTranslation('reportedSymptoms')}</p>
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
                  Automatic conversation in {language.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Real-time voice interaction with natural conversation flow
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
                    {getTranslation('exportClinicalNote')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ElevenLabsChat;
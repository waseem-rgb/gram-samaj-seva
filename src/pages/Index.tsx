import { useState } from 'react';
import LanguageSelector from '@/components/LanguageSelector';
import RealtimeChat from '@/components/RealtimeChat';
import MedicalChat from '@/components/MedicalChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Stethoscope, Users, Globe, Mic, Phone } from 'lucide-react';
import heroImage from '@/assets/medical-hero.jpg';

interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
}

const Index = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [voiceMode, setVoiceMode] = useState<'realtime' | 'push-to-talk'>('realtime');

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
  };

  const handleStartChat = () => {
    if (selectedLanguage) {
      setShowChat(true);
    }
  };

  const handleBackToHome = () => {
    setShowChat(false);
    setSelectedLanguage(null);
  };

  if (showChat && selectedLanguage) {
    if (voiceMode === 'realtime') {
      return <RealtimeChat language={selectedLanguage} onBack={handleBackToHome} />;
    } else {
      return <MedicalChat language={selectedLanguage} onBack={handleBackToHome} />;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-secondary-light/20">
      {/* Hero Section */}
      <div className="relative">
        <div 
          className="h-[60vh] bg-cover bg-center bg-no-repeat relative"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/60"></div>
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-white px-4">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-3 medical-gradient rounded-full flex-shrink-0">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-4xl md:text-6xl font-bold flex items-center gap-4">
                  <span>Med</span>
                  <Stethoscope className="h-12 w-12 md:h-16 md:w-16 text-white" />
                  <span>Assist</span>
                </h1>
              </div>
              <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
                Rural Health Assistant • ग्रामीण स्वास्थ्य सहायक
              </p>
              <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
                Bridging healthcare gaps in rural India with multilingual medical assistance
              </p>
              
              {/* Language Selection */}
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-4 flex-wrap justify-center">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    <span className="font-medium">Choose Your Language:</span>
                  </div>
                  <div className="min-w-[200px]">
                    <LanguageSelector 
                      onLanguageSelect={handleLanguageSelect} 
                      selectedLanguage={selectedLanguage}
                    />
                  </div>
                </div>
                
                {/* Voice Mode Selection */}
                {selectedLanguage && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Voice Mode:</span>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant={voiceMode === 'realtime' ? 'hero-solid' : 'hero-outline'}
                        onClick={() => setVoiceMode('realtime')}
                        className="flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        Realtime Chat
                        <Badge variant="secondary" className="text-xs ml-1">New</Badge>
                      </Button>
                      <Button
                        variant={voiceMode === 'push-to-talk' ? 'hero-solid' : 'hero-outline'}
                        onClick={() => setVoiceMode('push-to-talk')}
                        className="flex items-center gap-2"
                      >
                        <Mic className="h-4 w-4" />
                        Push-to-Talk
                      </Button>
                    </div>
                    <Button 
                      onClick={handleStartChat}
                      size="lg"
                      className="medical-gradient hover:scale-105 transition-all duration-300"
                    >
                      Start Voice Consultation
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simple steps to get medical assistance in your preferred language
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center card-shadow border-0">
            <CardHeader>
              <div className="mx-auto p-3 medical-gradient rounded-full w-fit mb-4">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Select Language</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Choose from 10 major Indian languages including Hindi, Bengali, Tamil, and more
              </p>
            </CardContent>
          </Card>

          <Card className="text-center card-shadow border-0">
            <CardHeader>
              <div className="mx-auto p-3 medical-gradient rounded-full w-fit mb-4">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Voice Consultation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Speak naturally about your health concerns in your native language
              </p>
            </CardContent>
          </Card>

          <Card className="text-center card-shadow border-0">
            <CardHeader>
              <div className="mx-auto p-3 medical-gradient rounded-full w-fit mb-4">
                <Users className="h-6 w-6 text-white" />
              </div>
              <CardTitle>Doctor Review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Generates clinical notes for qualified doctors to review and provide treatment
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-muted/30 py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full medical-gradient"></div>
            <span className="text-sm text-muted-foreground">Multilingual Medical Assistant</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Empowering rural communities with accessible healthcare through technology. 
            This tool assists in communication but does not replace professional medical advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;

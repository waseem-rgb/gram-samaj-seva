import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Languages, Globe } from 'lucide-react';

const languages = [
  { code: 'hi', name: 'हिंदी', native: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', native: 'Bengali', flag: '🇧🇩' },
  { code: 'te', name: 'తెలుగు', native: 'Telugu', flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी', native: 'Marathi', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', native: 'Tamil', flag: '🇮🇳' },
  { code: 'gu', name: 'ગુજરાતી', native: 'Gujarati', flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ', native: 'Kannada', flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം', native: 'Malayalam', flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', native: 'Punjabi', flag: '🇮🇳' },
  { code: 'en', name: 'English', native: 'English', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
];

interface LanguageSelectorProps {
  onLanguageSelect: (language: typeof languages[0]) => void;
}

export default function LanguageSelector({ onLanguageSelect }: LanguageSelectorProps) {
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  const handleLanguageSelect = (language: typeof languages[0]) => {
    setSelectedLang(language.code);
    onLanguageSelect(language);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/20 to-secondary-light/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl card-shadow border-0">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 medical-gradient rounded-full">
              <Languages className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            आपकी भाषा चुनें / Choose Your Language
          </CardTitle>
          <p className="text-muted-foreground mt-2 text-lg">
            कृपया अपनी पसंदीदा भाषा का चयन करें / Please select your preferred language
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {languages.map((language) => (
              <Button
                key={language.code}
                variant={selectedLang === language.code ? "medical" : "outline"}
                className="h-20 flex flex-col items-center justify-center space-y-2 transition-bounce hover:scale-105"
                onClick={() => handleLanguageSelect(language)}
              >
                <span className="text-2xl">{language.flag}</span>
                <div className="text-center">
                  <div className="font-semibold text-sm">{language.name}</div>
                  <div className="text-xs opacity-70">{language.native}</div>
                </div>
              </Button>
            ))}
          </div>
          
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
              <Globe className="h-5 w-5" />
              <span>Multilingual Medical Assistant</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Our AI medical assistant supports major Indian languages to help you communicate 
              with healthcare providers effectively. Your conversation will be translated and 
              documented for medical review.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
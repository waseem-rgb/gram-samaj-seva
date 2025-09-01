import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Language {
  code: string;
  name: string;
  native: string;
  flag: string;
}

interface LanguageSelectorProps {
  onLanguageSelect: (language: Language) => void;
  selectedLanguage?: Language;
}

export default function LanguageSelector({ onLanguageSelect, selectedLanguage }: LanguageSelectorProps) {
  const languages: Language[] = [
    { code: 'hi', name: 'Hindi', native: 'हिंदी', flag: '🇮🇳' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'en', name: 'English', native: 'English', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ];

  const handleLanguageChange = (languageCode: string) => {
    const language = languages.find(lang => lang.code === languageCode);
    if (language) {
      onLanguageSelect(language);
    }
  };

  return (
    <div className="w-full max-w-xs">
      <Select onValueChange={handleLanguageChange} value={selectedLanguage?.code}>
        <SelectTrigger className="w-full bg-white border-2 hover:border-primary/20 focus:border-primary z-50">
          <SelectValue placeholder="Select Language / भाषा चुनें" />
        </SelectTrigger>
        <SelectContent className="bg-card border-2 shadow-lg z-[100] max-h-60">
          {languages.map((language) => (
            <SelectItem 
              key={language.code} 
              value={language.code}
              className="hover:bg-primary/10 focus:bg-primary/10 cursor-pointer text-foreground"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{language.flag}</span>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{language.native}</span>
                  <span className="text-xs text-muted-foreground">{language.name}</span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
import { useState } from 'react';
import LanguageSelector from '@/components/LanguageSelector';
import MedicalChat from '@/components/MedicalChat';
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

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);
    setTimeout(() => setShowChat(true), 500);
  };

  const handleBackToLanguages = () => {
    setShowChat(false);
    setSelectedLanguage(null);
  };

  if (showChat && selectedLanguage) {
    return <MedicalChat language={selectedLanguage} onBack={handleBackToLanguages} />;
  }

  return <LanguageSelector onLanguageSelect={handleLanguageSelect} />;
};

export default Index;

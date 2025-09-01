import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { language } = await req.json()
    
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured')
    }

    console.log('Creating ElevenLabs agent for language:', language)

    // Create or get agent for the specific language
    const agentConfig = {
      name: `Medical Assistant - ${language}`,
      prompt: {
        prompt: `You are a multilingual medical assistant for rural Indian patients speaking ${language}. 

CRITICAL INSTRUCTIONS:
- Always respond in ${language} language only
- Be empathetic, warm, and understanding
- Ask relevant follow-up questions about symptoms
- Provide general health guidance but always remind patients to consult a qualified doctor
- Keep responses conversational and supportive
- Listen carefully to patient concerns
- If unclear, ask for clarification in a gentle manner
- Maintain patient privacy and confidentiality

CONVERSATION FLOW:
1. Greet the patient warmly in ${language}
2. Ask about their health concerns
3. Listen and ask follow-up questions
4. Provide supportive guidance
5. Recommend consulting a doctor for proper diagnosis
6. Offer to help with any other concerns

Remember: You are assisting, not diagnosing. Always recommend professional medical consultation.`
      },
      firstMessage: getFirstMessage(language),
      language: getLanguageCode(language),
      voice: {
        voiceId: "nova", // Good multilingual voice
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.2,
        useSpeakerBoost: true
      },
      llm: {
        model: "gpt-4o-mini",
        temperature: 0.7,
        maxTokens: 200
      }
    }

    // Create agent session
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      throw new Error(`Failed to create agent: ${response.status}`)
    }

    const agent = await response.json()
    console.log('Created agent:', agent.agent_id)

    // Generate signed URL for conversation
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agent.agent_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        },
      }
    )

    if (!signedUrlResponse.ok) {
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`)
    }

    const { signed_url } = await signedUrlResponse.json()
    
    return new Response(JSON.stringify({ 
      signed_url,
      agent_id: agent.agent_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function getFirstMessage(language: string): string {
  const messages: Record<string, string> = {
    'hi': 'नमस्ते! मैं आपका चिकित्सा सहायक हूं। कृपया अपनी स्वास्थ्य संबंधी चिंताओं के बारे में बताएं।',
    'bn': 'নমস্কার! আমি আপনার চিকিৎসা সহায়ক। অনুগ্রহ করে আপনার স্বাস্থ্য সংক্রান্ত উদ্বেগের কথা বলুন।',
    'te': 'నమస్కారం! నేను మీ వైద్య సహాయకుడిని। దయచేసి మీ ఆరోగ్య సమస్యల గురించి చెప్పండి।',
    'ta': 'வணக்கம்! நான் உங்கள் மருத்துவ உதவியாளர். உங்கள் உடல்நலக் கவலைகளைப் பற்றி கூறுங்கள்.',
    'mr': 'नमस्कार! मी तुमचा वैद्यकीय सहाय्यक आहे. कृपया तुमच्या आरोग्यसंबंधी चिंता सांगा.',
    'gu': 'નમસ્તે! હું તમારો તબીબી સહાયક છું. કૃપા કરીને તમારી સ્વાસ્થ્ય સંબંધિત ચિંતાઓ વિશે કહો.',
    'kn': 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ಸಹಾಯಕ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಗಳ ಬಗ್ಗೆ ಹೇಳಿ.',
    'ml': 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ മെഡിക്കൽ അസിസ്റ്റന്റാണ്. നിങ്ങളുടെ ആരോഗ്യ പ്രശ്നങ്ങളെക്കുറിച്ച് പറയുക.',
    'pa': 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ ਮੈਡੀਕਲ ਅਸਿਸਟੈਂਟ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀਆਂ ਸਿਹਤ ਸਮੱਸਿਆਵਾਂ ਬਾਰੇ ਦੱਸੋ।',
    'en': 'Hello! I am your medical assistant. Please tell me about your health concerns.'
  }
  
  return messages[language] || messages['en']
}

function getLanguageCode(language: string): string {
  const codes: Record<string, string> = {
    'hi': 'hi',
    'bn': 'bn', 
    'te': 'te',
    'ta': 'ta',
    'mr': 'mr',
    'gu': 'gu',
    'kn': 'kn',
    'ml': 'ml',
    'pa': 'pa',
    'en': 'en'
  }
  
  return codes[language] || 'en'
}
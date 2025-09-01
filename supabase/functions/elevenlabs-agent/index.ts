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

    console.log('Getting signed URL for ElevenLabs Conversational AI, language:', language)

    // For ElevenLabs Conversational AI, we need to use a pre-created agent
    // You would typically create agents in the ElevenLabs dashboard
    // For demo purposes, we'll use a generic agent approach
    
    // First, let's try to get or create a conversational agent
    const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
      },
    })

    let agentId = null
    
    if (agentResponse.ok) {
      const agents = await agentResponse.json()
      // Try to find an existing medical assistant agent
      const existingAgent = agents.agents?.find((agent: any) => 
        agent.name?.includes('Medical') || agent.name?.includes('Assistant')
      )
      
      if (existingAgent) {
        agentId = existingAgent.agent_id
        console.log('Using existing agent:', agentId)
      }
    }

    // If no agent found, try to use any available agent as fallback
    if (!agentId) {
      console.log('No existing medical agent found, trying to create one...')
      
      const createAgentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Medical Assistant ${Date.now()}`,
          prompt: {
            prompt: `You are a helpful medical assistant. Respond in ${language} language when possible. Be empathetic and provide general health guidance, but always recommend consulting a doctor for proper diagnosis.`
          },
          voice: {
            voice_id: "pNInz6obpgDQGcFmaJgB" // Adam voice
          },
          language: getLanguageCode(language)
        })
      })

      if (createAgentResponse.ok) {
        const newAgent = await createAgentResponse.json()
        agentId = newAgent.agent_id
        console.log('Created new agent:', agentId)
      } else {
        const createError = await createAgentResponse.text()
        console.error('Failed to create agent:', createError)
        
        // Try to use any existing agent as fallback
        if (agentResponse.ok) {
          const agents = await agentResponse.json()
          if (agents.agents && agents.agents.length > 0) {
            agentId = agents.agents[0].agent_id
            console.log('Using first available agent as fallback:', agentId)
          }
        }
        
        // If still no agent, return error
        if (!agentId) {
          throw new Error('No conversational agents available and cannot create new agent. Please create an agent in ElevenLabs dashboard first.')
        }
      }
    }

    // Generate signed URL for the conversation
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
        },
      }
    )

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text()
      console.error('Failed to get signed URL:', errorText)
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`)
    }

    const { signed_url } = await signedUrlResponse.json()
    
    return new Response(JSON.stringify({ 
      signed_url,
      agent_id: agentId
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
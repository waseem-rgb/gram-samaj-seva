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
    const { language = 'en' } = await req.json()
    
    console.log('🚀 ElevenLabs Agent Edge Function v2.1 - Starting request...')
    
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')
    console.log('🔍 Checking for ElevenLabs API key...')
    console.log('📊 Available env vars:', Object.keys(Deno.env.toObject()).filter(key => key.includes('ELEVEN')))
    
    if (!ELEVENLABS_API_KEY) {
      console.error('❌ ElevenLabs API key not found in environment variables')
      console.error('💡 Make sure ELEVENLABS_API_KEY is added in Supabase Edge Functions secrets')
      return new Response(JSON.stringify({ 
        error: 'ElevenLabs API key not configured. Please check your Supabase secrets configuration.',
        details: 'The ELEVENLABS_API_KEY environment variable is missing. Please add it in your Supabase dashboard.',
        troubleshooting: 'Go to Supabase Dashboard > Edge Functions > Secrets and verify ELEVENLABS_API_KEY is set'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('✅ ElevenLabs API key found - length:', ELEVENLABS_API_KEY.length, 'starts with:', ELEVENLABS_API_KEY.substring(0, 8) + '...')
    console.log('🚀 Getting signed URL for ElevenLabs Conversational AI, language:', language)

    // Check for predefined agent ID in environment
    const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID')
    let agentId = ELEVENLABS_AGENT_ID

    if (!agentId) {
      console.log('No predefined agent ID, fetching available agents...')
      
      // Get all available agents using correct xi-api-key header
      const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      })

      if (agentResponse.ok) {
        const agents = await agentResponse.json()
        console.log('Available agents:', agents.agents?.length || 0)
        
        if (agents.agents && agents.agents.length > 0) {
          // Try to find an existing medical assistant agent first
          const existingAgent = agents.agents.find((agent: any) => 
            agent.name?.toLowerCase().includes('medical') || 
            agent.name?.toLowerCase().includes('assistant') ||
            agent.name?.toLowerCase().includes('health')
          )
          
          if (existingAgent) {
            agentId = existingAgent.agent_id
            console.log('Using existing medical agent:', agentId)
          } else {
            // Use the first available agent
            agentId = agents.agents[0].agent_id
            console.log('Using first available agent:', agentId)
          }
        } else {
          console.log('No agents found in account')
        }
      } else {
        const errorText = await agentResponse.text()
        console.error('Failed to fetch agents. Status:', agentResponse.status, 'Response:', errorText)
        
        // If it's an auth error or permission error, suggest using predefined agent ID
        if (agentResponse.status === 401 || agentResponse.status === 403) {
          console.error('❌ API key missing convai_read permission or invalid')
          console.error('💡 Solution: Set ELEVENLABS_AGENT_ID in Supabase secrets to bypass agent fetching')
          return new Response(JSON.stringify({ 
            error: 'ElevenLabs API key missing permissions or invalid. Please add ELEVENLABS_AGENT_ID to your Supabase secrets.',
            details: 'Either upgrade your ElevenLabs API key permissions or set ELEVENLABS_AGENT_ID in Supabase Edge Functions secrets with your agent ID from https://elevenlabs.io/app/conversational-ai',
            troubleshooting: 'Go to https://elevenlabs.io/app/conversational-ai, copy your Agent ID, then add it as ELEVENLABS_AGENT_ID secret in Supabase'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    } else {
      console.log('Using predefined agent ID:', agentId)
    }

    // If we still don't have an agent, return error
    if (!agentId) {
      console.error('No conversational agents available')
      return new Response(JSON.stringify({ 
        error: 'No conversational agents found in your ElevenLabs account. Please create at least one agent first.',
        details: 'Visit https://elevenlabs.io/app/conversational-ai to create an agent, then try again.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate signed URL for the conversation
    console.log('Getting signed URL for agent:', agentId)
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    )

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text()
      console.error('Failed to get signed URL:', errorText)
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status} - ${errorText}`)
    }

    const { signed_url } = await signedUrlResponse.json()
    console.log('Successfully got signed URL')
    
    return new Response(JSON.stringify({ 
      signed_url,
      agent_id: agentId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      suggestion: 'Please ensure you have created at least one conversational agent in your ElevenLabs dashboard.'
    }), {
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
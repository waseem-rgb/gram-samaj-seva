import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🧪 TESTING ELEVENLABS API KEY VALIDITY')
    
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    
    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'No API key found',
        test: 'failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('✅ API Key found, length:', apiKey.length)
    console.log('🔑 Key starts with:', apiKey.substring(0, 8) + '...')
    
    // Test with simple voices API call (requires less permissions)
    console.log('📞 Testing voices API call...')
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    })
    
    console.log('📊 Voices API Status:', voicesResponse.status)
    
    if (voicesResponse.ok) {
      const voices = await voicesResponse.json()
      console.log('✅ API KEY VALID - Found', voices.voices?.length || 0, 'voices')
      
      // Now test conversational AI agents
      console.log('🤖 Testing conversational agents API...')
      const agentsResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      })
      
      console.log('🤖 Agents API Status:', agentsResponse.status)
      
      if (agentsResponse.ok) {
        const agents = await agentsResponse.json()
        console.log('✅ CONVERSATIONAL AI ACCESS - Found', agents.agents?.length || 0, 'agents')
        
        return new Response(JSON.stringify({
          test: 'success',
          apiKeyValid: true,
          voicesCount: voices.voices?.length || 0,
          agentsCount: agents.agents?.length || 0,
          message: 'API key is valid and has conversational AI access'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        const agentError = await agentsResponse.text()
        console.error('❌ CONVERSATIONAL AI ACCESS DENIED:', agentError)
        
        return new Response(JSON.stringify({
          test: 'partial',
          apiKeyValid: true,
          voicesAccess: true,
          conversationalAiAccess: false,
          error: agentError,
          solution: 'Your API key works but lacks Conversational AI permissions. Upgrade your ElevenLabs plan or get a new API key with ConvAI access.'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      const error = await voicesResponse.text()
      console.error('❌ API KEY INVALID:', error)
      
      return new Response(JSON.stringify({
        test: 'failed',
        apiKeyValid: false,
        error: error,
        solution: 'Please check your ElevenLabs API key. Get a new one from https://elevenlabs.io/app/settings/api-keys'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
  } catch (error) {
    console.error('Test error:', error)
    return new Response(JSON.stringify({
      test: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
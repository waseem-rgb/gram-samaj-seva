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
    
    console.log('🚀 ElevenLabs Agent Edge Function v3.0 - FORCE REDEPLOY')
    console.log('🔧 COMPREHENSIVE DEBUG MODE ENABLED')
    
    // Get all environment variables
    const allEnvVars = Deno.env.toObject()
    const envKeys = Object.keys(allEnvVars)
    
    console.log('📊 TOTAL ENV VARS:', envKeys.length)
    console.log('🗝️  ALL ENV VAR KEYS:', JSON.stringify(envKeys))
    
    // Look for ElevenLabs related keys
    const elevenLabsKeys = envKeys.filter(key => 
      key.toLowerCase().includes('eleven') || 
      key.toLowerCase().includes('xi') ||
      key.toLowerCase().includes('api')
    )
    console.log('🎯 ELEVENLABS/API RELATED KEYS:', JSON.stringify(elevenLabsKeys))
    
    // Try different variations
    const possibleKeys = [
      'ELEVENLABS_API_KEY',
      'ELEVEN_LABS_API_KEY', 
      'elevenlabs_api_key',
      'XI_API_KEY',
      'OPENAI_API_KEY' // Just to see if any API keys work
    ]
    
    console.log('🔍 TESTING POSSIBLE KEY VARIATIONS:')
    let foundKey = null
    let foundValue = null
    
    for (const key of possibleKeys) {
      const value = Deno.env.get(key)
      console.log(`   ${key}: ${value ? 'FOUND (length: ' + value.length + ')' : 'NOT_FOUND'}`)
      if (value && !foundKey) {
        foundKey = key
        foundValue = value
      }
    }
    
    if (!foundValue) {
      console.error('❌ NO VALID API KEY FOUND IN ANY VARIATION')
      console.error('💡 AVAILABLE SECRETS:', JSON.stringify(envKeys.filter(k => k.includes('API') || k.includes('KEY'))))
      
      return new Response(JSON.stringify({ 
        error: 'ElevenLabs API key not found in environment variables',
        debug: {
          totalEnvVars: envKeys.length,
          apiRelatedKeys: envKeys.filter(k => k.includes('API') || k.includes('KEY')),
          elevenLabsKeys: elevenLabsKeys,
          searchedKeys: possibleKeys
        },
        solution: 'Please verify ELEVENLABS_API_KEY is set in Supabase Edge Functions secrets'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('✅ FOUND API KEY:', foundKey, 'length:', foundValue.length)
    console.log('🚀 Proceeding with ElevenLabs API call...')

    // Check for agent ID
    const ELEVENLABS_AGENT_ID = Deno.env.get('ELEVENLABS_AGENT_ID')
    let agentId = ELEVENLABS_AGENT_ID

    if (!agentId) {
      console.log('No predefined agent ID, fetching available agents...')
      
      // Get all available agents using correct xi-api-key header
      const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
        method: 'GET',
        headers: {
          'xi-api-key': foundValue,
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
          'xi-api-key': foundValue,
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
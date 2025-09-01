import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const upgrade = req.headers.get("upgrade") || ""
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected websocket", { status: 426 })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)
  
  let openaiWs: WebSocket | null = null
  
  socket.addEventListener("open", () => {
    console.log("Client WebSocket connection opened")
    
    // Connect to OpenAI Realtime API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      socket.send(JSON.stringify({ error: 'OpenAI API key not configured' }))
      return
    }

    openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    })

    openaiWs.addEventListener("open", () => {
      console.log("Connected to OpenAI Realtime API")
    })

    openaiWs.addEventListener("message", (event) => {
      const data = JSON.parse(event.data)
      console.log("OpenAI message:", data.type)
      
      // Handle session.created event
      if (data.type === 'session.created') {
        console.log("Session created, sending session update")
        
        // Update session configuration for medical assistant
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: `You are a multilingual medical assistant for rural Indian patients. 
            - Always respond in the same language the user speaks (Hindi, Bengali, Telugu, etc.)
            - Be empathetic and understanding
            - Ask relevant follow-up questions about symptoms
            - Provide general health guidance but remind users to consult a doctor
            - Keep responses conversational and supportive
            - If user speaks in Hindi, respond in Hindi
            - If user speaks in Bengali, respond in Bengali
            - Adapt to the user's language automatically`,
            voice: 'nova',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.7,
            max_response_output_tokens: 'inf'
          }
        }
        
        openaiWs?.send(JSON.stringify(sessionUpdate))
      }
      
      // Forward all messages to client
      socket.send(event.data)
    })

    openaiWs.addEventListener("error", (error) => {
      console.error("OpenAI WebSocket error:", error)
      socket.send(JSON.stringify({ error: 'OpenAI connection error' }))
    })

    openaiWs.addEventListener("close", () => {
      console.log("OpenAI WebSocket closed")
      socket.close()
    })
  })

  socket.addEventListener("message", (event) => {
    // Forward client messages to OpenAI
    if (openaiWs?.readyState === WebSocket.OPEN) {
      console.log("Forwarding message to OpenAI:", JSON.parse(event.data).type)
      openaiWs.send(event.data)
    }
  })

  socket.addEventListener("close", () => {
    console.log("Client WebSocket connection closed")
    if (openaiWs) {
      openaiWs.close()
    }
  })

  socket.addEventListener("error", (error) => {
    console.error("Client WebSocket error:", error)
    if (openaiWs) {
      openaiWs.close()
    }
  })

  return response
})
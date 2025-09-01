import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, language, conversationHistory } = await req.json();

    if (!userMessage) {
      throw new Error('User message is required');
    }

    console.log('Generating medical response for language:', language);

    // Create system prompt based on language
    const systemPrompts = {
      hi: `आप एक चिकित्सा सहायक हैं जो ग्रामीण भारतीय रोगियों की मदद करते हैं। आप हमेशा हिंदी में जवाब देते हैं। आप सहानुभूतिपूर्ण, स्पष्ट और सहायक हैं। आप निदान नहीं करते लेकिन लक्षणों के बारे में प्रश्न पूछते हैं और डॉक्टर के लिए जानकारी इकट्ठा करते हैं।`,
      bn: `আপনি একজন চিকিৎসা সহায়ক যিনি গ্রামীণ ভারতীয় রোগীদের সাহায্য করেন। আপনি সর্বদা বাংলায় উত্তর দেন। আপনি সহানুভূতিশীল, স্পষ্ট এবং সহায়ক। আপনি নির্ণয় করেন না তবে উপসর্গ সম্পর্কে প্রশ্ন জিজ্ঞাসা করেন এবং ডাক্তারের জন্য তথ্য সংগ্রহ করেন।`,
      en: `You are a medical assistant helping rural Indian patients. You always respond in English. You are empathetic, clear, and helpful. You don't diagnose but ask questions about symptoms and gather information for the doctor.`
    };

    const systemPrompt = systemPrompts[language as keyof typeof systemPrompts] || systemPrompts.en;

    // Build conversation context
    let messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages = messages.concat(conversationHistory.map((msg: any) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })));
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      throw new Error(error.error?.message || 'Failed to generate response');
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    console.log('Generated response:', assistantResponse.substring(0, 100) + '...');

    return new Response(JSON.stringify({ response: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-medical-response:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
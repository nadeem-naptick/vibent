import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // AI prompt to suggest a top website URL for the given project idea
    const aiPrompt = `For "${prompt}", suggest the URL of ONE top website/platform in this category.

Return only the domain (e.g., "stripe.com" or "figma.com" or "notion.so").

Choose a well-known, modern platform that would be good design inspiration.

URL:`;

    // Call GPT-5 with the content suggestion prompt
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: aiPrompt,
      maxTokens: 20,
      temperature: 0.3
    });

    const suggestion = result.text.trim();
    
    return NextResponse.json({ suggestion });
    
  } catch (error) {
    console.error('Error generating content suggestion:', error);
    
    // Fallback to mock suggestion if GPT-5 fails
    try {
      const suggestion = await generateAISuggestion(aiPrompt, prompt);
      return NextResponse.json({ suggestion });
    } catch (fallbackError) {
      console.error('Fallback suggestion also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to generate suggestion' },
        { status: 500 }
      );
    }
  }
}

// Mock AI function - replace with actual AI service call
async function generateAISuggestion(aiPrompt: string, userPrompt: string): Promise<string> {
  // This is a placeholder - replace with actual AI API call
  // Example with OpenAI:
  /*
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: aiPrompt }],
      max_tokens: 50,
      temperature: 0.7,
    }),
  });
  
  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
  */
  
  // Temporary fallback logic
  const lowerPrompt = userPrompt.toLowerCase();
  
  if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) {
    return Math.random() > 0.5 ? 'shopify.com' : 'modern ecommerce design';
  }
  if (lowerPrompt.includes('portfolio')) {
    return Math.random() > 0.5 ? 'dribbble.com' : 'creative portfolio design';
  }
  if (lowerPrompt.includes('dashboard')) {
    return Math.random() > 0.5 ? 'stripe.com/dashboard' : 'admin dashboard design';
  }
  if (lowerPrompt.includes('blog')) {
    return Math.random() > 0.5 ? 'medium.com' : 'minimalist blog design';
  }
  if (lowerPrompt.includes('restaurant') || lowerPrompt.includes('food')) {
    return Math.random() > 0.5 ? 'sweetgreen.com' : 'restaurant website design';
  }
  if (lowerPrompt.includes('travel')) {
    return Math.random() > 0.5 ? 'airbnb.com' : 'travel booking website';
  }
  if (lowerPrompt.includes('finance')) {
    return Math.random() > 0.5 ? 'stripe.com' : 'fintech website design';
  }
  
  return 'modern website design';
}
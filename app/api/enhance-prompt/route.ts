import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, projectType } = await req.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // AI prompt for enhancing user descriptions - simplified for speed
    const aiPrompt = `Transform "${prompt}" into 2-3 clear sentences describing the project's main purpose, key features, and target audience. Keep it under 50 words and actionable.`;

    // Call GPT-5 with the enhanced prompt
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt: aiPrompt,
      maxTokens: 50,
      temperature: 0.3
    });

    const enhancedPrompt = result.text.trim();
    
    return NextResponse.json({ enhancedPrompt });
    
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    
    // Fallback to mock enhancement if GPT-5 fails
    try {
      const enhancedPrompt = await generateEnhancedPrompt(aiPrompt, prompt, projectType);
      return NextResponse.json({ enhancedPrompt });
    } catch (fallbackError) {
      console.error('Fallback enhancement also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to enhance prompt' },
        { status: 500 }
      );
    }
  }
}

// Mock AI function - replace with actual AI service call
async function generateEnhancedPrompt(aiPrompt: string, userPrompt: string, projectType: string): Promise<string> {
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
      model: 'gpt-4',
      messages: [{ role: 'user', content: aiPrompt }],
      max_tokens: 300,
      temperature: 0.7,
    }),
  });
  
  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || userPrompt;
  */
  
  // Temporary fallback logic
  const lowerPrompt = userPrompt.toLowerCase();
  
  if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) {
    return `Create a modern e-commerce ${projectType === 'application' ? 'application' : 'website'} with comprehensive product catalog, advanced shopping cart functionality, secure user authentication, and streamlined checkout process. Include intelligent product search and filtering, customer reviews and ratings, wishlist functionality, and responsive design optimized for mobile and desktop experiences.`;
  }
  
  if (lowerPrompt.includes('portfolio')) {
    return `Design a professional portfolio ${projectType === 'application' ? 'application' : 'website'} that effectively showcases projects, skills, and professional experience. Include an engaging about section, interactive project gallery with detailed case studies, contact form with social media integration, downloadable resume, and performance-optimized responsive design.`;
  }
  
  if (lowerPrompt.includes('dashboard')) {
    return `Build a comprehensive dashboard application featuring secure user authentication, interactive data visualization charts, real-time updates and notifications, intuitive navigation structure, customizable widgets and layouts, data export functionality, and responsive design that works seamlessly across various screen sizes and devices.`;
  }
  
  if (lowerPrompt.includes('blog')) {
    return `Create a modern blog ${projectType === 'application' ? 'platform' : 'website'} with robust article management system, categorization and tagging, powerful search functionality, engagement features like comments and social sharing, author profiles and bios, SEO optimization, and mobile-first responsive design.`;
  }
  
  if (lowerPrompt.includes('restaurant') || lowerPrompt.includes('food')) {
    return `Develop a restaurant website featuring an appealing menu display with high-quality food photography, online reservation system, location and hours information, customer reviews section, social media integration, mobile-optimized design for on-the-go browsing, and easy contact functionality.`;
  }
  
  if (lowerPrompt.includes('landing')) {
    return `Create a high-converting landing page with compelling hero section, clear value proposition, feature highlights, social proof and testimonials, strategic call-to-action buttons, mobile-responsive design, fast loading performance, and conversion tracking capabilities.`;
  }
  
  // Generic enhancement
  return `Create a professional ${projectType === 'application' ? 'web application' : 'website'} for ${userPrompt}. Include modern, clean design with intuitive user interface, responsive layout that works on all devices, smooth navigation experience, optimized performance and loading speeds, accessibility compliance, and cross-browser compatibility.`;
}
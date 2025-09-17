import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (!process.env.FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY environment variable is not set');
      return NextResponse.json({ error: 'Search service not configured' }, { status: 500 });
    }

    // Use Firecrawl search to get top 20 results with screenshots
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit: 20,
        scrapeOptions: {
          formats: ['markdown', 'screenshot'],
          onlyMainContent: false,
        },
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Firecrawl API error:', searchResponse.status, errorText);
      throw new Error(`Search failed: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    
    // Format results with screenshots and markdown
    const results = searchData.data?.map((result: any) => ({
      url: result.url,
      title: result.title || result.url,
      description: result.description || '',
      screenshot: result.screenshot || null,
      markdown: result.markdown || '',
    })) || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
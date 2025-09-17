import { NextRequest, NextResponse } from 'next/server';
import { getProjectsCollection } from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { projectId, updateAll } = await req.json();
    
    const projectsCollection = await getProjectsCollection();
    
    if (updateAll) {
      // Update all existing projects with missing or placeholder thumbnails
      console.log('[update-thumbnails] Starting bulk thumbnail update...');
      
      // Find all ready projects with placeholder or empty thumbnails
      const projects = await projectsCollection.find({
        status: 'ready',
        $or: [
          { thumbnail: '' },
          { thumbnail: { $exists: false } },
          { thumbnail: { $regex: '^data:image/svg\\+xml' } } // Placeholder SVGs
        ]
      }).toArray();
      
      console.log(`[update-thumbnails] Found ${projects.length} projects needing thumbnail updates`);
      
      let updated = 0;
      let failed = 0;
      
      for (const project of projects) {
        try {
          console.log(`[update-thumbnails] Updating thumbnail for project ${project.projectId}`);
          
          const screenshot = await captureProjectScreenshot(project.url);
          
          if (screenshot && !screenshot.includes('data:image/svg+xml')) {
            // Only update if we got a real screenshot (not placeholder)
            await projectsCollection.updateOne(
              { projectId: project.projectId },
              { 
                $set: { 
                  thumbnail: screenshot,
                  'metadata.thumbnailUpdatedAt': new Date(),
                  'metadata.updatedAt': new Date()
                }
              }
            );
            updated++;
            console.log(`[update-thumbnails] Updated thumbnail for project ${project.projectId}`);
          } else {
            console.warn(`[update-thumbnails] Failed to get real screenshot for project ${project.projectId}`);
            failed++;
          }
          
          // Add a delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (error) {
          console.error(`[update-thumbnails] Error updating project ${project.projectId}:`, error);
          failed++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Bulk update completed: ${updated} updated, ${failed} failed`,
        updated,
        failed,
        total: projects.length
      });
      
    } else if (projectId) {
      // Update single project
      const project = await projectsCollection.findOne({ projectId });
      
      if (!project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      
      if (project.status !== 'ready') {
        return NextResponse.json(
          { error: 'Project must be ready to update thumbnail' },
          { status: 400 }
        );
      }
      
      console.log(`[update-thumbnails] Updating thumbnail for project ${projectId}`);
      
      const screenshot = await captureProjectScreenshot(project.url);
      
      if (screenshot) {
        await projectsCollection.updateOne(
          { projectId },
          { 
            $set: { 
              thumbnail: screenshot,
              'metadata.thumbnailUpdatedAt': new Date(),
              'metadata.updatedAt': new Date()
            }
          }
        );
        
        return NextResponse.json({
          success: true,
          projectId,
          thumbnail: screenshot,
          message: 'Thumbnail updated successfully'
        });
      } else {
        return NextResponse.json(
          { error: 'Failed to capture screenshot' },
          { status: 500 }
        );
      }
      
    } else {
      return NextResponse.json(
        { error: 'Either projectId or updateAll=true is required' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('[update-thumbnails] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update thumbnails', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Capture screenshot using Firecrawl API with retry logic and multiple approaches
async function captureProjectScreenshot(url: string, maxRetries = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[screenshot] Attempt ${attempt}/${maxRetries} - Capturing screenshot for ${url}`);
      
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) {
        console.warn('[screenshot] No Firecrawl API key available');
        return null;
      }

      // Try different screenshot approaches with shorter timeouts for API calls
      const approaches = [
        // Approach 1: Simple screenshot format (fastest)
        {
          name: 'simple-screenshot',
          config: {
            url,
            formats: ['screenshot'],
            onlyMainContent: false,
            timeout: 25000
          }
        },
        // Approach 2: Screenshot with minimal wait
        {
          name: 'screenshot-with-wait',
          config: {
            url,
            formats: ['screenshot'],
            onlyMainContent: false,
            timeout: 30000,
            actions: [
              {
                type: 'wait',
                milliseconds: 1000
              },
              {
                type: 'screenshot'
              }
            ]
          }
        }
      ];

      for (const approach of approaches) {
        try {
          console.log(`[screenshot] Trying approach: ${approach.name}`);
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(approach.config)
          });

          console.log(`[screenshot] Response status: ${scrapeResponse.status}`);
          
          if (!scrapeResponse.ok) {
            const errorText = await scrapeResponse.text();
            console.warn(`[screenshot] Firecrawl API error (${approach.name}): ${scrapeResponse.status} - ${errorText.substring(0, 200)}`);
            continue; // Try next approach
          }

          const scrapeResult = await scrapeResponse.json();
          
          // Check for screenshot in multiple possible locations
          let screenshot = null;
          if (scrapeResult?.data?.screenshot) {
            screenshot = scrapeResult.data.screenshot;
            console.log('[screenshot] Found screenshot in data.screenshot');
          } else if (scrapeResult?.data?.actions?.[0]?.screenshots?.[0]) {
            screenshot = scrapeResult.data.actions[0].screenshots[0];
            console.log('[screenshot] Found screenshot in actions.screenshots');
          } else if (scrapeResult?.screenshot) {
            screenshot = scrapeResult.screenshot;
            console.log('[screenshot] Found screenshot in root.screenshot');
          }
          
          if (screenshot && (screenshot.startsWith('http') || screenshot.startsWith('data:image'))) {
            console.log(`[screenshot] Successfully captured screenshot using ${approach.name}`);
            return screenshot;
          } else if (screenshot) {
            console.log(`[screenshot] Got screenshot but invalid format: ${screenshot.substring(0, 100)}...`);
          }
          
        } catch (approachError) {
          console.error(`[screenshot] Approach ${approach.name} failed:`, approachError.message);
          continue;
        }
      }
      
      console.warn(`[screenshot] All approaches failed on attempt ${attempt}`);
      
      if (attempt < maxRetries) {
        const retryDelay = 2000 * attempt;
        console.log(`[screenshot] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
    } catch (error) {
      console.error(`[screenshot] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const retryDelay = 2000 * attempt;
        console.log(`[screenshot] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.warn(`[screenshot] All ${maxRetries} attempts failed`);
  return null;
}

// GET endpoint to check update status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    if (action === 'check') {
      const projectsCollection = await getProjectsCollection();
      
      // Count projects needing thumbnail updates
      const needingUpdate = await projectsCollection.countDocuments({
        status: 'ready',
        $or: [
          { thumbnail: '' },
          { thumbnail: { $exists: false } },
          { thumbnail: { $regex: '^data:image/svg\\+xml' } }
        ]
      });
      
      const totalReady = await projectsCollection.countDocuments({ status: 'ready' });
      
      return NextResponse.json({
        totalReady,
        needingUpdate,
        hasApiKey: !!process.env.FIRECRAWL_API_KEY
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[update-thumbnails] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check thumbnail status' },
      { status: 500 }
    );
  }
}
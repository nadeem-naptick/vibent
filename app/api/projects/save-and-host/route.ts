import { NextRequest, NextResponse } from 'next/server';
import { getProjectsCollection } from '@/lib/mongodb';
import { 
  generateProjectId, 
  createProjectDocument, 
  validateProjectData,
  captureIframeScreenshot
} from '@/lib/project-utils';

export async function POST(req: NextRequest) {
  try {
    // Check if project hosting is enabled
    if (process.env.ENABLE_PROJECT_HOSTING !== 'true') {
      return NextResponse.json(
        { error: 'Project hosting is disabled' },
        { status: 503 }
      );
    }

    const projectData = await req.json();
    
    // Check if we have zip data or individual files
    if (!projectData.zipData && !projectData.files) {
      return NextResponse.json(
        { error: 'Either zipData or files array is required' },
        { status: 400 }
      );
    }
    
    // If using zipData, validate that
    if (projectData.zipData && !projectData.zipData.dataUrl) {
      return NextResponse.json(
        { error: 'zipData.dataUrl is required when using zipData' },
        { status: 400 }
      );
    }
    
    // If using files, validate those
    if (projectData.files) {
      const validation = validateProjectData(projectData);
      if (!validation.isValid) {
        return NextResponse.json(
          { error: 'Invalid project data', details: validation.errors },
          { status: 400 }
        );
      }
    }

    // Generate unique project ID
    const projectId = generateProjectId();
    
    // Create project document
    const projectDoc = createProjectDocument(projectData, projectId);
    
    // Save to MongoDB
    const projectsCollection = await getProjectsCollection();
    const result = await projectsCollection.insertOne(projectDoc);
    
    if (!result.acknowledged) {
      throw new Error('Failed to save project to database');
    }

    console.log(`[save-and-host] Project saved with ID: ${projectId}`);
    
    // Queue deployment job for EC2 service to process
    if (projectData.zipData) {
      await queueDeploymentJob(projectId, undefined, projectData.zipData);
    } else {
      await queueDeploymentJob(projectId, projectData.files);
    }
    console.log(`[save-and-host] Deployment job queued for project ${projectId}`);
    
    // Return immediate response with project info
    return NextResponse.json({ 
      success: true,
      projectId,
      url: projectDoc.url,
      status: 'building',
      message: 'Project is being built and deployed. It will be ready shortly.'
    });
    
  } catch (error) {
    console.error('[save-and-host] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Queue deployment job for EC2 service to process
async function queueDeploymentJob(projectId: string, files?: any[], zipData?: any) {
  try {
    console.log(`[queue-deploy] Queuing deployment job for project ${projectId}`);
    
    const deploymentJob = {
      projectId,
      ...(zipData ? { zipData } : { 
        files: files?.map(f => ({
          path: f.path,
          content: f.content
        })) || []
      }),
      timestamp: new Date().toISOString(),
      retries: 0,
      maxRetries: 3
    };
    
    // Add to Redis queue (or use a simple HTTP call to EC2 deployment service)
    if (process.env.REDIS_URL) {
      // Use Redis queue in production
      const redis = await getRedisClient();
      await redis.lpush('deployment-queue', JSON.stringify(deploymentJob));
      console.log(`[queue-deploy] Added job to Redis queue: ${projectId}`);
    } else {
      // In development, directly call EC2 deployment service
      const ec2DeploymentUrl = process.env.EC2_DEPLOYMENT_SERVICE_URL || 'http://13.204.177.162:3001';
      
      try {
        const response = await fetch(`${ec2DeploymentUrl}/deploy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEPLOYMENT_SECRET || 'dev-secret'}`
          },
          body: JSON.stringify(deploymentJob),
          signal: AbortSignal.timeout(10000) // Quick timeout - just queue the job
        });
        
        if (response.ok) {
          console.log(`[queue-deploy] Job sent to EC2 deployment service: ${projectId}`);
        } else {
          console.error(`[queue-deploy] Failed to send job to EC2: ${response.status}`);
          // In production, this would fall back to Redis queue
        }
      } catch (error) {
        console.error(`[queue-deploy] Error sending to EC2 deployment service:`, error);
        // In production, this would fall back to Redis queue
      }
    }
    
  } catch (error) {
    console.error(`[queue-deploy] Failed to queue deployment job for ${projectId}:`, error);
    throw error;
  }
}

// Get Redis client (for production use)
async function getRedisClient(): Promise<any> {
  // This would import and configure Redis client
  // For now, just a placeholder
  throw new Error('Redis client not implemented yet - using direct HTTP calls');
}

// GET endpoint to check project status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    const projectsCollection = await getProjectsCollection();
    const project = await projectsCollection.findOne({ projectId });
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      projectId: project.projectId,
      status: project.status,
      url: project.url,
      name: project.name,
      createdAt: project.metadata.createdAt,
      error: project.error
    });
    
  } catch (error) {
    console.error('[save-and-host] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get project status' },
      { status: 500 }
    );
  }
}
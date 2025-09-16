import { NextRequest, NextResponse } from 'next/server';
import { getProjectsCollection } from '@/lib/mongodb';
import { formatProjectForResponse } from '@/lib/project-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    
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
    
    // Increment view count
    await projectsCollection.updateOne(
      { projectId },
      { 
        $inc: { 'metadata.viewCount': 1 },
        $set: { 'metadata.lastViewedAt': new Date() }
      }
    );
    
    // Return full project details
    return NextResponse.json({
      success: true,
      project: {
        ...formatProjectForResponse(project),
        files: project.files, // Include files for this detailed view
        packages: project.packages,
        prompt: project.prompt,
        sourceUrl: project.sourceUrl,
        aiModel: project.aiModel,
        edits: project.edits
      }
    });
    
  } catch (error) {
    console.error(`[projects/${params?.projectId}] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch project details', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE endpoint for project deletion (optional - for admin use)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    
    // Add authentication check here if needed
    // const adminKey = req.headers.get('x-admin-key');
    // if (adminKey !== process.env.ADMIN_SECRET) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    
    const projectsCollection = await getProjectsCollection();
    const result = await projectsCollection.deleteOne({ projectId });
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // TODO: Also delete files from EC2 hosting directory
    
    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });
    
  } catch (error) {
    console.error(`[projects/${params?.projectId}] DELETE Error:`, error);
    return NextResponse.json(
      { error: 'Failed to delete project', details: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getProjectsCollection } from '@/lib/mongodb';
import { generateProjectName } from '@/lib/project-utils';

export async function POST(req: NextRequest) {
  try {
    const { projectId, updateAll } = await req.json();
    
    const projectsCollection = await getProjectsCollection();
    
    if (updateAll) {
      // Update all projects with generic names
      console.log('[update-names] Starting bulk name update...');
      
      // Find all projects with generic names
      const projects = await projectsCollection.find({
        $or: [
          { name: 'React Application' },
          { name: { $regex: '^React Application' } },
          { name: '' },
          { name: { $exists: false } }
        ]
      }).toArray();
      
      console.log(`[update-names] Found ${projects.length} projects needing name updates`);
      
      let updated = 0;
      let skipped = 0;
      
      for (const project of projects) {
        try {
          console.log(`[update-names] Updating name for project ${project.projectId}`);
          
          // Generate new name using improved logic
          const newName = generateProjectName(
            null, // No files available in stored document
            project.prompt
          );
          
          // Only update if the new name is different and meaningful
          if (newName !== project.name && newName !== 'React Application') {
            await projectsCollection.updateOne(
              { projectId: project.projectId },
              { 
                $set: { 
                  name: newName,
                  'metadata.nameUpdatedAt': new Date(),
                  'metadata.updatedAt': new Date()
                }
              }
            );
            updated++;
            console.log(`[update-names] Updated "${project.name}" → "${newName}" for project ${project.projectId}`);
          } else {
            console.log(`[update-names] Skipped project ${project.projectId} - no better name available`);
            skipped++;
          }
          
        } catch (error) {
          console.error(`[update-names] Error updating project ${project.projectId}:`, error);
          skipped++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Bulk name update completed: ${updated} updated, ${skipped} skipped`,
        updated,
        skipped,
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
      
      console.log(`[update-names] Updating name for project ${projectId}`);
      
      const newName = generateProjectName(
        null, // No files available in stored document
        project.prompt
      );
      
      if (newName !== project.name) {
        await projectsCollection.updateOne(
          { projectId },
          { 
            $set: { 
              name: newName,
              'metadata.nameUpdatedAt': new Date(),
              'metadata.updatedAt': new Date()
            }
          }
        );
        
        return NextResponse.json({
          success: true,
          projectId,
          oldName: project.name,
          newName,
          message: 'Project name updated successfully'
        });
      } else {
        return NextResponse.json({
          success: true,
          projectId,
          message: 'No name update needed',
          currentName: project.name
        });
      }
      
    } else {
      return NextResponse.json(
        { error: 'Either projectId or updateAll=true is required' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('[update-names] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update project names', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check name update status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    if (action === 'check') {
      const projectsCollection = await getProjectsCollection();
      
      // Count projects needing name updates
      const needingUpdate = await projectsCollection.countDocuments({
        $or: [
          { name: 'React Application' },
          { name: { $regex: '^React Application' } },
          { name: '' },
          { name: { $exists: false } }
        ]
      });
      
      const totalProjects = await projectsCollection.countDocuments({});
      
      return NextResponse.json({
        totalProjects,
        needingUpdate,
        hasImprovedNaming: true
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[update-names] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check name update status' },
      { status: 500 }
    );
  }
}
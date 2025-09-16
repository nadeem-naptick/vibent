import { NextRequest, NextResponse } from 'next/server';
import { getProjectsCollection } from '@/lib/mongodb';
import { formatProjectForResponse } from '@/lib/project-utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || 'ready'; // Only show ready projects by default
    const search = searchParams.get('search') || '';
    
    const projectsCollection = await getProjectsCollection();
    
    // Build query
    const query: any = {};
    
    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { prompt: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get projects with pagination
    const projects = await projectsCollection
      .find(query)
      .sort({ 'metadata.createdAt': -1 })
      .skip(offset)
      .limit(Math.min(limit, 100)) // Max 100 projects per request
      .toArray();
    
    // Get total count for pagination
    const totalCount = await projectsCollection.countDocuments(query);
    
    // Format projects for response
    const formattedProjects = projects.map(formatProjectForResponse);
    
    return NextResponse.json({
      success: true,
      projects: formattedProjects,
      pagination: {
        total: totalCount,
        offset,
        limit,
        hasMore: offset + limit < totalCount
      }
    });
    
  } catch (error) {
    console.error('[projects/list] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error.message },
      { status: 500 }
    );
  }
}
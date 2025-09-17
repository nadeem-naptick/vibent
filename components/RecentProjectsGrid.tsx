import React, { useState, useEffect } from 'react';
import { FiExternalLink, FiCopy, FiCalendar, FiEye, FiFile } from '@/lib/icons';

interface Project {
  id: string;
  projectId: string;
  name: string;
  description: string;
  thumbnail: string;
  url: string;
  status: string;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  fileCount: number;
  totalSize: number;
}

export default function RecentProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch recent projects
  const fetchRecentProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '8', // Show only 8 recent projects on homepage
        status: 'ready', // Only show ready projects
      });

      const response = await fetch(`/api/projects/list?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentProjects();
  }, []);

  // Copy URL to clipboard
  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, index) => (
          <div key={index} className="border border-gray-200 rounded-xl overflow-hidden bg-white animate-pulse">
            <div className="h-48 bg-gray-200" />
            <div className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
              <div className="flex gap-2">
                <div className="flex-1 h-8 bg-gray-200 rounded" />
                <div className="w-8 h-8 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">🚀</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
        <p className="text-gray-600">
          Be the first to create a project and see it featured here!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {projects.map((project) => (
        <div
          key={project.projectId}
          className="group border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 bg-white hover:-translate-y-1"
        >
          {/* Thumbnail */}
          <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
            {project.thumbnail ? (
              <img
                src={project.thumbnail}
                alt={project.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-6xl opacity-30">🖥️</div>
              </div>
            )}
            
            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Ready
              </span>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-1 truncate group-hover:text-blue-600 transition-colors" title={project.name}>
              {project.name}
            </h3>
            
            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
              <div className="flex items-center gap-1">
                <FiCalendar className="w-3 h-3" />
                {formatDate(project.createdAt)}
              </div>
              <div className="flex items-center gap-1">
                <FiEye className="w-3 h-3" />
                {project.viewCount}
              </div>
              <div className="flex items-center gap-1">
                <FiFile className="w-3 h-3" />
                {project.fileCount}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <FiExternalLink className="w-4 h-4" />
                View Live
              </a>
              
              <button
                onClick={() => copyUrl(project.url)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-colors"
                title="Copy URL"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>

            {/* Project ID */}
            <div className="text-xs text-gray-400 mt-2 font-mono truncate" title={project.projectId}>
              {project.projectId}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
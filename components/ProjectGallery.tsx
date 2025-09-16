import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiExternalLink, FiCopy, FiSearch, FiX, FiCalendar, FiEye, FiFile } from '@/lib/icons';

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

interface ProjectGalleryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectGallery({ isOpen, onClose }: ProjectGalleryProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'building' | 'failed'>('ready');

  // Fetch projects
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '20',
        status: filter === 'all' ? 'all' : filter,
        ...(searchTerm && { search: searchTerm })
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

  // Fetch projects when modal opens or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen, filter, searchTerm]);

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

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Project Gallery</h2>
                <p className="text-gray-600 mt-1">Browse all your generated projects</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Search and filters */}
            <div className="flex gap-4 mt-4">
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ready">Ready</option>
                <option value="building">Building</option>
                <option value="failed">Failed</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-gray-400 text-6xl mb-4">📁</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Found</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'Try a different search term' : 'Start generating projects to see them here'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projects.map((project) => (
                  <motion.div
                    key={project.projectId}
                    layout
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 bg-white"
                  >
                    {/* Thumbnail */}
                    <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
                      {project.thumbnail ? (
                        <img
                          src={project.thumbnail}
                          alt={project.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-6xl opacity-30">🖥️</div>
                        </div>
                      )}
                      
                      {/* Status badge */}
                      <div className="absolute top-3 left-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            project.status === 'ready'
                              ? 'bg-green-100 text-green-800'
                              : project.status === 'building'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 truncate" title={project.name}>
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
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                          disabled={project.status !== 'ready'}
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

                      {/* Additional info */}
                      <div className="text-xs text-gray-400 mt-2 font-mono">
                        {project.projectId}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
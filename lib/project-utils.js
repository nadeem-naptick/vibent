// lib/project-utils.js - Utility functions for project management

import { nanoid } from 'nanoid';

// Generate unique project ID
export function generateProjectId() {
  return nanoid(12); // Generates IDs like "V1StGXR8_Z5j"
}

// Generate project name from files and prompt (no URL-based naming)
export function generateProjectName(files, prompt, sourceUrl = '') {
  // Try to extract name from prompt first
  if (prompt && prompt.trim()) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Look for common project types
    if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('e-commerce') || lowerPrompt.includes('shop')) {
      return 'E-commerce Site';
    }
    if (lowerPrompt.includes('portfolio')) {
      return 'Portfolio Website';
    }
    if (lowerPrompt.includes('blog')) {
      return 'Blog Website';
    }
    if (lowerPrompt.includes('landing')) {
      return 'Landing Page';
    }
    if (lowerPrompt.includes('dashboard')) {
      return 'Dashboard App';
    }
    if (lowerPrompt.includes('saas')) {
      return 'SaaS Application';
    }
    
    // Extract first few words if it's a descriptive prompt
    const words = prompt.split(' ').slice(0, 3);
    if (words.length > 0 && words.join(' ').trim().length > 0) {
      return words.join(' ').replace(/[^\w\s]/g, '').trim() + ' Project';
    }
  }
  
  // Analyze files for better project type detection
  if (files && Array.isArray(files)) {
    const fileContent = files.map(f => f.content || '').join('\n').toLowerCase();
    const filePaths = files.map(f => f.path.toLowerCase());
    
    // Check for specific frameworks/libraries
    if (fileContent.includes('next.js') || fileContent.includes('@next/') || filePaths.some(p => p.includes('next.config'))) {
      return 'Next.js Application';
    }
    if (fileContent.includes('vite') || filePaths.some(p => p.includes('vite.config'))) {
      return 'Vite Application';
    }
    if (fileContent.includes('tailwind') || filePaths.some(p => p.includes('tailwind.config'))) {
      return 'Tailwind React App';
    }
    
    // Check for project types by file content
    if (fileContent.includes('ecommerce') || fileContent.includes('cart') || fileContent.includes('checkout')) {
      return 'E-commerce App';
    }
    if (fileContent.includes('dashboard') || fileContent.includes('admin')) {
      return 'Dashboard Application';
    }
    if (fileContent.includes('portfolio') || fileContent.includes('about me')) {
      return 'Portfolio Site';
    }
    if (fileContent.includes('blog') || fileContent.includes('article')) {
      return 'Blog Application';
    }
    
    // File structure analysis
    const hasComponents = filePaths.some(p => p.includes('components/'));
    const hasPages = filePaths.some(p => p.includes('pages/') || p.includes('app/'));
    const hasApi = filePaths.some(p => p.includes('api/'));
    
    if (hasComponents && hasPages && hasApi) {
      return 'Full-stack React App';
    } else if (hasComponents && hasPages) {
      return 'Multi-page React App';
    } else if (hasComponents) {
      return 'Component Library';
    }
  }
  
  // Default name
  return 'React Application';
}

// Extract packages from files
export function extractPackagesFromFiles(files) {
  const packages = new Set();
  
  files.forEach(file => {
    if (file.path === 'package.json') {
      try {
        const packageJson = JSON.parse(file.content);
        if (packageJson.dependencies) {
          Object.keys(packageJson.dependencies).forEach(pkg => {
            packages.add({
              name: pkg,
              version: packageJson.dependencies[pkg]
            });
          });
        }
      } catch (error) {
        console.error('Error parsing package.json:', error);
      }
    } else {
      // Extract import statements to detect packages
      const importMatches = file.content.match(/import.*from ['"]([^'"]+)['"]/g) || [];
      importMatches.forEach(match => {
        const packageMatch = match.match(/from ['"]([^'"]+)['"]/);
        if (packageMatch) {
          const packageName = packageMatch[1];
          // Only add if it's not a relative import
          if (!packageName.startsWith('.') && !packageName.startsWith('/')) {
            packages.add({
              name: packageName.split('/')[0], // Get base package name
              version: 'latest'
            });
          }
        }
      });
    }
  });
  
  return Array.from(packages);
}

// Calculate total file size
export function calculateTotalSize(files) {
  return files.reduce((total, file) => total + file.content.length, 0);
}

// Validate project data (simplified - no strict requirements)
export function validateProjectData(projectData) {
  const errors = [];
  
  if (!projectData.files || !Array.isArray(projectData.files)) {
    errors.push('Files array is required');
  }
  
  if (projectData.files && projectData.files.length === 0) {
    errors.push('At least one file is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Create project document for MongoDB (metadata only - files stored on filesystem)
export function createProjectDocument(projectData, projectId) {
  const { files, zipData, metadata = {} } = projectData;
  
  return {
    projectId,
    name: metadata.name || generateProjectName(files, metadata.prompt),
    description: metadata.description || '',
    thumbnail: '', // Will be populated after screenshot
    url: `${process.env.PROJECT_BASE_URL || 'http://localhost:3000/creation'}/${projectId}`,
    status: 'building', // 'building' | 'ready' | 'failed'
    
    // Source information
    sourceUrl: metadata.sourceUrl || '',
    prompt: metadata.prompt || '',
    aiModel: metadata.aiModel || '',
    
    // Dependencies (extracted from files but not storing file content)
    packages: files ? extractPackagesFromFiles(files) : [],
    
    // Metadata only - NO file contents
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      lastViewedAt: null,
      viewCount: 0,
      fileCount: files ? files.length : 0,
      totalSize: files ? calculateTotalSize(files) : 0,
      generationTimeMs: metadata.generationTimeMs || 0,
      buildTimeMs: 0,
      filePaths: files ? files.map(f => f.path) : [], // Just the paths, not content
      useZipData: !!zipData // Flag to indicate if this project uses zip data
    },
    
    // Edit history
    edits: [],
    
    // File system paths
    projectPath: `/var/www/vibeapp/projects/${projectId}`,
    distPath: `/var/www/vibeapp/projects/${projectId}/dist`
  };
}

// Get file type from extension
function getFileType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const typeMap = {
    'jsx': 'jsx',
    'tsx': 'tsx',
    'js': 'javascript',
    'ts': 'typescript',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'html': 'html',
    'md': 'markdown',
    'txt': 'text'
  };
  
  return typeMap[ext] || 'text';
}

// Format project for API response
export function formatProjectForResponse(project) {
  return {
    id: project._id,
    projectId: project.projectId,
    name: project.name,
    description: project.description,
    thumbnail: project.thumbnail,
    url: project.url,
    status: project.status,
    sourceUrl: project.sourceUrl,
    createdAt: project.metadata.createdAt,
    updatedAt: project.metadata.updatedAt,
    viewCount: project.metadata.viewCount,
    fileCount: project.metadata.fileCount,
    totalSize: project.metadata.totalSize
  };
}

// Capture screenshot of iframe (for thumbnails)
export async function captureIframeScreenshot(iframeUrl) {
  try {
    // This would typically use puppeteer or similar
    // For now, return a placeholder
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f3f4f6"/><text x="200" y="150" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%236b7280">Project Preview</text></svg>`;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}
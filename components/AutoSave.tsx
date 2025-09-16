import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface AutoSaveProps {
  sandboxId?: string;
  files: Array<{ path: string; content: string; type: string }>;
  isGenerating: boolean;
  isCodeApplied: boolean;
  metadata?: {
    prompt?: string;
    sourceUrl?: string;
    aiModel?: string;
    generationTimeMs?: number;
  };
  onProjectSaved?: (projectData: { projectId: string; url: string }) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function AutoSave({
  sandboxId,
  files,
  isGenerating,
  isCodeApplied,
  metadata,
  onProjectSaved
}: AutoSaveProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [projectUrl, setProjectUrl] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [lastSaveHash, setLastSaveHash] = useState<string>('');

  // Generate a hash of current files to detect changes
  const generateFilesHash = (fileList: typeof files) => {
    const content = fileList
      .map(f => `${f.path}:${f.content}`)
      .sort()
      .join('|');
    return btoa(content).slice(0, 16); // Simple hash
  };

  const saveProject = async (trigger: string) => {
    if (!files || files.length === 0) {
      console.log('[AutoSave] No files to save');
      return;
    }

    const currentHash = generateFilesHash(files);
    if (currentHash === lastSaveHash && trigger !== 'manual') {
      console.log('[AutoSave] No changes detected, skipping save');
      return;
    }

    setSaveStatus('saving');
    
    try {
      console.log(`[AutoSave] Saving project (trigger: ${trigger})`);
      
      const projectData = {
        sandboxId,
        files: files.map(f => ({
          path: f.path,
          content: f.content,
          type: f.type
        })),
        metadata: {
          ...metadata,
          trigger,
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch('/api/projects/save-and-host', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save project');
      }

      const result = await response.json();
      
      setProjectId(result.projectId);
      setProjectUrl(result.url);
      setLastSaveHash(currentHash);
      setSaveStatus('saved');

      // Call callback if provided
      if (onProjectSaved) {
        onProjectSaved({
          projectId: result.projectId,
          url: result.url
        });
      }

      // Show success toast
      toast.success(
        <div className="flex flex-col gap-1">
          <div className="font-medium">Project Saved!</div>
          <div className="text-sm opacity-80">
            <a 
              href={result.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View live project →
            </a>
          </div>
        </div>,
        { duration: 5000 }
      );

    } catch (error) {
      console.error('[AutoSave] Failed to save project:', error);
      setSaveStatus('error');
      
      toast.error(
        <div className="flex flex-col gap-1">
          <div className="font-medium">Save Failed</div>
          <div className="text-sm opacity-80">{error.message}</div>
        </div>
      );
    }
  };

  // Auto-save when generation completes
  useEffect(() => {
    if (!isGenerating && files.length > 0) {
      // Small delay to ensure all state updates are complete
      const timer = setTimeout(() => {
        saveProject('generation_complete');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isGenerating, files.length]);

  // Auto-save when code is applied
  useEffect(() => {
    if (isCodeApplied && files.length > 0) {
      const timer = setTimeout(() => {
        saveProject('code_applied');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isCodeApplied]);

  // Render save status indicator
  if (saveStatus === 'idle' && !projectUrl) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
            </div>
            <span className="text-sm text-gray-700">Saving project...</span>
          </div>
        )}
        
        {saveStatus === 'saved' && projectUrl && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-800">Project Saved!</span>
            </div>
            
            <div className="flex gap-2">
              <a
                href={projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded transition-colors text-center"
              >
                View Live
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(projectUrl)}
                className="bg-gray-500 hover:bg-gray-600 text-white text-sm px-3 py-1.5 rounded transition-colors"
                title="Copy URL"
              >
                Copy
              </button>
            </div>
            
            {projectId && (
              <div className="text-xs text-gray-500 font-mono">
                ID: {projectId}
              </div>
            )}
          </div>
        )}
        
        {saveStatus === 'error' && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">Save Failed</div>
              <button
                onClick={() => saveProject('manual_retry')}
                className="text-sm text-blue-500 hover:underline"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
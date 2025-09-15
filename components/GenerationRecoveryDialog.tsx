import React from 'react';
import { AlertCircle, Play, RotateCcw, Check, Globe, FileText, X, Sparkles } from 'lucide-react';

interface GenerationRecoveryDialogProps {
  isOpen: boolean;
  partialFiles: Array<{ path: string; content: string; type: string }>;
  targetUrl?: string;
  context?: any;
  onResume: () => void;
  onRestart: () => void;
  onUsePartial: () => void;
  onCancel: () => void;
}

export function GenerationRecoveryDialog({
  isOpen,
  partialFiles,
  targetUrl,
  context,
  onResume,
  onRestart,
  onUsePartial,
  onCancel
}: GenerationRecoveryDialogProps) {
  if (!isOpen) return null;

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'javascript': return '🟨';
      case 'css': return '🟪';
      case 'json': return '🟦';
      case 'html': return '🟧';
      default: return '📄';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-lg w-full mx-4 overflow-hidden">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Generation Interrupted</h3>
                {targetUrl && (
                  <div className="flex items-center gap-2 mt-1 text-orange-100">
                    <Globe className="w-3 h-3" />
                    <span className="text-xs font-medium">{targetUrl}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 mb-4 leading-relaxed">
            The AI generation was interrupted, but we've preserved your progress. 
            {targetUrl && ` We were recreating ${targetUrl} as a modern React application.`}
          </p>
          
          {/* Files Preview - Modern Card */}
          <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-800">
                {partialFiles.length} Files Generated
              </span>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {partialFiles.slice(0, 6).map((file, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                  <span className="text-lg">{getFileIcon(file.type)}</span>
                  <span className="font-medium text-gray-700 flex-1 truncate">
                    {file.path}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                    {file.type}
                  </span>
                </div>
              ))}
              {partialFiles.length > 6 && (
                <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-200">
                  +{partialFiles.length - 6} more files preserved
                </div>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-6 font-medium">
            Choose how to proceed:
          </p>
          
          {/* Action Buttons - Modern Design */}
          <div className="space-y-3">
            <button
              onClick={onResume}
              className="group w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-blue-200"
            >
              <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                <Play className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold">Resume Generation</div>
                <div className="text-xs text-blue-100">Apply partial files and continue where we left off</div>
              </div>
            </button>
            
            <button
              onClick={onUsePartial}
              className="group w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-emerald-200"
            >
              <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold">Use Partial Code</div>
                <div className="text-xs text-emerald-100">Deploy what we have so far and stop here</div>
              </div>
            </button>
            
            <button
              onClick={onRestart}
              className="group w-full flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-gray-200"
            >
              <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold">Start Over</div>
                <div className="text-xs text-gray-300">Discard progress and restart from scratch</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
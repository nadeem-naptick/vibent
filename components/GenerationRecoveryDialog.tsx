import React from 'react';
import { AlertCircle, Play, RotateCcw, Check } from 'lucide-react';

interface GenerationRecoveryDialogProps {
  isOpen: boolean;
  partialFiles: Array<{ path: string; content: string; type: string }>;
  onResume: () => void;
  onRestart: () => void;
  onUsePartial: () => void;
  onCancel: () => void;
}

export function GenerationRecoveryDialog({
  isOpen,
  partialFiles,
  onResume,
  onRestart,
  onUsePartial,
  onCancel
}: GenerationRecoveryDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            Generation Interrupted
          </h3>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-3">
            The code generation was interrupted, but we preserved your partial progress:
          </p>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Partial Files Generated: {partialFiles.length}
            </div>
            <div className="space-y-1">
              {partialFiles.slice(0, 5).map((file, index) => (
                <div key={index} className="text-xs text-gray-600 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  {file.path}
                </div>
              ))}
              {partialFiles.length > 5 && (
                <div className="text-xs text-gray-500">
                  +{partialFiles.length - 5} more files...
                </div>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-600">
            What would you like to do?
          </p>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onResume}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Play className="w-4 h-4" />
            Resume Generation
            <span className="text-xs text-blue-200 ml-auto">
              Apply partial + continue
            </span>
          </button>
          
          <button
            onClick={onUsePartial}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Use Partial Code
            <span className="text-xs text-green-200 ml-auto">
              Apply what we have
            </span>
          </button>
          
          <button
            onClick={onRestart}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Start New Project
            <span className="text-xs text-gray-300 ml-auto">
              Discard & restart
            </span>
          </button>
          
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
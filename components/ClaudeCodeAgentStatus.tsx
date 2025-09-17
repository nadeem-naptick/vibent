'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentActivity {
  id: string;
  type: 'thinking' | 'planning' | 'tool_use' | 'file_write' | 'execution' | 'reasoning';
  message: string;
  timestamp: Date;
  metadata?: {
    toolName?: string;
    fileName?: string;
    progress?: number;
  };
}

interface ClaudeCodeAgentStatusProps {
  isActive: boolean;
  activities: AgentActivity[];
  currentThought?: string;
  toolsUsed?: string[];
}

const ClaudeCodeAgentStatus: React.FC<ClaudeCodeAgentStatusProps> = ({
  isActive,
  activities,
  currentThought,
  toolsUsed = []
}) => {
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const toggleActivity = (id: string) => {
    const newExpanded = new Set(expandedActivities);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedActivities(newExpanded);
  };

  const getActivityIcon = (type: AgentActivity['type']) => {
    switch (type) {
      case 'thinking':
        return (
          <div className="relative">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-75" />
          </div>
        );
      case 'planning':
        return <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-xs text-white">📋</div>;
      case 'tool_use':
        return <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-xs text-white">🔧</div>;
      case 'file_write':
        return <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-xs text-white">📝</div>;
      case 'execution':
        return <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs text-white">⚡</div>;
      case 'reasoning':
        return <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center text-xs text-white">🧠</div>;
      default:
        return <div className="w-4 h-4 bg-gray-500 rounded-full" />;
    }
  };

  const getActivityColor = (type: AgentActivity['type']) => {
    switch (type) {
      case 'thinking': return 'border-blue-200 bg-blue-50';
      case 'planning': return 'border-purple-200 bg-purple-50';
      case 'tool_use': return 'border-green-200 bg-green-50';
      case 'file_write': return 'border-orange-200 bg-orange-50';
      case 'execution': return 'border-red-200 bg-red-50';
      case 'reasoning': return 'border-indigo-200 bg-indigo-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  if (!isActive && activities.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              🤖
            </div>
            {isActive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Claude Code SDK Agent</h3>
            <p className="text-xs text-gray-500">
              {isActive ? 'Active • Thinking and Planning' : `${activities.length} activities completed`}
            </p>
          </div>
        </div>
        
        {/* Tools Used */}
        {toolsUsed.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Tools:</span>
            <div className="flex gap-1">
              {toolsUsed.map((tool, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Thought */}
      <AnimatePresence>
        {currentThought && isActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100"
          >
            <div className="flex items-start gap-3">
              <div className="relative mt-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-blue-400 rounded-full animate-ping opacity-75" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 font-medium mb-1">Current Thought:</p>
                <p className="text-sm text-gray-600 italic">{currentThought}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activities Timeline */}
      {activities.length > 0 && (
        <div className="p-4">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            <AnimatePresence>
              {activities.slice(-10).reverse().map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative pl-8 pb-3 ${index < activities.length - 1 ? 'border-l-2 border-gray-100 ml-2' : ''}`}
                >
                  <div className="absolute -left-2 top-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  
                  <div 
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${getActivityColor(activity.type)}`}
                    onClick={() => toggleActivity(activity.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {activity.type.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {activity.message}
                        </p>
                        
                        {/* Metadata */}
                        {activity.metadata && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {activity.metadata.toolName && (
                              <span className="px-2 py-1 text-xs bg-white/70 text-gray-700 rounded border">
                                Tool: {activity.metadata.toolName}
                              </span>
                            )}
                            {activity.metadata.fileName && (
                              <span className="px-2 py-1 text-xs bg-white/70 text-gray-700 rounded border">
                                File: {activity.metadata.fileName}
                              </span>
                            )}
                            {activity.metadata.progress && (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-white/70 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-current transition-all"
                                    style={{ width: `${activity.metadata.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600">
                                  {activity.metadata.progress}%
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 ml-3">
                        {activity.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Agent Status Footer */}
      {isActive && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-600">Agent is actively working...</span>
            </div>
            <div className="text-xs text-gray-500">
              Powered by Claude Code SDK
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ClaudeCodeAgentStatus;
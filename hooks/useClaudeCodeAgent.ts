'use client';

import { useState, useCallback, useRef } from 'react';

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

interface ClaudeCodeAgentState {
  isActive: boolean;
  activities: AgentActivity[];
  currentThought: string | null;
  toolsUsed: string[];
  sessionId: string | null;
}

export const useClaudeCodeAgent = () => {
  const [state, setState] = useState<ClaudeCodeAgentState>({
    isActive: false,
    activities: [],
    currentThought: null,
    toolsUsed: [],
    sessionId: null
  });

  const activityIdCounter = useRef(0);

  const addActivity = useCallback((
    type: AgentActivity['type'],
    message: string,
    metadata?: AgentActivity['metadata']
  ) => {
    const activity: AgentActivity = {
      id: `activity-${++activityIdCounter.current}`,
      type,
      message,
      timestamp: new Date(),
      metadata
    };

    setState(prev => ({
      ...prev,
      activities: [...prev.activities, activity]
    }));
  }, []);

  const setCurrentThought = useCallback((thought: string | null) => {
    setState(prev => ({
      ...prev,
      currentThought: thought
    }));
  }, []);

  const setAgentActive = useCallback((active: boolean) => {
    setState(prev => ({
      ...prev,
      isActive: active
    }));
  }, []);

  const addToolUsed = useCallback((toolName: string) => {
    setState(prev => ({
      ...prev,
      toolsUsed: prev.toolsUsed.includes(toolName) 
        ? prev.toolsUsed 
        : [...prev.toolsUsed, toolName]
    }));
  }, []);

  const setSessionId = useCallback((sessionId: string | null) => {
    setState(prev => ({
      ...prev,
      sessionId
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isActive: false,
      activities: [],
      currentThought: null,
      toolsUsed: [],
      sessionId: null
    });
    activityIdCounter.current = 0;
  }, []);

  // Parse streaming response to extract agent activities
  const parseStreamingResponse = useCallback((chunk: string, model: string) => {
    // Only process if it's Claude Code SDK
    if (!model.startsWith('claude-code-sdk/')) {
      return;
    }

    // Extract different types of agent activities from the response
    
    // Tool usage detection
    if (chunk.includes('<file path=')) {
      const fileMatch = chunk.match(/<file path="([^"]+)">/);
      if (fileMatch) {
        addActivity('file_write', `Writing file: ${fileMatch[1]}`, {
          fileName: fileMatch[1],
          toolName: 'Write'
        });
        addToolUsed('Write');
      }
    }

    // Planning/thinking detection (look for strategic language)
    const planningKeywords = [
      'I\'ll create', 'Let me add', 'I\'ll implement', 'I\'ll build',
      'The plan is', 'First, I\'ll', 'Next, I\'ll', 'Then I\'ll'
    ];
    
    if (planningKeywords.some(keyword => chunk.toLowerCase().includes(keyword.toLowerCase()))) {
      addActivity('planning', chunk.substring(0, 100).trim() + '...', {
        progress: Math.floor(Math.random() * 40) + 20 // Simulate planning progress
      });
    }

    // Reasoning detection (look for explanatory language)
    const reasoningKeywords = [
      'This will', 'because', 'The reason', 'This approach', 'By using',
      'The benefit', 'This ensures', 'This allows'
    ];
    
    if (reasoningKeywords.some(keyword => chunk.toLowerCase().includes(keyword.toLowerCase()))) {
      addActivity('reasoning', chunk.substring(0, 120).trim() + '...', {
        progress: Math.floor(Math.random() * 30) + 50
      });
    }

    // Tool execution simulation
    if (chunk.includes('import') || chunk.includes('export') || chunk.includes('function')) {
      addActivity('execution', 'Generating code structures and imports...', {
        toolName: 'CodeGen',
        progress: Math.floor(Math.random() * 20) + 70
      });
    }
  }, [addActivity, addToolUsed]);

  const simulateAgentThinking = useCallback((prompt: string, model: string) => {
    if (!model.startsWith('claude-code-sdk/')) {
      return;
    }

    setAgentActive(true);
    
    // Simulate initial thinking
    setCurrentThought('Analyzing the request and planning approach...');
    addActivity('thinking', `Processing request: "${prompt.substring(0, 50)}..."`, {
      progress: 10
    });

    // Simulate planning phase
    setTimeout(() => {
      setCurrentThought('Breaking down the task into actionable steps...');
      addActivity('planning', 'Identified key components and architecture needed', {
        progress: 30
      });
    }, 1000);

    // Simulate tool preparation
    setTimeout(() => {
      setCurrentThought('Preparing to use development tools...');
      addActivity('tool_use', 'Initializing file writing and code generation tools', {
        toolName: 'Multi-tool',
        progress: 50
      });
    }, 2000);
  }, [setCurrentThought, addActivity, setAgentActive]);

  const completeAgentSession = useCallback(() => {
    setAgentActive(false);
    setCurrentThought(null);
    addActivity('execution', 'Agent session completed successfully', {
      progress: 100
    });
  }, [setAgentActive, setCurrentThought, addActivity]);

  return {
    state,
    actions: {
      addActivity,
      setCurrentThought,
      setAgentActive,
      addToolUsed,
      setSessionId,
      reset,
      parseStreamingResponse,
      simulateAgentThinking,
      completeAgentSession
    }
  };
};

export type { AgentActivity, ClaudeCodeAgentState };
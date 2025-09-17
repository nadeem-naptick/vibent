import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiEdit3, FiGlobe, FiExternalLink, FiCopy, FiChevronRight } from '@/lib/icons';

interface SearchResult {
  url: string;
  title: string;
  description: string;
  screenshot: string | null;
  markdown: string;
}

interface EnhancedPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  onStartBuilding: (enhancedPrompt: string, projectType: 'static' | 'application', crawledContent?: SearchResult, instructions?: string) => void;
}

export default function EnhancedPromptModal({
  isOpen,
  onClose,
  originalPrompt,
  onStartBuilding
}: EnhancedPromptModalProps) {
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [projectType, setProjectType] = useState<'static' | 'application'>('static');
  const [enableCrawling, setEnableCrawling] = useState(false);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [autoDetectedUrls, setAutoDetectedUrls] = useState<string[]>([]);
  const [crawledResults, setCrawledResults] = useState<SearchResult[]>([]);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [originalPromptBackup, setOriginalPromptBackup] = useState(originalPrompt);
  const [enhancedPromptBackup, setEnhancedPromptBackup] = useState('');
  const [isShowingOriginal, setIsShowingOriginal] = useState(false);

  // Update backup when originalPrompt changes
  useEffect(() => {
    if (originalPrompt) {
      setOriginalPromptBackup(originalPrompt);
    }
  }, [originalPrompt]);

  // Auto-detect URLs from the original prompt and suggest relevant sites
  useEffect(() => {
    if (originalPrompt) {
      const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
      const detectedUrls = originalPrompt.match(urlRegex) || [];
      setAutoDetectedUrls(detectedUrls);
      
      if (detectedUrls.length > 0) {
        setCrawlUrl(detectedUrls[0]);
      } else {
        // Generate AI-powered suggestion for reference content
        generateContentSuggestion(originalPrompt).then(suggestion => {
          if (suggestion) {
            setCrawlUrl(suggestion);
          }
        });
      }
    }
  }, [originalPrompt]);

  // Generate AI-powered suggestions for reference content
  const generateContentSuggestion = async (prompt: string): Promise<string> => {
    try {
      const response = await fetch('/api/generate-content-suggestion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.suggestion || '';
      }
    } catch (error) {
      console.error('Failed to generate content suggestion:', error);
    }
    
    // Fallback to simple keyword-based suggestions
    return getFallbackSuggestion(prompt);
  };

  // Fallback suggestions when AI call fails
  const getFallbackSuggestion = (prompt: string): string => {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) {
      return 'modern ecommerce website';
    }
    if (lowerPrompt.includes('portfolio')) {
      return 'creative portfolio design';
    }
    if (lowerPrompt.includes('dashboard')) {
      return 'admin dashboard interface';
    }
    if (lowerPrompt.includes('blog')) {
      return 'minimalist blog layout';
    }
    if (lowerPrompt.includes('landing')) {
      return 'product landing page';
    }
    if (lowerPrompt.includes('restaurant') || lowerPrompt.includes('food')) {
      return 'restaurant website design';
    }
    
    return '';
  };

  // Enhance the prompt when modal opens
  useEffect(() => {
    if (isOpen && originalPrompt) {
      enhancePrompt(originalPrompt);
      detectProjectType(originalPrompt);
    }
  }, [isOpen, originalPrompt]);

  // Auto-resize textarea based on content
  const autoResize = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    autoResize();
  }, [enhancedPrompt]);

  // Also resize when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      autoResize();
    }
  }, []);

  // Enhance prompt using AI
  const enhancePrompt = async (prompt: string) => {
    setIsEnhancing(true);
    try {
      const response = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          projectType 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const enhanced = data.enhancedPrompt || prompt;
        setEnhancedPrompt(enhanced);
        setEnhancedPromptBackup(enhanced);
        setIsShowingOriginal(false);
      } else {
        // Fallback to mock enhancement if API fails
        const enhanced = await mockEnhancePrompt(prompt);
        setEnhancedPrompt(enhanced);
        setEnhancedPromptBackup(enhanced);
        setIsShowingOriginal(false);
      }
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
      // Fallback to mock enhancement
      const enhanced = await mockEnhancePrompt(prompt);
      setEnhancedPrompt(enhanced);
      setEnhancedPromptBackup(enhanced);
      setIsShowingOriginal(false);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Detect project type from prompt
  const detectProjectType = (prompt: string) => {
    const lowerPrompt = prompt.toLowerCase();
    
    // Application indicators
    const appIndicators = [
      'app', 'application', 'dashboard', 'tool', 'platform', 
      'login', 'user', 'database', 'crud', 'api', 'interactive',
      'authentication', 'admin', 'management', 'system'
    ];
    
    // Static website indicators  
    const staticIndicators = [
      'website', 'landing page', 'portfolio', 'blog', 'marketing',
      'showcase', 'company page', 'brochure', 'static', 'home page'
    ];
    
    const hasAppKeywords = appIndicators.some(indicator => lowerPrompt.includes(indicator));
    const hasStaticKeywords = staticIndicators.some(indicator => lowerPrompt.includes(indicator));
    
    if (hasAppKeywords && !hasStaticKeywords) {
      setProjectType('application');
    } else {
      setProjectType('static'); // Default to static
    }
  };

  // Mock prompt enhancement (replace with actual AI call later)
  const mockEnhancePrompt = async (prompt: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) {
      return `Create a modern e-commerce ${projectType === 'application' ? 'application' : 'website'} with product catalog, shopping cart functionality, user authentication, and secure checkout process. Include product search and filtering capabilities, user reviews, and responsive design optimized for mobile and desktop.`;
    }
    
    if (lowerPrompt.includes('portfolio')) {
      return `Design a professional portfolio ${projectType === 'application' ? 'application' : 'website'} showcasing projects, skills, and experience. Include an about section, project gallery with detailed case studies, contact form, and downloadable resume. Optimize for fast loading and mobile responsiveness.`;
    }
    
    if (lowerPrompt.includes('dashboard')) {
      return `Build a comprehensive dashboard application with user authentication, data visualization charts, real-time updates, and intuitive navigation. Include customizable widgets, export functionality, and responsive design for various screen sizes.`;
    }
    
    if (lowerPrompt.includes('blog')) {
      return `Create a modern blog ${projectType === 'application' ? 'platform' : 'website'} with article management, categories and tags, search functionality, and comment system. Include author profiles, social sharing, and SEO optimization.`;
    }
    
    // Generic enhancement
    return `Create a professional ${projectType === 'application' ? 'web application' : 'website'} for ${prompt}. Include modern design, responsive layout, intuitive navigation, and optimized performance. Ensure accessibility and cross-browser compatibility.`;
  };

  // Crawl content from URL
  const crawlContent = async () => {
    if (!crawlUrl.trim()) return;
    
    setIsCrawling(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: crawlUrl,
          limit: 3
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCrawledResults(data.results || []);
      }
    } catch (error) {
      console.error('Crawl error:', error);
    } finally {
      setIsCrawling(false);
    }
  };

  // Handle start building
  const handleStartBuilding = () => {
    if (selectedResult) {
      onStartBuilding(enhancedPrompt, projectType, selectedResult, additionalInstructions);
    } else {
      onStartBuilding(enhancedPrompt, projectType);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(236, 72, 153, 0.4) 50%, rgba(251, 113, 133, 0.4) 100%)',
          backdropFilter: 'blur(20px)'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative max-w-3xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Gradient Background */}
          <div 
            className="absolute inset-0 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.95) 0%, rgba(236, 72, 153, 0.95) 50%, rgba(251, 113, 133, 0.95) 100%)'
            }}
          />
          
          {/* Content Container */}
          <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
          >
          {/* Header */}
          <div className="relative p-8 pb-6">
            {/* Header Gradient Background */}
            <div 
              className="absolute inset-0 rounded-t-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(236, 72, 153, 0.1) 50%, rgba(251, 113, 133, 0.1) 100%)'
              }}
            />
            
            <div className="relative flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 bg-clip-text text-transparent">
                  Customise Your Project
                </h2>
                <p className="text-gray-600 mt-1">Let's make your idea more detailed and specific</p>
              </div>
              <button
                onClick={onClose}
                className="p-4 hover:bg-white/50 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 backdrop-blur-sm border border-white/20"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%)'
                }}
              >
                <FiX className="w-8 h-8 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* 1. Enhanced Prompt Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Enhancing Your Idea</h3>
                <button
                  onClick={() => {
                    if (isShowingOriginal) {
                      // Restore enhanced version
                      setEnhancedPrompt(enhancedPromptBackup);
                      setIsShowingOriginal(false);
                    } else {
                      // Show original version
                      setEnhancedPrompt(originalPromptBackup);
                      setIsShowingOriginal(true);
                    }
                    setTimeout(autoResize, 0);
                  }}
                  className="px-3 py-1 text-sm hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 text-gray-600 hover:text-gray-800 border border-gray-200"
                >
                  {isShowingOriginal ? 'Restore Enhanced' : 'Restore Original'}
                </button>
              </div>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={enhancedPrompt}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setEnhancedPrompt(newValue);
                    // Update backup if we're not showing original (i.e., user is editing enhanced version)
                    if (!isShowingOriginal) {
                      setEnhancedPromptBackup(newValue);
                    }
                    setTimeout(autoResize, 0);
                  }}
                  placeholder="Enhancing your prompt..."
                  className="w-full p-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-gray-700 placeholder:text-gray-400 transition-all duration-200"
                  style={{
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                  disabled={isEnhancing}
                />
                {isEnhancing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-50/90 to-pink-50/90 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
                      <span className="text-purple-600 font-medium">Enhancing...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Project Type Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">What kind of project are you looking to build?</h3>
              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => setProjectType('static')}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    projectType === 'static'
                      ? 'border-blue-500 shadow-xl scale-105'
                      : 'border-gray-300 hover:border-blue-400 hover:shadow-lg'
                  }`}
                  style={{
                    background: projectType === 'static' 
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 197, 253, 0.2) 100%)'
                      : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Static Website</h4>
                  <p className="text-sm text-gray-600 mb-3">Landing pages, portfolios, marketing sites</p>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-medium rounded-full">
                      GPT-5 Powered
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => setProjectType('application')}
                  className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    projectType === 'application'
                      ? 'border-purple-500 shadow-xl scale-105'
                      : 'border-gray-300 hover:border-purple-400 hover:shadow-lg'
                  }`}
                  style={{
                    background: projectType === 'application' 
                      ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(217, 70, 239, 0.2) 100%)'
                      : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Web Application</h4>
                  <p className="text-sm text-gray-600 mb-3">Interactive tools, dashboards, platforms</p>
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-full">
                      Claude Code SDK
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. Crawl Content Section */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="enableCrawling"
                  checked={enableCrawling}
                  onChange={(e) => setEnableCrawling(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 focus:ring-2"
                />
                <label htmlFor="enableCrawling">
                  <span className="text-lg font-semibold text-gray-800">Clone Content/Images (Optional)</span>
                </label>
              </div>
              
              {enableCrawling && (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <input
                      type="url"
                      value={crawlUrl}
                      onChange={(e) => setCrawlUrl(e.target.value)}
                      placeholder="Enter URL or search terms to reference..."
                      className="flex-1 p-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 placeholder:text-gray-400 transition-all duration-200"
                      style={{
                        boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <button
                      onClick={crawlContent}
                      disabled={!crawlUrl.trim() || isCrawling}
                      className="px-8 py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 flex items-center gap-3 text-white"
                      style={{
                        background: !crawlUrl.trim() || isCrawling 
                          ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                          : 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                        boxShadow: '0 4px 15px -3px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      {isCrawling ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Crawling...
                        </>
                      ) : (
                        <>
                          Show Options
                        </>
                      )}
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-500 mt-2">
                    Enter a website URL for direct inspiration, or use keywords to search for similar websites to explore.
                  </p>

                  {/* Auto-detected URLs */}
                  {autoDetectedUrls.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Auto-detected URLs:</p>
                      <div className="flex flex-wrap gap-2">
                        {autoDetectedUrls.map((url, index) => (
                          <button
                            key={index}
                            onClick={() => setCrawlUrl(url)}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors"
                          >
                            {url}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crawled Results */}
                  {crawledResults.length > 0 && (
                    <div className="mt-6">
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900">Found {crawledResults.length} reference{crawledResults.length > 1 ? 's' : ''}</h4>
                      </div>
                      
                      {/* Horizontal carousel matching original design */}
                      <div className="relative h-[250px] overflow-hidden">
                        {/* Edge fade overlays */}
                        <div className="absolute left-0 top-0 bottom-0 w-[60px] z-20 pointer-events-none bg-gradient-to-r from-white to-transparent" />
                        <div className="absolute right-0 top-0 bottom-0 w-[60px] z-20 pointer-events-none bg-gradient-to-l from-white to-transparent" />
                        
                        <div 
                          className="flex gap-4 py-4 h-full overflow-x-auto no-scrollbar marquee-animation hover:pause-marquee"
                          style={{
                            '--speed': '40s',
                            animationPlayState: selectedResult ? 'paused' : 'running',
                            width: `${(crawledResults.length * 2) * 416}px` // 400px + 16px gap per card, doubled for seamless loop
                          }}
                        >
                          {/* Duplicate results for seamless scroll */}
                          {[...crawledResults, ...crawledResults].map((result, index) => (
                            <div
                              key={index}
                              className={`group flex-shrink-0 w-[400px] h-[220px] rounded-lg overflow-hidden border-2 transition-all duration-300 bg-white relative ${
                                selectedResult === result 
                                  ? 'border-green-500 shadow-xl shadow-green-200/50' 
                                  : 'border-gray-200/50 hover:shadow-2xl'
                              }`}
                            >
                              {/* Background image */}
                              {result.screenshot ? (
                                <img
                                  src={result.screenshot}
                                  alt={result.title}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                                  <FiGlobe className="w-20 h-20 text-gray-400" />
                                </div>
                              )}
                              
                              {/* Selection indicator */}
                              {selectedResult === result && (
                                <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full p-2 z-30 animate-pulse">
                                  <svg 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 16 16" 
                                    fill="none" 
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </div>
                              )}

                              {/* Hover overlay with buttons */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex flex-col items-center justify-center p-6">
                                {selectedResult === result && showInstructions ? (
                                  /* Instructions input - simplified version */
                                  <div className="w-full">
                                    <textarea
                                      value={additionalInstructions}
                                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                                      placeholder="Describe your customizations..."
                                      className="w-full p-3 bg-white/95 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20 mb-3"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setSelectedResult(null);
                                          setShowInstructions(false);
                                          setAdditionalInstructions('');
                                        }}
                                        className="flex-1 py-2 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleStartBuilding()}
                                        disabled={!additionalInstructions.trim()}
                                        className="flex-1 py-2 px-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
                                      >
                                        Build with Instructions
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Clone buttons */
                                  <div className="flex flex-col gap-3 w-full max-w-[300px]">
                                    <button
                                      onClick={() => {
                                        if (selectedResult === result && !showInstructions) {
                                          // Deselect if already selected
                                          setSelectedResult(null);
                                          setShowInstructions(false);
                                        } else {
                                          // Select this result
                                          setSelectedResult(result);
                                          setShowInstructions(false);
                                        }
                                      }}
                                      className={`w-full py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                        selectedResult === result && !showInstructions
                                          ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg'
                                          : 'bg-orange-500 hover:bg-orange-600 text-white'
                                      }`}
                                    >
                                      {selectedResult === result && !showInstructions ? (
                                        <>
                                          <svg 
                                            width="20" 
                                            height="20" 
                                            viewBox="0 0 20 20" 
                                            fill="none" 
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <path d="M4 10L8 14L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                          Selected
                                        </>
                                      ) : (
                                        <>
                                          <FiChevronRight className="w-5 h-5" />
                                          Instant Clone
                                        </>
                                      )}
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        setSelectedResult(result);
                                        setShowInstructions(true);
                                      }}
                                      className="w-full py-2 px-6 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                      <FiEdit3 className="w-4 h-4" />
                                      Add Instructions
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Title overlay at bottom */}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-20">
                                <h4 className="text-white font-medium text-sm truncate" title={result.title}>
                                  {result.title}
                                </h4>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Instructions Modal */}
                  {showInstructions && selectedResult && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Additional Instructions</h4>
                      <textarea
                        value={additionalInstructions}
                        onChange={(e) => setAdditionalInstructions(e.target.value)}
                        placeholder="Describe any specific customizations..."
                        className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="relative p-8 pt-6">
            {/* Footer Gradient Background */}
            <div 
              className="absolute inset-0 rounded-b-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(236, 72, 153, 0.05) 50%, rgba(251, 113, 133, 0.05) 100%)'
              }}
            />
            
            <div className="relative flex justify-between items-center">
              <div className="text-base">
                {selectedResult ? (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 font-semibold">Using reference: {selectedResult.title}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600 font-medium">Ready to build from scratch</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-gray-200/50 text-gray-600 hover:text-gray-800 hover:bg-white/90 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 font-medium"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleStartBuilding}
                  disabled={isEnhancing || !enhancedPrompt.trim()}
                  className="px-10 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-3 font-bold text-lg"
                  style={{
                    background: isEnhancing || !enhancedPrompt.trim()
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                      : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                    boxShadow: isEnhancing || !enhancedPrompt.trim()
                      ? 'none'
                      : '0 8px 25px -8px rgba(139, 92, 246, 0.5)'
                  }}
                >
                  {isEnhancing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Enhancing...
                    </>
                  ) : (
                    <>
                      <FiChevronRight className="w-5 h-5" />
                      🚀 Start Building
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
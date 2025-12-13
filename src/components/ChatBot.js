"use client";

import { useState, useRef, useEffect } from 'react';
import { useDarkMode } from '../app/DarkModeContext';

export default function ChatBot() {
  const { darkMode } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 **Hi! I\'m your Safe Sense AI Assistant.**\n\nAsk me anything about your sensors, alerts, devices, or settings.\n\n**What do you need help with?**'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Sorry, I encountered an error. Please try again or contact support if the issue persists.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: '👋 **Chat cleared!**\n\nWhat do you need help with?'
      }
    ]);
  };

  // Format markdown-style text
  const formatMessage = (text) => {
    return text.split('\n').map((line, i) => {
      // Bold text
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className="mb-2">
            {parts.map((part, j) => 
              j % 2 === 1 ? <strong key={j} className="font-bold">{part}</strong> : part
            )}
          </p>
        );
      }
      // Bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return <li key={i} className="ml-4 mb-1">{line.replace(/^[•-]\s*/, '')}</li>;
      }
      // Empty lines
      if (line.trim() === '') {
        return <br key={i} />;
      }
      // Regular paragraphs
      return <p key={i} className="mb-2">{line}</p>;
    });
  };

  return (
    <>
      {/* Floating Chat Button - Subtle Design */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg z-[9999] group ${
            darkMode
              ? 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
              : 'bg-white hover:bg-slate-50 border border-slate-200'
          }`}
          aria-label="Open AI Chat"
          title="Ask AI Assistant"
        >
          {/* Simple Chat Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
              darkMode ? 'text-slate-300' : 'text-slate-600'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>

          {/* Small Online Indicator */}
          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
            darkMode ? 'bg-green-500 border-slate-700' : 'bg-green-500 border-white'
          }`}></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-8 right-8 w-[420px] h-[650px] rounded-3xl shadow-2xl flex flex-col overflow-hidden z-[9999] border-2 transition-all duration-300 ${
            darkMode
              ? 'bg-slate-900 border-slate-700'
              : 'bg-white border-slate-300'
          }`}
          style={{
            boxShadow: darkMode 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' 
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}
        >
          {/* Header with Gradient */}
          <div className={`px-6 py-5 flex items-center justify-between relative overflow-hidden ${
            darkMode
              ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600'
              : 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500'
          }`}>
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}></div>
            </div>

            <div className="flex items-center space-x-3 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg flex items-center">
                  AI Assistant
                  <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full backdrop-blur-sm">Beta</span>
                </h3>
                <p className="text-white/90 text-xs flex items-center font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse shadow-lg"></span>
                  Always here to help
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 relative z-10">
              <button
                onClick={clearChat}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 backdrop-blur-sm group"
                title="Clear chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white transition-transform duration-200 group-hover:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 backdrop-blur-sm group"
                title="Minimize chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-white transition-transform duration-200 group-hover:scale-90"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div
            ref={chatContainerRef}
            className={`flex-1 overflow-y-auto p-6 space-y-4 ${
              darkMode ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 to-gray-100'
            }`}
            style={{ scrollbarWidth: 'thin' }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-lg transition-all duration-200 hover:shadow-xl ${
                    message.role === 'user'
                      ? darkMode
                        ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white ml-8'
                        : 'bg-gradient-to-br from-orange-500 to-red-500 text-white ml-8'
                      : darkMode
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 mr-8'
                      : 'bg-white text-slate-800 border border-slate-200 mr-8'
                  }`}
                  style={{
                    borderRadius: message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px'
                  }}
                >
                  <div className="text-sm leading-relaxed">
                    {formatMessage(message.content)}
                  </div>
                  {message.role === 'assistant' && (
                    <div className={`text-xs mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'} flex items-center`}>
                      <span className="mr-1">🤖</span> AI Assistant
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-lg ${
                    darkMode
                      ? 'bg-slate-800 text-slate-200 border border-slate-700'
                      : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                  style={{ borderRadius: '20px 20px 20px 4px' }}
                >
                  <div className="flex space-x-2 items-center">
                    <div className={`w-2.5 h-2.5 rounded-full animate-bounce ${darkMode ? 'bg-blue-400' : 'bg-orange-500'}`} style={{ animationDelay: '0ms' }}></div>
                    <div className={`w-2.5 h-2.5 rounded-full animate-bounce ${darkMode ? 'bg-purple-400' : 'bg-red-500'}`} style={{ animationDelay: '150ms' }}></div>
                    <div className={`w-2.5 h-2.5 rounded-full animate-bounce ${darkMode ? 'bg-pink-400' : 'bg-pink-500'}`} style={{ animationDelay: '300ms' }}></div>
                    <span className={`ml-2 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className={`p-4 border-t backdrop-blur-sm ${
              darkMode
                ? 'bg-slate-900/95 border-slate-700'
                : 'bg-white/95 border-slate-200'
            }`}
          >
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about Safe Sense..."
                  rows="2"
                  disabled={isLoading}
                  className={`w-full px-4 py-3 rounded-2xl resize-none focus:outline-none focus:ring-2 transition-all text-sm ${
                    darkMode
                      ? 'bg-slate-800 text-white placeholder-slate-500 focus:ring-blue-500 border border-slate-700'
                      : 'bg-slate-50 text-slate-800 placeholder-slate-400 focus:ring-orange-500 border border-slate-300'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                {/* Character Counter */}
                <div className={`absolute bottom-2 right-3 text-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                  {input.length}/500
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className={`px-5 py-3 rounded-2xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-xl ${
                  isLoading || !input.trim()
                    ? 'opacity-40 cursor-not-allowed bg-slate-400'
                    : darkMode
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105'
                    : 'bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white transform hover:scale-105'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-6 h-6 transition-transform duration-200 ${!isLoading && input.trim() ? 'group-hover:translate-x-1' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className={`text-xs mt-2 text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono">Enter</kbd> to send • 
              <kbd className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono ml-1">Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

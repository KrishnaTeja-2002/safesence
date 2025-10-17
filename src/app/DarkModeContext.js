"use client";

import { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    try {
      const savedDarkMode = localStorage.getItem('darkMode');
      if (savedDarkMode !== null) {
        const isDark = JSON.parse(savedDarkMode);
        setDarkMode(isDark);
        // Apply dark mode to HTML element immediately
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.body.style.color = '#ededed';
        } else {
          document.documentElement.classList.remove('dark');
          document.body.style.color = '';
        }
      } else {
        // Default to system preference if no saved preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDarkMode(prefersDark);
        if (prefersDark) {
          document.documentElement.classList.add('dark');
          document.body.style.color = '#ededed';
        }
      }
    } catch (error) {
      console.error('Error loading dark mode preference:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Apply dark mode class to HTML element whenever darkMode changes
  useEffect(() => {
    if (!isInitialized) return;
    
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        document.body.style.color = '#ededed';
      } else {
        document.documentElement.classList.remove('dark');
        document.body.style.color = '';
      }
      // Save preference to localStorage
      localStorage.setItem('darkMode', JSON.stringify(darkMode));
    } catch (error) {
      console.error('Error applying dark mode:', error);
    }
  }, [darkMode, isInitialized]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ darkMode, toggleDarkMode, isInitialized }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
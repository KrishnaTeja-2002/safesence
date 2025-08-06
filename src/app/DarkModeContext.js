"use client";

  import { createContext, useContext, useState } from 'react';

  const DarkModeContext = createContext();

  export function DarkModeProvider({ children }) {
    const [darkMode, setDarkMode] = useState(false);

    const toggleDarkMode = () => {
      setDarkMode((prev) => !prev);
    };

    return (
      <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
        {children}
      </DarkModeContext.Provider>
    );
  }

  export function useDarkMode() {
    return useContext(DarkModeContext);
  }
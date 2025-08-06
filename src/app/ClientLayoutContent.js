"use client";

import { useDarkMode } from './DarkModeContext';

export default function ClientLayoutContent({ children }) {
  const { darkMode } = useDarkMode();

  const styles = {
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '1rem 2rem',
      backgroundColor: darkMode ? '#1f2937' : '#f0f0f0',
      borderBottom: `1px solid ${darkMode ? '#4b5563' : '#ccc'}`,
      fontWeight: 'bold',
      color: darkMode ? '#ffffff' : '#000000',
    },
    logo: {
      fontSize: '1.5rem',
    },
    main: {
      minHeight: '80vh',
      padding: '2rem',
      backgroundColor: darkMode ? '#111827' : '#f9fafb',
      color: darkMode ? '#ffffff' : '#1f2937',
    },
    footer: {
      padding: '1rem 2rem',
      backgroundColor: darkMode ? '#1f2937' : '#f0f0f0',
      borderTop: `1px solid ${darkMode ? '#4b5563' : '#ccc'}`,
      textAlign: 'center',
      color: darkMode ? '#ffffff' : '#000000',
    },
  };

  return (
    <>
      <header style={styles.header}>
        <div style={styles.logo}>Safe Sense</div>
      </header>

      <main style={styles.main}>
        {children}
      </main>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} Safe Sense. All rights reserved.
      </footer>
    </>
  );
}
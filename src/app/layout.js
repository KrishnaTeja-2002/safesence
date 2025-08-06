import './globals.css';
import React from 'react';
import ClientLayoutContent from './ClientLayoutContent';
import { DarkModeProvider } from './DarkModeContext';

export const metadata = {
  title: 'Safe Sense',
  description: 'Sensor-based refrigeration monitoring',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DarkModeProvider>
          <ClientLayoutContent>{children}</ClientLayoutContent>
        </DarkModeProvider>
      </body>
    </html>
  );
}
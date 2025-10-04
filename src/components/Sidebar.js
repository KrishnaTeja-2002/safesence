"use client";

import { useRouter, usePathname } from 'next/navigation';
import { Home, AlertTriangle, Radio, Clock, Users, Settings } from 'lucide-react';
import { useDarkMode } from '../app/DarkModeContext';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode } = useDarkMode();

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: AlertTriangle, label: 'Alerts', path: '/alerts' },
    { icon: Radio, label: 'Devices', path: '/devices' },
    { icon: Clock, label: 'History', path: '/history' },
    { icon: Users, label: 'Team', path: '/teams' },
    { icon: Settings, label: 'Account', path: '/account' },
  ];

  return (
    <aside
      className={`w-60 py-6 px-4 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-800'}`}
      aria-label="Main navigation"
    >
      <div className="flex items-center mb-8">
        <div className={`w-6 h-6 rounded mr-2 flex items-center justify-center ${darkMode ? 'bg-orange-600' : 'bg-orange-500'}`}>
          <div className={`w-3 h-3 border ${darkMode ? 'border-gray-200' : 'border-white'} rounded-sm`}></div>
        </div>
        <h1 className={`text-lg font-semibold ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Safe Sense</h1>
      </div>
      <nav className="space-y-1" role="navigation">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center px-4 py-3 rounded text-sm font-medium transition-colors duration-200 ${
              pathname === item.path
                ? darkMode
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-300 text-gray-800'
                : darkMode
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-600 hover:bg-gray-300 hover:text-gray-800'
            }`}
            aria-current={pathname === item.path ? 'page' : undefined}
          >
            <item.icon className="w-5 h-5 mr-3" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
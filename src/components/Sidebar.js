"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, AlertTriangle, Radio, Clock, Users, Settings, Menu, X } from 'lucide-react';
import { useDarkMode } from '../app/DarkModeContext';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode } = useDarkMode();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: AlertTriangle, label: 'Alerts', path: '/alerts' },
    { icon: Radio, label: 'Devices', path: '/devices' },
    { icon: Clock, label: 'History', path: '/history' },
    { icon: Users, label: 'Team', path: '/teams' },
    { icon: Settings, label: 'Account', path: '/account' },
  ];

  const sidebarContent = (
    <>
      <div 
        className="flex items-center mb-8 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => router.push('/dashboard')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push('/dashboard');
          }
        }}
      >
        <div className="w-8 h-8 rounded-lg mr-3 flex items-center justify-center bg-orange-500 shadow-md">
          <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
        </div>
        <h1 className="text-xl font-bold text-orange-500">Safe Sense</h1>
      </div>
      <nav className="space-y-1" role="navigation">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              pathname === item.path
                ? 'bg-[#4A4A4A] text-white'
                : 'text-gray-300 hover:bg-[#4A4A4A] hover:text-white'
            }`}
            aria-current={pathname === item.path ? 'page' : undefined}
          >
            <item.icon className="w-5 h-5 mr-3" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg shadow-lg transition-colors bg-[#3D3D3D] text-white hover:bg-[#4A4A4A]"
        aria-label="Toggle navigation menu"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-40 h-screen
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-64
          py-6 px-4
          bg-[#3D3D3D]
          shadow-lg
          transition-all duration-300 ease-in-out
          flex flex-col
        `}
        aria-label="Main navigation"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
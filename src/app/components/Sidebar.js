'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, AlertTriangle, Radio, Clock, Users, Settings } from 'lucide-react';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: AlertTriangle, label: 'Alerts', path: '/alerts' },
    { icon: Radio, label: 'Sensors', path: '/sensors' },
    { icon: Clock, label: 'History', path: '/history' },
    { icon: Users, label: 'Team', path: '/teams' },
    { icon: Settings, label: 'Account', path: '/account' },
  ];

  return (
    <aside className="w-60 bg-gray-700 text-white py-6 px-4">
      <div className="flex items-center mb-8">
        <div className="w-6 h-6 bg-orange-500 rounded mr-2 flex items-center justify-center">
          <div className="w-3 h-3 border border-white rounded-sm"></div>
        </div>
        <h1 className="text-lg font-semibold text-orange-500">Safe Sense</h1>
      </div>
      <nav className="space-y-1">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => router.push(item.path)}
            className={`w-full flex items-center px-4 py-3 rounded text-sm font-medium ${
              pathname === item.path ? 'bg-gray-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
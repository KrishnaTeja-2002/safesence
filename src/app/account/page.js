'use client';

import { useState } from 'react';

export default function Settings() {
  const [preferences, setPreferences] = useState({
    tempScale: 'Fahrenheit',
    dashboard: ['Temperature Monitoring System', 'Sensors', 'Users', 'Alerts', 'Notifications'],
    timeZone: 'AKDT',
    darkMode: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleDashboardChange = (e) => {
    const { value, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      dashboard: checked
        ? [...prev.dashboard, value]
        : prev.dashboard.filter((item) => item !== value),
    }));
  };

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-700 text-white py-6 px-4">
        <h1 className="text-2xl font-bold mb-10 text-orange-500">Safe Sense</h1>
        <ul className="space-y-4">
          {['🏠 Dashboard', '⚠️ Alerts', '📡 Sensors', '🕓 History', '👥 Team', '⚙️ Settings'].map((item, idx) => (
            <li key={idx}>
              <button
                className={`w-full text-left px-4 py-2 rounded hover:bg-gray-600 ${
                  idx === 5 ? 'bg-gray-600 font-semibold' : ''
                }`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Account Settings</h2>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-6">Preferences</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Temp Scale</label>
              <select
                name="tempScale"
                value={preferences.tempScale}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              >
                <option>Fahrenheit</option>
                <option>Celsius</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dashboard</label>
              <p className="text-sm text-gray-500 mb-2">Select which data points (if supported by your sensor) to show on the dashboard</p>
              {['Temperature Monitoring System', 'Humidity Monitoring System', 'Sensors', 'Users', 'Alerts', 'Notifications'].map((item) => (
                <div key={item} className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id={item}
                    value={item}
                    checked={preferences.dashboard.includes(item)}
                    onChange={handleDashboardChange}
                    className="mr-2"
                  />
                  <label htmlFor={item}>{item}</label>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Time Zone</label>
              <select
                name="timeZone"
                value={preferences.timeZone}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              >
                <option>AKDT</option>
                <option>EDT</option>
                <option>PDT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dark Mode</label>
              <input
                type="checkbox"
                name="darkMode"
                checked={preferences.darkMode}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="switch">
                <span className="slider round"></span>
              </span>
            </div>
          </div>
          <button
            className="mt-6 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            Save
          </button>
        </div>
      </main>
    </div>
  );
}
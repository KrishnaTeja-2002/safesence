'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';

export default function Account() {
  const [preferences, setPreferences] = useState({
    tempScale: 'Fahrenheit',
    dashboard: ['Temperature Monitoring System', 'Sensors', 'Users', 'Alerts', 'Notifications'],
    timeZone: 'AKDT',
    darkMode: false,
  });
  const [savedPreferences, setSavedPreferences] = useState(null);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? e.target.checked : value,
    }));
  };

  const handleDashboardChange = (e) => {
    const { value, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      dashboard: checked ? [...prev.dashboard, value] : prev.dashboard.filter((item) => item !== value),
    }));
  };

  const handleSave = () => {
    setSavedPreferences({ ...preferences });
  };

  const toggleDarkMode = () => {
    setPreferences((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  };

  const sliderStyle = {
    position: 'relative',
    display: 'inline-block',
    width: '60px',
    height: '34px',
    backgroundColor: '#4a4a4a',
    borderRadius: '34px',
  };

  const sliderBeforeStyle = {
    position: 'absolute',
    content: '""',
    height: '26px',
    width: '26px',
    left: preferences.darkMode ? 'calc(100% - 30px)' : '4px',
    bottom: '4px',
    backgroundColor: '#fff',
    transition: '0.4s',
    borderRadius: '50%',
  };

  return (
    <div className={`flex min-h-screen ${preferences.darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Account Settings</h2>
          <div className="flex items-center gap-4">
            <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
            <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">FA</div>
          </div>
        </div>
        <div
          className={`rounded-lg shadow p-6 ${preferences.darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}
        >
          <h3 className="text-xl font-semibold mb-6">Preferences</h3>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Temp Scale</label>
              <select
                name="tempScale"
                value={preferences.tempScale}
                onChange={handleChange}
                className={`border rounded px-2 py-1 w-full ${
                  preferences.darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                }`}
              >
                <option>Fahrenheit</option>
                <option>Celsius</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dashboard</label>
              <p
                className={`text-sm mb-2 ${preferences.darkMode ? 'text-gray-400' : 'text-gray-500'}`}
              >
                Select which data points (if supported by your sensor) to show on the dashboard
              </p>
              {[
                'Temperature Monitoring System',
                'Humidity Monitoring System',
                'Sensors',
                'Users',
                'Alerts',
                'Notifications',
              ].map((item) => (
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
                className={`border rounded px-2 py-1 w-full ${
                  preferences.darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'
                }`}
              >
                <option>AKDT</option>
                <option>EDT</option>
                <option>PDT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mode</label>
              <label style={sliderStyle} className="relative inline-block cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.darkMode}
                  onChange={toggleDarkMode}
                  className="absolute opacity-0 w-0 h-0"
                />
                <span style={sliderBeforeStyle} className="absolute cursor-pointer"></span>
              </label>
            </div>
          </div>
          <button
            className={`mt-6 px-4 py-2 rounded text-white border ${
              preferences.darkMode
                ? 'bg-orange-700 hover:bg-orange-800 border-orange-700'
                : 'bg-orange-500 hover:bg-orange-600 border-orange-500'
            }`}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
        {savedPreferences && (
          <div
            className={`mt-6 rounded-lg shadow p-6 ${preferences.darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}
          >
            <h3 className="text-xl font-semibold mb-6">Saved Preferences</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Temp Scale</label>
                <select
                  name="tempScale"
                  value={savedPreferences.tempScale}
                  disabled
                  className={`border rounded px-2 py-1 w-full ${
                    preferences.darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <option>Fahrenheit</option>
                  <option>Celsius</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Dashboard</label>
                <p
                  className={`text-sm mb-2 ${preferences.darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  Saved data points based on your selection
                </p>
                {[
                  'Temperature Monitoring System',
                  'Humidity Monitoring System',
                  'Sensors',
                  'Users',
                  'Alerts',
                  'Notifications',
                ].map((item) => (
                  <div key={item} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id={item}
                      value={item}
                      checked={savedPreferences.dashboard.includes(item)}
                      disabled
                      className="mr-2"
                    />
                    <label htmlFor={item} className="text-gray-700">{item}</label>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time Zone</label>
                <select
                  name="timeZone"
                  value={savedPreferences.timeZone}
                  disabled
                  className={`border rounded px-2 py-1 w-full ${
                    preferences.darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <option>AKDT</option>
                  <option>EDT</option>
                  <option>PDT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mode</label>
                <label style={sliderStyle} className="relative inline-block cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savedPreferences.darkMode}
                    disabled
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <span style={sliderBeforeStyle} className="absolute cursor-pointer"></span>
                </label>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
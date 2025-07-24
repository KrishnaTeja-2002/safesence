'use client';

import { useState } from 'react';

export default function History() {
  const [selectedSensor, setSelectedSensor] = useState('Walk-In Fridge');
  const [selectedTimeRange, setSelectedTimeRange] = useState('Show: Temp');

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
                  idx === 3 ? 'bg-gray-600 font-semibold' : ''
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
          <h2 className="text-3xl font-bold">History</h2>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>

        {/* Temperature History Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold">Temperature History</h3>
            <p className="text-green-700 text-sm">Walk-In Fridge</p>
          </div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className="border rounded px-2 py-1 mr-2"
              >
                <option>Sensors</option>
                <option>Walk-In Fridge</option>
                <option>Beverages</option>
                <option>DT Fridge</option>
                <option>FC Fridge</option>
              </select>
            </div>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option>Show: Temp</option>
              <option>6H</option>
              <option>12H</option>
              <option>1D</option>
              <option>1M</option>
              <option>3M</option>
            </select>
          </div>
          <div className="relative">
            <div className="flex">
              {/* Y-axis (vertical part of L-shape) */}
              <div className="flex flex-col items-end pr-4">
                <div className="text-sm text-gray-500 mb-2">Temperature (°F)</div>
                <div className="flex flex-col justify-between h-64 text-sm text-gray-400">
                  {[60 , 50 , 40 , 30 , 20 ,10 , 0 ].map((val) => (
                    <div key={val} className="flex items-center">
                      <span className="leading-none mr-2">{val}</span>
                      <div className="w-4 border-t border-gray-200"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Area (empty) with horizontal base */}
              <div className="flex-1 relative">
                <div className="h-64">
                  {/* Empty space for the chart with vertical grid lines */}
                  <div className="absolute inset-0 flex justify-between">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="border-l border-gray-200 h-full"></div>
                    ))}
                  </div>
                </div>
              <div className="mt-4 flex justify-between w-full px-4"> {/* Changed to mt-4 to move down from the chart area */}
  {['6H', '12H', '1D', '1M', '3M', '6M', '1Y'].map((label) => (
    <span key={label} className="text-xs text-gray-600">{label}</span>
  ))}
</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
'use client';

import { useState } from 'react';

export default function Dashboard() {
  const [data] = useState({
    notifications: 6,
    sensors: { total: 8, error: 3, warning: 1, success: 4, disconnected: 2 },
    users: 6,
    temperatures: [
      { name: 'Walk-In Fridge', value: 41, displayValue: '41°F', color: 'linear-gradient(to top, #f7ca18, #ffe066)' },
      { name: 'Beverages', value: 33, displayValue: '33°F', color: 'linear-gradient(to top, #ef4444, #f87171)' },
      { name: 'DT Fridge', value: 24, displayValue: '24°F', color: 'linear-gradient(to top, #dc2626, #f87171)' },
      { name: 'FC Fridge', value: 47, displayValue: '47°F', color: 'linear-gradient(to top, #22c55e, #86efac)' },
      { name: 'Freezer 1', value: 18, displayValue: '-18°F', color: 'linear-gradient(to top, #ef4444, #f87171)' },
      { name: 'Meat Freezer', value: 12, displayValue: '-12°F', color: 'linear-gradient(to top, #22c55e, #86efac)' },
      { name: 'Fry Product', value: 16, displayValue: '-16°F', color: 'linear-gradient(to top, #22c55e, #86efac)' },
      { name: 'Freezer 2', value: 28, displayValue: '-28°F', color: 'linear-gradient(to top, #22c55e, #86efac)' },
    ],
  });

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-700 text-white py-6 px-4">
        <h1 className="text-2xl font-bold mb-10 text-orange-500">Safe Sense</h1>
        <ul className="space-y-4">
          {['🏠 Dashboard', '⚠️ Alerts', '📡 Sensors', '🕓 History', '👥 Team', '⚙️ Account'].map((item, idx) => (
            <li key={idx}>
              <button
                className={`w-full text-left px-4 py-2 rounded hover:bg-gray-600 ${
                  idx === 0 ? 'bg-gray-600 font-semibold' : ''
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
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-sm text-gray-500">Hi Francis Anino</p>
          </div>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-100 rounded-lg p-4 shadow text-center">
            <div className="text-green-700 text-3xl mb-2">🔔</div>
            <p className="text-sm text-green-700">Notifications</p>
            <p className="text-2xl font-bold text-green-700">{data.notifications}</p>
            <p className="text-sm text-red-500">● Unread</p>
          </div>
          <div className="bg-green-100 rounded-lg p-4 shadow text-center">
            <div className="text-green-700 text-3xl mb-2">📶</div>
            <p className="text-sm text-green-700">Sensors</p>
            <p className="text-2xl font-bold text-green-700">{data.sensors.total}</p>
            <div className="text-sm space-x-2 mt-1">
              <span className="text-red-500">▲ {data.sensors.error}</span>
              <span className="text-yellow-500">● {data.sensors.warning}</span>
              <span className="text-green-500">🟩 {data.sensors.success}</span>
              <span className="text-gray-500">✖ {data.sensors.disconnected}</span>
            </div>
          </div>
          <div className="bg-green-100 rounded-lg p-4 shadow text-center">
            <div className="text-green-700 text-3xl mb-2">👥</div>
            <p className="text-sm text-green-700">Users</p>
            <p className="text-2xl font-bold text-green-700">{data.users}</p>
            <div className="flex justify-center mt-2">
              {[...Array(data.users)].map((_, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-blue-300 border-2 border-white -ml-2"
                ></div>
              ))}
            </div>
          </div>
        </div>

        {/* Temperature Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-700">Temperature Monitoring System</h3>
          </div>
          
          <div className="relative">
            {/* Chart container */}
            <div className="flex">
              {/* Left Y-axis (Fridge) */}
              <div className="flex flex-col items-end pr-4">
                <div className="text-sm text-green-700 mb-2 font-medium">Fridge</div>
                <div className="flex flex-col-reverse justify-between h-64 text-sm text-gray-400">
                  {[0, 10, 20, 30, 40, 50, 60].map((val) => (
                    <span key={val} className="leading-none">{val}</span>
                  ))}
                </div>
              </div>

              {/* Chart area */}
              <div className="flex-1 relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between h-64">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="border-t border-gray-200 w-full"></div>
                  ))}
                </div>

                {/* Bars container */}
                <div className="relative h-64">
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end h-full px-4">
                    {data.temperatures.map((temp, i) => (
                      <div key={i} className="flex flex-col items-center">
                        {/* Temperature value display */}
                        <div className="mb-2 text-xs font-medium text-gray-700 bg-gray-50 px-2 py-1 rounded">
                          {temp.displayValue}
                        </div>
                        {/* Bar */}
                        <div
                          className="w-8 rounded-t-sm"
                          style={{
                            height: `${(temp.value / 60) * 100}%`,
                            background: temp.color,
                            minHeight: '4px'
                          }}
                        ></div>
                      </div>
                    ))}
                    {/* Empty spaces for alignment */}
                    {[...Array(3)].map((_, i) => (
                      <div key={`empty-${i}`} className="w-8"></div>
                    ))}
                  </div>
                </div>

                {/* Labels under chart */}
                <div className="mt-4 flex justify-between px-4">
                  {[...data.temperatures, ...Array(3).fill({ name: '--' })].map((temp, i) => (
                    <div key={i} className="text-xs text-center text-gray-600 w-8">
                      <div className="transform -rotate-45 origin-center whitespace-nowrap">
                        {temp.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Y-axis (Freezer) */}
              <div className="flex flex-col items-start pl-4">
                <div className="text-sm text-blue-600 mb-2 font-medium">Freezer</div>
                <div className="flex flex-col-reverse justify-between h-64 text-sm text-gray-400">
                  {[-5, -10, -15, -20, -25, -30].map((val) => (
                    <span key={val} className="leading-none">{val}</span>
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
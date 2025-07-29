'use client';

import { useState } from 'react';

export default function Dashboard() {
  const [data] = useState({
    notifications: 3,
    sensors: { total: 8, error: 3, warning: 1, success: 4, disconnected: 2 },
    users: 6,
    temperatures: [
      { name: 'Walk-In\nFridge', value: 41, displayValue: '41°F', height: 68, color: '#fbbf24', type: 'fridge' },
      { name: 'Beverages', value: 33, displayValue: '33°F', height: 55, color: '#ef4444', type: 'fridge' },
      { name: 'DT\nFridge', value: 20, displayValue: '20°F', height: 33, color: '#ef4444', type: 'fridge' },
      { name: 'FC Fridge', value: 47, displayValue: '47°F', height: 78, color: '#22c55e', type: 'fridge' },
      { name: 'Freezer 1', value: -18, displayValue: '-18°F', height: 60, color: '#ef4444', type: 'freezer' },
      { name: 'Meat\nFreezer', value: -12, displayValue: '-12°F', height: 40, color: '#86efac', type: 'freezer' },
      { name: 'Fry\nProduct', value: -16, displayValue: '-16°F', height: 53, color: '#86efac', type: 'freezer' },
      { name: 'Freezer 2', value: -20, displayValue: '-20°F', height: 67, color: '#86efac', type: 'freezer' },
    ],
  });

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-600 text-white">
        <div className="p-6">
          <div className="flex items-center mb-8">
            <div className="w-6 h-6 bg-orange-500 rounded mr-2 flex items-center justify-center">
              <div className="w-3 h-3 border border-white rounded-sm"></div>
            </div>
            <h1 className="text-lg font-semibold text-orange-500">Safe Sense</h1>
          </div>
          
          <nav className="space-y-1">
            <div className="flex items-center px-4 py-3 bg-gray-700 rounded text-white">
              <span className="mr-3 text-sm">🏠</span>
              <span className="text-sm font-medium">Dashboard</span>
            </div>
            <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
              <span className="mr-3 text-sm">⚠️</span>
              <span className="text-sm">Alerts</span>
            </div>
            <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
              <span className="mr-3 text-sm">📡</span>
              <span className="text-sm">Sensors</span>
            </div>
            <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
              <span className="mr-3 text-sm">📋</span>
              <span className="text-sm">History</span>
            </div>
            <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
              <span className="mr-3 text-sm">👥</span>
              <span className="text-sm">Team</span>
            </div>
            <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
              <span className="mr-3 text-sm">⚙️</span>
              <span className="text-sm">Account</span>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 bg-gray-50">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h2>
            <p className="text-gray-600">Hi Francis Anino</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium">
              Log out
            </button>
            <div className="w-10 h-10 rounded-full overflow-hidden">
              <div className="w-full h-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold">
                FA
              </div>
            </div>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Notifications Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">🔔</span>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">Notifications</p>
              <p className="text-3xl font-bold text-gray-900 mb-2">3</p>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-red-500 text-sm">Unread</span>
              </div>
            </div>
          </div>

          {/* Sensors Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">📶</span>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">Sensors</p>
              <p className="text-3xl font-bold text-gray-900 mb-2">8</p>
              <div className="flex items-center justify-center space-x-3 text-sm">
                <div className="flex items-center">
                  <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-red-500 mr-1"></div>
                  <span className="text-red-500 font-medium">3</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                  <span className="text-yellow-500 font-medium">1</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 mr-1"></div>
                  <span className="text-green-500 font-medium">4</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1 text-xs">✖</span>
                  <span className="text-gray-500 font-medium">2</span>
                </div>
              </div>
            </div>
          </div>

          {/* Users Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">👥</span>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-1">Users</p>
              <p className="text-3xl font-bold text-gray-900 mb-2">6</p>
              <div className="flex justify-center -space-x-1">
                <div className="w-6 h-6 bg-orange-500 rounded-full border-2 border-white"></div>
                <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white"></div>
                <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
                <div className="w-6 h-6 bg-purple-500 rounded-full border-2 border-white"></div>
                <div className="w-6 h-6 bg-pink-500 rounded-full border-2 border-white"></div>
                <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Temperature Chart */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-blue-300 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Temperature Monitoring System</h3>
            <div className="text-gray-400 text-xl">⋯</div>
          </div>
          
          <div className="relative">
            <div className="flex">
              {/* Left Y-axis (Fridge) */}
              <div className="flex flex-col w-16 mr-6 relative">
                <div className="text-sm font-medium text-green-600 mb-6 text-left">Fridge</div>
                <div className="flex flex-col-reverse h-80 text-xs text-gray-500 justify-between items-end pr-2">
                  <span className="leading-none">0</span>
                  <span className="leading-none">10</span>
                  <span className="leading-none">20</span>
                  <span className="leading-none">30</span>
                  <span className="leading-none">40</span>
                  <span className="leading-none">50</span>
                  <span className="leading-none">60</span>
                </div>
                {/* Fahrenheit label in middle of Y-axis */}
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-gray-500 origin-center">
                  Fahrenheit
                </div>
              </div>

              {/* Chart Area */}
              <div className="flex-1 relative">
                {/* Grid Lines */}
                <div className="absolute inset-0 h-80">
                  <div className="h-full flex flex-col justify-between">
                    {[...Array(7)].map((_, i) => (
                      <div key={i} className="border-t border-gray-200 w-full"></div>
                    ))}
                  </div>
                </div>
                
                {/* Temperature Display Box - positioned over FC Fridge */}
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-green-100 border-2 border-green-300 rounded-lg px-4 py-2 z-10">
                  <div className="text-xs text-green-700 text-center font-medium">Temperature</div>
                  <div className="text-lg font-bold text-green-700 text-center">41°F</div>
                </div>

                {/* Bars Container */}
                <div className="relative h-80">
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end h-full px-2">
                    {data.temperatures.map((temp, i) => (
                      <div key={i} className="flex flex-col items-center relative" style={{ width: '11%' }}>
                        {/* Vertical projection line */}
                        <div
                          className="absolute w-0.5 opacity-40"
                          style={{
                            backgroundColor: temp.color,
                            height: `${100 - temp.height}%`,
                            top: 0,
                            left: '50%',
                            transform: 'translateX(-50%)'
                          }}
                        ></div>
                        
                        {/* Bar */}
                        <div
                          className="rounded-t-md"
                          style={{
                            width: '32px',
                            height: `${temp.height}%`,
                            backgroundColor: temp.color,
                            minHeight: '8px'
                          }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* X-axis Labels */}
                <div className="flex justify-between px-2 mt-4">
                  {data.temperatures.map((temp, i) => (
                    <div key={i} className="text-center" style={{ width: '11%' }}>
                      <div className="text-xs text-gray-600 leading-tight">
                        {temp.name === 'Walk-In\nFridge' ? (
                          <div>
                            <div>Walk-In</div>
                            <div>Fridge</div>
                          </div>
                        ) : temp.name === 'DT\nFridge' ? (
                          <div>
                            <div>DT</div>
                            <div>Fridge</div>
                          </div>
                        ) : temp.name === 'Meat\nFreezer' ? (
                          <div>
                            <div>Meat</div>
                            <div>Freezer</div>
                          </div>
                        ) : temp.name === 'Fry\nProduct' ? (
                          <div>
                            <div>Fry</div>
                            <div>Product</div>
                          </div>
                        ) : (
                          <div>{temp.name}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Y-axis (Freezer) */}
              <div className="flex flex-col w-12 ml-6">
                <div className="text-sm font-medium text-blue-600 mb-6 text-right">Freezer</div>
                <div className="flex flex-col-reverse h-80 text-xs text-gray-500 justify-between items-start pl-2">
                  <span className="leading-none">-5</span>
                  <span className="leading-none">-10</span>
                  <span className="leading-none">-15</span>
                  <span className="leading-none">-20</span>
                  <span className="leading-none">-25</span>
                  <span className="leading-none">-30</span>
                </div>
              </div>
            </div>

            {/* Bottom Label */}
            <div className="text-center mt-8">
              <span className="text-sm text-gray-600 font-medium">Sensors</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
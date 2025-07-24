'use client';

import { useState } from 'react';

export default function Sensors() {
  const [sensors] = useState([
    { name: 'Walk-In Fridge', function: 'Air Temp', alert: 'On', date: 'June 28 2025', status: 'Active' },
    { name: 'Freezer 1', function: 'Air Temp', alert: 'On', date: 'May 2 2025', status: 'Inactive' },
    { name: 'Drive Thru Fridge', function: 'Air and Surface Temp', alert: 'On', date: 'May 6 2025', status: 'Inactive' },
    { name: 'FC Fridge', function: 'Surface Temp', alert: 'On', date: 'April 4 2025', status: 'Active' },
    { name: 'Freezer 2', function: 'Air and Surface Temp', alert: 'On', date: 'Jan 2025', status: 'Active' },
    { name: 'Meat Freezer', function: 'Air and Surface Temp', alert: 'On', date: 'Dec 28 2024', status: 'Active' },
    { name: 'Fry Products', function: 'Air and Surface Temp', alert: 'On', date: 'Oct 18 2024', status: 'Active' },
    { name: 'Beverage Fridge', function: 'Air Temp', alert: 'Off', date: 'Sep 18 2024', status: 'Inactive' },
  ]);

  const [hoveredSensor, setHoveredSensor] = useState(null);

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
                  idx === 2 ? 'bg-gray-600 font-semibold' : ''
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
            <h2 className="text-3xl font-bold">Sensors</h2>
            <p className="text-sm text-gray-500">Paired Sensors</p>
          </div>
          <div className="flex items-center space-x-4">
            <select className="p-2 border rounded bg-white text-gray-700">
              <option>Sort by: Newest</option>
            </select>
            <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
          </div>
        </div>

        {/* Sensors Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Sensor Name</th>
                <th className="py-2">Function</th>
                <th className="py-2">Alert</th>
                <th className="py-2">Date</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((sensor, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2">
                    <div
                      className="relative inline-block"
                      onMouseEnter={() => setHoveredSensor(sensor.name)}
                      onMouseLeave={() => setHoveredSensor(null)}
                    >
                      <button className="bg-blue-200 text-gray-800 px-4 py-2 rounded flex items-center space-x-2">
                        {sensor.name}
                      </button>
                      {hoveredSensor === sensor.name && (
                        <div className="absolute left-0 mt-2 w-32 bg-white border rounded shadow-lg z-10">
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Edit</button>
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Delete</button>
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-100">View</button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2">{sensor.function}</td>
                  <td className="py-2">{sensor.alert}</td>
                  <td className="py-2">{sensor.date}</td>
                  <td className="py-2">
                    <span
                      className={`px-3 py-1 rounded ${
                        sensor.status === 'Active' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {sensor.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <span>Showing Sensors 1 to 8 of 10</span>
            <div className="space-x-2">
              <button className="px-2 py-1 border rounded">1</button>
              <button className="px-2 py-1 border rounded">2</button>
              <span>&gt;</span>
            </div>
          </div>
        </div>

        {/* Add Sensor Button */}
        <div className="mt-6 text-right">
          <button className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">Add Sensor</button>
        </div>
      </main>
    </div>
  );
}
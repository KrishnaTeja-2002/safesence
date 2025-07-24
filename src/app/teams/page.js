'use client';

import { useState } from 'react';

export default function Team() {
  const [members] = useState([
    { name: 'Francis Anino', role: 'Owner' },
    { name: 'Ronald Richards', role: 'Full access' },
    { name: 'Cameron Williamson', role: 'Full access' },
    { name: 'Ariene McCoy', role: 'Full access' },
    { name: 'Jerome Bell', role: 'Full access' },
    { name: 'Dianne Russell', role: 'Full access' },
  ]);

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
                  idx === 4 ? 'bg-gray-600 font-semibold' : ''
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
          <h2 className="text-3xl font-bold">Team</h2>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>

        {/* Team Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Invite by email</span>
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  className="border rounded px-2 py-1 mr-2"
                />
                <select className="border rounded px-2 py-1">
                  <option>Access</option>
                  <option>Full access</option>
                  <option>Owner</option>
                </select>
                <button className="bg-orange-500 text-white px-4 py-1 rounded ml-2">Send Invite</button>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-4">Members List:</p>
            {members.map((member, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-300 mr-3"></div>
                  <span>{member.name}</span>
                </div>
                <button className="bg-gray-200 text-gray-700 px-3 py-1 rounded">
                  {member.role}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
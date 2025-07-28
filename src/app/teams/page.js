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

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Access');

  const handleSendInvite = () => {
    if (inviteEmail) {
      console.log(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
      alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
      setInviteEmail(''); // Clear the input after sending
    } else {
      alert('Please enter an email address.');
    }
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
            <div className="flex flex-col space-y-4">
              <span className="text-sm text-gray-500">Invite by email</span>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="border border-gray-300 rounded-l px-4 py-2 w-[700px]" // Even bigger email box with left rounding
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="absolute right-0 top-0 h-full border border-gray-300 rounded-r px-2 py-1 w-32"
                    style={{ marginLeft: '-1px' }} // Adjust to align with input border
                  >
                    <option>Access</option>
                    <option>Full access</option>
                    <option>Owner</option>
                  </select>
                </div>
                <button
                  onClick={handleSendInvite}
                  className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600"
                >
                  Send Invite
                </button>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-4">Members List:</p>
            {members.map((member, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-300 mr-3"></div>
                  <span>{member.name}</span>
                </div>
                <button className="bg-orange-500 text-white px-3 py-1 rounded">
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
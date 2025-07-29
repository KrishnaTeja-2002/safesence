
'use client';

import { useState, Component } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div>Error: {this.state.error?.message || 'Something went wrong'}</div>;
    }
    return this.props.children;
  }
}

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
  const [preferences, setPreferences] = useState({
    darkMode: false,
  });
  const router = useRouter();

  const handleSendInvite = () => {
    if (inviteEmail) {
      console.log(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
      alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
      setInviteEmail('');
    } else {
      alert('Please enter an email address.');
    }
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
    <ErrorBoundary>
      <div className={`flex min-h-screen ${preferences.darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar darkMode={preferences.darkMode} />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Team</h2>
            <div className="flex items-center space-x-4">
              <button
                className={`px-4 py-2 rounded ${
                  preferences.darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Log out
              </button>
              <div className="w-10 h-10 bg-yellow-600 rounded-full"></div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${preferences.darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="mb-6">
              <div className="flex flex-col space-y-4">
                <span className={`text-sm ${preferences.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Invite by email
                </span>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="Email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className={`border rounded-l px-4 py-2 w-[700px] ${
                        preferences.darkMode ? 'bg-gray-700 text-white border-gray-600' : 'border-gray-300'
                      }`}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className={`absolute right-0 top-0 h-full border rounded-r px-2 py-1 w-32 ${
                        preferences.darkMode ? 'bg-gray-700 text-white border-gray-600' : 'border-gray-300'
                      }`}
                      style={{ marginLeft: '-1px' }}
                    >
                      <option>Access</option>
                      <option>Full access</option>
                      <option>Owner</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSendInvite}
                    className={`px-4 py-1 rounded text-white border ${
                      preferences.darkMode
                        ? 'bg-orange-700 hover:bg-orange-800 border-orange-700'
                        : 'bg-orange-500 hover:bg-orange-600 border-orange-500'
                    }`}
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            </div>
            <div>
              <p className={`text-sm mb-4 ${preferences.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Members List:
              </p>
              {members.map((member, idx) => (
                <div key={idx} className={`flex justify-between items-center py-2 border-b ${preferences.darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full ${preferences.darkMode ? 'bg-gray-600' : 'bg-gray-300'} mr-3`}></div>
                    <span>{member.name}</span>
                  </div>
                  <button
                    className={`px-3 py-1 rounded text-white border ${
                      preferences.darkMode
                        ? 'bg-orange-700 hover:bg-orange-800 border-orange-700'
                        : 'bg-orange-500 hover:bg-orange-600 border-orange-500'
                    }`}
                  >
                    {member.role}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6">
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
        </main>
      </div>
    </ErrorBoundary>
  );
}

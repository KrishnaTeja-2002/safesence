'use client';

import { useState, useEffect, Component } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    const { darkMode } = this.context || useDarkMode();
    if (this.state.hasError) {
      return <div className={`p-4 ${darkMode ? 'text-red-400' : 'text-red-500'}`}>Error: {this.state.error?.message || 'Something went wrong'}</div>;
    }
    return this.props.children;
  }
}

export default function Team() {
  const { darkMode } = useDarkMode();
  const [members, setMembers] = useState([
    { name: 'Francis Anino', role: 'Owner' },
    { name: 'Ronald Richards', role: 'Full access' },
    { name: 'Cameron Williamson', role: 'Full access' },
    { name: 'Ariene McCoy', role: 'Full access' },
    { name: 'Jerome Bell', role: 'Full access' },
    { name: 'Dianne Russell', role: 'Full access' },
  ]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Access');
  const [showPopup, setShowPopup] = useState(false);
  const [rejectedName, setRejectedName] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accepted = searchParams.get('accepted');
    const rejected = searchParams.get('rejected');
    const name = searchParams.get('name');
    const role = searchParams.get('role');
    if (accepted === 'true' && name && role) {
      const newMember = { name: decodeURIComponent(name), role: decodeURIComponent(role) };
      if (!members.some(member => member.name === newMember.name)) {
        setMembers(prevMembers => [...prevMembers, newMember]);
      }
      alert(`${name} has been added to the team!`);
      // Clear the URL parameters after processing
      window.history.replaceState({}, document.title, '/team');
    } else if (rejected === 'true' && name) {
      setRejectedName(decodeURIComponent(name));
      setShowPopup(true);
      window.history.replaceState({}, document.title, '/team');
    }
  }, [searchParams]); // Depend on searchParams to re-run on URL change

  const handleSendInvite = async () => {
    if (inviteEmail) {
      const response = await fetch('/api/sendInvite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
      } else {
        alert(`Failed to send invitation: ${result.error}`);
      }
      setInviteEmail('');
    } else {
      alert('Please enter an email address.');
    }
  };

  const closePopup = () => {
    setShowPopup(false);
    setRejectedName('');
  };

  return (
    <ErrorBoundary>
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar activeKey="team" darkMode={darkMode} />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Team</h2>
            <div className="flex items-center space-x-4">
              <button
                className={`px-4 py-2 rounded ${
                  darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                Log out
              </button>
              <div className={`w-10 h-10 ${darkMode ? 'bg-amber-700' : 'bg-amber-600'} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                FA
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="mb-6">
              <div className="flex flex-col space-y-4">
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Invite by email
                </span>
                <div className="flex items-center space-x-4">
                  <div className="flex-1 flex">
                    <input
                      type="email"
                      placeholder="Email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className={`flex-grow border rounded-l px-4 py-2 min-w-0 ${
                        darkMode ? 'bg-gray-700 text-white border-gray-600' : 'border-gray-300'
                      }`}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className={`w-32 border-y border-r rounded-r px-4 py-2 ${
                        darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option>Access</option>
                      <option>Full access</option>
                      <option>Owner</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSendInvite}
                    className={`px-4 py-2 rounded text-white ${
                      darkMode
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
              <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Members List:
              </p>
              {members.map((member, idx) => (
                <div key={idx} className={`flex justify-between items-center py-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-gray-600' : 'bg-gray-300'} mr-3`}></div>
                    <span>{member.name}</span>
                  </div>
                  <button
                    className={`px-3 py-1 rounded text-white ${
                      darkMode
                        ? 'bg-orange-700 hover:bg-orange-800 border-orange-700'
                        : 'bg-orange-500 hover:bg-orange-600 border-orange-500'
                    }`}
                  >
                    {member.role}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {showPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className={`p-4 rounded ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
                <p>This person ({rejectedName}) rejected the invitation.</p>
                <button onClick={closePopup} className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
                  Close
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
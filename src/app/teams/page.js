'use client';

import { useState, useEffect, useCallback, Component, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';
import apiClient from '../lib/apiClient';


class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-500">Error: {this.state.error?.message || 'Something went wrong'}</div>;
    }
    return this.props.children;
  }
}

function TeamContent() {
  const { darkMode } = useDarkMode();
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [showPopup, setShowPopup] = useState(false);
  const [rejectedName, setRejectedName] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('User');
  const [sensors, setSensors] = useState([]); // sensors user can access
  const [activeSensorId, setActiveSensorId] = useState(null);
  const [shares, setShares] = useState([]); // [{user_id, username, role}]
  const [myRole, setMyRole] = useState('viewer');
  const [currentUser, setCurrentUser] = useState({ id: null, email: null });
  const [isLeaving, setIsLeaving] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthed, setIsAuthed] = useState(false);

  // Get initials for avatar
  const getInitials = (name) => {
    return name
      ? name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : 'NA';
  };

  // Check user session and set username
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking session...');
        const token = localStorage.getItem('auth-token');
        if (!token) {
          console.log('No token found, redirecting to login');
          router.push('/login');
          return;
        }

        const response = await fetch('/api/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        if (!response.ok) {
          localStorage.removeItem('auth-token');
          console.log('Invalid token, redirecting to login');
          router.push('/login');
          return;
        }

        const { user } = await response.json();
        const displayName = user?.email?.split('@')[0] || 'User';
        console.log('Session found, user:', displayName);
        setUsername(displayName);
        setCurrentUser({ id: user.id, email: user.email });
        console.log('Set current user:', { id: user.id, email: user.email });
        setIsAuthed(true);
      } catch (err) {
        console.error('Session check error:', err.message);
        setError(
          err.message === 'Failed to fetch'
            ? 'Unable to connect to authentication server. Please check your network or contact support.'
            : 'Failed to verify session: ' + err.message
        );
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  // Load sensors user can access (owner + shares)
  useEffect(() => {
    const loadSensors = async () => {
      try {
        const rows = await apiClient.getSensors();
        
        // Determine current user from verified session state
        const currentUserId = currentUser?.id || null;
        
        const mapped = (rows || []).map(r => ({
          id: r.sensor_id,
          name: r.sensor_name || r.sensor_id,
          access_role: r.access_role, // no default role
        })).sort((a,b) => (a?.name || '').localeCompare(b?.name || ''));
        
        // Set myRole based on the selected sensor's access_role from API
        if (mapped.length > 0 && activeSensorId) {
          const selectedSensor = mapped.find(s => s.id === activeSensorId);
          if (selectedSensor) {
            setMyRole(selectedSensor.access_role);
          }
        }
        
        setSensors(mapped);
      } catch (e) {
        setError('Failed to load sensors: ' + (e?.message || String(e)));
      }
    };
    if (isAuthed) loadSensors();
  }, [activeSensorId, isAuthed, currentUser?.id]);

  // Update myRole when activeSensorId changes
  useEffect(() => {
    if (activeSensorId && sensors.length > 0) {
      const selectedSensor = sensors.find(s => s.id === activeSensorId);
      if (selectedSensor) {
        setMyRole(selectedSensor.access_role);
      }
    }
  }, [activeSensorId, sensors]);

  // Function to load shares for the selected sensor
  const loadShares = useCallback(async () => {
    if (!activeSensorId) return;
    try {
      const res = await apiClient.getSensorShares(activeSensorId);
      console.log('Shares response:', res);
      const arr = res?.access || [];
      console.log('Access array:', arr);
      // Deduplicate by user_id or email to avoid duplicate keys
      const seen = new Set();
      const unique = [];
      for (const a of arr) {
        const key = a.user_id || `email:${(a.email || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(a);
      }
      setShares(unique);
      // myRole is now set based on the API's access_role in the useEffect above
    } catch (e) {
      setError('Failed to load access list: ' + (e?.message || String(e)));
      setShares([]);
    }
  }, [activeSensorId]);

  // Load shares for the selected sensor
  useEffect(() => {
    if (isAuthed) loadShares();
  }, [activeSensorId, isAuthed, loadShares]);

  // Handle invitation acceptance/rejection from URL params
  useEffect(() => {
    const accepted = searchParams.get('accepted');
    const rejected = searchParams.get('rejected');
    const name = searchParams.get('name');
    const role = searchParams.get('role');
    const token = searchParams.get('token');

    console.log('Query params:', { accepted, rejected, name, role, token });

    if (accepted === 'true' && name && role && token) {
      const handleAccept = async () => {
        try {
          console.log('Processing acceptance for:', { name, role, token });
          
          // Use API to accept invitation
          const response = await fetch('/api/team-invitations/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, name, role })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to accept invitation');
          }

          const result = await response.json();
          
          if (result.alreadyAccepted) {
            alert('This invitation has already been accepted.');
            window.history.replaceState({}, document.title, '/teams');
            return;
          }

          if (result.alreadyMember) {
            alert(`${result.name} is already a team member.`);
            window.history.replaceState({}, document.title, '/teams');
            return;
          }

          alert(`${result.name} has been successfully added to the team!`);

          window.history.replaceState({}, document.title, '/teams');
        } catch (err) {
          console.error('Acceptance error:', err);
          setError('Failed to process acceptance: ' + err.message);
        }
      };
      handleAccept();
    } else if (rejected === 'true' && name && token) {
      const handleReject = async () => {
        try {
          console.log('Processing rejection for:', { name, token });
          
          // Use API to reject invitation
          const response = await fetch('/api/team-invitations/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to reject invitation');
          }

          const result = await response.json();
          
          if (result.alreadyRejected) {
            alert('This invitation has already been rejected.');
            window.history.replaceState({}, document.title, '/teams');
            return;
          }

          setRejectedName(decodeURIComponent(name));
          setShowPopup(true);
          window.history.replaceState({}, document.title, '/teams');
        } catch (err) {
          console.error('Rejection error:', err);
          setError('Failed to process rejection: ' + err.message);
        }
      };
      handleReject();
    }
  }, [searchParams]);

  // Handle sending invitation
  const handleSendInvite = async () => {
    if (!inviteEmail) {
      alert('Please enter an email address.');
      return;
    }

    try {
      // Use API to send invitation
      const response = await fetch('/api/sendInvite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: inviteEmail, 
          role: inviteRole,
          sensorId: activeSensorId 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const result = await response.json();
      
      if (result.alreadyMember) {
        alert(`${inviteEmail} is already a team member.`);
        return;
      }

      if (result.pendingInvite) {
        alert(`There's already a pending invitation for ${inviteEmail}.`);
        return;
      }
      
      if (result.success) {
        console.log('Invite sent successfully to:', inviteEmail);
        alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
        setInviteEmail('');
      } else {
        throw new Error(result.error || 'Failed to send invitation');
      }
    } catch (err) {
      console.error('Send invite error:', err);
      setError(`Failed to send invitation: ${err.message}`);
      alert(`Failed to send invitation: ${err.message}`);
    }
  };

  // Handle removing a user from sensor access
  const handleRemoveUser = async (user) => {
    if (!activeSensorId) {
      alert('Please select a sensor first');
      return;
    }

    const confirmMessage = user.user_id 
      ? `Are you sure you want to remove ${user.username || user.email} from this sensor?`
      : `Are you sure you want to cancel the invitation for ${user.email}?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      if (user.user_id) {
        // Remove accepted user
        await apiClient.revokeShare({ 
          sensorId: activeSensorId, 
          userId: user.user_id 
        });
      } else {
        // Cancel pending invitation
        await apiClient.cancelInvite({ 
          sensorId: activeSensorId, 
          email: user.email 
        });
      }
      
      // Refresh the shares list
      await loadShares();
    } catch (err) {
      console.error('Remove user error:', err);
      alert(`Failed to remove user: ${err.message}`);
    }
  };

  // Handle sign-out
  const handleSignOut = async () => {
    try {
      try { localStorage.removeItem('auth-token'); } catch {}
      router.push('/login');
    } catch (err) {
      setError('Failed to sign out: ' + err.message);
    }
  };

  // Close rejection popup
  const closePopup = () => {
    setShowPopup(false);
    setRejectedName('');
  };

  return (
    <ErrorBoundary>
      <div className={`flex min-h-screen ${darkMode ? "bg-slate-900 text-white" : "bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800"}`}>
        <Sidebar activeKey="team" darkMode={darkMode} />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Manage Access</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSignOut}
                className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ${
                  darkMode ? 'bg-red-600 hover:bg-red-700' : ''
                }`}
              >
                Log out
              </button>
              <button
                onClick={() => router.push('/account')}
                className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold hover:bg-amber-700 transition-all duration-200 hover:scale-105 ${
                  darkMode ? 'bg-amber-700 hover:bg-amber-800' : ''
                }`}
              >
                {getInitials(username)}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white shadow-2xl border border-slate-100'}`}>
            <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your sensors</p>
            <div className="space-y-3">
                {sensors.map((s) => (
                <div key={s.id} className={`rounded border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className={`px-4 py-3 flex items-center justify-between ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  <button
                      type="button"
                      onClick={() => setActiveSensorId(activeSensorId === s.id ? null : s.id)}
                      className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} font-medium`}
                      title={`Role: ${s.access_role || 'viewer'}`}
                  >
                    {s.name}
                  </button>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.access_role === 'owner' ? (darkMode ? 'bg-green-700 text-green-200' : 'bg-green-200 text-green-800') : s.access_role === 'admin' ? (darkMode ? 'bg-yellow-700 text-yellow-200' : 'bg-yellow-200 text-yellow-800') : (darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800')}`}>{s.access_role || '—'}</span>
              </div>
                  {activeSensorId === s.id && (
                    <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Access for sensor: {s.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${myRole === 'owner' ? (darkMode ? 'bg-green-700 text-green-200' : 'bg-green-200 text-green-800') : myRole === 'admin' ? (darkMode ? 'bg-yellow-700 text-yellow-200' : 'bg-yellow-200 text-yellow-800') : (darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800')}`}>Your role: {myRole}</span>
                </div>
                {(myRole === 'owner' || myRole === 'admin') && (
                  <div className="flex items-center gap-3">
                    <input
                      type="email"
                      placeholder="Invite user by email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className={`flex-grow border rounded px-3 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className={`border rounded px-3 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                  <button
                      onClick={async () => {
                        try {
                          if (!inviteEmail) throw new Error('Email is required');
                                await apiClient.shareSensor({ sensorId: s.id, role: inviteRole, email: inviteEmail });
                          setInviteEmail('');
                                const res = await apiClient.getSensorShares(s.id);
                          setShares(res?.access || []);
                        } catch (e) {
                          setError(e?.message || String(e));
                        }
                      }}
                      className={`px-4 py-2 rounded text-white ${darkMode ? 'bg-orange-700 hover:bg-orange-800' : 'bg-orange-500 hover:bg-orange-600'}`}
                    >
                      Share
                  </button>
                </div>
                )}
                <div className="overflow-x-auto">
                  <table className={`w-full text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <thead>
                      <tr className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <th className="text-left px-3 py-2">User</th>
                        <th className="text-left px-3 py-2">Role</th>
                        <th className="text-right px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shares.map((u) => {
                        const displayName = u.username || (u.email ? u.email : (u.user_id ? u.user_id.slice(0, 8) : 'User'));
                        const badgeRole = u.role || 'viewer';
                        const isInvited = u.status === 'invited' && !u.user_id;
                        const isAcceptedPendingUserId = u.status === 'accepted' && !u.user_id;
                        return (
                          <tr key={u.user_id || u.email} className={`${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                            <td className="px-3 py-2">{displayName}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${badgeRole === 'owner' ? (darkMode ? 'bg-green-700 text-green-200' : 'bg-green-200 text-green-800') : badgeRole === 'admin' ? (darkMode ? 'bg-yellow-700 text-yellow-200' : 'bg-yellow-200 text-yellow-800') : (darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800')}`}>
                                {badgeRole}{isInvited ? ' • invited' : isAcceptedPendingUserId ? ' • accepted' : ''}
                              </span>
                            </td>
                                  <td className="px-3 py-2 text-right">
                              {(myRole === 'owner' || myRole === 'admin') && u.role !== 'owner' && (
                                <button
                                  onClick={() => handleRemoveUser(u)}
                                  className={`px-2 py-1 text-xs rounded ${
                                    darkMode 
                                      ? 'bg-red-600 text-white hover:bg-red-700' 
                                      : 'bg-red-500 text-white hover:bg-red-600'
                                  }`}
                                  title={u.user_id ? 'Remove user' : 'Cancel invitation'}
                                >
                                  {u.user_id ? 'Remove' : 'Cancel'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {shares.length === 0 && (
                        <tr>
                          <td className="px-3 py-3" colSpan={3}>No users yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
            </div>
              </div>
            )}
                </div>
              ))}
              {sensors.length === 0 && (
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No sensors available</span>
              )}
            </div>
          </div>
          {showPopup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className={`p-4 rounded ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
                <p>This person ({rejectedName}) rejected the invitation.</p>
                <button onClick={closePopup} className={`mt-4 px-4 py-2 rounded hover:bg-red-600 ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}>
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

export default function Team() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-6">Loading…</div>}>
        <TeamContent />
      </Suspense>
    </ErrorBoundary>
  );
}
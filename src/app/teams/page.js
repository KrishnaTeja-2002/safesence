'use client';

import { useState, useEffect, Component } from 'react';
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

export default function Team() {
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
        
        const mapped = (rows || []).map(r => {
          // Determine role based on owner_id and current user
          let access_role = 'viewer';
          if (currentUserId && r.owner_id === currentUserId) {
            access_role = 'owner';
          } else if (r.access_role && r.access_role !== 'viewer') {
            access_role = r.access_role;
          }
          
          return {
            id: r.sensor_id,
            name: r.sensor_name || r.sensor_id,
            access_role: access_role,
          };
        }).sort((a,b) => (a?.name || '').localeCompare(b?.name || ''));
        
        setSensors(mapped);
        if (mapped.length && !activeSensorId) setActiveSensorId(mapped[0].id);
      } catch (e) {
        setError('Failed to load sensors: ' + (e?.message || String(e)));
      }
    };
    if (isAuthed) loadSensors();
  }, [activeSensorId, isAuthed]);

  // Load shares for the selected sensor
  useEffect(() => {
    const run = async () => {
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
        // set my role from list
        // Resolve current user via token verification
        let uid = null;
        let userEmail = null;
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
          if (token) {
            const resp = await fetch('/api/verify-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token })
            });
            if (resp.ok) {
              const { user } = await resp.json();
              uid = user?.id || null;
              userEmail = user?.email || null;
            }
          }
        } catch {}
        
        // Try to find current user by user_id first, then by email as fallback
        let me = arr.find(a => a.user_id === uid);
        if (!me && userEmail) {
          me = arr.find(a => a.email && a.email.toLowerCase() === userEmail.toLowerCase());
        }
        
        const owner = arr.find(a => a.role === 'owner' && (a.user_id === uid || (a.email && userEmail && a.email.toLowerCase() === userEmail.toLowerCase())));
        console.log('Debug - uid:', uid, 'userEmail:', userEmail, 'me:', me, 'owner:', owner, 'arr:', arr);
        console.log('Debug - me.role:', me?.role, 'typeof me.role:', typeof me?.role);
        if (owner) {
          console.log('Setting myRole to owner');
          setMyRole('owner');
        } else if (me) {
          const roleToSet = me.role || 'viewer';
          console.log('Setting myRole to:', roleToSet);
          setMyRole(roleToSet);
        } else {
          console.log('Setting myRole to viewer (default)');
          setMyRole('viewer');
        }
      } catch (e) {
        setError('Failed to load access list: ' + (e?.message || String(e)));
        setShares([]);
      }
    };
    if (isAuthed) run();
  }, [activeSensorId, isAuthed]);

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
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
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
              <div
                className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold ${
                  darkMode ? 'bg-amber-700' : ''
                }`}
              >
                {getInitials(username)}
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            {/* Sensor selector as button grid */}
            <div className="mb-6">
              <p className={`text-sm mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Your sensors</p>
              <div className="flex flex-wrap gap-3">
                {sensors.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSensorId(s.id)}
                    className={`px-4 py-2 rounded border text-sm ${
                      activeSensorId === s.id
                        ? (darkMode ? 'bg-blue-700 text-white border-blue-600' : 'bg-blue-500 text-white border-blue-500')
                        : (darkMode ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100')
                    }`}
                    title={`Role: ${activeSensorId === s.id ? myRole : (s.access_role || 'viewer')}`}
                  >
                    {s.name}
                    {(() => {
                      const roleBadge = activeSensorId === s.id ? myRole : (s.access_role || 'viewer');
                      const badgeClass =
                        roleBadge === 'owner'
                          ? 'bg-green-200 text-green-800'
                          : roleBadge === 'admin'
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-gray-200 text-gray-800';
                      return (
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${badgeClass}`}>
                          {roleBadge}
                        </span>
                      );
                    })()}
                  </button>
                ))}
                {sensors.length === 0 && (
                  <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>No sensors available</span>
                )}
              </div>
            </div>

            {/* Shares list for active sensor */}
            {activeSensorId && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Access for sensor: {sensors.find(s => s.id === activeSensorId)?.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${myRole === 'owner' ? 'bg-green-200 text-green-800' : myRole === 'admin' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'}`}>Your role: {myRole}</span>
                  {console.log('Render - myRole:', myRole, 'activeSensorId:', activeSensorId, 'currentUser:', currentUser, 'myRole === admin:', myRole === 'admin', 'myRole === owner:', myRole === 'owner')}
                </div>

                {/* Invite / share form (owners & admins) */}
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
                          await apiClient.shareSensor({ sensorId: activeSensorId, role: inviteRole, email: inviteEmail });
                          setInviteEmail('');
                          const res = await apiClient.getSensorShares(activeSensorId);
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

                {/* Access table */}
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
                        console.log('Rendering user:', { displayName, badgeRole, user_id: u.user_id, email: u.email, status: u.status, myRole }); // accepted but user_id not set
                        return (
                          <tr key={u.user_id || u.email} className={`${darkMode ? 'border-gray-700' : 'border-gray-200'} border-b`}>
                            <td className="px-3 py-2">{displayName}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${badgeRole === 'owner' ? 'bg-green-200 text-green-800' : badgeRole === 'admin' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'}`}>
                                {badgeRole}{isInvited ? ' • invited' : isAcceptedPendingUserId ? ' • accepted' : ''}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {(() => {
                                const canManageOthers = myRole === 'owner' || myRole === 'admin';
                                const isOwnerRow = badgeRole === 'owner';
                                const isCurrentUser =
                                  (u.user_id && String(currentUser.id) === String(u.user_id)) ||
                                  (u.email &&
                                   currentUser.email &&
                                   currentUser.email.toLowerCase() === u.email.toLowerCase());

                                const showCancelInvite = canManageOthers && isInvited;
                                const showRevoke = canManageOthers && !isOwnerRow && !isInvited && !isCurrentUser && (u.user_id || u.email);
                                const showLeave = isCurrentUser && !isOwnerRow;

                                return (
                                  <>
                                    {showCancelInvite && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            await apiClient.cancelInvite({ sensorId: activeSensorId, email: u.email });
                                            const res = await apiClient.getSensorShares(activeSensorId);
                                            setShares(res?.access || []);
                                          } catch (e) { setError(e?.message || String(e)); }
                                        }}
                                        className={`px-3 py-1 rounded text-white ${darkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-500 hover:bg-gray-600'}`}
                                      >
                                        Cancel invite
                                      </button>
                                    )}
                                    {showRevoke && (
                                      <button
                                        onClick={async () => {
                                          try {
                                            if (u.user_id) await apiClient.revokeShare({ sensorId: activeSensorId, userId: u.user_id });
                                            else if (u.email) await apiClient.cancelInvite({ sensorId: activeSensorId, email: u.email });
                                            const res = await apiClient.getSensorShares(activeSensorId);
                                            setShares(res?.access || []);
                                          } catch (e) { setError(e?.message || String(e)); }
                                        }}
                                        className={`ml-2 px-3 py-1 rounded text-white ${darkMode ? 'bg-red-700 hover:bg-red-800' : 'bg-red-500 hover:bg-red-600'}`}
                                      >
                                        Revoke
                                      </button>
                                    )}
                                    {showLeave && (
                  <button
                                        onClick={async () => {
                                          if (isLeaving) return; // Prevent multiple clicks
                                          
                                          try {
                                            setIsLeaving(true);
                                            console.log('Leaving sensor:', { sensorId: activeSensorId, userId: u.user_id, email: u.email });
                                            
                                            // Always use email-based approach for "Leave sensor" since user_id might be null
                                            if (u.email) {
                                              await apiClient.cancelInvite({ sensorId: activeSensorId, email: u.email });
                                            } else if (u.user_id) {
                                              await apiClient.revokeShare({ sensorId: activeSensorId, userId: u.user_id });
                                            } else {
                                              throw new Error('Cannot leave: no user_id or email available');
                                            }
                                            
                                            console.log('Successfully left sensor, refreshing page...');
                                            
                                            // Clear any previous errors first
                                            setError('');
                                            
                                            // Try to refresh the sensors list first (this is the most important update)
                                            try {
                                              console.log('Refreshing sensors list...');
                                              const sensorsRes = await apiClient.getSensors();
                                              console.log('Sensors response:', sensorsRes);
                                              setSensors(sensorsRes?.map(r => ({
                                                id: r.sensor_id,
                                                name: r.sensor_name || r.sensor_id,
                                                access_role: r.access_role || 'viewer',
                                              })).sort((a,b) => (a?.name || '').localeCompare(b?.name)) || []);
                                              
                                              // Check if the current sensor is still accessible
                                              const stillHasAccess = sensorsRes?.some(s => s.sensor_id === activeSensorId);
                                              if (!stillHasAccess) {
                                                console.log('No longer have access to this sensor, clearing selection');
                                                setActiveSensorId(null);
                                                setShares([]);
                                              } else {
                                                // If still has access, refresh the access list
                                                console.log('Still has access, refreshing access list...');
                                                const res = await apiClient.getSensorShares(activeSensorId);
                                                console.log('Access list response:', res);
                                                setShares(res?.access || []);
                                              }
                                            } catch (refreshError) {
                                              console.error('Error refreshing page:', refreshError);
                                              // Even if refresh fails, clear the selection since we know the user left
                                              setActiveSensorId(null);
                                              setShares([]);
                                              
                                              // Show a message to the user that they can refresh manually
                                              setError('Left sensor successfully. Please refresh the page to see updated sensor list.');
                                            }
                                            
                                            console.log('Page update completed');
                                          } catch (e) { 
                                            console.error('Leave sensor error:', e);
                                            console.error('Error details:', {
                                              message: e?.message,
                                              status: e?.status,
                                              response: e?.response,
                                              stack: e?.stack
                                            });
                                            setError(e?.message || String(e)); 
                                          } finally {
                                            setIsLeaving(false);
                                          }
                                        }}
                                        className={`ml-2 px-3 py-1 rounded text-white ${isLeaving ? 'opacity-50 cursor-not-allowed' : ''} ${darkMode ? 'bg-red-700 hover:bg-red-800' : 'bg-red-500 hover:bg-red-600'}`}
                                        disabled={isLeaving}
                                      >
                                        {isLeaving ? 'Leaving...' : 'Leave sensor'}
                  </button>
                                    )}
                                    {!showCancelInvite && !showRevoke && !showLeave && <span>—</span>}
                                  </>
                                );
                              })()}
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
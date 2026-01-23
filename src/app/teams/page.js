'use client';

import { useState, useEffect, useCallback, Component, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';
import apiClient from '../lib/apiClient';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';


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
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  const [sensors, setSensors] = useState([]); // sensors user can access
  const [activeSensorId, setActiveSensorId] = useState(null);
  const [shares, setShares] = useState([]); // [{user_id, username, role}]
  const [myRole, setMyRole] = useState('viewer');
  const [currentUser, setCurrentUser] = useState({ id: null, email: null });
  const [isLeaving, setIsLeaving] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthed, setIsAuthed] = useState(false);
  // Sensor groups and batch assignment
  const [sensorGroups, setSensorGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedSensorsForGroup, setSelectedSensorsForGroup] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);
  // Batch assignment state
  const [batchSelectAll, setBatchSelectAll] = useState(false);
  const [batchSelectedGroups, setBatchSelectedGroups] = useState([]);
  const [batchSelectedSensors, setBatchSelectedSensors] = useState([]);
  const [showBatchAssignment, setShowBatchAssignment] = useState(false);

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
        setCurrentUserEmail(user?.email || '');
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

  // Click outside handler for profile menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Load sensor groups
  useEffect(() => {
    const loadSensorGroups = async () => {
      if (isAuthed && currentUser?.id) {
        try {
          const res = await apiClient.getSensorGroups();
          setSensorGroups(res?.groups || []);
        } catch (e) {
          console.error('Failed to load sensor groups:', e);
        }
      }
    };
    loadSensorGroups();
  }, [isAuthed, currentUser?.id]);

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

  // Handle sending invitation (single sensor - legacy)
  const handleSendInvite = async () => {
    if (!inviteEmail || !inviteEmail.trim()) {
      alert('Please enter an email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!activeSensorId) {
      alert('Please select a sensor first.');
      return;
    }
      
    try {
      await apiClient.shareSensor({ 
        sensorId: activeSensorId, 
        role: inviteRole, 
        email: inviteEmail.trim().toLowerCase() 
      });
      alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
      setInviteEmail('');
      await loadShares();
    } catch (err) {
      console.error('Send invite error:', err);
      
      // Handle different error types with user-friendly messages
      let errorMessage = err.message || 'Failed to send invitation';
      
      if (err.code === 'DATABASE_ERROR') {
        errorMessage = 'Unable to connect to the server. Please try again later or contact support.';
      } else if (err.code === 'DATABASE_OPERATION_ERROR') {
        if (err.prismaCode === 'P2002') {
          errorMessage = 'An invitation already exists for this user and sensor combination.';
        } else if (err.prismaCode === 'P2003') {
          errorMessage = 'Invalid sensor reference. The sensor may not exist.';
        } else {
          errorMessage = 'Database operation failed. Please check your input and try again.';
        }
      } else if (err.message && err.message.includes('already has access')) {
        errorMessage = 'This user already has access to this sensor.';
      } else if (err.message && err.message.includes('permission')) {
        errorMessage = 'You do not have permission to invite users to this sensor.';
      } else if (err.message && err.message.includes('Invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      }
      
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  // Handle batch assignment
  const handleBatchAssign = async () => {
    if (!inviteEmail || !inviteEmail.trim()) {
      alert('Please enter an email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      alert('Please enter a valid email address.');
      return;
    }

    if (!batchSelectAll && batchSelectedGroups.length === 0 && batchSelectedSensors.length === 0) {
      alert('Please select at least one sensor, group, or "Select All".');
      return;
    }

    try {
      // When selectAll is true, we don't need to send individual sensor IDs or group IDs
      // The API will handle selecting all sensors owned by the user
      const sensorsInSelectedGroups = getSensorsFromGroups();
      const filteredSensorIds = batchSelectAll 
        ? [] // Don't send sensor IDs when selectAll is true
        : batchSelectedSensors.filter(id => !sensorsInSelectedGroups.includes(id));

      console.log('Batch assign request:', {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        selectAll: batchSelectAll,
        groupIds: batchSelectAll ? [] : batchSelectedGroups, // Don't send group IDs when selectAll is true
        sensorIds: filteredSensorIds
      });

      const result = await apiClient.batchAssignAccess({
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        selectAll: batchSelectAll,
        groupIds: batchSelectAll ? [] : batchSelectedGroups, // Clear group IDs when selectAll is true
        sensorIds: filteredSensorIds
      });

      if (result.warnings) {
        alert(`Batch invitation sent to ${inviteEmail} for ${result.sensorCount || 0} sensor(s) with role: ${inviteRole}. ${result.warnings}`);
      } else {
        alert(`Batch invitation sent to ${inviteEmail} for ${result.sensorCount || 0} sensor(s) with role: ${inviteRole}`);
      }
      setInviteEmail('');
      setBatchSelectAll(false);
      setBatchSelectedGroups([]);
      setBatchSelectedSensors([]);
      setShowBatchAssignment(false);
      
      // Refresh shares if a sensor is selected
      if (activeSensorId) {
        await loadShares();
      }
    } catch (err) {
      console.error('Batch assign error:', err);
      
      // Handle different error types with user-friendly messages
      let errorMessage = err.message || 'Failed to send batch invitation';
      
      if (err.code === 'DATABASE_ERROR') {
        errorMessage = 'Unable to connect to the server. Please try again later or contact support.';
      } else if (err.code === 'DATABASE_OPERATION_ERROR') {
        // Check for specific Prisma error codes
        if (err.prismaCode === 'P2002') {
          errorMessage = 'An invitation already exists for this user and sensor combination.';
        } else if (err.prismaCode === 'P2003') {
          errorMessage = 'Invalid sensor reference. One or more selected sensors may not exist.';
        } else if (err.prismaCode === 'P2025') {
          errorMessage = 'Record not found. Please refresh the page and try again.';
        } else {
          errorMessage = 'Database operation failed. Please check your selections and try again.';
        }
      } else if (err.code === 'DUPLICATE_INVITATION') {
        errorMessage = 'An invitation already exists for this user. Please check existing invitations.';
      } else if (err.message && (
        err.message.includes('database') || 
        err.message.includes('server') ||
        err.message.includes('Can\'t reach')
      )) {
        errorMessage = 'Server connection error. Please try again later or contact support.';
      }
      
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  // Sensor group management handlers
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name.');
      return;
    }

    if (selectedSensorsForGroup.length === 0) {
      alert('Please select at least one sensor for the group.');
      return;
    }

    try {
      if (editingGroup) {
        await apiClient.updateSensorGroup({
          id: editingGroup.id,
          name: groupName.trim(),
          sensorIds: selectedSensorsForGroup
        });
        alert('Sensor group updated successfully');
      } else {
        await apiClient.createSensorGroup({
          name: groupName.trim(),
          sensorIds: selectedSensorsForGroup
        });
        alert('Sensor group created successfully');
      }
      
      // Reload groups
      const res = await apiClient.getSensorGroups();
      setSensorGroups(res?.groups || []);
      
      // Reset form
      setGroupName('');
      setSelectedSensorsForGroup([]);
      setEditingGroup(null);
      setShowGroupModal(false);
    } catch (err) {
      console.error('Create/update group error:', err);
      
      // Handle different error types with user-friendly messages
      let errorMessage = err.message || `Failed to ${editingGroup ? 'update' : 'create'} group`;
      
      if (err.code === 'DATABASE_ERROR') {
        errorMessage = 'Unable to connect to the server. Please try again later or contact support.';
      } else if (err.code === 'DATABASE_OPERATION_ERROR') {
        errorMessage = 'Database operation failed. Please check your input and try again.';
      } else if (err.message && (
        err.message.includes('database') || 
        err.message.includes('server') ||
        err.message.includes('Can\'t reach')
      )) {
        errorMessage = 'Server connection error. Please try again later or contact support.';
      } else {
        errorMessage = `Failed to ${editingGroup ? 'update' : 'create'} group: ${errorMessage}`;
      }
      
      alert(errorMessage);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Are you sure you want to delete this sensor group?')) {
      return;
    }

    try {
      await apiClient.deleteSensorGroup(groupId);
      alert('Sensor group deleted successfully');
      
      // Reload groups
      const res = await apiClient.getSensorGroups();
      setSensorGroups(res?.groups || []);
    } catch (err) {
      console.error('Delete group error:', err);
      alert(`Failed to delete group: ${err.message}`);
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedSensorsForGroup(group.sensors.map(s => s.sensorId));
    setShowGroupModal(true);
  };

  // Get owned sensors (for group creation)
  const ownedSensors = sensors.filter(s => s.access_role === 'owner');

  // Handle batch checkbox changes
  const handleBatchGroupToggle = (groupId) => {
    setBatchSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleBatchSensorToggle = (sensorId) => {
    setBatchSelectedSensors(prev => 
      prev.includes(sensorId)
        ? prev.filter(id => id !== sensorId)
        : [...prev, sensorId]
    );
  };

  // Get sensors from selected groups
  const getSensorsFromGroups = () => {
    const groupSensorIds = new Set();
    sensorGroups
      .filter(g => batchSelectedGroups.includes(g.id))
      .forEach(g => {
        g.sensors.forEach(s => groupSensorIds.add(s.sensorId));
      });
    return Array.from(groupSensorIds);
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className={`text-3xl md:text-4xl font-bold ${darkMode ? "text-orange-400" : "text-orange-500"}`}>
                Team
              </h1>
              <p className={`text-base mt-1 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                Manage access and permissions
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* Profile dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all duration-200 ${
                    darkMode 
                      ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                      : 'bg-white hover:bg-slate-50 text-slate-800 shadow-md border border-slate-200'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold shadow">
                    {getInitials(username)}
                  </div>
                  <span className={`hidden md:block text-sm ${darkMode ? "text-white" : "text-slate-800"}`}>
                    {username}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showProfileMenu && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-2xl z-50 overflow-hidden ${
                    darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
                  }`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-slate-700 bg-slate-700/50' : 'border-slate-100 bg-slate-50'}`}>
                      <p className={`font-semibold text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>{username}</p>
                      <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{currentUserEmail}</p>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={() => { setShowProfileMenu(false); router.push('/account'); }}
                        className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors ${
                          darkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <User className="w-4 h-4 mr-3" />
                        My Profile
                      </button>
                      <button
                        onClick={() => { setShowProfileMenu(false); router.push('/account#settings'); }}
                        className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors ${
                          darkMode ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Account Settings
                      </button>
                    </div>
                    <div className={`border-t py-2 ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleSignOut();
                        }}
                        className={`w-full flex items-center px-4 py-2.5 text-sm transition-colors text-red-500 hover:bg-red-50 ${
                          darkMode ? 'hover:bg-red-900/20' : ''
                        }`}
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          {/* Sensor Groups Management Section */}
          {ownedSensors.length > 0 && (
            <div className={`rounded-lg shadow p-6 mb-6 ${darkMode ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white shadow-2xl border border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Sensor Groups</h3>
                <button
                  onClick={() => {
                    setEditingGroup(null);
                    setGroupName('');
                    setSelectedSensorsForGroup([]);
                    setShowGroupModal(true);
                  }}
                  className={`px-4 py-2 rounded text-white ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  Create Group
                </button>
              </div>
              
              {sensorGroups.length > 0 ? (
                <div className="space-y-2">
                  {sensorGroups.map(group => (
                    <div key={group.id} className={`flex items-center justify-between p-3 rounded ${darkMode ? 'bg-slate-700' : 'bg-gray-50'}`}>
                      <div>
                        <span className="font-medium">{group.name}</span>
                        <span className={`ml-2 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          ({group.sensors?.length || 0} sensors)
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  No sensor groups yet. Create one to organize your sensors.
                </p>
              )}
            </div>
          )}

          {/* Batch Assignment Section */}
          {ownedSensors.length > 0 && (
            <div className={`rounded-lg shadow p-6 mb-6 ${darkMode ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white shadow-2xl border border-slate-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Batch Assign Access</h3>
                <button
                  onClick={() => {
                    setShowBatchAssignment(!showBatchAssignment);
                    if (!showBatchAssignment) {
                      setBatchSelectAll(false);
                      setBatchSelectedGroups([]);
                      setBatchSelectedSensors([]);
                    }
                  }}
                  className={`px-4 py-2 rounded text-white ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {showBatchAssignment ? 'Hide' : 'Assign Access'}
                </button>
              </div>

              {showBatchAssignment && (
                <div className="space-y-4">
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
                      onClick={handleBatchAssign}
                      className={`px-4 py-2 rounded text-white ${darkMode ? 'bg-orange-700 hover:bg-orange-800' : 'bg-orange-500 hover:bg-orange-600'}`}
                    >
                      Send Invitation
                    </button>
                  </div>

                  <div className={`border rounded p-4 ${darkMode ? 'border-slate-600' : 'border-gray-300'}`}>
                    <div className="space-y-3">
                      {/* Select All */}
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={batchSelectAll}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            console.log('Select All checkbox changed:', isChecked);
                            setBatchSelectAll(isChecked);
                            if (isChecked) {
                              // Clear individual selections when selecting all
                              setBatchSelectedGroups([]);
                              setBatchSelectedSensors([]);
                            }
                          }}
                          className="mr-2 h-4 w-4"
                        />
                        <span className="font-semibold">Select All Sensors ({ownedSensors.length} sensors)</span>
                      </label>

                      {/* Sensor Groups */}
                      {sensorGroups.length > 0 && (
                        <div className="ml-6 space-y-2">
                          <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Sensor Groups:</p>
                          {sensorGroups.map(group => (
                            <label key={group.id} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={batchSelectedGroups.includes(group.id)}
                                onChange={() => handleBatchGroupToggle(group.id)}
                                disabled={batchSelectAll}
                                className="mr-2 h-4 w-4"
                              />
                              <span>{group.name} ({group.sensors?.length || 0} sensors)</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Individual Sensors */}
                      <div className="ml-6 space-y-2">
                        <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Individual Sensors:</p>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {ownedSensors.map(sensor => {
                            const isInSelectedGroup = getSensorsFromGroups().includes(sensor.id);
                            return (
                              <label key={sensor.id} className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={batchSelectedSensors.includes(sensor.id) || batchSelectAll}
                                  onChange={() => handleBatchSensorToggle(sensor.id)}
                                  disabled={batchSelectAll || isInSelectedGroup}
                                  className="mr-2 h-4 w-4"
                                />
                                <span className={isInSelectedGroup ? 'text-gray-400 line-through' : ''}>
                                  {sensor.name}
                                  {isInSelectedGroup && ' (in selected group)'}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
                          if (!inviteEmail || !inviteEmail.trim()) {
                            alert('Please enter an email address.');
                            return;
                          }
                          
                          // Basic email validation
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!emailRegex.test(inviteEmail.trim())) {
                            alert('Please enter a valid email address.');
                            return;
                          }
                          
                          await apiClient.shareSensor({ 
                            sensorId: s.id, 
                            role: inviteRole, 
                            email: inviteEmail.trim().toLowerCase() 
                          });
                          setInviteEmail('');
                          const res = await apiClient.getSensorShares(s.id);
                          setShares(res?.access || []);
                          alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
                        } catch (e) {
                          console.error('Share sensor error:', e);
                          let errorMessage = e?.message || 'Failed to send invitation';
                          
                          if (e.code === 'DATABASE_ERROR') {
                            errorMessage = 'Unable to connect to the server. Please try again later.';
                          } else if (e.code === 'DATABASE_OPERATION_ERROR') {
                            if (e.prismaCode === 'P2002') {
                              errorMessage = 'An invitation already exists for this user.';
                            } else {
                              errorMessage = 'Database operation failed. Please try again.';
                            }
                          } else if (e.message && e.message.includes('already has access')) {
                            errorMessage = 'This user already has access to this sensor.';
                          } else if (e.message && e.message.includes('permission')) {
                            errorMessage = 'You do not have permission to invite users.';
                          }
                          
                          setError(errorMessage);
                          alert(errorMessage);
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`p-4 rounded ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
                <p>This person ({rejectedName}) rejected the invitation.</p>
                <button onClick={closePopup} className={`mt-4 px-4 py-2 rounded hover:bg-red-600 ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Sensor Group Modal */}
          {showGroupModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className={`p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-slate-800 text-white' : 'bg-white text-gray-800'}`}>
                <h3 className="text-xl font-semibold mb-4">
                  {editingGroup ? 'Edit Sensor Group' : 'Create Sensor Group'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Group Name
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g., Floor 1 Sensors, Kitchen Sensors"
                      className={`w-full border rounded px-3 py-2 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Select Sensors
                    </label>
                    <div className={`border rounded p-3 max-h-64 overflow-y-auto ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                      {ownedSensors.length > 0 ? (
                        <div className="space-y-2">
                          {ownedSensors.map(sensor => (
                            <label key={sensor.id} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedSensorsForGroup.includes(sensor.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSensorsForGroup([...selectedSensorsForGroup, sensor.id]);
                                  } else {
                                    setSelectedSensorsForGroup(selectedSensorsForGroup.filter(id => id !== sensor.id));
                                  }
                                }}
                                className="mr-2 h-4 w-4"
                              />
                              <span>{sensor.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          No sensors available. You need to own sensors to create groups.
                        </p>
                      )}
                    </div>
                    {selectedSensorsForGroup.length > 0 && (
                      <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {selectedSensorsForGroup.length} sensor(s) selected
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowGroupModal(false);
                      setGroupName('');
                      setSelectedSensorsForGroup([]);
                      setEditingGroup(null);
                    }}
                    className={`px-4 py-2 rounded ${darkMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    className={`px-4 py-2 rounded text-white ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`}
                  >
                    {editingGroup ? 'Update' : 'Create'}
                  </button>
                </div>
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
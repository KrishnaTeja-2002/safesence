'use client';

import { useState, useEffect, Component } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Access');
  const [showPopup, setShowPopup] = useState(false);
  const [rejectedName, setRejectedName] = useState('');
  const [error, setError] = useState('');
  const [username, setUsername] = useState('User');
  const router = useRouter();
  const searchParams = useSearchParams();

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
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!sessionData.session) {
          console.log('No session found, redirecting to login');
          router.push('/login');
        } else {
          const user = sessionData.session.user;
          const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
          console.log('Session found, user:', displayName);
          setUsername(displayName);
        }
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

  // Fetch team members from Supabase (only accepted members)
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('name, role')
          .eq('status', 'accepted');
        
        if (error) throw error;
        console.log('Fetched team members:', data);
        setMembers(data || []);
      } catch (err) {
        setError('Failed to fetch team members: ' + err.message);
        console.log('Error fetching team members:', err);
        setMembers([
          { name: 'Francis Anino', role: 'Owner' },
          { name: 'Ronald Richards', role: 'Full access' },
          { name: 'Cameron Williamson', role: 'Full access' },
          { name: 'Ariene McCoy', role: 'Full access' },
          { name: 'Jerome Bell', role: 'Full access' },
          { name: 'Dianne Russell', role: 'Full access' },
        ]);
      }
    };
    fetchTeamMembers();
  }, []);

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
          
          // Validate token and check if already processed
          const { data: invitation, error } = await supabase
            .from('team_invitations')
            .select('status, email')
            .eq('token', token)
            .single();
          
          if (error || !invitation) {
            throw new Error(error?.message || 'Invalid token');
          }
          
          if (invitation.status === 'accepted') {
            alert('This invitation has already been accepted.');
            window.history.replaceState({}, document.title, '/team');
            return;
          }
          
          if (invitation.status !== 'pending') {
            throw new Error('Invitation is no longer valid');
          }

          const decodedName = decodeURIComponent(name);
          const decodedRole = decodeURIComponent(role);

          // Check if member already exists in the database
          const { data: existingMember, error: checkError } = await supabase
            .from('team_members')
            .select('name')
            .eq('name', decodedName)
            .eq('status', 'accepted')
            .single();

          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
            throw checkError;
          }

          if (existingMember) {
            console.log('Member already exists:', decodedName);
            alert(`${decodedName} is already a team member.`);
            
            // Update invitation status to accepted since member exists
            await supabase
              .from('team_invitations')
              .update({ status: 'accepted' })
              .eq('token', token);
              
            window.history.replaceState({}, document.title, '/team');
            return;
          }

          // Add member to database first
          const { error: insertError } = await supabase
            .from('team_members')
            .insert([{ name: decodedName, role: decodedRole, status: 'accepted' }]);
          
          if (insertError) {
            // Check if it's a duplicate key error
            if (insertError.code === '23505') {
              console.log('Member already exists in database:', decodedName);
              alert(`${decodedName} is already a team member.`);
            } else {
              throw insertError;
            }
          } else {
            console.log('New member added to database:', decodedName);
            // Only add to UI state if database insert was successful
            const newMember = { name: decodedName, role: decodedRole };
            setMembers(prevMembers => {
              // Double-check for duplicates in state
              const memberExists = prevMembers.some(member => member.name === newMember.name);
              if (memberExists) {
                return prevMembers;
              }
              return [...prevMembers, newMember];
            });
            alert(`${decodedName} has been successfully added to the team!`);
          }

          // Update invitation status to accepted
          const { error: updateError } = await supabase
            .from('team_invitations')
            .update({ status: 'accepted' })
            .eq('token', token);

          if (updateError) {
            console.error('Failed to update invitation status:', updateError);
          }

          window.history.replaceState({}, document.title, '/team');
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
          const { data: invitation, error } = await supabase
            .from('team_invitations')
            .select('status')
            .eq('token', token)
            .single();
          
          if (error || !invitation) {
            throw new Error(error?.message || 'Invalid token');
          }
          
          if (invitation.status === 'rejected') {
            alert('This invitation has already been rejected.');
            window.history.replaceState({}, document.title, '/team');
            return;
          }
          
          if (invitation.status !== 'pending') {
            throw new Error('Invitation is no longer valid');
          }

          // Update invitation status to rejected
          const { error: updateError } = await supabase
            .from('team_invitations')
            .update({ status: 'rejected' })
            .eq('token', token);

          if (updateError) {
            throw updateError;
          }

          setRejectedName(decodeURIComponent(name));
          setShowPopup(true);
          window.history.replaceState({}, document.title, '/team');
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
      // Check if user is already a team member
      const { data: existingMember, error: checkError } = await supabase
        .from('team_members')
        .select('name')
        .eq('name', inviteEmail.split('@')[0])
        .eq('status', 'accepted')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingMember) {
        alert(`${inviteEmail} is already a team member.`);
        return;
      }

      // Check for pending invitations
      const { data: pendingInvite, error: pendingError } = await supabase
        .from('team_invitations')
        .select('token')
        .eq('email', inviteEmail)
        .eq('status', 'pending')
        .single();

      if (pendingError && pendingError.code !== 'PGRST116') {
        throw pendingError;
      }

      if (pendingInvite) {
        alert(`There's already a pending invitation for ${inviteEmail}.`);
        return;
      }

      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const inviteLink = `http://localhost:3000/api/sendInvite?token=${token}`;

      console.log('Sending invite:', { email: inviteEmail, role: inviteRole, token });

      const { error } = await supabase
        .from('team_invitations')
        .insert([{
          token,
          email: inviteEmail,
          role: inviteRole,
          status: 'pending',
          invite_link: inviteLink
        }]);

      if (error) throw error;

      const response = await fetch('/api/sendInvite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, token })
      });
      
      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        if (response.ok) {
          console.log('Invite sent successfully to:', inviteEmail);
          alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
          setInviteEmail('');
          return;
        } else {
          throw new Error('Server returned invalid response');
        }
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
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
            <h2 className="text-3xl font-bold">Team</h2>
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
                <div key={`${member.name}-${idx}`} className={`flex justify-between items-center py-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-amber-700' : 'bg-amber-600'} mr-3 flex items-center justify-center text-white text-sm font-bold`}>
                      {getInitials(member.name)}
                    </div>
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
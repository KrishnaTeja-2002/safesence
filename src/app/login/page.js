'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter for navigation

export default function Home() {
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reenterPassword, setReenterPassword] = useState('');
  const [error, setError] = useState('');

  // Signup state
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupReenterPassword, setSignupReenterPassword] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupRePassword, setShowSignupRePassword] = useState(false);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const router = useRouter(); // Initialize router

  // Redirect logged-in users
  useEffect(() => {
    const user = localStorage.getItem('loggedInUser');
    if (user) {
      router.push('/dashboard'); // Use router.push instead of window.location.href
    }
  }, [router]);

  // Google Sign-In
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your actual Google Client ID
          callback: handleCredentialResponse,
        });
      }
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handleCredentialResponse = (response) => {
    const idToken = response.credential;
    console.log('Google ID Token:', idToken);
    // Send this token to your backend to verify and log in
  };

  const handleGoogleSignIn = () => {
    if (window.google) window.google.accounts.id.prompt();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      setLoginMessage(data.message || 'Logged in successfully!');
      if (res.ok) {
        localStorage.setItem('loggedInUser', data.username); // Store username from server response
        setLoginUsername('');
        setLoginPassword('');
        router.push('/dashboard'); // Use router.push for navigation
      } else {
        setLoginMessage(data.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginMessage('Something went wrong. Please try again.');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (signupPassword !== signupReenterPassword) {
      setSignupMessage('Passwords do not match!');
      return;
    }
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          email: signupEmail,
          password: signupPassword,
        }),
      });
      const data = await res.json();
      setSignupMessage(data.message || 'Account created successfully!');
      if (res.ok) {
        localStorage.setItem('loggedInUser', signupUsername); // Store username
        setSignupUsername('');
        setSignupEmail('');
        setSignupPassword('');
        setSignupReenterPassword('');
        router.push('/dashboard'); // Use router.push for navigation
      }
    } catch (err) {
      console.error('Signup error:', err);
      setSignupMessage('Something went wrong. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
    setError('');
  };

  const handleResetEmailSubmit = (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setError('Please enter a valid email.');
      return;
    }
    setError('');
    alert('A password reset link has been sent to ' + resetEmail);
    setShowForgotPassword(false);
  };

  const handleResetPasswordSubmit = (e) => {
    e.preventDefault();
    if (newPassword && reenterPassword && newPassword === reenterPassword) {
      alert('Password has been reset successfully.');
      setNewPassword('');
      setReenterPassword('');
      setShowForgotPassword(false);
    } else {
      setError('Passwords do not match or are empty.');
    }
  };

  return (
    <main style={styles.main}>
      <div style={styles.contentWrapper}>
        {/* Left side */}
        <div style={styles.welcomeText}>
          <div style={styles.logo}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.logoImage}>
              <rect width="32" height="32" rx="8" fill="#F97316" />
              <circle cx="16" cy="16" r="10" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
            <span style={styles.logoText}>Safe Sense</span>
          </div>
          {!isSignup ? (
            <>
              <p style={styles.subtitleBold}>Welcome back to Safe Sense</p>
              <p style={styles.subtitle}>Stay connected. Stay protected.</p>
            </>
          ) : (
            <>
              <p style={styles.subtitleBold}>Create An Account to Start your Journey</p>
              <p style={styles.subtitle}>with Safe Sense</p>
            </>
          )}
        </div>

        {/* Right side: Card */}
        <div style={styles.card}>
          {!isSignup ? (
            <>
              <form onSubmit={handleLogin}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  style={styles.input}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
                <label style={styles.label}>Password</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Password"
                    style={styles.input}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <span style={styles.eyeIcon} onClick={() => setShowLoginPassword(!showLoginPassword)}>
                    {showLoginPassword ? '🙈' : '👁️'}
                  </span>
                </div>
                <a href="#forgot" onClick={handleForgotPassword} style={styles.linkRight}>
                  Forgot Password?
                </a>
                <button style={styles.loginBtn} type="submit">
                  Log in
                </button>
              </form>
              {loginMessage && <p>{loginMessage}</p>}
              <div style={styles.or}>or</div>
              <button style={styles.googleBtn} onClick={handleGoogleSignIn}>
                Sign-in with Google
              </button>
              <div style={styles.links}>
                <a href="#signup" onClick={() => setIsSignup(true)} style={styles.link}>
                  Not a Member? Sign-up
                </a>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleSignup}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  style={styles.input}
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                />
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  style={styles.input}
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
                <label style={styles.label}>Password</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="Password"
                    style={styles.input}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                  />
                  <span style={styles.eyeIcon} onClick={() => setShowSignupPassword(!showSignupPassword)}>
                    {showSignupPassword ? '🙈' : '👁️'}
                  </span>
                </div>
                <label style={styles.label}>Re-enter Password</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showSignupRePassword ? 'text' : 'password'}
                    placeholder="Re-enter Password"
                    style={styles.input}
                    value={signupReenterPassword}
                    onChange={(e) => setSignupReenterPassword(e.target.value)}
                  />
                  <span style={styles.eyeIcon} onClick={() => setShowSignupRePassword(!showSignupRePassword)}>
                    {showSignupRePassword ? '🙈' : '👁️'}
                  </span>
                </div>
                <button style={styles.loginBtn} type="submit">
                  Create Account
                </button>
              </form>
              {signupMessage && <p>{signupMessage}</p>}
              <div style={styles.or}>or</div>
              <button style={styles.googleBtn} onClick={handleGoogleSignIn}>
                Sign-in with Google
              </button>
              <div style={styles.links}>
                <a href="#login" onClick={() => setIsSignup(false)} style={styles.link}>
                  Already a member? Sign-in
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Reset Password</h2>
            {!newPassword && !reenterPassword ? (
              <form onSubmit={handleResetEmailSubmit} style={styles.form}>
                <label style={styles.label}>Enter your email</label>
                <input
                  type="email"
                  placeholder="Email"
                  style={styles.input}
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                {error && <p style={styles.error}>{error}</p>}
                <button type="submit" style={styles.loginBtn}>
                  Send Reset Link
                </button>
                <button type="button" style={styles.closeBtn} onClick={() => setShowForgotPassword(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} style={styles.form}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  placeholder="New Password"
                  style={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <label style={styles.label}>Re-enter Password</label>
                <input
                  type="password"
                  placeholder="Re-enter Password"
                  style={styles.input}
                  value={reenterPassword}
                  onChange={(e) => setReenterPassword(e.target.value)}
                />
                {error && <p style={styles.error}>{error}</p>}
                <button type="submit" style={styles.loginBtn}>
                  Reset Password
                </button>
                <button type="button" style={styles.closeBtn} onClick={() => setShowForgotPassword(false)}>
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Styles (unchanged)
const styles = {
  main: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial' },
  contentWrapper: { display: 'flex', width: '80%', maxWidth: '1000px', boxShadow: '0 0 15px rgba(0,0,0,0.1)' },
  welcomeText: { flex: 1, backgroundColor: '#F3F4F6', padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  card: { flex: 1, backgroundColor: '#fff', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  logo: { display: 'flex', alignItems: 'center', marginBottom: '1rem' },
  logoImage: { marginRight: '0.5rem' },
  logoText: { fontSize: '1.5rem', fontWeight: 'bold' },
  subtitleBold: { fontSize: '1.25rem', fontWeight: 'bold' },
  subtitle: { fontSize: '1rem', color: '#6B7280' },
  label: { marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 'bold' },
  input: { width: '100%', padding: '0.5rem', marginBottom: '0.5rem', border: '1px solid #D1D5DB', borderRadius: '0.25rem' },
  loginBtn: { width: '100%', padding: '0.5rem', backgroundColor: '#F97316', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' },
  googleBtn: { width: '100%', padding: '0.5rem', backgroundColor: '#4285F4', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' },
  link: { color: '#F97316', textDecoration: 'none', cursor: 'pointer' },
  linkRight: { color: '#F97316', textDecoration: 'none', cursor: 'pointer', display: 'block', textAlign: 'right', marginBottom: '1rem' },
  links: { marginTop: '1rem', textAlign: 'center' },
  or: { textAlign: 'center', margin: '1rem 0', color: '#6B7280' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: '2rem', borderRadius: '0.5rem', width: '400px' },
  modalTitle: { fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' },
  form: { display: 'flex', flexDirection: 'column' },
  error: { color: 'red', marginBottom: '0.5rem' },
  closeBtn: { width: '100%', padding: '0.5rem', backgroundColor: '#6B7280', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' },
  passwordWrapper: { position: 'relative' },
  eyeIcon: { position: 'absolute', right: '0.5rem', top: '0.5rem', cursor: 'pointer' },
};
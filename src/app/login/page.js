'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Custom authentication - no longer using Supabase
console.log('Google Client ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

// Authentication helper functions
const checkAuth = async () => {
  try {
    const token = localStorage.getItem('auth-token');
    if (!token) return null;
    
    const response = await fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
    return null;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
};

export default function Home() {
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');

  // Signup state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupReenterPassword, setSignupReenterPassword] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupRePassword, setShowSignupRePassword] = useState(false);
  const [isSignupLoading, setIsSignupLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const router = useRouter();

  // Prevent scrolling issues on login page
  useEffect(() => {
    // Prevent body scroll and fix viewport
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // Redirect logged-in users
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking session...');
        const user = await checkAuth();
        if (user) {
          console.log('Session found, redirecting to dashboard');
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Session check error:', err.message);
        setError(
          err.message === 'Failed to fetch'
            ? 'Unable to connect to authentication server. Please check your network or contact support.'
            : 'Failed to verify session: ' + err.message
        );
      }
    };
    checkSession();
  }, [router]);

  // Google Sign-In
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      console.warn('Google Client ID is missing. Google Sign-In will not work.');
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        console.log('Google Sign-In script loaded');
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
      } else {
        console.error('Google Sign-In script loaded but window.google is undefined');
      }
    };
    script.onerror = () => console.error('Failed to load Google Sign-In script');
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handleCredentialResponse = (response) => {
    const idToken = response.credential;
    console.log('Google ID Token:', idToken);
  };

  const handleGoogleSignIn = async () => {
    setError('Google Sign-In is not configured with the new auth.');
  };

  // Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Prevent double clicks
    if (isSignupLoading) {
      return;
    }
    
    setSignupMessage('');
    setError('');
    setIsSignupLoading(true);

    if (!signupEmail || !signupPassword) {
      setSignupMessage('Email and password are required');
      setIsSignupLoading(false);
      return;
    }
    if (signupPassword !== signupReenterPassword) {
      setSignupMessage('Passwords do not match');
      setIsSignupLoading(false);
      return;
    }
    if (signupPassword.length < 6) {
      setSignupMessage('Password must be at least 6 characters');
      setIsSignupLoading(false);
      return;
    }

    try {
      console.log('Attempting signup:', { email: signupEmail });
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          username: signupEmail.split('@')[0]
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }
      
      console.log('Signup successful:', data);
      
      // Show verification challenge number (if provided)
      if (typeof data.challengeCorrect !== 'undefined' && data.challengeCorrect !== null) {
        setSignupMessage(`Account created! Open your email and tap ${data.challengeCorrect} to verify.`);
      } else {
        setSignupMessage('Account created! Check your email to verify your account.');
      }
      
      // If backend also returns a token, you can optionally log user in
      if (data.token) {
        localStorage.setItem('auth-token', data.token);
      }
    } catch (error) {
      console.error('Signup error:', error.message);
      setSignupMessage(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to authentication server. Please check your network or contact support.'
          : error.message.includes('already exists') || error.message.includes('User already')
          ? 'An account with this email already exists. Please try logging in instead.'
          : 'Signup failed: ' + error.message
      );
    } finally {
      setIsSignupLoading(false);
    }
  };

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginMessage('');
    setError('');

    if (!loginEmail || !loginPassword) {
      setLoginMessage('Email and password are required');
      return;
    }

    try {
      console.log('Attempting login:', { email: loginEmail });
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      console.log('Login successful:', data);
      
      // Store token and redirect
      if (data.token) {
        localStorage.setItem('auth-token', data.token);
        setLoginMessage('Logged in successfully! Redirecting...');
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setLoginMessage('Login successful! Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error.message);
      
      // Check if error is about email verification
      const isVerificationError = error.message.includes('verify your email') || 
                                 error.message.includes('email before logging in');
      
      if (isVerificationError) {
        setShowResendOption(true);
      } else {
        setShowResendOption(false);
      }
      
      setLoginMessage(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to authentication server. Please check your network or contact support.'
          : error.message.includes('Invalid') || error.message.includes('credentials')
          ? 'Invalid email or password. Please try again.'
          : 'Login failed: ' + error.message
      );
    }
  };

  // Resend Verification Email
  const handleResendVerification = async () => {
    if (!loginEmail) {
      setLoginMessage('Please enter your email address first');
      return;
    }
    
    setIsResending(true);
    setLoginMessage('');
    
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend verification email');
      }
      
      setLoginMessage('Verification email sent! Please check your inbox.');
      setShowResendOption(false);
    } catch (error) {
      console.error('Resend verification error:', error.message);
      setLoginMessage('Failed to resend verification email: ' + error.message);
    } finally {
      setIsResending(false);
    }
  };

  // Forgot Password
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!resetEmail) {
      setError('Please enter your email');
      return;
    }

    try {
      console.log('Sending password reset:', resetEmail);
      // Password reset functionality disabled - using new auth system
      // In a real implementation, you would call your own password reset API
      setError('');
      alert('Password reset functionality is not available. Please contact an administrator.');
      setShowForgotPassword(false);
    } catch (error) {
      console.error('Password reset error:', error.message);
      setError(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to authentication server. Please check your network or contact support.'
          : 'Failed to send reset link: ' + error.message
      );
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
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  style={styles.input}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
                <label style={styles.label}>Password</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Password"
                    style={styles.input}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <span style={styles.eyeIcon} onClick={() => setShowLoginPassword(!showLoginPassword)}>
                    {showLoginPassword ? '🙈' : '👁️'}
                  </span>
                </div>
                <a href="#forgot" onClick={() => setShowForgotPassword(true)} style={styles.linkRight}>
                  Forgot Password?
                </a>
                <button style={styles.loginBtn} type="submit">
                  Log in
                </button>
              </form>
              {loginMessage && <p style={styles.message}>{loginMessage}</p>}
              {error && <p style={styles.error}>{error}</p>}
              {showResendOption && (
                <div style={styles.resendContainer}>
                  <button 
                    style={{
                      ...styles.resendBtn,
                      ...(isResending ? styles.resendBtnDisabled : {})
                    }}
                    onClick={handleResendVerification}
                    disabled={isResending}
                  >
                    {isResending ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                </div>
              )}
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
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  style={styles.input}
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
                <label style={styles.label}>Password</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    placeholder="Password"
                    style={styles.input}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
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
                    required
                  />
                  <span style={styles.eyeIcon} onClick={() => setShowSignupRePassword(!showSignupRePassword)}>
                    {showSignupRePassword ? '🙈' : '👁️'}
                  </span>
                </div>
                <button 
                  style={{
                    ...styles.loginBtn,
                    ...(isSignupLoading ? styles.loginBtnDisabled : {})
                  }} 
                  type="submit"
                  disabled={isSignupLoading}
                >
                  {isSignupLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
              {signupMessage && <p style={styles.message}>{signupMessage}</p>}
              {error && <p style={styles.error}>{error}</p>}
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
            <form onSubmit={handleForgotPassword} style={styles.form}>
              <label style={styles.label}>Enter your email</label>
              <input
                type="email"
                placeholder="Email"
                style={styles.input}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              {error && <p style={styles.error}>{error}</p>}
              <button type="submit" style={styles.loginBtn}>
                Send Reset Link
              </button>
              <button type="button" style={styles.closeBtn} onClick={() => setShowForgotPassword(false)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
      <footer style={styles.footer}>© 2025 Safe Sense. All rights reserved.</footer>
    </main>
  );
}

const styles = {
  main: { 
    display: 'flex', 
    flexDirection: 'column', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh', 
    width: '100vw',
    fontFamily: 'Arial',
    overflow: 'hidden',
    position: 'fixed',
    top: 0,
    left: 0
  },
  contentWrapper: { 
    display: 'flex', 
    width: '80%', 
    maxWidth: '1000px', 
    boxShadow: '0 0 15px rgba(0,0,0,0.1)',
    overflow: 'auto',
    maxHeight: '90vh'
  },
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
  loginBtnDisabled: { backgroundColor: '#9CA3AF', cursor: 'not-allowed', opacity: 0.6 },
  resendContainer: { marginTop: '0.5rem', textAlign: 'center' },
  resendBtn: { padding: '0.5rem 1rem', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.875rem' },
  resendBtnDisabled: { backgroundColor: '#9CA3AF', cursor: 'not-allowed', opacity: 0.6 },
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
  message: { color: '#F97316', marginBottom: '0.5rem' },
  closeBtn: { width: '100%', padding: '0.5rem', backgroundColor: '#6B7280', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' },
  passwordWrapper: { position: 'relative' },
  eyeIcon: { position: 'absolute', right: '0.5rem', top: '0.5rem', cursor: 'pointer' },
  footer: { textAlign: 'center', marginTop: '1rem', color: '#6B7280' },
};
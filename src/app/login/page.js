'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co'; // Use the working project URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

// Log configuration for debugging
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey);
console.log('Google Client ID:', process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

// Initialize Supabase client
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized');
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

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

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const router = useRouter();

  // Redirect logged-in users
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking session...');
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
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
    try {
      console.log('Initiating Google OAuth...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirect_to: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      console.log('Google OAuth initiated:', data);
    } catch (error) {
      console.error('Google Sign-In error:', error.message);
      setError(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to authentication server. Please check your network or contact support.'
          : 'Failed to sign in with Google: ' + error.message
      );
    }
  };

  // Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupMessage('');
    setError('');

    if (!signupEmail || !signupPassword) {
      setSignupMessage('Email and password are required');
      return;
    }
    if (signupPassword !== signupReenterPassword) {
      setSignupMessage('Passwords do not match');
      return;
    }
    if (signupPassword.length < 6) {
      setSignupMessage('Password must be at least 6 characters');
      return;
    }

    try {
      console.log('Attempting signup:', { email: signupEmail });
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      console.log('Signup successful:', data);
      setSignupMessage('Account created successfully! Check your email to confirm.');
      router.push('/dashboard');
    } catch (error) {
      console.error('Signup error:', error.message);
      setSignupMessage(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to authentication server. Please check your network or contact support.'
          : 'Signup failed: ' + error.message
      );
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      console.log('Login successful:', data);
      setLoginMessage('Logged in successfully!');
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error.message);
      setLoginMessage(
        error.message === 'Failed to fetch'
          ? 'Unable to connect to authentication server. Please check your network or contact support.'
          : error.message.includes('Invalid login credentials')
          ? 'Invalid email or password. Please try again.'
          : 'Login failed: ' + error.message
      );
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
      const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      console.log('Password reset email sent:', data);
      setError('');
      alert('Password reset link sent! Check your email.');
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
                <button style={styles.loginBtn} type="submit">
                  Create Account
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
  main: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Arial' },
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
  message: { color: '#F97316', marginBottom: '0.5rem' },
  closeBtn: { width: '100%', padding: '0.5rem', backgroundColor: '#6B7280', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', marginTop: '0.5rem' },
  passwordWrapper: { position: 'relative' },
  eyeIcon: { position: 'absolute', right: '0.5rem', top: '0.5rem', cursor: 'pointer' },
  footer: { textAlign: 'center', marginTop: '1rem', color: '#6B7280' },
};
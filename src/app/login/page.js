"use client";

import React, { useState, useEffect } from 'react';

export default function Home() {
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reenterPassword, setReenterPassword] = useState('');
  const [error, setError] = useState('');

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

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleCredentialResponse = (response) => {
    const idToken = response.credential;
    console.log('Google ID Token:', idToken);
    // Send to backend for verification
  };

  const handleGoogleSignIn = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    } else {
      console.log('Google script not loaded yet');
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
    console.log('Sending reset email to:', resetEmail);
    setShowForgotPassword(false); // Close modal after submission
    alert('A password reset link has been sent to ' + resetEmail + '. Please check your inbox.');
  };

  const handleResetPasswordSubmit = (e) => {
    e.preventDefault();
    if (newPassword && reenterPassword && newPassword === reenterPassword) {
      console.log('New Password:', newPassword, 'for email:', resetEmail);
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
        <div style={styles.card}>
          {!isSignup ? (
            <>
              <label style={styles.label}>Email</label>
              <input type="email" placeholder="Email" style={styles.input} />
              <label style={styles.label}>Password</label>
              <input type="password" placeholder="Password" style={styles.input} />
              <a href="#forgot" onClick={handleForgotPassword} style={{ ...styles.link, textAlign: "right", display: "block", marginBottom: "1rem" }}>
                Forgot Password?
              </a>
              <button style={styles.loginBtn}>Log in</button>
              <div style={styles.or}>or</div>
              <button style={styles.googleBtn} onClick={handleGoogleSignIn}>Sign-in with Google</button>
              <div style={styles.links}>
                <a href="#signup" onClick={() => setIsSignup(true)} style={styles.link}>
                  Not a Member? Sign-up
                </a>
              </div>
            </>
          ) : (
            <>
              <label style={styles.label}>First Name</label>
              <input type="text" placeholder="First Name" style={styles.input} />
              <label style={styles.label}>Last Name</label>
              <input type="text" placeholder="Last Name" style={styles.input} />
              <label style={styles.label}>Email</label>
              <input type="email" placeholder="Email" style={styles.input} />
              <label style={styles.label}>Password</label>
              <input type="password" placeholder="Password" style={styles.input} />
              <button style={styles.loginBtn}>Create Account</button>
              <div style={styles.or}>or</div>
              <button style={styles.googleBtn} onClick={handleGoogleSignIn}>Sign-in with Google</button>
              <div style={styles.links}>
                <a href="#login" onClick={() => setIsSignup(false)} style={styles.link}>
                  Already a member? Sign-in
                </a>
              </div>
            </>
          )}
        </div>
      </div>
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
                <button type="submit" style={styles.loginBtn}>Send Reset Link</button>
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
                <button type="submit" style={styles.loginBtn}>Reset Password</button>
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

const styles = {
  main: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundColor: "#ffffff",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23FEE2E2' fill-opacity='0.5' d='M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,85.3C672,75,768,85,864,106.7C960,128,1056,160,1152,170.7C1248,181,1344,171,1392,165.3L1440,160V320H0Z'/%3E%3C/svg%3E")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    position: "relative",
  },
  contentWrapper: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "4rem",
    width: "100%",
    maxWidth: "800px",
    padding: "1rem",
  },
  welcomeText: {
    textAlign: "left",
    maxWidth: "300px",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    padding: "1.5rem",
    backgroundColor: "#D1D5DB",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    textAlign: "left",
  },
  logo: {
    fontSize: "1.4rem",
    color: "#F97316",
    marginBottom: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  logoImage: {
    marginRight: "0.4rem",
  },
  logoText: {
    color: "#F97316",
    fontWeight: "500",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  subtitleBold: {
    textAlign: "left",
    marginBottom: "1rem",
    color: "#1F2937",
    fontSize: "0.85rem",
    lineHeight: "1.2",
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "left",
    marginBottom: "1rem",
    color: "#1F2937",
    fontSize: "0.85rem",
    lineHeight: "1.2",
  },
  label: {
    display: "block",
    marginBottom: "0.5rem",
    color: "#4B5563",
    fontSize: "0.85rem",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    padding: "0.7rem",
    marginBottom: "0.7rem",
    borderRadius: "6px",
    border: "1px solid #9CA3AF",
    fontSize: "0.95rem",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    textAlign: "left",
    color: "#4B5563",
  },
  loginBtn: {
    width: "100%",
    padding: "0.7rem",
    backgroundColor: "#F97316",
    color: "#ffffff",
    fontWeight: "600",
    border: "none",
    borderRadius: "9999px",
    marginBottom: "0.5rem",
    cursor: "pointer",
    fontSize: "0.95rem",
    textTransform: "none",
  },
  or: {
    textAlign: "center",
    margin: "0.5rem 0",
    color: "#4B5563",
    fontSize: "0.75rem",
    textTransform: "lowercase",
    opacity: "0.8",
  },
  googleBtn: {
    width: "100%",
    padding: "0.7rem",
    backgroundColor: "#ffffff",
    color: "#10B981",
    fontWeight: "600",
    border: "1px solid #10B981",
    borderRadius: "9999px",
    marginBottom: "1rem",
    cursor: "pointer",
    fontSize: "0.95rem",
    textTransform: "none",
  },
  links: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    fontSize: "0.75rem",
    color: "#4B5563",
    textAlign: "center",
  },
  link: {
    color: "#1E40AF",
    textDecoration: "none",
    fontWeight: "500",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    padding: "1.5rem",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "400px",
    textAlign: "center",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: "1.2rem",
    color: "#1F2937",
    marginBottom: "1rem",
    fontWeight: "600",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  closeBtn: {
    width: "100%",
    padding: "0.7rem",
    backgroundColor: "#D1D5DB",
    color: "#1F2937",
    fontWeight: "600",
    border: "none",
    borderRadius: "9999px",
    cursor: "pointer",
    fontSize: "0.95rem",
    textTransform: "none",
  },
  error: {
    color: "#EF4444",
    fontSize: "0.8rem",
    textAlign: "left",
    marginTop: "-0.5rem",
    marginBottom: "0.5rem",
  },
};
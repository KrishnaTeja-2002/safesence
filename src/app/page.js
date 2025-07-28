"use client";

import React, { useState } from 'react';

export default function Home() {
  const [isSignup, setIsSignup] = useState(false);

  return (
    <main style={styles.main}>
      {!isSignup ? (
        <div style={styles.card}>
          <div style={styles.logo}>🛜 <span style={styles.logoText}>Safe Sense</span></div>
          <p style={styles.subtitle}>Welcome back to Safe Sense</p>
          <p style={styles.subtitle}>Stay connected. Stay protected.</p>

          <input type="email" placeholder="Email" style={styles.input} />
          <input type="password" placeholder="Password" style={styles.input} />

          <button style={styles.loginBtn}>Log in</button>
          <div style={styles.or}>or</div>
          <button style={styles.googleBtn}>Sign-in with Google</button>

          <div style={styles.links}>
            <a href="#signup" onClick={() => setIsSignup(true)} style={styles.link}>
              Not a Member? Sign-up
            </a>
            <a href="#" style={styles.link}>
              Forgot Password?
            </a>
          </div>
        </div>
      ) : (
        <div style={styles.card}>
          <div style={styles.logo}>🛜 <span style={styles.logoText}>Safe Sense</span></div>
          <p style={styles.subtitle}>Create An Account to Start your Journey</p>
          <p style={styles.subtitle}>with Safe Sense</p>

          <input type="text" placeholder="First Name" style={styles.input} />
          <input type="text" placeholder="Last Name" style={styles.input} />
          <input type="email" placeholder="Email" style={styles.input} />
          <input type="password" placeholder="Password" style={styles.input} />

          <button style={styles.loginBtn}>Create Account</button>
          <div style={styles.or}>or</div>
          <button style={styles.googleBtn}>Sign-in with Google</button>

          <div style={styles.links}>
            <a href="#login" onClick={() => setIsSignup(false)} style={styles.link}>
              Already a member? Sign-in
            </a>
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
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23e0e7ff' fill-opacity='0.5' d='M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,85.3C672,75,768,85,864,106.7C960,128,1056,160,1152,170.7C1248,181,1344,171,1392,165.3L1440,160V320H0Z'/%3E%3C/svg%3E")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    padding: "1.5rem",
    backgroundColor: "#d1d5db",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    position: "relative",
    background: "linear-gradient(135deg, #d1d5db 0%, #e5e7eb 100%)",
    overflow: "hidden",
  },
  logo: {
    fontSize: "1.4rem",
    color: "#f97316",
    marginBottom: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    marginLeft: "0.4rem",
    color: "#f97316",
    fontWeight: "500",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: "1rem",
    color: "#1f2937",
    fontSize: "0.85rem",
    lineHeight: "1.2",
  },
  input: {
    width: "100%",
    padding: "0.7rem",
    marginBottom: "0.7rem",
    borderRadius: "6px",
    border: "1px solid #9ca3af",
    fontSize: "0.95rem",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    textAlign: "left",
    color: "#4b5563",
  },
  loginBtn: {
    width: "100%",
    padding: "0.7rem",
    backgroundColor: "#f97316",
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
    color: "#4b5563",
    fontSize: "0.75rem",
    textTransform: "lowercase",
    opacity: "0.8",
  },
  googleBtn: {
    width: "100%",
    padding: "0.7rem",
    backgroundColor: "#ffffff",
    color: "#10b981",
    fontWeight: "600",
    border: "1px solid #10b981",
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
    color: "#4b5563",
  },
  link: {
    color: "#1e40af",
    textDecoration: "none",
    fontWeight: "500",
  },
};
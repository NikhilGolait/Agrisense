// src/components/Login.js
import React, { useState } from "react";
import axios from "axios";
import ResetPassword from "./ResetPassword";
import "./Auth.css";

export default function Login({ onSignupClick, onLoginSuccess }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      setLoading(true);
      const res = await axios.post("https://agrisense-17.onrender.com/api/login", { phone, password });
      if (res.data.success) {
        setMessage("✅ Login successful");
        const user = res.data.user;
        onLoginSuccess && onLoginSuccess(user);
      } else {
        setMessage(res.data.error || "Login failed");
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "Server error during login");
    } finally {
      setLoading(false);
    }
  };

  if (showResetPassword) {
    return <ResetPassword onBackClick={() => setShowResetPassword(false)} />;
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="brand-title">🌾 AgriSense</h1>
        <p className="brand-subtitle">Smart Farming | Live Climate Insights</p>

        <h2 className="auth-heading">Login</h2>
        {message && <p className="auth-message">{message}</p>}

        <form onSubmit={handleLogin} className="auth-form">
          <input type="tel" placeholder="Mobile number" value={phone} onChange={(e)=>setPhone(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          <button type="submit" className="auth-btn" disabled={loading}>{loading?"Checking...":"Login"}</button>
        </form>

        <p className="auth-switch">
          <span onClick={() => setShowResetPassword(true)} className="auth-link">
            🔑 Reset Password
          </span>
        </p>

        <p className="auth-switch">Don't have an account? <span onClick={onSignupClick} className="auth-link">Sign Up</span></p>
      </div>
    </div>
  );
}

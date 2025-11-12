// src/components/Signup.js
import React, { useState } from "react";
import axios from "axios";
import "./Auth.css";

export default function Signup({ onLoginClick }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!name.trim() || !/^[6-9]\d{9}$/.test(phone) || password.length < 4) {
      setMessage("Please enter valid name, 10-digit phone and password (min 4 chars)");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("https://agrisense-17.onrender.com/api/signup", {
        name,
        phone,
        password,
      });
      if (res.data.success) {
        setMessage("✅ Signup successful — please login.");
        setTimeout(() => onLoginClick && onLoginClick(), 900);
      } else {
        setMessage(res.data.error || "Signup failed");
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "Server error during signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="brand-title">🌾 AgriSense</h1>
        <p className="brand-subtitle">Smart Farming | Live Climate Insights</p>

        <h2 className="auth-heading">Sign Up</h2>
        {message && <p className="auth-message">{message}</p>}

        <form onSubmit={handleSignup} className="auth-form">
          <input type="text" placeholder="Full name" value={name} onChange={(e)=>setName(e.target.value)} required />
          <input type="tel" placeholder="Mobile number" value={phone} onChange={(e)=>setPhone(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          <button type="submit" className="auth-btn" disabled={loading}>{loading?"Creating...":"Sign up"}</button>
        </form>

        <p className="auth-switch">Already have an account? <span onClick={onLoginClick} className="auth-link">Login</span></p>
      </div>
    </div>
  );
}

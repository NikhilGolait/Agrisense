import React, { useState } from "react";
import axios from "axios";
import "./Auth.css";

export default function ResetPassword({ onBackClick }) {
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone)) {
      setMessage("Please enter a valid 10-digit phone number");
      return;
    }

    if (!newPassword.trim() || newPassword.length < 4) {
      setMessage("Password must be at least 4 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("https://agrisense-17.onrender.com/api/reset-password", {
        phone,
        newPassword,
      });
      if (res.data.success) {
        setMessage("✅ Password reset successfully! Redirecting to login...");
        setTimeout(() => onBackClick && onBackClick(), 1200);
      } else {
        setMessage(res.data.error || "Password reset failed");
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "Server error during password reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1 className="brand-title">🌾 AgriSense</h1>
        <p className="brand-subtitle">Smart Farming | Live Climate Insights</p>

        <h2 className="auth-heading">Reset Password</h2>
        {message && <p className="auth-message">{message}</p>}

        <form onSubmit={handleResetPassword} className="auth-form">
          <input
            type="tel"
            placeholder="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p className="auth-switch">
          <span onClick={onBackClick} className="auth-link">
            ← Back to Login
          </span>
        </p>
      </div>
    </div>
  );
}

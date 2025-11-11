// routes/auth.js
import express from "express";
import User from "../models/User.js";
import twilio from "twilio";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Twilio config
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// ✅ Normalize phone
function normalizePhone(phone) {
  if (!phone) return null;
  const clean = phone.replace(/[^\d]/g, "").slice(-10); // only 10 digits
  if (!/^[6-9]\d{9}$/.test(clean)) return null;
  return { sendToTwilio: "+91" + clean, storeInDb: clean };
}

// ✅ Send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;
    const norm = normalizePhone(phone);
    if (!norm) return res.status(400).json({ success: false, error: "Invalid phone number" });

    await client.verify.v2.services(verifyServiceSid).verifications.create({
      to: norm.sendToTwilio,
      channel: "sms",
    });

    res.json({ success: true, message: "OTP sent successfully!" });
  } catch (err) {
    console.error("❌ OTP Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to send OTP" });
  }
});

// ✅ Verify OTP & Signup
router.post("/verify-otp", async (req, res) => {
  try {
    const { name, phone, email, password, code } = req.body;

    if (!name || !phone || !email || !password || !code)
      return res.status(400).json({ success: false, error: "All fields required" });

    const norm = normalizePhone(phone);
    if (!norm) return res.status(400).json({ success: false, error: "Invalid phone number" });

    const verificationCheck = await client.verify.v2.services(verifyServiceSid).verificationChecks.create({
      to: norm.sendToTwilio,
      code,
    });

    if (verificationCheck.status !== "approved")
      return res.status(400).json({ success: false, error: "Invalid OTP" });

    const existing = await User.findOne({ phone: norm.storeInDb });
    if (existing) return res.status(400).json({ success: false, error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({
      name,
      phone: norm.storeInDb,
      email,
      password: hashed,
    });

    res.json({ success: true, message: "User created successfully!" });
  } catch (err) {
    console.error("❌ Verify OTP Error:", err.message);
    res.status(500).json({ success: false, error: "Signup failed" });
  }
});

// ✅ Sign In
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password)
      return res.status(400).json({ success: false, error: "Phone and password required" });

    const norm = normalizePhone(phone);
    if (!norm)
      return res.status(400).json({ success: false, error: "Invalid phone number format" });

    const user = await User.findOne({ phone: norm.storeInDb });
    if (!user)
      return res.status(404).json({ success: false, error: "User not found. Please sign up first." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, error: "Incorrect password" });

    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Login Error:", err.message);
    res.status(500).json({ success: false, error: "Login failed due to server error" });
  }
});

export default router;

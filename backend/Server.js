import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import twilio from "twilio";
import User from "./models/User.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// ✅ MongoDB Connection (Atlas)
const mongoUri = process.env.MONGO_URI || "mongodb+srv://Agrisense:Agrisense%40123@agrisense.gxaxgcs.mongodb.net/agrisenseDB?retryWrites=true&w=majority";
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Atlas connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ✅ Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// ✅ Helper: Ensure +91 Format
function formatPhone(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/[^\d]/g, ""); // Remove all non-digits

  // If it's already in +91 format
  if (clean.startsWith("91") && clean.length === 12) {
    return "+".concat(clean);
  }

  // If it's a 10-digit Indian mobile number
  if (/^[6-9]\d{9}$/.test(clean)) {
    return "+91".concat(clean);
  }

  // If it already starts with +91
  if (phone.startsWith("+91") && phone.length === 13) {
    return phone;
  }

  return null;
}

// ✅ Route: Send Crop Info SMS and Save User
app.post("/api/send-sms", async (req, res) => {
  try {
    const { phone, message, cropInfo } = req.body;

    // ✅ Support both "message" or "cropInfo"
    const smsBody = message || cropInfo;

    if (!phone || !smsBody) {
      return res
        .status(400)
        .json({ success: false, error: "Phone number and message/cropInfo required" });
    }

    // ✅ Format phone number to +91
    const formattedPhone = formatPhone(phone);
    if (!formattedPhone) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid 10-digit Indian mobile number" });
    }

    console.log(`📞 Sending SMS to ${formattedPhone}...`);

    // ✅ Save or update user in MongoDB
    await User.findOneAndUpdate(
      { phone: formattedPhone },
      { phone: formattedPhone, lastMessage: smsBody, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // ✅ Shorten message for Twilio trial (max 150 chars)
    const safeBody =
      smsBody.length > 150
        ? smsBody.slice(0, 147) + "..."
        : smsBody;

    // ✅ Send SMS using Twilio
    const sms = await client.messages.create({
      from: twilioPhone,
      to: formattedPhone,
      body: safeBody,
    });

    console.log("✅ Twilio Response:");
    console.log(`   ➤ SID: ${sms.sid}`);
    console.log(`   ➤ Status: ${sms.status}`);
    console.log(`   ➤ To: ${sms.to}`);
    console.log(`   ➤ Message Preview: ${safeBody.slice(0, 60)}...`);

    res.json({ success: true, message: "✅ SMS sent successfully!" });
  } catch (err) {
    console.error("❌ SMS send failed:", err.message);

    let reason = err.message;
    if (reason.includes("unverified")) {
      reason =
        "Your Twilio account is in trial mode — please verify this number in Twilio console.";
    } else if (reason.includes("Permission")) {
      reason = "Twilio permission denied for sending to this destination.";
    } else if (reason.includes("From")) {
      reason = "The Twilio number is not SMS-capable.";
    }

    res.status(500).json({ success: false, error: reason });
  }
});


// ✅ Root
app.get("/", (req, res) => {
  res.send("🚀 AgriSense Server Running — Twilio SMS Ready (with +91 fix)");
});

// ===== Simple Signup (no OTP) =====
app.post("/api/signup", async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ success: false, error: "Name, phone and password required" });

    const formatted = formatPhone(phone);
    if (!formatted) return res.status(400).json({ success: false, error: "Invalid phone number" });

    const storedPhone = formatted.replace("+91", "");

    const existing = await User.findOne({ phone: storedPhone });
    if (existing) return res.status(400).json({ success: false, error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone: storedPhone, password: hashed });
    res.json({ success: true, message: "User created", user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    res.status(500).json({ success: false, error: "Signup failed" });
  }
});

// ===== Login =====
app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, error: "Phone and password required" });

    const formatted = formatPhone(phone);
    if (!formatted) return res.status(400).json({ success: false, error: "Invalid phone number" });

    const storedPhone = formatted.replace("+91", "");
    const user = await User.findOne({ phone: storedPhone });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, error: "Incorrect password" });

    res.json({ success: true, message: "Login successful", user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// ===== Reset Password =====
app.post("/api/reset-password", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword) return res.status(400).json({ success: false, error: "Phone and new password required" });

    const formatted = formatPhone(phone);
    if (!formatted) return res.status(400).json({ success: false, error: "Invalid phone number" });

    const storedPhone = formatted.replace("+91", "");
    const user = await User.findOne({ phone: storedPhone });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ phone: storedPhone }, { password: hashed });
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ success: false, error: "Password reset failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running successfully on port ${PORT}`);
});


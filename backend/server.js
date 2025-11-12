import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import twilio from "twilio";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const app = express();

// ✅ Proper JSON Parsing (Render requires this order)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ CORS Setup (supports both local + Vercel)
const allowedOrigins = [
  "https://agrisense17.vercel.app", // ⚙️ Your Vercel frontend domain
  "http://localhost:3000", // For local testing
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked CORS from:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Log every incoming request for debugging
app.use((req, res, next) => {
  console.log(`🧾 ${req.method} ${req.url}`);
  console.log("📦 Headers:", req.headers);
  console.log("📦 Body:", req.body);
  next();
});

// ✅ MongoDB Connection (Atlas)
const mongoUri =
  process.env.MONGO_URI ||
  "mongodb+srv://Agrisense:Agrisense%40123@agrisense.gxaxgcs.mongodb.net/agrisenseDB?retryWrites=true&w=majority";

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ✅ Twilio Config
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// ✅ Helper: Normalize phone numbers
function formatPhone(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/[^\d]/g, "");
  if (clean.startsWith("91") && clean.length === 12) return "+" + clean;
  if (/^[6-9]\d{9}$/.test(clean)) return "+91" + clean;
  if (phone.startsWith("+91") && phone.length === 13) return phone;
  return null;
}

// ✅ Root Test Route
app.get("/", (req, res) => {
  res.send("🚀 AgriSense Backend Running (Connected to Vercel Frontend)");
});

// ✅ Debug Test Route (for body testing)
app.post("/api/test-login", (req, res) => {
  console.log("✅ /api/test-login Body:", req.body);
  res.json({ received: req.body });
});

// ✅ Send SMS Route
app.post("/api/send-sms", async (req, res) => {
  try {
    const { phone, message, cropInfo } = req.body;
    const smsBody = message || cropInfo;

    if (!phone || !smsBody) {
      return res.status(400).json({
        success: false,
        error: "Phone number and message/cropInfo required",
      });
    }

    const formattedPhone = formatPhone(phone);
    if (!formattedPhone) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid 10-digit Indian mobile number" });
    }

    console.log(`📞 Sending SMS to ${formattedPhone}...`);

    await User.findOneAndUpdate(
      { phone: formattedPhone },
      { phone: formattedPhone, lastMessage: smsBody, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    const safeBody = smsBody.length > 150 ? smsBody.slice(0, 147) + "..." : smsBody;

    const sms = await client.messages.create({
      from: twilioPhone,
      to: formattedPhone,
      body: safeBody,
    });

    console.log("✅ Twilio SMS Sent:", sms.sid);
    res.json({ success: true, message: "✅ SMS sent successfully!" });
  } catch (err) {
    console.error("❌ SMS send failed:", err.message);
    res.status(500).json({ success: false, error: "SMS send failed" });
  }
});

// ✅ Signup Route
app.post("/api/signup", async (req, res) => {
  try {
    console.log("📥 Signup Request:", req.body);
    const { name, phone, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, phone, and password required",
      });
    }

    const formatted = formatPhone(phone);
    if (!formatted)
      return res.status(400).json({ success: false, error: "Invalid phone number" });

    const storedPhone = formatted.replace("+91", "");
    const existing = await User.findOne({ phone: storedPhone });
    if (existing)
      return res.status(400).json({ success: false, error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone: storedPhone, password: hashed });

    res.json({
      success: true,
      message: "User created",
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (err) {
    console.error("❌ Signup error:", err.message);
    res.status(500).json({ success: false, error: "Signup failed" });
  }
});

// ✅ Login Route
app.post("/api/login", async (req, res) => {
  try {
    console.log("📥 Login Request:", req.body);

    const { phone, password } = req.body;
    if (!phone || !password)
      return res
        .status(400)
        .json({ success: false, error: "Phone and password required" });

    const formatted = formatPhone(phone);
    if (!formatted)
      return res.status(400).json({ success: false, error: "Invalid phone number" });

    const storedPhone = formatted.replace("+91", "");
    const user = await User.findOne({ phone: storedPhone });
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, error: "Incorrect password" });

    res.json({
      success: true,
      message: "Login successful",
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// ✅ Reset Password
app.post("/api/reset-password", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword)
      return res.status(400).json({
        success: false,
        error: "Phone and new password required",
      });

    const formatted = formatPhone(phone);
    if (!formatted)
      return res.status(400).json({ success: false, error: "Invalid phone number" });

    const storedPhone = formatted.replace("+91", "");
    const user = await User.findOne({ phone: storedPhone });
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ phone: storedPhone }, { password: hashed });
    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ success: false, error: "Password reset failed" });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running successfully on port ${PORT}`);
});

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import twilio from "twilio";
import bodyParser from "body-parser"; // ✅ Added for full JSON compatibility
import User from "./models/User.js";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ✅ Enable body parsing for JSON and form data
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ CORS Configuration for Vercel Frontend + Local Dev
app.use(
  cors({
    origin: [
      "https://agrisense-17.vercel.app", // your Vercel frontend
      "http://localhost:3000",           // local dev
      "http://127.0.0.1:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Debug middleware (log incoming requests)
app.use((req, res, next) => {
  console.log(`🧾 [${req.method}] ${req.url}`);
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

// ✅ Twilio Configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// ✅ Phone Formatter (+91 handling)
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
  res.send("🚀 AgriSense Backend Active — Ready for Vercel Frontend!");
});

// ✅ Debug Route to test body parsing
app.post("/api/test", (req, res) => {
  console.log("✅ /api/test Body Received:", req.body);
  res.json({ received: req.body });
});

// ✅ Send SMS Route
app.post("/api/send-sms", async (req, res) => {
  try {
    const { phone, message, cropInfo } = req.body;
    const smsBody = message || cropInfo;

    if (!phone || !smsBody) {
      return res
        .status(400)
        .json({ success: false, error: "Phone number and message/cropInfo required" });
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

    console.log("✅ Twilio SMS sent:", sms.sid);
    res.json({ success: true, message: "✅ SMS sent successfully!" });
  } catch (err) {
    console.error("❌ SMS send failed:", err.message);
    let reason = err.message;

    if (reason.includes("unverified"))
      reason =
        "Your Twilio account is in trial mode — please verify this number in Twilio console.";
    else if (reason.includes("Permission"))
      reason = "Twilio permission denied for sending to this destination.";
    else if (reason.includes("From"))
      reason = "The Twilio number is not SMS-capable.";

    res.status(500).json({ success: false, error: reason });
  }
});

// ✅ Signup Route
app.post("/api/signup", async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({ success: false, error: "Name, phone and password required" });

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
    console.log("📥 Login Request Body:", req.body);
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ success: false, error: "Phone and password required" });

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

// ✅ Reset Password Route
app.post("/api/reset-password", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword)
      return res
        .status(400)
        .json({ success: false, error: "Phone and new password required" });

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import twilio from "twilio";
import bodyParser from "body-parser"; // ✅ essential for Render
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const app = express();

// ✅ Correct middleware order (important for Render)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ CORS setup for Vercel frontend and localhost
app.use(
  cors({
    origin: [
      "https://agrisense17.vercel.app", // ⚙️ Your actual frontend domain (change if different)
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Parse JSON after CORS
app.use(express.json());

// ✅ Log every request (for debugging)
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
  .then(() => console.log("✅ MongoDB Atlas connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ✅ Twilio Config
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
const client = twilio(accountSid, authToken);

// ✅ Helper: Format phone to +91XXXXXXXXXX
function formatPhone(phone) {
  if (!phone) return null;
  let clean = String(phone).replace(/[^\d]/g, "");

  if (clean.startsWith("91") && clean.length === 12) return "+" + clean;
  if (/^[6-9]\d{9}$/.test(clean)) return "+91" + clean;
  if (phone.startsWith("+91") && phone.length === 13) return phone;
  return null;
}

// ✅ Root Route
app.get("/", (req, res) => {
  res.send("🚀 AgriSense Backend Running — Connected to Vercel Frontend!");
});

// ✅ Debug Route (to test request body)
app.post("/api/test-login", (req, res) => {
  console.log("✅ Test route hit. Body received:", req.body);
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
    console.log("📥 Signup Request:", req.body);
    const { name, phone, password } = req.body;
    if (!name || !phone || !password)
      return res.status(400).json({
        success: false,
        error: "Name, phone, and password required",
      });

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

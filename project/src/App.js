import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvent,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./App.css";
import Login from "./Login";
import Signup from "./Signup";

// ✅ Browser Notification Function
function sendNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    });
  }
}

// Fix Leaflet Marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// --- Map Updater ---
function MapUpdater({ lat, lon }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lon) map.setView([lat, lon], 10, { animate: true });
  }, [lat, lon, map]);
  return null;
}

// ✅ Map Click Handler (handles invalid or restricted places)
function MapClickHandler({ onMapClick }) {
  useMapEvent("click", async (e) => {
    const { lat, lng } = e.latlng;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();

      const address = data?.address || {};
      const displayName = data.display_name || "Unknown Location";

      // Words that indicate non-agricultural zones
      const restrictedKeywords = [
        "hospital",
        "clinic",
        "school",
        "college",
        "university",
        "temple",
        "church",
        "mosque",
        "police",
        "office",
        "market",
        "mall",
        "restaurant",
        "hotel",
        "bank",
        "atm",
        "library",
        "airport",
        "station",
        "bus",
      ];

      const locationStr = displayName.toLowerCase();
      const isRestricted = restrictedKeywords.some((word) =>
        locationStr.includes(word)
      );

      const isVillageOrCity =
        Boolean(address.city) ||
        Boolean(address.town) ||
        Boolean(address.village) ||
        Boolean(address.hamlet);

      if (!isVillageOrCity || isRestricted) {
        onMapClick({
          lat,
          lon: lng,
          name: displayName,
          isValid: false,
        });
      } else {
        onMapClick({
          lat,
          lon: lng,
          name: displayName,
          isValid: true,
        });
      }
    } catch {
      onMapClick({
        lat,
        lon: lng,
        name: "Unknown Location",
        isValid: false,
      });
    }
  });
  return null;
}

// --- Stat Card ---
function StatCard({ title, value, unit, emoji }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <div className="stat-title">{title}</div>
        <div className="stat-emoji">{emoji}</div>
      </div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}

// --- Crop & Fertilizer Helpers ---
function getCropsByClimate(temp, humidity, rainfall) {
  if (temp >= 10 && temp <= 25 && humidity >= 60 && rainfall >= 80)
    return ["Wheat", "Barley", "Peas"];
  if (temp >= 20 && temp <= 35 && humidity >= 50 && rainfall >= 100)
    return ["Rice", "Sugarcane", "Jute"];
  if (temp >= 25 && temp <= 40 && humidity >= 30 && rainfall <= 50)
    return ["Cotton", "Millets", "Sorghum"];
  if (temp >= 15 && temp <= 30 && humidity >= 40 && rainfall >= 60)
    return ["Maize", "Soybean", "Groundnut"];
  if (temp >= 18 && temp <= 28 && humidity >= 50 && rainfall >= 70)
    return ["Mustard", "Chickpea", "Lentil"];
  return ["General Vegetables", "Pulses", "Fruits"];
}

function getFertilizersAndPesticides(crops) {
  const data = {
    Wheat: { fertilizers: ["Urea", "DAP", "MOP"], pesticides: ["Chlorpyrifos", "Imidacloprid"] },
    Rice: { fertilizers: ["Urea", "Superphosphate", "Potash"], pesticides: ["Carbofuran", "Monocrotophos"] },
    Cotton: { fertilizers: ["Nitrogen", "Phosphorus", "Potassium"], pesticides: ["Cypermethrin", "Thiamethoxam"] },
    Maize: { fertilizers: ["Urea", "Zinc Sulphate", "SSP"], pesticides: ["Atrazine", "Malathion"] },
    Sugarcane: { fertilizers: ["Nitrogen", "Phosphate", "Potash"], pesticides: ["Chlorpyrifos", "Fipronil"] },
    Barley: { fertilizers: ["Ammonium Sulphate", "Superphosphate"], pesticides: ["Lambda-cyhalothrin", "Carbendazim"] },
    Mustard: { fertilizers: ["Urea", "MOP", "Sulphur"], pesticides: ["Dimethoate", "Imidacloprid"] },
    Soybean: { fertilizers: ["SSP", "Urea", "Potash"], pesticides: ["Quinalphos", "Thiodicarb"] },
    Groundnut: { fertilizers: ["Gypsum", "Phosphate", "Urea"], pesticides: ["Malathion", "Endosulfan"] },
    Jute: { fertilizers: ["Urea", "Superphosphate"], pesticides: ["Carbaryl", "Endrin"] },
    Lentil: { fertilizers: ["Urea", "MOP", "SSP"], pesticides: ["Imidacloprid", "Carbendazim"] },
    Peas: { fertilizers: ["Urea", "Potash"], pesticides: ["Chlorpyrifos", "Dithane M-45"] },
    Millets: { fertilizers: ["Nitrogen", "Phosphorus"], pesticides: ["Dichlorvos", "Carbaryl"] },
    Sorghum: { fertilizers: ["Urea", "Phosphorus", "Zinc"], pesticides: ["Malathion", "Endrin"] },
  };
  return crops.map((crop) => ({
    crop,
    fertilizers: data[crop]?.fertilizers || ["NPK (Balanced Fertilizer)"],
    pesticides: data[crop]?.pesticides || ["General Crop Protector"],
  }));
}

export default function App() {
  // --- Authentication state ---
  const [authUser, setAuthUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("agri_user") || "null");
    } catch {
      return null;
    }
  });
  const [showSignup, setShowSignup] = useState(false);

  function handleLoginSuccess(user) {
    localStorage.setItem("agri_user", JSON.stringify(user));
    setAuthUser(user);
  }

  function handleLogout() {
    localStorage.removeItem("agri_user");
    setAuthUser(null);
  }

  // Include isValid flag in location
  const [location, setLocation] = useState({
    lat: 27.1458,
    lon: 78.0882,
    name: "Default Location",
    isValid: true, // default valid for the default coords
  });

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suitableCrops, setSuitableCrops] = useState([]);
  const [fertilizerInfo, setFertilizerInfo] = useState([]);
  // const [loading, setLoading] = useState(false);
  const [showSmsCard, setShowSmsCard] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [smsMode, setSmsMode] = useState(null); // null, "manual", or "saved"

  // Fetch weather (unchanged)
  const fetchWeather = useCallback(
    async (lat, lon, name = location.name) => {
      try {
        setLoading(true);
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum,relative_humidity_2m_max&timezone=auto`
        );
        const result = await res.json();

        // if API doesn't return daily, handle gracefully
        if (!result || !result.daily || !result.daily.time) {
          throw new Error("No weather data");
        }

        const chartData = result.daily.time.map((d, i) => ({
          date: d,
          temperature: result.daily.temperature_2m_max[i],
          humidity: result.daily.relative_humidity_2m_max[i],
          rainfall: result.daily.precipitation_sum[i],
        }));

        const latest = {
          temperature: result.daily.temperature_2m_max.at(-1),
          humidity: result.daily.relative_humidity_2m_max.at(-1),
          rainfall: result.daily.precipitation_sum.at(-1),
        };

        setData({ latest, history: chartData });

        const crops = getCropsByClimate(
          latest.temperature,
          latest.humidity,
          latest.rainfall
        );
        setSuitableCrops(crops);
        setFertilizerInfo(getFertilizersAndPesticides(crops));

        // browser notification with 2-minute delay
        setTimeout(() => {
          sendNotification(
            `🌾 ${name}`,
            `Crops: ${crops.join(", ")}\nFertilizers: ${getFertilizersAndPesticides(crops)
              .map((f) => f.fertilizers.join(", "))
              .join("; ")}`
          );
        }, 120000); // 2 minutes = 120000 ms
      } catch (err) {
        setError("Failed to fetch weather data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [location.name]
  );

  // initial load
  useEffect(() => {
    // only fetch weather when user is authenticated
    if (!authUser) return;

    if (location.isValid) {
      fetchWeather(location.lat, location.lon, location.name);
    } else {
      // ensure N/A state if initial location is invalid
      setData(null);
      setSuitableCrops([]);
      setFertilizerInfo([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.lat, location.lon, location.isValid]);

  // Handle map click: set isValid and placeholders if invalid
  const handleMapClick = async (newLoc) => {
    // newLoc contains isValid boolean from MapClickHandler
    setLocation(newLoc);

    if (!newLoc.isValid) {
      // Explicit N/A placeholders
      setData(null);
      setSuitableCrops([]); // empty array will cause UI to render "N/A"
      setFertilizerInfo([]);
      // Notification with 2-minute delay
      setTimeout(() => {
        sendNotification("🚫 Invalid Area", "Not a farming zone. Showing N/A data.");
      }, 120000);
      return;
    }

    // valid -> fetch weather and populate cards
    await fetchWeather(newLoc.lat, newLoc.lon, newLoc.name);
  };

  // Search city: after search, set isValid true by default (we'll still check reverse for restricted)
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      const result = await res.json();
      if (!result.length) {
        setError("Location not found.");
        return;
      }
      const { lat, lon, display_name } = result[0];

      // run reverse lookup to check for restricted keywords and city/village presence
      let isValidSearch = true;
      try {
        const rev = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
        );
        const revData = await rev.json();
        const address = revData?.address || {};
        const displayName = revData.display_name || display_name || "";

        const restrictedKeywords = [
          "hospital",
          "clinic",
          "school",
          "college",
          "university",
          "temple",
          "church",
          "mosque",
          "police",
          "office",
          "market",
          "mall",
          "restaurant",
          "hotel",
          "bank",
          "atm",
          "library",
          "airport",
          "station",
          "bus",
        ];
        const locationStr = (displayName || "").toLowerCase();
        const isRestricted = restrictedKeywords.some((word) =>
          locationStr.includes(word)
        );
        const isVillageOrCity =
          Boolean(address.city) ||
          Boolean(address.town) ||
          Boolean(address.village) ||
          Boolean(address.hamlet);

        if (!isVillageOrCity || isRestricted) isValidSearch = false;
      } catch {
        // if reverse lookup fails, assume valid (we still attempt fetchWeather)
        isValidSearch = true;
      }

      const newLoc = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        name: display_name,
        isValid: isValidSearch,
      };
      setLocation(newLoc);

      if (!isValidSearch) {
        setData(null);
        setSuitableCrops([]);
        setFertilizerInfo([]);
        // Notification with 2-minute delay
        setTimeout(() => {
          sendNotification("🚫 Invalid Area", "Not a farming zone. Showing N/A data.");
        }, 120000);
      } else {
        await fetchWeather(newLoc.lat, newLoc.lon, newLoc.name);
      }
    } catch (e) {
      console.error(e);
      setError("Search failed.");
    } finally {
      setLoading(false);
    }
  }

  // Use my location
  function useMyLocation() {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        // reverse lookup to determine validity
        try {
          const rev = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
          );
          const revData = await rev.json();
          const address = revData?.address || {};
          const displayName = revData.display_name || "My Location";

          const restrictedKeywords = [
            "hospital",
            "clinic",
            "school",
            "college",
            "university",
            "temple",
            "church",
            "mosque",
            "police",
            "office",
            "market",
            "mall",
            "restaurant",
            "hotel",
            "bank",
            "atm",
            "library",
            "airport",
            "station",
            "bus",
          ];
          const locationStr = (displayName || "").toLowerCase();
          const isRestricted = restrictedKeywords.some((word) =>
            locationStr.includes(word)
          );
          const isVillageOrCity =
            Boolean(address.city) ||
            Boolean(address.town) ||
            Boolean(address.village) ||
            Boolean(address.hamlet);

          const newLoc = {
            lat,
            lon,
            name: displayName,
            isValid: isVillageOrCity && !isRestricted,
          };
          setLocation(newLoc);

          if (!newLoc.isValid) {
            setData(null);
            setSuitableCrops([]);
            setFertilizerInfo([]);
            // Notification with 2-minute delay
            setTimeout(() => {
              sendNotification("🚫 Invalid Area", "Not a farming zone. Showing N/A data.");
            }, 120000);
            return;
          }

          await fetchWeather(lat, lon, newLoc.name);
        } catch (err) {
          console.error(err);
          setError("Failed to detect location.");
        }
      },
      () => setError("Location access denied.")
    );
  }

  // Send SMS (unchanged)
  const handleSendSMS = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      alert("❌ Enter a valid 10-digit Indian number");
      return;
    }

    // if location invalid -> show N/A message instead of sending crop data
    if (!location.isValid) {
      alert("⚠️ Location is not a farming area. SMS will contain N/A data.");
    }

    const cropNames = location.isValid && suitableCrops.length ? suitableCrops.join(", ") : "N/A";
    const fertData =
      location.isValid && fertilizerInfo.length
        ? fertilizerInfo.map((f) => `${f.crop}: ${f.fertilizers.join(", ")}`).join(" | ")
        : "N/A";

    const cropInfo = `🌾 AgriSense (${location.name})\nCrops: ${cropNames}\nFertilizers: ${fertData}`;

    setSending(true);
    try {
      const res = await fetch("https://agrisense-17.onrender.com/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, cropInfo }),
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ SMS sent successfully!");
        setShowSmsCard(false);
        setPhone("");
        setSmsMode(null);
      } else {
        alert("❌ " + (result.error || "Failed to send SMS"));
      }
    } catch (err) {
      console.error(err);
      alert("❌ Server error while sending SMS");
    } finally {
      setSending(false);
    }
  };

  if (!authUser) {
    return (
      <div>
        {showSignup ? (
          <Signup onLoginClick={() => setShowSignup(false)} />
        ) : (
          <Login onSignupClick={() => setShowSignup(true)} onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="container">
        <header className="header">
          <div className="navbar">
            <div className="brand">
              <h1 className="brand-title">AgriSense</h1>
            </div>

            <div className="search-container">
              <div className="search-box">
                <input
                  className="search-input"
                  placeholder="Search for a city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button onClick={handleSearch} className="btn blue">
                  🔍 Search
                </button>
              </div>
            </div>

            <div className="nav-actions">
              <button onClick={useMyLocation} className="btn green">
                📍 Use My Location
              </button>
              <button
                onClick={() => setShowAiModal(true)}
                className="btn blue"
              >
                🤖 AI
              </button>
              <button onClick={() => setShowSmsCard(true)} className="btn orange">
                📩 Get Crop Info via SMS
              </button>
              <button onClick={handleLogout} className="btn" style={{ background: "#eee", color: "#333" }}>
                ⎋ Logout
              </button>
            </div>
          </div>
        </header>

        {/* 📱 SMS Popup */}
        <AnimatePresence>
          {showSmsCard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 999,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: "25px",
                  borderRadius: "12px",
                  width: "320px",
                  textAlign: "center",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                }}
              >
                {!smsMode ? (
                  <>
                    <h3>📱 Get Crop Info via SMS</h3>
                    <p style={{ color: "#666", marginBottom: "20px" }}>Choose how to send SMS:</p>
                    <button
                      onClick={() => setSmsMode("manual")}
                      style={{
                        width: "100%",
                        padding: "12px",
                        marginBottom: "12px",
                        background: "linear-gradient(90deg,#1d72b8,#2196f3)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "15px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      ✍️ Enter Number Manually
                    </button>
                    <button
                      onClick={() => {
                        setPhone(authUser?.phone || "");
                        setSmsMode("saved");
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: "linear-gradient(90deg,#2d9442,#34a64c)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "15px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      📲 Use My Saved Number
                    </button>
                    <p
                      onClick={() => {
                        setShowSmsCard(false);
                        setSmsMode(null);
                        setPhone("");
                      }}
                      style={{
                        marginTop: "12px",
                        cursor: "pointer",
                        color: "#555",
                        fontSize: "14px",
                      }}
                    >
                      ❌ Cancel
                    </p>
                  </>
                ) : smsMode === "manual" ? (
                  <>
                    <h3>📱 Enter Your Number</h3>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      style={{
                        width: "100%",
                        marginTop: "12px",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1.5px solid #ccc",
                        textAlign: "center",
                        fontSize: "16px",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      onClick={handleSendSMS}
                      disabled={sending}
                      style={{
                        marginTop: "16px",
                        width: "100%",
                        background: "linear-gradient(90deg,#00c853,#00e676)",
                        color: "#fff",
                        fontWeight: "600",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "15px",
                      }}
                    >
                      {sending ? "Sending..." : "Send SMS"}
                    </button>
                    <p
                      onClick={() => setSmsMode(null)}
                      style={{
                        marginTop: "12px",
                        cursor: "pointer",
                        color: "#555",
                        fontSize: "14px",
                      }}
                    >
                      ← Back
                    </p>
                  </>
                ) : (
                  <>
                    <h3>📱 Confirm Your Number</h3>
                    <p style={{ color: "#666", marginBottom: "20px", wordBreak: "break-all" }}>
                      <strong>{phone}</strong>
                    </p>
                    <button
                      onClick={handleSendSMS}
                      disabled={sending}
                      style={{
                        marginTop: "12px",
                        width: "100%",
                        background: "linear-gradient(90deg,#00c853,#00e676)",
                        color: "#fff",
                        fontWeight: "600",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "15px",
                      }}
                    >
                      {sending ? "Sending..." : "Send SMS"}
                    </button>
                    <p
                      onClick={() => setSmsMode(null)}
                      style={{
                        marginTop: "12px",
                        cursor: "pointer",
                        color: "#555",
                        fontSize: "14px",
                      }}
                    >
                      ← Back
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🤖 AI Modal */}
        <AnimatePresence>
          {showAiModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 999,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  padding: "0",
                  borderRadius: "12px",
                  width: "90%",
                  maxWidth: "900px",
                  height: "80vh",
                  textAlign: "center",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: "1px solid #eee",
                    background: "#f8fafc",
                  }}
                >
                  <h3 style={{ margin: 0 }}>🤖 AI Assistant</h3>
                  <button
                    onClick={() => setShowAiModal(false)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "24px",
                      cursor: "pointer",
                      padding: "0",
                    }}
                  >
                    ✕
                  </button>
                </div>
                <iframe
                  src="https://gemini-ai-six-kappa.vercel.app/"
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: "0 0 12px 12px",
                    width: "100%",
                  }}
                  title="Gemini AI"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <div className="error-box">{error}</div>}

        <main className="main-grid">
          <section className="main-section">
            {/* Weather Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="card"
            >
              <div className="card-header">
                <h2 className="card-title">7-Day Weather Trend</h2>
                <div className="card-subtitle">Temperature · Humidity · Rainfall</div>
              </div>
              <div className="chart-container">
                {data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="temperature" stroke="#ff7a18" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="humidity" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="rainfall" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p>{location.isValid ? "Loading chart..." : "N/A"}</p>
                )}
              </div>
            </motion.div>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="card"
            >
              <h3 className="card-title">Field Map</h3>
              <div className="map-placeholder" style={{ height: "300px", width: "100%" }}>
                <MapContainer center={[location.lat, location.lon]} zoom={10} style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapUpdater lat={location.lat} lon={location.lon} />
                  <MapClickHandler onMapClick={handleMapClick} />
                  <Marker position={[location.lat, location.lon]}>
                    <Popup>{location.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </motion.div>
          </section>

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="card">
              <h3 className="card-title">Current Conditions</h3>
              {data ? (
                <div className="stats-grid">
                  <StatCard title="Temp" value={data.latest.temperature} unit="°C" emoji="☀️" />
                  <StatCard title="Humidity" value={data.latest.humidity} unit="%" emoji="💧" />
                  <StatCard title="Rainfall" value={data.latest.rainfall} unit="mm" emoji="🌧️" />
                </div>
              ) : (
                <p>{location.isValid ? "Fetching data..." : "N/A"}</p>
              )}
            </div>

            <div className="card mt-4">
              <h3 className="card-title">🌾 Suitable Crops</h3>
              {location.isValid && suitableCrops.length ? (
                <ul className="crop-list">
                  {suitableCrops.map((crop, i) => (
                    <li key={i} className="crop-item">
                      {crop}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>N/A</p>
              )}
            </div>

            <div className="card mt-4">
              <h3 className="card-title">🧪 Fertilizers & Pesticides</h3>
              {location.isValid && fertilizerInfo.length ? (
                <div className="fertilizer-list">
                  {fertilizerInfo.map((item, i) => (
                    <div key={i} className="fertilizer-item">
                      <h4>{item.crop}</h4>
                      <p>
                        <strong>Fertilizers:</strong> {item.fertilizers.join(", ")}
                      </p>
                      <p>
                        <strong>Pesticides:</strong> {item.pesticides.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>N/A</p>
              )}
            </div>
          </aside>
        </main>

        <footer className="footer">AgriSense © 2025</footer>
      </div>
    </div>
  );
}

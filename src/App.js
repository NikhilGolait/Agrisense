import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Fix default marker icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const SAMPLE_PAYLOAD = {
  latest: { temperature: 29.4, humidity: 68, rainfall: 2.4, alert: 'No immediate alerts' },
  history: [
    { time: '06:00', temperature: 19 },
    { time: '09:00', temperature: 23 },
    { time: '12:00', temperature: 27 },
    { time: '15:00', temperature: 33 },
    { time: '18:00', temperature: 37 },
  ],
  recommendations: [
    'Irrigate 20 minutes tonight (soil moisture low)',
    'Check for pests in field A (leaf discoloration reported)',
    'Apply slow-release nitrogen fertilizer in 3 days',
  ],
};

const simulateFetch = (lat, lon) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: { ...SAMPLE_PAYLOAD, location: { lat, lon } } });
    }, 700);
  });

function StatCard({ title, value, unit, emoji }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <div className="stat-title">{title}</div>
        <div className="stat-emoji">{emoji}</div>
      </div>
      <div className="stat-value">
        {value}{unit ? <span className="stat-unit">{unit}</span> : null}
      </div>
    </div>
  );
}

export default function App() {
  const [location, setLocation] = useState({ lat: 27.1458, lon: 78.0882 }); 
  const [data, setData] = useState(SAMPLE_PAYLOAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await simulateFetch(location.lat, location.lon);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data — using local sample data.');
      setData(SAMPLE_PAYLOAD);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported in your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lon = parseFloat(pos.coords.longitude.toFixed(6));
        setLocation({ lat, lon });
        simulateFetch(lat, lon).then((res) => {
          setData(res.data);
          setLoading(false);
        });
      },
      (err) => {
        console.error(err);
        setError('Permission denied or failed to retrieve location.');
        setLoading(false);
      }
    );
  }

  return (
    <div className="dashboard">
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">AGRISENSE</h1>
            <p className="subtitle">Location-aware soil & climate alerts · AI-powered recommendations</p>
          </div>
          <div className="location-controls">
            <div className="location-label">Location:</div>
            <div className="location-box">{location.lat.toFixed(4)}, {location.lon.toFixed(4)}</div>
            <button onClick={useMyLocation} className="btn green">Use My Location</button>
            <button onClick={fetchData} className="btn blue">Refresh</button>
          </div>
        </header>

        {error && <div className="error-box">{error}</div>}

        <main className="main-grid">

          <section className="main-section">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="card">
              <div className="card-header">
                <h2 className="card-title">Temperature Trend</h2>
                <div className="card-subtitle">Last 24 hours</div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis unit="°C" />
                    <Tooltip />
                    <Line type="monotone" dataKey="temperature" stroke="#ff7a18" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="card">
              <h3 className="card-title">Field Map</h3>
              <div className="map-grid">
                <div className="map-placeholder" style={{ height: '300px', width: '100%' }}>
                  <MapContainer center={[location.lat, location.lon]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[location.lat, location.lon]}>
                      <Popup>
                        Current Location: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div className="map-info">
                  <div className="info-box">
                    <div className="info-label">Latest Alert</div>
                    <div className="info-text">{data.latest.alert}</div>
                  </div>
                  <div className="info-box recommendations">
                    <div className="info-label">Recommendations</div>
                    <ul>
                      {data.recommendations?.length ? (
                        data.recommendations.map((r, idx) => <li key={idx}>{r}</li>)
                      ) : (
                        <li>No recommendations available</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          {/* Right: Stats */}
          <aside className="sidebar">
            <div className="card">
              <h3 className="card-title">Current Conditions</h3>
              <div className="stats-grid">
                <StatCard title="Temp" value={data.latest.temperature} unit="°C" emoji="☀️" />
                <StatCard title="Humidity" value={data.latest.humidity} unit="%" emoji="💧" />
                <StatCard title="Rainfall" value={data.latest.rainfall} unit="mm" emoji="🌧️" />
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Controls</h3>
              <label className="input-label">Manual Location</label>
              <div className="input-row">
                <input type="number" step="0.0001" value={location.lat} onChange={(e) => setLocation((s) => ({ ...s, lat: parseFloat(e.target.value) }))} />
                <input type="number" step="0.0001" value={location.lon} onChange={(e) => setLocation((s) => ({ ...s, lon: parseFloat(e.target.value) }))} />
              </div>
              <div className="button-row">
                <button onClick={fetchData} className="btn blue">Fetch Data</button>
                <button onClick={() => setData(SAMPLE_PAYLOAD)} className="btn gray">Reset</button>
              </div>
              {loading && <div className="loading-text">Loading...</div>}
            </div>

            <div className="card">
              <h3 className="card-title">Notes</h3>
              <ul className="notes-list">
                <li>this is a demo for the website</li>
              </ul>
            </div>
          </aside>
        </main>

        <footer className="footer">AgriSense </footer>
      </div>
    </div>
  );
}

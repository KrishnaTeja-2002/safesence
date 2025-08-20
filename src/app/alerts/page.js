'use client';

import React, { useState, useRef, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized successfully');
} catch (err) {
  console.error('Failed to initialize Supabase client:', err);
}

// ---------- Error Boundary (JS) ----------
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Alerts page crashed:', error, info);
  }
  render() {
    const { darkMode } = this.props;
    if (this.state.hasError) {
      return (
        <div className={`p-4 ${darkMode ? 'text-red-300' : 'text-red-600'}`}>
          Error: {this.state.error?.message || 'Something went wrong'}
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_WARNING = { min: 20, max: 60 };

// ---------- Styles ----------
const getStatusStyles = (status, darkMode) => {
  switch (status) {
    case 'Needs Attention':
      return {
        section: `${darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800'}`,
        border: 'border-red-500',
        value: 'text-red-600',
      };
    case 'Warning':
      return {
        section: `${darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`,
        border: 'border-yellow-400',
        value: 'text-yellow-600',
      };
    case 'Good':
      return {
        section: `${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'}`,
        border: 'border-green-500',
        value: 'text-green-600',
      };
    default:
      return {
        section: `${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`,
        border: 'border-gray-400',
        value: 'text-gray-500',
      };
  }
};

const CARD_STYLES = {
  'Needs Attention': {
    light: 'bg-red-50 border-red-500 text-red-900',
    dark: 'bg-red-950/40 border-red-400 text-red-200',
  },
  Warning: {
    light: 'bg-yellow-50 border-yellow-400 text-yellow-900',
    dark: 'bg-yellow-950/40 border-yellow-300 text-yellow-200',
  },
  Good: {
    light: 'bg-green-50 border-green-500 text-green-900',
    dark: 'bg-green-950/40 border-green-400 text-green-200',
  },
};

const cardClass = (status, darkMode) =>
  (darkMode ? CARD_STYLES[status]?.dark : CARD_STYLES[status]?.light) ||
  (darkMode ? 'bg-gray-800 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-800');

// ---------- Helpers ----------
const WARNING_MARGIN = 5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const computeStatus = (temp, { min, max }) => {
  if (temp == null) return 'Good';
  if (temp < min || temp > max) return 'Needs Attention';
  if (temp <= min + WARNING_MARGIN || temp >= max - WARNING_MARGIN) return 'Warning';
  return 'Good';
};

const toLocalFromReading = (r) => {
  if (r?.approx_time) {
    try { return new Date(r.approx_time).toLocaleString(); } catch {}
  }
  if (r?.timestamp != null) {
    const n = Number(r.timestamp);
    const ms = n > 1e12 ? n : n * 1000; // sec vs ms
    try { return new Date(ms).toLocaleString(); } catch {}
  }
  return 'Current Reading';
};

const cToF = (c) => (c * 9) / 5 + 32;
const toF = (val, unit) => (val == null ? null : unit === 'C' ? cToF(Number(val)) : Number(val));

// ---------- Chart ----------
function ThresholdChart({ data, min, max, darkMode, onChange }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const W = 720, H = 380;
  const padL = 60, padR = 56, padT = 18, padB = 28;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  const yMin = -20, yMax = 100;
  const y = (t) =>
    padT + chartH * (1 - (clamp(t, yMin, yMax) - yMin) / (yMax - yMin));
  const x = (i) => padL + (chartW * i) / Math.max(1, data.length - 1);

  const posToTemp = (clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const yPix = clientY - rect.top;
    const t = yMin + (1 - (yPix - padT) / chartH) * (yMax - yMin);
    return clamp(Math.round(t), yMin, yMax);
  };

  const linePath = data.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');

  const strokeAxis = darkMode ? '#374151' : '#E5E7EB';
  const tickText = darkMode ? '#D1D5DB' : '#6B7280';
  const orange = '#F59E0B';
  const red = '#EF4444';

  const trackX = padL + chartW + 16;
  const trackW = 12, handleW = 18, handleH = 22, handleRX = 4;

  const minWarnTop = Math.min(min + WARNING_MARGIN, max);
  const maxWarnBot = Math.max(max - WARNING_MARGIN, min);

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const t = posToTemp(e.clientY);
      if (drag === 'max') onChange && onChange({ min, max: Math.max(min + 1, t) });
      else onChange && onChange({ min: Math.min(max - 1, t), max });
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, min, max, onChange]);

  return (
    <svg ref={svgRef} width={W} height={H} className="w-full max-w-4xl">
      <rect x={padL} y={padT} width={chartW} height={chartH} fill="#FFFFFF" stroke={strokeAxis} />
      <rect x={padL} y={padT} width={chartW} height={Math.max(0, y(max) - padT)} fill={red} opacity="0.22" />
      <rect x={padL} y={y(min)} width={chartW} height={Math.max(0, padT + chartH - y(min))} fill={red} opacity="0.22" />
      <rect x={padL} y={y(max)} width={chartW} height={Math.max(0, y(maxWarnBot) - y(max))} fill={orange} opacity="0.28" />
      <rect x={padL} y={y(minWarnTop)} width={chartW} height={Math.max(0, y(min) - y(minWarnTop))} fill={orange} opacity="0.28" />
      <line x1={padL} x2={padL + chartW} y1={y(max)} y2={y(max)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />
      <line x1={padL} x2={padL + chartW} y1={y(min)} y2={y(min)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />
      {[-20,-10,0,10,20,30,40,50,60,70,80,90,100].map((t) => (
        <g key={t}>
          <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={strokeAxis} />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={tickText}>{t}</text>
        </g>
      ))}
      <path d={linePath} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
      {data.length > 0 && <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="5" fill="#10B981" />}
      <rect x={trackX} y={padT} width={trackW} height={chartH} fill="#E5E7EB" stroke="#D1D5DB" />
      <g transform={`translate(${trackX + trackW / 2}, ${y(max)})`} style={{ cursor: 'ns-resize' }}
         onPointerDown={(e) => { e.preventDefault(); setDrag('max'); }}>
        <rect x={-handleW/2} y={-handleH/2} width={handleW} height={handleH} rx={handleRX} fill="#FFFFFF" stroke="#9CA3AF" />
        <line x1={-5} x2={5} y1={-4} y2={-4} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={0} y2={0} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={4} y2={4} stroke="#9CA3AF" strokeWidth="2" />
      </g>
      <g transform={`translate(${trackX + trackW / 2}, ${y(min)})`} style={{ cursor: 'ns-resize' }}
         onPointerDown={(e) => { e.preventDefault(); setDrag('min'); }}>
        <rect x={-handleW/2} y={-handleH/2} width={handleW} height={handleH} rx={handleRX} fill="#FFFFFF" stroke="#9CA3AF" />
        <line x1={-5} x2={5} y1={-4} y2={-4} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={0} y2={0} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={4} y2={4} stroke="#9CA3AF" strokeWidth="2" />
      </g>
    </svg>
  );
}

// ---------- Main Component ----------
export default function Alerts() {
  const [currentView, setCurrentView] = useState('alerts');
  const [selectedId, setSelectedId] = useState(null);
  const [alertName, setAlertName] = useState('');
  const [sensorName, setSensorName] = useState('Select a Sensor');
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSMS, setSendSMS] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const { darkMode } = useDarkMode();

  // State
  const [streams, setStreams] = useState([]);     // rows for UI list
  const [thresholds, setThresholds] = useState({}); // id -> {min,max}
  const [series, setSeries] = useState({});       // id -> number[]
  const HISTORY_LEN = 120;

  // Sensor Settings state / modal
  const [newSensorName, setNewSensorName] = useState('');
  const [newMetric, setNewMetric] = useState('F'); // 'C' | 'F' stored in DB
  const [savingSensorName, setSavingSensorName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const makeKey = (sensor_id) => `${sensor_id}::temperature`;

  // Session check
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!sessionData.session) router.push('/login');
      } catch (err) {
        console.error('Session check error:', err.message);
        setError('Failed to verify session: ' + err.message);
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  // Initial load: sensors list (read sensor_name + metric)
  useEffect(() => {
    const load = async () => {
      try {
        const { data: sensorRows, error: sErr } = await supabase
          .from('sensors')
          .select('sensor_id, sensor_name, metric, latest_temp, approx_time, last_fetched_time, updated_at');

        if (sErr) throw sErr;

        // fallback latest from raw_readings_v2
        const ids = (sensorRows || []).map(r => r.sensor_id).filter(Boolean);
        let latestMap = new Map();
        if (ids.length) {
          const { data: latest, error: lErr } = await supabase
            .from('raw_readings_v2')
            .select('sensor_id, reading_value, timestamp, approx_time')
            .in('sensor_id', ids)
            .order('timestamp', { ascending: false });
          if (!lErr && latest) {
            for (const row of latest) {
              if (!latestMap.has(row.sensor_id)) latestMap.set(row.sensor_id, row);
            }
          }
        }

        const nextThresholds = {};
        const ui = (sensorRows || []).map(r => {
          const unit = (r.metric || 'F').toUpperCase() === 'C' ? 'C' : 'F';
          const key = makeKey(r.sensor_id);
          const lr = latestMap.get(r.sensor_id);

          const raw = r.latest_temp ?? (lr ? Number(lr.reading_value) : null);
          const tempF = raw != null ? toF(raw, unit) : null;

          const lastIso =
            r.approx_time ||
            r.last_fetched_time ||
            r.updated_at ||
            (lr ? (lr.approx_time ||
              new Date((Number(lr.timestamp) > 1e12 ? Number(lr.timestamp) : Number(lr.timestamp) * 1000)).toISOString()
            ) : null);

          const th = DEFAULT_WARNING;
          nextThresholds[key] = th;

          return {
            id: key,
            name: r.sensor_name || r.sensor_id,
            temp: tempF,
            status: computeStatus(tempF, th),
            lastReading: lastIso ? new Date(lastIso).toLocaleString() : 'No readings yet',
            sensor_id: r.sensor_id,
            unit,                 // <--- stored unit (C or F)
            metric: 'F',          // <--- displayed unit is always F
          };
        });

        setThresholds(nextThresholds);
        setStreams(ui.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load data: ' + (err?.message || err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Keep modal fields synced to selected sensor
  useEffect(() => {
    const sel = streams.find((s) => s.id === selectedId);
    setNewSensorName(sel ? (sel.name || '') : '');
    setNewMetric(sel ? (sel.unit || 'F') : 'F');
  }, [selectedId, streams]);

  // Load history when opening detail
  useEffect(() => {
    if (!supabase || !selectedId || loading) return;
    const sel = streams.find((s) => s.id === selectedId);
    if (!sel) return;

    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('raw_readings_v2')
          .select('reading_value, timestamp, approx_time')
          .eq('sensor_id', sel.sensor_id)
          .order('timestamp', { ascending: true })
          .limit(HISTORY_LEN);

        if (error) throw error;

        const unit = sel.unit || 'F';
        const values = (data || []).map((d) => toF(d.reading_value, unit));
        setSeries((prev) => ({
          ...prev,
          [selectedId]: values.length > 0 ? values : [sel.temp ?? 42],
        }));
      } catch (err) {
        console.error('History load error:', err);
        setError('Failed to load history: ' + err.message);
        setSeries((prev) => ({
          ...prev,
          [selectedId]: [42, 43, 41, 44, 40],
        }));
      }
    };

    if (!series[selectedId]) loadHistory();
  }, [selectedId, streams, loading, series]);

  // Realtime Updates (raw_readings_v2) -> always convert to F using stored unit
  useEffect(() => {
    if (!supabase || loading) return;

    const onInsert = (payload) => {
      const r = payload.new || {};
      if (!r.sensor_id || (typeof r.reading_value !== 'number' && typeof r.reading_value !== 'string')) return;

      setStreams((prev) => {
        const idx = prev.findIndex((p) => p.sensor_id === r.sensor_id);
        const unit = idx !== -1 ? prev[idx].unit : 'F';
        const tempValF = toF(Number(r.reading_value), unit);
        const id = idx !== -1 ? prev[idx].id : makeKey(r.sensor_id);
        const th = thresholds[id] || DEFAULT_WARNING;
        const name = idx !== -1 ? prev[idx].name : r.sensor_id;

        const row = {
          id,
          name,
          temp: tempValF,
          status: computeStatus(tempValF, th),
          lastReading: toLocalFromReading(r),
          sensor_id: r.sensor_id,
          unit,
          metric: 'F',
        };

        if (idx === -1) return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = row;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });

      setSeries((prev) => {
        const id = makeKey(r.sensor_id);
        const existing = streams.find((p) => p.sensor_id === r.sensor_id);
        const unit = existing?.unit || 'F';
        const nextVal = toF(Number(r.reading_value), unit);
        const arr = prev[id] ? [...prev[id], nextVal] : [nextVal];
        return { ...prev, [id]: arr.slice(-HISTORY_LEN) };
      });
    };

    const ch = supabase
      .channel('raw-readings-v2-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raw_readings_v2' }, onInsert)
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [thresholds, loading, streams]);

  // Refresh one sensor's latest + history using a given unit
  const refreshOneSensor = async (sensor_id, unit) => {
    try {
      const key = makeKey(sensor_id);

      // latest
      const { data: latest, error: lErr } = await supabase
        .from('raw_readings_v2')
        .select('reading_value, timestamp, approx_time')
        .eq('sensor_id', sensor_id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lErr) throw lErr;

      const latestTempF = latest ? toF(latest.reading_value, unit) : null;
      const lastTime = latest ? toLocalFromReading(latest) : 'No readings yet';

      setStreams((prev) =>
        prev
          .map((row) =>
            row.sensor_id === sensor_id
              ? {
                  ...row,
                  temp: latestTempF,
                  lastReading: lastTime,
                  unit,      // update stored unit
                  metric: 'F'
                }
              : row
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      // history
      const { data: hist, error: hErr } = await supabase
        .from('raw_readings_v2')
        .select('reading_value, timestamp')
        .eq('sensor_id', sensor_id)
        .order('timestamp', { ascending: true })
        .limit(HISTORY_LEN);

      if (!hErr && hist) {
        const values = hist.map((d) => toF(d.reading_value, unit));
        setSeries((prev) => ({ ...prev, [key]: values }));
      }
    } catch (e) {
      console.error('refreshOneSensor error:', e);
    }
  };

  // Save sensor settings (name + metric)
  const saveSensorName = async () => {
    const sel = streams.find((s) => s.id === selectedId);
    if (!sel) return;

    const nextName = (newSensorName || '').trim();
    if (!nextName) {
      setError('Sensor name cannot be empty.');
      return;
    }

    const targetMetric = (newMetric || 'F').toUpperCase() === 'C' ? 'C' : 'F';

    try {
      setSavingSensorName(true);

      const updatePayload = {
        updated_at: new Date().toISOString(),
      };
      if (nextName !== sel.name) updatePayload.sensor_name = nextName;
      if (targetMetric !== sel.unit) updatePayload.metric = targetMetric;

      // if nothing changed, just close
      if (!updatePayload.sensor_name && !updatePayload.metric) {
        setShowSettings(false);
        return;
      }

      const { data, error } = await supabase
        .from('sensors')
        .update(updatePayload)
        .eq('sensor_id', sel.sensor_id)
        .select('sensor_id, sensor_name, metric')
        .maybeSingle();

      if (error) {
        throw new Error(`Supabase update error: ${JSON.stringify(error)}`);
      }
      if (!data) {
        throw new Error('Update returned no row. Check RLS or sensor_id.');
      }

      // reflect DB values in UI
      const dbName = data.sensor_name ?? sel.name;
      const dbUnit = (data.metric || sel.unit || 'F').toUpperCase() === 'C' ? 'C' : 'F';

      setStreams((prev) =>
        prev
          .map((row) =>
            row.sensor_id === sel.sensor_id
              ? { ...row, name: dbName, unit: dbUnit }
              : row
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      // Re-fetch latest + history to apply conversion with new unit
      await refreshOneSensor(sel.sensor_id, dbUnit);

      setShowSettings(false);
      setError('');
    } catch (e) {
      console.error('Update sensors error:', e);
      setError(typeof e === 'string' ? e : e?.message || JSON.stringify(e));
    } finally {
      setSavingSensorName(false);
    }
  };

  // Handlers
  const handleAlertClick = (item) => {
    setSelectedId(item.id);
    setCurrentView('alertDetail');
  };

  const handleBack = () => {
    setCurrentView('alerts');
    setSelectedId(null);
  };

  // Thresholds are local-only
  const updateThreshold = async (displayName, next) => {
    const item = streams.find((s) => s.name === displayName);
    if (!item) return;
    const key = item.id;

    setThresholds((prev) => {
      const updated = { ...prev, [key]: next };
      setStreams((prevS) =>
        prevS
          .map((s) => (s.id === key ? { ...s, status: computeStatus(s.temp, next) } : s))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      return updated;
    });
  };

  // UI bits
  const SectionHeader = ({ icon, label, status }) => {
    const { section } = getStatusStyles(status, darkMode);
    return (
      <div className={`${section} p-3 rounded flex items-center`}>
        <span className="mr-3 text-xl">{icon}</span> {label}
      </div>
    );
  };

  const AlertCard = ({ sensor }) => {
    const { value } = getStatusStyles(sensor.status, darkMode);
    return (
      <div
        className={`rounded-lg shadow p-4 border-l-4 ${cardClass(sensor.status, darkMode)} cursor-pointer hover:shadow-lg transition-shadow`}
        onClick={() => handleAlertClick(sensor)}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-lg">{sensor.name}</p>
            <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <span className="mr-1">🕐</span>
              {sensor.lastReading}
            </p>
          </div>
          <div className="text-right">
            <div className={`${value} text-xl mb-1 font-bold`}>
              🌡️ {sensor.temp != null && !Number.isNaN(sensor.temp) ? Math.round(sensor.temp) : '--'}°F
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <ErrorBoundary darkMode={darkMode}>
        <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
          <Sidebar darkMode={darkMode} activeKey="alerts" />
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p>Loading alerts data...</p>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  // Views
  const renderAlertsView = () => (
    <main className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Alerts</h2>
        <div className="flex items-center space-x-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={async () => {
              try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                router.push('/login');
              } catch (err) {
                setError('Failed to sign out: ' + err.message);
              }
            }}
            className={`px-4 py-2 rounded ${darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            Log out
          </button>
          <div className={`w-10 h-10 ${darkMode ? 'bg-amber-700' : 'bg-amber-600'} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
            FA
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <SectionHeader icon="🚨" label="Needs Attention" status="Needs Attention" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === 'Needs Attention').map((s) => (
            <AlertCard key={`na-${s.id}`} sensor={s} />
          ))}
          {streams.filter((s) => s.status === 'Needs Attention').length === 0 && (
            <div className={`col-span-full p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No sensors need attention
            </div>
          )}
        </div>

        <SectionHeader icon="⚠️" label="Warning" status="Warning" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === 'Warning').map((s) => (
            <AlertCard key={`w-${s.id}`} sensor={s} />
          ))}
          {streams.filter((s) => s.status === 'Warning').length === 0 && (
            <div className={`col-span-full p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No warning alerts
            </div>
          )}
        </div>

        <SectionHeader icon="✅" label="Good" status="Good" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === 'Good').map((s) => (
            <AlertCard key={`g-${s.id}`} sensor={s} />
          ))}
          {streams.filter((s) => s.status === 'Good').length === 0 && (
            <div className={`col-span-full p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No sensors in good status
            </div>
          )}
        </div>

        <div className={`${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} p-3 rounded flex items-center`}>
          <span className="mr-3 text-xl">🛠️</span> System Alerts
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'Meat Freezer', status: 'Disconnected', lastReading: '2 hours ago' },
            { name: 'Fry Products', status: 'Need battery replacement', lastReading: '5 hours ago' },
          ].map((a, i) => (
            <div key={`sys-${i}`} className={`rounded-lg shadow p-4 border-l-4 border-gray-400 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{a.name}</p>
                  <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className="mr-1">🕐</span> Last Reading: {a.lastReading}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-2xl">{a.status === 'Disconnected' ? '📡' : '🔋'}</div>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{a.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-8">
          <button
            className={`px-6 py-3 rounded-lg font-semibold text-white border ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
            onClick={() => setCurrentView('addAlert')}
          >
            Add Alert
          </button>
        </div>
      </div>
    </main>
  );

  const renderAlertDetailView = () => {
    const selected = streams.find((s) => s.id === selectedId);
    if (!selected) return null;
    const t = thresholds[selected.id] || DEFAULT_WARNING;
    const data = series[selected.id] || (selected.temp != null ? [selected.temp] : []);

    return (
      <main className="flex-1 p-6">
        {/* TOP BAR with Back */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className={`px-3 py-2 rounded border ${darkMode ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}`}
            >
              ← Back
            </button>
            <h2 className="text-3xl font-bold">Alert Detail</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signOut();
                  if (error) throw error;
                  router.push('/login');
                } catch (err) {
                  setError('Failed to sign out: ' + err.message);
                }
              }}
              className={`px-4 py-2 rounded ${darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              Log out
            </button>
            <div className={`w-10 h-10 ${darkMode ? 'bg-amber-700' : 'bg-amber-600'} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
              FA
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SectionHeader
            icon={selected.status === 'Needs Attention' ? '🚨' : selected.status === 'Warning' ? '⚠️' : '✅'}
            label={selected.status}
            status={selected.status}
          />

          {/* INFO CARD with temperature + Settings button */}
          <div className={`rounded-lg shadow p-4 border-l-4 ${getStatusStyles(selected.status, darkMode).border} ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg">{selected.name}</p>
                <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  <span className="mr-1">🕐</span> {selected.lastReading}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`${getStatusStyles(selected.status, darkMode).value} text-xl mb-1 font-bold`}>
                  🌡️ {selected.temp != null ? Math.round(selected.temp) : '--'}°F
                </div>
                <button
                  onClick={() => { setNewSensorName(selected.name || ''); setNewMetric(selected.unit || 'F'); setShowSettings(true); }}
                  className={`px-3 py-1.5 rounded text-sm font-medium border ${
                    darkMode
                      ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                      : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
                  }`}
                  title="Open sensor settings"
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </div>

          {/* SETTINGS MODAL */}
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setShowSettings(false)} />
              <div className={`relative w-full max-w-lg mx-4 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'} p-6`}>
                <h3 className="text-lg font-semibold mb-4">Sensor Settings</h3>

                <label className="block text-sm font-medium mb-2">Sensor name</label>
                <input
                  type="text"
                  value={newSensorName}
                  onChange={(e) => setNewSensorName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveSensorName(); }}
                  className={`border rounded px-3 py-2 w-full mb-4 ${
                    darkMode
                      ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500'
                      : 'bg-white border-gray-300 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                  placeholder="Enter sensor display name"
                />

                <label className="block text-sm font-medium mb-2">Metric (sensor unit)</label>
                <select
                  value={newMetric}
                  onChange={(e) => setNewMetric(e.target.value)}
                  className={`border rounded px-3 py-2 w-full mb-2 ${
                    darkMode
                      ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500'
                      : 'bg-white border-gray-300 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                >
                  <option value="F">Fahrenheit (°F)</option>
                  <option value="C">Celsius (°C)</option>
                </select>
                <p className={`text-xs mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  The dashboard always displays temperatures in <strong>°F</strong>. If your sensor reports in °C, we’ll convert to °F for display.
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowSettings(false)}
                    className={`px-4 py-2 rounded ${
                      darkMode ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSensorName}
                    disabled={
                      savingSensorName ||
                      !newSensorName.trim()
                    }
                    className={`px-4 py-2 rounded font-semibold text-white ${
                      darkMode ? 'bg-orange-700 hover:bg-orange-800 disabled:bg-gray-600'
                               : 'bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300'
                    }`}
                  >
                    {savingSensorName ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={`rounded-lg shadow p-6 border-2 border-blue-400 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Temperature History</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selected.name} • F
                </p>
              </div>
              <div className="text-sm">
                Limits: <strong>{t.min}°F</strong> – <strong>{t.max}°F</strong>
              </div>
            </div>

            <div className="flex justify-center">
              <ThresholdChart
                data={data}
                min={t.min}
                max={t.max}
                darkMode={darkMode}
                onChange={({ min, max }) => updateThreshold(selected.name, { min, max })}
              />
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <h3 className="text-lg font-semibold mb-4">Last Reading</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Time</span>
                <span className="font-medium">{selected.lastReading}</span>
              </div>
              <div className="flex justify-between">
                <span>Threshold</span>
                <span className="font-medium">{t.min}°F - {t.max}°F</span>
              </div>
              <div className="flex justify-between">
                <span>Air Temperature</span>
                <span className="font-medium">{selected.temp != null ? Math.round(selected.temp) : '--'}°F</span>
              </div>
              <div className="flex justify-between">
                <span>Displayed Unit</span>
                <span className="font-medium">Fahrenheit (°F)</span>
              </div>
              <div className="flex justify-between">
                <span>Sensor ID</span>
                <span className="font-medium font-mono text-sm">{selected.sensor_id}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  };

  const renderAddAlertView = () => (
    <main className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Add Alert</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={async () => {
              try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                router.push('/login');
              } catch (err) {
                setError('Failed to sign out: ' + err.message);
              }
            }}
            className={`px-4 py-2 rounded ${darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            Log out
          </button>
          <div className={`w-10 h-10 ${darkMode ? 'bg-amber-700' : 'bg-amber-600'} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
            FA
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h3 className="text-xl font-semibold mb-2">Create New Alert</h3>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-6`}>
            Set up alerts for your streams to receive notifications.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Alert Name:</label>
            <input
              type="text"
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500' : 'bg-white border-gray-300 focus:border-orange-500'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              placeholder="Enter alert name"
            />
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h4 className="text-lg font-semibold mb-2">Trigger</h4>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-6`}>
            Drag the side handles to set minimum and maximum temperature limits. Warning zone is ±{WARNING_MARGIN}°F.
          </p>

          <div className="flex justify-center">
            <ThresholdChart data={[32, 33, 31, 34, 30, 29]} min={25} max={40} darkMode={darkMode} />
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h4 className="text-lg font-semibold mb-2">Choose Stream</h4>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Stream</label>
            <select
              value={sensorName}
              onChange={(e) => setSensorName(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500' : 'bg-white border-gray-300 focus:border-orange-500'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            >
              <option>Select a Stream</option>
              {streams.map((s) => (
                <option key={s.id} value={`${s.name} • ${s.metric}`}>
                  {`${s.name} • ${s.metric}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <h4 className="text-lg font-semibold mb-4">Notification Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="mr-3 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="sendEmail" className="text-sm font-medium">Send Email Notifications</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sendSMS"
                checked={sendSMS}
                onChange={(e) => setSendSMS(e.target.checked)}
                className="mr-3 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="sendSMS" className="text-sm font-medium">Send SMS Notifications</label>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6">
          <button
            className={`px-6 py-3 rounded-lg ${darkMode ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'}`}
            onClick={() => setCurrentView('alerts')}
          >
            Cancel
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-semibold text-white border ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
            onClick={async () => {
              try {
                const selectedStream = streams.find((s) => `${s.name} • ${s.metric}` === sensorName);
                if (!selectedStream) {
                  setError('Please select a valid stream');
                  return;
                }
                console.log('Creating alert:', { alertName, sensorName, sendEmail, sendSMS });
                setCurrentView('alerts');
                setAlertName('');
                setSensorName('Select a Sensor');
                setSendEmail(false);
                setSendSMS(true);
              } catch (err) {
                setError('Failed to create alert: ' + err.message);
              }
            }}
          >
            Create Alert
          </button>
        </div>
      </div>
    </main>
  );

  // Main Render
  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar darkMode={darkMode} activeKey="alerts" />
        {currentView === 'alerts' && renderAlertsView()}
        {currentView === 'alertDetail' && renderAlertDetailView()}
        {currentView === 'addAlert' && renderAddAlertView()}
      </div>
    </ErrorBoundary>
  );
}

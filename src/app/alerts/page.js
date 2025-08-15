"use client";

import React, { useState, useRef, useEffect, Component } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../../components/Sidebar";
import { useDarkMode } from "../DarkModeContext";

/* ------------------------ Supabase client (JS) ------------------------ */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ------------------------ Error Boundary (JS) ------------------------ */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Alerts page crashed:", error, info);
  }
  render() {
    const { darkMode } = this.props;
    if (this.state.hasError) {
      return (
        <div className={`p-4 ${darkMode ? "text-red-300" : "text-red-600"}`}>
          Error: {this.state.error?.message || "Something went wrong"}
        </div>
      );
    }
    return this.props.children;
  }
}
const DEFAULT_WARNING = { min: 20, max: 60 };

/* ------------------------ Status → Styles ------------------------ */
const getStatusStyles = (status, darkMode) => {
  switch (status) {
    case "Needs Attention":
      return {
        section: `${darkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800"}`,
        border: "border-red-500",
        value: "text-red-600",
      };
    case "Warning":
      return {
        section: `${darkMode ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800"}`,
        border: "border-yellow-400",
        value: "text-yellow-600",
      };
    case "Good":
      return {
        section: `${darkMode ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"}`,
        border: "border-green-500",
        value: "text-green-600",
      };
    default:
      return {
        section: `${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"}`,
        border: "border-gray-400",
        value: "text-gray-500",
      };
  }
};

/* ------------------------ Card fills ------------------------ */
const CARD_STYLES = {
  "Needs Attention": {
    light: "bg-red-50 border-red-500 text-red-900",
    dark: "bg-red-950/40 border-red-400 text-red-200",
  },
  Warning: {
    light: "bg-yellow-50 border-yellow-400 text-yellow-900",
    dark: "bg-yellow-950/40 border-yellow-300 text-yellow-200",
  },
  Good: {
    light: "bg-green-50 border-green-500 text-green-900",
    dark: "bg-green-950/40 border-green-400 text-green-200",
  },
};
const cardClass = (status, darkMode) =>
  (darkMode ? CARD_STYLES[status]?.dark : CARD_STYLES[status]?.light) ||
  (darkMode ? "bg-gray-800 border-gray-500 text-white" : "bg-white border-gray-300 text-gray-800");

/* ------------------------ Helpers ------------------------ */
const WARNING_MARGIN = 5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const computeStatus = (temp, { min, max }) => {
  if (temp == null) return "Good";
  if (temp < min || temp > max) return "Needs Attention";
  if (temp <= min + WARNING_MARGIN || temp >= max - WARNING_MARGIN) return "Warning";
  return "Good";
};

/* ------------------------ Threshold Chart (kept your UI) ------------------------ */
function ThresholdChart({ data, min, max, darkMode, onChange }) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null); // "min" | "max" | null

  const W = 720,
    H = 380;
  const padL = 60,
    padR = 56,
    padT = 18,
    padB = 28;
  const chartW = W - padL - padR,
    chartH = H - padT - padB;

  const yMin = -20,
    yMax = 100;
  const y = (t) =>
    padT + chartH * (1 - (clamp(t, yMin, yMax) - yMin) / (yMax - yMin));
  const x = (i) => padL + (chartW * i) / Math.max(1, data.length - 1);

  const posToTemp = (clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const yPix = clientY - rect.top;
    const t = yMin + (1 - (yPix - padT) / chartH) * (yMax - yMin);
    return clamp(Math.round(t), yMin, yMax);
  };

  const linePath = data.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ");

  const strokeAxis = darkMode ? "#374151" : "#E5E7EB";
  const tickText = darkMode ? "#D1D5DB" : "#6B7280";
  const orange = "#F59E0B";
  const red = "#EF4444";

  const trackX = padL + chartW + 16;
  const trackW = 12,
    handleW = 18,
    handleH = 22,
    handleRX = 4;

  const minWarnTop = Math.min(min + WARNING_MARGIN, max);
  const maxWarnBot = Math.max(max - WARNING_MARGIN, min);

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const t = posToTemp(e.clientY);
      if (drag === "max") onChange && onChange({ min, max: Math.max(min + 1, t) });
      else onChange && onChange({ min: Math.min(max - 1, t), max });
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, min, max, onChange]);

  return (
    <svg ref={svgRef} width={W} height={H} className="w-full max-w-4xl">
      <rect x={padL} y={padT} width={chartW} height={chartH} fill="#FFFFFF" stroke={strokeAxis} />

      {/* DANGER (RED) */}
      <rect x={padL} y={padT} width={chartW} height={Math.max(0, y(max) - padT)} fill={red} opacity="0.22" />
      <rect x={padL} y={y(min)} width={chartW} height={Math.max(0, padT + chartH - y(min))} fill={red} opacity="0.22" />

      {/* WARNING (ORANGE) */}
      <rect x={padL} y={y(max)} width={chartW} height={Math.max(0, y(maxWarnBot) - y(max))} fill={orange} opacity="0.28" />
      <rect x={padL} y={y(minWarnTop)} width={chartW} height={Math.max(0, y(min) - y(minWarnTop))} fill={orange} opacity="0.28" />

      {/* Lines */}
      <line x1={padL} x2={padL + chartW} y1={y(max)} y2={y(max)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />
      <line x1={padL} x2={padL + chartW} y1={y(min)} y2={y(min)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />

      {/* Y ticks */}
      {[-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t) => (
        <g key={t}>
          <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={strokeAxis} />
          <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={tickText}>
            {t}
          </text>
        </g>
      ))}

      {/* Series */}
      <path d={linePath} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
      {data.length > 0 && <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="5" fill="#10B981" />}

      {/* Side bar & handles */}
      <rect x={trackX} y={padT} width={trackW} height={chartH} fill="#E5E7EB" stroke="#D1D5DB" />
      <g
        transform={`translate(${trackX + trackW / 2}, ${y(max)})`}
        style={{ cursor: "ns-resize" }}
        onPointerDown={(e) => {
          e.preventDefault();
          setDrag("max");
        }}
      >
        <rect x={-handleW / 2} y={-handleH / 2} width={handleW} height={handleH} rx={handleRX} fill="#FFFFFF" stroke="#9CA3AF" />
        <line x1={-5} x2={5} y1={-4} y2={-4} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={0} y2={0} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={4} y2={4} stroke="#9CA3AF" strokeWidth="2" />
      </g>
      <g
        transform={`translate(${trackX + trackW / 2}, ${y(min)})`}
        style={{ cursor: "ns-resize" }}
        onPointerDown={(e) => {
          e.preventDefault();
          setDrag("min");
        }}
      >
        <rect x={-handleW / 2} y={-handleH / 2} width={handleW} height={handleH} rx={handleRX} fill="#FFFFFF" stroke="#9CA3AF" />
        <line x1={-5} x2={5} y1={-4} y2={-4} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={0} y2={0} stroke="#9CA3AF" strokeWidth="2" />
        <line x1={-5} x2={5} y1={4} y2={4} stroke="#9CA3AF" strokeWidth="2" />
      </g>
    </svg>
  );
}

/* ===================================================================== */
/* Everything below keeps your UI, but data comes from latest_by_sensor_metric. */

export default function Alerts() {
  const [currentView, setCurrentView] = useState("alerts"); // "alerts" | "alertDetail" | "addAlert"
  const [selectedId, setSelectedId] = useState(null);       // key = `${source_id}::${metric}`
  const [alertName, setAlertName] = useState("");
  const [sensorName, setSensorName] = useState("Select a Sensor");
  const [alertMessage, setAlertMessage] = useState("Ex My (Sensor Name): Temperature above 50°F");
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSMS, setSendSMS] = useState(true);
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();

  // Streams built from the view (no hard-codes):
  // [{ id, name, temp, status, lastReading, source_id, metric }]
  const [streams, setStreams] = useState([]);
  // thresholds per stream key; if not provided in sensors.metadata we compute around the current value
  const [thresholds, setThresholds] = useState({});
  // history per stream key for the detail chart
  const [series, setSeries] = useState({});
  const HISTORY_LEN = 120;

  const missingEnv = !supabase;

  const makeKey = (r) => `${r.source_id}::${r.metric}`;

  /* ------------------------ Initial load ------------------------ */
  useEffect(() => {
    if (!supabase) return;

    const load = async () => {
      // 1) latest per sensor/metric
      const { data: latestRows, error: lErr } = await supabase
        .from("latest_by_sensor_metric")
        .select("source_id, metric, value, ts")
        .order("source_id", { ascending: true });
      if (lErr) {
        console.error("Load latest_by_sensor_metric error:", lErr);
        return;
      }

      // 2) optional enrichment from sensors table (labels + metadata thresholds)
      const { data: sensorRows } = await supabase
        .from("sensors")
        .select("sensor_id,label,metadata");

      const labelMap = new Map();
      (sensorRows || []).forEach((r) =>
        labelMap.set(r.sensor_id, { label: r.label, meta: r.metadata || {} })
      );

      // 3) build UI list + thresholds (dynamic if not provided)
      const nextThresholds = {};
      const ui = (latestRows || []).map((r) => {
        const key = makeKey(r);
        const info = labelMap.get(r.source_id) || {};
        const name = info?.label || r.source_id;
        const meta = info?.meta || {};
        const th =
  meta.min != null && meta.max != null
    ? { min: Number(meta.min), max: Number(meta.max) }
    : DEFAULT_WARNING;

        return {
          id: key,
          name,
          temp: r.value,
          status: computeStatus(r.value, th),
          lastReading: r.ts ? new Date(r.ts).toLocaleString() : "No readings yet",
          source_id: r.source_id,
          metric: r.metric,
        };
      });

      setThresholds(nextThresholds);
      setStreams(ui);
    };

    load();
  }, []);

  /* ------------------------ Load history when opening detail ------------------------ */
  useEffect(() => {
    if (!supabase || !selectedId) return;
    const sel = streams.find((s) => s.id === selectedId);
    if (!sel) return;

    const loadHistory = async () => {
      const { data, error } = await supabase
        .from("raw_readings")
        .select("value, ts")
        .eq("source_id", sel.source_id)
        .eq("metric", sel.metric)
        .order("ts", { ascending: true })
        .limit(HISTORY_LEN);
      if (error) {
        console.error("Load history error:", error);
        return;
      }
      setSeries((prev) => ({ ...prev, [selectedId]: (data || []).map((d) => d.value) }));
    };

    // only fetch if not already loaded
    if (!series[selectedId]) loadHistory();
  }, [selectedId, streams]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------ Realtime: INSERT + UPDATE ------------------------ */
  useEffect(() => {
    if (!supabase) return;

    const onChange = (payload) => {
      const r = payload.new || {};
      if (!r.source_id || !r.metric || typeof r.value !== "number") return;
      const key = `${r.source_id}::${r.metric}`;

      // Update/insert in the list
      setStreams((prev) => {
        const idx = prev.findIndex((p) => p.id === key);
        const th = thresholds[key] || DEFAULT_WARNING;
        const row = {
          id: key,
          name: prev[idx]?.name || r.source_id,
          temp: r.value,
          status: computeStatus(r.value, th),
          lastReading: r.ts ? new Date(r.ts).toLocaleString() : "Current Reading",
          source_id: r.source_id,
          metric: r.metric,
        };
        if (idx === -1) return [...prev, row].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...prev];
        next[idx] = row;
        return next;
      });

      // Append to series for this stream (if we have it open)
      setSeries((prev) => {
        const arr = prev[key] ? [...prev[key], r.value] : [r.value];
        return { ...prev, [key]: arr.slice(-HISTORY_LEN) };
      });
    };

    const ch = supabase
      .channel("raw-readings-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "raw_readings" }, onChange)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [thresholds]);

  /* ------------------------ Handlers ------------------------ */
  const handleAlertClick = (item) => {
    setSelectedId(item.id);
    setCurrentView("alertDetail");
  };
  const handleBack = () => {
    setCurrentView("alerts");
    setSelectedId(null);
  };

  const updateThreshold = (displayName, next) => {
    const item = streams.find((s) => s.name === displayName);
    if (!item) return;
    const key = item.id;

    setThresholds((prev) => {
      const updated = { ...prev, [key]: next };
      // Recompute status immediately for the card
      setStreams((prevS) =>
        prevS.map((s) =>
          s.id === key ? { ...s, status: computeStatus(s.temp, next) } : s
        )
      );
      return updated;
    });

    // (Optional) persist back to sensors.metadata if you want:
    // supabase.from("sensors").update({ metadata: { min: next.min, max: next.max } }).eq("sensor_id", item.source_id);
  };

  /* ------------------------ Small UI bits ------------------------ */
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
        className={`rounded-lg shadow p-4 border-l-4 ${cardClass(sensor.status, darkMode)} cursor-pointer hover:shadow-lg`}
        onClick={() => handleAlertClick(sensor)}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-lg">{sensor.name}</p>
            <p className={`text-sm flex items-center mt-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
              <span className="mr-1">🕐</span>
              {sensor.lastReading}
            </p>
          </div>
          <div className="text-right">
            <div className={`${value} text-xl mb-1`}>
              🌡️ {sensor.temp != null ? Math.round(sensor.temp) : "--"}°F
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------ Views ------------------------ */
  const renderAlertsView = () => (
    <main className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Alerts</h2>
        <div className="flex items-center space-x-4">
          <button className={`px-4 py-2 rounded ${darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"}`}>Log out</button>
          <div className={`w-10 h-10 ${darkMode ? "bg-amber-700" : "bg-amber-600"} rounded-full flex items-center justify-center text-white text-sm font-bold`}>FA</div>
        </div>
      </div>

      {missingEnv && (
        <div className={`${darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-700"} p-3 rounded mb-4`}>
          Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
        </div>
      )}

      <div className="space-y-6">
        {/* Needs Attention */}
        <SectionHeader icon="🚨" label="Needs Attention" status="Needs Attention" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === "Needs Attention").map((s) => (
            <AlertCard key={`na-${s.id}`} sensor={s} />
          ))}
        </div>

        {/* Warning */}
        <SectionHeader icon="⚠️" label="Warning" status="Warning" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === "Warning").map((s) => (
            <AlertCard key={`w-${s.id}`} sensor={s} />
          ))}
        </div>

        {/* Good */}
        <SectionHeader icon="✅" label="Good" status="Good" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === "Good").map((s) => (
            <AlertCard key={`g-${s.id}`} sensor={s} />
          ))}
        </div>

        {/* System Alerts placeholder (unchanged) */}
        <div className={`${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"} p-3 rounded flex items-center`}>
          <span className="mr-3 text-xl">🛠️</span> System Alerts
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: "Meat Freezer", status: "Disconnected", lastReading: "2 hours ago" },
            { name: "Fry Products", status: "Need battery replacement", lastReading: "5 hours ago" },
          ].map((a, i) => (
            <div key={`sys-${i}`} className={`rounded-lg shadow p-4 border-l-4 border-gray-400 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{a.name}</p>
                  <p className={`text-sm flex items-center mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    <span className="mr-1">🕐</span> Last Reading: {a.lastReading}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-2xl">{a.status === "Disconnected" ? "📡" : "🔋"}</div>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{a.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-8">
          <button
            className={`px-6 py-3 rounded-lg font-semibold text-white border ${darkMode ? "bg-orange-700 hover:bg-orange-800 border-orange-700" : "bg-orange-500 hover:bg-orange-600 border-orange-500"}`}
            onClick={() => setCurrentView("addAlert")}
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Alerts</h2>
          <div className="flex items-center space-x-4">
            <button className={`px-4 py-2 rounded ${darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"}`}>Log out</button>
            <div className={`w-10 h-10 ${darkMode ? "bg-amber-700" : "bg-amber-600"} rounded-full flex items-center justify-center text-white text-sm font-bold`}>FA</div>
          </div>
        </div>

        <div className="space-y-6">
          <SectionHeader
            icon={selected.status === "Needs Attention" ? "🚨" : selected.status === "Warning" ? "⚠️" : "✅"}
            label={selected.status}
            status={selected.status}
          />

          <div className={`rounded-lg shadow p-4 border-l-4 ${getStatusStyles(selected.status, darkMode).border} ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg">{selected.name}</p>
                <p className={`text-sm flex items-center mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <span className="mr-1">🕐</span> {selected.lastReading}
                </p>
              </div>
              <div className="text-right">
                <div className={`${getStatusStyles(selected.status, darkMode).value} text-xl mb-1`}>
                  🌡️ {selected.temp != null ? Math.round(selected.temp) : "--"}°F
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 border-2 border-blue-400 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Temperature History</h3>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{selected.name} • {selected.metric}</p>
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

          <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4">Last Reading</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span>Time</span><span className="font-medium">{selected.lastReading}</span></div>
              <div className="flex justify-between"><span>Threshold</span><span className="font-medium">{t.min}°F - {t.max}°F</span></div>
              <div className="flex justify-between"><span>Air Temperature</span><span className="font-medium">{selected.temp != null ? Math.round(selected.temp) : "--"}°F</span></div>
              <div className="flex justify-between"><span>Metric</span><span className="font-medium">{selected.metric}</span></div>
            </div>
          </div>

          <div className="flex justify-start">
            <button
              className={`px-6 py-2 rounded ${darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-300 text-gray-800 hover:bg-gray-400"}`}
              onClick={handleBack}
            >
              Back
            </button>
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
          <button className={`px-4 py-2 rounded ${darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"}`}>Log out</button>
          <div className={`w-10 h-10 ${darkMode ? "bg-amber-700" : "bg-amber-600"} rounded-full flex items-center justify-center text-white text-sm font-bold`}>FA</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h3 className="text-xl font-semibold mb-2">Create New Alert</h3>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-6`}>
            Set up alerts for your streams to receive notifications.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Alert Name:</label>
            <input
              type="text"
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"}`}
            />
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h4 className="text-lg font-semibold mb-2">Trigger</h4>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-6`}>
            Drag the side handles to set minimum and maximum temperature limits. Warning zone is ±{WARNING_MARGIN}°F.
          </p>

          <div className="flex justify-center">
            <ThresholdChart data={[32, 33, 31, 34, 30, 29]} min={25} max={40} darkMode={darkMode} />
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h4 className="text-lg font-semibold mb-2">Choose Stream</h4>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Stream</label>
            <select
              value={sensorName}
              onChange={(e) => setSensorName(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"}`}
            >
              <option>Select a Stream</option>
              {streams.map((s) => (
                <option key={s.id}>{`${s.name} • ${s.metric}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6">
          <button className={`px-6 py-3 rounded-lg ${darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-300 text-gray-800 hover:bg-gray-400"}`} onClick={() => setCurrentView("alerts")}>Cancel</button>
          <button className={`px-6 py-3 rounded-lg font-semibold text-white border ${darkMode ? "bg-orange-700 hover:bg-orange-800 border-orange-700" : "bg-orange-500 hover:bg-orange-600 border-orange-500"}`} onClick={() => setCurrentView("alerts")}>Create Alert</button>
        </div>
      </div>
    </main>
  );

  /* ------------------------ Render ------------------------ */
  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-800"}`}>
        <Sidebar darkMode={darkMode} activeKey="alerts" />
        {currentView === "alerts" && renderAlertsView()}
        {currentView === "alertDetail" && renderAlertDetailView()}
        {currentView === "addAlert" && renderAddAlertView()}
      </div>
    </ErrorBoundary>
  );
}

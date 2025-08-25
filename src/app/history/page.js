"use client";

import { useEffect, useMemo, useRef, useState, Component } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../../components/Sidebar";
import { useDarkMode } from "../DarkModeContext";

/* ===== Supabase (read-only) ===== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kwaylmatpkcajsctujor.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M"
);

/* ===== Error Boundary ===== */
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className={`p-4 ${this.props.darkMode ? "text-red-400" : "text-red-500"}`}>
          Error: {this.state.error?.message || "Something went wrong"}
        </div>
      );
    }
    return this.props.children;
  }
}

/* ===== Time ranges (hours) ===== */
const RANGES = [
  { key: "1H",  hours: 1,         label: "Last 1h" },
  { key: "6H",  hours: 6,         label: "Last 6h" },
  { key: "12H", hours: 12,        label: "Last 12h" },
  { key: "24H", hours: 24,        label: "Last 24h" },
  { key: "1W",  hours: 24 * 7,    label: "Last 1w" },
  { key: "1M",  hours: 24 * 30,   label: "Last 1m" },
  { key: "3M",  hours: 24 * 90,   label: "Last 3m" },
];

const H = 300; // SVG viewBox height
const W = 100; // SVG viewBox width

/* ===== Helpers ===== */
const toF = (c) => (c == null ? null : c * 9/5 + 32);
const toC = (f) => (f == null ? null : (f - 32) * 5/9);
const fmt1 = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });

const epochToIso = (n) => {
  const t = Number(n);
  const ms = t > 1e12 ? t : t * 1000; // ms or sec epochs
  return new Date(ms).toISOString();
};

const fmtTooltipTime = (iso, timeZone) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZone });

/* Smart tick labels with seconds when zoomed tight */
const fmtTickSmart = (ms, visibleMs, baseIsWeekPlus, timeZone) => {
  const d = new Date(ms);
  const visibleHours = visibleMs / 3_600_000;

  // If base range is 1W+ we always show a date component
  if (baseIsWeekPlus) {
    if (visibleHours >= 24 * 7)
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
    // zoomed into hours or less -> date + time (and seconds when very tight)
    if (visibleMs <= 6 * 60 * 1000)
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZone });
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  }

  // For base ranges < 1W we adapt to visible width
  if (visibleMs <= 6 * 60 * 1000) // ≤ 6 minutes -> show seconds
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone });
  if (visibleHours < 24)
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  if (visibleHours < 24 * 7)
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", timeZone });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
};

/* Catmull-Rom → cubic Bézier smoothing */
const controlPoints = (p0, p1, p2, p3, t = 0.5) => {
  const d1 = [(p2.x - p0.x) * t, (p2.y - p0.y) * t];
  const d2 = [(p3.x - p1.x) * t, (p3.y - p1.y) * t];
  return [
    { x: p1.x + d1[0] / 3, y: p1.y + d1[1] / 3 },
    { x: p2.x - d2[0] / 3, y: p2.y - d2[1] / 3 },
  ];
};
const buildSmoothPath = (pts) => {
  if (!pts.length) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const [c1, c2] = controlPoints(p0, p1, p2, p3, 0.5);
    d += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
};
const buildAreaPath = (pts) => {
  if (!pts.length) return "";
  const first = pts[0], last = pts[pts.length - 1];
  const curve = buildSmoothPath(pts).replace(/^M[^C]+/, `L ${first.x},${first.y}`);
  return `M ${first.x},${H} L ${first.x},${first.y} ${curve} L ${last.x},${H} Z`;
};

export default function History() {
  const router = useRouter();
  const { darkMode } = useDarkMode();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // User prefs
  const [tempScale, setTempScale] = useState("F"); // 'F'|'C'
  const [timeZone, setTimeZone] = useState("UTC");
  const [showTemp, setShowTemp] = useState(true);
  const [showHumidity, setShowHumidity] = useState(true);

  // Sensors + selection
  const [sensors, setSensors] = useState([]); // {sensor_id, name, sensor_type, metric}
  const [activeSensorId, setActiveSensorId] = useState(null);

  // Range + zoom/pan domain
  const [rangeKey, setRangeKey] = useState("1H");
  const rangeHours = useMemo(() => RANGES.find(r => r.key === rangeKey)?.hours ?? 1, [rangeKey]);

  const [zoomDomain, setZoomDomain] = useState(null); // {startMs, endMs} or null
  const resetZoom = () => setZoomDomain(null);

  // Pan state (drag to navigate when zoomed)
  const svgWrapRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);      // becomes true only after crossing threshold
  const DRAG_THRESHOLD_PX = 6;                             // prevents accidental pans
  const dragStart = useRef({ x: 0, startMs: 0, endMs: 0 });

  // Series rows
  const [rows, setRows] = useState([]); // [{tsISO, value}]
  const [metric, setMetric] = useState("temperature"); // 'temperature'|'humidity'
  const [unit, setUnit] = useState("°F"); // '°F'|'°C'|'%'

  // Tooltip
  const [hovered, setHovered] = useState(null);
  const chartRef = useRef(null);

  /* ===== Auth + prefs ===== */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data?.session?.user?.id) return router.push("/login");

        const uid = data.session.user.id;
        const { data: prefs, error: pErr } = await supabase
          .from("user_preferences")
          .select("temp_scale, time_zone, show_temp, show_humidity")
          .eq("user_id", uid)
          .maybeSingle();

        if (pErr) throw pErr;

        setTempScale((prefs?.temp_scale || "F").toUpperCase());
        setTimeZone(prefs?.time_zone || "UTC");
        setShowTemp(prefs?.show_temp ?? true);
        setShowHumidity(prefs?.show_humidity ?? true);
      } catch (e) {
        setErrMsg("Failed to load session or preferences: " + (e?.message || String(e)));
      }
    })();
  }, [router]);

  /* ===== Load sensors ===== */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("sensors")
          .select("sensor_id, sensor_name, sensor_type, metric")
          .order("sensor_name", { ascending: true });

        if (error) throw error;

        let list = (data || []).map(r => ({
          sensor_id: r.sensor_id,
          name: r.sensor_name || String(r.sensor_id),
          sensor_type: (r.sensor_type || "sensor").toLowerCase(), // 'sensor'|'temperature'|'humidity'
          metric: (r.metric || "F").toUpperCase(), // device unit for temp sensors
        }));

        // optional filter based on account prefs
        list = list.filter(s => (s.sensor_type === "humidity" ? showHumidity : showTemp));

        setSensors(list);
        if (list.length) setActiveSensorId(list[0].sensor_id);
      } catch (e) {
        setErrMsg("Failed to load sensors: " + (e?.message || String(e)));
      } finally {
        setLoading(false);
      }
    })();
  }, [showTemp, showHumidity]);

  const activeSensor = useMemo(
    () => sensors.find(s => s.sensor_id === activeSensorId) || null,
    [sensors, activeSensorId]
  );

  /* metric/unit from sensor_type + user preference */
  useEffect(() => {
    if (!activeSensor) return;
    if (activeSensor.sensor_type === "humidity") {
      setMetric("humidity");
      setUnit("%");
    } else {
      setMetric("temperature");
      setUnit(tempScale === "C" ? "°C" : "°F");
    }
  }, [activeSensor, tempScale]);

  /* ===== Fetch history (approx_time) ===== */
  useEffect(() => {
    (async () => {
      if (!activeSensor) { setRows([]); return; }
      try {
        const end = Date.now();
        const start = end - rangeHours * 3600 * 1000;
        const fromIso = new Date(start).toISOString();

        const { data, error } = await supabase
          .from("raw_readings_v2")
          .select("reading_value, approx_time, timestamp")
          .eq("sensor_id", activeSensor.sensor_id)
          .gte("approx_time", fromIso)
          .order("approx_time", { ascending: true })
          .limit(20_000);

        if (error) throw error;

        const deviceMetric = (activeSensor.metric || "F").toUpperCase();

        // humidity never converted; temp converts to user's unit
        const convert = (v) => {
          if (metric !== "temperature") return Number(v);
          if (tempScale === "C" && deviceMetric !== "C") return toC(Number(v));
          if (tempScale === "F" && deviceMetric !== "F") return toF(Number(v));
          return Number(v);
        };

        const cleaned = (data || []).map(r => ({
          tsISO: r.approx_time || epochToIso(r.timestamp),
          value: convert(r.reading_value),
        }));

        setRows(cleaned);
        setZoomDomain(null); // clear zoom when sensor/range changes
      } catch (e) {
        setErrMsg("Failed to load history: " + (e?.message || String(e)));
        setRows([]);
      }
    })();
  }, [activeSensorId, rangeHours, metric, tempScale]);

  /* ===== Realtime (unit-aware) ===== */
  useEffect(() => {
    if (!activeSensor) return;

    const deviceMetric = (activeSensor.metric || "F").toUpperCase();
    const convert = (v) => {
      if (metric !== "temperature") return Number(v); // humidity untouched
      if (tempScale === "C" && deviceMetric !== "C") return toC(Number(v));
      if (tempScale === "F" && deviceMetric !== "F") return toF(Number(v));
      return Number(v);
    };

    const ch = supabase
      .channel("rrv2-history")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "raw_readings_v2" }, (payload) => {
        const r = payload.new || {};
        if (r.sensor_id !== activeSensor.sensor_id) return;
        if (typeof r.reading_value === "undefined") return;
        const tsISO = r.approx_time || epochToIso(r.timestamp);
        setRows(prev => [...prev, { tsISO, value: convert(r.reading_value) }].slice(-20_000));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [activeSensorId, metric, tempScale]);

  /* ===== Chart domain, scaling, geometry ===== */
  const nowMs = Date.now();
  const fullStartMs = nowMs - rangeHours * 3600 * 1000; // entire selected range
  const domainStart = zoomDomain?.startMs ?? fullStartMs;
  const domainEnd   = zoomDomain?.endMs   ?? nowMs;
  const visibleMs   = domainEnd - domainStart;

  const scaleXTime = (ms) => {
    const t = (ms - domainStart) / Math.max(1, visibleMs);
    return Math.max(0, Math.min(1, t)) * W;
  };

  // Y bounds adapt to data and unit
  const yBounds = useMemo(() => {
    if (!rows.length) {
      return metric === "humidity" ? { min: 0, max: 100 }
           : tempScale === "C"    ? { min: -20, max: 40 }
                                  : { min: -10, max: 80 };
    }
    const vals = rows.map(r => r.value).filter(Number.isFinite);
    if (!vals.length) {
      return metric === "humidity" ? { min: 0, max: 100 }
           : tempScale === "C"    ? { min: -20, max: 40 }
                                  : { min: -10, max: 80 };
    }
    let min = Math.min(...vals), max = Math.max(...vals);
    const pad = metric === "humidity" ? 5 : (tempScale === "C" ? 2 : 3);
    min = Math.floor(min - pad); max = Math.ceil(max + pad);
    if (metric === "humidity") { min = Math.max(0, min); max = Math.min(100, Math.max(10, max)); }
    if (min === max) { min -= 1; max += 1; }
    return { min, max };
  }, [rows, metric, tempScale]);

  const scaleY = (v) => {
    const { min, max } = yBounds;
    const clamped = Math.max(min, Math.min(v, max));
    return H - ((clamped - min) / (max - min)) * H;
  };

  // Positioned points within current domain
  const points = useMemo(() => {
    return rows.map(r => {
      const ms = new Date(r.tsISO).getTime();
      return { tsISO: r.tsISO, ms, x: scaleXTime(ms), y: scaleY(r.value), value: r.value };
    }).filter(p => p.ms >= domainStart && p.ms <= domainEnd);
  }, [rows, domainStart, domainEnd, yBounds]);

  // Gap detection (≥ 5 minutes)
  const GAP_MS = 5 * 60 * 1000;
  const { segments, gaps } = useMemo(() => {
    const segs = [];
    const grey = [];

    if (!points.length) return { segments: segs, gaps: grey };

    let cur = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const p = points[i];
      if (p.ms - prev.ms >= GAP_MS) {
        if (cur.length) segs.push(cur);
        grey.push({ x1: scaleXTime(prev.ms), x2: scaleXTime(p.ms) });
        cur = [p];
      } else {
        cur.push(p);
      }
    }
    if (cur.length) segs.push(cur);

    // Leading gap (window start → first)
    const first = points[0];
    if (first && first.ms - domainStart >= GAP_MS) {
      grey.unshift({ x1: scaleXTime(domainStart), x2: scaleXTime(first.ms) });
    }
    // Trailing gap (last → window end)
    const last = points[points.length - 1];
    if (last && domainEnd - last.ms >= GAP_MS) {
      grey.push({ x1: scaleXTime(last.ms), x2: scaleXTime(domainEnd) });
    }

    return { segments: segs, gaps: grey };
  }, [points, domainStart, domainEnd]);

  // Ticks based on *visible* domain; more ticks when zoomed very tight
  const tickCount = visibleMs <= 6 * 60 * 1000 ? 8 : 6;
  const baseIsWeekPlus = ["1W", "1M", "3M"].includes(rangeKey);
  const ticks = useMemo(() => {
    const step = visibleMs / (tickCount - 1);
    return Array.from({ length: tickCount }, (_, i) => domainStart + i * step);
  }, [domainStart, visibleMs, tickCount]);

  // Tooltip: nearest by x
  useEffect(() => {
    const onMove = (e) => {
      const el = chartRef.current;
      if (!el || !points.length) return;
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      let best = Infinity, pick = null;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs(px - points[i].x);
        if (d < best) { best = d; pick = points[i]; }
      }
      setHovered(pick);
    };
    const onLeave = () => setHovered(null);
    const el = chartRef.current;
    if (el) { el.addEventListener("mousemove", onMove); el.addEventListener("mouseleave", onLeave); }
    return () => { if (el) { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); } };
  }, [points]);

  /* ===== Zoom (wheel/pinch) & Pan (drag with threshold) ===== */
  useEffect(() => {
    const wrap = svgWrapRef.current;
    if (!wrap) return;

    // --- Zoom on wheel or pinch ---
    const onWheel = (e) => {
      e.preventDefault(); // enables pinch zoom on trackpads too
      const rect = wrap.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, e.offsetX / rect.width));
      const center = domainStart + t * visibleMs;

      const factor = e.deltaY < 0 ? 0.85 : 1.15; // in/out
      let newStart = center - (center - domainStart) * factor;
      let newEnd   = center + (domainEnd - center) * factor;

      // Minimum window 2 minutes
      const MIN = 2 * 60 * 1000;
      if (newEnd - newStart < MIN) {
        const mid = (newStart + newEnd) / 2;
        newStart = mid - MIN / 2;
        newEnd   = mid + MIN / 2;
      }

      // Clamp to full selected range
      const fullStart = fullStartMs;
      const fullEnd   = nowMs;
      newStart = Math.max(fullStart, newStart);
      newEnd   = Math.min(fullEnd, newEnd);

      setZoomDomain({ startMs: newStart, endMs: newEnd });
    };

    // --- Pan by dragging when zoomed in (NOT on click) ---
    const canPan = visibleMs < (nowMs - fullStartMs) - 500;
    const onDown = (e) => {
      if (!canPan || e.button !== 0) return;
      setIsDragging(true);
      setIsPanning(false); // becomes true after threshold
      dragStart.current = { x: e.clientX, startMs: domainStart, endMs: domainEnd };
    };
    const onMove = (e) => {
      if (!isDragging) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - dragStart.current.x;

      // ignore small movements so clicks don't pan
      if (!isPanning && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      if (!isPanning) setIsPanning(true);

      const frac = dx / rect.width;           // pixels → fraction
      const shift = -frac * (dragStart.current.endMs - dragStart.current.startMs);
      let newStart = dragStart.current.startMs + shift;
      let newEnd   = dragStart.current.endMs + shift;

      // clamp to full range
      const span = newEnd - newStart;
      if (newStart < fullStartMs) { newStart = fullStartMs; newEnd = fullStartMs + span; }
      if (newEnd > nowMs) { newEnd = nowMs; newStart = nowMs - span; }

      setZoomDomain({ startMs: newStart, endMs: newEnd });
    };
    const onUp = () => {
      setIsDragging(false);
      setIsPanning(false);
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [visibleMs, domainStart, domainEnd, nowMs, fullStartMs]);

  /* ===== UI helpers ===== */
  const RangeButtons = () => (
    <div className="flex gap-2">
      {RANGES.map((r) => {
        const active = r.key === rangeKey;
        return (
          <button
            key={r.key}
            onClick={() => { setRangeKey(r.key); resetZoom(); }}
            className={`px-2.5 py-1.5 rounded-md border text-xs transition
              ${active
                ? (darkMode ? "bg-emerald-600 border-emerald-600 text-white" : "bg-emerald-500 border-emerald-500 text-white")
                : (darkMode ? "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50")}`}
          >
            {r.key}
          </button>
        );
      })}
      <button
        onClick={resetZoom}
        className={`px-2.5 py-1.5 rounded-md border text-xs ${
          darkMode ? "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50"
        }`}
        title="Reset zoom"
      >
        Reset
      </button>
    </div>
  );
useEffect(() => {
  if (!activeSensor) return;
  const isHumidity = (activeSensor.sensor_type || "").toLowerCase() === "humidity";

  if (isHumidity) {
    setMetric("humidity");
    setUnit("%");                 // never tied to tempScale
  } else {
    setMetric("temperature");
    setUnit(tempScale === "C" ? "°C" : "°F");
  }
}, [activeSensor, tempScale]);

  const SensorButtons = () => (
    <div className="flex flex-wrap gap-2">
      {sensors.map((s) => {
        const active = s.sensor_id === activeSensorId;
        return (
          <button
            key={s.sensor_id}
            onClick={() => { setActiveSensorId(s.sensor_id); resetZoom(); }}
            className={`px-3 py-1.5 rounded-full border text-sm transition
              ${active
                ? (darkMode ? "bg-blue-600 border-blue-600 text-white" : "bg-blue-500 border-blue-500 text-white")
                : (darkMode ? "bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600" : "bg-white border-gray-300 hover:bg-gray-50")}`}
            title={s.sensor_type === "humidity" ? "Humidity sensor" : "Temperature sensor"}
          >
            {s.name}
          </button>
        );
      })}
      {!sensors.length && <span className={darkMode ? "text-gray-400" : "text-gray-500"}>No sensors found</span>}
    </div>
  );

  /* ===== Loading skeleton ===== */
  if (loading && !sensors.length) {
    return (
      <ErrorBoundary darkMode={darkMode}>
        <div className={`flex min-h-screen ${darkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-800"}`}>
          <Sidebar activeKey="history" darkMode={darkMode} />
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p>Loading history…</p>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  const empty = points.length === 0;

  /* ===== Render ===== */
  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"}`}>
        <Sidebar activeKey="history" darkMode={darkMode} />
        <main className="flex-1 p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">History</h2>
            <div className="flex items-center space-x-3">
              {errMsg && <p className="text-red-500 text-sm">{errMsg}</p>}
              <button
                onClick={async () => {
                  try { const { error } = await supabase.auth.signOut(); if (error) throw error; router.push("/login"); }
                  catch (e) { setErrMsg("Failed to sign out: " + (e?.message || String(e))); }
                }}
                className={`px-4 py-2 rounded ${darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"}`}
              >
                Log out
              </button>
              <div className={`${darkMode ? "bg-amber-700" : "bg-amber-600"} w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold`}>FA</div>
            </div>
          </div>

          {/* Card */}
          <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 border-blue-700" : "bg-white border-blue-300"} border`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold">Sensor History</h3>
                <p className={`${darkMode ? "text-green-400" : "text-green-700"} text-sm`}>
                  {activeSensor
                    ? `${activeSensor.name} • ${metric === "humidity" ? "Humidity" : `Temperature (${unit})`}`
                    : "Select a sensor"}
                </p>
              </div>
              <RangeButtons />
            </div>

            <div className="mb-4 overflow-x-auto pb-2">
              <SensorButtons />
            </div>

            {/* Chart */}
            <div className="relative">
              <div className="flex">
                {/* Left Y-axis */}
                <div className="flex flex-col items-end pr-4 mr-4">
                  <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"} transform -rotate-90 origin-bottom-left absolute top-1/2 -translate-y-1/2 -left-8 w-64 text-center font-medium`}>
                    {metric === "humidity" ? "Humidity (%)" : `Temperature (${unit})`}
                  </div>
                  <div className="flex flex-col justify-between h-80 text-sm">
                    {(() => {
                      const { min, max } = yBounds;
                      const steps = 6;
                      const ticksY = Array.from({ length: steps + 1 }, (_, i) =>
                        Math.round(max - (i * (max - min)) / steps)
                      );
                      return ticksY.map((val, idx) => (
                        <div key={idx} className="flex items-center">
                          <span className={`${darkMode ? "text-gray-400" : "text-gray-500"} leading-none mr-3 w-14 text-right`}>
                            {val}
                          </span>
                          <div className={`w-2 border-t ${darkMode ? "border-gray-600" : "border-gray-300"}`}></div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Plot area (wheel zoom + drag pan with threshold) */}
                <div className="flex-1 relative">
                  <div
                    ref={svgWrapRef}
                    className={`h-80 relative ${isDragging || isPanning ? "cursor-grabbing" : (visibleMs < (nowMs - fullStartMs) - 500 ? "cursor-grab" : "cursor-default")}`}
                  >
                    <svg
                      ref={chartRef}
                      width="100%"
                      height={H}
                      viewBox={`0 0 ${W} ${H}`}
                      preserveAspectRatio="none"
                      className={`border-b border-l ${darkMode ? "border-gray-600" : "border-gray-300"}`}
                    >
                      {/* grid */}
                      {Array.from({ length: 7 }).map((_, i) => {
                        const y = (i / 6) * H;
                        return (
                          <line
                            key={i}
                            x1="0" y1={y} x2={W} y2={y}
                            stroke={darkMode ? "#4b5563" : "#e5e7eb"}
                            strokeWidth="0.2" strokeDasharray="1,1"
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}

                      {/* grey gaps */}
                      {gaps.map((g, idx) => (
                        <rect
                          key={`gap-${idx}`}
                          x={g.x1}
                          y={0}
                          width={Math.max(0, g.x2 - g.x1)}
                          height={H}
                          fill={darkMode ? "rgba(156,163,175,0.20)" : "rgba(156,163,175,0.20)"}
                        />
                      ))}

                      {/* Segments: area + smooth line */}
                      {segments.length ? (
                        segments.map((seg, idx) => {
                          const path = buildSmoothPath(seg);
                          const area = buildAreaPath(seg);
                          return (
                            <g key={`seg-${idx}`}>
                              <path d={area} fill={darkMode ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.18)"} />
                              <path d={path} fill="none" stroke="#22c55e" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
                            </g>
                          );
                        })
                      ) : null}
                    </svg>

                    {/* Clean “No data” overlay (HTML, not SVG, so it never skews) */}
                    {segments.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={`${darkMode ? "text-gray-400" : "text-gray-500"} text-sm font-medium`}>
                          No data in {RANGES.find(r => r.key === rangeKey)?.label || "range"}
                        </div>
                      </div>
                    )}

                    {/* Tooltip */}
                    {hovered && (
                      <div
                        className="absolute pointer-events-none z-10"
                        style={{
                          left: `${(hovered.x / W) * 100}%`,
                          top: `${hovered.y - 80}px`,
                          transform: "translateX(-50%)",
                        }}
                      >
                        <div className="bg-green-500 text-white p-3 rounded-lg shadow-lg border-2 border-white text-center min-w-36">
                          <div className="text-xs font-medium">{metric === "humidity" ? "Humidity" : "Temperature"}</div>
                          <div className="text-xl font-extrabold leading-tight">
                            {metric === "humidity"
                              ? `${fmt1(hovered.value)}%`
                              : `${fmt1(hovered.value)}${unit}`}
                          </div>
                          <div className="text-xs mt-0.5">{fmtTooltipTime(hovered.tsISO, timeZone)}</div>
                        </div>
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500 mx-auto" />
                      </div>
                    )}

                    {/* X-axis ticks */}
                    <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2">
                      {ticks.map((t, i) => (
                        <span key={i} className={darkMode ? "text-gray-400 text-xs" : "text-gray-600 text-xs"}>
                          {fmtTickSmart(t, visibleMs, baseIsWeekPlus, timeZone)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`mt-10 text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Zoom with <span className="font-semibold">scroll/pinch</span>. When zoomed, <span className="font-semibold">drag</span> to pan. Clicks alone won’t move the chart. Use <span className="font-semibold">Reset</span> to return.
            </div>
            
          </div>
          
        </main>
      </div>
    </ErrorBoundary>
  );
}

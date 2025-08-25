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

// ---------- Styles ----------
const getStatusStyles = (status, darkMode) => {
  switch (status) {
    case 'Needs Attention':
      return {
        section: `${darkMode ? 'bg-red-900 text-red-300' : 'bg-red-200 text-red-900'}`,
        border: 'border-red-500',
        value: 'text-red-600',
      };
    case 'Warning':
      return {
        section: `${darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-200 text-yellow-900'}`,
        border: 'border-yellow-400',
        value: 'text-yellow-600',
      };
    case 'Good':
      return {
        section: `${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-200 text-green-900'}`,
        border: 'border-green-500',
        value: 'text-green-600',
      };
    default:
      return {
        section: `${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-800'}`,
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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const computeStatus = (temp, { min, max, warning = 5 }) => {
  if (temp == null) return 'Good';
  if (temp < min || temp > max) return 'Needs Attention';
  if (temp <= min + warning || temp >= max - warning) return 'Warning';
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
const fToC = (f) => (f - 32) * 5 / 9;
const toF = (val, unit) => (val == null ? null : unit === 'C' ? cToF(Number(val)) : Number(val));

// Convert temperature for display based on user preference
const convertForDisplay = (tempF, userScale) => {
  if (tempF == null) return null;
  return userScale === 'C' ? fToC(tempF) : tempF;
};

// Convert display temperature back to Fahrenheit for storage
const convertFromDisplay = (displayTemp, userScale) => {
  if (displayTemp == null) return null;
  return userScale === 'C' ? cToF(displayTemp) : displayTemp;
};

// ---------- Chart ----------
function ThresholdChart({
  data,
  min,
  max,
  warning = 5, // Default warning margin
  darkMode,
  onChange,
  // Alert Detail extras:
  sensorId,   // to fetch last 30 min + update DB
  unit,       // 'C' | 'F' (display is °F; limits stored as °F)
  editable,   // enables "Edit limits" UX in Alert Detail
  userTempScale = 'F', // User's preferred temperature scale
  sensorType = 'temperature', // 'temperature' | 'humidity'
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  // Lock / edit state
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'

  // Draft values (used while editing)
  const [draftMin, setDraftMin] = useState(min);
  const [draftMax, setDraftMax] = useState(max);
  const [draftWarning, setDraftWarning] = useState(warning);
  const [origMin, setOrigMin] = useState(min);
  const [origMax, setOrigMax] = useState(max);
  const [origWarning, setOrigWarning] = useState(warning);

  // freeze the y-scale while editing
  const [editScaleMin, setEditScaleMin] = useState(null);
  const [editScaleMax, setEditScaleMax] = useState(null);

  // Drag state (disabled unless editing)
  const [drag, setDrag] = useState(null); // 'min' | 'max' | null

  // Hover state for tooltip
  const [hoverInfo, setHoverInfo] = useState(null); // { x, y, value, time, index }

  // Local data: prefer last 30 minutes if we can fetch them
  const [localData, setLocalData] = useState(Array.isArray(data) ? data : []);

  // Keep drafts in sync if parent values change while not editing
  useEffect(() => {
    if (!isEditing) {
      setDraftMin(min);
      setDraftMax(max);
      setDraftWarning(warning);
      setOrigMin(min);
      setOrigMax(max);
      setOrigWarning(warning);
    }
  }, [min, max, warning, isEditing]);

  // Fetch last 30 minutes of readings (if Alert Detail passed sensorId)
  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      if (!sensorId || !supabase) {
        setLocalData(Array.isArray(data) ? data : []);
        return;
      }
      try {
        const now = Date.now();
        const thirtyMinAgoISO = new Date(now - 30 * 60 * 1000).toISOString();
        const thirtyMinAgoSec = Math.floor((now - 30 * 60 * 1000) / 1000);

        let { data: rows, error } = await supabase
          .from('raw_readings_v2')
          .select('reading_value, approx_time, timestamp')
          .eq('sensor_id', sensorId)
          .gte('approx_time', thirtyMinAgoISO)
          .order('approx_time', { ascending: true });

        if (error) throw error;

        if (!rows || rows.length === 0) {
          const { data: rows2, error: err2 } = await supabase
            .from('raw_readings_v2')
            .select('reading_value, timestamp')
            .eq('sensor_id', sensorId)
            .gte('timestamp', thirtyMinAgoSec)
            .order('timestamp', { ascending: true });
          if (err2) throw err2;
          rows = rows2 || [];
        }

        const u = (unit || 'F').toUpperCase() === 'C' ? 'C' : 'F';
        const vals = (rows || []).map((r) => toF(Number(r.reading_value), u));
        if (!cancelled) {
          setLocalData(vals.length ? vals : (Array.isArray(data) ? data : []));
        }
      } catch {
        if (!cancelled) setLocalData(Array.isArray(data) ? data : []);
      }
    };
    fetchRecent();
    return () => { cancelled = true; };
  }, [sensorId, unit, data]);

  // Also load any saved limits from DB (if present) and apply once
  useEffect(() => {
    let cancelled = false;
    const getLimits = async () => {
      if (!sensorId || !supabase) return;
      try {
        const { data: row, error } = await supabase
          .from('sensors')
          .select('min_limit, max_limit, warning_limit')
          .eq('sensor_id', sensorId)
          .maybeSingle();
        if (error) throw error;
        if (!row) return;

        const dbMin = Number(row.min_limit);
        const dbMax = Number(row.max_limit);
        const dbWarning = Number(row.warning_limit);
        if (!cancelled && Number.isFinite(dbMin) && Number.isFinite(dbMax) && dbMin < dbMax) {
          // update parent thresholds to DB values
          onChange && onChange({ 
            min: dbMin, 
            max: dbMax, 
            warning: Number.isFinite(dbWarning) ? dbWarning : Math.max(5, Math.floor((dbMax - dbMin) * 0.1))
          });
        }
      } catch {
        // ignore (no stored limits yet or RLS)
      }
    };
    getLimits();
  }, [sensorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Geometry & helpers ----------
  const W = 720, H = 380;
  const padL = 60, padR = 56, padT = 18, padB = 28;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  // Dynamic zoom based on limits and data - only when not editing
  const plotData = (localData && localData.length ? localData : data) || [];
  const dataMin = plotData.length > 0 ? Math.min(...plotData) : min;
  const dataMax = plotData.length > 0 ? Math.max(...plotData) : max;
  const limitPadding = 10; // Add padding around limits for better visibility
  
  // Use static zoom while editing, dynamic zoom when not editing
  const yMinScale = isEditing 
    ? (editScaleMin !== null ? editScaleMin : Math.min(draftMin - limitPadding, -20)) // Use frozen scale while editing
    : plotData.length > 0 
      ? Math.min(min - limitPadding, Math.min(...plotData) - limitPadding)
      : min - limitPadding;
  const yMaxScale = isEditing 
    ? (editScaleMax !== null ? editScaleMax : Math.max(draftMax + limitPadding, 100)) // Use frozen scale while editing
      : plotData.length > 0 
        ? Math.max(max + limitPadding, Math.max(...plotData) + limitPadding)
        : max + limitPadding;
  
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const y = (t) =>
    padT + chartH * (1 - (clamp(t, yMinScale, yMaxScale) - yMinScale) / (yMaxScale - yMinScale));
  const x = (i) => padL + (chartW * i) / Math.max(1, (plotData.length - 1));
  
  // Create line path with color based only on latest value
  const createColoredLinePath = () => {
    if (plotData.length === 0) return { path: '', segments: [] };
    
    // Only check the latest (most recent) value for line color
    const latestValue = plotData[plotData.length - 1];
    let lineColor = 'green';
    
    if (latestValue < min || latestValue > max) {
      lineColor = 'red'; // Danger zone - latest value is in danger
    } else if (latestValue <= min + warning || latestValue >= max - warning) {
      lineColor = 'orange'; // Warning zone - latest value is in warning
    }
    // Otherwise stays green (latest value is in good zone)
    
    // Create single path for the entire line
    let path = `M ${x(0)} ${y(plotData[0])}`;
    for (let i = 1; i < plotData.length; i++) {
      path += ` L ${x(i)} ${y(plotData[i])}`;
    }
    
    return { 
      path, 
      segments: [{ path, color: lineColor, start: 0, end: plotData.length - 1 }] 
    };
  };
  
  const { segments } = createColoredLinePath();

  const strokeAxis = darkMode ? '#374151' : '#E5E7EB';
  const tickText = darkMode ? '#D1D5DB' : '#6B7280';
  const orange = '#F59E0B';
  const red = '#EF4444';

  const trackX = padL + chartW + 16;
  const trackW = 12, handleW = 18, handleH = 22, handleRX = 4;

  // Warning zones are now calculated directly in the SVG rectangles

  // Drag logic: enabled only in edit mode
  useEffect(() => {
    if (!drag || !isEditing) return;

    // Local helper: screen Y -> temp (°F)
    const posToTemp = (clientY) => {
      const rect = svgRef.current.getBoundingClientRect();
      const yPix = clientY - rect.top;
      const t = yMinScale + (1 - (yPix - padT) / chartH) * (yMaxScale - yMinScale);
      return clamp(Math.round(t), yMinScale, yMaxScale);
    };

    const move = (e) => {
      const t = posToTemp(e.clientY);
      if (drag === 'max') {
        const next = Math.max(draftMin + 1, t);
        setDraftMax(next);
        // Don't call onChange while editing - only update local draft state
      } else {
        const next = Math.min(draftMax - 1, t);
        setDraftMin(next);
        // Don't call onChange while editing - only update local draft state
      }
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, isEditing, draftMin, draftMax, onChange, chartH]); // no posToTemp dep

  // Positions for inline inputs (absolute, next to the track)
  const containerStyles = 'relative w-full max-w-4xl overflow-visible';
  const inputRight = 8; // px from SVG right edge
  
  // Use fixed pixel positions while editing to prevent jumping
  const maxTop = isEditing 
    ? (editScaleMax !== null ? padT + chartH * (1 - (clamp(draftMax, editScaleMin, editScaleMax) - editScaleMin) / (editScaleMax - editScaleMin)) - 12 : y(draftMax) - 12)
    : y(max) - 12;
  const minTop = isEditing 
    ? (editScaleMax !== null ? padT + chartH * (1 - (clamp(draftMin, editScaleMin, editScaleMax) - editScaleMin) / (editScaleMax - editScaleMin)) - 12 : y(draftMin) - 12)
    : y(min) - 12;

  // Handlers
  const startEdit = () => {
    if (!editable) return;
    setOrigMin(min);
    setOrigMax(max);
    setDraftMin(min);
    setDraftMax(max);
    
    // Freeze the Y-scale at current values
    const currentYMin = Math.min(min - limitPadding, -20);
    const currentYMax = Math.max(max + limitPadding, 100);
    setEditScaleMin(currentYMin);
    setEditScaleMax(currentYMax);
    
    setIsEditing(true);
    setSaveStatus('');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setSaveStatus('');
    // Clear frozen scale
    setEditScaleMin(null);
    setEditScaleMax(null);
    // revert parent state if changed
    onChange && onChange({ min: origMin, max: origMax, warning: origWarning });
  };

  const saveEdit = async () => {
    if (!sensorId || !supabase) {
      setIsEditing(false);
      return;
    }
    const nMin = Number(draftMin), nMax = Number(draftMax);
    if (!(Number.isFinite(nMin) && Number.isFinite(nMax) && nMin < nMax)) return;

    try {
      setSaveStatus('saving');
      // persist to DB (store Fahrenheit)
      const { error } = await supabase
        .from('sensors')
        .update({
          min_limit: nMin,
          max_limit: nMax,
          warning_limit: draftWarning,
          updated_at: new Date().toISOString(),
        })
        .eq('sensor_id', sensorId);
      if (error) throw error;

             // reflect in parent
       onChange && onChange({ min: nMin, max: nMax, warning: draftWarning });
       setOrigMin(nMin);
       setOrigMax(nMax);
       setOrigWarning(draftWarning);
       // Clear frozen scale
       setEditScaleMin(null);
       setEditScaleMax(null);
       setIsEditing(false);
       setSaveStatus('saved');
       setTimeout(() => setSaveStatus(''), 1500);
    } catch (e) {
      console.error('Save limits error:', e);
      setSaveStatus('error');
    }
  };

  // Input change helpers (live-preview while editing)
  const setDraftMinClamped = (v) => {
    let val = clamp(Math.round(v), yMinScale, yMaxScale);
    val = Math.min(val, draftMax - 1);
    setDraftMin(val);
    // Don't call onChange while editing - only update local draft state
  };
  const setDraftMaxClamped = (v) => {
    let val = clamp(Math.round(v), yMinScale, yMaxScale);
    val = Math.max(val, draftMin + 1);
    setDraftMax(val);
    // Don't call onChange while editing - only update local draft state
  };

  // Colors for the inline inputs
  const baseInput =
    `w-16 h-6 text-xs rounded border px-1.5 py-0.5 text-right ` +
    (darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-800 border-gray-300') +
    (isEditing ? '' : ' opacity-70 cursor-not-allowed');

  return (
    <div ref={containerRef} className={containerStyles}>
      {/* Edit / Save / Cancel controls (top-right of the chart) */}
      {editable && (
        <div className="flex items-center gap-2 absolute right-0 -top-10 z-20">
          {!isEditing ? (
            <button
              type="button"
              onClick={startEdit}
              className={`px-3 py-1.5 rounded text-sm font-medium border ${
                darkMode
                  ? 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                  : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'
              }`}
              title="Enable editing of limits"
            >
              Edit limits
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                className={`px-3 py-1.5 rounded text-sm ${
                  darkMode ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className={`px-3 py-1.5 rounded text-sm font-semibold text-white ${
                  darkMode ? 'bg-orange-700 hover:bg-orange-800' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {saveStatus === 'saving' ? 'Saving…' : 'Save'}
              </button>
              {saveStatus === 'error' && (
                <span className={darkMode ? 'text-red-300 text-xs' : 'text-red-600 text-xs'}>Save failed</span>
              )}
              {saveStatus === 'saved' && (
                <span className={darkMode ? 'text-green-300 text-xs' : 'text-green-600 text-xs'}>Saved</span>
              )}
            </>
          )}
        </div>
      )}

       <svg ref={svgRef} width={W} height={H} className="block">
         <rect x={padL} y={padT} width={chartW} height={chartH} fill="#FFFFFF" stroke={strokeAxis} />

                   {/* Red & orange bands */}
          {/* Danger zones (red) - above max and below min */}
          <rect x={padL} y={padT} width={chartW} height={Math.max(0, y(isEditing ? draftMax : max) - padT)} fill={red} opacity="0.22" />
          <rect x={padL} y={y(isEditing ? draftMin : min)} width={chartW} height={Math.max(0, padT + chartH - y(isEditing ? draftMin : min))} fill={red} opacity="0.22" />
          
          {/* Warning zones (orange) - between danger and good zones */}
          {/* Upper warning zone - between max and max-warning */}
          <rect 
            x={padL} 
            y={y(isEditing ? draftMax : max)} 
            width={chartW} 
            height={Math.max(0, y(isEditing ? draftMax - draftWarning : max - warning) - y(isEditing ? draftMax : max))} 
            fill={orange} 
            opacity="0.15" 
            stroke={orange}
            strokeWidth="1"
          />
          {/* Lower warning zone - between min and min+warning */}
          <rect 
            x={padL} 
            y={y(isEditing ? draftMin + (isEditing ? draftWarning : warning) : min + warning)} 
            width={chartW} 
            height={Math.max(0, y(isEditing ? draftMin : min) - y(isEditing ? draftMin + (isEditing ? draftWarning : warning) : min + warning))} 
            fill={orange} 
            opacity="0.15" 
            stroke={orange}
            strokeWidth="1"
          />

         {/* Limit lines */}
         <line x1={padL} x2={padL + chartW} y1={y(isEditing ? draftMax : max)} y2={y(isEditing ? draftMax : max)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />
         <line x1={padL} x2={padL + chartW} y1={y(isEditing ? draftMin : min)} y2={y(isEditing ? draftMin : min)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />

                   {/* Y ticks - consistent while editing, dynamic when not editing */}
          {(() => {
            if (sensorType === 'humidity') {
              // For humidity sensors, show percentage ticks (0-100%)
              if (isEditing) {
                // Use consistent percentage ticks while editing
                const humidityTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                return humidityTicks.map((t) => (
                  <g key={t}>
                    <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={strokeAxis} />
                    <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={tickText}>
                      {t}%
                    </text>
                  </g>
                ));
              } else {
                // Dynamic percentage ticks based on zoom when not editing
                const tickStep = Math.ceil((yMaxScale - yMinScale) / 10);
                const ticks = [];
                for (let t = Math.ceil(yMinScale / tickStep) * tickStep; t <= yMaxScale; t += tickStep) {
                  if (t >= yMinScale && t <= yMaxScale) {
                    ticks.push(t);
                  }
                }
                return ticks.map((t) => (
                  <g key={t}>
                    <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={strokeAxis} />
                    <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={tickText}>
                      {Math.round(t)}%
                    </text>
                  </g>
                ));
              }
            } else {
              // For temperature sensors, use existing temperature logic
              if (isEditing) {
                // Use consistent tick marks while editing for better UX
                const baseTicks = userTempScale === 'C' 
                  ? [-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(fToC)
                  : [-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                return baseTicks.map((t) => (
                  <g key={t}>
                    <line x1={padL - 6} x2={padL} y1={y(userTempScale === 'C' ? cToF(t) : t)} y2={y(userTempScale === 'C' ? cToF(t) : t)} stroke={strokeAxis} />
                    <text x={padL - 10} y={y(userTempScale === 'C' ? cToF(t) : t) + 4} textAnchor="end" fontSize="12" fill={tickText}>
                      {Math.round(t)}{userTempScale === 'C' ? '°C' : '°F'}
                    </text>
                  </g>
                ));
              } else {
                // Dynamic ticks based on zoom when not editing
                const tickStep = Math.ceil((yMaxScale - yMinScale) / 10);
                const ticks = [];
                for (let t = Math.ceil(yMinScale / tickStep) * tickStep; t <= yMaxScale; t += tickStep) {
                  if (t >= yMinScale && t <= yMaxScale) {
                    ticks.push(t);
                  }
                }
                return ticks.map((t) => (
                  <g key={t}>
                    <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={strokeAxis} />
                    <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={tickText}>
                      {Math.round(convertForDisplay(t, userTempScale))}{userTempScale === 'C' ? '°C' : '°F'}
                    </text>
                  </g>
                ));
              }
            }
          })()}

                   {/* Series - colored segments */}
          {segments.map((segment, idx) => (
            <g key={idx}>
              {/* Glow effect for warning and danger zones */}
              {segment.color !== 'green' && (
                <path 
                  d={segment.path} 
                  fill="none" 
                  stroke={segment.color === 'red' ? '#DC2626' : '#EA580C'} 
                  strokeWidth="8" 
                  strokeLinecap="round" 
                  opacity="0.3"
                  filter="blur(3px)"
                />
              )}
              {/* Main line */}
              <path 
                d={segment.path} 
                fill="none" 
                stroke={segment.color === 'red' ? '#DC2626' : segment.color === 'orange' ? '#EA580C' : '#10B981'} 
                strokeWidth="3" 
                strokeLinecap="round" 
              />
            </g>
          ))}
         {plotData.length > 0 && (
           <g>
             {/* Glow effect for warning and danger zones */}
             {(() => {
               const temp = plotData[plotData.length - 1];
               if (temp < min || temp > max) {
                 // Danger zone - red glow
                 return (
                   <circle 
                     cx={x(plotData.length - 1)} 
                     cy={y(plotData[plotData.length - 1])} 
                     r="12" 
                     fill="#DC2626" 
                     opacity="0.4"
                     filter="blur(2px)"
                   />
                 );
               } else if (temp <= min + warning || temp >= max - warning) {
                 // Warning zone - orange glow
                 return (
                   <circle 
                     cx={x(plotData.length - 1)} 
                     cy={y(plotData[plotData.length - 1])} 
                     r="12" 
                     fill="#EA580C" 
                     opacity="0.4"
                     filter="blur(2px)"
                   />
                 );
               }
               return null;
             })()}
             {/* Main circle */}
             <circle 
               cx={x(plotData.length - 1)} 
               cy={y(plotData[plotData.length - 1])} 
               r="5" 
               fill={(() => {
                 const temp = plotData[plotData.length - 1];
                 if (temp < min || temp > max) return '#DC2626'; // Red for danger
                 if (temp <= min + warning || temp >= max - warning) return '#EA580C'; // Orange for warning
                 return '#10B981'; // Green for good
               })()}
             />
           </g>
         )}

                   {/* Track */}
          <rect x={padL} y={padT} width={chartW} height={chartH} fill="transparent" />
          <rect 
            x={padL + chartW + 16} 
            y={padT} 
            width={12} 
            height={chartH} 
            fill="#E5E7EB" 
            stroke="#D1D5DB" 
            rx="2"
            style={{ cursor: isEditing ? 'ns-resize' : 'not-allowed' }}
          />

         {/* Handles (locked unless editing) */}
                   <g
            transform={`translate(${padL + chartW + 16 + 12 / 2}, ${y(isEditing ? draftMax : max)})`}
            style={{ cursor: isEditing ? 'ns-resize' : 'not-allowed', pointerEvents: isEditing ? 'auto' : 'none' }}
            onPointerDown={(e) => { if (!isEditing) return; e.preventDefault(); setDrag('max'); }}
          >
            <rect x={-9} y={-11} width={18} height={22} rx={4} fill="#FFFFFF" stroke="#9CA3AF" />
            <line x1={-5} x2={5} y1={-4} y2={-4} stroke="#9CA3AF" strokeWidth="2" />
            <line x1={-5} x2={5} y1={0} y2={0} stroke="#9CA3AF" strokeWidth="2" />
            <line x1={-5} x2={5} y1={4} y2={4} stroke="#9CA3AF" strokeWidth="2" />
          </g>

          <g
            transform={`translate(${padL + chartW + 16 + 12 / 2}, ${y(isEditing ? draftMin : min)})`}
            style={{ cursor: isEditing ? 'ns-resize' : 'not-allowed', pointerEvents: isEditing ? 'auto' : 'none' }}
            onPointerDown={(e) => { if (!isEditing) return; e.preventDefault(); setDrag('min'); }}
          >
            <rect x={-9} y={-11} width={18} height={22} rx={4} fill="#FFFFFF" stroke="#9CA3AF" />
            <line x1={-5} x2={5} y1={-4} y2={-4} stroke="#9CA3AF" strokeWidth="2" />
            <line x1={-5} x2={5} y1={0} y2={0} stroke="#9CA3AF" strokeWidth="2" />
            <line x1={-5} x2={5} y1={4} y2={4} stroke="#9CA3AF" strokeWidth="2" />
          </g>
       </svg>

               {/* Input fields positioned independently to the right of the chart */}
        <div className="absolute right-0 top-0 w-28 space-y-3">
                       {/* Max Limit Input */}
            <div className="flex flex-col items-start">
              <label className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Max Limit
              </label>
              <input
                type="number"
                step="1"
                min={sensorType === 'humidity' ? yMinScale : convertForDisplay(yMinScale, userTempScale)}
                max={sensorType === 'humidity' ? yMaxScale : convertForDisplay(yMaxScale, userTempScale)}
                value={isEditing 
                  ? (sensorType === 'humidity' ? draftMax : convertForDisplay(draftMax, userTempScale))
                  : (sensorType === 'humidity' ? max : convertForDisplay(max, userTempScale))
                }
                disabled={!isEditing}
                onChange={(e) => {
                  const displayVal = Number(e.target.value);
                  if (sensorType === 'humidity') {
                    setDraftMaxClamped(displayVal);
                  } else {
                    const fahrenheitVal = convertFromDisplay(displayVal, userTempScale);
                    setDraftMaxClamped(fahrenheitVal);
                  }
                }}
                className={baseInput}
                title={`Max (${sensorType === 'humidity' ? '%' : userTempScale === 'C' ? '°C' : '°F'})`}
              />
            </div>

            {/* Min Limit Input */}
            <div className="flex flex-col items-start">
              <label className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Min Limit
              </label>
              <input
                type="number"
                step="1"
                min={sensorType === 'humidity' ? yMinScale : convertForDisplay(yMinScale, userTempScale)}
                max={sensorType === 'humidity' ? yMaxScale : convertForDisplay(yMaxScale, userTempScale)}
                value={isEditing 
                  ? (sensorType === 'humidity' ? draftMin : convertForDisplay(draftMin, userTempScale))
                  : (sensorType === 'humidity' ? min : convertForDisplay(min, userTempScale))
                }
                disabled={!isEditing}
                onChange={(e) => {
                  const displayVal = Number(e.target.value);
                  if (sensorType === 'humidity') {
                    setDraftMinClamped(displayVal);
                  } else {
                    const fahrenheitVal = convertFromDisplay(displayVal, userTempScale);
                    setDraftMinClamped(fahrenheitVal);
                  }
                }}
                className={baseInput}
                title={`Min (${sensorType === 'humidity' ? '%' : userTempScale === 'C' ? '°C' : '°F'})`}
              />
            </div>

            {/* Warning Limit Input */}
            <div className="flex flex-col items-start">
              <label className={`text-xs font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Warning
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="20"
                value={isEditing ? draftWarning : warning}
                disabled={!isEditing}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(20, Number(e.target.value)));
                  setDraftWarning(val);
                  // Don't call onChange while editing - only update local draft state
                }}
                className={baseInput}
                title={`Warning margin (${sensorType === 'humidity' ? '%' : userTempScale === 'C' ? '°C' : '°F'})`}
              />
            </div>
         </div>
       </div>
     
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

  // User preferences for temperature scale
  const [userTempScale, setUserTempScale] = useState('F'); // 'F' | 'C'

  // State
  const [streams, setStreams] = useState([]);       // rows for UI list
  const [thresholds, setThresholds] = useState({}); // id -> {min,max,warning}
  const [series, setSeries] = useState({});         // id -> number[]
  const HISTORY_LEN = 120;

  // Sensor Settings state / modal
  const [newSensorName, setNewSensorName] = useState('');
  const [newMetric, setNewMetric] = useState('F'); // 'C' | 'F' stored in DB
  const [newSensorType, setNewSensorType] = useState('temperature'); // 'temperature' | 'humidity'
 
  const [savingSensorName, setSavingSensorName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const makeKey = (sensor_id) => `${sensor_id}::temperature`;

  // Session check and load user preferences
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!sessionData.session) router.push('/login');
        
        // Load user temperature scale preference
        const userId = sessionData.session.user.id;
        const { data: prefsRow } = await supabase
          .from('user_preferences')
          .select('temp_scale')
          .eq('user_id', userId)
          .single();
        
        if (prefsRow?.temp_scale) {
          setUserTempScale(prefsRow.temp_scale);
        }
      } catch (err) {
        console.error('Session check error:', err.message);
        setError('Failed to verify session: ' + err.message);
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  // Initial load: sensors list (read sensor_name + metric + limits)
  useEffect(() => {
    const load = async () => {
      try {
        const { data: sensorRows, error: sErr } = await supabase
          .from('sensors')
          .select('sensor_id, sensor_name, metric, latest_temp, approx_time, last_fetched_time, updated_at, min_limit, max_limit, sensor_type');

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
          // For humidity sensors, keep raw percentage values (0-100)
          // For temperature sensors, convert to Fahrenheit
          const tempF = raw != null 
            ? (r.sensor_type === 'humidity' ? Number(raw) : toF(raw, unit))
            : null;

          const lastIso =
            r.approx_time ||
            r.last_fetched_time ||
            r.updated_at ||
            (lr ? (lr.approx_time ||
              new Date((Number(lr.timestamp) > 1e12 ? Number(lr.timestamp) : Number(lr.timestamp) * 1000)).toISOString()
            ) : null);

                     const th = {
             min: Number.isFinite(r?.min_limit) ? Number(r.min_limit) : 20,
             max: Number.isFinite(r?.max_limit) ? Number(r.max_limit) : 60,
             warning: Number.isFinite(r?.warning_limit) ? Number(r.warning_limit) : 5,
           };
          nextThresholds[key] = th;

          return {
            id: key,
            name: r.sensor_name || r.sensor_id,
            temp: tempF,
            status: computeStatus(tempF, th),
            lastReading: lastIso ? new Date(lastIso).toLocaleString() : 'No readings yet',
            sensor_id: r.sensor_id,
            unit,     // stored unit (C or F)
            metric: 'F', // displayed unit is always F
            sensor_type: r.sensor_type || 'temperature', // 'temperature' | 'humidity'
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
    const metric = sel ? (sel.unit || 'F') : 'F';
    setNewMetric(metric);
    // Auto-set sensor type based on metric
    setNewSensorType(metric === '%' ? 'humidity' : 'temperature');
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
        // For humidity sensors, keep raw percentage values
        // For temperature sensors, convert to Fahrenheit
        const values = (data || []).map((d) => 
          sel.sensor_type === 'humidity' ? Number(d.reading_value) : toF(d.reading_value, unit)
        );
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
        const sensorType = idx !== -1 ? prev[idx].sensor_type : 'temperature';
        // For humidity sensors, keep raw percentage values
        // For temperature sensors, convert to Fahrenheit
        const tempValF = sensorType === 'humidity' 
          ? Number(r.reading_value) 
          : toF(Number(r.reading_value), unit);
        const id = idx !== -1 ? prev[idx].id : makeKey(r.sensor_id);
        const th = thresholds[id] || { min: 20, max: 60 }; // fallback only if not loaded yet
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
        const sensorType = existing?.sensor_type || 'temperature';
        // For humidity sensors, keep raw percentage values
        // For temperature sensors, convert to Fahrenheit
        const nextVal = sensorType === 'humidity' 
          ? Number(r.reading_value) 
          : toF(Number(r.reading_value), unit);
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

      // Find the sensor to get its type
      const sensor = streams.find(s => s.sensor_id === sensor_id);
      const sensorType = sensor?.sensor_type || 'temperature';
      
      // For humidity sensors, keep raw percentage values
      // For temperature sensors, convert to Fahrenheit
      const latestTempF = latest 
        ? (sensorType === 'humidity' ? Number(latest.reading_value) : toF(latest.reading_value, unit))
        : null;
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
        // For humidity sensors, keep raw percentage values
        // For temperature sensors, convert to Fahrenheit
        const values = hist.map((d) => 
          sensorType === 'humidity' ? Number(d.reading_value) : toF(d.reading_value, unit)
        );
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

    const targetMetric = newMetric === '%' ? '%' : 
                     (newMetric || 'F').toUpperCase() === 'C' ? 'C' : 'F';
    const targetSensorType = newSensorType || 'temperature';

    try {
      setSavingSensorName(true);

      const updatePayload = {
        updated_at: new Date().toISOString(),
      };
      if (nextName !== sel.name) updatePayload.sensor_name = nextName;
      if (targetMetric !== sel.unit) updatePayload.metric = targetMetric;
      if (targetSensorType !== sel.sensor_type) updatePayload.sensor_type = targetSensorType;

      // if nothing changed, just close
      if (!updatePayload.sensor_name && !updatePayload.metric && !updatePayload.sensor_type) {
        setShowSettings(false);
        return;
      }

      const { data, error } = await supabase
        .from('sensors')
        .update(updatePayload)
        .eq('sensor_id', sel.sensor_id)
        .select('sensor_id, sensor_name, metric, sensor_type')
        .maybeSingle();

      if (error) {
        throw new Error(`Supabase update error: ${JSON.stringify(error)}`);
      }
      if (!data) {
        throw new Error('Update returned no row. Check RLS or sensor_id.');
      }

      // reflect DB values in UI
      const dbName = data.sensor_name ?? sel.name;
      const dbUnit = data.metric === '%' ? '%' : 
                     (data.metric || sel.unit || 'F').toUpperCase() === 'C' ? 'C' : 'F';
      const dbSensorType = data.sensor_type || sel.sensor_type || 'temperature';

      setStreams((prev) =>
        prev
          .map((row) =>
            row.sensor_id === sel.sensor_id
              ? { ...row, name: dbName, unit: dbUnit, sensor_type: dbSensorType }
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

  // Update thresholds in state (used by list statuses and detail header)
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
              {sensor.sensor_type === 'humidity' ? (
                '💧 ' + (sensor.temp != null && !Number.isNaN(sensor.temp) ? sensor.temp.toFixed(1) : '--') + '%'
              ) : (
                '🌡️ ' + (sensor.temp != null && !Number.isNaN(sensor.temp) ? convertForDisplay(sensor.temp, userTempScale).toFixed(1) : '--') + (userTempScale === 'C' ? '°C' : '°F')
              )}
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
        <div className={`col-span-full p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No system alerts at this time
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
    const t = thresholds[selected.id] || { min: 20, max: 60 };
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
                  {selected.sensor_type === 'humidity' ? (
                    '💧 ' + (selected.temp != null ? selected.temp.toFixed(1) : '--') + '%'
                  ) : (
                    '🌡️ ' + (selected.temp != null ? convertForDisplay(selected.temp, userTempScale).toFixed(1) : '--') + (userTempScale === 'C' ? '°C' : '°F')
                  )}
                </div>
                <button
                  onClick={() => { 
                    setNewSensorName(selected.name || ''); 
                    const metric = selected.unit || 'F';
                    setNewMetric(metric); 
                    setNewSensorType(metric === '%' ? 'humidity' : 'temperature');
                    setShowSettings(true); 
                  }}
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

                <label className="block text-sm font-medium mb-2">Sensor Type</label>
                <select
                  value={newSensorType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setNewSensorType(type);
                    // Auto-set metric based on sensor type
                    if (type === 'humidity') {
                      setNewMetric('%');
                    } else {
                      setNewMetric('F'); // Default to Fahrenheit for temperature
                    }
                  }}
                  className={`border rounded px-3 py-2 w-full mb-4 ${
                    darkMode
                      ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500'
                      : 'bg-white border-gray-300 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                >
                  <option value="temperature">Temperature</option>
                  <option value="humidity">Humidity</option>
                </select>

                <label className="block text-sm font-medium mb-2">Metric (sensor unit)</label>
                <select
                  value={newMetric}
                  onChange={(e) => {
                    const metric = e.target.value;
                    setNewMetric(metric);
                    // Auto-set sensor type based on metric
                    setNewSensorType(metric === '%' ? 'humidity' : 'temperature');
                  }}
                  className={`border rounded px-3 py-2 w-full mb-2 ${
                    darkMode
                      ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500'
                      : 'bg-white border-gray-300 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                >
                  {newSensorType === 'humidity' ? (
                    <option value="%">Percentage (%)</option>
                  ) : (
                    <>
                      <option value="F">Fahrenheit (°F)</option>
                      <option value="C">Celsius (°C)</option>
                    </>
                  )}
                </select>
                <p className={`text-xs mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {newSensorType === 'humidity' 
                    ? 'Humidity sensors measure moisture levels in percentage.'
                    : 'The dashboard always displays temperatures in °F. If your sensor reports in °C, we\'ll convert to °F for display.'
                  }
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
                 <h3 className="text-lg font-semibold">
                   {selected.sensor_type === 'humidity' ? 'Humidity History' : 'Temperature History'}
                 </h3>
                 <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                   {selected.name} • {selected.sensor_type === 'humidity' ? '%' : 'F'}
                 </p>
               </div>
               <div className="text-sm">
                 Limits: <strong>{t.min}{selected.sensor_type === 'humidity' ? '%' : '°F'}</strong> – <strong>{t.max}{selected.sensor_type === 'humidity' ? '%' : '°F'}</strong>
               </div>
             </div>

                         <div className="flex justify-start">
                              <ThresholdChart
                  data={data}
                  min={t.min}
                  max={t.max}
                  warning={t.warning}
                  darkMode={darkMode}
                  onChange={({ min, max, warning }) => updateThreshold(selected.name, { min, max, warning })}
                  sensorId={selected.sensor_id}
                  unit={selected.unit}
                  editable
                  userTempScale={userTempScale}
                  sensorType={selected.sensor_type}
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
                 <span className="font-medium">
                   {t.min}{selected.sensor_type === 'humidity' ? '%' : '°F'} - {t.max}{selected.sensor_type === 'humidity' ? '%' : '°F'}
                 </span>
               </div>
               <div className="flex justify-between">
                 <span>{selected.sensor_type === 'humidity' ? 'Humidity' : 'Air Temperature'}</span>
                 <span className="font-medium">
                   {selected.temp != null ? selected.temp.toFixed(1) : '--'}{selected.sensor_type === 'humidity' ? '%' : '°F'}
                 </span>
               </div>
               <div className="flex justify-between">
                 <span>Displayed Unit</span>
                 <span className="font-medium">
                   {selected.sensor_type === 'humidity' ? 'Percentage (%)' : 'Fahrenheit (°F)'}
                 </span>
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
             Drag the side handles to set minimum and maximum temperature limits. Warning zone is configurable and will never overlap with the danger zone.
           </p>

                     <div className="flex justify-center">
             {/* Demo chart in Add Alert left unchanged */}
                                                    <ThresholdChart data={[32, 33, 31, 34, 30, 29]} min={25} max={40} warning={3} darkMode={darkMode} userTempScale={userTempScale} sensorType="temperature" />
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

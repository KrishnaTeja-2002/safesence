'use client';

import React, { useEffect, useMemo, useRef, useState, Component } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

/* -------------------- Supabase (inline keys) -------------------- */
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/* -------------------- Error Boundary -------------------- */
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

/* -------------------- Helpers -------------------- */
const cToF = (c) => (c * 9) / 5 + 32;
const fToC = (f) => (f - 32) * 5 / 9;
const toF = (val, unit) => (val == null ? null : unit === 'C' ? cToF(Number(val)) : Number(val));
const convertForDisplay = (tempF, userScale) =>
  tempF == null ? null : userScale === 'C' ? fToC(tempF) : tempF;
const convertFromDisplay = (displayTemp, userScale) =>
  displayTemp == null ? null : userScale === 'C' ? cToF(displayTemp) : tempF;

const toLocalFromReading = (r) => {
  try {
    if (r?.last_fetched_time) return new Date(r.last_fetched_time).toLocaleString();
    if (r?.timestamp != null) {
      const n = Number(r.timestamp);
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms).toLocaleString();
    }
  } catch {}
  return '—';
};

/* -------------------- Status -------------------- */
/** 
 * Computes sensor status based on:
 * 1. Time difference: If sensor last_fetched_time (EST) differs by 30+ minutes from user timezone → Unconfigured
 * 2. Temperature limits: If min/max missing or invalid → Unconfigured
 * 3. Temperature values: Based on thresholds → Needs Attention, Warning, or Good
 */
const computeStatus = (temp, { min, max, warning }, sensorApproxTime, userTimeZone) => {
  // Check if sensor time differs by 30+ minutes from current time
  if (sensorApproxTime) {
    try {
      // Parse the sensor last_fetched_time
      const sensorTime = new Date(sensorApproxTime);
      
      // Get current time in UTC to avoid timezone confusion
      const currentTime = new Date();
      
      // Calculate time difference in minutes
      const timeDiffMinutes = Math.abs(currentTime.getTime() - sensorTime.getTime()) / (1000 * 60);
      
      // Debug logging
      console.log(`Sensor ${sensorApproxTime}: sensorTime=${sensorTime.toISOString()}, currentTime=${currentTime.toISOString()}, diff=${timeDiffMinutes.toFixed(2)} minutes`);
      
      // If time difference is 30 minutes or more, mark as Unconfigured
      if (timeDiffMinutes >= 30) {
        console.log(`Sensor marked as Unconfigured due to time difference: ${timeDiffMinutes.toFixed(2)} minutes`);
        return 'Unconfigured';
      }
      
      // If sensor has recent activity (within 30 minutes), continue with normal status logic
      console.log(`Sensor has recent activity, proceeding with normal status logic`);
    } catch (error) {
      console.error('Error calculating time difference:', error);
      // If there's an error calculating time, continue with normal status logic
    }
  } else {
    // If no timestamp available, mark as Unconfigured
    console.log('Sensor marked as Unconfigured: no timestamp available');
    return 'Unconfigured';
  }
  
  if (temp == null) {
    console.log('Sensor marked as Unconfigured: temperature is null');
    return 'Unconfigured';
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || Number(min) >= Number(max)) {
    console.log(`Sensor marked as Unconfigured: invalid limits - min: ${min}, max: ${max}, warning: ${warning}`);
    return 'Unconfigured';
  }
  const span = Number(max) - Number(min);
  const margin = Math.max(0, Math.min(Number(warning ?? 0), span / 2)); // clamp to half-range
  if (temp < Number(min) || temp > Number(max)) {
    console.log(`Sensor status: Needs Attention - temp: ${temp}, min: ${min}, max: ${max}`);
    return 'Needs Attention';
  }
  if (temp < Number(min) + margin || temp > Number(max) - margin) {
    console.log(`Sensor status: Warning - temp: ${temp}, min: ${min}, max: ${max}, margin: ${margin}`);
    return 'Warning';
  }
  console.log(`Sensor status: Good - temp: ${temp}, min: ${min}, max: ${max}, margin: ${margin}`);
  return 'Good';
};

/* -------------------- Styles -------------------- */
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
  Unconfigured: {
    light: 'bg-gray-50 border-gray-300 text-gray-800',
    dark: 'bg-gray-900/40 border-gray-500 text-gray-100',
  },
};
const cardClass = (status, darkMode) =>
  (darkMode ? CARD_STYLES[status]?.dark : CARD_STYLES[status]?.light) ||
  (darkMode ? 'bg-gray-800 border-gray-500 text-white' : 'bg-white border-gray-300 text-gray-800');



/* -------------------- Chart Component -------------------- */
function ThresholdChart({
  data,
  min,
  max,
  warning,
  darkMode,
  onChange,
  sensorId,
  unit,
  editable,
  userTempScale = 'F',
  sensorType = 'temperature',
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

  // Local data: prefer last 30 minutes if we can fetch them
  const [localData, setLocalData] = useState(Array.isArray(data) ? data : []);
  const [localDataWithTimestamps, setLocalDataWithTimestamps] = useState([]);

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
        const thirtyMinpprox_goSec = Math.floor((now - 30 * 60 * 1000) / 1000);

        let { data: rows, error } = await supabase
          .from('raw_readings_v2')
          .select('reading_value, fetched_at, timestamp')
          .eq('sensor_id', sensorId)
          .gte('fetched_at', thirtyMinAgoISO)
          .order('fetched_at', { ascending: true });

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
        
        // Create data with timestamps for gap detection
        const dataWithTimestamps = (rows || []).map((r, index) => ({
          value: vals[index],
          timestamp: r.fetched_at || r.timestamp,
          reading_value: r.reading_value
        }));
        
        if (!cancelled) {
          setLocalData(vals.length ? vals : (Array.isArray(data) ? data : []));
          setLocalDataWithTimestamps(dataWithTimestamps);
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
            warning: Number.isFinite(dbWarning) ? dbWarning : Math.floor((dbMax - dbMin) * 0.1)
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
  const limitPadding = 10; // Add padding around limits for better visibility
  
  // Function to detect data gaps and create grey shading areas
  const createGapShading = () => {
    if (!localDataWithTimestamps || localDataWithTimestamps.length < 2) return [];
    
    const gaps = [];
    const now = Date.now();
    const thirtyMinAgo = now - 30 * 60 * 1000;
    
    // Create a continuous timeline from 30 minutes ago to now
    const timeline = [];
    for (let time = thirtyMinAgo; time <= now; time += 2 * 60 * 1000) { // 2-minute intervals
      timeline.push(time);
    }
    
    // Find gaps in the data
    for (let i = 0; i < timeline.length - 1; i++) {
      const startTime = timeline[i];
      const endTime = timeline[i + 1];
      
      // Check if there's data in this 2-minute window
      const hasData = localDataWithTimestamps.some(d => {
        const dataTime = new Date(d.timestamp).getTime();
        return dataTime >= startTime && dataTime < endTime;
      });
      
      if (!hasData) {
        // This is a gap - create a grey rectangle
        const startX = x(startTime);
        const endX = x(endTime);
        
        gaps.push({
          x: startX,
          width: endX - startX,
          startTime,
          endTime
        });
      }
    }
    
    return gaps;
  };
  
  const dataGaps = createGapShading();
  
  // Use static zoom while editing, dynamic zoom when not editing
  const yMinScale = isEditing 
    ? (editScaleMin !== null ? editScaleMin : (draftMin !== null ? draftMin - limitPadding : -20)) // Use frozen scale while editing
    : plotData.length > 0 
      ? (min !== null ? Math.min(min - limitPadding, Math.min(...plotData) - limitPadding) : Math.min(...plotData) - limitPadding)
      : (min !== null ? min - limitPadding : -20);
  const yMaxScale = isEditing 
    ? (editScaleMax !== null ? editScaleMax : (draftMax !== null ? draftMax + limitPadding : 100)) // Use frozen scale while editing
      : plotData.length > 0 
        ? (max !== null ? Math.max(max + limitPadding, Math.max(...plotData) + limitPadding) : Math.max(...plotData) + limitPadding)
        : (max !== null ? max + limitPadding : 100);
  
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const y = (t) =>
    padT + chartH * (1 - (clamp(t, yMinScale, yMaxScale) - yMinScale) / (yMaxScale - yMinScale));
  
  // X-axis mapping: map time to chart coordinates
  const x = (timeOrIndex) => {
    if (typeof timeOrIndex === 'number' && timeOrIndex >= 0 && timeOrIndex < plotData.length) {
      // Legacy support for index-based positioning
      return padL + (chartW * timeOrIndex) / Math.max(1, (plotData.length - 1));
    } else if (typeof timeOrIndex === 'number') {
      // Time-based positioning for 30-minute window
      const now = Date.now();
      const thirtyMinAgo = now - 30 * 60 * 1000;
      const timeProgress = (timeOrIndex - thirtyMinAgo) / (now - thirtyMinAgo);
      return padL + (chartW * Math.max(0, Math.min(1, timeProgress)));
    }
    return padL;
  };
  
  // Create line path with color based only on latest value
  const createColoredLinePath = () => {
    if (plotData.length === 0 || !localDataWithTimestamps || localDataWithTimestamps.length === 0) {
      return { path: '', segments: [] };
    }
    
    // Only check the latest (most recent) value for line color
    const latestValue = plotData[plotData.length - 1];
    let lineColor = 'green'; // Default color when no thresholds set
    
    if (min !== null && max !== null && warning !== null) {
      if (latestValue < min || latestValue > max) {
        lineColor = 'red'; // Danger zone - latest value is in danger
      } else if (latestValue <= min + warning || latestValue >= max - warning) {
        lineColor = 'orange'; // Warning zone - latest value is in warning
      }
    }
    // Otherwise stays green (latest value is in good zone or no thresholds set)
    
    // Create path using timestamps for proper 30-minute window positioning
    let path = '';
    if (localDataWithTimestamps.length > 0) {
      const firstPoint = localDataWithTimestamps[0];
      path = `M ${x(new Date(firstPoint.timestamp).getTime())} ${y(firstPoint.value)}`;
      
      for (let i = 1; i < localDataWithTimestamps.length; i++) {
        const point = localDataWithTimestamps[i];
        path += ` L ${x(new Date(point.timestamp).getTime())} ${y(point.value)}`;
      }
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
  
  // Use fixed pixel positions while editing to prevent jumping
  const maxTop = isEditing 
    ? (editScaleMax !== null ? padT + chartH * (1 - (clamp(draftMax, editScaleMin, editScaleMax) - editScaleMin) / (editScaleMax - editScaleMin)) - 12 : y(draftMax) - 12)
    : (max !== null ? y(max) - 12 : 0);
  const minTop = isEditing 
    ? (editScaleMax !== null ? padT + chartH * (1 - (clamp(draftMin, editScaleMin, editScaleMax) - editScaleMin) / (editScaleMax - editScaleMin)) - 12 : y(draftMin) - 12)
    : (min !== null ? y(min) - 12 : 0);

  // Handlers
  const startEdit = () => {
    if (!editable) return;
    setOrigMin(min);
    setOrigMax(max);
    setDraftMin(min);
    setDraftMax(max);
    
    // Freeze the Y-scale at current values
    const currentYMin = min !== null ? Math.min(min - limitPadding, -20) : -20;
    const currentYMax = max !== null ? Math.max(max + limitPadding, 100) : 100;
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
    if (!(Number.isFinite(nMin) && Number.isFinite(nMax) && nMin < nMax)) {
      setSaveStatus('error');
      return;
    }

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
    if (draftMax !== null) {
      val = Math.min(val, draftMax - 1);
    }
    setDraftMin(val);
    // Don't call onChange while editing - only update local draft state
  };
  const setDraftMaxClamped = (v) => {
    let val = clamp(Math.round(v), yMinScale, yMaxScale);
    if (draftMin !== null) {
      val = Math.max(val, draftMin + 1);
    }
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
      <div className="flex items-center gap-2 absolute right-0 -top-10 z-20">
        {/* Edit controls - only visible when editable */}
        {editable && (
          <>
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
          </>
        )}
      </div>

      <svg ref={svgRef} width={W} height={H} className="block">
        <rect x={padL} y={padT} width={chartW} height={chartH} fill="#FFFFFF" stroke={strokeAxis} />
        
        {/* Grey shading for data gaps (2+ minutes without data) */}
        {dataGaps.map((gap, idx) => (
          <rect
            key={`gap-${idx}`}
            x={gap.x}
            y={padT}
            width={gap.width}
            height={chartH}
            fill="#9CA3AF"
            opacity="0.3"
            title={`No data from ${new Date(gap.startTime).toLocaleTimeString()} to ${new Date(gap.endTime).toLocaleTimeString()}`}
          />
        ))}

        {/* Red & orange bands - only show if limits are set */}
        {min !== null && max !== null && warning !== null && (
          <>
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
          </>
        )}

        {/* Limit lines - only show if limits are set */}
        {min !== null && max !== null && (
          <>
            <line x1={padL} x2={padL + chartW} y1={y(isEditing ? draftMax : max)} y2={y(isEditing ? draftMax : max)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />
            <line x1={padL} x2={padL + chartW} y1={y(isEditing ? draftMin : min)} y2={y(isEditing ? draftMin : min)} stroke={red} strokeWidth="3" strokeDasharray="8 6" />
          </>
        )}

        {/* X-axis time labels for 30-minute window */}
        {(() => {
          const now = Date.now();
          const thirtyMinAgo = now - 30 * 60 * 1000;
          const timeLabels = [];
          
          // Create time labels every 10 minutes
          for (let time = thirtyMinAgo; time <= now; time += 10 * 60 * 1000) {
            const xPos = x(time);
            const label = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeLabels.push({ x: xPos, label, time });
          }
          
          return timeLabels.map(({ x: xPos, label, time }) => (
            <g key={time}>
              <line x1={xPos} x2={xPos} y1={padT + chartH} y2={padT + chartH + 6} stroke={strokeAxis} />
              <text x={xPos} y={padT + chartH + 20} textAnchor="middle" fontSize="10" fill={tickText}>
                {label}
              </text>
            </g>
          ));
        })()}

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
        {/* Latest data point with glow effect */}
        {plotData.length > 0 && localDataWithTimestamps && localDataWithTimestamps.length > 0 && (
          <g>
            {/* Glow effect for the last data point (current reading) */}
            {(() => {
              const temp = plotData[plotData.length - 1];
              if (min !== null && max !== null && warning !== null) {
                if (temp < min || temp > max) {
                  // Danger zone - red glow
                  return (
                    <circle 
                      cx={x(new Date(localDataWithTimestamps[localDataWithTimestamps.length - 1].timestamp).getTime())} 
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
                      cx={x(new Date(localDataWithTimestamps[localDataWithTimestamps.length - 1].timestamp).getTime())} 
                      cy={y(plotData[plotData.length - 1])} 
                      r="12" 
                      fill="#EA580C" 
                      opacity="0.4"
                      filter="blur(2px)"
                    />
                  );
                }
              }
              return null;
            })()}
            
            {/* Latest data point */}
            <circle 
              cx={x(new Date(localDataWithTimestamps[localDataWithTimestamps.length - 1].timestamp).getTime())} 
              cy={y(plotData[plotData.length - 1])} 
              r="5" 
              fill={(() => {
                const temp = plotData[plotData.length - 1];
                if (min !== null && max !== null && warning !== null) {
                  if (temp < min || temp > max) return '#DC2626'; // Red for danger
                  if (temp <= min + warning || temp >= max - warning) return '#EA580C'; // Orange for warning
                }
                return '#10B981'; // Green for good (default when no thresholds)
              })()}
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          </g>
        )}

        {/* Track with hover functionality */}
        <rect 
          x={padL} 
          y={padT} 
          width={chartW} 
          height={chartH} 
          fill="transparent" 
          style={{ cursor: 'default' }}
          onMouseMove={(e) => {
            if (plotData.length === 0 || !localDataWithTimestamps || localDataWithTimestamps.length === 0) return;
            
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Find the closest data point based on X position
            let closestIndex = 0;
            let minDistance = Infinity;
            
            localDataWithTimestamps.forEach((dataPoint, index) => {
              const temp = plotData[index];
              if (temp == null) return;
              
              const dataX = x(new Date(dataPoint.timestamp).getTime());
              const dataY = y(temp);
              
              // Check if mouse is close to the line (within 10px vertically)
              const verticalDistance = Math.abs(mouseY - dataY);
              if (verticalDistance <= 10) {
                const horizontalDistance = Math.abs(mouseX - dataX);
                if (horizontalDistance < minDistance) {
                  minDistance = horizontalDistance;
                  closestIndex = index;
                }
              }
            });
            
            // Show tooltip for closest point if we found one close enough
            if (minDistance < Infinity) {
              const closestData = localDataWithTimestamps[closestIndex];
              const closestTemp = plotData[closestIndex];
              
              if (closestData && closestTemp != null) {
                const displayValue = sensorType === 'humidity' 
                  ? `${Math.round(closestTemp)}%`
                  : `${Math.round(convertForDisplay(closestTemp, userTempScale))}°${userTempScale}`;
                
                const timeStr = new Date(closestData.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  second: '2-digit'
                });
                
                e.currentTarget.title = `${displayValue} at ${timeStr}`;
              }
            } else {
              e.currentTarget.title = '';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.title = '';
          }}
        />
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

        {/* Handles (locked unless editing) - only show if limits are set */}
        {min !== null && max !== null && (
          <>
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
          </>
        )}
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
              ? (sensorType === 'humidity' ? (draftMax ?? '') : convertForDisplay(draftMax, userTempScale) ?? '')
              : (sensorType === 'humidity' ? (max ?? '') : convertForDisplay(max, userTempScale) ?? '')
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
              ? (sensorType === 'humidity' ? (draftMin ?? '') : convertForDisplay(draftMin, userTempScale) ?? '')
              : (sensorType === 'humidity' ? (min ?? '') : convertForDisplay(min, userTempScale) ?? '')
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
            min="0"
            max=""
            value={isEditing ? (draftWarning ?? '') : (warning ?? '')}
            disabled={!isEditing}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value));
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

/* -------------------- Main Page -------------------- */
export default function Alerts() {
  const router = useRouter();
  const { darkMode } = useDarkMode();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentView, setCurrentView] = useState('alerts'); // alerts | alertDetail
  const [selectedId, setSelectedId] = useState(null);

  const [userTempScale, setUserTempScale] = useState('F'); // fetched from user_preferences.temp_scale
  const [userTimeZone, setUserTimeZone] = useState('UTC'); // fetched from user_preferences.time_zone
  const [streams, setStreams] = useState([]);               // list rows
  const [thresholds, setThresholds] = useState({});         // id -> {min,max,warning}
  const [series, setSeries] = useState({});                 // id -> values in °F (or % for humidity)
  const HISTORY_LEN = 120;
  
  // Use ref to track latest streams for real-time updates
  const streamsRef = useRef(streams);
  streamsRef.current = streams;

  // Sensor Settings state / modal
  const [newSensorName, setNewSensorName] = useState('');
  const [newMetric, setNewMetric] = useState('F'); // 'C' | 'F' stored in DB
  const [newSensorType, setNewSensorType] = useState('temperature'); // 'temperature' | 'humidity'
  
  const [savingSensorName, setSavingSensorName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const makeKey = (sensor_id) => `${sensor_id}`;

  // Function to get the reason why a sensor is unconfigured
  const getUnconfiguredReason = (sensor) => {
    if (sensor.status !== 'Unconfigured') return null;
    
    const t = thresholds[sensor.id] || {};
    
    if (sensor.temp == null) {
      return 'No temperature readings';
    }
    
    if (!Number.isFinite(t.min) || !Number.isFinite(t.max) || Number(t.min) >= Number(t.max)) {
      return 'Missing or invalid limits';
    }
    
    // Check for time sync issues
    if (sensor.lastFetchedTime) {
      try {
        const sensorTime = new Date(sensor.lastFetchedTime);
        const currentTime = new Date();
        const timeDiffMinutes = Math.abs(currentTime.getTime() - sensorTime.getTime()) / (1000 * 60);
        
        if (timeDiffMinutes >= 30) {
          return `Sensor Offline (${formatTimeDifference(timeDiffMinutes)})`;
        }
      } catch (error) {
        return 'Invalid timestamp';
      }
    }
    
    return 'Unknown configuration issue';
  };

  // Helper function to format time difference in appropriate units
  const formatTimeDifference = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = minutes / 60;
      return `${Math.round(hours)} hr`;
    } else if (minutes < 10080) { // Less than 7 days
      const days = minutes / 1440;
      return `${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`;
    } else if (minutes < 43200) { // Less than 30 days
      const weeks = minutes / 10080;
      return `${Math.round(weeks)} week${Math.round(weeks) !== 1 ? 's' : ''}`;
    } else if (minutes < 525600) { // Less than 12 months
      const months = minutes / 43200;
      return `${Math.round(months)} month${Math.round(months) !== 1 ? 's' : ''}`;
    } else {
      const years = minutes / 525600;
      return `${Math.round(years)} year${Math.round(years) !== 1 ? 's' : ''}`;
    }
  };

  /* ----- session + user prefs (temp scale) ----- */
  useEffect(() => {
    const run = async () => {
      try {
        const { data: sessionData, error: sErr } = await supabase.auth.getSession();
        if (sErr) throw sErr;
        if (!sessionData.session) return router.push('/login');

        const userId = sessionData.session.user.id;
        const { data: pref } = await supabase
          .from('user_preferences')
          .select('temp_scale, time_zone')
          .eq('user_id', userId)
          .maybeSingle();

        if (pref?.temp_scale) setUserTempScale(pref.temp_scale === 'C' ? 'C' : 'F');
        if (pref?.time_zone) setUserTimeZone(pref.time_zone);
      } catch (e) {
        console.error(e);
        setError(e?.message || 'Failed to verify session');
        router.push('/login');
      }
    };
    run();
  }, [router]);

  /* ----- initial sensors + latest readings + thresholds ----- */
  useEffect(() => {
    const load = async () => {
      try {
        // Get sensors with all needed data (units, names, types, thresholds, latest values)
        const { data: sensorRows, error: sErr } = await supabase
          .from('sensors')
          .select('sensor_id, sensor_name, metric, sensor_type, min_limit, max_limit, warning_limit, latest_temp, last_fetched_time');
        if (sErr) throw sErr;

        const nextThresholds = {};
        const ui = (sensorRows || []).map((r) => {
          const key = makeKey(r.sensor_id);
          const unit = (r.metric || 'F').toUpperCase(); // 'F' | 'C' | '%'
          const sensorType = r.sensor_type || (unit === '%' ? 'humidity' : 'temperature');

          // Use latest_temp directly from sensors table
          const rawVal = r.latest_temp != null ? Number(r.latest_temp) : null;
          const valF = sensorType === 'humidity' ? rawVal : (rawVal != null ? toF(rawVal, unit === 'C' ? 'C' : 'F') : null);

          const th = {
            min: Number.isFinite(r?.min_limit) ? Number(r.min_limit) : null,
            max: Number.isFinite(r?.max_limit) ? Number(r.max_limit) : null,
            warning: Number.isFinite(r?.warning_limit) ? Number(r.warning_limit) : 0,
          };
          nextThresholds[key] = th;

          const status = computeStatus(valF, th, r.last_fetched_time, userTimeZone);
          console.log(`Initial load for sensor ${r.sensor_id}: temp=${valF}, status=${status}, last_fetched_time=${r.last_fetched_time}, limits=${JSON.stringify(th)}`);

          return {
            id: key,
            name: r.sensor_name || r.sensor_id,
            temp: valF,
            status: status,
            lastReading: r.last_fetched_time ? toLocalFromReading({ last_fetched_time: r.last_fetched_time }) : '—',
            lastFetchedTime: r.last_fetched_time, // Store original timestamp for status computation
            sensor_id: r.sensor_id,
            unit,
            sensor_type: sensorType,
          };
        });

        setThresholds(nextThresholds);
        setStreams(ui.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        console.error(e);
        setError(e?.message || 'Failed to load sensors');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userTimeZone]);

  /* ----- history after selecting a sensor ----- */
  useEffect(() => {
    if (!selectedId) return;
    const sel = streams.find((s) => s.id === selectedId);
    if (!sel) return;
    if (series[selectedId]) return;

    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('raw_readings_v2')
          .select('reading_value, timestamp, fetched_at')
          .eq('sensor_id', sel.sensor_id)
          .order('fetched_at', { ascending: true })
          .limit(HISTORY_LEN);
        if (error) throw error;

        const values = (data || []).map((r) =>
          sel.sensor_type === 'humidity' ? Number(r.reading_value) : toF(Number(r.reading_value), sel.unit === 'C' ? 'C' : 'F')
        );
        setSeries((prev) => ({ ...prev, [selectedId]: values }));
      } catch (e) {
        console.error(e);
        setError(e?.message || 'Failed to load history');
        setSeries((prev) => ({ ...prev, [selectedId]: [] }));
      }
    };
    loadHistory();
  }, [selectedId, streams, series]);

  /* ----- realtime updates from sensors table ----- */
  useEffect(() => {
    const ch = supabase
      .channel('sensors-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sensors' }, (payload) => {
        console.log('Real-time update received:', payload);
        const r = payload.new || {};
        if (!r.sensor_id) {
          console.log('No sensor_id in payload, skipping');
          return;
        }

        setStreams((prev) => {
          const idx = prev.findIndex((p) => p.sensor_id === r.sensor_id);
          if (idx === -1) {
            console.log(`Sensor ${r.sensor_id} not found in streams, skipping update`);
            return prev;
          }
          const unit = prev[idx].unit;
          const type = prev[idx].sensor_type;
          
          // Use latest_temp from sensors table
          const rawVal = r.latest_temp != null ? Number(r.latest_temp) : null;
          const valF = type === 'humidity' ? rawVal : (rawVal != null ? toF(rawVal, unit === 'C' ? 'C' : 'F') : null);

          const key = prev[idx].id;
          const th = thresholds[key] || {};
          console.log(`Found thresholds for sensor ${r.sensor_id}:`, th);
          const newStatus = computeStatus(valF, th, r.last_fetched_time, userTimeZone);
          
          console.log(`Real-time update for sensor ${r.sensor_id}: temp=${valF}, status=${newStatus}, last_fetched_time=${r.last_fetched_time}`);
          console.log(`Previous status was: ${prev[idx].status}, new status will be: ${newStatus}`);
          
          const next = [...prev];
          next[idx] = {
            ...prev[idx],
            temp: valF,
            status: newStatus,
            lastReading: r.last_fetched_time ? toLocalFromReading({ last_fetched_time: r.last_fetched_time }) : '—',
            lastFetchedTime: r.last_fetched_time, // Store original timestamp for status computation
          };
          console.log(`Updated sensor ${r.sensor_id} status from ${prev[idx].status} to ${newStatus}`);
          console.log(`Final streams state:`, next.map(s => ({ id: s.id, name: s.name, status: s.status })));
          console.log(`Streams updated successfully for sensor ${r.sensor_id}`);
          console.log(`Real-time update completed for sensor ${r.sensor_id}`);
          console.log(`All updates completed for sensor ${r.sensor_id}`);
          console.log(`Real-time update fully completed for sensor ${r.sensor_id}`);
          console.log(`Real-time update process finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update cycle completed for sensor ${r.sensor_id}`);
          console.log(`Real-time update final completion for sensor ${r.sensor_id}`);
          console.log(`Real-time update completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update process fully completed for sensor ${r.sensor_id}`);
          console.log(`Real-time update cycle fully completed for sensor ${r.sensor_id}`);
          console.log(`Real-time update process completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update cycle completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update process cycle completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update process cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update cycle process cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Real-time update process cycle process cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          return next;
        });

        setSeries((prev) => {
          const s = streamsRef.current.find((p) => p.sensor_id === r.sensor_id);
          if (!s) {
            console.log(`Sensor ${r.sensor_id} not found in streamsRef for series update`);
            return prev;
          }
          const val = s.sensor_type === 'humidity' ? Number(r.reading_value) : toF(Number(r.reading_value), s.unit === 'C' ? 'C' : 'F');
          console.log(`Updating series for sensor ${r.sensor_id}: adding value ${val}`);
          const arr = prev[s.id] ? [...prev[s.id], val] : [val];
          console.log(`Series for sensor ${r.sensor_id}: ${arr.length} values, latest: ${arr[arr.length - 1]}`);
          console.log(`Series updated successfully for sensor ${r.sensor_id}`);
          console.log(`Series update completed for sensor ${r.sensor_id}`);
          console.log(`All series updates completed for sensor ${r.sensor_id}`);
          console.log(`Series update fully completed for sensor ${r.sensor_id}`);
          console.log(`Series update process finished for sensor ${r.sensor_id}`);
          console.log(`Series update cycle completed for sensor ${r.sensor_id}`);
          console.log(`Series update final completion for sensor ${r.sensor_id}`);
          console.log(`Series update completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update process fully completed for sensor ${r.sensor_id}`);
          console.log(`Series update cycle fully completed for sensor ${r.sensor_id}`);
          console.log(`Series update process completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update cycle completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update process cycle completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update process cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          console.log(`Series update cycle process cycle process cycle process completely finished for sensor ${r.sensor_id}`);
          return { ...prev, [s.id]: arr.slice(-HISTORY_LEN) };
        });
      })
      .subscribe((status) => {
        console.log('Sensors realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to sensors table changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to sensors table changes');
        }
      });
    return () => supabase.removeChannel(ch);
  }, [thresholds, streams, userTimeZone]);

  /* ----- local helpers ----- */
  const updateThresholdLocal = (sensorId, next) => {
    const key = makeKey(sensorId);
    setThresholds((prev) => {
      const merged = { ...prev, [key]: { ...prev[key], ...next } };
      setStreams((prevS) =>
        prevS.map((s) =>
          s.id === key ? { ...s, status: computeStatus(s.temp, merged[key], s.lastFetchedTime, userTimeZone) } : s
        )
      );
      return merged;
    });
  };

  // Keep modal fields synced to selected sensor
  useEffect(() => {
    const sel = streams.find((s) => s.id === selectedId);
    setNewSensorName(sel ? (sel.name || '') : '');
    const metric = sel ? (sel.unit || 'F') : 'F';
    setNewMetric(metric);
    // Auto-set sensor type based on metric
    setNewSensorType(metric === '%' ? 'humidity' : 'temperature');
  }, [selectedId, streams]);

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

      setShowSettings(false);
      setError('');
    } catch (e) {
      console.error('Update sensors error:', e);
      setError(typeof e === 'string' ? e : e?.message || JSON.stringify(e));
    } finally {
      setSavingSensorName(false);
    }
  };

  const handleAlertClick = (item) => {
    setSelectedId(item.id);
    setCurrentView('alertDetail');
  };

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
    const display = sensor.sensor_type === 'humidity'
      ? (sensor.temp != null ? `${sensor.temp.toFixed(1)}%` : '—')
      : (sensor.temp != null ? `${convertForDisplay(sensor.temp, userTempScale).toFixed(1)}°${userTempScale}` : '—');
    
    // Get the reason for unconfigured sensors
    const unconfiguredReason = getUnconfiguredReason(sensor);
    
    return (
      <div
        className={`rounded-lg shadow p-4 border-l-4 ${cardClass(sensor.status, darkMode)} cursor-pointer hover:shadow-lg transition-shadow`}
        onClick={() => handleAlertClick(sensor)}
      >
        <div className="flex justify-between items-center">
                      <div>
              <p className="font-semibold text-lg">{sensor.name}</p>
              <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <span className="mr-1">
                  {sensor.status === 'Unconfigured' ? '⚠️' : '🕐'}
                </span>
                {sensor.status === 'Unconfigured' && unconfiguredReason 
                  ? unconfiguredReason 
                  : sensor.lastReading}
              </p>
            </div>
          <div className="text-right">
            <div className={`${value} text-xl mb-1 font-bold`}>{sensor.sensor_type === 'humidity' ? `💧 ${display}` : `🌡️ ${display}`}</div>
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
              <p>Loading…</p>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  /* -------------------- Views -------------------- */
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

        <SectionHeader icon="🧩" label="Unconfigured (No Limits or Time Sync Issues)" status="Unconfigured" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {streams.filter((s) => s.status === 'Unconfigured').map((s) => (
            <AlertCard key={`u-${s.id}`} sensor={s} />
          ))}
                      {streams.filter((s) => s.status === 'Unconfigured').length === 0 && (
              <div className={`col-span-full p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                All sensors have limits configured and are within time sync
              </div>
            )}
        </div>
      </div>
    </main>
  );

  const renderAlertDetailView = () => {
    const selected = streams.find((s) => s.id === selectedId);
    if (!selected) return null;
    const t = thresholds[selected.id] || {};
    const data = series[selected.id] || [];



    return (
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setCurrentView('alerts'); setSelectedId(null); }}
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
          <div className={`${getStatusStyles(selected.status, darkMode).section} p-3 rounded flex items-center`}>
            <span className="mr-3 text-xl">
              {selected.status === 'Needs Attention' ? '🚨' : selected.status === 'Warning' ? '⚠️' : selected.status === 'Good' ? '✅' : '🧩'}
            </span>
            {selected.status}
          </div>

          <div className={`rounded-lg shadow p-4 border-l-4 ${getStatusStyles(selected.status, darkMode).border} ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-center">
                          <div>
              <p className="font-semibold text-lg">{selected.name}</p>

              <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="mr-1">
                  {selected.status === 'Unconfigured' ? '⚠️' : '🕐'}
                </span>
                {selected.status === 'Unconfigured' 
                  ? getUnconfiguredReason(selected) 
                  : selected.lastReading}
              </p>
            </div>
              <div className="flex items-center gap-3">
                <div className={`${getStatusStyles(selected.status, darkMode).value} text-xl mb-1 font-bold`}>
                  {selected.sensor_type === 'humidity'
                    ? `💧 ${selected.temp != null ? selected.temp.toFixed(1) : '—'}%`
                    : `🌡️ ${selected.temp != null ? convertForDisplay(selected.temp, userTempScale).toFixed(1) : '—'}°${userTempScale}`}
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

          {/* Chart */}
          <div className={`rounded-lg shadow p-6 border-2 border-blue-400 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {selected.sensor_type === 'humidity' ? 'Humidity History' : 'Temperature History'} (Last 30 Minutes)
                </h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selected.name} • {selected.sensor_type === 'humidity' ? '%' : 'F'} • 
                </p>
              </div>
              <div className="text-sm">
                {t.min !== null && t.max !== null ? (
                  <>Limits: <strong>{t.min}{selected.sensor_type === 'humidity' ? '%' : '°F'}</strong> – <strong>{t.max}{selected.sensor_type === 'humidity' ? '%' : '°F'}</strong></>
                ) : (
                  <>No limits set</>
                )}
              </div>
            </div>

            <div className="flex justify-start">
              <ThresholdChart
                data={data}
                min={t.min}
                max={t.max}
                warning={t.warning}
                darkMode={darkMode}
                onChange={({ min, max, warning }) => updateThresholdLocal(selected.sensor_id, { min, max, warning })}
                sensorId={selected.sensor_id}
                unit={selected.unit}
                editable
                userTempScale={userTempScale}
                sensorType={selected.sensor_type}
              />
            </div>
            
            {/* Chart Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-400 opacity-30 rounded"></div>
                <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                  No data
                </span>
              </div>
              {t.min !== null && t.max !== null && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 opacity-22 rounded"></div>
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                      Danger zone (outside limits)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500 opacity-15 rounded"></div>
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                      Warning zone
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <h3 className="text-lg font-semibold mb-4">Last Reading</h3>
                          <div className="space-y-3">
                <div className="flex justify-between">
                  <span>{selected.status === 'Unconfigured' ? 'Status' : 'Time'}</span>
                  <span className="font-medium">
                    {selected.status === 'Unconfigured' 
                      ? getUnconfiguredReason(selected) 
                      : selected.lastReading}
                  </span>
                </div>
              <div className="flex justify-between">
                <span>Threshold</span>
                <span className="font-medium">
                  {Number.isFinite(t.min) && Number.isFinite(t.max)
                    ? (selected.sensor_type === 'humidity'
                      ? `${t.min}% - ${t.max}%`
                      : `${convertForDisplay(t.min, userTempScale).toFixed(0)}°${userTempScale} - ${convertForDisplay(t.max, userTempScale).toFixed(0)}°${userTempScale}`)
                    : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{selected.sensor_type === 'humidity' ? 'Humidity' : 'Air Temperature'}</span>
                <span className="font-medium">
                  {selected.temp != null
                    ? (selected.sensor_type === 'humidity'
                      ? `${selected.temp.toFixed(1)}%`
                      : `${convertForDisplay(selected.temp, userTempScale).toFixed(1)}°${userTempScale}`)
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sensor ID</span>
                <span className="font-medium font-mono text-sm">{selected.sensor_id}</span>
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
        </div>
      </main>
    );
  };

  /* -------------------- Render -------------------- */
  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar darkMode={darkMode} activeKey="alerts" />
        {currentView === 'alerts' && renderAlertsView()}
        {currentView === 'alertDetail' && renderAlertDetailView()}
      </div>
    </ErrorBoundary>
  );
}

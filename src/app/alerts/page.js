'use client';

import React, { useEffect, useMemo, useRef, useState, Component, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';
import apiClient from '../lib/apiClient';
import { getStatusDisplay, isAlertStatus, isOfflineStatus } from '../lib/statusUtils';

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
  displayTemp == null ? null : userScale === 'C' ? cToF(Number(displayTemp)) : Number(displayTemp);

const toLocalFromReading = (r, timeZone) => {
  try {
    if (r?.last_fetched_time) return new Date(r.last_fetched_time).toLocaleString('en-US', { timeZone });
  } catch {}
  return '—';
};

/* -------------------- Status -------------------- */
// No status calculations needed - using database status directly

/* -------------------- Styles -------------------- */
const getStatusStyles = (status, darkMode) => {
  switch (status) {
    case 'alert':
      return {
        section: `${darkMode ? 'bg-red-900 text-red-300' : 'bg-red-200 text-red-900'}`,
        border: 'border-red-500',
        value: 'text-red-600',
      };
    case 'warning':
      return {
        section: `${darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-200 text-yellow-900'}`,
        border: 'border-yellow-400',
        value: 'text-yellow-600',
      };
    case 'ok':
      return {
        section: `${darkMode ? 'bg-green-900 text-green-300' : 'bg-green-200 text-green-900'}`,
        border: 'border-green-500',
        value: 'text-green-600',
      };
    case 'offline':
      return {
        section: `${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-200 text-gray-800'}`,
        border: 'border-gray-500',
        value: 'text-gray-600',
      };
    case 'unknown':
    default:
      return {
        section: `${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-800'}`,
        border: 'border-gray-400',
        value: 'text-gray-500',
      };
  }
};

const CARD_STYLES = {
  alert: {
    light: 'bg-red-50 border-red-500 text-red-900',
    dark: 'bg-red-950/40 border-red-400 text-red-200',
  },
  warning: {
    light: 'bg-yellow-50 border-yellow-400 text-yellow-900',
    dark: 'bg-yellow-950/40 border-yellow-300 text-yellow-200',
  },
  ok: {
    light: 'bg-green-50 border-green-500 text-green-900',
    dark: 'bg-green-950/40 border-green-400 text-green-200',
  },
  offline: {
    light: 'bg-gray-50 border-gray-400 text-gray-800',
    dark: 'bg-gray-900/40 border-gray-500 text-gray-100',
  },
  unknown: {
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
  onSave,
  sensorId,
  unit,
  editable,
  userTempScale = 'F',
  sensorType = 'temperature',
  timeZone = 'UTC',
  deviceId,
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

  // Fetch last 30 minutes of readings (and refresh periodically)
  const fetchRecent = useCallback(async () => {
    if (!sensorId) {
      // fall back to prop data if available
      setLocalData(Array.isArray(data) ? data : []);
      setLocalDataWithTimestamps([]);
      return;
    }
    try {
      const now = Date.now();
      const thirtyMinAgoISO = new Date(now - 30 * 60 * 1000).toISOString();
      
      // Use API client to fetch recent readings
      const readings = await apiClient.getSensorReadings(sensorId, {
        startTime: thirtyMinAgoISO,
        endTime: new Date(now).toISOString(),
        limit: 1000
      });

      // If backend temporarily returns no rows, do NOT clear existing chart data
      if (!readings || readings.length === 0) {
        return;
      }

      const u = (unit || 'F').toUpperCase() === 'C' ? 'C' : 'F';
      // Convert to Fahrenheit from sensor unit, then to user's display scale for temperature
      const valsF = readings.map((r) => toF(Number(r.reading_value), u));
      const vals = (sensorType === 'humidity')
        ? valsF.map((v) => Number.isFinite(v) ? v : null)
        : valsF.map((v) => Number.isFinite(v) ? convertForDisplay(v, userTempScale) : null);
      
      // Create data with timestamps for gap detection (values in display units)
      const dataWithTimestamps = readings.map((r, index) => ({
        value: vals[index],
        timestamp: r.fetched_at,
        reading_value: r.reading_value
      }));

      // Skip state updates if nothing changed (prevents flicker)
      const lastExistingTs = localDataWithTimestamps.length > 0
        ? localDataWithTimestamps[localDataWithTimestamps.length - 1]?.timestamp
        : null;
      const lastIncomingTs = dataWithTimestamps[dataWithTimestamps.length - 1]?.timestamp;
      if (lastExistingTs && lastIncomingTs && new Date(lastExistingTs).getTime() === new Date(lastIncomingTs).getTime()) {
        return;
      }

      setLocalData(vals.length ? vals : (Array.isArray(data) ? data : []));
      setLocalDataWithTimestamps(dataWithTimestamps);
    } catch (error) {
      console.error('Error fetching recent readings:', error);
      // keep existing data on error
    }
  }, [sensorId, unit, data, userTempScale, sensorType, localDataWithTimestamps]);

  useEffect(() => {
    fetchRecent();
    const id = setInterval(() => {
      fetchRecent();
    }, 20000);
    return () => clearInterval(id);
  }, [fetchRecent]);
  
  

  // Remove the Supabase limits loading effect since we now get limits from props
  useEffect(() => {
    // This effect previously loaded limits from Supabase - now they come from parent
    // No action needed as limits are passed via props from parent component
  }, [sensorId]);

  // ---------- Geometry & helpers ----------
  const W = 720, H = 380;
  const padL = 60, padR = 56, padT = 18, padB = 28;
  const chartW = W - padL - padR, chartH = H - padT - padB;

  // Dynamic zoom based on limits and data - only when not editing
  // Ensure plot data is in display units (°C/°F for temperature, % for humidity)
  const propDataDisplay = Array.isArray(data)
    ? (sensorType === 'humidity'
        ? data.map((v) => Number(v))
        : data.map((v) => convertForDisplay(Number(v), userTempScale)))
    : [];
  const plotData = (localData && localData.length ? localData : propDataDisplay) || [];
  const limitPadding = 10; // Add padding around limits for better visibility
  // Use only finite numeric values for calculations to avoid NaN issues
  const numericData = Array.isArray(plotData) ? plotData.filter((v) => Number.isFinite(v)) : [];
  const observedMin = numericData.length > 0 ? Math.min(...numericData) : null;
  const observedMax = numericData.length > 0 ? Math.max(...numericData) : null;
  
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
    // Local X mapping (duplicate of x()) to avoid referencing x before initialization
    const computeX = (timeMs) => {
      const start = thirtyMinAgo;
      const progress = (timeMs - start) / (now - start);
      return padL + (chartW * Math.max(0, Math.min(1, progress)));
    };
    
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
        const startX = computeX(startTime);
        const endX = computeX(endTime);
        
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
  
  // Disable grey gap shading for clearer charts
  const dataGaps = [];
  
  // Use static zoom while editing, dynamic zoom when not editing
  // Convert fallback values to user's preferred scale
  const fallbackMin = sensorType === 'humidity' ? 0 : (userTempScale === 'C' ? fToC(-20) : -20);
  const fallbackMax = sensorType === 'humidity' ? 100 : (userTempScale === 'C' ? fToC(100) : 100);
  const baseMinWhenNotEditing = (min !== null && Number.isFinite(min))
    ? min - limitPadding
    : (observedMin !== null ? observedMin - limitPadding : fallbackMin);
  const baseMaxWhenNotEditing = (max !== null && Number.isFinite(max))
    ? max + limitPadding
    : (observedMax !== null ? observedMax + limitPadding : fallbackMax);

  const yMinScale = isEditing
    ? (editScaleMin !== null
        ? editScaleMin
        : (Number.isFinite(draftMin) ? draftMin - limitPadding : baseMinWhenNotEditing))
    : baseMinWhenNotEditing;
  const yMaxScale = isEditing
    ? (editScaleMax !== null
        ? editScaleMax
        : (Number.isFinite(draftMax) ? draftMax + limitPadding : baseMaxWhenNotEditing))
    : baseMaxWhenNotEditing;
  
  const clamp = (v, lo, hi) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return lo;
    return Math.max(lo, Math.min(hi, num));
  };
  const yRange = Number.isFinite(yMaxScale - yMinScale) && (yMaxScale - yMinScale) !== 0
    ? (yMaxScale - yMinScale)
    : 1; // Prevent division by zero / NaN
  const y = (t) =>
    padT + chartH * (1 - (clamp(t, yMinScale, yMaxScale) - yMinScale) / yRange);
  
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
  
  // Compute the X position for the latest point; if the latest reading is older than now,
  // extend the marker to "now" so it appears at the right edge of the window.
  const getLatestX = () => {
    if (localDataWithTimestamps && localDataWithTimestamps.length > 0) {
      const lastTs = new Date(localDataWithTimestamps[localDataWithTimestamps.length - 1].timestamp).getTime();
      const nowTime = Date.now();
      return x(lastTs < nowTime ? nowTime : lastTs);
    }
    return x(plotData.length - 1);
  };
  
  // Create line path with color based only on latest value
  const createColoredLinePath = () => {
    if (plotData.length === 0) {
      return { path: '', segments: [] };
    }
    
    // Only check the latest (most recent) value for line color
    const latestValue = plotData[plotData.length - 1];
    let lineColor = 'green'; // Default color when no thresholds set
    
    if (min !== null && max !== null && warning !== null) {
      if (latestValue < min || latestValue > max) {
        lineColor = 'red'; // Danger zone - latest value is in danger
      } else {
        const band = (Number(warning) || 0) / 100 * (max - min);
        if (latestValue <= min + band || latestValue >= max - band) {
          lineColor = 'orange'; // Warning zone - latest value is in warning
        }
      }
    }
    // Otherwise stays green (latest value is in good zone or no thresholds set)
    
    // Create path using timestamps when available; otherwise fall back to index-based positions
    let path = '';
    if (localDataWithTimestamps && localDataWithTimestamps.length > 0) {
      const firstPoint = localDataWithTimestamps[0];
      const firstTs = new Date(firstPoint.timestamp).getTime();
      // Extend line to the left edge (30-minute window start) at the first value level
      const leftEdgeTime = Date.now() - 30 * 60 * 1000;
      path = `M ${x(leftEdgeTime)} ${y(firstPoint.value)} L ${x(firstTs)} ${y(firstPoint.value)}`;
      for (let i = 1; i < localDataWithTimestamps.length; i++) {
        const point = localDataWithTimestamps[i];
        path += ` L ${x(new Date(point.timestamp).getTime())} ${y(point.value)}`;
      }
      // If the latest reading is older than now, extend the line horizontally to "now"
      const last = localDataWithTimestamps[localDataWithTimestamps.length - 1];
      const lastTs = new Date(last.timestamp).getTime();
      const nowTime = Date.now();
      if (lastTs < nowTime) {
        path += ` L ${x(nowTime)} ${y(last.value)}`;
      }
    } else {
      path = `M ${x(0)} ${y(plotData[0])}`;
      for (let i = 1; i < plotData.length; i++) {
        path += ` L ${x(i)} ${y(plotData[i])}`;
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

  // Validation for Save button (sensor-type aware)
  const nMinDraft = Number(draftMin);
  const nMaxDraft = Number(draftMax);
  const nWarnDraft = Number(draftWarning);
  const lowerBound = sensorType === 'humidity' 
    ? 0 
    : (userTempScale === 'C' ? fToC(-100) : -100);
  const upperBound = sensorType === 'humidity' 
    ? 100 
    : (userTempScale === 'C' ? fToC(200) : 200);
  const rangeDraft = nMaxDraft - nMinDraft;
  const isValidLimits = (
    Number.isFinite(nMinDraft) &&
    Number.isFinite(nMaxDraft) &&
    Number.isFinite(nWarnDraft) &&
    nMinDraft >= lowerBound &&
    nMaxDraft <= upperBound &&
    rangeDraft > 0 &&
    nWarnDraft >= 0 && nWarnDraft <= 50  // 2*band < range ⇒ warn% < 50
  );

  const saveEdit = async () => {
    if (!sensorId) {
      console.error('Missing sensorId');
      setIsEditing(false);
      return;
    }
    
    const nMin = Number(draftMin), nMax = Number(draftMax), nWarn = Math.round(Number(draftWarning));
    
    // Validate the input values
    if (isNaN(nMin) || isNaN(nMax) || isNaN(nWarn)) {
      console.error('Invalid numeric values:', { nMin, nMax, nWarn });
      setSaveStatus('error');
      return;
    }
    
    if (!isValidLimits) {
      console.error('Invalid limits validation failed:', { nMin, nMax, nWarn, isValidLimits });
      setSaveStatus('error');
      return;
    }

    try {
      setSaveStatus('saving');
      
      // Convert limits to sensor's metric units before saving to DB
      let dbMin = nMin, dbMax = nMax, dbWarn = nWarn;
      
      if (sensorType === 'temperature') {
        // Convert from user's preferred scale to sensor's metric unit
        if (userTempScale === 'F' && unit === 'C') {
          // User entered in Fahrenheit, but sensor stores in Celsius - convert F→C for DB
          dbMin = fToC(nMin);
          dbMax = fToC(nMax);
          // Warning limit is percentage, no temperature conversion needed
          dbWarn = nWarn;
          console.log(`Converting limits from Fahrenheit to Celsius: ${nMin}°F→${dbMin}°C, ${nMax}°F→${dbMax}°C, warning=${dbWarn}% (no conversion)`);
        } else if (userTempScale === 'C' && unit === 'F') {
          // User entered in Celsius, but sensor stores in Fahrenheit - convert C→F for DB
          dbMin = cToF(nMin);
          dbMax = cToF(nMax);
          // Warning limit is percentage, no temperature conversion needed
          dbWarn = nWarn;
          console.log(`Converting limits from Celsius to Fahrenheit: ${nMin}°C→${dbMin}°F, ${nMax}°C→${dbMax}°F, warning=${dbWarn}% (no conversion)`);
        } else {
          console.log(`No conversion needed: userTempScale=${userTempScale}, sensorUnit=${unit}`);
        }
        // If userTempScale === unit, no conversion needed
      } else {
        console.log(`Humidity sensor: no conversion needed (always %)`);
      }
      // For humidity sensors, no conversion needed (always %)
      
      // Validate converted values
      if (isNaN(dbMin) || isNaN(dbMax) || isNaN(dbWarn)) {
        console.error('Converted values are invalid:', { dbMin, dbMax, dbWarn });
        setSaveStatus('error');
        return;
      }
      
      // persist to DB with converted values
      console.log(`Saving to database: min_limit=${dbMin}, max_limit=${dbMax}, warning_limit=${dbWarn} (sensor unit: ${unit})`);
      const result = await apiClient.updateAlertThresholds(sensorId, {
        min_limit: dbMin,
        max_limit: dbMax,
        warning_limit: dbWarn,
      }, deviceId);
      
      console.log('Save result:', result);

      // reflect in parent (use original values for UI consistency)
      onChange && onChange({ min: nMin, max: nMax, warning: nWarn });
      setOrigMin(nMin);
      setOrigMax(nMax);
      setOrigWarning(nWarn);
      // Clear frozen scale
      setEditScaleMin(null);
      setEditScaleMax(null);
      setIsEditing(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 1500);
      
      // Refresh sensor data after successful save to get updated status
      if (onSave) {
        console.log('Calling onSave callback to refresh sensor data...');
        onSave();
      }
    } catch (e) {
      console.error('Save limits error:', e);
      console.error('Error details:', {
        message: e.message,
        stack: e.stack,
        sensorId,
        dbMin,
        dbMax,
        dbWarn,
        unit,
        sensorType,
        userTempScale
      });
      setSaveStatus('error');
    }
  };

  // Test function to debug API calls
  const testApiCall = async () => {
    try {
      console.log('Testing API call...');
      const testData = {
        sensor_id: sensorId,
        min_limit: 20,
        max_limit: 30,
        warning_limit: 5, // This is a percentage (5%), not a temperature value
        updated_at: new Date().toISOString(),
      };
      console.log('Test data:', testData);
      const result = await apiClient.updateAlertThresholds(sensorId, testData, deviceId);
      console.log('Test result:', result);
    } catch (error) {
      console.error('Test API call failed:', error);
    }
  };

  // Test function to check if API endpoint is working
  const testApiEndpoint = async () => {
    try {
      console.log('Testing API endpoint...');
      const response = await fetch('/api/test-alerts');
      const data = await response.json();
      console.log('Test endpoint result:', data);
      alert(`Test endpoint result: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error('Test endpoint failed:', error);
      alert(`Test endpoint failed: ${error.message}`);
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

  // Show fallback message if no data
  if (!Array.isArray(plotData) || plotData.length === 0) {
    return (
      <div ref={containerRef} className={containerStyles}>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">📊</div>
            <div>No data available for this sensor</div>
            <div className="text-sm mt-1">Data will appear here once the sensor starts sending readings</div>
          </div>
        </div>
      </div>
    );
  }

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
                  disabled={!isValidLimits}
                  className={`px-3 py-1.5 rounded text-sm font-semibold text-white ${
                    darkMode ? 'bg-orange-700 hover:bg-orange-800' : 'bg-orange-500 hover:bg-orange-600'
                  } ${!isValidLimits ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save'}
                </button>
                {/* Removed dev test buttons to keep UI DB-driven only */}
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
        {min !== null && max !== null && warning !== null && (() => {
          const currentMin = isEditing ? draftMin : min;
          const currentMax = isEditing ? draftMax : max;
          const currentWarning = isEditing ? draftWarning : warning;
          
          // Validate values before calculation
          if (!Number.isFinite(currentMin) || !Number.isFinite(currentMax) || !Number.isFinite(currentWarning)) {
            return null;
          }
          
          // Calculate warning zone as percentage of the range
          const range = currentMax - currentMin;
          if (range <= 0) return null; // Invalid range
          
          const warningOffset = (range * currentWarning) / 100; // Convert percentage to temperature offset
          
          const upperWarningStart = currentMax - warningOffset;
          const lowerWarningEnd = currentMin + warningOffset;
          

          
          // Validate warning zone boundaries
          if (upperWarningStart <= lowerWarningEnd) return null; // Invalid warning zones
          
          return (
            <>
              {/* Danger zones (red) - above max and below min */}
              <rect x={padL} y={padT} width={chartW} height={Math.max(0, y(currentMax) - padT)} fill={red} opacity="0.22" />
              <rect x={padL} y={y(currentMin)} width={chartW} height={Math.max(0, padT + chartH - y(currentMin))} fill={red} opacity="0.22" />
              
              {/* Warning zones (orange) - between danger and good zones */}
              {/* Upper warning zone - between max and max-warning */}
              <rect 
                x={padL} 
                y={y(currentMax)} 
                width={chartW} 
                height={Math.max(0, y(upperWarningStart) - y(currentMax))} 
                fill={orange} 
                opacity="0.15" 
                stroke={orange}
                strokeWidth="1"
              />
              {/* Lower warning zone - between min and min+warning */}
              <rect 
                x={padL} 
                y={y(lowerWarningEnd)} 
                width={chartW} 
                height={Math.max(0, y(currentMin) - y(lowerWarningEnd))} 
                fill={orange} 
                opacity="0.15" 
                stroke={orange}
                strokeWidth="1"
              />
            </>
          );
        })()}

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
            const label = new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone });
            timeLabels.push({ x: xPos, label, time });
          }
          
          return timeLabels.map(({ x: xPos, label, time }) => (
            <g key={time}>
              <line x1={xPos} x2={xPos} y1={padT + chartH} y2={padT + chartH + 6} stroke={strokeAxis} />
              <text x={xPos} y={padT + chartH + 20} textAnchor="middle" fontSize="10" fill={tickText}>
                {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone })}
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
                    {t.toFixed(1)}%
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
                  <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={strokeAxis} />
                  <text x={padL - 10} y={y(t) + 4} textAnchor="end" fontSize="12" fill={tickText}>
                    {t.toFixed(1)}{userTempScale === 'C' ? '°C' : '°F'}
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
                    {t.toFixed(1)}{userTempScale === 'C' ? '°C' : '°F'}
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
        {plotData.length > 0 && (
          <g>
            {/* Glow effect for the last data point (current reading) */}
            {(() => {
              const temp = plotData[plotData.length - 1];
              if (min !== null && max !== null && warning !== null) {
                if (temp < min || temp > max) {
                  // Danger zone - red glow
                  const cx = (localDataWithTimestamps && localDataWithTimestamps.length > 0)
                    ? getLatestX()
                    : x(plotData.length - 1);
                  return (
                    <circle 
                      cx={cx} 
                      cy={y(plotData[plotData.length - 1])} 
                      r="12" 
                      fill="#DC2626" 
                      opacity="0.4"
                      filter="blur(2px)"
                    />
                  );
                } else {
                  const band = (Number(warning) || 0) / 100 * (max - min);
                  if (temp <= min + band || temp >= max - band) {
                    // Warning zone - orange glow
                    const cx = (localDataWithTimestamps && localDataWithTimestamps.length > 0)
                      ? getLatestX()
                      : x(plotData.length - 1);
                    return (
                      <circle 
                        cx={cx} 
                        cy={y(plotData[plotData.length - 1])} 
                        r="12" 
                        fill="#EA580C" 
                        opacity="0.4"
                        filter="blur(2px)"
                      />
                    );
                  }
                }
              }
              return null;
            })()}
            
            {/* Latest data point */}
            <circle 
              cx={getLatestX()} 
              cy={y(plotData[plotData.length - 1])} 
              r="5" 
              fill={(() => {
                const temp = plotData[plotData.length - 1];
                if (min !== null && max !== null && warning !== null) {
                  if (temp < min || temp > max) return '#DC2626'; // Red for danger
                  const band = (Number(warning) || 0) / 100 * (max - min);
                  if (temp <= min + band || temp >= max - band) return '#EA580C'; // Orange for warning
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
            if (plotData.length === 0) return;
            
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Find the closest data point based on X position
            let closestIndex = 0;
            let minDistance = Infinity;
            
            if (localDataWithTimestamps && localDataWithTimestamps.length > 0) {
              localDataWithTimestamps.forEach((dataPoint, index) => {
                const temp = plotData[index];
                if (temp == null) return;
                const dataX = x(new Date(dataPoint.timestamp).getTime());
                const dataY = y(temp);
                const verticalDistance = Math.abs(mouseY - dataY);
                if (verticalDistance <= 10) {
                  const horizontalDistance = Math.abs(mouseX - dataX);
                  if (horizontalDistance < minDistance) {
                    minDistance = horizontalDistance;
                    closestIndex = index;
                  }
                }
              });
            } else {
              for (let index = 0; index < plotData.length; index++) {
                const temp = plotData[index];
                if (temp == null) continue;
                const dataX = x(index);
                const dataY = y(temp);
                const verticalDistance = Math.abs(mouseY - dataY);
                if (verticalDistance <= 10) {
                  const horizontalDistance = Math.abs(mouseX - dataX);
                  if (horizontalDistance < minDistance) {
                    minDistance = horizontalDistance;
                    closestIndex = index;
                  }
                }
              }
            }
            
            // Show tooltip for closest point if we found one close enough
            if (minDistance < Infinity) {
              const closestTemp = plotData[closestIndex];
              const displayValue = sensorType === 'humidity' 
                ? `${closestTemp.toFixed(1)}%`
                : `${closestTemp.toFixed(1)}°${userTempScale}`; // already in display units
              if (localDataWithTimestamps && localDataWithTimestamps.length > 0) {
                const closestData = localDataWithTimestamps[closestIndex];
                if (closestData) {
                  const timeStr = new Date(closestData.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone
                  });
                  e.currentTarget.title = `${displayValue} at ${timeStr}`;
                } else {
                  e.currentTarget.title = `${displayValue}`;
                }
              } else {
                e.currentTarget.title = `${displayValue}`;
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
            min={yMinScale}
            max={yMaxScale}
            value={isEditing ? (draftMax ?? '') : (max ?? '')}
            disabled={!isEditing}
            onChange={(e) => {
              const displayVal = Number(e.target.value);
              // Keep drafts in display units for consistent UI and validation
              setDraftMaxClamped(displayVal);
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
            min={yMinScale}
            max={yMaxScale}
            value={isEditing ? (draftMin ?? '') : (min ?? '')}
            disabled={!isEditing}
            onChange={(e) => {
              const displayVal = Number(e.target.value);
              // Keep drafts in display units for consistent UI and validation
              setDraftMinClamped(displayVal);
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
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              value={isEditing ? (draftWarning ?? '') : (warning ?? '')}
              disabled={!isEditing}
              onChange={(e) => {
                const val = Math.max(0, Math.min(100, Number(e.target.value)));
                setDraftWarning(val);
                // Don't call onChange while editing - only update local draft state
              }}
              className={baseInput}
              title="Warning margin as percentage of range"
            />
            <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-xs`}>%</span>
          </div>
          
          {/* Warning Zone Calculation Display */}
          {(() => {
            const mMin = Number(isEditing ? draftMin : min);
            const mMax = Number(isEditing ? draftMax : max);
            const mWarn = Number(isEditing ? draftWarning : warning);
            if (!Number.isFinite(mMin) || !Number.isFinite(mMax) || !Number.isFinite(mWarn)) return null;
            const range = mMax - mMin;
            if (range <= 0) return null;
            const warningOffset = (range * mWarn) / 100;
            const upperWarningStart = mMax - warningOffset;
            const lowerWarningEnd = mMin + warningOffset;
            if (upperWarningStart <= lowerWarningEnd) return null;
            const unitLbl = sensorType === 'humidity' ? '%' : (userTempScale === 'C' ? '°C' : '°F');
            return (
              <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <div>Range: {range.toFixed(1)}{unitLbl}</div>
                <div>Warning: {warningOffset.toFixed(1)}{unitLbl}</div>
                <div className="text-orange-500">
                  Zones: {lowerWarningEnd.toFixed(1)} - {upperWarningStart.toFixed(1)}
                </div>
              </div>
            );
          })()}
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
  const [username, setUsername] = useState('User');

  const [currentView, setCurrentView] = useState('alerts'); // alerts | alertDetail
  const [selectedId, setSelectedId] = useState(null);

  const [userTempScale, setUserTempScale] = useState('F'); // fetched from user_preferences.temp_scale
  const [userTimeZone, setUserTimeZone] = useState('UTC'); // fetched from user_preferences.time_zone
  const [streams, setStreams] = useState([]);               // list rows
  const [selectedRole, setSelectedRole] = useState('all');  // all | owned | admin | viewer
  const [thresholds, setThresholds] = useState({});         // id -> {min,max,warning}
  const [series, setSeries] = useState({});                 // id -> values in °F (or % for humidity)
  const HISTORY_LEN = 120;
  // Local per-alert options (message + delivery channels)
  const [alertOptions, setAlertOptions] = useState({});     // id -> { message, email, sms }
  // Alert preferences from database
  const [alertPreferences, setAlertPreferences] = useState({}); // sensor_id -> { email_alert, mobile_alert }
  
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
    if (sensor.status !== 'offline' && sensor.status !== 'unknown') return null;
    
    if (sensor.temp == null) {
      return 'No temperature readings';
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
    
    return sensor.status === 'offline' ? 'Sensor Offline' : 'Unknown status';
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
        // Check authentication
        const token = localStorage.getItem('auth-token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await fetch('/api/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        if (!response.ok) {
          localStorage.removeItem('auth-token');
          router.push('/login');
          return;
        }

        const { user } = await response.json();
        setUsername(user?.email?.split('@')[0] || 'User');

        // Get user preferences using API client
        const pref = await apiClient.getUserPreferences();
        if (pref) {
          if (pref.tempScale) setUserTempScale(pref.tempScale === 'C' ? 'C' : 'F');
          if (pref.timeZone) setUserTimeZone(pref.timeZone);
        }
      } catch (e) {
        console.error(e);
        setError(e?.message || 'Failed to verify session');
        router.push('/login');
      }
    };
    run();
  }, [router]);

  // Function to refresh sensor data
  const refreshSensorData = useCallback(async () => {
    try {
      // Skip if not authenticated to avoid 401s
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth-token');
        if (!token) {
          setError('Not authenticated');
          return;
        }
      }
      console.log('Refreshing sensor data...');
      // Get sensors with all needed data (units, names, types, thresholds, latest values)
      const sensorRows = await apiClient.getAlerts();

      const nextThresholds = {};
      const ui = (sensorRows || []).map((r) => {
        const key = makeKey(r.sensor_id);
        const unit = (r.metric || 'F').toUpperCase(); // 'F' | 'C' | '%'
        const sensorType = r.sensor_type || (unit === '%' ? 'humidity' : 'temperature');

        // Use latest_temp directly from sensors table
        const rawVal = r.latest_temp != null ? Number(r.latest_temp) : null;
        const valF = sensorType === 'humidity' ? rawVal : (rawVal != null ? toF(rawVal, unit === 'C' ? 'C' : 'F') : null);

        // Convert thresholds from sensor metric units to user's preferred scale for display
        const nMin = Number(r?.min_limit);
        const nMax = Number(r?.max_limit);
        const nWarn = Number(r?.warning_limit);
        const th = {
          min: Number.isFinite(nMin) ? 
            (sensorType === 'humidity' ? nMin : convertForDisplay(toF(nMin, unit === 'C' ? 'C' : 'F'), userTempScale)) : null,
          max: Number.isFinite(nMax) ? 
            (sensorType === 'humidity' ? nMax : convertForDisplay(toF(nMax, unit === 'C' ? 'C' : 'F'), userTempScale)) : null,
          warning: Number.isFinite(nWarn) ? nWarn : 10, // ✅ default to 10%
        };
        nextThresholds[key] = th;

        // Use status directly from database
        const status = r.status || 'unknown';

        return {
          id: key,
          name: r.sensor_name || `Sensor ${r.sensor_id}`,
          temp: valF,
          status: status,
          lastReading: r.last_fetched_time ? toLocalFromReading({ last_fetched_time: r.last_fetched_time }, userTimeZone) : '—',
          lastFetchedTime: r.last_fetched_time, // Store original timestamp for status computation
          sensor_id: r.sensor_id,
          device_id: r.device_id,
          unit,
          sensor_type: sensorType,
          access_role: r.access_role || 'viewer',
        };
      });

      setThresholds(nextThresholds);
      setStreams(ui.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error('Error refreshing sensor data:', e);
      setError(e?.message || 'Failed to refresh sensors');
    }
  }, [userTempScale, userTimeZone]);

  /* ----- initial sensors + latest readings + thresholds ----- */
  useEffect(() => {
    const load = async () => {
      try {
        // Skip if not authenticated to avoid 401s
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('auth-token');
          if (!token) {
            setLoading(false);
            return;
          }
        }
        // Get sensors with all needed data (units, names, types, thresholds, latest values)
        const sensorRows = await apiClient.getAlerts();

        const nextThresholds = {};
        const ui = (sensorRows || []).map((r) => {
          const key = makeKey(r.sensor_id);
          const unit = (r.metric || 'F').toUpperCase(); // 'F' | 'C' | '%'
          const sensorType = r.sensor_type || (unit === '%' ? 'humidity' : 'temperature');

          // Use latest_temp directly from sensors table
          const rawVal = r.latest_temp != null ? Number(r.latest_temp) : null;
          const valF = sensorType === 'humidity' ? rawVal : (rawVal != null ? toF(rawVal, unit === 'C' ? 'C' : 'F') : null);

          // Convert thresholds from sensor metric units to user's preferred scale for display
          const nMin2 = Number(r?.min_limit);
          const nMax2 = Number(r?.max_limit);
          const nWarn2 = Number(r?.warning_limit);
          const th = {
            min: Number.isFinite(nMin2) ? 
              (sensorType === 'humidity' ? nMin2 : convertForDisplay(toF(nMin2, unit === 'C' ? 'C' : 'F'), userTempScale)) : null,
            max: Number.isFinite(nMax2) ? 
              (sensorType === 'humidity' ? nMax2 : convertForDisplay(toF(nMax2, unit === 'C' ? 'C' : 'F'), userTempScale)) : null,
            warning: Number.isFinite(nWarn2) ? nWarn2 : 10, // ✅ default to 10%
          };
          nextThresholds[key] = th;

          // Use status directly from database
          const status = r.status || 'unknown';

          return {
            id: key,
            name: r.sensor_name || `Sensor ${r.sensor_id}`,
            temp: valF,
            status: status,
            lastReading: r.last_fetched_time ? toLocalFromReading({ last_fetched_time: r.last_fetched_time }, userTimeZone) : '—',
            lastFetchedTime: r.last_fetched_time, // Store original timestamp for status computation
            sensor_id: r.sensor_id,
            device_id: r.device_id,
            unit,
            sensor_type: sensorType,
            access_role: r.access_role || 'viewer',
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
  }, [userTimeZone, userTempScale]);

  /* ----- periodic refresh every 20 seconds ----- */
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Periodic refresh: fetching latest sensor data...');
      refreshSensorData();
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [refreshSensorData]);

  /* ----- history after selecting a sensor ----- */
  useEffect(() => {
    if (!selectedId) return;
    const sel = streams.find((s) => s.id === selectedId);
    if (!sel) return;
    if (series[selectedId]) return;

    const loadHistory = async () => {
      try {
        const readings = await apiClient.getSensorReadings(sel.sensor_id, { limit: HISTORY_LEN, endTime: new Date().toISOString() });
        const values = (readings || []).map((r) =>
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
    const id = setInterval(() => {
      refreshSensorData();
    }, 20000);
    return () => clearInterval(id);
  }, [refreshSensorData]);

  /* ----- local helpers ----- */
  const updateThresholdLocal = (sensorId, next) => {
    const key = makeKey(sensorId);
    setThresholds((prev) => {
      const merged = { ...prev, [key]: { ...prev[key], ...next } };
      setStreams((prevS) =>
        prevS.map((s) =>
          s.id === key ? { ...s, status: s.status || 'unknown' } : s
        )
      );
      return merged;
    });
  };

  // Update alert options locally by sensor id
  const updateAlertOptionsLocal = (sensorId, next) => {
    const key = makeKey(sensorId);
    setAlertOptions((prev) => ({
      ...prev,
      [key]: {
        message: '',
        email: false,
        sms: true,
        ...(prev[key] || {}),
        ...next,
      },
    }));
  };

  // Load alert preferences from database
  const loadAlertPreferences = useCallback(async (sensorId) => {
    try {
      console.log('Loading alert preferences for sensorId:', sensorId);
      const preferences = await apiClient.getAlertPreferences(sensorId);
      console.log('Received preferences:', preferences);
      
      if (!preferences) {
        console.warn('No preferences returned from API');
        return;
      }
      
      setAlertPreferences(prev => ({
        ...prev,
        [sensorId]: preferences
      }));
      
      // Update local alert options with database preferences
      const key = makeKey(sensorId);
      console.log('Using key for alertOptions:', key);
      console.log('Setting email:', preferences.email_alert, 'sms:', preferences.mobile_alert);
      
      setAlertOptions(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          email: preferences.email_alert,
          sms: preferences.mobile_alert
        }
      }));
    } catch (error) {
      console.error('Failed to load alert preferences:', error);
      console.error('Error details:', error.message, error.stack);
      setError('Failed to load alert preferences: ' + error.message);
    }
  }, []);

  // Save alert preferences to database
  const saveAlertPreferences = async (sensorId, preferences) => {
    try {
      await apiClient.updateAlertPreferences(sensorId, preferences);
      setAlertPreferences(prev => ({
        ...prev,
        [sensorId]: { ...prev[sensorId], ...preferences }
      }));
    } catch (error) {
      console.error('Failed to save alert preferences:', error);
      setError('Failed to save alert preferences: ' + error.message);
    }
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

  // Load alert preferences when a sensor is selected
  useEffect(() => {
    if (selectedId) {
      const sel = streams.find((s) => s.id === selectedId);
      if (sel && sel.sensor_id) {
        loadAlertPreferences(sel.sensor_id);
      }
    }
  }, [selectedId, streams, loadAlertPreferences]);

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

      const updatePayload = {};
      let hasChanges = false;
      
      if (nextName !== sel.name) {
        updatePayload.sensor_name = nextName;
        hasChanges = true;
      }
      if (targetMetric !== sel.unit) {
        updatePayload.metric = targetMetric;
        hasChanges = true;
      }
      if (targetSensorType !== sel.sensor_type) {
        updatePayload.sensor_type = targetSensorType;
        hasChanges = true;
      }

      // if nothing changed, just close
      if (!hasChanges) {
        setShowSettings(false);
        return;
      }

      const data = await apiClient.updateAlertThresholds(sel.sensor_id, updatePayload, sel.device_id);

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
    const display = sensor.status === 'offline' || sensor.status === 'unknown'
      ? 'NA'
      : (sensor.sensor_type === 'humidity'
        ? (sensor.temp != null ? `${sensor.temp.toFixed(1)}%` : '—')
        : (sensor.temp != null ? `${convertForDisplay(sensor.temp, userTempScale).toFixed(1)}°${userTempScale}` : '—'));
    
    // Get the reason for offline/unknown sensors
    const offlineReason = getUnconfiguredReason(sensor);
    
    return (
      <div
        className={`rounded-lg shadow p-4 border-l-4 ${cardClass(sensor.status, darkMode)} cursor-pointer hover:shadow-lg transition-shadow`}
        onClick={() => handleAlertClick(sensor)}
      >
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-lg">{sensor.name}</p>
            <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full align-middle ${
              sensor.access_role === 'owner'
                ? 'bg-green-200 text-green-800'
                : sensor.access_role === 'admin'
                ? 'bg-yellow-200 text-yellow-800'
                : 'bg-gray-200 text-gray-800'
            }`}>
              {sensor.access_role}
            </span>
            <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <span className="mr-1">
                {sensor.status === 'offline' ? '📡' : sensor.status === 'unknown' ? '❓' : '🕐'}
              </span>
              {sensor.status === 'offline' && offlineReason 
                ? offlineReason 
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
          <div className="flex items-center gap-2">
            <label className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Role:</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={`border rounded px-2 py-1 ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All</option>
              <option value="owned">Owned</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={() => {
              try { localStorage.removeItem('auth-token'); } catch {};
              router.push('/login');
            }}
            className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ${darkMode ? 'bg-red-600 hover:bg-red-700' : ''}`}
          >
            Log out
          </button>
          <div className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold ${darkMode ? 'bg-amber-700' : ''}`}>
            {username.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {(() => {
          const roleMatches = (s) => (
            selectedRole === 'all' ||
            (selectedRole === 'owned' && s.access_role === 'owner') ||
            (selectedRole === 'admin' && s.access_role === 'admin') ||
            (selectedRole === 'viewer' && s.access_role === 'viewer')
          );
          const filtered = streams.filter(roleMatches);
          const inStatus = (status) => filtered.filter((s) => s.status === status);
          const sections = [
            { icon: '🚨', label: 'Alert', status: 'alert' },
            { icon: '⚠️', label: 'Warning', status: 'warning' },
            { icon: '✅', label: 'OK', status: 'ok' },
            { icon: '📡', label: 'Sensor Offline', status: 'offline' },
            { icon: '❓', label: 'Unknown', status: 'unknown' }
          ];
          return (
            <>
              {sections.map((sec) => (
                <React.Fragment key={sec.status}>
                  <SectionHeader icon={sec.icon} label={sec.label} status={sec.status} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inStatus(sec.status).map((s) => (
                      <AlertCard key={`${sec.status}-${s.id}`} sensor={s} />
                    ))}
                    {inStatus(sec.status).length === 0 && (
                      <div className={`col-span-full p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {selectedRole === 'all' ? 'No sensors' : 'No sensors for selected role'}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </>
          );
        })()}
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
              onClick={() => {
                try { localStorage.removeItem('auth-token'); } catch {};
                router.push('/login');
              }}
              className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ${darkMode ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              Log out
            </button>
            <div className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold ${darkMode ? 'bg-amber-700' : ''}`}>
              {username.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${getStatusStyles(selected.status, darkMode).section} p-3 rounded flex items-center`}>
            <span className="mr-3 text-xl">
              {selected.status === 'alert'
                ? '🚨'
                : selected.status === 'warning'
                ? '⚠️'
                : selected.status === 'ok'
                ? '✅'
                : selected.status === 'offline'
                ? '📡'
                : '❓'}
            </span>
            {selected.status}
          </div>

          <div className={`rounded-lg shadow p-4 border-l-4 ${getStatusStyles(selected.status, darkMode).border} ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-center">
                          <div>
              <p className="font-semibold text-lg">{selected.name}</p>

              <p className={`text-sm flex items-center mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className="mr-1">
                  {selected.status === 'offline' || selected.status === 'unknown' ? '⚠️' : '🕐'}
                </span>
                {(selected.status === 'offline' || selected.status === 'unknown') 
                  ? getUnconfiguredReason(selected) 
                  : selected.lastReading}
              </p>
            </div>
              <div className="flex items-center gap-3">
                <div className={`${getStatusStyles(selected.status, darkMode).value} text-xl mb-1 font-bold`}>
                  {selected.status === 'offline' || selected.status === 'unknown'
                    ? 'NA'
                    : (selected.sensor_type === 'humidity'
                      ? `💧 ${selected.temp != null ? selected.temp.toFixed(1) : '—'}%`
                      : `🌡️ ${selected.temp != null ? convertForDisplay(selected.temp, userTempScale).toFixed(1) : '—'}°${userTempScale}`)}
                </div>
                {(selected.access_role === 'owner' || selected.access_role === 'admin') && (
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
                )}
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
                  {selected.name} • Unit: {selected.sensor_type === 'humidity' ? '%' : `°${userTempScale}`}
                </p>
              </div>
              <div className="text-sm">
                {t.min !== null && t.max !== null ? (() => {
                  const lo = Math.min(t.min, t.max);
                  const hi = Math.max(t.min, t.max);
                  const unitLabel = selected.sensor_type === 'humidity' ? '%' : `°${userTempScale}`;
                  return (
                    <>Limits: <strong>{hi.toFixed(1)}{unitLabel}</strong> – <strong>{lo.toFixed(1)}{unitLabel}</strong></>
                  );
                })() : (
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
                onSave={refreshSensorData}
                sensorId={selected.sensor_id}
                unit={selected.unit}
                editable={selected.access_role === 'owner' || selected.access_role === 'admin'}
                userTempScale={userTempScale}
                sensorType={selected.sensor_type}
                timeZone={userTimeZone}
                deviceId={selected.device_id}
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

          {/* Alert Message and Delivery Options */}
          <div className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-white'} rounded-lg shadow p-6`}>
            <h3 className="text-lg font-semibold mb-4">Alert Message</h3>
            <input
              type="text"
              value={(alertOptions[selected.id]?.message) ?? ''}
              onChange={(e) => updateAlertOptionsLocal(selected.sensor_id, { message: e.target.value })}
              placeholder="Ex: My (Sensor Name): Temperature above 50°F"
              className={`border rounded px-3 py-3 w-full ${darkMode ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400 focus:border-orange-500' : 'bg-white border-gray-300 placeholder-gray-400 focus:border-orange-500'} focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            />

            <div className="mt-8 space-y-8">
              {/* Email toggle */}
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={async () => {
                    console.log('Email toggle clicked. selected.id:', selected.id, 'selected.sensor_id:', selected.sensor_id);
                    console.log('Current alertOptions[selected.id]:', alertOptions[selected.id]);
                    const newEmailValue = !(alertOptions[selected.id]?.email);
                    console.log('New email value:', newEmailValue);
                    updateAlertOptionsLocal(selected.sensor_id, { email: newEmailValue });
                    await saveAlertPreferences(selected.sensor_id, { email_alert: newEmailValue });
                  }}
                  className={`relative inline-flex items-center transition-colors rounded-full w-24 h-12 ${(alertOptions[selected.id]?.email) ? (darkMode ? 'bg-orange-600' : 'bg-orange-500') : (darkMode ? 'bg-gray-600' : 'bg-gray-300')}`}
                  aria-pressed={(alertOptions[selected.id]?.email) ? true : false}
                >
                  <span className={`inline-block w-8 h-8 bg-white rounded-full transform transition-transform ${(alertOptions[selected.id]?.email) ? 'translate-x-12' : 'translate-x-2'}`} />
                </button>
                <div>
                  <div className="font-medium">Email Alerts</div>
                  <div className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>Receive email notifications when this sensor triggers alerts</div>
                </div>
              </div>

              {/* SMS toggle */}
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={async () => {
                    const newSmsValue = !(((alertOptions[selected.id]?.sms) ?? true));
                    updateAlertOptionsLocal(selected.sensor_id, { sms: newSmsValue });
                    await saveAlertPreferences(selected.sensor_id, { mobile_alert: newSmsValue });
                  }}
                  className={`relative inline-flex items-center transition-colors rounded-full w-24 h-12 ${(((alertOptions[selected.id]?.sms) ?? true)) ? (darkMode ? 'bg-orange-600' : 'bg-orange-500') : (darkMode ? 'bg-gray-600' : 'bg-gray-300')}`}
                  aria-pressed={(((alertOptions[selected.id]?.sms) ?? true)) ? true : false}
                >
                  <span className={`inline-block w-8 h-8 bg-white rounded-full transform transition-transform ${(((alertOptions[selected.id]?.sms) ?? true)) ? 'translate-x-12' : 'translate-x-2'}`} />
                </button>
                <div>
                  <div className="font-medium">Mobile Alerts</div>
                  <div className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-sm`}>Receive mobile/push notifications when this sensor triggers alerts</div>
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <h3 className="text-lg font-semibold mb-4">Last Reading</h3>
                          <div className="space-y-3">
                <div className="flex justify-between">
                  <span>{(selected.status === 'offline' || selected.status === 'unknown') ? 'Status' : 'Time'}</span>
                  <span className="font-medium">
                    {selected.status === 'offline' || selected.status === 'unknown' 
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
                  {selected.status === 'offline' || selected.status === 'unknown'
                    ? 'NA'
                    : (selected.temp != null
                      ? (selected.sensor_type === 'humidity'
                        ? `${selected.temp.toFixed(1)}%`
                        : `${convertForDisplay(selected.temp, userTempScale).toFixed(1)}°${userTempScale}`)
                      : '—')}
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

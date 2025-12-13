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
        section: `${darkMode ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-800'}`,
        border: 'border-gray-500',
        value: 'text-gray-600',
      };
    case 'unknown':
    default:
      return {
        section: `${darkMode ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-800'}`,
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
    dark: 'bg-slate-700 border-slate-600 text-white',
  },
  unknown: {
    light: 'bg-gray-50 border-gray-300 text-gray-800',
    dark: 'bg-slate-700 border-slate-600 text-white',
  },
};
const cardClass = (status, darkMode) =>
  (darkMode ? CARD_STYLES[status]?.dark : CARD_STYLES[status]?.light) ||
  (darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800');



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
  const [localData, setLocalData] = useState([]);
  const [localDataWithTimestamps, setLocalDataWithTimestamps] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

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
      // Only use prop data as fallback if no sensorId is provided
      setLocalData(Array.isArray(data) ? data : []);
      setLocalDataWithTimestamps([]);
      setDataLoaded(true);
      return;
    }
    
    // Prevent duplicate API calls
    if (isFetching) {
      return;
    }
    
    setIsFetching(true);
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
      setDataLoaded(true);
      setInitialLoad(false); // Mark initial load as complete
    } catch (error) {
      console.error('Error fetching recent readings:', error);
      // keep existing data on error
      setDataLoaded(true); // Still mark as loaded even on error to prevent infinite loading
      setInitialLoad(false); // Mark initial load as complete even on error
    } finally {
      setIsFetching(false);
    }
  }, [sensorId, unit, data, userTempScale, sensorType, localDataWithTimestamps, isFetching]);

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
  }, [drag, isEditing, draftMin, draftMax, onChange, chartH, yMaxScale, yMinScale]); // no posToTemp dep

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

    // Convert limits to sensor's metric units before saving to DB
    let dbMin = nMin, dbMax = nMax, dbWarn = nWarn;
    
    try {
      setSaveStatus('saving');
      
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

  // Show loading state only during initial load
  if (initialLoad && !dataLoaded) {
    return (
      <div ref={containerRef} className={containerStyles}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <div className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Loading chart data...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show fallback message if no data (only after initial load is complete)
  if (dataLoaded && (!Array.isArray(plotData) || plotData.length === 0)) {
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
    <div ref={containerRef} className={`${containerStyles} relative`}>
      {/* Edit / Save / Cancel controls (top-right of the chart) */}
      <div className="flex items-center gap-3 absolute right-0 -top-12 z-20">
        {/* Edit controls - only visible when editable */}
        {editable && (
          <>
            {!isEditing ? (
              <button
                type="button"
                onClick={startEdit}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all duration-200 shadow-lg hover:shadow-xl ${
                  darkMode
                    ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white border-slate-600 hover:from-slate-600 hover:to-slate-700 hover:border-slate-500'
                    : 'bg-gradient-to-r from-white to-slate-50 text-slate-800 border-slate-300 hover:from-slate-50 hover:to-white hover:border-slate-400'
                }`}
                title="Enable editing of limits"
              >
                ✏️ Edit Limits
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl ${
                    darkMode ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-500 hover:to-slate-600' : 'bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 hover:from-slate-100 hover:to-slate-200'
                  }`}
                >
                  ❌ Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={!isValidLimits}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl ${
                    darkMode ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500'
                  } ${!isValidLimits ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {saveStatus === 'saving' ? '💾 Saving…' : '💾 Save'}
                </button>
                {/* Removed dev test buttons to keep UI DB-driven only */}
                {saveStatus === 'error' && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-red-50 text-red-600 border border-red-200'}`}>❌ Save failed</span>
                )}
                {saveStatus === 'saved' && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${darkMode ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-green-50 text-green-600 border border-green-200'}`}>✅ Saved</span>
                )}
              </>
            )}
          </>
        )}
      </div>

      <svg ref={svgRef} width={W} height={H} className="block">
        {/* Modern gradient background */}
        <defs>
          <linearGradient id="chartBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={darkMode ? "#1e293b" : "#ffffff"} />
            <stop offset="100%" stopColor={darkMode ? "#0f172a" : "#f8fafc"} />
          </linearGradient>
          <linearGradient id="gridLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={darkMode ? "#334155" : "#e2e8f0"} stopOpacity="0.3" />
            <stop offset="50%" stopColor={darkMode ? "#475569" : "#cbd5e1"} stopOpacity="0.6" />
            <stop offset="100%" stopColor={darkMode ? "#334155" : "#e2e8f0"} stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="dataPointGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect x={padL} y={padT} width={chartW} height={chartH} fill="url(#chartBg)" stroke={strokeAxis} strokeWidth="2" rx="8" ry="8" />
        
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
                  <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={darkMode ? '#475569' : '#cbd5e1'} strokeWidth="1.5" />
                  <text x={padL - 12} y={y(t) + 5} textAnchor="end" fontSize="13" fontWeight="500" fill={darkMode ? '#94a3b8' : '#64748b'}>
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
                  <line x1={padL - 6} x2={padL} y1={y(t)} y2={y(t)} stroke={darkMode ? '#475569' : '#cbd5e1'} strokeWidth="1.5" />
                  <text x={padL - 12} y={y(t) + 5} textAnchor="end" fontSize="13" fontWeight="500" fill={darkMode ? '#94a3b8' : '#64748b'}>
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
            
            {/* Latest data point with modern styling */}
            <circle 
              cx={getLatestX()} 
              cy={y(plotData[plotData.length - 1])} 
              r="6" 
              fill={(() => {
                const temp = plotData[plotData.length - 1];
                if (min !== null && max !== null && warning !== null) {
                  if (temp < min || temp > max) return '#DC2626'; // Red for danger
                  const band = (Number(warning) || 0) / 100 * (max - min);
                  if (temp <= min + band || temp >= max - band) return '#EA580C'; // Orange for warning
                }
                return '#10B981'; // Green for good (default when no thresholds)
              })()}
              stroke={darkMode ? "#1f2937" : "#ffffff"}
              strokeWidth="3"
              filter="url(#dataPointGlow)"
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
  
  // Add Alert modal state
  const [showAddAlert, setShowAddAlert] = useState(false);

  const makeKey = (sensor_id) => `${sensor_id}`;

  // Function to get the reason why a sensor is unconfigured
  const getUnconfiguredReason = (sensor) => {
    if (sensor.status !== 'offline') return null;
    
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
    
    return 'Sensor Offline';
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
        const status = r.status || 'offline';

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
          const status = r.status || 'offline';

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
          s.id === key ? { ...s, status: s.status || 'offline' } : s
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
      <div className={`${section} p-4 rounded-2xl shadow-lg flex items-center justify-between`}>
        <div className="flex items-center">
          <span className="mr-3 text-xl">{icon}</span>
          <span className="text-lg font-semibold">{label}</span>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          status === 'alert' ? 'bg-red-100 text-red-800' :
          status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
          status === 'ok' ? 'bg-green-100 text-green-800' :
          status === 'offline' ? 'bg-gray-100 text-gray-800' :
          'bg-slate-100 text-slate-800'
        }`}>
          {status.toUpperCase()}
        </div>
      </div>
    );
  };

  const AlertCard = ({ sensor }) => {
    const { value } = getStatusStyles(sensor.status, darkMode);
    const display = sensor.status === 'offline'
      ? 'NA'
      : (sensor.sensor_type === 'humidity'
        ? (sensor.temp != null ? `${sensor.temp.toFixed(1)}%` : '—')
        : (sensor.temp != null ? `${convertForDisplay(sensor.temp, userTempScale).toFixed(1)}°${userTempScale}` : '—'));
    
    // Get the reason for offline/unknown sensors
    const offlineReason = getUnconfiguredReason(sensor);
    
    return (
      <div
        className={`rounded-2xl shadow-xl p-6 border-l-4 ${cardClass(sensor.status, darkMode)} cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105`}
        onClick={() => handleAlertClick(sensor)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-bold text-xl mb-2">{sensor.name}</h3>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                sensor.access_role === 'owner'
                  ? 'bg-green-100 text-green-800'
                  : sensor.access_role === 'admin'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-slate-100 text-slate-800'
              }`}>
                {sensor.access_role}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                sensor.status === 'alert' ? 'bg-red-100 text-red-800' :
                sensor.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                sensor.status === 'ok' ? 'bg-green-100 text-green-800' :
                sensor.status === 'offline' ? 'bg-gray-100 text-gray-800' :
                'bg-slate-100 text-slate-800'
              }`}>
                {sensor.status.toUpperCase()}
              </span>
            </div>
            <p className={`text-sm flex items-center ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              <span className="mr-2">
                {sensor.status === 'offline' ? '📡' : '🕐'}
              </span>
              {sensor.status === 'offline' && offlineReason 
                ? offlineReason 
                : sensor.lastReading}
            </p>
          </div>
          <div className="text-right ml-4">
            <div className={`${value} text-2xl font-bold mb-1`}>
              {sensor.sensor_type === 'humidity' ? `💧 ${display}` : `🌡️ ${display}`}
            </div>
            <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {sensor.sensor_type === 'humidity' ? 'Humidity' : 'Temperature'}
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
              <p>Loading…</p>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  /* -------------------- Views -------------------- */
  const renderAlertsView = () => (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Alerts
          </h1>
          <p className={`text-xl mt-2 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
            Monitor and manage sensor alerts
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Filter by role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={`border rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                darkMode 
                  ? 'bg-slate-700 text-white border-slate-500 hover:border-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20' 
                  : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
              }`}
            >
              <option value="all">All</option>
              <option value="owned">Owned</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            onClick={() => setShowAddAlert(true)}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${
              darkMode
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500'
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
            }`}
          >
            <span className="text-xl">+</span>
            Add Alert
          </button>
          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button
            onClick={() => {
              try { localStorage.removeItem('auth-token'); } catch {};
              router.push('/login');
            }}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl`}
          >
            Log out
          </button>
          <button
            onClick={() => router.push('/account')}
            className={`w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105`}
          >
            {username.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
          </button>
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
          // System Alerts includes offline and unknown statuses
          const inStatus = (status) => {
            if (status === 'offline') {
              // System Alerts includes both offline and unknown sensors
              return filtered.filter((s) => s.status === 'offline' || s.status === 'unknown');
            }
            return filtered.filter((s) => s.status === status);
          };
          const sections = [
            { icon: '', label: 'Needs Attention', status: 'alert' },
            { icon: '', label: 'Warning', status: 'warning' },
            { icon: '', label: 'Good', status: 'ok' },
            { icon: '', label: 'System Alerts', status: 'offline' }
          ];
          
          // Separate sections with alerts from those without
          const sectionsWithAlerts = sections.filter(sec => inStatus(sec.status).length > 0);
          const sectionsWithoutAlerts = sections.filter(sec => inStatus(sec.status).length === 0);
          
          // Combine: sections with alerts first, then sections without alerts
          const orderedSections = [...sectionsWithAlerts, ...sectionsWithoutAlerts];
          
          return (
            <>
              {orderedSections.map((sec) => (
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
      <main className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200 dark:scrollbar-thumb-slate-600 dark:scrollbar-track-slate-800">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setCurrentView('alerts'); setSelectedId(null); }}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 border ${
                darkMode 
                  ? 'bg-slate-700 text-white border-slate-500 hover:bg-slate-600 hover:border-slate-400' 
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                Alert Detail
              </h1>
              <p className={`text-lg mt-2 ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                {selected.name} - {selected.sensor_type}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                try { localStorage.removeItem('auth-token'); } catch {};
                router.push('/login');
              }}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl`}
            >
              Log out
            </button>
            <button
              onClick={() => router.push('/account')}
              className={`w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105`}
            >
              {username.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Status Header */}
          <div className={`${getStatusStyles(selected.status, darkMode).section} p-6 rounded-2xl shadow-xl flex items-center justify-between`}>
            <div className="flex items-center">
              <span className="mr-4 text-2xl">
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
              <div>
                <h2 className="text-2xl font-bold">{selected.status.toUpperCase()}</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Sensor Status
                </p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              selected.status === 'alert' ? 'bg-red-100 text-red-800' :
              selected.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
              selected.status === 'ok' ? 'bg-green-100 text-green-800' :
              selected.status === 'offline' ? 'bg-gray-100 text-gray-800' :
              'bg-slate-100 text-slate-800'
            }`}>
              {selected.status.toUpperCase()}
            </div>
          </div>

          {/* Sensor Info Card */}
          <div className={`rounded-2xl shadow-xl p-6 border-l-4 ${getStatusStyles(selected.status, darkMode).border} ${darkMode ? 'bg-slate-700 text-white' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-bold text-2xl mb-2">{selected.name}</h3>
                <p className={`text-sm flex items-center mb-4 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className="mr-2">
                    {selected.status === 'offline' ? '⚠️' : '🕐'}
                  </span>
                  {(selected.status === 'offline') 
                    ? getUnconfiguredReason(selected) 
                    : selected.lastReading}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selected.access_role === 'owner'
                      ? 'bg-green-100 text-green-800'
                      : selected.access_role === 'admin'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {selected.access_role}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selected.sensor_type === 'humidity' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {selected.sensor_type}
                  </span>
                </div>
              </div>
              <div className="text-right ml-6">
                <div className={`${getStatusStyles(selected.status, darkMode).value} text-3xl mb-2 font-bold`}>
                  {selected.status === 'offline' || selected.status === 'unknown'
                    ? 'NA'
                    : (selected.sensor_type === 'humidity'
                      ? `💧 ${selected.temp != null ? selected.temp.toFixed(1) : '—'}%`
                      : `🌡️ ${selected.temp != null ? convertForDisplay(selected.temp, userTempScale).toFixed(1) : '—'}°${userTempScale}`)}
                </div>
                <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Current Reading
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
                    className={`mt-3 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      darkMode
                        ? 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'
                        : 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200'
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
          <div className={`rounded-3xl shadow-2xl p-10 border border-slate-200/50 backdrop-blur-sm ${darkMode ? 'bg-gradient-to-br from-slate-800/95 to-slate-900/95 text-white border-slate-700/50' : 'bg-gradient-to-br from-white/95 to-slate-50/95'}`}>
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-2">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {selected.sensor_type === 'humidity' ? 'Humidity History' : 'Temperature History'}
                </h3>
                <div className="flex items-center space-x-4">
                  <p className={`text-lg font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Last 30 Minutes
                  </p>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${darkMode ? 'bg-slate-700/50 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                    {selected.name}
                  </div>
                </div>
                <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Unit: {selected.sensor_type === 'humidity' ? '%' : `°${userTempScale}`}
                </p>
              </div>
              <div className={`text-right px-6 py-4 rounded-2xl shadow-lg border ${darkMode ? 'bg-slate-700/50 border-slate-600/50' : 'bg-white/80 border-slate-200/50'}`}>
                <div className="text-sm font-semibold">
                  {t.min !== null && t.max !== null ? (() => {
                    const lo = Math.min(t.min, t.max);
                    const hi = Math.max(t.min, t.max);
                    const unitLabel = selected.sensor_type === 'humidity' ? '%' : `°${userTempScale}`;
                    return (
                      <div className="space-y-1">
                        <div className="text-xs font-medium opacity-70">Threshold Range</div>
                        <div className="text-base font-bold">
                          <span className="text-red-500">{hi.toFixed(1)}{unitLabel}</span>
                          <span className="mx-2 text-slate-400">–</span>
                          <span className="text-blue-500">{lo.toFixed(1)}{unitLabel}</span>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="space-y-1">
                      <div className="text-xs font-medium opacity-70">Threshold Range</div>
                      <div className="text-base font-bold text-slate-500">No limits set</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="relative">
              <div className={`absolute inset-0 rounded-2xl ${darkMode ? 'bg-gradient-to-br from-slate-800/20 to-slate-900/20' : 'bg-gradient-to-br from-white/20 to-slate-50/20'} backdrop-blur-sm border border-slate-200/30`}></div>
              <div className="relative z-10 p-6">
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
            </div>
            
            {/* Chart Legend */}
            <div className={`mt-8 p-6 rounded-2xl border backdrop-blur-sm ${darkMode ? 'bg-slate-700/30 border-slate-600/30' : 'bg-slate-50/80 border-slate-200/50'}`}>
              <h4 className={`text-sm font-bold mb-4 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                Chart Legend
              </h4>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-gradient-to-r from-gray-400 to-gray-500 opacity-40 rounded-lg shadow-sm"></div>
                  <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    No data
                  </span>
                </div>
                {t.min !== null && t.max !== null && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 opacity-25 rounded-lg shadow-sm"></div>
                      <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Danger zone (outside limits)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gradient-to-r from-orange-500 to-yellow-500 opacity-20 rounded-lg shadow-sm"></div>
                      <span className={`font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Warning zone
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Alert Delivery Options */}
          <div className={`${darkMode ? 'bg-slate-700 text-white' : 'bg-white'} rounded-2xl shadow-xl p-8`}>
            <h3 className="text-2xl font-bold mb-6">Alert Configuration</h3>
            <p className={`text-sm mb-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Alert messages are automatically generated by the sensor system.
            </p>

            <div className="space-y-8">
              {/* Email toggle */}
              <div className="flex items-center gap-6 p-4 rounded-xl border border-slate-200">
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
                  className={`relative inline-flex items-center transition-all duration-200 rounded-full w-24 h-12 ${(alertOptions[selected.id]?.email) ? (darkMode ? 'bg-orange-600' : 'bg-orange-500') : (darkMode ? 'bg-slate-600' : 'bg-slate-300')}`}
                  aria-pressed={(alertOptions[selected.id]?.email) ? true : false}
                >
                  <span className={`inline-block w-8 h-8 bg-white rounded-full transform transition-transform ${(alertOptions[selected.id]?.email) ? 'translate-x-12' : 'translate-x-2'}`} />
                </button>
                <div>
                  <div className="font-semibold text-lg">Email Alerts</div>
                  <div className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm`}>Receive email notifications when this sensor triggers alerts</div>
                </div>
              </div>

              {/* SMS toggle - Coming Soon */}
              <div className="flex items-center gap-6 p-4 rounded-xl border border-slate-200 opacity-60">
                <button
                  type="button"
                  disabled
                  className={`relative inline-flex items-center transition-all duration-200 rounded-full w-24 h-12 ${darkMode ? 'bg-slate-600' : 'bg-slate-300'} cursor-not-allowed`}
                  aria-pressed={false}
                >
                  <span className={`inline-block w-8 h-8 bg-white rounded-full transform transition-transform translate-x-2`} />
                </button>
                <div>
                  <div className="font-semibold text-lg">Mobile Alerts <span className="text-xs font-normal">(Coming Soon)</span></div>
                  <div className={`${darkMode ? 'text-slate-300' : 'text-slate-600'} text-sm`}>Mobile/push notifications will be available in a future update</div>
                </div>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl shadow-xl p-8 ${darkMode ? 'bg-slate-700 text-white' : 'bg-white'}`}>
            <h3 className="text-2xl font-bold mb-6">Sensor Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-sm font-medium text-slate-500 mb-1">{selected.status === 'offline' ? 'Status' : 'Last Reading Time'}</div>
                <div className="text-lg font-semibold">
                  {selected.status === 'offline' 
                    ? getUnconfiguredReason(selected) 
                    : selected.lastReading}
                </div>
              </div>
              
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-sm font-medium text-slate-500 mb-1">Threshold Range</div>
                <div className="text-lg font-semibold">
                  {Number.isFinite(t.min) && Number.isFinite(t.max)
                    ? (selected.sensor_type === 'humidity'
                      ? `${t.min}% - ${t.max}%`
                      : `${convertForDisplay(t.min, userTempScale).toFixed(0)}°${userTempScale} - ${convertForDisplay(t.max, userTempScale).toFixed(0)}°${userTempScale}`)
                    : 'Not set'}
                </div>
              </div>
              
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-sm font-medium text-slate-500 mb-1">{selected.sensor_type === 'humidity' ? 'Current Humidity' : 'Current Temperature'}</div>
                <div className="text-lg font-semibold">
                  {selected.status === 'offline' || selected.status === 'unknown'
                    ? 'NA'
                    : (selected.temp != null
                      ? (selected.sensor_type === 'humidity'
                        ? `${selected.temp.toFixed(1)}%`
                        : `${convertForDisplay(selected.temp, userTempScale).toFixed(1)}°${userTempScale}`)
                      : '—')}
                </div>
              </div>
              
              <div className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-sm font-medium text-slate-500 mb-1">Sensor ID</div>
                <div className="text-lg font-semibold font-mono">{selected.sensor_id}</div>
              </div>
            </div>
          </div>

          {/* SETTINGS MODAL */}
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
              <div className={`relative w-full max-w-2xl mx-4 rounded-2xl shadow-2xl ${darkMode ? 'bg-slate-700 text-white' : 'bg-white'} p-8`}>
                <h3 className="text-3xl font-bold mb-6">Sensor Settings</h3>

                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-semibold mb-3">Sensor Name</label>
                    <input
                      type="text"
                      value={newSensorName}
                      onChange={(e) => setNewSensorName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveSensorName(); }}
                      className={`border rounded-xl px-4 py-3 w-full text-lg ${
                        darkMode
                          ? 'bg-slate-700 text-white border-slate-600 focus:border-orange-500'
                          : 'bg-white border-slate-300 focus:border-orange-500'
                      } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                      placeholder="Enter sensor display name"
                    />
                  </div>

                  <div>
                    <label className="block text-lg font-semibold mb-3">Sensor Type</label>
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
                      className={`border rounded-xl px-4 py-3 w-full text-lg ${
                        darkMode
                          ? 'bg-slate-700 text-white border-slate-600 focus:border-orange-500'
                          : 'bg-white border-slate-300 focus:border-orange-500'
                      } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                    >
                      <option value="temperature">Temperature</option>
                      <option value="humidity">Humidity</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-lg font-semibold mb-3">Metric (sensor unit)</label>
                    <select
                      value={newMetric}
                      onChange={(e) => {
                        const metric = e.target.value;
                        setNewMetric(metric);
                        // Auto-set sensor type based on metric
                        setNewSensorType(metric === '%' ? 'humidity' : 'temperature');
                      }}
                      className={`border rounded-xl px-4 py-3 w-full text-lg ${
                        darkMode
                          ? 'bg-slate-700 text-white border-slate-600 focus:border-orange-500'
                          : 'bg-white border-slate-300 focus:border-orange-500'
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
                    <p className={`text-sm mt-2 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {newSensorType === 'humidity' 
                        ? 'Humidity sensors measure moisture levels in percentage.'
                        : 'The dashboard always displays temperatures in °F. If your sensor reports in °C, we\'ll convert to °F for display.'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                  <button
                    onClick={() => setShowSettings(false)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                      darkMode ? 'bg-slate-600 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
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
                    className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 ${
                      darkMode ? 'bg-orange-700 hover:bg-orange-800 disabled:bg-slate-600'
                               : 'bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300'
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
      <style jsx global>{`
        /* Modern scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${darkMode ? '#1e293b' : '#f1f5f9'};
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(45deg, ${darkMode ? '#475569' : '#94a3b8'}, ${darkMode ? '#64748b' : '#cbd5e1'});
          border-radius: 10px;
          border: 2px solid ${darkMode ? '#1e293b' : '#f1f5f9'};
          transition: all 0.3s ease;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(45deg, ${darkMode ? '#64748b' : '#cbd5e1'}, ${darkMode ? '#94a3b8' : '#e2e8f0'});
          transform: scale(1.1);
        }
        
        ::-webkit-scrollbar-corner {
          background: ${darkMode ? '#1e293b' : '#f1f5f9'};
        }
        
        /* Firefox scrollbar styling */
        * {
          scrollbar-width: thin;
          scrollbar-color: ${darkMode ? '#475569 #1e293b' : '#94a3b8 #f1f5f9'};
        }
      `}</style>
      <div className={`flex min-h-screen ${darkMode ? "bg-slate-900 text-white" : "bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800"}`}>
        <Sidebar darkMode={darkMode} activeKey="alerts" />
        {currentView === 'alerts' && renderAlertsView()}
        {currentView === 'alertDetail' && renderAlertDetailView()}
        
        {/* ADD ALERT MODAL - Global, accessible from any view */}
        {showAddAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddAlert(false)} />
            <div className={`relative w-full max-w-4xl mx-4 rounded-2xl shadow-2xl ${darkMode ? 'bg-slate-800 text-white' : 'bg-white'} p-8 max-h-[90vh] overflow-y-auto`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-3xl font-bold">Configure Sensor Alerts</h3>
                <button
                  onClick={() => setShowAddAlert(false)}
                  className={`p-2 rounded-lg transition-all ${
                    darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <p className={`mb-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Select a sensor below and click on it to configure alert thresholds and notification preferences.
              </p>

              {streams.length === 0 ? (
                <div className={`text-center py-12 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <p className="text-lg mb-4">No sensors available</p>
                  <p className="text-sm">Add sensors from the Devices page first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {streams.map((sensor) => {
                    const statusStyles = getStatusStyles(sensor.status, darkMode);
                    const hasAlert = sensor.status === 'alert' || sensor.status === 'warning';
                    
                    return (
                      <div
                        key={sensor.id}
                        onClick={() => {
                          setSelectedId(sensor.id);
                          setCurrentView('alertDetail');
                          setShowAddAlert(false);
                        }}
                        className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          darkMode
                            ? 'bg-slate-700 border-slate-600 hover:border-orange-500'
                            : 'bg-white border-slate-200 hover:border-orange-500'
                        } ${hasAlert ? 'ring-2 ring-red-500/50' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="text-lg font-bold">{sensor.name}</h4>
                            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              {sensor.sensor_type === 'humidity' ? '💧 Humidity' : '🌡️ Temperature'}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              sensor.status === 'alert'
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : sensor.status === 'warning'
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                : sensor.status === 'ok'
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {sensor.status}
                          </span>
                        </div>
                        
                        <div className={`text-2xl font-bold mb-2 ${statusStyles.value}`}>
                          {sensor.status === 'offline' || sensor.status === 'unknown'
                            ? 'N/A'
                            : sensor.temp != null
                            ? (sensor.sensor_type === 'humidity'
                              ? `${sensor.temp.toFixed(1)}%`
                              : `${convertForDisplay(sensor.temp, userTempScale).toFixed(1)}°${userTempScale}`)
                            : '—'}
                        </div>
                        
                        <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {sensor.lastFetchedTime ? toLocalFromReading({ last_fetched_time: sensor.lastFetchedTime }, userTimeZone) : 'No data'}
                        </div>
                        
                        {(sensor.status === 'offline' || sensor.status === 'unknown') && (
                          <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
                            darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {getUnconfiguredReason(sensor)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-4 mt-8">
                <button
                  onClick={() => setShowAddAlert(false)}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                    darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

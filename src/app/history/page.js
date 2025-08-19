'use client';

import { useState, useRef, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized successfully');
} catch (err) {
  console.error('Failed to initialize Supabase client:', err);
}

// Error Boundary
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className={`p-4 ${this.props.darkMode ? 'text-red-400' : 'text-red-500'}`}>
          Error: {this.state.error?.message || 'Something went wrong'}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function History() {
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1D');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [temperatureData, setTemperatureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const router = useRouter();
  const { darkMode } = useDarkMode();

  // Time range mapping to hours
  const timeRangeToHours = {
    '6H': 6,
    '12H': 12,
    '1D': 24,
    '1M': 24 * 30,
    '3M': 24 * 90,
  };

  // Fallback data
  const fallbackData = [
    { x: 0, y: 32, time: '2025-08-18', timeDetail: '12:00 AM' },
    { x: 1, y: 33, time: '2025-08-18', timeDetail: '1:00 AM' },
    { x: 2, y: 35, time: '2025-08-18', timeDetail: '2:00 AM' },
    { x: 3, y: 37, time: '2025-08-18', timeDetail: '3:00 AM' },
    { x: 4, y: 36, time: '2025-08-18', timeDetail: '4:00 AM' },
    { x: 5, y: 35, time: '2025-08-18', timeDetail: '5:00 AM' },
    { x: 6, y: 34, time: '2025-08-18', timeDetail: '6:00 AM' },
    { x: 7, y: 33, time: '2025-08-18', timeDetail: '7:00 AM' },
    { x: 8, y: 31, time: '2025-08-18', timeDetail: '8:00 AM' },
    { x: 9, y: 33, time: '2025-08-18', timeDetail: '9:00 AM' },
    { x: 10, y: 35, time: '2025-08-18', timeDetail: '10:00 AM' },
    { x: 11, y: 38, time: '2025-08-18', timeDetail: '11:00 AM' },
  ];

  // Check session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!sessionData.session) {
          console.log('No session found, redirecting to login');
          router.push('/login');
        }
      } catch (err) {
        setError('Failed to verify session: ' + err.message);
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  // Load sensors and initial data
  useEffect(() => {
    if (!supabase) {
      setError('Supabase client not initialized');
      setSensors(['Walk-In Fridge', 'Freezer 1', 'Drive Thru Fridge']);
      setSelectedSensor('Walk-In Fridge');
      setTemperatureData(fallbackData);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // Fetch sensors
        const { data: sensorRows, error: sErr } = await supabase
          .from('sensors')
          .select('sensor_id, label')
          .order('label', { ascending: true });

        if (sErr) {
          console.error('Failed to load sensors:', sErr);
          throw new Error('Failed to load sensors: ' + sErr.message);
        }

        const validSensors = sensorRows
          .filter(sensor => sensor.sensor_id && sensor.label)
          .map(sensor => ({
            sensor_id: sensor.sensor_id,
            label: sensor.label,
          }));

        if (validSensors.length === 0) {
          throw new Error('No valid sensors found');
        }

        setSensors(validSensors);
        setSelectedSensor(validSensors[0]?.label || 'Walk-In Fridge');

        // Load initial history for the first sensor
        await loadHistory(validSensors[0]?.sensor_id, timeRangeToHours[selectedTimeRange]);

      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load data: ' + err.message);
        setSensors(['Walk-In Fridge', 'Freezer 1', 'Drive Thru Fridge']);
        setSelectedSensor('Walk-In Fridge');
        setTemperatureData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Load history for selected sensor and time range
  const loadHistory = async (sensorId, hours) => {
    if (!supabase || !sensorId) return;

    try {
      const now = new Date();
      const from = new Date(now.getTime() - hours * 60 * 60 * 1000);
      const { data, error } = await supabase
        .from('raw_readings')
        .select('value, ts')
        .eq('source_id', sensorId)
        .eq('metric', 'temperature')
        .gte('ts', from.toISOString())
        .order('ts', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Load history error:', error);
        throw new Error('Failed to load history: ' + error.message);
      }

      const formattedData = data.map((d, i) => ({
        x: i,
        y: Number(d.value),
        time: new Date(d.ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        timeDetail: new Date(d.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }));

      setTemperatureData(formattedData.length > 0 ? formattedData : fallbackData);
    } catch (err) {
      console.error('History load error:', err);
      setError('Failed to load history: ' + err.message);
      setTemperatureData(fallbackData);
    }
  };

  // Update history when sensor or time range changes
  useEffect(() => {
    if (!selectedSensor || loading) return;
    const sensor = sensors.find(s => s.label === selectedSensor);
    if (sensor) {
      loadHistory(sensor.sensor_id, timeRangeToHours[selectedTimeRange]);
    }
  }, [selectedSensor, selectedTimeRange, sensors, loading]);

  // Realtime updates
  useEffect(() => {
    if (!supabase || loading) return;

    const onChange = (payload) => {
      const r = payload.new || {};
      if (!r.source_id || r.metric !== 'temperature' || typeof r.value !== 'number') return;

      const sensor = sensors.find(s => s.sensor_id === r.source_id);
      if (!sensor || sensor.label !== selectedSensor) return;

      setTemperatureData(prev => {
        const newData = [
          ...prev,
          {
            x: prev.length,
            y: Number(r.value),
            time: new Date(r.ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            timeDetail: new Date(r.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          },
        ].slice(-100); // Keep last 100 points
        return newData;
      });
    };

    const ch = supabase
      .channel('raw-readings-history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raw_readings' }, onChange)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [selectedSensor, sensors, loading]);

  // Chart interaction
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let closestPoint = null;
        let minDistance = Infinity;

        temperatureData.forEach((point, i) => {
          const pointX = (i / (temperatureData.length - 1)) * (rect.width - 40);
          const pointY = 300 - ((point.y - 10) / 50) * 300;
          const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2));

          if (distance < 25 && distance < minDistance) {
            minDistance = distance;
            closestPoint = { ...point, index: i };
          }
        });

        setHoveredPoint(closestPoint);
      }
    };

    const handleMouseLeave = () => setHoveredPoint(null);

    const chartElement = chartRef.current;
    if (chartElement) {
      chartElement.addEventListener('mousemove', handleMouseMove);
      chartElement.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (chartElement) {
        chartElement.removeEventListener('mousemove', handleMouseMove);
        chartElement.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [temperatureData]);

  const getLinePath = () => {
    if (!temperatureData.length) return '';
    const height = 300;
    const width = 100;
    return temperatureData
      .map((point, i) => {
        const x = (i / (temperatureData.length - 1)) * width;
        const y = height - ((point.y - 10) / 50) * height;
        return `${x},${y}`;
      })
      .join(' L ');
  };

  const getAreaPath = () => {
    if (!temperatureData.length) return '';
    const height = 300;
    const width = 100;
    const points = temperatureData.map((point, i) => {
      const x = (i / (temperatureData.length - 1)) * width;
      const y = height - ((point.y - 10) / 50) * height;
      return `${x},${y}`;
    });
    const firstPoint = points[0].split(',');
    const lastPoint = points[points.length - 1].split(',');
    return `M ${firstPoint[0]},${height} L ${points.join(' L ')} L ${lastPoint[0]},${height} Z`;
  };

  // Loading state
  if (loading) {
    return (
      <ErrorBoundary darkMode={darkMode}>
        <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
          <Sidebar activeKey="history" darkMode={darkMode} />
          <main className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p>Loading history data...</p>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar activeKey="history" darkMode={darkMode} />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">History</h2>
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

          <div className={`rounded-lg shadow p-6 border-2 ${darkMode ? 'bg-gray-800 border-blue-700' : 'bg-white border-blue-300'}`}>
            <div className="mb-6">
              <h3 className="text-xl font-semibold">Temperature History</h3>
              <p className={`text-sm ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                {selectedSensor || 'No sensor selected'}
              </p>
            </div>
            <div className="flex justify-end items-center space-x-2 mb-6">
              <select
                value={selectedSensor || ''}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className={`border rounded px-2 py-1 ${darkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
              >
                {sensors.length === 0 && <option value="">No sensors available</option>}
                {sensors.map((sensor) => (
                  <option key={sensor.sensor_id} value={sensor.label}>
                    {sensor.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className={`border rounded px-2 py-1 ${darkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
              >
                {['6H', '12H', '1D', '1M', '3M'].map((range) => (
                  <option key={range} value={range}>
                    {range}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex">
                <div className="flex flex-col items-end pr-4 mr-4">
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} transform -rotate-90 origin-bottom-left absolute top-1/2 -translate-y-1/2 -left-8 w-64 text-center font-medium`}>
                    Temperature (Fahrenheit)
                  </div>
                  <div className="flex flex-col justify-between h-80 text-sm text-gray-500">
                    {[60, 50, 40, 30, 20, 10].map((val) => (
                      <div key={val} className="flex items-center">
                        <span className={`leading-none mr-3 w-6 text-right ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {val}
                        </span>
                        <div className={`w-2 border-t ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 relative" ref={chartRef}>
                  <div className="h-80 relative">
                    <svg width="100%" height="300" viewBox="0 0 100 300" preserveAspectRatio="none" className={`border-b border-l ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                      {[10, 20, 30, 40, 50, 60].map((val) => (
                        <line
                          key={val}
                          x1="0"
                          y1={300 - ((val - 10) / 50) * 300}
                          x2="100"
                          y2={300 - ((val - 10) / 50) * 300}
                          stroke={darkMode ? '#4b5563' : '#e5e7eb'}
                          strokeWidth="0.2"
                          strokeDasharray="1,1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      <path
                        d={getAreaPath()}
                        fill={darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}
                        stroke="none"
                      />
                      <path
                        d={getLinePath()}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                      {temperatureData.map((point, i) => (
                        <circle
                          key={i}
                          cx={(i / (temperatureData.length - 1)) * 100}
                          cy={300 - ((point.y - 10) / 50) * 300}
                          r="1.5"
                          fill="#22c55e"
                          stroke={darkMode ? '#374151' : 'white'}
                          strokeWidth="0.5"
                          vectorEffect="non-scaling-stroke"
                          className="cursor-pointer hover:r-3 transition-all"
                        />
                      ))}
                    </svg>
                    {hoveredPoint && (
                      <div
                        className="absolute pointer-events-none z-10"
                        style={{
                          left: `${(hoveredPoint.index / (temperatureData.length - 1)) * 100}%`,
                          top: `${300 - ((hoveredPoint.y - 10) / 50) * 300 - 90}px`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <div className={`${darkMode ? 'bg-green-600' : 'bg-green-500'} text-white p-3 rounded-lg shadow-lg border-2 ${darkMode ? 'border-gray-600' : 'border-white'} text-center min-w-32`}>
                          <div className="text-xs font-medium">Temperature</div>
                          <div className="text-lg font-bold">{hoveredPoint.y}°F</div>
                          <div className="text-xs">{hoveredPoint.time}</div>
                          <div className="text-xs font-semibold">{hoveredPoint.timeDetail}</div>
                        </div>
                        <div className={`w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${darkMode ? 'border-t-green-600' : 'border-t-green-500'} mx-auto`}></div>
                      </div>
                    )}
                    <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2">
                      {['6H', '12H', '1D', '1M', '3M'].map((label) => (
                        <span key={label} className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} font-medium`}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

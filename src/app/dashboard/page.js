'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

// Supabase configuration
const supabaseUrl = 'https://kwaylmatpkcajsctujor.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M';

// Initialize Supabase client
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized');
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

// Temperature thresholds for different sensor types
const TEMPERATURE_THRESHOLDS = {
  fridge: { min: 35, max: 45, ideal: 40 }, // Fridge should be around 35-45°F
  freezer: { min: -5, max: 5, ideal: 0 }, // Freezer should be around -5 to 5°F
  default: { min: 20, max: 60, ideal: 40 }
};

const computeStatus = (temp, type = 'default') => {
  if (temp == null) return 'Good';
  
  const threshold = TEMPERATURE_THRESHOLDS[type] || TEMPERATURE_THRESHOLDS.default;
  const { min, max } = threshold;
  
  if (temp < min || temp > max) return 'Needs Attention';
  if (temp <= min + 3 || temp >= max - 3) return 'Warning';
  return 'Good';
};

const toF = (val, unit) => (val == null ? null : unit === 'C' ? (val * 9 / 5 + 32) : val);

// Determine sensor type based on name or ID
const getSensorType = (name, sensorId) => {
  const nameStr = (name || sensorId || '').toLowerCase();
  if (nameStr.includes('freezer') || nameStr.includes('freeze') || nameStr === 'temp1') {
    return 'freezer';
  }
  if (nameStr.includes('fridge') || nameStr.includes('refrigerator')) {
    return 'fridge';
  }
  if (nameStr.includes('humidity') || nameStr.includes('humid')) {
    return 'fridge'; // Humidity sensors are usually in fridge
  }
  return 'fridge'; // Default to fridge
};

export default function Dashboard() {
  const [data, setData] = useState({
    notifications: 0,
    sensors: {
      total: 0,
      error: 0,
      warning: 0,
      success: 0,
      disconnected: 0,
    },
    users: 6,
    temperatures: [],
    notificationsList: [],
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [username, setUsername] = useState('User');
  const [error, setError] = useState('');
  const popupRef = useRef(null);
  const notificationCardRef = useRef(null);
  const { darkMode } = useDarkMode();
  const router = useRouter();

  // Fetch user session and set username
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking session...');
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!sessionData.session) {
          console.log('No session found, redirecting to login');
          router.push('/login');
        } else {
          const user = sessionData.session.user;
          const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
          console.log('Session found, user:', displayName);
          setUsername(displayName);
        }
      } catch (err) {
        console.error('Session check error:', err.message);
        setError(
          err.message === 'Failed to fetch'
            ? 'Unable to connect to authentication server. Please check your network or contact support.'
            : 'Failed to verify session: ' + err.message
        );
        router.push('/login');
      }
    };
    checkSession();
  }, [router]);

  // Process temperature data and generate notifications
  const processTemperatureData = (temperatures) => {
    const notificationsList = [];
    let notificationId = 1;

    temperatures.forEach(temp => {
      if (temp.status === 'Needs Attention' || temp.status === 'Warning') {
        notificationsList.push({
          id: notificationId++,
          title: `${temp.status} (${temp.name})`,
          description: `Temperature: ${temp.displayValue} - ${temp.status === 'Needs Attention' ? 'Critical' : 'Warning'} level`,
          date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          type: temp.status === 'Needs Attention' ? 'error' : 'warning',
          sensorId: temp.sensor_id,
          temperature: temp.displayValue
        });
      }
    });

    return notificationsList;
  };

  // Fetch sensors from Supabase
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const { data: sensorRows, error: sErr } = await supabase
          .from('sensors')
          .select('sensor_id, sensor_name, metric, latest_temp, approx_time, last_fetched_time, updated_at');

        if (sErr) throw sErr;

        // Fallback latest from raw_readings_v2
        const ids = (sensorRows || []).map(r => r.sensor_id).filter(Boolean);
        let latestMap = new Map();
        if (ids.length) {
          const { data: latest, error: lErr } = await supabase
            .from('raw_readings_v2')
            .select('sensor_id, reading_value, timestamp, approx_time')
            .in('sensor_id', ids)
            .order('timestamp', { ascending: false });
          if (lErr) throw lErr;
          for (const row of latest) {
            if (!latestMap.has(row.sensor_id)) latestMap.set(row.sensor_id, row);
          }
        }

        const temperatures = (sensorRows || []).map(r => {
          const unit = (r.metric || 'F').toUpperCase() === 'C' ? 'C' : 'F';
          const lr = latestMap.get(r.sensor_id);
          const raw = r.latest_temp ?? (lr ? Number(lr.reading_value) : null);
          const value = raw != null ? toF(raw, unit) : null;
          const name = r.sensor_name || r.sensor_id;
          const type = getSensorType(name, r.sensor_id);
          const status = computeStatus(value, type);
          const color = status === 'Needs Attention' ? 'bg-red-500' : status === 'Warning' ? 'bg-yellow-500' : 'bg-green-500';
          const displayValue = value != null ? `${Math.round(value)}°F` : '--°F';

          return {
            sensor_id: r.sensor_id,
            unit,
            name,
            value,
            displayValue,
            color,
            type,
            status,
            lastUpdated: r.updated_at || lr?.timestamp || new Date().toISOString()
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        // Generate notifications based on sensor status
        const notificationsList = processTemperatureData(temperatures);

        // Calculate sensor stats
        const sensors = {
          total: temperatures.length,
          error: temperatures.filter(t => t.status === 'Needs Attention').length,
          warning: temperatures.filter(t => t.status === 'Warning').length,
          success: temperatures.filter(t => t.status === 'Good').length,
          disconnected: temperatures.filter(t => t.value === null).length,
        };

        setData({
          notifications: notificationsList.length,
          sensors,
          users: 6,
          temperatures,
          notificationsList,
        });
        setNotifications(notificationsList);
        console.log('Sensors fetched successfully:', temperatures);
      } catch (err) {
        console.error('Sensor fetch error:', err.message);
        setError('Failed to fetch sensor data: ' + err.message);
        
        // Enhanced fallback data with realistic values
        const fallbackTemperatures = [
          { 
            sensor_id: '284C4F41000000FF', 
            unit: 'F', 
            name: '284C4F41000000FF', 
            value: 76, 
            displayValue: '76°F', 
            color: 'bg-red-500', 
            type: 'fridge',
            status: 'Needs Attention',
            lastUpdated: new Date().toISOString()
          },
          { 
            sensor_id: 'DHT22_Temp', 
            unit: 'F', 
            name: 'DHT22_Temp', 
            value: 77, 
            displayValue: '77°F', 
            color: 'bg-red-500', 
            type: 'fridge',
            status: 'Needs Attention',
            lastUpdated: new Date().toISOString()
          },
          { 
            sensor_id: 'Humidity_Sensor', 
            unit: 'F', 
            name: 'Humidity Sensor', 
            value: 67, 
            displayValue: '67°F', 
            color: 'bg-red-500', 
            type: 'fridge',
            status: 'Needs Attention',
            lastUpdated: new Date().toISOString()
          },
        ];
        
        const fallbackNotifications = processTemperatureData(fallbackTemperatures);
        
        setData({
          notifications: fallbackNotifications.length,
          sensors: { 
            total: 3, 
            error: fallbackTemperatures.filter(t => t.status === 'Needs Attention').length,
            warning: fallbackTemperatures.filter(t => t.status === 'Warning').length,
            success: fallbackTemperatures.filter(t => t.status === 'Good').length,
            disconnected: 0 
          },
          users: 6,
          temperatures: fallbackTemperatures,
          notificationsList: fallbackNotifications,
        });
        setNotifications(fallbackNotifications);
      }
    };
    fetchSensors();
  }, []);

  // Realtime updates with proper notification handling
  useEffect(() => {
    if (!supabase) return;

    const onInsert = (payload) => {
      const r = payload.new || {};
      if (!r.sensor_id || r.reading_value == null) return;

      setData((prev) => {
        const prevTemps = prev.temperatures;
        const idx = prevTemps.findIndex((p) => p.sensor_id === r.sensor_id);
        if (idx === -1) return prev;

        const unit = prevTemps[idx].unit;
        const value = toF(Number(r.reading_value), unit);
        const type = prevTemps[idx].type;
        const status = computeStatus(value, type);
        const color = status === 'Needs Attention' ? 'bg-red-500' : status === 'Warning' ? 'bg-yellow-500' : 'bg-green-500';
        const displayValue = `${Math.round(value)}°F`;

        const nextTemps = [...prevTemps];
        nextTemps[idx] = { 
          ...nextTemps[idx], 
          value, 
          displayValue, 
          color, 
          status,
          lastUpdated: r.timestamp || new Date().toISOString()
        };

        const newNotif = processTemperatureData(nextTemps);

        const newSensors = {
          total: nextTemps.length,
          error: nextTemps.filter((t) => t.status === 'Needs Attention').length,
          warning: nextTemps.filter((t) => t.status === 'Warning').length,
          success: nextTemps.filter((t) => t.status === 'Good').length,
          disconnected: nextTemps.filter((t) => t.value === null).length,
        };

        setNotifications(newNotif);

        return {
          ...prev,
          temperatures: nextTemps,
          notifications: newNotif.length,
          sensors: newSensors,
          notificationsList: newNotif,
        };
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
  }, []);

  // Handle click outside to close notifications
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        notificationCardRef.current &&
        !notificationCardRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle sign-out
  const handleSignOut = async () => {
    try {
      console.log('Attempting sign-out...');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      console.log('Sign-out successful');
      router.push('/login');
    } catch (err) {
      console.error('Sign-out error:', err.message);
      setError('Failed to sign out: ' + err.message);
    }
  };

  // Close individual notification
  const closeNotification = (id) => {
    const updatedNotifications = notifications.filter((notification) => notification.id !== id);
    setNotifications(updatedNotifications);
    setData(prev => ({ 
      ...prev, 
      notifications: updatedNotifications.length,
      notificationsList: updatedNotifications
    }));
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
    setData(prev => ({ 
      ...prev, 
      notifications: 0,
      notificationsList: []
    }));
  };

  // Calculate bar height for temperature graph with proper scaling (0-100°F)
  const getBarHeight = (temp) => {
    const actualChartHeight = 320; // Increased height for better precision
    if (temp.value === null) {
      return 0;
    }
    
    // Universal scale 0-100°F for all sensors
    const minTemp = 0;
    const maxTemp = 100;
    const range = maxTemp - minTemp;
    const normalizedValue = Math.max(minTemp, Math.min(temp.value, maxTemp));
    return ((normalizedValue - minTemp) / range) * actualChartHeight;
  };

  // Get initials for avatar
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Hi {username}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSignOut}
              className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ${
                darkMode ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              Log out
            </button>
            <div
              className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold ${
                darkMode ? 'bg-amber-700' : ''
              }`}
            >
              {getInitials(username)}
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div
            className={`rounded-lg p-6 shadow text-center relative ${
              darkMode ? 'bg-gray-800 text-white' : 'bg-white'
            }`}
          >
            <div
              className="cursor-pointer"
              onClick={() => setShowNotifications(!showNotifications)}
              ref={notificationCardRef}
            >
              <div
                className={`flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto ${
                  darkMode ? 'bg-green-900' : ''
                }`}
              >
                <span className="text-2xl">🔔</span>
              </div>
              <p className={`text-gray-600 text-sm mb-1 ${darkMode ? 'text-gray-300' : ''}`}>Notifications</p>
              <p className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? 'text-white' : ''}`}>
                {data.notifications}
              </p>
              <div className="flex items-center justify-center">
                <div className={`w-2 h-2 bg-red-500 rounded-full mr-2 ${darkMode ? 'bg-red-400' : ''}`}></div>
                <span className={`text-red-500 text-sm ${darkMode ? 'text-red-400' : ''}`}>
                  {data.notifications > 0 ? 'Unread' : 'All Clear'}
                </span>
              </div>
            </div>
            {showNotifications && (
              <div
                ref={popupRef}
                className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white rounded-lg shadow-lg z-20 border border-gray-200 ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''
                }`}
              >
                <div className="p-4">
                  <h4 className={`font-semibold text-gray-800 mb-3 ${darkMode ? 'text-white' : ''}`}>
                    Notifications
                  </h4>
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex items-start justify-between p-3 mb-2 bg-gray-50 rounded-md ${
                          darkMode ? 'bg-gray-700 text-white' : ''
                        } ${notification.type === 'error' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-500'}`}
                      >
                        <div className="flex-1">
                          <p className={`text-gray-700 text-sm font-medium ${darkMode ? 'text-white' : ''}`}>
                            {notification.title}
                          </p>
                          {notification.description && (
                            <p className={`text-gray-600 text-xs ${darkMode ? 'text-gray-300' : ''}`}>
                              {notification.description}
                            </p>
                          )}
                          <p className={`text-gray-500 text-xs ${darkMode ? 'text-gray-400' : ''}`}>
                            {notification.date}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeNotification(notification.id);
                          }}
                          className={`text-gray-400 hover:text-gray-600 ml-3 ${
                            darkMode ? 'text-gray-300 hover:text-gray-200' : ''
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className={`text-gray-500 text-sm text-center ${darkMode ? 'text-gray-300' : ''}`}>
                      No new notifications.
                    </p>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllNotifications();
                      }}
                      className={`mt-4 w-full bg-blue-500 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-600 ${
                        darkMode ? 'bg-blue-600 hover:bg-blue-700' : ''
                      }`}
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className={`rounded-lg p-6 shadow text-center ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div
              className={`flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto ${
                darkMode ? 'bg-green-900' : ''
              }`}
            >
              <span className="text-2xl">📶</span>
            </div>
            <p className={`text-gray-600 text-sm mb-1 ${darkMode ? 'text-gray-300' : ''}`}>Sensors</p>
            <p className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? 'text-white' : ''}`}>
              {data.sensors.total}
            </p>
            <div className="flex items-center justify-center space-x-3 text-sm">
              <div className="flex items-center">
                <div className={`w-2 h-2 bg-red-500 rounded-full mr-1 ${darkMode ? 'bg-red-400' : ''}`}></div>
                <span className={`text-red-500 font-medium ${darkMode ? 'text-red-400' : ''}`}>
                  {data.sensors.error}
                </span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 bg-yellow-500 rounded-full mr-1 ${darkMode ? 'bg-yellow-400' : ''}`}></div>
                <span className={`text-yellow-500 font-medium ${darkMode ? 'text-yellow-400' : ''}`}>
                  {data.sensors.warning}
                </span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 bg-green-500 rounded-full mr-1 ${darkMode ? 'bg-green-400' : ''}`}></div>
                <span className={`text-green-500 font-medium ${darkMode ? 'text-green-400' : ''}`}>
                  {data.sensors.success}
                </span>
              </div>
              <div className="flex items-center">
                <span className={`mr-1 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>✖</span>
                <span className={`text-gray-500 font-medium ${darkMode ? 'text-gray-300' : ''}`}>
                  {data.sensors.disconnected}
                </span>
              </div>
            </div>
          </div>
          
          <div className={`rounded-lg p-6 shadow text-center ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
            <div
              className={`flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto ${
                darkMode ? 'bg-green-900' : ''
              }`}
            >
              <span className="text-2xl">👥</span>
            </div>
            <p className={`text-gray-600 text-sm mb-1 ${darkMode ? 'text-gray-300' : ''}`}>Users</p>
            <p className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? 'text-white' : ''}`}>
              {data.users}
            </p>
            <div className="flex justify-center -space-x-1">
              <div
                className={`w-6 h-6 bg-orange-500 rounded-full border-2 border-white ${darkMode ? 'border-gray-700' : ''}`}
              ></div>
              <div
                className={`w-6 h-6 bg-blue-500 rounded-full border-2 border-white ${darkMode ? 'border-gray-700' : ''}`}
              ></div>
              <div
                className={`w-6 h-6 bg-green-500 rounded-full border-2 border-white ${darkMode ? 'border-gray-700' : ''}`}
              ></div>
              <div
                className={`w-6 h-6 bg-purple-500 rounded-full border-2 border-white ${darkMode ? 'border-gray-700' : ''}`}
              ></div>
              <div
                className={`w-6 h-6 bg-pink-500 rounded-full border-2 border-white ${darkMode ? 'border-gray-700' : ''}`}
              ></div>
              <div
                className={`w-6 h-6 bg-red-500 rounded-full border-2 border-white ${darkMode ? 'border-gray-700' : ''}`}
              ></div>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold text-gray-900 ${darkMode ? 'text-white' : ''}`}>
              Temperature Monitoring System
            </h3>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
          <div className="relative">
            <div className="flex items-start">
              {/* Left Y-axis for Temperature Scale (0-100°F) */}
              <div className="flex flex-col w-16 mr-3">
                <div className="h-6"></div> {/* Spacer for title */}
                <div className="relative h-80">
                  <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-600 items-end pr-3 font-medium">
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">100°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">90°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">80°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">70°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">60°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">50°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">40°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">30°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">20°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">10°F</span>
                    <span className="transform -translate-y-1/2 bg-white px-1 rounded">0°F</span>
                  </div>
                </div>
              </div>

              {/* Main chart area */}
              <div className="flex-1 relative">
                <div className="absolute -top-6 left-0 right-0 flex justify-between z-10">
                  <span className={`text-green-600 font-semibold text-sm ${darkMode ? 'text-green-400' : ''}`}>
                    🌡️ Temperature Monitoring (0-100°F Scale)
                  </span>
                  <div className="text-xs text-gray-500">
                    Ideal: Fridge 35-45°F | Freezer -5 to 5°F
                  </div>
                </div>

                {/* Enhanced Grid lines */}
                <div className="absolute inset-0 h-80">
                  <div className="h-full flex flex-col justify-between">
                    {[...Array(11)].map((_, i) => (
                      <div key={i} className={`border-t w-full ${
                        i === 0 || i === 10 ? 'border-gray-400 border-t-2' : 
                        i === 5 ? 'border-gray-300 border-t-2' : 
                        'border-gray-200'
                      } ${darkMode ? 'border-gray-600' : ''}`}></div>
                    ))}
                  </div>
                  <div className="absolute inset-0">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gray-400 ${darkMode ? 'bg-gray-500' : ''}`}></div>
                    <div className={`absolute right-0 top-0 bottom-0 w-1 bg-gray-400 ${darkMode ? 'bg-gray-500' : ''}`}></div>
                  </div>
                </div>
                
                {/* Temperature ideal range indicators */}
                <div className="absolute inset-0 h-80 pointer-events-none">
                  {/* Fridge ideal range (35-45°F) */}
                  <div 
                    className="absolute left-0 bg-green-100 bg-opacity-50 border-t-2 border-b-2 border-green-500"
                    style={{
                      bottom: `${(35/100) * 320}px`,
                      height: `${((45-35)/100) * 320}px`,
                      width: '100%',
                      borderStyle: 'dashed'
                    }}
                  >
                    <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-green-700 bg-green-200 px-2 py-1 rounded">
                      Fridge Ideal Zone
                    </div>
                  </div>
                  
                  {/* Critical temperature zones */}
                  <div 
                    className="absolute left-0 bg-red-100 bg-opacity-30 border-t border-red-400"
                    style={{
                      bottom: `${(80/100) * 320}px`,
                      height: `${((100-80)/100) * 320}px`,
                      width: '100%'
                    }}
                  >
                    <div className="absolute left-2 top-2 text-xs font-bold text-red-700 bg-red-200 px-2 py-1 rounded">
                      Danger Zone
                    </div>
                  </div>
                </div>

                {/* Temperature bars with enhanced styling */}
                <div className="relative h-80">
                  <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end h-full px-6">
                    {data.temperatures.map((temp, i) => {
                      const barHeight = getBarHeight(temp);
                      return (
                        <div key={i} className="flex flex-col items-center relative group" style={{ flexBasis: '30%', maxWidth: '100px' }}>
                          {/* Temperature value label */}
                          {temp.value !== null && (
                            <div
                              className={`absolute text-sm font-bold px-3 py-2 rounded-lg shadow-lg z-20 transition-all duration-300 group-hover:scale-110 ${
                                temp.status === 'Needs Attention' 
                                  ? 'bg-red-500 text-white border-2 border-red-600 animate-bounce' 
                                  : temp.status === 'Warning'
                                  ? 'bg-yellow-500 text-white border-2 border-yellow-600'
                                  : 'bg-green-500 text-white border-2 border-green-600'
                              }`}
                              style={{
                                bottom: `${barHeight + 12}px`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                              }}
                            >
                              {temp.displayValue}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-current"></div>
                            </div>
                          )}
                          
                          {/* Temperature bar */}
                          {temp.value !== null && (
                            <div
                              className={`relative w-16 rounded-t-lg shadow-xl transition-all duration-500 group-hover:w-20 ${temp.color} ${
                                temp.status === 'Needs Attention' ? 'animate-pulse' : ''
                              }`}
                              style={{ 
                                height: `${Math.max(barHeight, 8)}px`,
                                background: temp.status === 'Needs Attention' 
                                  ? 'linear-gradient(to top, #dc2626, #ef4444)' 
                                  : temp.status === 'Warning'
                                  ? 'linear-gradient(to top, #d97706, #f59e0b)'
                                  : 'linear-gradient(to top, #059669, #10b981)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                              }}
                              title={`${temp.name}: ${temp.displayValue} (${temp.status})`}
                            >
                              {/* Bar pattern for visual appeal */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 rounded-t-lg"></div>
                            </div>
                          )}
                          
                          {/* No data indicator */}
                          {temp.value === null && (
                            <div
                              className="bg-gray-400 w-16 rounded-t-lg opacity-50"
                              style={{ height: '8px' }}
                              title={`${temp.name}: No data available`}
                            >
                              <div className="text-xs text-center text-gray-600 mt-1">No Data</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enhanced sensor labels */}
                <div className={`flex justify-around mt-4 pt-3 px-6 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {data.temperatures.map((temp, i) => (
                    <div key={i} className="text-center group cursor-pointer" style={{ flexBasis: '30%', maxWidth: '100px' }}>
                      <p className="text-sm font-bold truncate group-hover:text-blue-600 transition-colors">{temp.name}</p>
                      <p className={`text-xs font-semibold px-2 py-1 rounded-full mt-1 ${
                        temp.status === 'Needs Attention' ? 'bg-red-100 text-red-700' :
                        temp.status === 'Warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {temp.status}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{temp.type} sensor</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right side reference */}
              <div className="flex flex-col w-16 ml-3">
                <div className="h-6"></div>
                <div className="relative h-80">
                  <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-500 items-start pl-3">
                    <span className="bg-red-100 px-1 rounded text-red-700">Critical</span>
                    <span className="bg-yellow-100 px-1 rounded text-yellow-700">Hot</span>
                    <span className="bg-orange-100 px-1 rounded text-orange-700">Warm</span>
                    <span className="bg-blue-100 px-1 rounded text-blue-700">Room</span>
                    <span className="bg-green-100 px-1 rounded text-green-700">Cool</span>
                    <span className="bg-green-200 px-1 rounded text-green-800">Ideal</span>
                    <span className="bg-cyan-100 px-1 rounded text-cyan-700">Cold</span>
                    <span className="bg-blue-200 px-1 rounded text-blue-800">Very Cold</span>
                    <span className="bg-purple-100 px-1 rounded text-purple-700">Freezing</span>
                    <span className="bg-indigo-100 px-1 rounded text-indigo-700">Ice</span>
                    <span className="bg-gray-100 px-1 rounded text-gray-700">Frozen</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              <span className={`text-sm text-gray-600 font-medium ${darkMode ? 'text-gray-300' : ''}`}>Sensors</span>
            </div>
            
            {/* Temperature status legend */}
            <div className="flex justify-center mt-4 space-x-6 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span>Normal (Good)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                <span>Warning</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span>Critical (Needs Attention)</span>
              </div>
            </div>

            {/* Sensor details table */}
            <div className="mt-6">
              <h4 className={`text-md font-semibold mb-3 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Sensor Details
              </h4>
              <div className="overflow-x-auto">
                <table className={`w-full text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <thead>
                    <tr className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th className="text-left py-2">Sensor</th>
                      <th className="text-left py-2">Temperature</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.temperatures.map((temp, i) => (
                      <tr key={i} className={`border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                        <td className="py-2 font-medium">{temp.name}</td>
                        <td className="py-2">
                          <span className={`font-bold ${
                            temp.status === 'Needs Attention' ? 'text-red-500' :
                            temp.status === 'Warning' ? 'text-yellow-500' : 'text-green-500'
                          }`}>
                            {temp.displayValue}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            temp.status === 'Needs Attention' 
                              ? 'bg-red-100 text-red-800' 
                              : temp.status === 'Warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          } ${darkMode ? 'bg-gray-700 text-white' : ''}`}>
                            {temp.status}
                          </span>
                        </td>
                        <td className="py-2 capitalize">{temp.type}</td>
                        <td className="py-2">
                          {temp.lastUpdated ? new Date(temp.lastUpdated).toLocaleTimeString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <footer className={`text-center mt-8 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          © 2025 Safe Sense. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
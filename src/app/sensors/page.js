'use client';

import { useState, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
import { Bluetooth, ChevronDown, Edit, Trash, AlertTriangle, X } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';
import apiClient from '../lib/apiClient';


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

export default function Sensors() {
  const [sensors, setSensors] = useState([]);
  const [currentView, setCurrentView] = useState('list');
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [step, setStep] = useState(1);
  const [sensorName, setSensorName] = useState('');
  const [sensorType, setSensorType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('Newest');
  const [selectedSensorType, setSelectedSensorType] = useState('All');
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [username, setUsername] = useState('User');
  const [error, setError] = useState('');
  const router = useRouter();
  const { darkMode } = useDarkMode();

  // Fetch user session and set username
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking session...');
        const token = localStorage.getItem('auth-token');
        if (!token) {
          console.log('No token found, redirecting to login');
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
          console.log('Invalid token, redirecting to login');
          router.push('/login');
          return;
        }

        const { user } = await response.json();
        const displayName = user?.email?.split('@')[0] || 'User';
        console.log('Session found, user:', displayName);
        setUsername(displayName);
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

  // Fetch sensors from Supabase
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const sensorData = await apiClient.getSensors();
        console.log('Raw sensor data from Supabase:', sensorData); // Debug log
        if (sensorData && sensorData.length > 0) {
          const formattedSensors = sensorData.map(sensor => ({
            id: sensor.sensor_id, // Use sensor_id as the primary key
            name: sensor.sensor_name,
            sensor_type: sensor.sensor_type.charAt(0).toUpperCase() + sensor.sensor_type.slice(1).toLowerCase(), // Normalize to title case
            date: sensor.updated_at || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            status: sensor.status || 'Active',
          }));
          console.log('Formatted sensors:', formattedSensors); // Debug log
          setSensors(formattedSensors);
          setCurrentView('list');
        } else {
          setSensors([]);
          setCurrentView('empty');
        }
      } catch (err) {
        console.error('Sensor fetch error:', err.message);
        setError('Failed to fetch sensor data: ' + err.message);
        setSensors([]);
        setCurrentView('empty');
      }
    };
    fetchSensors();
  }, []);

  // Handle sign-out (remove token)
  const handleSignOut = async () => {
    try {
      localStorage.removeItem('auth-token');
      router.push('/login');
    } catch (err) {
      setError('Failed to sign out: ' + err.message);
    }
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

  // Handle edit sensor
  const handleEditSensor = (sensor) => {
    setSelectedSensor(sensor);
    setSensorName(sensor.name);
    setSensorType(sensor.sensor_type);
    setCurrentView('edit');
    setError('');
  };

  // Handle save edited sensor
  const handleSaveEditSensor = async () => {
    if (sensorName && sensorType && selectedSensor) {
      try {
        await apiClient.updateAlertThresholds(selectedSensor.id, {
          sensor_name: sensorName,
          sensor_type: sensorType,
        });

        setSensors(
          sensors.map(sensor =>
            sensor.id === selectedSensor.id
              ? {
                  ...sensor,
                  name: sensorName,
                  sensor_type: sensorType,
                }
              : sensor
          )
        );
        setSensorName('');
        setSensorType('');
        setSelectedSensor(null);
        setCurrentView('list');
        console.log('Sensor updated successfully:', selectedSensor.id);
      } catch (err) {
        console.error('Sensor update error:', err.message);
        setError('Failed to update sensor: ' + err.message);
      }
    } else {
      setError('Sensor name and type are required.');
    }
  };

  // Handle delete sensor
  const handleDeleteSensor = async (sensorId) => {
    if (window.confirm('Are you sure you want to delete this sensor?')) {
      try {
        await apiClient.updateAlertThresholds(sensorId, { deleted: true }); // or implement a delete route later

        setSensors(sensors.filter(sensor => sensor.id !== sensorId));
        console.log('Sensor deleted successfully:', sensorId);
        if (sensors.length === 1) {
          setCurrentView('empty');
        }
      } catch (err) {
        console.error('Sensor delete error:', err.message);
        setError('Failed to delete sensor: ' + err.message);
      }
    }
  };

  const handleAddSensor = () => {
    setCurrentView('connect');
    setStep(1);
    setConnectedDevice(null);
    setDeviceId(null);
    setSensorName('');
    setSensorType('');
    setError('');
  };

  const handleNextStep = () => {
    if (currentView === 'connect') {
      setCurrentView('settings');
      setStep(2);
    }
  };

  const handleFinishAddSensor = async () => {
    if (sensorName && sensorType) {
      try {
        const newSensor = {
          sensor_name: sensorName,
          sensor_type: sensorType,
          status: 'Active',
        };
        const insertedSensor = await apiClient.updateAlertThresholds('new', newSensor); // placeholder, implement create route later

        setSensors([...sensors, {
          id: insertedSensor[0].sensor_id,
          name: sensorName,
          sensor_type: sensorType,
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          status: 'Active',
        }]);
        setSensorName('');
        setSensorType('');
        setConnectedDevice(null);
        setDeviceId(null);
        setCurrentView('success');
        setStep(3);
        console.log('Sensor added successfully:', insertedSensor[0].sensor_id);
      } catch (err) {
        console.error('Sensor add error:', err.message);
        setError('Failed to add sensor: ' + err.message);
      }
    } else {
      setError('Sensor name and type are required.');
    }
  };

  const handleDone = () => {
    setCurrentView('list');
    setStep(1);
    setSelectedSensor(null);
    setError('');
  };

  const handleSensorClick = (sensor) => {
    setSelectedSensor(sensor);
    setCurrentView('details');
    setError('');
  };

  const sensorsPerPage = 8;
  const filteredSensors = selectedSensorType === 'All'
    ? sensors
    : sensors.filter(sensor => sensor.sensor_type.toLowerCase() === selectedSensorType.toLowerCase());
  const totalPages = Math.ceil(filteredSensors.length / sensorsPerPage);
  const startIndex = (currentPage - 1) * sensorsPerPage;
  const endIndex = startIndex + sensorsPerPage;
  const currentSensors = filteredSensors.slice(startIndex, endIndex);

  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className={`rounded-lg shadow-lg p-16 text-center max-w-lg ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
        <div className="mb-8">
          <div className={`w-20 h-20 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <AlertTriangle className={`w-10 h-10 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
          </div>
          <p className={`text-lg mb-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No sensors right now.<br />Please add a sensor.</p>
        </div>
        <button
          onClick={handleAddSensor}
          className={`px-8 py-3 rounded-lg font-medium text-white border ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
        >
          Add Sensor
        </button>
      </div>
    </div>
  );

  const connectToBluetoothDevice = async () => {
    try {
      if (connectedDevice && deviceId) {
        console.log('Already connected to:', connectedDevice);
        return;
      }
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'SafeSense' }],
        optionalServices: ['battery_service'],
      });
      console.log('Connected to device:', device.name);
      setConnectedDevice(device.name);
      setDeviceId(device.id);
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      if (error.message.includes('User cancelled')) {
        setConnectedDevice(null);
        setDeviceId(null);
      } else {
        setError(`Bluetooth connection failed: ${error.message}. Ensure your SafeSense sensor is discoverable.`);
      }
    }
  };

  const disconnectDevice = () => {
    setConnectedDevice(null);
    setDeviceId(null);
    console.log('Disconnected from device');
  };

  const renderSensorsList = () => {
    console.log('Filtered sensors:', filteredSensors); // Debug log
    return (
      <div className="space-y-6">
        <div className={`rounded-lg shadow-sm overflow-hidden ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold">Sensors</h3>
                <p className={`cursor-pointer text-sm font-medium ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>Paired Sensors</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <select
                    value={selectedSensorType}
                    onChange={(e) => {
                      setSelectedSensorType(e.target.value);
                      setCurrentPage(1); // Reset to first page when filter changes
                    }}
                    className={`border rounded-lg px-4 py-2 text-sm appearance-none pr-8 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}`}
                  >
                    <option value="All">All Sensors</option>
                    <option value="Temperature">Temperature</option>
                    <option value="Humidity">Humidity</option>
                  </select>
                  <ChevronDown className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'} pointer-events-none`} />
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Sort by:</span>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`border rounded-lg px-4 py-2 text-sm appearance-none pr-8 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-800'}`}
                    >
                      <option>Newest</option>
                      <option>Oldest</option>
                      <option>Name</option>
                    </select>
                    <ChevronDown className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-400'} pointer-events-none`} />
                  </div>
                </div>
              </div>
            </div>

            {filteredSensors.length === 0 && selectedSensorType !== 'All' ? (
              <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                No {selectedSensorType} sensors found. Please check your database or add a new sensor.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`}>
                    <th className="pb-3 font-medium text-sm text-left">Sensor Name</th>
                    <th className="pb-3 font-medium text-sm text-left">Type</th>
                    <th className="pb-3 font-medium text-sm text-left">Tools</th>
                    <th className="pb-3 font-medium text-sm text-left">Date</th>
                    <th className="pb-3 font-medium text-sm text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSensors.map((sensor) => (
                    <tr key={sensor.id} className={`border-b ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'}`}>
                      <td className="py-4">
                        <button
                          className={`font-medium text-sm ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-700'}`}
                          onClick={() => handleSensorClick(sensor)}
                        >
                          {sensor.name}
                        </button>
                      </td>
                      <td className={`py-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>{sensor.sensor_type}</td>
                      <td className="py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEditSensor(sensor)}
                            className={`${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-700'}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSensor(sensor.id)}
                            className={`${darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-700'}`}
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className={`py-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>{sensor.date}</td>
                      <td className="py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            sensor.status === 'Active'
                              ? darkMode
                                ? 'bg-green-900 text-green-300'
                                : 'bg-green-100 text-green-800'
                              : darkMode
                              ? 'bg-red-900 text-red-300'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {sensor.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className={`flex justify-between items-center mt-6 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <span>Showing Sensors 1 to {Math.min(endIndex, filteredSensors.length)} of {filteredSensors.length}</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={`px-3 py-1 border rounded ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                  disabled={currentPage === 1}
                >
                  &lt;
                </button>
                <button
                  onClick={() => setCurrentPage(1)}
                  className={`px-3 py-1 border rounded ${
                    currentPage === 1
                      ? `${darkMode ? 'bg-orange-700 text-white border-orange-700' : 'bg-orange-500 text-white border-orange-500'}`
                      : `${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`
                  }`}
                >
                  1
                </button>
                {totalPages > 1 && (
                  <button
                    onClick={() => setCurrentPage(2)}
                    className={`px-3 py-1 border rounded ${
                      currentPage === 2
                        ? `${darkMode ? 'bg-orange-700 text-white border-orange-700' : 'bg-orange-500 text-white border-orange-500'}`
                        : `${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`
                    }`}
                  >
                    2
                  </button>
                )}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={`px-3 py-1 border rounded ${darkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-50'}`}
                  disabled={currentPage === totalPages}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAddSensor}
            className={`px-8 py-3 rounded-lg font-medium text-white border ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
          >
            Add Sensor
          </button>
        </div>
      </div>
    );
  };

  const renderConnectStep = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className={`rounded-lg shadow-lg p-12 text-center max-w-md w-full ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
        <div className="flex justify-center items-center space-x-4 mb-8">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}>
              1
            </div>
            <span className={`text-sm font-medium ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Connect</span>
          </div>
          <div className={`w-12 h-px ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}></div>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Settings</span>
          </div>
          <div className="w-12 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Finish</span>
          </div>
        </div>

        <div className="mb-8">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 cursor-pointer ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`}
            onClick={connectToBluetoothDevice}
          >
            <Bluetooth className={`w-10 h-10 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
          </div>
          <h3 className="text-xl font-semibold mb-4">Automatic Sensor Detection</h3>
          <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Pair with your SafeSense sensor device</p>
          <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>Device: <span className={`${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{connectedDevice || 'Not connected'}</span></p>
        </div>

        <div className="flex space-x-4">
          {connectedDevice && (
            <button
              onClick={disconnectDevice}
              className={`px-4 py-2 rounded-lg font-medium text-white ${darkMode ? 'bg-red-700 hover:bg-red-800' : 'bg-red-500 hover:bg-red-600'}`}
            >
              <X className="w-4 h-4 inline mr-1" /> Disconnect
            </button>
          )}
          <button
            onClick={() => {
              setCurrentView('list');
              setError('');
            }}
            className={`flex-1 px-6 py-3 rounded-lg font-medium border ${darkMode ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Cancel
          </button>
          <button
            onClick={handleNextStep}
            className={`flex-1 px-6 py-3 rounded-lg font-medium text-white border ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
            disabled={!connectedDevice}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderSettingsStep = (isEdit = false) => (
    <div className="flex-1 flex items-center justify-center">
      <div className={`rounded-lg shadow-lg p-12 max-w-md w-full ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
        <div className="flex justify-center items-center space-x-4 mb-8">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}>
              {isEdit ? '✓' : '1'}
            </div>
            <span className={`text-sm font-medium ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Connect</span>
          </div>
          <div className={`w-12 h-px ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}></div>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}>
              2
            </div>
            <span className={`text-sm font-medium ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Settings</span>
          </div>
          <div className="w-12 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
              3
            </div>
            <span className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Finish</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2">{isEdit ? 'Edit Sensor' : 'Sensor Name'}</h3>
            <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{isEdit ? 'Update the sensor details' : 'Give this Sensor a name'}</p>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                className={`w-full p-3 border rounded-lg outline-none ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 border-gray-600 focus:ring-2 focus:ring-orange-700 focus:border-orange-700' 
                    : 'bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                }`}
                placeholder="Enter sensor name"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Type</h3>
            <p className={`mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>What is this sensor monitoring?</p>
            <div className="relative">
              <select
                value={sensorType}
                onChange={(e) => setSensorType(e.target.value)}
                className={`w-full p-3 border rounded-lg outline-none appearance-none ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-300 border-gray-600 focus:ring-2 focus:ring-orange-700 focus:border-orange-700' 
                    : 'bg-white text-gray-900 border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                }`}
              >
                <option value="">Select type</option>
                <option value="Temperature">Temperature</option>
                <option value="Humidity">Humidity</option>
              </select>
              <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${darkMode ? 'text-gray-400' : 'text-gray-400'}`} />
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              onClick={() => {
                setCurrentView(isEdit ? 'list' : 'connect');
                setError('');
              }}
              className={`flex-1 px-6 py-3 rounded-lg font-medium border ${
                darkMode 
                  ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isEdit ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={isEdit ? handleSaveEditSensor : handleFinishAddSensor}
              disabled={!sensorName || !sensorType}
              className={`flex-1 px-6 py-3 rounded-lg font-medium text-white border ${
                (!sensorName || !sensorType)
                  ? 'bg-gray-300 cursor-not-allowed border-gray-300'
                  : darkMode 
                    ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' 
                    : 'bg-orange-500 hover:bg-orange-600 border-orange-500'
              }`}
            >
              {isEdit ? 'Save' : 'Finish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="relative h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className={`rounded-lg shadow-lg p-12 text-center max-w-md w-full ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
          <div className="flex justify-center items-center space-x-4 mb-8">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}>
                ✓
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Connect</span>
            </div>
            <div className={`w-12 h-px ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}></div>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}>
                ✓
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Settings</span>
            </div>
            <div className={`w-12 h-px ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}></div>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-orange-700' : 'bg-orange-500'}`}>
                3
              </div>
              <span className={`text-sm font-medium ${darkMode ? 'text-orange-400' : 'text-orange-500'}`}>Finish</span>
            </div>
          </div>

          <div className="mb-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${darkMode ? 'bg-green-900' : 'bg-green-100'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-green-700' : 'bg-green-500'}`}>
                <span className="text-white text-sm">✓</span>
              </div>
            </div>
            <p className={`mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>This sensor is added</p>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>successfully to your Dashboard</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDone}
              className={`w-48 px-4 py-3 rounded-lg font-medium text-white border mx-auto block ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
            >
              Done
            </button>
            <button
              onClick={handleDone}
              className={`w-48 px-4 py-3 rounded-lg font-medium border mx-auto block ${
                darkMode 
                  ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Later
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 right-8">
        <button
          onClick={handleDone}
          className={`px-8 py-3 rounded-lg font-medium text-white border ${darkMode ? 'bg-orange-700 hover:bg-orange-800 border-orange-700' : 'bg-orange-500 hover:bg-orange-600 border-orange-500'}`}
        >
          Done
        </button>
      </div>
    </div>
  );

  const renderSensorDetails = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{selectedSensor?.name}</h2>
        <button
          onClick={() => {
            setCurrentView('list');
            setError('');
          }}
          className={`px-6 py-2 rounded-lg font-medium border ${
            darkMode 
              ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' 
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className={`rounded-lg shadow-sm p-6 ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
          <h3 className="text-lg font-semibold mb-6">Sensor Details</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>ID</span>
              <span className="font-mono text-sm">{selectedSensor?.id || '2323e0000000e'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Broadcast Method</span>
              <span>Bluetooth</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Model</span>
              <span>SSN 006</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Firmware</span>
              <span>2.3.0</span>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow-sm p-6 ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
          <h3 className="text-lg font-semibold mb-6">Sensor Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Type</span>
              <span>{selectedSensor?.sensor_type || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Added</span>
              <span>{selectedSensor?.date || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow-sm p-6 ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-800'}`}>
          <h3 className="text-lg font-semibold mb-6">Sensor History</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sensor Added</span>
              <span>{selectedSensor?.date || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sensor Paired</span>
              <span>{selectedSensor?.date || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (sensors.length === 0 && currentView === 'list') {
      return renderEmptyState();
    }

    switch (currentView) {
      case 'empty':
        return renderEmptyState();
      case 'list':
        return renderSensorsList();
      case 'connect':
        return renderConnectStep();
      case 'settings':
        return renderSettingsStep();
      case 'edit':
        return renderSettingsStep(true);
      case 'success':
        return renderSuccessStep();
      case 'details':
        return renderSensorDetails();
      default:
        return renderEmptyState();
    }
  };

  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar activeKey="sensors" darkMode={darkMode} />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Sensors</h2>
            <div className="flex items-center space-x-4">
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleSignOut}
                className={`px-4 py-2 rounded ${darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'}`}
              >
                Log out
              </button>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${darkMode ? 'bg-amber-700' : 'bg-amber-600'}`}>
                {getInitials(username)}
              </div>
            </div>
          </div>
          <div>{renderContent()}</div>
          <footer className={`text-center mt-8 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            © 2025 Safe Sense. All rights reserved.
          </footer>
        </main>
      </div>
    </ErrorBoundary>
  );
}
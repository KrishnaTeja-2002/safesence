"use client";

import React, { useEffect, useState } from 'react';
import { Bluetooth, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';
import apiClient from '../lib/apiClient';

export default function DevicesPage() {
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [openById, setOpenById] = useState({});
  const [settingsSensor, setSettingsSensor] = useState(null);
  const [newSensorName, setNewSensorName] = useState('');
  const [newSensorType, setNewSensorType] = useState('');
  const [newMetric, setNewMetric] = useState('');
  const [savingSensor, setSavingSensor] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectedDeviceId, setConnectedDeviceId] = useState(null);
  const [savingDevice, setSavingDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // Use sensors API (works for authed and unauthenticated viewers) and group by device
        const rows = await apiClient.getSensors();
        const map = new Map();
        (rows || []).forEach((r) => {
          const deviceId = r.device_id;
          const deviceName = r.device_name || '';
          if (!map.has(deviceId)) map.set(deviceId, { device_id: deviceId, device_name: deviceName, sensors: [] });
          map.get(deviceId).sensors.push(r);
        });
        setDevices(Array.from(map.values()));
      } catch (e) {
        setError(e?.message || 'Failed to load devices');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const renameDevice = async (device) => {
    try {
      const currentName = device.device_name || '';
      const next = prompt('Rename device', currentName);
      if (next == null) return; // cancelled
      const trimmed = next.trim();
      if (!trimmed || trimmed === currentName) return;
      setSavingId(device.device_id);
      await apiClient.updateDevice(device.device_id, { deviceName: trimmed });
      setDevices((prev) => prev.map((d) => (
        d.device_id === device.device_id ? { ...d, device_name: trimmed } : d
      )));
      setSavingId('');
    } catch (e) {
      setSavingId('');
      setError(e?.message || 'Failed to rename device');
    }
  };

  // Bluetooth pairing for adding a device
  const connectToBluetoothDevice = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'SafeSense' }],
        optionalServices: ['battery_service']
      });
      setConnectedDevice(device.name || 'SafeSense Device');
      setConnectedDeviceId(device.id);
      if (!newDeviceName) setNewDeviceName(device.name || '');
    } catch (error) {
      // Ignore user-cancel; surface others
      if (!String(error?.message || '').toLowerCase().includes('cancel')) {
        setError('Bluetooth connection failed: ' + (error?.message || String(error)));
      }
    }
  };

  const saveNewDevice = async () => {
    if (!connectedDeviceId) {
      setError('Please connect to a device first.');
      return;
    }
    try {
      setSavingDevice(true);
      const created = await apiClient.createDevice({ deviceId: connectedDeviceId, deviceName: (newDeviceName || connectedDevice || '') });
      // Reflect locally
      setDevices((prev) => {
        const exists = prev.some((d) => d.device_id === (created.deviceId || created.device_id));
        if (exists) return prev;
        return [
          ...prev,
          { device_id: created.deviceId || created.device_id, device_name: created.deviceName || created.device_name || newDeviceName || connectedDevice || '', sensors: [] }
        ];
      });
      // cleanup
      setShowAddDevice(false);
      setConnectedDevice(null);
      setConnectedDeviceId(null);
      setNewDeviceName('');
    } catch (e) {
      setError(e?.message || 'Failed to create device');
    } finally {
      setSavingDevice(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <Sidebar darkMode={darkMode} />
        <main className="flex-1 p-6 flex items-center justify-center">Loading…</main>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'}`}>
      <Sidebar darkMode={darkMode} />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Devices</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/devices/add')}
              className={`${darkMode ? 'bg-orange-700 hover:bg-orange-800' : 'bg-orange-500 hover:bg-orange-600'} text-white px-4 py-2 rounded`}
            >
              + Add Device
            </button>
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </div>

        {devices.length === 0 ? (
          <div className={`rounded-lg shadow p-12 text-center ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={darkMode ? 'text-gray-400' : 'text-gray-600'}>No devices found.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((d) => (
              <div key={d.device_id} className={`rounded border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className={`px-4 py-3 flex items-start justify-between ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setOpenById((prev) => ({ ...prev, [d.device_id]: !prev[d.device_id] }))}
                      className={`font-semibold truncate ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                      title={d.device_name || d.device_id}
                    >
                      {d.device_name || d.device_id}
                    </button>
                    <div className={darkMode ? 'text-gray-400 text-xs' : 'text-gray-500 text-xs'}>{d.sensors.length} sensor{d.sensors.length === 1 ? '' : 's'}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); renameDevice(d); }}
                    disabled={savingId === d.device_id}
                    className={`px-2 py-1 text-xs rounded border ${darkMode ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'} ${savingId === d.device_id ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title="Rename device"
                  >
                    {savingId === d.device_id ? 'Saving…' : 'Rename'}
                  </button>
                </div>
                {openById[d.device_id] && (
                <div className="px-4 pb-3">
                  <table className="w-full">
                    <thead>
                      <tr className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-xs`}>
                        <th className="text-left py-2">Sensor Name</th>
                        <th className="text-left py-2">Type</th>
                        <th className="text-left py-2">Access</th>
                        <th className="text-left py-2">Last Seen</th>
                        <th className="text-left py-2">Status</th>
                        <th className="text-left py-2">Tools</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.sensors.map((s) => (
                        <tr key={s.sensor_id} className={`${darkMode ? 'border-gray-800' : 'border-gray-100'} border-t`}> 
                          <td className="py-2 text-sm">
                            <span className={`${darkMode ? 'text-blue-400' : 'text-blue-600'} cursor-default`}>{s.sensor_name || s.sensor_id}</span>
                          </td>
                          <td className={`py-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{(s.sensor_type || '').charAt(0).toUpperCase() + (s.sensor_type || '').slice(1)}</td>
                          <td className="py-2 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.access_role === 'owner' ? 'bg-green-200 text-green-800' : s.access_role === 'admin' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'}`}>{s.access_role || 'viewer'}</span>
                          </td>
                          <td className={`py-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{s.last_fetched_time ? new Date(s.last_fetched_time).toLocaleString() : '—'}</td>
                          <td className="py-2 text-sm">
                            {(() => {
                              const st = (s.status || '').toLowerCase();
                              const cls = st === 'alert' ? (darkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-800') : st === 'warning' ? (darkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-800') : st === 'ok' ? (darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800') : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-800');
                              return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s.status || 'unknown'}</span>;
                            })()}
                          </td>
                          <td className="py-2 text-sm">
                            {(s.access_role === 'owner' || s.access_role === 'admin') ? (
                              <button
                                type="button"
                                className={`px-2 py-1 text-xs rounded border ${darkMode ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'}`}
                                onClick={() => {
                                  setSettingsSensor({ ...s, device_id: d.device_id, device_name: d.device_name });
                                  setNewSensorName(s.sensor_name || '');
                                  setNewSensorType(s.sensor_type || 'temperature');
                                  setNewMetric(s.metric || 'F');
                                }}
                              >
                                Settings
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      {/* Add Device flow moved to /devices/add */}
      {/* Sensor Settings Modal */}
      <SensorSettingsModal
        darkMode={darkMode}
        sensor={settingsSensor}
        onClose={() => { if (!savingSensor) { setSettingsSensor(null); } }}
        onSave={async () => {
          if (!settingsSensor) return;
          try {
            setSavingSensor(true);
            // Reuse alerts update route to persist name/type/metric
            await apiClient.updateAlertThresholds(settingsSensor.sensor_id, {
              sensor_name: newSensorName,
              sensor_type: newSensorType,
              metric: newMetric,
            }, settingsSensor.device_id);
            // Reflect in local state
            setDevices((prev) => prev.map((d) => (
              d.device_id === settingsSensor.device_id
                ? { ...d, sensors: d.sensors.map((s) => s.sensor_id === settingsSensor.sensor_id ? { ...s, sensor_name: newSensorName, sensor_type: newSensorType, metric: newMetric } : s) }
                : d
            )));
            setSettingsSensor(null);
          } catch (e) {
            setError(e?.message || 'Failed to save sensor');
          } finally {
            setSavingSensor(false);
          }
        }}
        newSensorName={newSensorName}
        setNewSensorName={setNewSensorName}
        newSensorType={newSensorType}
        setNewSensorType={setNewSensorType}
        newMetric={newMetric}
        setNewMetric={setNewMetric}
        saving={savingSensor}
      />
    </div>
  );
}

// Inline modal for sensor settings
// Placed below component return for clarity; rendered conditionally within the page root
export function SensorSettingsModal({ darkMode, sensor, onClose, onSave, newSensorName, setNewSensorName, newSensorType, setNewSensorType, newMetric, setNewMetric, saving }) {
  if (!sensor) return null;
  const isHumidity = (newSensorType || '').toLowerCase() === 'humidity';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className={`relative w-full max-w-md mx-4 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800 text-white' : 'bg-white'} p-6`}>
        <h3 className="text-lg font-semibold mb-4">Sensor Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Sensor name</label>
            <input
              type="text"
              value={newSensorName}
              onChange={(e) => setNewSensorName(e.target.value)}
              className={`w-full p-2 rounded border ${darkMode ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500' : 'bg-white border-gray-300 focus:border-orange-500'}`}
              placeholder="Enter sensor name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sensor type</label>
            <select
              value={newSensorType}
              onChange={(e) => setNewSensorType(e.target.value)}
              className={`w-full p-2 rounded border ${darkMode ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500' : 'bg-white border-gray-300 focus:border-orange-500'}`}
            >
              <option value="temperature">Temperature</option>
              <option value="humidity">Humidity</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Metric (unit)</label>
            <select
              value={newMetric}
              onChange={(e) => setNewMetric(e.target.value)}
              className={`w-full p-2 rounded border ${darkMode ? 'bg-gray-700 text-white border-gray-600 focus:border-orange-500' : 'bg-white border-gray-300 focus:border-orange-500'}`}
            >
              {isHumidity ? (
                <option value="%">%</option>
              ) : (
                <>
                  <option value="F">Fahrenheit (°F)</option>
                  <option value="C">Celsius (°C)</option>
                </>
              )}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => !saving && onClose()}
            className={`px-4 py-2 rounded ${darkMode ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !newSensorName.trim()}
            className={`px-4 py-2 rounded font-semibold text-white ${darkMode ? 'bg-orange-700 hover:bg-orange-800 disabled:bg-gray-600' : 'bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300'}`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}



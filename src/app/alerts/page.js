'use client';

import { useState, useRef } from 'react';

export default function Alerts() {
  const [alertName, setAlertName] = useState('');
  const [sensorName, setSensorName] = useState('8 Active Sensors');
  const [alertMessage, setAlertMessage] = useState('Ex My (Sensor Name): Temperature above 50°F');
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSMS, setSendSMS] = useState(true);
  const formRef = useRef(null);

  const alerts = [
    { name: 'Freezer 1', status: 'Needs Attention', temp: '', lastReading: '1 month ago', color: 'bg-red-500' },
    { name: 'Drive Thu Fridge', status: 'Needs Attention', temp: '', lastReading: '2 weeks ago', color: 'bg-red-500' },
    { name: 'Beverage Fridge', status: 'Needs Attention', temp: '', lastReading: '5 weeks ago', color: 'bg-red-500' },
    { name: 'Walk-in Fridge', status: 'Warning', temp: '47°F', lastReading: 'Current Reading', color: 'bg-yellow-400' },
    { name: 'FC Fridge', status: 'Good', temp: '32°F', lastReading: 'Current Reading', color: 'bg-green-500' },
    { name: 'Fry Products', status: 'Good', temp: '-6°F', lastReading: 'Current Reading', color: 'bg-green-500' },
    { name: 'Freezer 2', status: 'Good', temp: '-1°F', lastReading: 'Current Reading', color: 'bg-green-500' },
    { name: 'Meat Freezer', status: 'Good', temp: '-3°F', lastReading: 'Current Reading', color: 'bg-green-500' },
  ];

  const systemAlerts = [
    { name: 'Meat Freezer', status: 'Disconnected', lastReading: '2 hours ago', color: 'bg-gray-400' },
    { name: 'Fry Products', status: 'Need battery replacement', lastReading: '5 hours ago', color: 'bg-gray-400' },
  ];

  const handleAddAlert = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-700 text-white py-6 px-4">
        <h1 className="text-2xl font-bold mb-10 text-orange-500">Safe Sense</h1>
        <ul className="space-y-4">
          {['🏠 Dashboard', '⚠️ Alerts', '📡 Sensors', '🕓 History', '👥 Team', '⚙️ Settings'].map((item, idx) => (
            <li key={idx}>
              <button
                className={`w-full text-left px-4 py-2 rounded hover:bg-gray-600 ${
                  idx === 1 ? 'bg-gray-600 font-semibold' : ''
                }`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Alerts</h2>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>

        {/* Alerts Dashboard */}
        <div className="space-y-6">
          <div className="bg-red-100 text-red-800 p-2 rounded flex items-center">
            <span className="mr-2">🚨</span> Needs Attention
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts
              .filter((alert) => alert.status === 'Needs Attention')
              .map((alert, idx) => (
                <div key={idx} className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${alert.color}`}>
                  <div>
                    <p className="font-semibold">{alert.name}</p>
                    <p className="text-sm text-gray-500">{alert.lastReading}</p>
                  </div>
                  <div className="text-right">
                    {alert.temp && <p className="font-medium">{alert.temp}</p>}
                    <p className="text-sm text-gray-500 flex items-center">
                      <span className="mr-1">🌡️</span> {alert.status}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <div className="bg-yellow-100 text-yellow-800 p-2 rounded flex items-center">
            <span className="mr-2">⚠️</span> Warning
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts
              .filter((alert) => alert.status === 'Warning')
              .map((alert, idx) => (
                <div key={idx} className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${alert.color}`}>
                  <div>
                    <p className="font-semibold">{alert.name}</p>
                    <p className="text-sm text-gray-500">{alert.lastReading}</p>
                  </div>
                  <div className="text-right">
                    {alert.temp && <p className="font-medium">{alert.temp}</p>}
                    <p className="text-sm text-gray-500 flex items-center">
                      <span className="mr-1">🌡️</span> {alert.status}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <div className="bg-green-100 text-green-800 p-2 rounded flex items-center">
            <span className="mr-2">✅</span> Good
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {alerts
              .filter((alert) => alert.status === 'Good')
              .map((alert, idx) => (
                <div key={idx} className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${alert.color}`}>
                  <div>
                    <p className="font-semibold">{alert.name}</p>
                    <p className="text-sm text-gray-500">{alert.lastReading}</p>
                  </div>
                  <div className="text-right">
                    {alert.temp && <p className="font-medium">{alert.temp}</p>}
                    <p className="text-sm text-gray-500 flex items-center">
                      <span className="mr-1">🌡️</span> {alert.status}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <div className="bg-gray-100 text-gray-600 p-2 rounded flex items-center">
            <span className="mr-2">🛠️</span> System Alerts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {systemAlerts.map((alert, idx) => (
              <div key={idx} className={`bg-white rounded-lg shadow p-4 flex items-center justify-between ${alert.color}`}>
                <div>
                  <p className="font-semibold">{alert.name}</p>
                  <p className="text-sm text-gray-500">{alert.lastReading}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{alert.status}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 mt-4"
            onClick={handleAddAlert}
          >
            Add Alert
          </button>
        </div>

        {/* Create New Alert Form (Scrollable Content) */}
        <div ref={formRef} className="mt-10">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-semibold mb-4">Create New Alert</h3>
            <p className="text-sm text-gray-500 mb-4">
              Set up alerts for your sensors to receive push notifications, text messages, or emails whenever the
              conditions you specify are met.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Alert Name:</label>
              <input
                type="text"
                value={alertName}
                onChange={(e) => setAlertName(e.target.value)}
                className="border rounded px-2 py-1 w-full"
                placeholder=""
              />
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h4 className="text-lg font-semibold mb-2">Trigger</h4>
              <p className="text-sm text-gray-500 mb-4">
                If the temperature goes over the maximum threshold or below the minimum threshold, your selected contacts
                will be alerted.
              </p>
              <div className="max-w-xl mx-auto flex h-48 w-full">
                <div className="w-16 flex flex-col justify-between">
                  <div className="text-sm text-gray-500 mb-2">Temperature (°F)</div>
                  <div className="flex flex-col justify-between h-full">
                    {[60, 50, 40, 30, 20, 10, 0].map((val) => (
                      <div key={val} className="flex items-center justify-end pr-2">
                        <span className="text-sm text-gray-400">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-x-0" style={{ top: '33.333%', borderTop: '1px dashed red' }}></div>
                  <div className="absolute inset-x-0" style={{ top: '66.667%', borderTop: '1px dashed red' }}></div>
                  <div
                    className="absolute inset-y-0 left-0 right-0"
                    style={{ top: '0%', height: '33.333%', backgroundColor: 'rgba(255, 192, 203, 0.3)' }}
                  ></div>
                  <div
                    className="absolute inset-y-0 left-0 right-0"
                    style={{ top: '66.667%', height: '33.333%', backgroundColor: 'rgba(255, 192, 203, 0.3)' }}
                  ></div>
                  <span className="absolute top-[16.667%] left-1/2 transform -translate-x-1/2 text-red-500">⚠️</span>
                  <span className="absolute top-[83.333%] left-1/2 transform -translate-x-1/2 text-red-500">⚠️</span>
                  <div className="absolute right-12 top-[33.333%] transform -translate-y-1/2 text-sm text-gray-500">
                    Move handle to adjust the Maximum Threshold
                  </div>
                  <div className="absolute right-12 top-[66.667%] transform -translate-y-1/2 text-sm text-gray-500">
                    Move handle to adjust the Minimum Threshold
                  </div>
                  <div className="absolute right-0 top-0 w-8 h-full bg-gray-200">
                    <div className="absolute top-[33.333%] left-1/2 transform -translate-x-1/2 w-4 h-2 bg-black rounded"></div>
                    <div className="absolute top-[66.667%] left-1/2 transform -translate-x-1/2 w-4 h-2 bg-black rounded"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h4 className="text-lg font-semibold mb-2">Choose Sensor</h4>
              <p className="text-sm text-gray-500 mb-2">Which sensor should this alert be assigned to?</p>
              <select
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option>8 Active Sensors</option>
              </select>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h4 className="text-lg font-semibold mb-2">Alert Settings</h4>
              <p className="text-sm text-gray-500 mb-2">Which sensor should this alert be assigned to?</p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Alert Message</label>
                <input
                  type="text"
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="Ex My (Sensor Name): Temperature above 50°F"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Send email alert</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="mr-2"
                  />
                  <span>Send on Email when this alert is triggered to selected contacts</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Send SMS alerts</label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={sendSMS}
                    onChange={(e) => setSendSMS(e.target.checked)}
                    className="mr-2"
                  />
                  <span>Send an SMS when this alert is triggered to selected contacts</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Cancel
              </button>
              <button className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">Create Alert</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
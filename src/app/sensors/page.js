'use client';
import { useState } from 'react';
export default function Sensors() {
  const [sensors] = useState([
    { name: 'Walk-In Fridge', function: 'Air Temp', alert: 'On', date: 'June 28 2025', status: 'Active' },
    { name: 'Freezer 1', function: 'Air Temp', alert: 'On', date: 'May 2 2025', status: 'Inactive' },
    { name: 'Drive Thru Fridge', function: 'Air and Surface Temp', alert: 'On', date: 'May 6 2025', status: 'Inactive' },
    { name: 'FC Fridge', function: 'Surface Temp', alert: 'On', date: 'April 4 2025', status: 'Active' },
    { name: 'Freezer 2', function: 'Air and Surface Temp', alert: 'On', date: 'Jan 2025', status: 'Active' },
    { name: 'Meat Freezer', function: 'Air and Surface Temp', alert: 'On', date: 'Dec 28 2024', status: 'Active' },
    { name: 'Fry Products', function: 'Air and Surface Temp', alert: 'On', date: 'Oct 18 2024', status: 'Active' },
    { name: 'Beverage Fridge', function: 'Air Temp', alert: 'Off', date: 'Sep 18 2024', status: 'Inactive' },
  ]);
  const [hoveredSensor, setHoveredSensor] = useState(null);
  const [step, setStep] = useState(1);
  const [sensorName, setSensorName] = useState('');
  const [sensorFunction, setSensorFunction] = useState('');
  return (
    <div className="flex min-h-screen bg-gray-100 text-gray-800">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-700 text-white py-6 px-4 fixed h-full">
        <h1 className="text-2xl font-bold mb-10 text-orange-500">Safe Sense</h1>
        <ul className="space-y-4">
          {[':house: Dashboard', ':warning: Alerts', ':satellite_antenna: Sensors', ':clock4: History', ':silhouettes: Team', ':cog: Account'].map((item, idx) => (
            <li key={idx}>
              <button
                className={`w-full text-left px-4 py-2 rounded hover:bg-gray-600 ${idx === 2 ? 'bg-gray-600 font-semibold' : ''}`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {/* Main Content */}
      <main className="ml-60 p-6 flex-1">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Sensors</h2>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>
        {/* Sensors List */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Sensor Name</th>
                <th className="py-2">Function</th>
                <th className="py-2">Alert</th>
                <th className="py-2">Date</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sensors.map((sensor, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-2">
                    <div
                      className="relative inline-block"
                      onMouseEnter={() => setHoveredSensor(sensor.name)}
                      onMouseLeave={() => setHoveredSensor(null)}
                    >
                      <button className="bg-blue-200 text-gray-800 px-4 py-2 rounded flex items-center space-x-2">
                        {sensor.name}
                      </button>
                      {hoveredSensor === sensor.name && (
                        <div className="absolute left-0 mt-2 w-32 bg-white border rounded shadow-lg z-10">
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Edit</button>
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-100">Delete</button>
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-100">View</button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2">{sensor.function}</td>
                  <td className="py-2">{sensor.alert}</td>
                  <td className="py-2">{sensor.date}</td>
                  <td className="py-2">
                    <span
                      className={`px-3 py-1 rounded ${
                        sensor.status === 'Active' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {sensor.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4 text-sm text-gray-500">
            <span>Showing Sensors 1 to 8 of 10</span>
            <div className="space-x-2">
              <button className="px-2 py-1 border rounded">1</button>
              <button className="px-2 py-1 border rounded">2</button>
              <span>&gt;</span>
            </div>
          </div>
          {step === 1 && (
            <div className="mt-6 text-right">
              <button
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
                onClick={() => setStep(2)}
              >
                Add Sensor
              </button>
            </div>
          )}
        </div>
        {/* Step 2: Automatic Device Detection */}
        {step >= 2 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="space-x-8 mb-4 flex justify-center">
              <button className="px-4 py-2 rounded bg-orange-500 text-white">1</button>
              <button className="px-4 py-2 rounded bg-orange-500 text-white">2</button>
              <button className="px-4 py-2 rounded bg-gray-200">3</button>
            </div>
            <div className="text-center">
              <span role="img" aria-label="bluetooth" className="text-4xl">:large_blue_circle:</span>
              <p className="mt-4">Automatic Device Detection</p>
              <p>Place the sensor close to the computer for optimal pairing</p>
              <p>Device: Safe_Sense R2343561</p>
              <button
                className="bg-white text-gray-800 px-4 py-2 rounded mt-4 border"
                onClick={() => setStep(1)}
              >
                Cancel
              </button>
              <button
                className="bg-orange-500 text-white px-4 py-2 rounded mt-4 ml-2"
                onClick={() => setStep(3)}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {/* Step 3: Sensor Setup */}
        {step >= 3 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="space-x-8 mb-4 flex justify-center">
              <button className="px-4 py-2 rounded bg-orange-500 text-white">:heavy_tick:</button>
              <button className="px-4 py-2 rounded bg-orange-500 text-white">2</button>
              <button className="px-4 py-2 rounded bg-orange-500 text-white">3</button>
            </div>
            <div>
              <label>Sensor Name</label>
              <input
                type="text"
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                className="w-full p-2 border rounded mt-2"
                placeholder="Give this Sensor a name"
              />
              <label className="mt-4 block">Function</label>
              <select
                value={sensorFunction}
                onChange={(e) => setSensorFunction(e.target.value)}
                className="w-full p-2 border rounded mt-2"
              >
                <option value="">What is this sensor monitoring?</option>
                <option value="Air Temp">Air Temp</option>
                <option value="Surface Temp">Surface Temp</option>
                <option value="Air and Surface Temp">Air and Surface Temp</option>
              </select>
              <div className="mt-4 flex justify-between">
                <button
                  className="bg-white text-gray-800 px-4 py-2 rounded border"
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
                <button
                  className="bg-orange-500 text-white px-4 py-2 rounded"
                  onClick={() => setStep(4)}
                  disabled={!sensorName || !sensorFunction}
                >
                  Finish
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Step 4: Sensor Added Successfully */}
        {step >= 4 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 text-center">
            <div className="space-x-8 mb-4 flex justify-center">
              <button className="px-4 py-2 rounded bg-orange-500 text-white">:heavy_tick:</button>
              <button className="px-4 py-2 rounded bg-orange-500 text-white">:heavy_tick:</button>
              <button className="px-4 py-2 rounded bg-orange-500 text-white">:heavy_tick:</button>
            </div>
            <p>This sensor is added successfully to your Dashboard</p>
            <button className="bg-orange-500 text-white px-4 py-2 rounded mt-4" onClick={() => setStep(1)}>
              Apply Alert
            </button>
            <button className="bg-white text-gray-800 px-4 py-2 rounded mt-2 border">Later</button>
            <button className="bg-orange-500 text-white px-4 py-2 rounded mt-4" onClick={() => setStep(1)}>
              Done
            </button>
          </div>
        )}
        {/* Alerts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">Walk-in Fridge</h2>
          <div className="space-y-4">
            <div className="p-4 border rounded">
              <h3>Sensor Details</h3>
              <p>ID: 2323e0000000e</p>
              <p>Broadcast Method: LoRa</p>
              <p>Frequency: US915</p>
              <p>Model: SSN 006</p>
              <p>Firmware: 2.3.0</p>
            </div>
            <div className="p-4 border rounded">
              <h3>Sensor Alerts</h3>
              <p>Alert Added (Fridge Temperature): July 20, 2025</p>
            </div>
            <div className="p-4 border rounded">
              <h3>Sensor History</h3>
              <p>Sensor Added: July 30, 2025</p>
              <p>Sensor Paused: Dec 18, 2023</p>
              <p>Sensor Added: May 10, 2023</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



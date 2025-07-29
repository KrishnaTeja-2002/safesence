
'use client';

import { useState, Component } from 'react';
import { useRouter } from 'next/navigation';
import { Bluetooth, ChevronDown, Edit, Trash, AlertTriangle } from 'lucide-react';
import Sidebar from '../components/Sidebar';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div>Error: {this.state.error?.message || 'Something went wrong'}</div>;
    }
    return this.props.children;
  }
}

export default function Sensors() {
  const [sensors, setSensors] = useState([
    { id: 1, name: 'Walk-In Fridge', function: 'Air Temp', alert: 'On', date: 'June 28 2025', status: 'Active' },
    { id: 2, name: 'Freezer 1', function: 'Air Temp', alert: 'On', date: 'May 25 2025', status: 'Inactive' },
    { id: 3, name: 'Drive Thru Fridge', function: 'Air and Surface Temp', alert: 'On', date: 'May 6 2025', status: 'Inactive' },
    { id: 4, name: 'FC Fridge', function: 'Surface Temp', alert: 'On', date: 'April 4 2025', status: 'Active' },
    { id: 5, name: 'Freezer 2', function: 'Air and Surface Temp', alert: 'On', date: 'Jan 2025', status: 'Active' },
    { id: 6, name: 'Meat Freezer', function: 'Air and Surface Temp', alert: 'On', date: 'Dec 25 2024', status: 'Active' },
    { id: 7, name: 'Fry Products', function: 'Air and Surface Temp', alert: 'On', date: 'Oct 18 2024', status: 'Active' },
    { id: 8, name: 'Beverage Fridge', function: 'Air Temp', alert: 'Off', date: 'Sep 18 2024', status: 'Inactive' },
  ]);

  const [currentView, setCurrentView] = useState('list');
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [step, setStep] = useState(1);
  const [sensorName, setSensorName] = useState('');
  const [sensorFunction, setSensorFunction] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('Newest');

  const router = useRouter();

  const handleAddSensor = () => {
    setCurrentView('connect');
    setStep(1);
  };

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      setCurrentView('success');
    }
  };

  const handleFinishAddSensor = () => {
    if (sensorName && sensorFunction) {
      const newSensor = {
        id: sensors.length + 1,
        name: sensorName,
        function: sensorFunction,
        alert: 'On',
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        status: 'Active',
      };
      setSensors([...sensors, newSensor]);
      setSensorName('');
      setSensorFunction('');
      setCurrentView('success');
    }
  };

  const handleDone = () => {
    setCurrentView('list');
    setStep(1);
  };

  const handleSensorClick = (sensor) => {
    setSelectedSensor(sensor);
    setCurrentView('details');
  };

  const sensorsPerPage = 8;
  const totalPages = Math.ceil(sensors.length / sensorsPerPage);
  const startIndex = (currentPage - 1) * sensorsPerPage;
  const endIndex = startIndex + sensorsPerPage;
  const currentSensors = sensors.slice(startIndex, endIndex);

  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="rounded-lg shadow-lg p-16 text-center max-w-lg bg-white text-gray-800">
        <div className="mb-8">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-lg mb-8 text-gray-500">No Sensor connected with this<br />Server.</p>
        </div>
        <button
          onClick={handleAddSensor}
          className="px-8 py-3 rounded-lg font-medium text-white border bg-orange-500 hover:bg-orange-600 border-orange-500"
        >
          Add Sensor
        </button>
      </div>
    </div>
  );

  const renderSensorsList = () => (
    <div className="space-y-6">
      <div className="rounded-lg shadow-sm overflow-hidden bg-white text-gray-800">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-semibold">Sensors</h3>
              <p className="text-blue-500 cursor-pointer text-sm font-medium">Paired Sensors</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <select className="border rounded-lg px-4 py-2 text-sm bg-white border-gray-300 min-w-24 appearance-none pr-8">
                  <option>Sensors</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border rounded-lg px-4 py-2 text-sm bg-white border-gray-300 appearance-none pr-8"
                  >
                    <option>Newest</option>
                    <option>Oldest</option>
                    <option>Name</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="pb-3 font-medium text-sm text-left">Sensor Name</th>
                <th className="pb-3 font-medium text-sm text-left">Function</th>
                <th className="pb-3 font-medium text-sm text-left">Tools</th>
                <th className="pb-3 font-medium text-sm text-left">Date</th>
                <th className="pb-3 font-medium text-sm text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentSensors.map((sensor) => (
                <tr key={sensor.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4">
                    <button
                      className="text-blue-500 hover:text-blue-700 font-medium text-sm"
                      onClick={() => handleSensorClick(sensor)}
                    >
                      {sensor.name}
                    </button>
                  </td>
                  <td className="py-4 text-sm text-gray-700">{sensor.function}</td>
                  <td className="py-4">
                    <div className="flex items-center space-x-3">
                      <button className="text-blue-500 hover:text-blue-700">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-orange-500 hover:text-orange-700">
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                      <button className="text-red-500 hover:text-red-700">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-gray-700">{sensor.date}</td>
                  <td className="py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        sensor.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {sensor.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center mt-6 text-sm text-gray-500">
            <span>Showing Sensors 1 to {Math.min(endIndex, sensors.length)} of {sensors.length}</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                className="px-3 py-1 border rounded border-gray-300 hover:bg-gray-50"
                disabled={currentPage === 1}
              >
                &lt;
              </button>
              <button
                onClick={() => setCurrentPage(1)}
                className={`px-3 py-1 border rounded ${
                  currentPage === 1 ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                1
              </button>
              <button
                onClick={() => setCurrentPage(2)}
                className={`px-3 py-1 border rounded ${
                  currentPage === 2 ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                2
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                className="px-3 py-1 border rounded border-gray-300 hover:bg-gray-50"
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
          className="px-8 py-3 rounded-lg font-medium text-white border bg-orange-500 hover:bg-orange-600 border-orange-500"
        >
          Add Sensor
        </button>
      </div>
    </div>
  );

  const renderConnectStep = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="rounded-lg shadow-lg p-12 text-center max-w-md w-full bg-white text-gray-800">
        <div className="flex justify-center items-center space-x-4 mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              1
            </div>
            <span className="text-sm text-orange-500 font-medium">Connect</span>
          </div>
          <div className="w-12 h-px bg-orange-500"></div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className="text-sm text-gray-500 font-medium">Settings</span>
          </div>
          <div className="w-12 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm text-gray-500 font-medium">Finish</span>
          </div>
        </div>

        <div className="mb-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bluetooth className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Automatic Device Detection</h3>
          <p className="mb-4 text-gray-600">Place the sensor close to the computer for optimal pairing</p>
          <p className="text-sm text-gray-500">Device: <span className="text-gray-400">Safe_Sense R2343561</span></p>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => setCurrentView('list')}
            className="flex-1 px-6 py-3 rounded-lg font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className="flex-1 px-6 py-3 rounded-lg font-medium text-white border bg-orange-500 hover:bg-orange-600 border-orange-500"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="rounded-lg shadow-lg p-12 max-w-md w-full bg-white text-gray-800">
        <div className="flex justify-center items-center space-x-4 mb-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm">
              ✓
            </div>
            <span className="text-sm text-orange-500 font-medium">Connect</span>
          </div>
          <div className="w-12 h-px bg-orange-500"></div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className="text-sm text-orange-500 font-medium">Settings</span>
          </div>
          <div className="w-12 h-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-sm text-gray-500 font-medium">Finish</span>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold mb-2">Sensor Name</h3>
            <p className="mb-6 text-gray-600">Give this Sensor a name</p>
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={sensorName}
                onChange={(e) => setSensorName(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-gray-900 border-gray-300"
                placeholder="Enter sensor name"
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Function</h3>
            <p className="mb-6 text-gray-600">What is this sensor monitoring?</p>
            <div className="relative">
              <select
                value={sensorFunction}
                onChange={(e) => setSensorFunction(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none appearance-none bg-white text-gray-900 border-gray-300"
              >
                <option value="">Select function</option>
                <option value="Air Temp">Air Temp</option>
                <option value="Surface Temp">Surface Temp</option>
                <option value="Air and Surface Temp">Air and Surface Temp</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              onClick={() => setCurrentView('connect')}
              className="flex-1 px-6 py-3 rounded-lg font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleFinishAddSensor}
              disabled={!sensorName || !sensorFunction}
              className={`flex-1 px-6 py-3 rounded-lg font-medium text-white border bg-orange-500 hover:bg-orange-600 border-orange-500 ${
                !sensorName || !sensorFunction ? 'bg-gray-300 cursor-not-allowed' : ''
              }`}
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="relative h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="rounded-lg shadow-lg p-12 text-center max-w-md w-full bg-white text-gray-800">
          <div className="flex justify-center items-center space-x-4 mb-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm">
                ✓
              </div>
              <span className="text-sm text-orange-500 font-medium">Connect</span>
            </div>
            <div className="w-12 h-px bg-orange-500"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm">
                ✓
              </div>
              <span className="text-sm text-orange-500 font-medium">Settings</span>
            </div>
            <div className="w-12 h-px bg-orange-500"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <span className="text-sm text-orange-500 font-medium">Finish</span>
            </div>
          </div>

          <div className="mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">✓</span>
              </div>
            </div>
            <p className="mb-1 text-gray-600">This sensor is added</p>
            <p className="text-gray-600">successfully to your Dashboard</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleDone}
              className="w-48 px-4 py-3 rounded-lg font-medium text-white border bg-orange-500 hover:bg-orange-600 border-orange-500 mx-auto block"
            >
              Apply Alert
            </button>
            <button
              onClick={handleDone}
              className="w-48 px-4 py-3 rounded-lg font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 mx-auto block"
            >
              Later
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 right-8">
        <button
          onClick={handleDone}
          className="px-8 py-3 rounded-lg font-medium text-white border bg-orange-500 hover:bg-orange-600 border-orange-500"
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
          onClick={() => setCurrentView('list')}
          className="px-6 py-2 rounded-lg font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-lg shadow-sm p-6 bg-white text-gray-800">
          <h3 className="text-lg font-semibold mb-6">Sensor Details</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">ID</span>
              <span className="font-mono text-sm">2323e0000000e</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Broadcast Method</span>
              <span>LoRa</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Frequency</span>
              <span>US915</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Model</span>
              <span>SSN 006</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Firmware</span>
              <span>2.3.0</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg shadow-sm p-6 bg-white text-gray-800">
          <h3 className="text-lg font-semibold mb-6">Sensor Alerts</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Alert Added</span>
              <span>July 20, 2025</span>
            </div>
            <div className="text-blue-500 text-sm">(Fridge Temperature)</div>
          </div>
        </div>

        <div className="rounded-lg shadow-sm p-6 bg-white text-gray-800">
          <h3 className="text-lg font-semibold mb-6">Sensor History</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sensor Added</span>
              <span>July 20, 2025</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sensor Paired</span>
              <span>Dec 18, 2023</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sensor Added</span>
              <span>May 10, 2023</span>
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
      case 'success':
        return renderSuccessStep();
      case 'details':
        return renderSensorDetails();
      default:
        return renderEmptyState();
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-gray-100 text-gray-800">
        <Sidebar activeKey="sensors" />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Sensors</h2>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600">
                Log out
              </button>
              <div className="w-10 h-10 bg-yellow-600 rounded-full"></div>
            </div>
          </div>
          <div>{renderContent()}</div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// app/alerts/alerts.js (or app/alerts/page.jsx)
"use client";

import React, { useState, useRef, Component } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { useDarkMode } from "../DarkModeContext";

/* ------------------------ Error Boundary ------------------------ */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Alerts page crashed:", error, info);
  }
  render() {
    const { darkMode } = this.props;
    if (this.state.hasError) {
      return (
        <div className={`p-4 ${darkMode ? "text-red-300" : "text-red-600"}`}>
          Error: {this.state.error?.message || "Something went wrong"}
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------ Status → Styles ------------------------ */
const getStatusStyles = (status, darkMode) => {
  // Card border color & thermometer text color
  switch (status) {
    case "Needs Attention":
      return {
        section: `${darkMode ? "bg-red-900 text-red-300" : "bg-red-100 text-red-800"}`,
        border: "border-red-500",
        value: "text-red-600",
      };
    case "Warning":
      return {
        section: `${darkMode ? "bg-yellow-900 text-yellow-300" : "bg-yellow-100 text-yellow-800"}`,
        border: "border-yellow-400",
        value: "text-yellow-600",
      };
    case "Good":
      return {
        section: `${darkMode ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"}`,
        border: "border-green-500",
        value: "text-green-600",
      };
    default:
      return {
        section: `${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"}`,
        border: "border-gray-400",
        value: "text-gray-500",
      };
  }
};

export default function Alerts() {
  const [currentView, setCurrentView] = useState("alerts");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alertName, setAlertName] = useState("");
  const [sensorName, setSensorName] = useState("8 Active Sensors");
  const [alertMessage, setAlertMessage] = useState(
    "Ex My (Sensor Name): Temperature above 50°F"
  );
  const [sendEmail, setSendEmail] = useState(false);
  const [sendSMS, setSendSMS] = useState(true);
  const formRef = useRef(null);
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();

  /* ------------------------ Data ------------------------ */
  const alerts = [
    { name: "Freezer 1", status: "Needs Attention", temp: "50°F", lastReading: "1 month ago" },
    { name: "Drive Thru Fridge", status: "Needs Attention", temp: "52°F", lastReading: "2 weeks ago" },
    { name: "Beverage Fridge", status: "Needs Attention", temp: "56°F", lastReading: "5 weeks ago" },

    { name: "Walk-in Fridge", status: "Warning", temp: "45°F", lastReading: "Current Reading" },

    { name: "FC Fridge", status: "Good", temp: "32°F", lastReading: "Current Reading" },
    { name: "Fry Products", status: "Good", temp: "-6°F", lastReading: "Current Reading" },
    { name: "Freezer 2", status: "Good", temp: "-1°F", lastReading: "Current Reading" },
    { name: "Meat Freezer", status: "Good", temp: "-3°F", lastReading: "Current Reading" },
  ];

  const systemAlerts = [
    { name: "Meat Freezer", status: "Disconnected", lastReading: "2 hours ago" },
    { name: "Fry Products", status: "Need battery replacement", lastReading: "5 hours ago" },
  ];

  /* ------------------------ Handlers ------------------------ */
  const handleAddAlert = () => setCurrentView("addAlert");
  const handleAlertClick = (alert) => {
    setSelectedAlert(alert);
    setCurrentView("alertDetail");
  };
  const handleBack = () => {
    setCurrentView("alerts");
    setSelectedAlert(null);
  };

  const sliderStyle = {
    position: "relative",
    display: "inline-block",
    width: "60px",
    height: "34px",
    backgroundColor: darkMode ? "#4a4a4a" : "#ccc",
    borderRadius: "34px",
  };
  const sliderBeforeStyle = {
    position: "absolute",
    content: '""',
    height: "26px",
    width: "26px",
    left: darkMode ? "calc(100% - 30px)" : "4px",
    bottom: "4px",
    backgroundColor: "#ffffffff",
    transition: "0.4s",
    borderRadius: "50%",
  };

  /* ------------------------ Views ------------------------ */
  const SectionHeader = ({ icon, label, status }) => {
    const { section } = getStatusStyles(status, darkMode);
    return (
      <div className={`${section} p-3 rounded flex items-center`}>
        <span className="mr-3 text-xl">{icon}</span> {label}
      </div>
    );
  };

  const AlertCard = ({ alert }) => {
    const { border, value } = getStatusStyles(alert.status, darkMode);
    return (
      <div
  className={`rounded-lg shadow p-4 border-l-4 ${cardClass(alert.status)} cursor-pointer hover:shadow-lg`}
  onClick={() => handleAlertClick(alert)}
>

        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-lg">{alert.name}</p>
            <p className={`text-sm flex items-center mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              <span className="mr-1">🕐</span>{" "}
              {alert.lastReading === "Current Reading" ? "Current Reading" : `Last Reading: ${alert.lastReading}`}
            </p>
          </div>
          <div className="text-right">
            <div className={`${value} text-xl mb-1`}>🌡️ {alert.temp}</div>
          </div>
        </div>
      </div>
    );
  };
const CARD_STYLES = {
  "Needs Attention": {
    light: "bg-red-50 border-red-500 text-red-900",
    dark:  "bg-red-950/40 border-red-400 text-red-200",
  },
  "Warning": {
    light: "bg-yellow-50 border-yellow-400 text-yellow-900",
    dark:  "bg-yellow-950/40 border-yellow-300 text-yellow-200",
  },
  "Good": {
    light: "bg-green-50 border-green-500 text-green-900",
    dark:  "bg-green-950/40 border-green-400 text-green-200",
  },
};

const cardClass = (status) =>
  darkMode ? CARD_STYLES[status].dark : CARD_STYLES[status].light;
  const renderAlertsView = () => (
    <main className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Alerts</h2>
        <div className="flex items-center space-x-4">
          <button
            className={`px-4 py-2 rounded ${
              darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            Log out
          </button>
          <div
            className={`w-10 h-10 ${darkMode ? "bg-amber-700" : "bg-amber-600"} rounded-full flex items-center justify-center text-white text-sm font-bold`}
          >
            FA
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Needs Attention */}
        <SectionHeader icon="🚨" label="Needs Attention" status="Needs Attention" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.filter((a) => a.status === "Needs Attention").map((a, i) => (
            <AlertCard key={`na-${i}`} alert={a} />
          ))}
        </div>

        {/* Warning */}
        <SectionHeader icon="⚠️" label="Warning" status="Warning" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.filter((a) => a.status === "Warning").map((a, i) => (
            <AlertCard key={`w-${i}`} alert={a} />
          ))}
        </div>

        {/* Good */}
        <SectionHeader icon="✅" label="Good" status="Good" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.filter((a) => a.status === "Good").map((a, i) => (
            <AlertCard key={`g-${i}`} alert={a} />
          ))}
        </div>

        {/* System Alerts */}
        <div className={`${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"} p-3 rounded flex items-center`}>
          <span className="mr-3 text-xl">🛠️</span> System Alerts
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {systemAlerts.map((a, i) => (
            <div
              key={`sys-${i}`}
              className={`rounded-lg shadow p-4 border-l-4 border-gray-400 ${
                darkMode ? "bg-gray-800 text-white" : "bg-white"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{a.name}</p>
                  <p className={`text-sm flex items-center mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                    <span className="mr-1">🕐</span> Last Reading: {a.lastReading}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-2xl">{a.status === "Disconnected" ? "📡" : "🔋"}</div>
                  <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{a.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-8">
          <button
            className={`px-6 py-3 rounded-lg font-semibold text-white border ${
              darkMode ? "bg-orange-700 hover:bg-orange-800 border-orange-700" : "bg-orange-500 hover:bg-orange-600 border-orange-500"
            }`}
            onClick={handleAddAlert}
          >
            Add Alert
          </button>
        </div>
      </div>
    </main>
  );

  const renderAlertDetailView = () => (
    <main className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Alerts</h2>
        <div className="flex items-center space-x-4">
          <button
            className={`px-4 py-2 rounded ${
              darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            Log out
          </button>
          <div
            className={`w-10 h-10 ${darkMode ? "bg-amber-700" : "bg-amber-600"} rounded-full flex items-center justify-center text-white text-sm font-bold`}
          >
            FA
          </div>
        </div>
      </div>

      {selectedAlert && (
        <div className="space-y-6">
          {/* Always show the section as the selected alert's status */}
          <SectionHeader
            icon={selectedAlert.status === "Needs Attention" ? "🚨" : selectedAlert.status === "Warning" ? "⚠️" : "✅"}
            label={selectedAlert.status}
            status={selectedAlert.status}
          />

          {/* Selected card */}
          <div
            className={`rounded-lg shadow p-4 border-l-4 ${
              getStatusStyles(selectedAlert.status, darkMode).border
            } ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg">{selectedAlert.name}</p>
                <p className={`text-sm flex items-center mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  <span className="mr-1">🕐</span> Current Reading
                </p>
              </div>
              <div className="text-right">
                <div className={`${getStatusStyles(selectedAlert.status, darkMode).value} text-xl mb-1`}>
                  🌡️ {selectedAlert.temp || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Fake history card (UI only) */}
          <div
            className={`rounded-lg shadow p-6 border-2 border-blue-400 ${
              darkMode ? "bg-gray-800 text-white" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Temperature History</h3>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{selectedAlert.name}</p>
              </div>
              <select
                className={`border rounded px-3 py-1 text-sm ${
                  darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"
                }`}
              >
                <option>Show Temp</option>
              </select>
            </div>

            <div className="flex justify-center">
              <div
                className={`relative h-64 w-96 rounded border-2 ${
                  darkMode ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-300"
                }`}
              >
                {/* Y axis + labels */}
                <div className="absolute left-0 top-0 h-full w-20 flex flex-col py-4">
                  <div
                    className={`absolute left-2 top-1/2 transform -translate-y-1/2 -rotate-90 text-sm ${
                      darkMode ? "text-gray-400" : "text-gray-600"
                    } whitespace-nowrap origin-center`}
                  >
                    Temperature (Fahrenheit)
                  </div>
                  <div className="flex flex-col justify-between h-full ml-12 text-xs text-gray-400">
                    <span>60</span>
                    <span>50</span>
                    <span>40</span>
                    <span>30</span>
                    <span>20</span>
                    <span>10</span>
                    <span>0</span>
                  </div>
                </div>

                {/* Chart bg bands */}
                <div className="ml-20 mr-4 h-full relative">
                  <div className="absolute inset-0 flex flex-col pb-8">
                    <div className="flex-1 bg-red-100"></div>
                    <div className="flex-1 bg-white border-t border-b border-dashed border-red-400"></div>
                    <div className="flex-1 bg-red-100"></div>
                  </div>

                  {/* Line (static for mock) */}
                  <svg className="absolute inset-0 w-full h-full">
                    <path
                      d="M 10 120 Q 50 100 100 110 T 200 100 T 280 105"
                      stroke="#10B981"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>

                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-red-500 text-xl">⚠️</div>
                  <div className="absolute bottom-12 left-1/4 transform -translate-x-1/2 text-red-500 text-xl">⚠️</div>
                </div>

                {/* X-axis */}
                <div
                  className={`absolute bottom-2 left-20 right-4 flex justify-between text-xs ${
                    darkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  <span>6H</span>
                  <span>12H</span>
                  <span>1D</span>
                  <span>1M</span>
                  <span>1W</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details mock cards */}
          <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4">Last Reading</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Time</span>
                <span className="font-medium">Current</span>
              </div>
              <div className="flex justify-between">
                <span>Threshold</span>
                <span className="font-medium">30°F - 40°F</span>
              </div>
              <div className="flex justify-between">
                <span>Air Temperature</span>
                <span className="font-medium">{selectedAlert.temp || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Battery Level</span>
                <span className="font-medium">High</span>
              </div>
              <div className="flex justify-between">
                <span>Signal Strength</span>
                <span className="font-medium">Excellent</span>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4">Sensor Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>ID</span>
                <span className="font-medium">29220d00000000e</span>
              </div>
              <div className="flex justify-between">
                <span>Broadcast Method</span>
                <span className="font-medium">Lora</span>
              </div>
              <div className="flex justify-between">
                <span>Frequency</span>
                <span className="font-medium">US915</span>
              </div>
              <div className="flex justify-between">
                <span>Model</span>
                <span className="font-medium">SSN D05</span>
              </div>
              <div className="flex justify-between">
                <span>Firmware</span>
                <span className="font-medium">2.3.0</span>
              </div>
            </div>
          </div>

          <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
            <h3 className="text-lg font-semibold mb-4">Alert Created</h3>
            <div className="flex justify-between">
              <div>
                <span>Alert Added</span>
                <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>(Fridge Temperature)</p>
              </div>
              <span className="font-medium">July 20, 2025</span>
            </div>
          </div>

          <div className="flex justify-start">
            <button
              className={`px-6 py-2 rounded ${
                darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-300 text-gray-800 hover:bg-gray-400"
              }`}
              onClick={handleBack}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </main>
  );

  const renderAddAlertView = () => (
    <main className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Add Alert</h2>
        <div className="flex items-center space-x-4">
          <button
            className={`px-4 py-2 rounded ${
              darkMode ? "bg-red-700 text-white hover:bg-red-800" : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            Log out
          </button>
          <div
            className={`w-10 h-10 ${darkMode ? "bg-amber-700" : "bg-amber-600"} rounded-full flex items-center justify-center text-white text-sm font-bold`}
          >
            FA
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h3 className="text-xl font-semibold mb-2">Create New Alert</h3>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-6`}>
            Set up alerts for your sensors to receive push notifications, text messages, or emails whenever the
            conditions you specify are met.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Alert Name:</label>
            <input
              type="text"
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"}`}
              placeholder=""
            />
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h4 className="text-lg font-semibold mb-2">Trigger</h4>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-6`}>
            If the temperature goes over the <strong>maximum threshold</strong> or below the{" "}
            <strong>minimum threshold</strong>, your selected contacts will be alerted.
          </p>

          <div className="flex justify-center">
            <div
              className={`flex h-48 w-96 relative ${
                darkMode ? "bg-gray-700" : "bg-gray-50"
              } rounded border-2 ${darkMode ? "border-gray-600" : "border-gray-300"}`}
            >
              {/* Y axis */}
              <div className="w-16 flex flex-col justify-between py-4 relative">
                <div
                  className={`absolute -left-8 top-1/2 transform -translate-x-1/2 -translate-y-1/2 -rotate-90 text-sm ${
                    darkMode ? "text-gray-400" : "text-gray-600"
                  } whitespace-nowrap`}
                >
                  Temperature (Fahrenheit)
                </div>
                <div className="flex flex-col justify-between h-full">
                  {[60, 50, 40, 30, 20, 10, 0].map((val) => (
                    <div key={val} className="flex items-center justify-end pr-2">
                      <span className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-400"}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bands + handles (visual only) */}
              <div className="w-64 relative">
                <div className="absolute inset-0 flex flex-col">
                  <div className="flex-1 bg-red-100"></div>
                  <div className="flex-1 bg-white border-t border-b border-dashed border-red-400"></div>
                  <div className="flex-1 bg-red-100"></div>
                </div>

                <div className="absolute inset-x-0 top-1/3 border-t-2 border-dashed border-red-500"></div>
                <div className="absolute inset-x-0 top-2/3 border-t-2 border-dashed border-red-500"></div>

                <div className="absolute top-1/6 left-1/2 transform -translate-x-1/2 text-red-500 text-xl">⚠️</div>
                <div className="absolute top-5/6 left-1/2 transform -translate-x-1/2 text-red-500 text-xl">⚠️</div>

                <div
                  className={`absolute right-2 top-1/3 transform -translate-y-1/2 w-4 h-3 rounded cursor-pointer ${
                    darkMode ? "bg-gray-300" : "bg-black"
                  }`}
                />
                <div
                  className={`absolute right-2 top-2/3 transform -translate-y-1/2 w-4 h-3 rounded cursor-pointer ${
                    darkMode ? "bg-gray-300" : "bg-black"
                  }`}
                />
              </div>

              <div className="flex flex-col justify-center ml-6 space-y-8">
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"} leading-tight`}>
                  Move the handle to
                  <br />
                  adjust the Maximum
                  <br />
                  Threshold
                </div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"} leading-tight`}>
                  Move the handle to
                  <br />
                  adjust the Minimum
                  <br />
                  Threshold
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h4 className="text-lg font-semibold mb-2">Choose Sensor</h4>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-4`}>
            Which sensor should this alert be assigned to?
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Sensor Name</label>
            <select
              value={sensorName}
              onChange={(e) => setSensorName(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${
                darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"
              }`}
            >
              <option>8 Active Sensors</option>
            </select>
          </div>
        </div>

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h4 className="text-lg font-semibold mb-2">Alert Settings</h4>
          <p className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"} mb-4`}>
            Configure your alert notifications and messages.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Alert Message</label>
            <input
              type="text"
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              className={`border rounded px-3 py-2 w-full ${
                darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"
              }`}
              placeholder="Ex My (Sensor Name): Temperature above 50°F"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <div
                className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer mr-4 ${
                  sendEmail ? "bg-orange-500" : darkMode ? "bg-gray-600" : "bg-gray-300"
                }`}
                onClick={() => setSendEmail(!sendEmail)}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    sendEmail ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </div>
              <div>
                <div className="font-medium">Send email alert</div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Send an Email when this alert is triggered to selected contacts
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <div
                className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer mr-4 ${
                  sendSMS ? "bg-orange-500" : darkMode ? "bg-gray-600" : "bg-gray-300"
                }`}
                onClick={() => setSendSMS(!sendSMS)}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    sendSMS ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </div>
              <div>
                <div className="font-medium">Send SMS alerts</div>
                <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Send an SMS when this alert is triggered to selected contacts
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dark mode toggle (visual) */}
        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <h4 className="text-lg font-semibold mb-2">Mode</h4>
          <label style={sliderStyle} className="relative inline-block cursor-pointer">
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} className="absolute opacity-0 w-0 h-0" />
            <span style={sliderBeforeStyle} className="absolute cursor-pointer" />
          </label>
        </div>

        <div className="flex justify-between items-center pt-6">
          <button
            className={`px-6 py-3 rounded-lg ${
              darkMode ? "bg-gray-600 text-white hover:bg-gray-700" : "bg-gray-300 text-gray-800 hover:bg-gray-400"
            }`}
            onClick={handleBack}
          >
            Cancel
          </button>
          <button
            className={`px-6 py-3 rounded-lg font-semibold text-white border ${
              darkMode ? "bg-orange-700 hover:bg-orange-800 border-orange-700" : "bg-orange-500 hover:bg-orange-600 border-orange-500"
            }`}
            onClick={() => {
              console.log("Alert added:", { alertName, sensorName, alertMessage, sendEmail, sendSMS });
              setCurrentView("alerts");
            }}
          >
            Create Alert
          </button>
        </div>
      </div>
    </main>
  );

  /* ------------------------ Render ------------------------ */
  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen ${darkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-800"}`}>
        <Sidebar darkMode={darkMode} activeKey="alerts" />
        {currentView === "alerts" && renderAlertsView()}
        {currentView === "alertDetail" && renderAlertDetailView()}
        {currentView === "addAlert" && renderAddAlertView()}
      </div>
    </ErrorBoundary>
  );
}

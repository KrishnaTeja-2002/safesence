"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { useDarkMode } from "../DarkModeContext";
import apiClient from "../lib/apiClient";

// UI <-> DB helpers
const TEMP_UI_TO_DB = { Fahrenheit: "F", Celsius: "C" };
const TEMP_DB_TO_UI = { F: "Fahrenheit", C: "Celsius" };

// keep DB in IANA; show a few common abbreviations in UI
const TZ_OPTIONS = [
  { label: "AKDT", iana: "America/Anchorage" },
  { label: "EDT", iana: "America/New_York" },
  { label: "PDT", iana: "America/Los_Angeles" },
];
const tzLabelToIana = Object.fromEntries(TZ_OPTIONS.map((o) => [o.label, o.iana]));
const tzIanaToLabel = Object.fromEntries(TZ_OPTIONS.map((o) => [o.iana, o.label]));

export default function Account() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [preferences, setPreferences] = useState({
    tempScale: "Fahrenheit",
    dashboard: ["Temperature Monitoring System", "Sensors", "Users", "Alerts", "Notifications"],
    timeZone: "AKDT",
    darkMode: false,
    username: "",
  });
  const [savedPreferences, setSavedPreferences] = useState(null);
  const [currentTzIana, setCurrentTzIana] = useState(null);

  // Session + load prefs
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setCurrentTzIana(tz);
    } catch {}
    (async () => {
      setLoading(true);
      setError("");

      // Check authentication
      const token = localStorage.getItem('auth-token');
      if (!token) {
        setLoading(false);
        router.push("/login");
        return;
      }

      const response = await fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        localStorage.removeItem('auth-token');
        setLoading(false);
        router.push("/login");
        return;
      }

      const { user } = await response.json();
      const uid = user.id;
      const email = user.email || "";
      setUserId(uid);
      setUserEmail(email);

      // fetch prefs using API
      const row = await apiClient.getUserPreferences();

      // map DB -> UI
      const ui = {
        tempScale: TEMP_DB_TO_UI[row.tempScale] ?? "Fahrenheit",
        dashboard: [
          ...(row.showTemp ? ["Temperature Monitoring System"] : []),
          ...(row.showHumidity ? ["Humidity Monitoring System"] : []),
          ...(row.showSensors ? ["Sensors"] : []),
          ...(row.showUsers ? ["Users"] : []),
          ...(row.showAlerts ? ["Alerts"] : []),
          ...(row.showNotifications ? ["Notifications"] : []),
        ],
        timeZone: tzIanaToLabel[row.timeZone] ?? "AKDT",
        darkMode: !!row.darkMode,
        username: row.username || (user?.email ? user.email.split("@")[0] : ""),
      };
      setPreferences(ui);

      // sync theme
      if (ui.darkMode !== darkMode) toggleDarkMode();

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleDashboardChange = (e) => {
    const { value, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      dashboard: checked ? [...prev.dashboard, value] : prev.dashboard.filter((item) => item !== value),
    }));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");

    try {
      const row = {
        user_id: userId,
        temp_scale: "F", // Always F for now
        show_temp: preferences.dashboard.includes("Temperature Monitoring System"),
        show_humidity: preferences.dashboard.includes("Humidity Monitoring System"),
        show_sensors: preferences.dashboard.includes("Sensors"),
        show_users: preferences.dashboard.includes("Users"),
        show_alerts: preferences.dashboard.includes("Alerts"),
        show_notifications: preferences.dashboard.includes("Notifications"),
        time_zone: tzLabelToIana[preferences.timeZone] ?? "America/Anchorage",
        dark_mode: !!preferences.darkMode,
        username: (preferences.username || "").trim() || null,
      };

      await apiClient.updateUserPreferences(row);

      // sync global theme
      if (preferences.darkMode !== darkMode) toggleDarkMode();

      setSavedPreferences({ ...preferences });
    } catch (err) {
      setError(err.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSaved = () => setSavedPreferences(null);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('auth-token');
      router.push("/login");
    } catch (error) {
      setError("Failed to logout: " + error.message);
    }
  };

  const getUserInitials = (email) => {
    if (!email) return "U";
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  // slider styles (unchanged from your UI)
  const sliderStyle = {
    position: "relative",
    display: "inline-block",
    width: "60px",
    height: "34px",
    backgroundColor: "#4a4a4a",
    borderRadius: "34px",
  };
  const sliderBeforeStyle = {
    position: "absolute",
    content: '""',
    height: "26px",
    width: "26px",
    left: preferences.darkMode ? "calc(100% - 30px)" : "4px",
    bottom: "4px",
    backgroundColor: "#fff",
    transition: "0.4s",
    borderRadius: "50%",
  };
  const savedSliderBeforeStyle = {
    position: "absolute",
    content: '""',
    height: "26px",
    width: "26px",
    left: savedPreferences?.darkMode ? "calc(100% - 30px)" : "4px",
    bottom: "4px",
    backgroundColor: "#fff",
    transition: "0.4s",
    borderRadius: "50%",
  };

  const pageShellClass = `flex min-h-screen ${darkMode ? "bg-slate-900 text-white" : "bg-gradient-to-br from-slate-50 to-blue-50 text-slate-800"}`;

  const DASH_CHECKS = [
    "Temperature Monitoring System",
    "Humidity Monitoring System",
    "Sensors",
    "Users",
    "Alerts",
    "Notifications",
  ];

  return (
    <div className={pageShellClass}>
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Account Settings</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`text-sm font-medium ${darkMode ? "text-gray-200" : "text-gray-700"}`}>
                  {preferences.username || userEmail.split("@")[0] || "User"}
                </div>
                <div className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  {userEmail}
                </div>
              </div>
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {getUserInitials(userEmail)}
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-400 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-slate-800 text-white border border-slate-700" : "bg-white shadow-2xl border border-slate-100"}`}>
          <h3 className="text-xl font-semibold mb-6">Preferences</h3>

          {loading ? (
            <div className="py-10 text-center opacity-80">Loading…</div>
          ) : (
            <div className="space-y-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium mb-2">User name</label>
                <input
                  type="text"
                  name="username"
                  value={preferences.username}
                  onChange={handleChange}
                  placeholder="Enter a display name"
                  className={`border rounded px-3 py-2 w-full ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white"}`}
                />
              </div>
              {/* Temp Scale - Fixed to Fahrenheit only */}
              <div>
                <label className="block text-sm font-medium mb-2">Temp Scale</label>
                <select
                  name="tempScale"
                  value="Fahrenheit"
                  disabled
                  className={`border rounded px-2 py-1 w-full ${
                    darkMode ? "bg-gray-700 text-white border-gray-600 opacity-60" : "bg-gray-100 opacity-60"
                  }`}
                >
                  <option>Fahrenheit</option>
                </select>
                <p className={`text-xs mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Temperature display is currently fixed to Fahrenheit
                </p>
              </div>

              {/* Dashboard toggles */}
              <div>
                <label className="block text-sm font-medium mb-2">Dashboard</label>
                <p className={`text-sm mb-2 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Select which data points (if supported by your sensor) to show on the dashboard
                </p>
                {DASH_CHECKS.map((item) => (
                  <div key={item} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id={item}
                      value={item}
                      checked={preferences.dashboard.includes(item)}
                      onChange={handleDashboardChange}
                      className="mr-2"
                    />
                    <label htmlFor={item}>{item}</label>
                  </div>
                ))}
              </div>

              {/* Time Zone */}
              <div>
                <label className="block text-sm font-medium mb-2">Time Zone</label>
                <select
                  name="timeZone"
                  value={preferences.timeZone}
                  onChange={handleChange}
                  className={`border rounded px-2 py-1 w-full ${
                    darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white"
                  }`}
                >
                  {TZ_OPTIONS.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label}{currentTzIana && currentTzIana === t.iana ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dark mode */}
              <div>
                <label className="block text-sm font-medium mb-2">Mode</label>
                <label style={sliderStyle} className="relative inline-block cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.darkMode}
                    onChange={() => {
                      toggleDarkMode();
                      setPreferences((prev) => ({ ...prev, darkMode: !prev.darkMode }));
                    }}
                    className="absolute opacity-0 w-0 h-0"
                  />
                  <span style={sliderBeforeStyle} className="absolute cursor-pointer"></span>
                </label>
              </div>

              <button
                className={`mt-6 px-4 py-2 rounded text-white border ${
                  darkMode
                    ? "bg-orange-700 hover:bg-orange-800 border-orange-700"
                    : "bg-orange-500 hover:bg-orange-600 border-orange-500"
                }`}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div 
              className={`rounded-lg p-6 max-w-md w-full mx-4 ${darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-800"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Confirm Logout</h3>
              <p className={`mb-6 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>

                Are you sure you want to log out? You&apos;ll need to sign in again to access your account.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className={`px-4 py-2 rounded border ${
                    darkMode
                      ? "bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                      : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

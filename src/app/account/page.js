"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../../components/Sidebar";
import { useDarkMode } from "../DarkModeContext";
import apiClient from "../lib/apiClient";

// Supabase client (env first, then project fallback)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kwaylmatpkcajsctujor.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M"
);

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

      const { data: sessionData, error: sErr } = await supabase.auth.getSession();
      if (sErr) {
        setError("Failed to verify session: " + sErr.message);
        setLoading(false);
        router.push("/login");
        return;
      }
      const session = sessionData?.session;
      if (!session) {
        setLoading(false);
        router.push("/login");
        return;
      }
      const uid = session.user.id;
      setUserId(uid);

      // fetch prefs using API
      const row = await apiClient.getUserPreferences();

      // map DB -> UI
      const ui = {
        tempScale: TEMP_DB_TO_UI[row.temp_scale] ?? "Fahrenheit",
        dashboard: [
          ...(row.show_temp ? ["Temperature Monitoring System"] : []),
          ...(row.show_humidity ? ["Humidity Monitoring System"] : []),
          ...(row.show_sensors ? ["Sensors"] : []),
          ...(row.show_users ? ["Users"] : []),
          ...(row.show_alerts ? ["Alerts"] : []),
          ...(row.show_notifications ? ["Notifications"] : []),
        ],
        timeZone: tzIanaToLabel[row.time_zone] ?? "AKDT",
        darkMode: !!row.dark_mode,
        username: row.username || (session.user?.email ? session.user.email.split("@")[0] : ""),
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
        temp_scale: TEMP_UI_TO_DB[preferences.tempScale] ?? "F",
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

  const pageShellClass = `flex min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"}`;

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
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Log out
            </button>
            <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              FA
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-400 bg-red-50 px-4 py-3 text-red-700">{error}</div>
        )}

        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
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
              {/* Temp Scale */}
              <div>
                <label className="block text-sm font-medium mb-2">Temp Scale</label>
                <select
                  name="tempScale"
                  value={preferences.tempScale}
                  onChange={handleChange}
                  className={`border rounded px-2 py-1 w-full ${
                    darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white"
                  }`}
                >
                  <option>Fahrenheit</option>
                  <option>Celsius</option>
                </select>
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

      
      </main>
    </div>
  );
}

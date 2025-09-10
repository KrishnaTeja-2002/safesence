"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Sidebar from "../../components/Sidebar";
import { useDarkMode } from "../DarkModeContext";
import apiClient from "../lib/apiClient";
import { getStatusDisplay, isAlertStatus, isOfflineStatus } from "../lib/statusUtils";

/* ===== Supabase client ===== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kwaylmatpkcajsctujor.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YXlsbWF0cGtjYWpzY3R1am9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNDAwMjQsImV4cCI6MjA3MDgxNjAyNH0.-ZICiwnXTGWgPNTMYvirIJ3rP7nQ9tIRC1ZwJBZM96M"
);

/* ===== Simple helpers ===== */
const fToC = (v) => (v == null ? null : (v - 32) * 5 / 9);
const cToF = (v) => (v == null ? null : v * 9 / 5 + 32);

// Axis configs
const axisConfigTemp = (unit) =>
  unit === "F"
    ? { min: 0, max: 100, step: 10, title: "🌡️ Temperature (0–100°F)", tickFmt: (n) => `${n}°F` }
    : { min: -20, max: 40, step: 10, title: "🌡️ Temperature (-20–40°C)", tickFmt: (n) => `${n}°C` };
const axisConfigHum = () => ({ min: 0, max: 100, step: 10, title: "💧 Humidity (0–100% RH)", tickFmt: (n) => `${n}%` });

const fmtDate = (d, tz, withTime = true) => {
  const opts = withTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz }
    : { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz };
  try {
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(d));
  } catch {
    return new Date(d).toLocaleString();
  }
};

// Respect user prefs when filtering what to show
const visibleItems = (items, selectedType, selectedRole, prefs) =>
  items.filter((i) => {
    // Type filtering
    if (selectedType === "temperature") {
      if (!prefs.showTemp || i.kind !== "temperature") return false;
    } else if (selectedType === "humidity") {
      if (!prefs.showHumidity || i.kind !== "humidity") return false;
    } else {
      // ALL type
      if (i.kind === "temperature" && !prefs.showTemp) return false;
      if (i.kind === "humidity" && !prefs.showHumidity) return false;
    }
    
    // Role filtering
    if (selectedRole === "owned") {
      return i.access_role === "owner";
    } else if (selectedRole === "admin") {
      return i.access_role === "admin";
    } else if (selectedRole === "viewer") {
      return i.access_role === "viewer";
    }
    // ALL role - no additional filtering
    
    return true;
  });

export default function Dashboard() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [username, setUsername] = useState("User");
  const [error, setError] = useState("");

  // Mounted timestamp for hydration-safe "Last updated" display
  const [nowTs, setNowTs] = useState(null);
  useEffect(() => {
    setNowTs(Date.now());
  }, []);

  // Preferences (from user_preferences)
  const [prefs, setPrefs] = useState({
    unit: "F", // 'F' | 'C' (temperature display)
    tz: "America/Anchorage",
    showTemp: true,
    showHumidity: true,
    showSensors: true,
    showUsers: true,
    showAlerts: true,
  });

  // Data
  const [data, setData] = useState({
    notifications: 0,
    users: 0,
    items: [], // unified (temperature + humidity)
    sensors: { total: 0, error: 0, warning: 0, success: 0, disconnected: 0 },
    notificationsList: [],
  });

  // No thresholds state needed - using database status directly

  // Filter: 'all' | 'temperature' | 'humidity'
  const [selectedType, setSelectedType] = useState("all");
  
  // Role filter: 'all' | 'owned' | 'admin' | 'viewer'
  const [selectedRole, setSelectedRole] = useState("all");

  // Notifications popup
  const [showNotifications, setShowNotifications] = useState(false);
  const popupRef = useRef(null);
  const notificationCardRef = useRef(null);

  /* ===== Session + preferences ===== */
  useEffect(() => {
    (async () => {
      try {
        const { data: s, error: e } = await supabase.auth.getSession();
        if (e) throw e;
        const session = s?.session;
        if (!session) return router.push("/login");

        const user = session.user;
        setUsername(user?.user_metadata?.username || user?.email?.split("@")[0] || "User");

        const { data: row } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (row) {
          const next = {
            unit: row.temp_scale || "F",
            tz: row.time_zone || "America/Anchorage",
            showTemp: !!row.show_temp,
            showHumidity: !!row.show_humidity,
            showSensors: !!row.show_sensors,
            showUsers: !!row.show_users,
            showAlerts: !!row.show_alerts || !!row.show_notifications,
          };
          setPrefs(next);
          if (!!row.dark_mode !== darkMode) toggleDarkMode();
          if (row.username) {
            setUsername(String(row.username));
          }
        }
      } catch (err) {
        setError("Failed to verify session: " + (err?.message || String(err)));
        router.push("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildNotifications = (items, tz) => {
    const list = [];
    let id = 1;
    items.forEach((it) => {
      if (isAlertStatus(it.status)) {
        const statusDisplay = getStatusDisplay(it.status);
        list.push({
          id: id++,
          title: `${statusDisplay.label} (${it.name})`,
          description: it.kind === "humidity" ? `Humidity: ${it.displayValue}` : `Temperature: ${it.displayValue}`,
          date: fmtDate(nowTs || Date.now(), tz, false),
          type: it.status === "alert" ? "error" : "warning",
          sensorId: it.sensor_id,
        });
      }
    });
    return list;
  };

  /* ===== Fetch sensors + latest readings ===== */
  useEffect(() => {
    (async () => {
      try {
        const sensorRows = await apiClient.getSensors();

        // No need to store thresholds - using database status directly

        // Use sensors.latest_temp directly; no additional latest lookup required

        const items = (sensorRows || [])
          .map((r) => {
            const sType = r.sensor_type || "sensor"; // 'sensor'|'temperature'|'humidity'
            const kind = sType === "humidity" ? "humidity" : "temperature";
            const name = r.sensor_name || r.sensor_id;

            const raw = r.latest_temp != null ? Number(r.latest_temp) : null;

            let value = null;
            let displayValue = "--";
            let status = "unknown"; // Default to unknown instead of "Good"
            let color = "bg-gray-500"; // Default to gray instead of green
            let unit = prefs.unit;

                         if (kind === "temperature") {
               const sensorUnit = (r.metric || "F").toUpperCase() === "C" ? "C" : "F";
               // Convert to °F for display consistency
               const valueInF = raw != null ? (sensorUnit === "C" ? cToF(raw) : raw) : null;
               
               // Use status from database instead of calculating
               status = r.status || 'unknown';

               
               // Convert to user's preferred unit for display only
               value = valueInF != null ? (prefs.unit === "C" ? fToC(valueInF) : valueInF) : null;
               displayValue = value != null ? `${value.toFixed(1)}°${prefs.unit}` : `--°${prefs.unit}`;
               
               // Store sensor unit for realtime updates
               unit = sensorUnit;
                          } else {
               unit = "%";
               // Humidity values are already in the correct unit (%)
               value = raw != null ? Number(raw) : null;
               // Use status from database instead of calculating
               status = r.status || 'unknown';

               displayValue = value != null ? `${value.toFixed(1)}%` : "--%";
             }

                         // Update color based on status from database
             const statusDisplay = getStatusDisplay(status);
             if (status === "alert") color = "bg-red-500";
             else if (status === "warning") color = "bg-[#FF9866]";
             else if (status === "offline") color = "bg-gray-500";
             else if (status === "unknown") color = "bg-gray-500";
             else color = "bg-[#98CC37]"; // ok status

            return {
               sensor_id: r.sensor_id,
               sensor_type: sType,
               kind, // 'temperature' | 'humidity'
               name,
               unit,
               value,
               displayValue,
               status,
               color,
               approx_time: r.approx_time,
               lastFetchedTime: r.last_fetched_time,
               lastUpdated: r.updated_at || new Date().toISOString(),
               access_role: r.access_role || 'owner',
               // No thresholds needed - using database status
             };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        // Apply visibility for the selected type, role, and prefs
        const filtered = visibleItems(items, selectedType, selectedRole, prefs);

        const sensorsKPI = {
          total: filtered.length,
          error: filtered.filter((t) => t.status === "alert").length,
          warning: filtered.filter((t) => t.status === "warning").length,
          success: filtered.filter((t) => t.status === "ok").length,
          unconfigured: filtered.filter((t) => t.status === "offline" || t.status === "unknown").length,
          disconnected: filtered.filter((t) => t.value == null).length,
        };

        let usersCount = 0;
        if (prefs.showUsers) {
          const { count } = await supabase.from("team_members").select("id", { count: "exact", head: true });
          if (typeof count === "number") usersCount = count;
        }

        const notificationsList = buildNotifications(filtered, prefs.tz);

        setData({
          notifications: notificationsList.length,
          users: usersCount,
          items, // keep full set; we filter at render time too
          sensors: sensorsKPI,
          notificationsList,
        });
      } catch (err) {
        setError("Failed to fetch sensor data: " + (err?.message || String(err)));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.unit, prefs.showUsers, prefs.tz, prefs.showTemp, prefs.showHumidity, selectedType, selectedRole]);

  /* ===== Realtime updates: sensors table ===== */
  useEffect(() => {
    const ch = supabase
      .channel("sensors-updates")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sensors" }, (payload) => {
        const r = payload.new || {};
        if (!r.sensor_id) return;

        // No need to update thresholds - using database status directly

        setData((prev) => {
          const items = [...prev.items];
          const idx = items.findIndex((p) => p.sensor_id === r.sensor_id);
          if (idx < 0) return prev;

          const item = items[idx];
          let value = null;
          let status = "unknown"; // Default to unknown
          let displayValue = item.displayValue;

          if (item.kind === "temperature") {
            const sensorUnit = (r.metric || item.unit || "F").toUpperCase() === "C" ? "C" : "F";
            const raw = r.latest_temp != null ? Number(r.latest_temp) : null;
            const valueInF = raw != null ? (sensorUnit === "C" ? cToF(raw) : raw) : null;
            status = r.status || 'unknown';
            value = valueInF != null ? (prefs.unit === "C" ? fToC(valueInF) : valueInF) : null;
            displayValue = value != null ? `${value.toFixed(1)}°${prefs.unit}` : `--°${prefs.unit}`;
          } else {
            const raw = r.latest_temp != null ? Number(r.latest_temp) : null;
            value = raw != null ? raw : null;
            status = r.status || 'unknown';
            displayValue = value != null ? `${value.toFixed(1)}%` : "--%";
          }

          let color = "bg-[#98CC37]";
          if (status === "alert") color = "bg-red-500";
          else if (status === "warning") color = "bg-[#FF9866]";
          else if (status === "offline") color = "bg-gray-500";
          else if (status === "unknown") color = "bg-gray-500";

          items[idx] = {
            ...item,
            value,
            displayValue,
            status,
            color,
            lastFetchedTime: r.last_fetched_time ?? item.lastFetchedTime,
            lastUpdated: r.updated_at || item.lastUpdated || new Date().toISOString(),
            // No thresholds needed - using database status
          };

          const filtered = visibleItems(items, selectedType, selectedRole, prefs);
          const sensorsKPI = {
            total: filtered.length,
            error: filtered.filter((t) => t.status === "alert").length,
            warning: filtered.filter((t) => t.status === "warning").length,
            success: filtered.filter((t) => t.status === "ok").length,
            unconfigured: filtered.filter((t) => t.status === "offline" || t.status === "unknown").length,
            disconnected: filtered.filter((t) => t.value == null).length,
          };
          const notificationsList = buildNotifications(filtered, prefs.tz);
          return { ...prev, items, sensors: sensorsKPI, notifications: notificationsList.length, notificationsList };
        });
      })
      .subscribe();

    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.tz, prefs.showTemp, prefs.showHumidity, selectedType, selectedRole]);

  /* ===== UI helpers ===== */
  useEffect(() => {
    const handler = (e) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        notificationCardRef.current &&
        !notificationCardRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getInitials = (name) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // Axes
  const axisTemp = axisConfigTemp(prefs.unit);
  const axisHum = axisConfigHum();

  // Which items are visible given filter + prefs
  const itemsVisible = visibleItems(data.items, selectedType, selectedRole, prefs);

  // In "all", decide which axes to show based on what's visible
  const hasVisibleTemp = selectedType === "all" && itemsVisible.some((i) => i.kind === "temperature");
  const hasVisibleHum = selectedType === "all" && itemsVisible.some((i) => i.kind === "humidity");

  const leftAxis =
    selectedType === "all"
      ? hasVisibleTemp
        ? axisTemp
        : axisHum
      : selectedType === "humidity"
      ? axisHum
      : axisTemp;

  const rightAxis =
    selectedType === "all" && hasVisibleTemp && hasVisibleHum
      ? leftAxis === axisTemp
        ? axisHum
        : axisTemp
      : null;

  const H = 320;
  const ticks = (ax) => {
    const arr = [];
    for (let v = ax.max; v >= ax.min; v -= ax.step) arr.push(ax.tickFmt(v));
    return arr;
  };
  const toHeight = (item) => {
    if (item.value == null) return 0;
    const ax = item.kind === "humidity" ? axisHum : axisTemp;
    const clamped = Math.max(ax.min, Math.min(item.value, ax.max));
    return ((clamped - ax.min) / (ax.max - ax.min)) * H;
  };



  // Items to plot (respect prefs in ALL)
  const chartItems = itemsVisible;

     return (
     <div className={`flex min-h-screen ${darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-800"}`}>
               <style jsx>{`
          @keyframes customBounce {
            0%, 50%, 100% {
              transform: translateX(-50%) translateY(0);
            }
            25%, 75% {
              transform: translateX(-50%) translateY(-8px);
            }
          }
        `}</style>
       <Sidebar />
       <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>Hi {username}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ${darkMode ? "bg-red-600 hover:bg-red-700" : ""}`}
            >
              Log out
            </button>
            <div className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold ${darkMode ? "bg-amber-700" : ""}`}>
              {getInitials(username)}
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {prefs.showAlerts && (
            <div className={`rounded-lg p-6 shadow text-center relative ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
              <div className="cursor-pointer" onClick={() => setShowNotifications(!showNotifications)} ref={notificationCardRef}>
                                 <div className={`flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4 mx-auto ${darkMode ? "bg-green-800" : ""}`}>
                   <span className="text-2xl">🔔</span>
                 </div>
                <p className={`text-gray-600 text-sm mb-1 ${darkMode ? "text-gray-300" : ""}`}>Notifications</p>
                <p className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? "text-white" : ""}`}>{data.notifications}</p>
                <div className="flex items-center justify-center">
                  <div className={`w-2 h-2 bg-red-500 rounded-full mr-2 ${darkMode ? "bg-red-400" : ""}`}></div>
                  <span className={`text-red-500 text-sm ${darkMode ? "text-red-400" : ""}`}>{data.notifications > 0 ? "Unread" : "All Clear"}</span>
                </div>
              </div>
                             {showNotifications && (
                 <div ref={popupRef} className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-lg shadow-lg z-50 border border-gray-200 ${darkMode ? "bg-gray-800 border-gray-700 text-white" : ""}`}>
                  <div className="p-4">
                    <h4 className={`font-semibold text-gray-800 mb-3 ${darkMode ? "text-white" : ""}`}>Notifications</h4>
                    {data.notificationsList.length ? (
                      data.notificationsList.map((n) => (
                        <div key={n.id} className={`flex items-start justify-between p-3 mb-2 bg-gray-50 rounded-md ${darkMode ? "bg-gray-700 text-white" : ""} ${n.type === "error" ? "border-l-4 border-red-500" : "border-l-4 border-yellow-500"}`}>
                          <div className="flex-1">
                            <p className={`text-gray-700 text-sm font-medium ${darkMode ? "text-white" : ""}`}>{n.title}</p>
                            {n.description && <p className={`text-gray-600 text-xs ${darkMode ? "text-gray-300" : ""}`}>{n.description}</p>}
                            <p className={`text-gray-500 text-xs ${darkMode ? "text-gray-400" : ""}`}>{n.date}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rest = data.notificationsList.filter((x) => x.id !== n.id);
                              setData((prev) => ({ ...prev, notificationsList: rest, notifications: rest.length }));
                            }}
                            className={`text-gray-400 hover:text-gray-600 ml-3 ${darkMode ? "text-gray-300 hover:text-gray-200" : ""}`}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className={`text-gray-500 text-sm text-center ${darkMode ? "text-gray-300" : ""}`}>No new notifications.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {prefs.showSensors && (
            <div className={`rounded-lg p-6 shadow text-center ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
                             <div className={`flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4 mx-auto ${darkMode ? "bg-green-800" : ""}`}>
                 <span className="text-2xl">📶</span>
               </div>
              <p className={`text-gray-600 text-sm mb-1 ${darkMode ? "text-gray-300" : ""}`}>Sensors</p>
              {(() => {
                const kpiItems = itemsVisible;
                return (
                  <>
                    <p className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? "text-white" : ""}`}>{kpiItems.length}</p>
                    <div className="flex items-center justify-center space-x-3 text-sm">
                      <div className="flex items-center">
                        <div className={`w-2 h-2 bg-red-500 rounded-full mr-1 ${darkMode ? "bg-red-400" : ""}`}></div>
                        <span className={`text-red-500 font-medium ${darkMode ? "text-red-400" : ""}`}>
                          {kpiItems.filter((t) => t.status === "alert").length}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 bg-yellow-500 rounded-full mr-1 ${darkMode ? "bg-yellow-400" : ""}`}></div>
                        <span className={`text-yellow-500 font-medium ${darkMode ? "text-yellow-400" : ""}`}>
                          {kpiItems.filter((t) => t.status === "warning").length}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 bg-green-500 rounded-full mr-1 ${darkMode ? "bg-green-400" : ""}`}></div>
                        <span className={`text-green-500 font-medium ${darkMode ? "text-green-400" : ""}`}>
                          {kpiItems.filter((t) => t.status === "ok").length}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-2 h-2 bg-gray-500 rounded-full mr-1 ${darkMode ? "bg-gray-400" : ""}`}></div>
                        <span className={`text-gray-500 font-medium ${darkMode ? "text-gray-400" : ""}`}>
                          {kpiItems.filter((t) => t.status === "offline" || t.status === "unknown").length}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className={`mr-1 text-xs ${darkMode ? "text-gray-300" : "text-gray-500"}`}>✖</span>
                        <span className={`${darkMode ? "text-gray-300" : "text-gray-500"}`}>
                          {kpiItems.filter((t) => t.value == null).length}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {prefs.showUsers && (
            <div className={`rounded-lg p-6 shadow text-center ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
                             <div className={`flex items-center justify-center w-16 h-16 bg-green-50 rounded-full mb-4 mx-auto ${darkMode ? "bg-green-800" : ""}`}>
                 <span className="text-2xl">👥</span>
               </div>
              <p className={`text-gray-600 text-sm mb-1 ${darkMode ? "text-gray-300" : ""}`}>Users</p>
              <p className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? "text-white" : ""}`}>{data.users}</p>
            </div>
          )}
        </div>

        {/* Chart + Table card */}
        <div className={`rounded-lg shadow p-6 ${darkMode ? "bg-gray-800 text-white" : "bg-white"}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className={`text-lg font-semibold ${darkMode ? "text-white" : "text-gray-900"}`}>
              {selectedType === "all"
                ? "All Sensors (respects Preferences)"
                : selectedType === "humidity"
                ? axisHum.title
                : axisTemp.title}
            </h3>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">Last updated: <span suppressHydrationWarning>{nowTs ? fmtDate(nowTs, prefs.tz, true) : "—"}</span></div>
              <div className="flex items-center gap-2">
                <label className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>Filter:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={`border rounded px-2 py-1 ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white"}`}
                >
                  <option value="all">All</option>
                  {prefs.showTemp && <option value="temperature">Temperature</option>}
                  {prefs.showHumidity && <option value="humidity">Humidity</option>}
                </select>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className={`border rounded px-2 py-1 ${darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white"}`}
                >
                  <option value="all">All</option>
                  <option value="owned">Owned</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chart area (grid/axes always render) */}
          <div className="relative">
            <div className="flex items-start">
              {/* Left Y-axis */}
              <div className="flex flex-col w-16 mr-3">
                <div className="h-6"></div>
                <div className="relative h-80">
                  <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-600 items-end pr-3 font-medium">
                    {ticks(leftAxis).map((t, i) => (
                      <span key={i} className="transform -translate-y-1/2 bg-white px-1 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main plot */}
              <div className="flex-1 relative">
                {/* Grid */}
                <div className="absolute inset-0 h-80">
                  <div className="h-full flex flex-col justify-between">
                    {[...Array(11)].map((_, i) => (
                      <div
                        key={i}
                        className={`border-t w-full ${
                          i === 0 || i === 10 ? "border-gray-400 border-t-2" : i === 5 ? "border-gray-300 border-t-2" : "border-gray-200"
                        } ${darkMode ? "border-gray-600" : ""}`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gray-400 ${darkMode ? "bg-gray-500" : ""}`}></div>
                    <div className={`absolute right-0 top-0 bottom-0 w-1 bg-gray-400 ${darkMode ? "bg-gray-500" : ""}`}></div>
                  </div>
                </div>

                

                {/* Bars (or empty) */}
                <div className="relative h-80">
                  <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end h-full px-6">
                    {chartItems.length === 0 ? (
                      <div className="text-center w-full text-sm text-gray-500 mt-20 opacity-75">No sensors to display.</div>
                    ) : (
                      chartItems.map((it, i) => {
                        const h = toHeight(it);
                        const label = it.status === "offline" || it.status === "unknown"
                          ? "NA"
                          : (it.kind === "humidity" ? (it.value != null ? `${it.value.toFixed(1)}%` : "--%") : it.displayValue);
                        return (
                          <div key={i} className="flex flex-col items-center relative group" style={{ flexBasis: "22%", maxWidth: "120px" }}>
                            {(it.status === "offline" || it.status === "unknown" || it.value != null) && (
                              <div
                                className={`absolute text-sm font-bold px-3 py-2 rounded-lg shadow-lg z-20 transition-all duration-300 group-hover:scale-110 ${
                                  it.status === "alert"
                                    ? "bg-red-500 text-white border-2 border-red-600"
                                    : it.status === "warning"
                                    ? "bg-yellow-500 text-white border-2 border-yellow-600"
                                    : it.status === "offline" || it.status === "unknown"
                                    ? "bg-gray-500 text-white border-2 border-gray-600"
                                    : "bg-green-500 text-white border-2 border-green-600"
                                }`}
                                style={{
                                  bottom: `${h + 12}px`,
                                  left: "50%",
                                  transform: "translateX(-50%)",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                  animation: (it.status === "alert" || it.status === "warning") ? "customBounce 2s infinite" : "none",
                                }}
                              >
                                {label}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-current"></div>
                              </div>
                            )}
                            {it.value != null ? (
                              <div
                                className={`relative w-16 rounded-t-lg shadow-xl transition-all duration-500 group-hover:w-20 ${it.color} ${
                                  it.status === "alert" ? "animate-pulse" : ""
                                }`}
                                style={{
                                  height: `${Math.max(h, 8)}px`,
                                                                     background:
                                     it.status === "alert"
                                       ? "linear-gradient(to top, #dc2626, #ef4444)"
                                       : it.status === "warning"
                                       ? "linear-gradient(to top, #fef08a, #fef3c7)"
                                       : it.status === "offline" || it.status === "unknown"
                                       ? "linear-gradient(to top, #6b7280, #9ca3af)"
                                       : "linear-gradient(to top, #bbf7d0, #dcfce7)",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                                }}
                                title={`${it.name}: ${label} (${it.status})`}
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 rounded-t-lg"></div>
                              </div>
                            ) : (
                              <div className="bg-gray-400 w-16 rounded-t-lg opacity-50" style={{ height: "8px" }} title={`${it.name}: No data`}>
                                <div className="text-xs text-center text-gray-600 mt-1">No Data</div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Labels below bars */}
                <div className={`flex justify-around mt-4 pt-3 px-6 ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  {chartItems.map((it, i) => (
                    <div key={i} className="text-center group cursor-pointer" style={{ flexBasis: "22%", maxWidth: "120px" }}>
                      <p className="text-sm font-bold truncate group-hover:text-blue-600 transition-colors">{it.name}</p>
                                                                      <p
                           className={`text-xs font-semibold px-2 py-1 rounded-full mt-1 ${
                             it.status === "alert"
                               ? "bg-red-100 text-red-700 animate-bounce"
                               : it.status === "warning"
                               ? "bg-yellow-200 text-yellow-800"
                               : it.status === "offline" || it.status === "unknown"
                               ? "bg-gray-100 text-gray-700"
                               : "bg-green-200 text-green-800"
                           }`}
                         >
                         {it.status}
                       </p>
                      <p className="text-xs text-gray-500 mt-1">{it.kind}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Y-axis: humidity ticks when visible alongside temp */}
              <div className="flex flex-col w-16 ml-3">
                <div className="h-6"></div>
                <div className="relative h-80">
                  <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-500 items-start pl-3">
                    {rightAxis
                      ? ticks(rightAxis).map((t, i) => (
                          <span key={i} className="bg-white px-1 rounded">
                            {t}
                          </span>
                        ))
                      : ["Critical", "Hot", "Warm", "Room", "Cool", "Ideal", "Cold", "Very Cold", "Freezing", "Ice", "Frozen"].map(
                          (t, i) => (
                            <span key={i} className="bg-gray-100 px-1 rounded text-gray-700">
                              {t}
                            </span>
                          )
                        )}
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
                         <div className="flex justify-center mt-4 space-x-6 text-xs">
               <div className="flex items-center">
                 <div className="w-3 h-3 bg-green-200 rounded mr-2"></div>
                 <span>Normal (Good)</span>
               </div>
               <div className="flex items-center">
                 <div className="w-3 h-3 bg-yellow-200 rounded mr-2"></div>
                 <span>Warning</span>
               </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span>Critical (Needs Attention)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-500 rounded mr-2"></div>
                <span>Unconfigured</span>
              </div>
            </div>

            {/* Table */}
            <div className="mt-6">
              <h4 className={`text-md font-semibold mb-3 ${darkMode ? "text-white" : "text-gray-900"}`}>Sensor Details</h4>
              <div className="overflow-x-auto">
                <table className={`w-full text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                  <thead>
                    <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                      <th className="text-left py-2">Sensor</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Reading</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsVisible.map((it, i) => (
                      <tr key={i} className={`border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
                        <td className="py-2 font-medium">
                          <span>{it.name}</span>
                          <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full align-middle ${
                            it.access_role === 'owner'
                              ? 'bg-green-200 text-green-800'
                              : it.access_role === 'admin'
                              ? 'bg-yellow-200 text-yellow-800'
                              : 'bg-gray-200 text-gray-800'
                          }`}>
                            {it.access_role}
                          </span>
                        </td>
                        <td className="py-2 capitalize">{it.kind}</td>
                                                 <td className="py-2">
                           <span
                             className={`font-bold ${
                               it.status === "alert" ? "text-red-500" : it.status === "warning" ? "text-yellow-500" : it.status === "offline" || it.status === "unknown" ? "text-gray-500" : "text-green-500"
                             }`}
                           >
                             {it.status === "offline" || it.status === "unknown" ? "NA" : (it.kind === "humidity" ? (it.value != null ? `${it.value.toFixed(1)}%` : "--%") : it.displayValue)}
                           </span>
                         </td>
                        <td className="py-2">
                                                     <span
                             className={`px-2 py-1 rounded-full text-xs font-medium ${
                               it.status === "alert"
                                 ? "bg-red-100 text-red-800"
                                 : it.status === "warning"
                                 ? "bg-yellow-200 text-yellow-800"
                                 : it.status === "offline" || it.status === "unknown"
                                 ? "bg-gray-100 text-gray-800"
                                 : "bg-green-200 text-green-800"
                             } ${darkMode ? "bg-gray-700 text-white" : ""}`}
                           >
                            {it.status}
                          </span>
                        </td>
                                                 <td className="py-2">{
                           it.lastFetchedTime
                             ? fmtDate(it.lastFetchedTime, prefs.tz, true)
                             : "No data"
                         }</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <footer className={`text-center mt-8 text-sm ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
          © 2025 Safe Sense. All rights reserved.
        </footer>
      </main>
    </div>
  );
}

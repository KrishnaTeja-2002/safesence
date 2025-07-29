'use client';

import { useState, useRef, useEffect } from 'react';

export default function Dashboard() {
  const [data] = useState({
    notifications: 3,
    sensors: {
      total: 11, // 8 real sensors + 3 placeholders
      error: 3,
      warning: 1,
      success: 4,
      disconnected: 2,
    },
    users: 6,
    temperatures: [
      // Fridge temperatures
      { name: 'Walk-In Fridge', value: 40, displayValue: '40°F', color: 'bg-yellow-400', type: 'fridge' },
      { name: 'Beverages', value: 31, displayValue: '31°F', color: 'bg-red-400', type: 'fridge' },
      { name: 'DT Fridge', value: 20, displayValue: '20°F', color: 'bg-red-500', type: 'fridge' },
      { name: 'FC Fridge', value: 34, displayValue: '34°F', color: 'bg-green-400', type: 'fridge' },
      // Freezer temperatures (reverted to negative values as per typical freezer operation and previous images)
      { name: 'Freezer 1', value: -18, displayValue: '18°F', color: 'bg-red-300', type: 'freezer' },
      { name: 'Meat Freezer', value: -13, displayValue: '13°F', color: 'bg-green-300', type: 'freezer' },
      { name: 'Fry Product', value: -15, displayValue: '15°F', color: 'bg-green-300', type: 'freezer' },
      { name: 'Freezer 2', value: -22, displayValue: '22°F', color: 'bg-green-400', type: 'freezer' },
      // Placeholder entries (no values)
      { name: 'Placeholder 1', value: null, displayValue: '--', color: 'bg-gray-300', type: 'fridge' },
      { name: 'Placeholder 2', value: null, displayValue: '--', color: 'bg-gray-300', type: 'fridge' },
      { name: 'Placeholder 3', value: null, displayValue: '--', color: 'bg-gray-300', type: 'freezer' },
    ],
    notificationsList: [
      {
        id: 1,
        title: "Needs attention (Freezer 1)",
        date: "07/16/2025",
        type: "warning"
      },
      {
        id: 2,
        title: "Needs attention (Drive Thru Fridge)",
        date: "07/16/2025",
        type: "warning"
      },
      {
        id: 3,
        title: "Sensor Battery Low (Fry Product)",
        date: "07/16/2025",
        type: "battery"
      }
    ]
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(data.notificationsList);
  const popupRef = useRef(null);
  const notificationCardRef = useRef(null); // Added this ref for proper outside click handling

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside popup AND not on the notification card itself
      if (
        popupRef.current && !popupRef.current.contains(event.target) &&
        notificationCardRef.current && !notificationCardRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // Depend on notificationCardRef and popupRef if they were dynamic, but they are static here.

  const closeNotification = (id) => {
    setNotifications(notifications.filter(notification => notification.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  // Calculate bar heights for chart based on dual scales and 200px height
  const getBarHeight = (temp) => {
    const actualChartHeight = 256; // h-64 means 256px height (64 * 4px)

    if (temp.value === null) {
      return 0; // No bar for placeholders
    }

    if (temp.type === 'fridge') {
      const minFridge = 0;
      const maxFridge = 60;
      const rangeFridge = maxFridge - minFridge;
      return ((temp.value - minFridge) / rangeFridge) * actualChartHeight;
    } else if (temp.type === 'freezer') {
      // Scale: -30°F (bottom) to 30°F (top)
      const minFreezer = -30;
      const maxFreezer = 30;
      const rangeFreezer = maxFreezer - minFreezer; // 30 - (-30) = 60
      // For example, -18: (-18 - (-30)) = 12. So 12/60 of the height.
      return ((temp.value - minFreezer) / rangeFreezer) * actualChartHeight;
    }
    return 0;
  };

  return (
    <div className="flex min-h-screen bg-[#f9fbfd] text-[#111827]">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-600 text-white py-6 px-4">
        <div className="flex items-center mb-8">
          <div className="w-6 h-6 bg-orange-500 rounded mr-2 flex items-center justify-center">
            <div className="w-3 h-3 border border-white rounded-sm"></div>
          </div>
          <h1 className="text-lg font-semibold text-orange-500">Safe Sense</h1>
        </div>
        
        <nav className="space-y-1">
          <div className="flex items-center px-4 py-3 bg-gray-700 rounded text-white">
            <span className="mr-3 text-sm">🏠</span>
            <span className="text-sm font-medium">Dashboard</span>
          </div>
          <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
            <span className="mr-3 text-sm">⚠️</span>
            <span className="text-sm">Alerts</span>
          </div>
          <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
            <span className="mr-3 text-sm">📡</span>
            <span className="text-sm">Sensors</span>
          </div>
          <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
            <span className="mr-3 text-sm">📋</span>
            <span className="text-sm">History</span>
          </div>
          <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
            <span className="mr-3 text-sm">👥</span>
            <span className="text-sm">Team</span>
          </div>
          <div className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded cursor-pointer">
            <span className="mr-3 text-sm">⚙️</span>
            <span className="text-sm">Account</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className="text-sm text-gray-600">Hi Francis Anino</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
              Log out
            </button>
            <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold">
              FA
            </div>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Notifications */}
          <div className="bg-white rounded-lg p-6 shadow text-center relative">
            <div
              className="cursor-pointer"
              onClick={() => setShowNotifications(!showNotifications)}
              ref={notificationCardRef} // Corrected: This is the correct placement for ref
            >
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
                <span className="text-2xl">🔔</span>
              </div>
              <p className="text-gray-600 text-sm mb-1">Notifications</p>
              <p className="text-3xl font-bold text-gray-900 mb-2">{notifications.length}</p>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-red-500 text-sm">Unread</span>
              </div>
            </div>

            {/* Notifications Popup */}
            {showNotifications && (
              <div
                ref={popupRef}
                className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white rounded-lg shadow-lg z-20 border border-gray-200"
              >
                <div className="p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Notifications</h4>
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div key={notification.id} className="flex items-start justify-between p-3 mb-2 bg-gray-50 rounded-md">
                        <div className="flex-1">
                          <p className="text-gray-700 text-sm font-medium">{notification.title}</p>
                          <p className="text-gray-500 text-xs">{notification.date}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); closeNotification(notification.id); }}
                          className="text-gray-400 hover:text-gray-600 ml-3"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm text-center">No new notifications.</p>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearAllNotifications(); }}
                      className="mt-4 w-full bg-blue-500 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sensors */}
          <div className="bg-white rounded-lg p-6 shadow text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">📶</span>
            </div>
            <p className="text-gray-600 text-sm mb-1">Sensors</p>
            <p className="text-3xl font-bold text-gray-900 mb-2">{data.sensors.total}</p>
            <div className="flex items-center justify-center space-x-3 text-sm">
              <div className="flex items-center">
                <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-red-500 mr-1"></div>
                <span className="text-red-500 font-medium">{data.sensors.error}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                <span className="text-yellow-500 font-medium">{data.sensors.warning}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 mr-1"></div>
                <span className="text-green-500 font-medium">{data.sensors.success}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 mr-1 text-xs">✖</span>
                <span className="text-gray-500 font-medium">{data.sensors.disconnected}</span>
              </div>
            </div>
          </div>

          {/* Users */}
          <div className="bg-white rounded-lg p-6 shadow text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-gray-600 text-sm mb-1">Users</p>
            <p className="text-3xl font-bold text-gray-900 mb-2">{data.users}</p>
            <div className="flex justify-center -space-x-1">
              <div className="w-6 h-6 bg-orange-500 rounded-full border-2 border-white"></div>
              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white"></div>
              <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
              <div className="w-6 h-6 bg-purple-500 rounded-full border-2 border-white"></div>
              <div className="w-6 h-6 bg-pink-500 rounded-full border-2 border-white"></div>
              <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white"></div>
            </div>
          </div>
        </div>

        {/* Temperature Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Temperature Monitoring System</h3>
            <div className="flex space-x-4">
              <span className="text-green-600 font-medium">Fridge</span>
              <span className="text-blue-600 font-medium">Freezer</span>
            </div>
          </div>

          <div className="relative">
            {/* Chart container */}
            <div className="flex">
              {/* Left Y-axis (Fridge) */}
              <div className="flex flex-col w-12 mr-4">
                {/* h-64 means 256px height */}
                <div className="flex flex-col-reverse h-64 text-xs text-gray-500 justify-between items-end pr-2">
                  <span>0°F</span>
                  <span>10°F</span>
                  <span>20°F</span>
                  <span>30°F</span>
                  <span>40°F</span>
                  <span>50°F</span>
                  <span>60°F</span>
                </div>
              </div>

              {/* Chart area */}
              <div className="flex-1 relative">
                {/* Grid lines - Now correctly mapping to 7 lines for 6 segments (0-60 or -30-30) */}
                <div className="absolute inset-0 h-64">
                  <div className="h-full flex flex-col justify-between">
                    {[...Array(7)].map((_, i) => ( // 7 lines for 6 segments (0, 10, 20, 30, 40, 50, 60)
                      <div key={i} className="border-t border-gray-200 w-full"></div>
                    ))}
                  </div>
                </div>

                {/* Main temperature display box */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border-2 border-green-300 rounded-lg px-3 py-2 z-10">
                  <div className="text-xs text-green-700 text-center font-medium">Temperature</div>
                  <div className="text-sm font-bold text-green-700 text-center">41°F</div> {/* Changed to 41°F */}
                </div>

                {/* Bars */}
                <div className="relative h-64">
                  <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end h-full">
                    {data.temperatures.map((temp, i) => {
                      const barHeight = getBarHeight(temp);
                      return (
                        <div key={i} className="flex flex-col items-center relative" style={{ flexBasis: '8%' }}> {/* Use flexBasis for consistent width */}
                          {/* Temperature label */}
                          {temp.value !== null && (
                            <div
                              className="absolute text-xs font-medium bg-white px-1 rounded border"
                              style={{
                                bottom: `${barHeight + 8}px`, // 8px buffer above the bar
                                whiteSpace: 'nowrap',
                                color: temp.color.replace('bg-', 'text-').replace('-400', '-700').replace('-300', '-600').replace('-500', '-800') // Convert bg- to text- and make darker
                              }}
                            >
                              {temp.displayValue}
                            </div>
                          )}

                          {/* Bar (only render if value exists) */}
                          {temp.value !== null && (
                            <div
                              className={`${temp.color} w-6 rounded-t`}
                              style={{ height: `${barHeight}px`, minHeight: '4px' }}
                              title={`${temp.name}: ${temp.displayValue}`}
                            ></div>
                          )}
                           {/* Placeholder lines for "--" */}
                           {temp.value === null && (
                            <div className="bg-gray-300 w-6" style={{ height: '4px', position: 'absolute', bottom: 0 }}></div>
                           )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X-axis labels */}
                <div className="flex justify-around mt-2 pt-2">
                  {data.temperatures.map((temp, i) => (
                    <div key={i} className="text-center" style={{ flexBasis: '8%' }}>
                      <p className="text-xs text-gray-600 leading-tight">
                         {/* Break long names */}
                         {temp.name.includes(' ') ? (
                            <>
                               {temp.name.split(' ')[0]}<br/>{temp.name.split(' ')[1]}
                            </>
                         ) : (
                             temp.name
                         )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Y-axis (Freezer) */}
              <div className="flex flex-col w-12 ml-4">
                {/* h-64 means 256px height */}
                <div className="flex flex-col-reverse h-64 text-xs text-gray-500 justify-between items-start pl-2">
                  <span>-30°F</span>
                  <span>-20°F</span>
                  <span>-10°F</span>
                  <span>0°F</span>
                  <span>10°F</span>
                  <span>20°F</span>
                  <span>30°F</span>
                </div>
              </div>
            </div>

            {/* Bottom label */}
            <div className="text-center mt-4">
              <span className="text-sm text-gray-600 font-medium">Sensors</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
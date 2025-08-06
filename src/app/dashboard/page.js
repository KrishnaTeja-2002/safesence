'use client';

import { useState, useRef, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

export default function Dashboard() {
  const [data] = useState({
    notifications: 3,
    sensors: {
      total: 11,
      error: 3,
      warning: 1,
      success: 4,
      disconnected: 2,
    },
    users: 6,
    temperatures: [
      { name: 'Walk-In Fridge', value: 40, displayValue: '40°F', color: 'bg-yellow-400', type: 'fridge' },
      { name: 'Beverages', value: 31, displayValue: '31°F', color: 'bg-red-400', type: 'fridge' },
      { name: 'DT Fridge', value: 20, displayValue: '20°F', color: 'bg-red-500', type: 'fridge' },
      { name: 'FC Fridge', value: 34, displayValue: '34°F', color: 'bg-green-400', type: 'fridge' },
      { name: 'Freezer 1', value: -18, displayValue: '18°F', color: 'bg-red-300', type: 'freezer' },
      { name: 'Meat Freezer', value: -13, displayValue: '13°F', color: 'bg-green-300', type: 'freezer' },
      { name: 'Fry Product', value: -15, displayValue: '15°F', color: 'bg-green-300', type: 'freezer' },
      { name: 'Freezer 2', value: -22, displayValue: '22°F', color: 'bg-green-400', type: 'freezer' },
      { name: 'Placeholder 1', value: null, displayValue: '--', color: 'bg-gray-300', type: 'fridge' },
      { name: 'Placeholder 2', value: null, displayValue: '--', color: 'bg-gray-300', type: 'fridge' },
      { name: 'Placeholder 3', value: null, displayValue: '--', color: 'bg-gray-300', type: 'freezer' },
    ],
    notificationsList: [
      { id: 1, title: 'Needs attention (Freezer 1)', date: '07/16/2025', type: 'warning' },
      { id: 2, title: 'Needs attention (Drive Thru Fridge)', date: '07/16/2025', type: 'warning' },
      { id: 3, title: 'Sensor Battery Low (Fry Product)', date: '07/16/2025', type: 'battery' },
    ],
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(data.notificationsList);
  const popupRef = useRef(null);
  const notificationCardRef = useRef(null);
  const { darkMode } = useDarkMode();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        notificationCardRef.current &&
        !notificationCardRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const closeNotification = (id) => {
    setNotifications(notifications.filter((notification) => notification.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  const getBarHeight = (temp) => {
    const actualChartHeight = 256;
    if (temp.value === null) {
      return 0;
    }
    if (temp.type === 'fridge') {
      const minFridge = 0;
      const maxFridge = 60;
      const rangeFridge = maxFridge - minFridge;
      return ((temp.value - minFridge) / rangeFridge) * actualChartHeight;
    } else if (temp.type === 'freezer') {
      const minFreezer = -30;
      const maxFreezer = 30;
      const rangeFreezer = maxFreezer - minFreezer;
      return ((temp.value - minFreezer) / rangeFreezer) * actualChartHeight;
    }
    return 0;
  };

  return (
    <div className={`flex min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Hi Francis Anino</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              className={`bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ${
                darkMode ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              Log out
            </button>
            <div
              className={`w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white text-sm font-bold ${
                darkMode ? 'bg-amber-700' : ''
              }`}
            >
              FA
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div
            className={`rounded-lg p-6 shadow text-center relative ${
              darkMode ? 'bg-gray-800 text-white' : 'bg-white'
            }`}
          >
            <div
              className="cursor-pointer"
              onClick={() => setShowNotifications(!showNotifications)}
              ref={notificationCardRef}
            >
              <div
                className={`flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto ${
                  darkMode ? 'bg-green-900' : ''
                }`}
              >
                <span className="text-2xl">🔔</span>
              </div>
              <p className={`text-gray-600 text-sm mb-1 ${darkMode ? 'text-gray-300' : ''}`}>Notifications</p>
              <p
                className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? 'text-white' : ''}`}
              >
                {notifications.length}
              </p>
              <div className="flex items-center justify-center">
                <div
                  className={`w-2 h-2 bg-red-500 rounded-full mr-2 ${darkMode ? 'bg-red-400' : ''}`}
                ></div>
                <span className={`text-red-500 text-sm ${darkMode ? 'text-red-400' : ''}`}>Unread</span>
              </div>
            </div>
            {showNotifications && (
              <div
                ref={popupRef}
                className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-white rounded-lg shadow-lg z-20 border border-gray-200 ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white' : ''
                }`}
              >
                <div className="p-4">
                  <h4
                    className={`font-semibold text-gray-800 mb-3 ${darkMode ? 'text-white' : ''}`}
                  >
                    Notifications
                  </h4>
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`flex items-start justify-between p-3 mb-2 bg-gray-50 rounded-md ${
                          darkMode ? 'bg-gray-700 text-white' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <p
                            className={`text-gray-700 text-sm font-medium ${darkMode ? 'text-white' : ''}`}
                          >
                            {notification.title}
                          </p>
                          <p
                            className={`text-gray-500 text-xs ${darkMode ? 'text-gray-300' : ''}`}
                          >
                            {notification.date}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeNotification(notification.id);
                          }}
                          className={`text-gray-400 hover:text-gray-600 ml-3 ${
                            darkMode ? 'text-gray-300 hover:text-gray-200' : ''
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <p
                      className={`text-gray-500 text-sm text-center ${darkMode ? 'text-gray-300' : ''}`}
                    >
                      No new notifications.
                    </p>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllNotifications();
                      }}
                      className={`mt-4 w-full bg-blue-500 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-600 ${
                        darkMode ? 'bg-blue-600 hover:bg-blue-700' : ''
                      }`}
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div
            className={`rounded-lg p-6 shadow text-center ${
              darkMode ? 'bg-gray-800 text-white' : 'bg-white'
            }`}
          >
            <div
              className={`flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto ${
                darkMode ? 'bg-green-900' : ''
              }`}
            >
              <span className="text-2xl">📶</span>
            </div>
            <p
              className={`text-gray-600 text-sm mb-1 ${darkMode ? 'text-gray-300' : ''}`}
            >
              Sensors
            </p>
            <p
              className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? 'text-white' : ''}`}
            >
              {data.sensors.total}
            </p>
            <div className="flex items-center justify-center space-x-3 text-sm">
              <div className="flex items-center">
                <div
                  className={`w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-red-500 mr-1 ${
                    darkMode ? 'border-b-red-400' : ''
                  }`}
                ></div>
                <span
                  className={`text-red-500 font-medium ${darkMode ? 'text-red-400' : ''}`}
                >
                  {data.sensors.error}
                </span>
              </div>
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 bg-yellow-500 rounded-full mr-1 ${
                    darkMode ? 'bg-yellow-400' : ''
                  }`}
                ></div>
                <span
                  className={`text-yellow-500 font-medium ${darkMode ? 'text-yellow-400' : ''}`}
                >
                  {data.sensors.warning}
                </span>
              </div>
              <div className="flex items-center">
                <div
                  className={`w-2 h-2 bg-green-500 mr-1 ${darkMode ? 'bg-green-400' : ''}`}
                ></div>
                <span
                  className={`text-green-500 font-medium ${darkMode ? 'text-green-400' : ''}`}
                >
                  {data.sensors.success}
                </span>
              </div>
              <div className="flex items-center">
                <span
                  className={`mr-1 text-xs ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}
                >
                  ✖
                </span>
                <span
                  className={`text-gray-500 font-medium ${darkMode ? 'text-gray-300' : ''}`}
                >
                  {data.sensors.disconnected}
                </span>
              </div>
            </div>
          </div>
          <div
            className={`rounded-lg p-6 shadow text-center ${
              darkMode ? 'bg-gray-800 text-white' : 'bg-white'
            }`}
          >
            <div
              className={`flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto ${
                darkMode ? 'bg-green-900' : ''
              }`}
            >
              <span className="text-2xl">👥</span>
            </div>
            <p
              className={`text-gray-600 text-sm mb-1 ${darkMode ? 'text-gray-300' : ''}`}
            >
              Users
            </p>
            <p
              className={`text-3xl font-bold text-gray-900 mb-2 ${darkMode ? 'text-white' : ''}`}
            >
              {data.users}
            </p>
            <div className="flex justify-center -space-x-1">
              <div
                className={`w-6 h-6 bg-orange-500 rounded-full border-2 border-white ${
                  darkMode ? 'border-gray-700' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-6 bg-blue-500 rounded-full border-2 border-white ${
                  darkMode ? 'border-gray-700' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-6 bg-green-500 rounded-full border-2 border-white ${
                  darkMode ? 'border-gray-700' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-6 bg-purple-500 rounded-full border-2 border-white ${
                  darkMode ? 'border-gray-700' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-6 bg-pink-500 rounded-full border-2 border-white ${
                  darkMode ? 'border-gray-700' : ''
                }`}
              ></div>
              <div
                className={`w-6 h-6 bg-red-500 rounded-full border-2 border-white ${
                  darkMode ? 'border-gray-700' : ''
                }`}
              ></div>
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg shadow p-6 ${
            darkMode ? 'bg-gray-800 text-white' : 'bg-white'
          }`}
        >
          <div className="flex justify-between items-center mb-6">
            <h3
              className={`text-lg font-semibold text-gray-900 ${
                darkMode ? 'text-white' : ''
              }`}
            >
              Temperature Monitoring System
            </h3>
          </div>
          <div className="relative">
            <div className="flex">
              <div className="flex flex-col w-12 mr-4">
                <div
                  className={`flex flex-col-reverse h-64 text-xs text-gray-500 justify-between items-end pr-2 mt-6 ${
                    darkMode ? 'text-gray-300' : ''
                  }`}
                >
                  <span>0°F</span>
                  <span>10°F</span>
                  <span>20°F</span>
                  <span>30°F</span>
                  <span>40°F</span>
                  <span>50°F</span>
                  <span>60°F</span>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="absolute -top-6 left-0 right-0 flex justify-between z-10">
                  <span
                    className={`text-green-600 font-medium text-sm ${
                      darkMode ? 'text-green-400' : ''
                    }`}
                  >
                    Fridge
                  </span>
                  <span
                    className={`text-blue-600 font-medium text-sm ${
                      darkMode ? 'text-blue-400' : ''
                    }`}
                  >
                    Freezer
                  </span>
                </div>
                <div className="absolute inset-0 h-64">
                  <div className="h-full flex flex-col justify-between">
                    {[...Array(7)].map((_, i) => (
                      <div
                        key={i}
                        className={`border-t border-gray-200 w-full ${
                          darkMode ? 'border-gray-700' : ''
                        }`}
                      ></div>
                    ))}
                  </div>
                  <div className="absolute inset-0">
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200 ${
                        darkMode ? 'bg-gray-700' : ''
                      }`}
                    ></div>
                    <div
                      className={`absolute right-0 top-0 bottom-0 w-0.5 bg-gray-200 ${
                        darkMode ? 'bg-gray-700' : ''
                      }`}
                    ></div>
                  </div>
                </div>
                <div
                  className={`absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-100 border-2 border-green-300 rounded-lg px-3 py-2 z-10 ${
                    darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''
                  }`}
                >
                  <div className="text-xs text-green-700 text-center font-medium">
                    Temperature
                  </div>
                  <div className="text-sm font-bold text-green-700 text-center">
                    41°F
                  </div>
                </div>
                <div className="relative h-64">
                  <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end h-full">
                    {data.temperatures.map((temp, i) => {
                      const barHeight = getBarHeight(temp);
                      return (
                        <div key={i} className="flex flex-col items-center relative" style={{ flexBasis: '8%' }}>
                          {temp.value !== null && (
                            <div
                              className={`absolute text-xs font-medium bg-white px-1 rounded border ${
                                darkMode ? 'text-white border-gray-700' : 'text-gray-700 border-gray-300'
                              }`}
                              style={{
                                bottom: `${barHeight + 8}px`,
                                whiteSpace: 'nowrap',
                                color: temp.color
                                  .replace('bg-', 'text-')
                                  .replace('-400', darkMode ? '-300' : '-700')
                                  .replace('-300', darkMode ? '-200' : '-600')
                                  .replace('-500', darkMode ? '-400' : '-800'),
                              }}
                            >
                              {temp.displayValue}
                            </div>
                          )}
                          {temp.value !== null && (
                            <div
                              className={`${temp.color} w-6 rounded-t`}
                              style={{ height: `${barHeight}px`, minHeight: '4px' }}
                              title={`${temp.name}: ${temp.displayValue}`}
                            ></div>
                          )}
                          {temp.value === null && (
                            <div
                              className={`bg-gray-300 w-6`}
                              style={{ height: '4px', position: 'absolute', bottom: 0 }}
                            ></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={`flex justify-around mt-2 pt-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {data.temperatures.map((temp, i) => (
                    <div key={i} className="text-center" style={{ flexBasis: '8%' }}>
                      <p className="text-xs leading-tight">
                        {temp.name.includes(' ') ? (
                          <>
                            {temp.name.split(' ')[0]}<br />
                            {temp.name.split(' ')[1]}
                          </>
                        ) : (
                          temp.name
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col w-12 ml-4">
                <div
                  className={`flex flex-col-reverse h-64 text-xs text-gray-500 justify-between items-start pl-2 mt-6 ${
                    darkMode ? 'text-gray-300' : ''
                  }`}
                >
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
            <div className="text-center mt-4">
              <span
                className={`text-sm text-gray-600 font-medium ${
                  darkMode ? 'text-gray-300' : ''
                }`}
              >
                Sensors
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
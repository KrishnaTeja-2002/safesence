'use client';

import { useState, useRef, useEffect } from 'react';

export default function History() {
  const [selectedSensor, setSelectedSensor] = useState('Walk-In Fridge');
  const [selectedTimeRange, setSelectedTimeRange] = useState('Show: Temp');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const chartRef = useRef(null);

  // Sample data for temperature history
  const temperatureData = [
    { x: 0, y: 35, time: 'Jul 28, 2025, 07:09 PM CDT' },
    { x: 1, y: 38, time: 'Jul 28, 2025, 08:09 PM CDT' },
    { x: 2, y: 42, time: 'Jul 28, 2025, 09:09 PM CDT' },
    { x: 3, y: 40, time: 'Jul 28, 2025, 10:09 PM CDT' },
    { x: 4, y: 38, time: 'Jul 28, 2025, 11:09 PM CDT' },
    { x: 5, y: 36, time: 'Jul 28, 2025, 12:09 AM CDT' },
  ];

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (chartRef.current) {
        const rect = chartRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dataPointIndex = Math.min(
          Math.max(Math.floor((x / rect.width) * (temperatureData.length - 1)), 0),
          temperatureData.length - 1
        );
        setHoveredPoint(temperatureData[dataPointIndex]);
      }
    };

    const chartElement = chartRef.current;
    if (chartElement) {
      chartElement.addEventListener('mousemove', handleMouseMove);
      chartElement.addEventListener('mouseleave', () => setHoveredPoint(null));
    }

    return () => {
      if (chartElement) {
        chartElement.removeEventListener('mousemove', handleMouseMove);
        chartElement.removeEventListener('mouseleave', () => setHoveredPoint(null));
      }
    };
  }, [temperatureData]);

  const getPath = () => {
    const height = 256;
    const scaleY = height / 60; // Scale to 60°F max
    return `
      M 0,${height - temperatureData[0].y * scaleY}
      ${temperatureData
        .map((point, i) => `${(i / (temperatureData.length - 1)) * 100}%,${height - point.y * scaleY}`)
        .join(' L ')}
      L 100%,${height} L 0,${height} Z
    `;
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
                  idx === 3 ? 'bg-gray-600 font-semibold' : ''
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
          <h2 className="text-3xl font-bold">History</h2>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
        </div>

        {/* Temperature History Section */}
        <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-300">
          <div className="mb-6">
            <h3 className="text-xl font-semibold">Temperature History</h3>
            <p className="text-green-700 text-sm">Walk-In Fridge</p>
          </div>
          <div className="flex justify-end items-center space-x-2 mb-6">
            <select
              value={selectedSensor}
              onChange={(e) => setSelectedSensor(e.target.value)}
              className="border rounded px-2 py-1 bg-white"
            >
              <option> Sensors </option>
            </select>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="border rounded px-2 py-1 bg-white"
            >
              <option>Show: Temp</option>
              <option>6H</option>
              <option>12H</option>
              <option>1D</option>
              <option>1M</option>
              <option>3M</option>
            </select>
          </div>
          <div className="relative">
            <div className="flex">
              {/* Left Y-axis with Temperature label inside the graph */}
              <div className="flex flex-col items-end pr-4">
                <div className="text-sm text-gray-500 transform -rotate-90 origin-bottom-left absolute top-1/2 -translate-y-1/2 -left-2 w-64 text-center">
                  Temperature (Fahrenheit)
                </div>
                <div className="flex flex-col justify-between h-64 text-sm text-gray-400">
                  {[60, 50, 40, 30, 20, 10, 0].map((val) => (
                    <div key={val} className="flex items-center">
                      <span className="leading-none mr-2">{val}</span>
                      <div className="w-4 border-t border-gray-200"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Area */}
              <div className="flex-1 relative" ref={chartRef}>
                <div className="h-64">
                  <svg width="100%" height="256" className="border-b border-gray-200">
                    {/* Horizontal grid lines */}
                    {[0, 10, 20, 30, 40, 50, 60].map((val) => (
                      <line
                        key={val}
                        x1="0"
                        y1={256 - (val / 60) * 256}
                        x2="100%"
                        y2={256 - (val / 60) * 256}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                    ))}
                    <path
                      d={getPath()}
                      fill="#d1fae5"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                    {/* Static box in the middle with Temperature 35°F and current time */}
                    <g>
                      <rect
                        x="45%"
                        y="100" // Positioned around the middle (e.g., near 35°F level)
                        width="100"
                        height="30"
                        fill="#d1fae5"
                        rx="4"
                        style={{ pointerEvents: 'none' }} // Avoid interfering with hover
                      />
                      <text
                        x="50%"
                        y="115"
                        textAnchor="middle"
                        fill="#065f46"
                        fontSize="12"
                        style={{ pointerEvents: 'none' }}
                      >
                        Temperature 35°F
                      </text>
                      <text
                        x="50%"
                        y="130"
                        textAnchor="middle"
                        fill="#065f46"
                        fontSize="10"
                        style={{ pointerEvents: 'none' }}
                      >
                        Jul 28, 2025, 07:09 PM CDT
                      </text>
                    </g>
                    {hoveredPoint && (
                      <g>
                        <rect
                          x={((hoveredPoint.x / (temperatureData.length - 1)) * 100 - 50) + '%'}
                          y={256 - (hoveredPoint.y / 60) * 256 - 40}
                          width="100"
                          height="30"
                          fill="#d1fae5"
                          rx="4"
                        />
                        <text
                          x={((hoveredPoint.x / (temperatureData.length - 1)) * 100) + '%'}
                          y={256 - (hoveredPoint.y / 60) * 256 - 25}
                          textAnchor="middle"
                          fill="#065f46"
                          fontSize="12"
                        >
                          Temperature {hoveredPoint.y}°F
                        </text>
                        <text
                          x={((hoveredPoint.x / (temperatureData.length - 1)) * 100) + '%'}
                          y={256 - (hoveredPoint.y / 60) * 256 - 10}
                          textAnchor="middle"
                          fill="#065f46"
                          fontSize="10"
                        >
                          {hoveredPoint.time}
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
                <div className="mt-4 flex justify-between w-full px-4">
                  {['6H', '12H', '1D', '1M', '3M'].map((label) => (
                    <span key={label} className="text-xs text-gray-600">{label}</span>
                  ))}
                </div>
              </div>

              {/* Right Y-axis (empty for symmetry) */}
              <div className="flex flex-col items-start pl-4 w-8"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
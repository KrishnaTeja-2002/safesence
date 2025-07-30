
'use client';

import { useState, useRef, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
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

export default function History() {
  const [selectedSensor, setSelectedSensor] = useState('Walk-In Fridge');
  const [selectedTimeRange, setSelectedTimeRange] = useState('Show: Temp');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const chartRef = useRef(null);
  const router = useRouter();

  // Sample data for temperature history (could be fetched from an API or shared state)
  const temperatureData = [
    { x: 0, y: 35, time: 'Jul 28, 2025, 07:09 PM CDT' },
    { x: 1, y: 38, time: 'Jul 28, 2025, 08:09 PM CDT' },
    { x: 2, y: 42, time: 'Jul 28, 2025, 09:09 PM CDT' },
    { x: 3, y: 40, time: 'Jul 28, 2025, 10:09 PM CDT' },
    { x: 4, y: 38, time: 'Jul 28, 2025, 11:09 PM CDT' },
    { x: 5, y: 36, time: 'Jul 28, 2025, 12:09 AM CDT' },
  ];

  // Sensor list consistent with alerts.jsx
  const sensors = [
    'Freezer 1',
    'Drive Thru Fridge',
    'Beverage Fridge',
    'Walk-In Fridge',
    'FC Fridge',
    'Fry Products',
    'Freezer 2',
    'Meat Freezer',
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
    <ErrorBoundary>
      <div className="flex min-h-screen bg-gray-100 text-gray-800">
        <Sidebar activeKey="history" />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">History</h2>
            <div className="flex items-center space-x-4">
              <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                FA
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-2 border-blue-300">
            <div className="mb-6">
              <h3 className="text-xl font-semibold">Temperature History</h3>
              <p className="text-green-700 text-sm">{selectedSensor}</p>
            </div>
            <div className="flex justify-end items-center space-x-2 mb-6">
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className="border rounded px-2 py-1 bg-white border-gray-300 text-gray-900"
              >
                {sensors.map((sensor, idx) => (
                  <option key={idx} value={sensor}>{sensor}</option>
                ))}
              </select>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="border rounded px-2 py-1 bg-white border-gray-300 text-gray-900"
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
              <div className="flex justify-center">
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

                <div className="flex-1 relative mx-auto" ref={chartRef}>
                  <div className="h-64">
                    <svg width="100%" height="256" className="border-b border-gray-200">
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
                        stroke="green"
                        strokeWidth="3"
                      />
                      <g>
                        <rect
                          x="45%"
                          y="100"
                          width="100"
                          height="30"
                          fill="#d1fae5"
                          rx="4"
                          style={{ pointerEvents: 'none' }}
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
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

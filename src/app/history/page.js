'use client';

import { useState, useRef, useEffect, Component } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useDarkMode } from '../DarkModeContext';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className={`p-4 ${this.props.darkMode ? 'text-red-400' : 'text-red-500'}`}>Error: {this.state.error?.message || 'Something went wrong'}</div>;
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
  const { darkMode } = useDarkMode();

  // Sample data for temperature history with more realistic curve
  const temperatureData = [
    { x: 0, y: 32, time: 'July 3, 2025', timeDetail: '12:00 PM' },
    { x: 1, y: 33, time: 'July 3, 2025', timeDetail: '1:00 PM' },
    { x: 2, y: 35, time: 'July 3, 2025', timeDetail: '2:00 PM' },
    { x: 3, y: 37, time: 'July 3, 2025', timeDetail: '3:00 PM' },
    { x: 4, y: 36, time: 'July 3, 2025', timeDetail: '4:00 PM' },
    { x: 5, y: 35, time: 'July 3, 2025', timeDetail: '4:53 PM' },
    { x: 6, y: 34, time: 'July 3, 2025', timeDetail: '5:00 PM' },
    { x: 7, y: 33, time: 'July 3, 2025', timeDetail: '6:00 PM' },
    { x: 8, y: 31, time: 'July 3, 2025', timeDetail: '7:00 PM' },
    { x: 9, y: 33, time: 'July 3, 2025', timeDetail: '8:00 PM' },
    { x: 10, y: 35, time: 'July 3, 2025', timeDetail: '9:00 PM' },
    { x: 11, y: 38, time: 'July 3, 2025', timeDetail: '10:00 PM' },
  ];

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
        const y = e.clientY - rect.top;
        
        // Check if mouse is near any data point
        let closestPoint = null;
        let minDistance = Infinity;
        
        temperatureData.forEach((point, i) => {
          const pointX = (i / (temperatureData.length - 1)) * (rect.width - 40); // Account for padding
          const pointY = 300 - ((point.y - 10) / 50) * 300; // Scale from 10-60°F range
          const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2));
          
          if (distance < 25 && distance < minDistance) { // Within 25px of the point
            minDistance = distance;
            closestPoint = { ...point, index: i };
          }
        });
        
        setHoveredPoint(closestPoint);
      }
    };

    const handleMouseLeave = () => setHoveredPoint(null);

    const chartElement = chartRef.current;
    if (chartElement) {
      chartElement.addEventListener('mousemove', handleMouseMove);
      chartElement.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (chartElement) {
        chartElement.removeEventListener('mousemove', handleMouseMove);
        chartElement.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [temperatureData]);

  const getLinePath = () => {
    const height = 300;
    const width = 100;
    const points = temperatureData.map((point, i) => {
      const x = (i / (temperatureData.length - 1)) * width;
      const y = height - ((point.y - 10) / 50) * height; // Scale from 10-60°F
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  const getAreaPath = () => {
    const height = 300;
    const width = 100;
    const points = temperatureData.map((point, i) => {
      const x = (i / (temperatureData.length - 1)) * width;
      const y = height - ((point.y - 10) / 50) * height;
      return `${x},${y}`;
    });
    
    // Start from bottom left, draw the line, then close to bottom right
    const firstPoint = points[0].split(',');
    const lastPoint = points[points.length - 1].split(',');
    
    return `M ${firstPoint[0]},${height} L ${points.join(' L ')} L ${lastPoint[0]},${height} Z`;
  };

  return (
    <ErrorBoundary darkMode={darkMode}>
      <div className={`flex min-h-screen bg-${darkMode ? 'gray-800' : 'gray-100'} text-${darkMode ? 'gray-300' : 'gray-800'}`}>
        <Sidebar activeKey="history" darkMode={darkMode} />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">History</h2>
            <div className="flex items-center space-x-4">
              <button className={`px-4 py-2 rounded ${darkMode ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                Log out
              </button>
              <div className={`w-10 h-10 ${darkMode ? 'bg-amber-700' : 'bg-amber-600'} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                FA
              </div>
            </div>
          </div>

          <div className={`bg-${darkMode ? 'gray-800' : 'white'} rounded-lg shadow p-6 border-2 ${darkMode ? 'border-blue-700' : 'border-blue-300'}`}>
            <div className="mb-6">
              <h3 className="text-xl font-semibold">Temperature History</h3>
              <p className={`text-${darkMode ? 'green-400' : 'green-700'} text-sm`}>{selectedSensor}</p>
            </div>
            <div className="flex justify-end items-center space-x-2 mb-6">
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className={`border rounded px-2 py-1 ${darkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
              >
                {sensors.map((sensor, idx) => (
                  <option key={idx} value={sensor}>{sensor}</option>
                ))}
              </select>
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className={`border rounded px-2 py-1 ${darkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
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
                <div className="flex flex-col items-end pr-4 mr-4">
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} transform -rotate-90 origin-bottom-left absolute top-1/2 -translate-y-1/2 -left-8 w-64 text-center font-medium`}>
                    Temperature (Fahrenheit)
                  </div>
                  <div className="flex flex-col justify-between h-80 text-sm text-gray-500">
                    {[60, 50, 40, 30, 20, 10].map((val) => (
                      <div key={val} className="flex items-center">
                        <span className={`leading-none mr-3 w-6 text-right ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{val}</span>
                        <div className={`w-2 border-t ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 relative" ref={chartRef}>
                  <div className="h-80 relative">
                    <svg width="100%" height="300" viewBox="0 0 100 300" preserveAspectRatio="none" className={`border-b border-l ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                      {/* Horizontal grid lines */}
                      {[10, 20, 30, 40, 50, 60].map((val) => (
                        <line
                          key={val}
                          x1="0"
                          y1={300 - ((val - 10) / 50) * 300}
                          x2="100"
                          y2={300 - ((val - 10) / 50) * 300}
                          stroke={darkMode ? '#4b5563' : '#e5e7eb'}
                          strokeWidth="0.2"
                          strokeDasharray="1,1"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      
                      {/* Area fill */}
                      <path
                        d={getAreaPath()}
                        fill={darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}
                        stroke="none"
                      />
                      
                      {/* Temperature line */}
                      <path
                        d={getLinePath()}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                      
                      {/* Data points */}
                      {temperatureData.map((point, i) => (
                        <circle
                          key={i}
                          cx={(i / (temperatureData.length - 1)) * 100}
                          cy={300 - ((point.y - 10) / 50) * 300}
                          r="1.5"
                          fill="#22c55e"
                          stroke={darkMode ? '#374151' : 'white'}
                          strokeWidth="0.5"
                          vectorEffect="non-scaling-stroke"
                          className="cursor-pointer hover:r-3 transition-all"
                        />
                      ))}
                    </svg>
                    
                    {/* Hover tooltip */}
                    {hoveredPoint && (
                      <div 
                        className="absolute pointer-events-none z-10"
                        style={{
                          left: `${(hoveredPoint.index / (temperatureData.length - 1)) * 100}%`,
                          top: `${300 - ((hoveredPoint.y - 10) / 50) * 300 - 90}px`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        <div className={`${darkMode ? 'bg-green-600' : 'bg-green-500'} text-white p-3 rounded-lg shadow-lg border-2 ${darkMode ? 'border-gray-600' : 'border-white'} text-center min-w-32`}>
                          <div className="text-xs font-medium">Temperature</div>
                          <div className="text-lg font-bold">{hoveredPoint.y}°F</div>
                          <div className="text-xs">{hoveredPoint.time}</div>
                          <div className="text-xs font-semibold">{hoveredPoint.timeDetail}</div>
                        </div>
                        <div className={`w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent ${darkMode ? 'border-t-green-600' : 'border-t-green-500'} mx-auto`}></div>
                      </div>
                    )}
                    
                    {/* X-axis labels */}
                    <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-2">
                      {['6H', '12H', '1D', '1M', '3M'].map((label) => (
                        <span key={label} className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'} font-medium`}>
                          {label}
                        </span>
                      ))}
                    </div>
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
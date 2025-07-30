
'use client';

import { useState, Component } from 'react';
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

export default function Account() {
  const [userDetails, setUserDetails] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
  });
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: false,
    dashboardAlerts: true,
  });

  const router = useRouter();

  const handleUserDetailsChange = (e) => {
    const { name, value } = e.target;
    setUserDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreferencesChange = (e) => {
    const { name, checked } = e.target;
    setPreferences((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSave = () => {
    // Simulate saving user details and preferences (e.g., API call)
    console.log('Saving user details:', userDetails);
    console.log('Saving preferences:', preferences);
    alert('Settings saved successfully!');
  };

  const handleCancel = () => {
    // Reset to initial values
    setUserDetails({ name: 'John Doe', email: 'john.doe@example.com' });
    setPreferences({ emailNotifications: true, smsNotifications: false, dashboardAlerts: true });
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-gray-100 text-gray-800">
        <Sidebar activeKey="account" />
        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Account Settings</h2>
            <div className="flex items-center space-x-4">
              <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Log out</button>
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                FA
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* User Details Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">User Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={userDetails.name}
                    onChange={handleUserDetailsChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-gray-900 border-gray-300"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={userDetails.email}
                    onChange={handleUserDetailsChange}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white text-gray-900 border-gray-300"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
            </div>

            {/* Preferences Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="emailNotifications"
                    checked={preferences.emailNotifications}
                    onChange={handlePreferencesChange}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">Email Notifications</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="smsNotifications"
                    checked={preferences.smsNotifications}
                    onChange={handlePreferencesChange}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">SMS Notifications</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="dashboardAlerts"
                    checked={preferences.dashboardAlerts}
                    onChange={handlePreferencesChange}
                    className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-600">Dashboard Alerts</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleCancel}
                className="px-6 py-3 rounded-lg font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 rounded-lg font-medium text-white bg-orange-500 hover:bg-orange-600 border-orange-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

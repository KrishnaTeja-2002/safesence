// Status mapping from database values to UI display values
export const STATUS_MAPPING = {
  'unknown': {
    label: 'Unknown',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-300'
  },
  'ok': {
    label: 'Good',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
    borderColor: 'border-green-300'
  },
  'warning': {
    label: 'Warning',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-600',
    borderColor: 'border-yellow-300'
  },
  'alert': {
    label: 'Needs Attention',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-600',
    borderColor: 'border-red-300'
  },
  'offline': {
    label: 'Sensor Offline',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-300'
  }
};

// Get status display information
export function getStatusDisplay(status) {
  return STATUS_MAPPING[status] || STATUS_MAPPING['unknown'];
}

// Check if status indicates an alert condition
export function isAlertStatus(status) {
  return status === 'alert' || status === 'warning';
}

// Check if status indicates sensor is offline
export function isOfflineStatus(status) {
  return status === 'offline';
}

// Get priority for sorting (higher number = higher priority)
export function getStatusPriority(status) {
  const priorities = {
    'alert': 4,
    'warning': 3,
    'offline': 2,
    'unknown': 1,
    'ok': 0
  };
  return priorities[status] || 0;
}

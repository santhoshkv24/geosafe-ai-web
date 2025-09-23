import axios, { AxiosResponse } from 'axios';
import { 
  Sensor, 
  SensorReading, 
  Alert, 
  ApiResponse, 
  PaginatedResponse,
  SensorHealthStatus 
} from '../types';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Sensor API
export const sensorApi = {
  // Get all sensors with optional filtering
  getSensors: async (params?: {
    status?: string;
    zone?: string;
    limit?: number;
    page?: number;
  }): Promise<PaginatedResponse<Sensor>> => {
    const response: AxiosResponse<PaginatedResponse<Sensor>> = await api.get('/sensors', { params });
    return response.data;
  },

  // Get specific sensor by ID
  getSensor: async (sensorId: string): Promise<{ sensor: Sensor; latestReading?: SensorReading }> => {
    const response: AxiosResponse<{ sensor: Sensor; latestReading?: SensorReading }> = await api.get(`/sensors/${sensorId}`);
    return response.data;
  },

  // Create new sensor
  createSensor: async (sensorData: Omit<Sensor, '_id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Sensor>> => {
    const response: AxiosResponse<ApiResponse<Sensor>> = await api.post('/sensors', sensorData);
    return response.data;
  },

  // Update sensor
  updateSensor: async (sensorId: string, sensorData: Partial<Sensor>): Promise<ApiResponse<Sensor>> => {
    const response: AxiosResponse<ApiResponse<Sensor>> = await api.put(`/sensors/${sensorId}`, sensorData);
    return response.data;
  },

  // Update sensor status
  updateSensorStatus: async (sensorId: string, status: string): Promise<ApiResponse<Sensor>> => {
    const response: AxiosResponse<ApiResponse<Sensor>> = await api.patch(`/sensors/${sensorId}/status`, { status });
    return response.data;
  },

  // Get nearby sensors
  getNearbySensors: async (lat: number, lng: number, radius?: number): Promise<{ sensors: Sensor[] }> => {
    const response: AxiosResponse<{ sensors: Sensor[] }> = await api.get(`/sensors/nearby/${lat}/${lng}`, {
      params: { radius }
    });
    return response.data;
  },

  // Get sensor health
  getSensorHealth: async (sensorId: string): Promise<SensorHealthStatus> => {
    const response: AxiosResponse<SensorHealthStatus> = await api.get(`/sensors/${sensorId}/health`);
    return response.data;
  }
};

// Sensor Readings API
export const readingsApi = {
  // Get sensor readings with filtering
  getReadings: async (params?: {
    sensorId?: string;
    riskLevel?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginatedResponse<SensorReading>> => {
    const response: AxiosResponse<PaginatedResponse<SensorReading>> = await api.get('/readings', { params });
    return response.data;
  },

  // Get specific reading
  getReading: async (readingId: string): Promise<{ reading: SensorReading }> => {
    const response: AxiosResponse<{ reading: SensorReading }> = await api.get(`/readings/${readingId}`);
    return response.data;
  },

  // Create new reading
  createReading: async (readingData: Omit<SensorReading, '_id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<SensorReading>> => {
    const response: AxiosResponse<ApiResponse<SensorReading>> = await api.post('/readings', readingData);
    return response.data;
  },

  // Create batch readings
  createBatchReadings: async (readings: Omit<SensorReading, '_id' | 'createdAt' | 'updatedAt'>[]): Promise<{
    message: string;
    successful: number;
    failed: number;
    results: SensorReading[];
    errors: any[];
  }> => {
    const response = await api.post('/readings/batch', { readings });
    return response.data;
  },

  // Get readings for specific sensor
  getSensorReadings: async (sensorId: string, params?: {
    startTime?: string;
    endTime?: string;
    limit?: number;
    page?: number;
  }): Promise<PaginatedResponse<SensorReading> & { sensorId: string }> => {
    const response = await api.get(`/readings/sensor/${sensorId}`, { params });
    return response.data;
  },

  // Get latest reading for sensor
  getLatestReading: async (sensorId: string): Promise<{ reading: SensorReading }> => {
    const response: AxiosResponse<{ reading: SensorReading }> = await api.get(`/readings/sensor/${sensorId}/latest`);
    return response.data;
  },

  // Get analytics summary
  getAnalyticsSummary: async (timeframe?: string): Promise<{
    timeframe: string;
    totalReadings: number;
    summary: {
      LOW: { count: number; avgConfidence: number; sensors: string[] };
      MEDIUM: { count: number; avgConfidence: number; sensors: string[] };
      HIGH: { count: number; avgConfidence: number; sensors: string[] };
    };
  }> => {
    const response = await api.get('/readings/analytics/summary', {
      params: { timeframe }
    });
    return response.data;
  }
};

// Alerts API
export const alertsApi = {
  // Get alerts with filtering
  getAlerts: async (params?: {
    status?: string;
    riskLevel?: string;
    priority?: string;
    sensorId?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<PaginatedResponse<Alert>> => {
    const response: AxiosResponse<PaginatedResponse<Alert>> = await api.get('/alerts', { params });
    return response.data;
  },

  // Get active alerts
  getActiveAlerts: async (params?: {
    riskLevel?: string;
    priority?: string;
  }): Promise<{
    total: number;
    alerts: Alert[];
    groupedAlerts: {
      CRITICAL: Alert[];
      HIGH: Alert[];
      MEDIUM: Alert[];
      LOW: Alert[];
    };
  }> => {
    const response = await api.get('/alerts/active', { params });
    return response.data;
  },

  // Get specific alert
  getAlert: async (alertId: string): Promise<{ alert: Alert; sensor: Sensor }> => {
    const response: AxiosResponse<{ alert: Alert; sensor: Sensor }> = await api.get(`/alerts/${alertId}`);
    return response.data;
  },

  // Create new alert
  createAlert: async (alertData: Omit<Alert, '_id' | 'alertId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Alert>> => {
    const response: AxiosResponse<ApiResponse<Alert>> = await api.post('/alerts', alertData);
    return response.data;
  },

  // Acknowledge alert
  acknowledgeAlert: async (alertId: string, acknowledgedBy: string): Promise<ApiResponse<Alert>> => {
    const response: AxiosResponse<ApiResponse<Alert>> = await api.patch(`/alerts/${alertId}/acknowledge`, { acknowledgedBy });
    return response.data;
  },

  // Resolve alert
  resolveAlert: async (alertId: string, resolvedBy: string, resolution?: string): Promise<ApiResponse<Alert>> => {
    const response: AxiosResponse<ApiResponse<Alert>> = await api.patch(`/alerts/${alertId}/resolve`, { 
      resolvedBy, 
      resolution 
    });
    return response.data;
  },

  // Escalate alert
  escalateAlert: async (alertId: string, escalatedTo: string): Promise<ApiResponse<Alert>> => {
    const response: AxiosResponse<ApiResponse<Alert>> = await api.patch(`/alerts/${alertId}/escalate`, { escalatedTo });
    return response.data;
  },

  // Add action to alert
  addAlertAction: async (alertId: string, action: string, takenBy: string, notes?: string): Promise<ApiResponse<Alert>> => {
    const response: AxiosResponse<ApiResponse<Alert>> = await api.post(`/alerts/${alertId}/actions`, {
      action,
      takenBy,
      notes
    });
    return response.data;
  },

  // Get dashboard analytics
  getDashboardAnalytics: async (timeframe?: string): Promise<{
    timeframe: string;
    summary: {
      totalAlerts: number;
      activeAlerts: number;
      escalatedAlerts: number;
      alertsNeedingEscalation: number;
    };
    riskLevelDistribution: {
      LOW: number;
      MEDIUM: number;
      HIGH: number;
    };
    priorityDistribution: {
      LOW: number;
      MEDIUM: number;
      HIGH: number;
      CRITICAL: number;
    };
    alertsNeedingEscalation: Alert[];
  }> => {
    const response = await api.get('/alerts/analytics/dashboard', {
      params: { timeframe }
    });
    return response.data;
  }
};

// Health check API
export const healthApi = {
  checkHealth: async (): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    environment: string;
  }> => {
    const response = await api.get('/health');
    return response.data;
  }
};

// Export the main API instance for custom requests
export default api;
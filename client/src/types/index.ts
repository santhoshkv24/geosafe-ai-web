// Sensor data types matching backend schema
export interface SensorLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface MineGrid {
  x: number;
  y: number;
  zone: string;
}

export interface SensorConfiguration {
  readingInterval: number;
  alertThresholds: {
    Rainfall_mm: number;
    Slope_Angle: number;
    Soil_Saturation: number;
    Vegetation_Cover: number;
    Earthquake_Activity: number;
    Proximity_to_Water: number;
    Landslide: number;
  };
}

export interface Sensor {
  _id?: string;
  sensorId: string;
  name: string;
  location: SensorLocation;
  mineGrid: MineGrid;
  sensorType: 'GEOLOGICAL' | 'WEATHER' | 'SEISMIC' | 'COMBINED';
  configuration: SensorConfiguration;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'ERROR';
  lastReading?: SensorReading;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  installationDate: Date;
  lastMaintenanceDate?: Date;
  batteryLevel: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SensorReadings {
  Rainfall_mm: number;
  Slope_Angle: number;
  Soil_Saturation: number;
  Vegetation_Cover: number;
  Earthquake_Activity: number;
  Proximity_to_Water: number;
  Landslide: number;
  Soil_Type_Gravel: boolean;
  Soil_Type_Sand: boolean;
  Soil_Type_Silt: boolean;
}

export interface RiskPrediction {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  factors: string[];
  aiModelVersion: string;
  processingTime?: number;
}

export interface SensorReading {
  _id?: string;
  sensorId: string;
  timestamp: Date;
  readings: SensorReadings;
  riskPrediction: RiskPrediction;
  dataQuality: {
    completeness: number;
    anomalies: Array<{
      type: string;
      field: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
  metadata: {
    source: 'SENSOR' | 'SIMULATION' | 'MANUAL';
    processed: boolean;
    processedAt?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TriggerFactor {
  factor: string;
  value: number;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Alert {
  _id?: string;
  alertId: string;
  sensorId: string;
  sensorReadingId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'FALSE_POSITIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  alertType: 'ROCKFALL_RISK' | 'EQUIPMENT_FAILURE' | 'WEATHER_WARNING' | 'SEISMIC_EVENT';
  location: SensorLocation;
  affectedArea: {
    radius: number;
    riskZone: 'IMMEDIATE' | 'NEARBY' | 'EXTENDED';
  };
  triggerFactors: TriggerFactor[];
  actionsTaken: Array<{
    action: string;
    takenBy: string;
    takenAt: Date;
    notes?: string;
  }>;
  escalation: {
    level: number;
    escalatedAt?: Date;
    escalatedTo?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// WebSocket event types
export interface SocketEvents {
  // Client to server
  authenticate: (data: { role: string; userId: string; name: string }) => void;
  'subscribe-sensor': (sensorId: string) => void;
  'unsubscribe-sensor': (sensorId: string) => void;
  'subscribe-area': (bounds: { north: number; south: number; east: number; west: number }) => void;
  'acknowledge-alert': (data: { alertId: string; acknowledgedBy: string }) => void;
  'request-risk-assessment': (data: { sensorId: string; force?: boolean }) => void;
  ping: () => void;

  // Server to client
  'authentication-success': (data: { message: string; role: string; serverTime: Date }) => void;
  'sensor-reading': (data: { sensorId: string; reading: SensorReading; sensor?: Sensor }) => void;
  'risk-update': (data: { sensorId: string; riskLevel: string; confidence: number; location: SensorLocation; timestamp: Date }) => void;
  'alert-trigger': (data: { alert: Alert; sensor: Sensor; sensorReading: SensorReading }) => void;
  'critical-alert': (data: { alert: Alert; sensor: Sensor; urgent: boolean }) => void;
  'alert-acknowledged': (data: { alertId: string; acknowledgedBy: string; acknowledgedAt: Date }) => void;
  'alert-resolved': (data: { alertId: string; resolvedBy: string; resolution: string; resolvedAt: Date }) => void;
  'alert-escalated': (data: { alertId: string; escalationLevel: number; escalatedTo: string; priority: string }) => void;
  'sensor-status': (data: { sensorId: string; status: string; previousStatus: string }) => void;
  'dashboard-data': (data: { activeAlerts: Alert[]; sensorStats: any; highRiskReadings: SensorReading[] }) => void;
  pong: (data: { serverTime: Date }) => void;
  error: (data: { message: string }) => void;
}

// Dashboard state types
export interface DashboardState {
  sensors: Sensor[];
  activeAlerts: Alert[];
  sensorReadings: { [sensorId: string]: SensorReading };
  selectedSensor: Sensor | null;
  filters: {
    showNormal: boolean;
    showWarning: boolean;
    showAlert: boolean;
  };
  mapBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
}

// Chart data types for visualization
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  riskLevel?: string;
}

export interface SensorHealthStatus {
  sensorId: string;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  issues: string[];
  lastReading?: Date;
  batteryLevel: number;
  status: string;
}
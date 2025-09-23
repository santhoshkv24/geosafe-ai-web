import { Sensor, SensorReading, Alert, SensorLocation, MineGrid } from '../types';

// Southern India mine locations (real mining areas)
const SOUTHERN_INDIA_MINES = [
  {
    name: "Kolar Gold Fields Mine",
    location: { lat: 12.9516, lng: 78.1289 },
    zone: "Karnataka_KGF",
    description: "Historic gold mining area in Karnataka"
  },
  {
    name: "Hutti Gold Mine",
    location: { lat: 15.9430, lng: 76.8910 },
    zone: "Karnataka_Hutti", 
    description: "Active gold mine in Raichur district"
  },
  {
    name: "Sandur Iron Ore Mine",
    location: { lat: 15.1167, lng: 76.5500 },
    zone: "Karnataka_Sandur",
    description: "Iron ore mining in Ballari district"
  },
  {
    name: "Salem Magnesite Mine",
    location: { lat: 11.6643, lng: 78.1460 },
    zone: "TamilNadu_Salem",
    description: "Magnesite mining in Tamil Nadu"
  },
  {
    name: "Neyveli Lignite Mine",
    location: { lat: 11.6173, lng: 79.4829 },
    zone: "TamilNadu_Neyveli",
    description: "Lignite coal mining in Cuddalore district"
  },
  {
    name: "Singareni Coal Mine",
    location: { lat: 18.2636, lng: 79.1500 },
    zone: "Telangana_Singareni",
    description: "Coal mining in Telangana"
  },
  {
    name: "Ramagundam Coal Mine",
    location: { lat: 18.7733, lng: 79.4744 },
    zone: "Telangana_Ramagundam",
    description: "Thermal coal mining area"
  },
  {
    name: "Bailadila Iron Ore Mine",
    location: { lat: 18.0833, lng: 81.3333 },
    zone: "Chhattisgarh_Bailadila",
    description: "Major iron ore mining in Chhattisgarh"
  },
  {
    name: "Kudremukh Iron Ore Mine",
    location: { lat: 13.2904, lng: 75.0729 },
    zone: "Karnataka_Kudremukh",
    description: "Iron ore mining in Western Ghats"
  },
  {
    name: "Hospet Iron Ore Mine",
    location: { lat: 15.2693, lng: 76.3869 },
    zone: "Karnataka_Hospet",
    description: "Iron ore mining near Hampi"
  }
];

// Generate realistic sensor data (readings only, no predictions)
function generateSensorReading(sensorId: string): SensorReading {
  const now = new Date();
  
  // Generate realistic values based on Indian monsoon and geological conditions
  const readings = {
    Rainfall_mm: Math.random() * 250 + (Math.sin(Date.now() / 86400000) * 50 + 50), // Seasonal variation
    Slope_Angle: Math.random() * 60 + 15, // 15-75 degrees
    Soil_Saturation: Math.random() * 0.8 + 0.1, // 0.1 - 0.9
    Vegetation_Cover: Math.random() * 0.7 + 0.2, // 0.2 - 0.9
    Earthquake_Activity: Math.random() * 3 + 0.1, // 0.1 - 3.1 (moderate seismic activity)
    Proximity_to_Water: Math.random() * 500 + 50, // 50-550 meters
    Landslide: Math.random() * 0.6 + 0.1, // 0.1 - 0.7
    Soil_Type_Gravel: Math.random() > 0.6,
    Soil_Type_Sand: Math.random() > 0.5,
    Soil_Type_Silt: Math.random() > 0.7
  };

  // Create sensor reading without prediction (prediction will come from AI service)
  return {
    _id: `reading_${sensorId}_${Date.now()}`,
    sensorId,
    timestamp: now,
    readings,
    riskPrediction: {
      level: 'LOW', // Placeholder, will be updated by AI service
      confidence: 0,
      factors: [],
      aiModelVersion: 'pending'
    },
    dataQuality: {
      completeness: 0.95 + Math.random() * 0.05,
      anomalies: []
    },
    metadata: {
      source: 'SIMULATION',
      processed: false, // Will be processed by AI service
      processedAt: undefined
    },
    createdAt: now,
    updatedAt: now
  };
}

// Sample sensor generation REMOVED - all data comes from backend
// Frontend only receives and displays data from backend

// Sample alert generation REMOVED - all alerts come from backend AI predictions
// Frontend only receives and displays alerts from backend

// Simulation service class
export class SimulationService {
  private sensors: Sensor[] = [];
  private alerts: Alert[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private updateCallbacks: ((sensors: Sensor[], alerts: Alert[]) => void)[] = [];
  private socketService: any = null; // Will be injected
  
  constructor() {
    this.initializeData();
  }
  
  // Inject socket service for real backend communication
  setSocketService(socketService: any) {
    this.socketService = socketService;
    console.log('🔌 Socket service connected to simulation');
  }
  
  private initializeData() {
    // Frontend starts with EMPTY data - only receives from backend
    this.sensors = [];
    this.alerts = [];
    console.log('🔧 Frontend initialized with EMPTY data - waiting for backend');
  }
  
  getSensors(): Sensor[] {
    return this.sensors;
  }
  
  setSensors(sensors: Sensor[]) {
    this.sensors = sensors;
    console.log(`🔧 Simulation service updated with ${sensors.length} sensors from backend`);
    
    // Debug: Show risk level breakdown
    const riskLevels = sensors.reduce((acc: any, sensor) => {
      const level = sensor.riskLevel || 'UNKNOWN';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 Risk level breakdown:', riskLevels);
    
    this.notifyCallbacks();
  }
  
  getAlerts(): Alert[] {
    return this.alerts;
  }
  
  getSensor(sensorId: string): Sensor | undefined {
    return this.sensors.find(s => s.sensorId === sensorId);
  }
  
  onUpdate(callback: (sensors: Sensor[], alerts: Alert[]) => void) {
    this.updateCallbacks.push(callback);
  }
  
  startSimulation(intervalMs: number = 30000) { 
    // Frontend NEVER generates its own data - only receives from backend
    console.log('🔄 Frontend ready to receive sensor data from backend');
    console.log('📡 Listening for real-time sensor readings via WebSocket');
    
    // NO frontend simulation interval - all data comes from backend
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Frontend is purely a data consumer - no generation
    console.log('⚠️ Frontend will NOT generate any sensor data');
  }

  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Frontend simulation stopped');
    }
  }
  
  // Frontend NEVER updates sensor data - all data comes from backend
  private updateNonCriticalSensorData() {
    // This method is disabled - frontend is read-only
    console.log('⚠️ Frontend attempted to update sensor data - this is disabled');
  }  // Handle sensor reading from backend (replaces local generation)
  handleBackendSensorReading(sensorReading: any) {
    const { sensorId, reading, sensor: sensorData } = sensorReading;
    
    // Find and update the sensor
    const sensorIndex = this.sensors.findIndex(s => s.sensorId === sensorId);
    if (sensorIndex !== -1) {
      const updatedSensor = {
        ...this.sensors[sensorIndex],
        lastReading: reading,
        riskLevel: sensorData.riskLevel || reading.riskPrediction.level,
        status: sensorData.status || 'ACTIVE'
      };
      
      this.sensors[sensorIndex] = updatedSensor;
      console.log(`� Updated sensor ${sensorId} from backend: ${reading.riskPrediction.level}`);
    } else {
      // Add new sensor if not found (dynamic sensor addition)
      if (sensorData) {
        const newSensor = this.createSensorFromBackendData(sensorData, reading);
        this.sensors.push(newSensor);
        console.log(`➕ Added new sensor from backend: ${sensorId}`);
      }
    }
    
    this.notifyCallbacks();
  }
  
  // Create sensor object from backend data
  private createSensorFromBackendData(sensorData: any, reading: any): Sensor {
    const [lng, lat] = sensorData.location.coordinates;
    
    return {
      sensorId: sensorData.sensorId,
      name: sensorData.name,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      mineGrid: {
        x: Math.floor(Math.random() * 1000),
        y: Math.floor(Math.random() * 1000),
        zone: sensorData.zone || 'UNKNOWN'
      },
      sensorType: 'COMBINED',
      status: sensorData.status || 'ACTIVE',
      batteryLevel: 80 + Math.random() * 20,
      lastReading: reading,
      riskLevel: reading.riskPrediction.level,
      installationDate: new Date(),
      configuration: {
        readingInterval: 300000, // 5 minutes
        alertThresholds: {
          Rainfall_mm: 50,
          Slope_Angle: 60,
          Soil_Saturation: 0.7,
          Vegetation_Cover: 0.3,
          Earthquake_Activity: 2.0,
          Proximity_to_Water: 100,
          Landslide: 0.5
        }
      }
    };
  }
  
  // Send sensor reading to backend for AI processing
  private sendSensorReadingToBackend(reading: SensorReading) {
    if (!this.socketService) return;
    
    try {
      // Send the reading to backend for AI prediction
      this.socketService.getSocket()?.emit('new-sensor-reading', {
        sensorId: reading.sensorId,
        timestamp: reading.timestamp,
        readings: reading.readings
      });
      
      console.log(`📡 Sent sensor reading to backend: ${reading.sensorId}`);
    } catch (error) {
      console.error('Failed to send sensor reading to backend:', error);
    }
  }
  
  // Handle AI prediction response from backend
  updateSensorWithPrediction(sensorId: string, riskPrediction: any, newReading?: SensorReading) {
    const sensorIndex = this.sensors.findIndex(s => s.sensorId === sensorId);
    if (sensorIndex !== -1) {
      const sensor = this.sensors[sensorIndex];
      
      // Create updated reading if provided
      let updatedReading = newReading;
      if (newReading) {
        updatedReading = {
          ...newReading,
          riskPrediction: riskPrediction,
          metadata: {
            ...newReading.metadata,
            processed: true,
            processedAt: new Date()
          }
        };
      }
      
      // Create new sensor object with AI prediction
      const updatedSensor = {
        ...sensor,
        riskLevel: riskPrediction.level,
        lastReading: updatedReading || sensor.lastReading
      };
      
      // Replace sensor in array
      this.sensors[sensorIndex] = updatedSensor;
      
      console.log(`🤖 AI prediction received for ${sensorId}: ${riskPrediction.level} (${riskPrediction.confidence})`);
      
      // Only generate alert if it's a real HIGH risk prediction from AI service
      // No random generation - alerts only come from AI predictions
      if (riskPrediction.level === 'HIGH' && riskPrediction.confidence > 0.7) {
        this.generateRealAlert(updatedSensor, updatedReading || updatedSensor.lastReading, riskPrediction);
      }
      
      this.notifyCallbacks();
    }
  }
  
  // Generate alert based on real AI prediction (not random)
  private generateRealAlert(sensor: Sensor, reading?: SensorReading, aiPrediction?: any) {
    if (!reading || !aiPrediction) return;
    
    const newAlert: Alert = {
      _id: `alert_${Date.now()}_${Math.random()}`,
      alertId: `ALT_${sensor.sensorId}_${Date.now()}`,
      sensorId: sensor.sensorId,
      sensorReadingId: reading._id || '',
      riskLevel: aiPrediction.level,
      confidence: aiPrediction.confidence,
      triggeredAt: new Date(),
      status: 'ACTIVE',
      priority: aiPrediction.level === 'HIGH' ? 'CRITICAL' : aiPrediction.level === 'MEDIUM' ? 'HIGH' : 'MEDIUM',
      severity: aiPrediction.level === 'HIGH' ? 'CRITICAL' : aiPrediction.level === 'MEDIUM' ? 'HIGH' : 'MEDIUM',
      alertType: 'ROCKFALL_RISK',
      location: sensor.location,
      affectedArea: {
        radius: aiPrediction.level === 'HIGH' ? 300 : aiPrediction.level === 'MEDIUM' ? 200 : 150,
        riskZone: aiPrediction.level === 'HIGH' ? 'IMMEDIATE' : 'NEARBY'
      },
      triggerFactors: (aiPrediction.factors || ['Rainfall_mm', 'Slope_Angle', 'Soil_Saturation']).map((factor: string) => ({
        factor,
        value: (reading.readings as any)[factor] || 0,
        threshold: (sensor.configuration.alertThresholds as any)[factor] || 0,
        severity: aiPrediction.level
      })),
      actionsTaken: [],
      escalation: { level: 0 },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create new alerts array to trigger React re-render
    this.alerts = [newAlert, ...this.alerts.slice(0, 19)]; // Keep only latest 20 alerts
    
    console.log(`🚨 Alert generated: ${newAlert.alertId} - ${aiPrediction.level} risk (Confidence: ${(aiPrediction.confidence * 100).toFixed(1)}%)`);
  }
  
  private notifyCallbacks() {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(this.sensors, this.alerts);
      } catch (error) {
        console.error('Error in simulation callback:', error);
      }
    });
  }
}

// Create singleton instance
export const simulationService = new SimulationService();

// Export the mine locations for map display
export const MINE_LOCATIONS = SOUTHERN_INDIA_MINES;
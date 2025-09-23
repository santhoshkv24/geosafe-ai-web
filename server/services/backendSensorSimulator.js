const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const Alert = require('../models/Alert');
const { getPrediction } = require('./aiService');

class BackendSensorSimulator {
  constructor(io) {
    this.io = io;
    this.sensors = [];
    this.intervalId = null;
    this.isRunning = false;
    this.simulationInterval = 8000; // 8 seconds
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Backend Sensor Simulator...');
      
      // Load all active sensors from database
      this.sensors = await Sensor.find({ status: 'ACTIVE' });
      console.log(`📍 Loaded ${this.sensors.length} active sensors for simulation`);
      
      if (this.sensors.length === 0) {
        console.warn('⚠️ No active sensors found in database');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing sensor simulator:', error);
      return false;
    }
  }

  async startSimulation() {
    if (this.isRunning) {
      console.log('⚠️ Simulation already running');
      return;
    }

    const initialized = await this.initialize();
    if (!initialized) {
      console.error('❌ Failed to initialize sensor simulator');
      return;
    }

    console.log(`🚀 Starting backend sensor simulation with ${this.simulationInterval}ms interval`);
    this.isRunning = true;

    // Generate initial readings for all sensors
    await this.generateBatchReadings();

    // Set up periodic generation
    this.intervalId = setInterval(async () => {
      try {
        await this.generateBatchReadings();
      } catch (error) {
        console.error('❌ Error in simulation cycle:', error);
      }
    }, this.simulationInterval);
  }

  async stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Backend sensor simulation stopped');
  }

  async generateBatchReadings() {
    if (!this.sensors || this.sensors.length === 0) {
      console.warn('⚠️ No sensors available for reading generation');
      return;
    }

    // Select random sensors for this cycle (2-6 sensors)
    const numSensors = Math.floor(Math.random() * 5) + 2;
    const selectedSensors = this.getRandomSensors(numSensors);

    console.log(`📊 Generating readings for ${selectedSensors.length} sensors`);

    // Process sensors in parallel
    const readingPromises = selectedSensors.map(sensor => 
      this.generateSensorReading(sensor)
    );

    try {
      const results = await Promise.allSettled(readingPromises);
      
      // Log results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Generated reading for ${selectedSensors[index].sensorId}`);
        } else {
          console.error(`❌ Failed to generate reading for ${selectedSensors[index].sensorId}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('❌ Error in batch reading generation:', error);
    }
  }

  getRandomSensors(count) {
    const activeSensors = this.sensors.filter(s => s.status === 'ACTIVE');
    const shuffled = [...activeSensors].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, activeSensors.length));
  }

  async generateSensorReading(sensor) {
    try {
      // Generate realistic sensor reading based on sensor type and location
      const readings = this.generateReadingData(sensor);
      
      // Create sensor reading record
      const sensorReading = {
        sensorId: sensor.sensorId,
        timestamp: new Date(),
        readings,
        metadata: {
          source: 'BACKEND_SIMULATION',
          processed: false,
          processedAt: null
        }
      };

      // Send to AI service for prediction
      const aiPrediction = await getPrediction({
        sensorId: sensor.sensorId,
        timestamp: sensorReading.timestamp,
        readings: sensorReading.readings
      });

      // Update reading with AI prediction
      sensorReading.riskPrediction = {
        level: aiPrediction.level,
        confidence: aiPrediction.confidence,
        factors: aiPrediction.factors || ['Rainfall_mm', 'Slope_Angle', 'Soil_Saturation'],
        aiModelVersion: '1.0',
        processingTime: aiPrediction.processingTime || 30
      };

      sensorReading.metadata.processed = true;
      sensorReading.metadata.processedAt = new Date();

      // Save to database
      const savedReading = await SensorReading.create(sensorReading);
      console.log(`💾 Saved reading for ${sensor.sensorId}: ${aiPrediction.level} (${(aiPrediction.confidence * 100).toFixed(1)}%)`);

      // Update sensor's last reading timestamp
      await Sensor.findByIdAndUpdate(sensor._id, {
        lastReading: sensorReading.timestamp
      });

      // Broadcast to frontend via WebSocket
      this.broadcastSensorUpdate(sensor, savedReading, aiPrediction);

      // Generate alert if high risk
      if (aiPrediction.level === 'HIGH' && aiPrediction.confidence > 0.5) {
        await this.generateAlert(sensor, savedReading, aiPrediction);
      }

      return savedReading;

    } catch (error) {
      console.error(`❌ Error generating reading for ${sensor.sensorId}:`, error);
      throw error;
    }
  }

  generateReadingData(sensor) {
    // Generate realistic readings based on sensor location and type
    const baseReadings = {
      Rainfall_mm: this.generateRainfall(sensor),
      Slope_Angle: this.generateSlopeAngle(sensor),
      Soil_Saturation: this.generateSoilSaturation(sensor),
      Vegetation_Cover: this.generateVegetationCover(sensor),
      Earthquake_Activity: this.generateEarthquakeActivity(sensor),
      Proximity_to_Water: this.generateProximityToWater(sensor),
      Landslide: this.generateLandslideRisk(sensor),
      Soil_Type_Gravel: Math.random() > 0.7,
      Soil_Type_Sand: Math.random() > 0.5,
      Soil_Type_Silt: Math.random() > 0.6
    };

    // Add some correlation between factors for realism
    if (baseReadings.Rainfall_mm > 60) {
      baseReadings.Soil_Saturation = Math.min(1, baseReadings.Soil_Saturation + 0.2);
      baseReadings.Landslide = Math.min(1, baseReadings.Landslide + 0.1);
    }

    if (baseReadings.Slope_Angle > 65) {
      baseReadings.Landslide = Math.min(1, baseReadings.Landslide + 0.15);
    }
    
    // Periodically generate HIGH risk conditions for testing (every ~10 readings)
    if (Math.random() < 0.15) { // 15% chance to create high risk conditions
      console.log(`⚡ Generating HIGH risk conditions for sensor ${sensor.sensorId}`);
      baseReadings.Rainfall_mm = 85 + Math.random() * 35; // Very high rainfall (85-120mm)
      baseReadings.Slope_Angle = 70 + Math.random() * 15; // Steep slope (70-85°)
      baseReadings.Soil_Saturation = 0.85 + Math.random() * 0.15; // Very saturated (85-100%)
      baseReadings.Landslide = 0.7 + Math.random() * 0.3; // High landslide risk (70-100%)
      baseReadings.Earthquake_Activity = 3.5 + Math.random() * 2; // High seismic activity (3.5-5.5)
      baseReadings.Vegetation_Cover = 0.1 + Math.random() * 0.3; // Poor vegetation (10-40%)
    }

    return baseReadings;
  }

  generateRainfall(sensor) {
    // Seasonal and regional variations
    const month = new Date().getMonth();
    const isMonsooon = month >= 5 && month <= 9; // June to October
    const base = isMonsooon ? 30 : 10;
    const variation = isMonsooon ? 70 : 40;
    return Math.max(0, base + (Math.random() - 0.3) * variation);
  }

  generateSlopeAngle(sensor) {
    // Based on mine type and location
    const baseAngle = 45 + Math.random() * 30; // 45-75 degrees
    return Math.max(0, Math.min(90, baseAngle + (Math.random() - 0.5) * 10));
  }

  generateSoilSaturation(sensor) {
    // Correlated with rainfall and soil type
    const base = 0.3 + Math.random() * 0.5; // 0.3-0.8
    return Math.max(0, Math.min(1, base));
  }

  generateVegetationCover(sensor) {
    // Based on region (Southern India generally has good vegetation)
    const base = 0.4 + Math.random() * 0.4; // 0.4-0.8
    return Math.max(0, Math.min(1, base));
  }

  generateEarthquakeActivity(sensor) {
    // Southern India has moderate seismic activity
    const base = 0.5 + Math.random() * 2.5; // 0.5-3.0
    return Math.max(0, base);
  }

  generateProximityToWater(sensor) {
    // Distance to nearest water body in meters
    const base = 50 + Math.random() * 300; // 50-350 meters
    return Math.max(0, base);
  }

  generateLandslideRisk(sensor) {
    // Base landslide probability
    const base = 0.1 + Math.random() * 0.6; // 0.1-0.7
    return Math.max(0, Math.min(1, base));
  }

  broadcastSensorUpdate(sensor, reading, aiPrediction) {
    try {
      // Broadcast to all connected clients
      this.io.emit('sensor-reading', {
        sensorId: sensor.sensorId,
        reading: {
          _id: reading._id,
          sensorId: reading.sensorId,
          timestamp: reading.timestamp,
          readings: reading.readings,
          riskPrediction: reading.riskPrediction,
          metadata: reading.metadata
        },
        sensor: {
          sensorId: sensor.sensorId,
          name: sensor.name,
          location: sensor.location,
          status: sensor.status,
          riskLevel: aiPrediction.level
        }
      });

      // Broadcast risk update
      this.io.emit('risk-update', {
        sensorId: sensor.sensorId,
        riskLevel: aiPrediction.level,
        confidence: aiPrediction.confidence,
        location: sensor.location,
        timestamp: reading.timestamp
      });

      console.log(`📡 Broadcasted update for ${sensor.sensorId}: ${aiPrediction.level}`);
    } catch (error) {
      console.error(`❌ Error broadcasting update for ${sensor.sensorId}:`, error);
    }
  }

  async generateAlert(sensor, reading, aiPrediction) {
    try {
      const alertId = `ALERT_${Date.now()}_${sensor.sensorId}`;
      
      const alert = new Alert({
        alertId: alertId,
        sensorId: sensor.sensorId,
        sensorReadingId: reading._id,
        riskLevel: aiPrediction.level,
        confidence: aiPrediction.confidence,
        triggeredAt: new Date(),
        status: 'ACTIVE',
        priority: 'CRITICAL',
        alertType: 'ROCKFALL_RISK',
        location: sensor.location,
        affectedArea: {
          radius: 200,
          riskZone: 'IMMEDIATE'
        },
        triggerFactors: aiPrediction.factors.map(factor => ({
          factor,
          value: reading.readings[factor] || 0,
          threshold: sensor.configuration?.alertThresholds?.[factor] || 0,
          severity: aiPrediction.level
        }))
      });

      const savedAlert = await alert.save();
      console.log(`🚨 Generated HIGH risk alert: ${savedAlert.alertId}`);

      // Broadcast alert
      this.io.emit('alert-trigger', {
        alert: savedAlert,
        sensor,
        urgent: true
      });

      return savedAlert;
    } catch (error) {
      console.error(`❌ Error generating alert for ${sensor.sensorId}:`, error);
      throw error;
    }
  }

  // Get simulation status
  getStatus() {
    return {
      isRunning: this.isRunning,
      sensorCount: this.sensors.length,
      interval: this.simulationInterval,
      activeSensors: this.sensors.filter(s => s.status === 'ACTIVE').length
    };
  }

  // Update simulation interval
  setInterval(newInterval) {
    this.simulationInterval = newInterval;
    if (this.isRunning) {
      this.stopSimulation();
      this.startSimulation();
    }
  }
}

module.exports = BackendSensorSimulator;
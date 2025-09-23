const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');

// Validation schemas
const sensorValidationSchema = Joi.object({
  sensorId: Joi.string().required().trim().uppercase(),
  name: Joi.string().required().trim().max(100),
  location: Joi.object({
    coordinates: Joi.array().items(Joi.number()).length(2).required()
  }).required(),
  mineGrid: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required(),
    zone: Joi.string().required().trim()
  }).required(),
  sensorType: Joi.string().valid('GEOLOGICAL', 'WEATHER', 'SEISMIC', 'COMBINED'),
  configuration: Joi.object({
    readingInterval: Joi.number().min(60000).max(3600000), // 1 minute to 1 hour
    alertThresholds: Joi.object({
      Rainfall_mm: Joi.number().min(0).max(1000),
      Slope_Angle: Joi.number().min(0).max(90),
      Soil_Saturation: Joi.number().min(0).max(1),
      Vegetation_Cover: Joi.number().min(0).max(1),
      Earthquake_Activity: Joi.number().min(0).max(10),
      Proximity_to_Water: Joi.number().min(0),
      Landslide: Joi.number().min(0).max(1)
    })
  }),
  batteryLevel: Joi.number().min(0).max(100)
});

// GET /api/sensors - Get all sensors
router.get('/', async (req, res) => {
  try {
    const { status, zone, limit = 50, page = 1 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (zone) filter['mineGrid.zone'] = zone;
    
    const sensors = await Sensor.find(filter)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Sensor.countDocuments(filter);
    
    res.json({
      sensors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensors', details: error.message });
  }
});

// GET /api/sensors/:sensorId - Get specific sensor
router.get('/:sensorId', async (req, res) => {
  try {
    const sensor = await Sensor.findOne({ sensorId: req.params.sensorId.toUpperCase() });
    
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    // Get latest reading for this sensor
    const latestReading = await SensorReading.getLatestForSensor(sensor.sensorId);
    
    res.json({
      sensor,
      latestReading
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor', details: error.message });
  }
});

// POST /api/sensors - Create new sensor
router.post('/', async (req, res) => {
  try {
    const { error, value } = sensorValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message) 
      });
    }
    
    // Check if sensor with this ID already exists
    const existingSensor = await Sensor.findOne({ sensorId: value.sensorId });
    if (existingSensor) {
      return res.status(409).json({ error: 'Sensor with this ID already exists' });
    }
    
    const sensor = new Sensor(value);
    await sensor.save();
    
    res.status(201).json({ 
      message: 'Sensor created successfully', 
      sensor 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sensor', details: error.message });
  }
});

// PUT /api/sensors/:sensorId - Update sensor
router.put('/:sensorId', async (req, res) => {
  try {
    const { error, value } = sensorValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message) 
      });
    }
    
    const sensor = await Sensor.findOneAndUpdate(
      { sensorId: req.params.sensorId.toUpperCase() },
      value,
      { new: true, runValidators: true }
    );
    
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    res.json({ 
      message: 'Sensor updated successfully', 
      sensor 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sensor', details: error.message });
  }
});

// PATCH /api/sensors/:sensorId/status - Update sensor status
router.patch('/:sensorId/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ERROR'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be ACTIVE, INACTIVE, MAINTENANCE, or ERROR' 
      });
    }
    
    const sensor = await Sensor.findOneAndUpdate(
      { sensorId: req.params.sensorId.toUpperCase() },
      { status },
      { new: true }
    );
    
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    res.json({ 
      message: 'Sensor status updated successfully', 
      sensor 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sensor status', details: error.message });
  }
});

// DELETE /api/sensors/:sensorId - Delete sensor
router.delete('/:sensorId', async (req, res) => {
  try {
    const sensor = await Sensor.findOneAndDelete({ sensorId: req.params.sensorId.toUpperCase() });
    
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    // Also delete associated readings (optional - you might want to keep them for historical data)
    // await SensorReading.deleteMany({ sensorId: sensor.sensorId });
    
    res.json({ 
      message: 'Sensor deleted successfully',
      deletedSensor: sensor
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sensor', details: error.message });
  }
});

// GET /api/sensors/nearby/:lat/:lng - Get sensors near coordinates
router.get('/nearby/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { radius = 1000 } = req.query; // default 1km radius
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    const sensors = await Sensor.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: parseInt(radius)
        }
      },
      status: 'ACTIVE'
    });
    
    res.json({ sensors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to find nearby sensors', details: error.message });
  }
});

// GET /api/sensors/:sensorId/health - Get sensor health status
router.get('/:sensorId/health', async (req, res) => {
  try {
    const sensor = await Sensor.findOne({ sensorId: req.params.sensorId.toUpperCase() });
    
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    const latestReading = await SensorReading.getLatestForSensor(sensor.sensorId);
    const now = new Date();
    
    let healthStatus = 'HEALTHY';
    let issues = [];
    
    // Check battery level
    if (sensor.batteryLevel < 20) {
      healthStatus = 'WARNING';
      issues.push(`Low battery: ${sensor.batteryLevel}%`);
    }
    
    if (sensor.batteryLevel < 10) {
      healthStatus = 'CRITICAL';
    }
    
    // Check last reading time
    if (latestReading) {
      const timeSinceLastReading = now - latestReading.timestamp;
      const expectedInterval = sensor.configuration?.readingInterval || 300000; // 5 minutes default
      
      if (timeSinceLastReading > expectedInterval * 2) {
        healthStatus = healthStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
        issues.push(`No recent readings (last: ${Math.floor(timeSinceLastReading / 60000)} minutes ago)`);
      }
      
      if (timeSinceLastReading > expectedInterval * 5) {
        healthStatus = 'CRITICAL';
      }
    } else {
      healthStatus = 'CRITICAL';
      issues.push('No readings available');
    }
    
    // Check sensor status
    if (sensor.status !== 'ACTIVE') {
      healthStatus = 'WARNING';
      issues.push(`Sensor status: ${sensor.status}`);
    }
    
    res.json({
      sensorId: sensor.sensorId,
      healthStatus,
      issues,
      lastReading: latestReading?.timestamp,
      batteryLevel: sensor.batteryLevel,
      status: sensor.status
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sensor health', details: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const SensorReading = require('../models/SensorReading');
const Sensor = require('../models/Sensor');
const aiService = require('../services/aiService');

// Validation schema for sensor readings
const readingValidationSchema = Joi.object({
  sensorId: Joi.string().required().trim().uppercase(),
  timestamp: Joi.date().optional(),
  readings: Joi.object({
    Rainfall_mm: Joi.number().min(0).max(1000).required(),
    Slope_Angle: Joi.number().min(0).max(90).required(),
    Soil_Saturation: Joi.number().min(0).max(1).required(),
    Vegetation_Cover: Joi.number().min(0).max(1).required(),
    Earthquake_Activity: Joi.number().min(0).max(10).required(),
    Proximity_to_Water: Joi.number().min(0).required(),
    Landslide: Joi.number().min(0).max(1).required(),
    Soil_Type_Gravel: Joi.boolean().required(),
    Soil_Type_Sand: Joi.boolean().required(),
    Soil_Type_Silt: Joi.boolean().required()
  }).required(),
  metadata: Joi.object({
    source: Joi.string().valid('SENSOR', 'SIMULATION', 'MANUAL').default('SENSOR')
  }).optional()
});

// GET /api/readings - Get sensor readings with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      sensorId, 
      riskLevel, 
      startTime, 
      endTime, 
      limit = 50, 
      page = 1,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;
    
    const filter = {};
    
    if (sensorId) {
      filter.sensorId = sensorId.toUpperCase();
    }
    
    if (riskLevel) {
      filter['riskPrediction.level'] = riskLevel;
    }
    
    if (startTime || endTime) {
      filter.timestamp = {};
      if (startTime) filter.timestamp.$gte = new Date(startTime);
      if (endTime) filter.timestamp.$lte = new Date(endTime);
    }
    
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection };
    
    const readings = await SensorReading.find(filter)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort(sortObj)
      .populate('sensorId', 'name location');
    
    const total = await SensorReading.countDocuments(filter);
    
    res.json({
      readings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch readings', details: error.message });
  }
});

// GET /api/readings/:id - Get specific reading
router.get('/:id', async (req, res) => {
  try {
    const reading = await SensorReading.findById(req.params.id);
    
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }
    
    res.json({ reading });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reading', details: error.message });
  }
});

// POST /api/readings - Create new sensor reading (with AI prediction)
router.post('/', async (req, res) => {
  try {
    const { error, value } = readingValidationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message) 
      });
    }
    
    // Verify sensor exists
    const sensor = await Sensor.findOne({ sensorId: value.sensorId });
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    // Get AI prediction
    let aiPrediction;
    try {
      aiPrediction = await aiService.getPrediction(value);
    } catch (aiError) {
      console.error('AI Service Error:', aiError.message);
      // Fallback prediction based on simple rules
      aiPrediction = generateFallbackPrediction(value.readings);
    }
    
    // Create sensor reading with prediction
    const readingData = {
      ...value,
      riskPrediction: aiPrediction,
      metadata: {
        ...value.metadata,
        processed: true,
        processedAt: new Date()
      }
    };
    
    const reading = new SensorReading(readingData);
    await reading.save();
    
    // Update sensor's last reading timestamp
    await Sensor.findOneAndUpdate(
      { sensorId: value.sensorId },
      { lastReading: reading.timestamp }
    );
    
    // Emit real-time update via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('sensor-reading', {
        sensorId: reading.sensorId,
        reading: reading,
        sensor: sensor
      });
      
      // Emit risk update if high risk
      if (aiPrediction.level === 'HIGH') {
        io.emit('risk-update', {
          sensorId: reading.sensorId,
          riskLevel: aiPrediction.level,
          confidence: aiPrediction.confidence,
          location: sensor.location,
          timestamp: reading.timestamp
        });
      }
    }
    
    res.status(201).json({ 
      message: 'Reading created successfully', 
      reading 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create reading', details: error.message });
  }
});

// POST /api/readings/batch - Create multiple readings
router.post('/batch', async (req, res) => {
  try {
    const { readings } = req.body;
    
    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'Readings array is required' });
    }
    
    if (readings.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 readings per batch' });
    }
    
    const results = [];
    const errors = [];
    
    for (const [index, readingData] of readings.entries()) {
      try {
        const { error, value } = readingValidationSchema.validate(readingData);
        
        if (error) {
          errors.push({ index, error: error.details.map(d => d.message) });
          continue;
        }
        
        // Verify sensor exists
        const sensor = await Sensor.findOne({ sensorId: value.sensorId });
        if (!sensor) {
          errors.push({ index, error: 'Sensor not found' });
          continue;
        }
        
        // Get AI prediction
        let aiPrediction;
        try {
          aiPrediction = await aiService.getPrediction(value);
        } catch (aiError) {
          aiPrediction = generateFallbackPrediction(value.readings);
        }
        
        const reading = new SensorReading({
          ...value,
          riskPrediction: aiPrediction,
          metadata: {
            ...value.metadata,
            processed: true,
            processedAt: new Date()
          }
        });
        
        await reading.save();
        results.push(reading);
        
        // Update sensor's last reading timestamp
        await Sensor.findOneAndUpdate(
          { sensorId: value.sensorId },
          { lastReading: reading.timestamp }
        );
        
      } catch (processError) {
        errors.push({ index, error: processError.message });
      }
    }
    
    res.status(201).json({
      message: `Processed ${readings.length} readings`,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process batch readings', details: error.message });
  }
});

// GET /api/readings/sensor/:sensorId - Get readings for specific sensor
router.get('/sensor/:sensorId', async (req, res) => {
  try {
    const { startTime, endTime, limit = 50, page = 1 } = req.query;
    const sensorId = req.params.sensorId.toUpperCase();
    
    const filter = { sensorId };
    
    if (startTime || endTime) {
      filter.timestamp = {};
      if (startTime) filter.timestamp.$gte = new Date(startTime);
      if (endTime) filter.timestamp.$lte = new Date(endTime);
    }
    
    const readings = await SensorReading.find(filter)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ timestamp: -1 });
    
    const total = await SensorReading.countDocuments(filter);
    
    res.json({
      sensorId,
      readings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor readings', details: error.message });
  }
});

// GET /api/readings/sensor/:sensorId/latest - Get latest reading for sensor
router.get('/sensor/:sensorId/latest', async (req, res) => {
  try {
    const sensorId = req.params.sensorId.toUpperCase();
    
    const reading = await SensorReading.getLatestForSensor(sensorId);
    
    if (!reading) {
      return res.status(404).json({ error: 'No readings found for this sensor' });
    }
    
    res.json({ reading });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest reading', details: error.message });
  }
});

// GET /api/readings/analytics/summary - Get readings summary analytics
router.get('/analytics/summary', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    let startTime;
    const now = new Date();
    
    switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const summary = await SensorReading.aggregate([
      {
        $match: {
          timestamp: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: '$riskPrediction.level',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$riskPrediction.confidence' },
          sensors: { $addToSet: '$sensorId' }
        }
      }
    ]);
    
    const totalReadings = await SensorReading.countDocuments({
      timestamp: { $gte: startTime }
    });
    
    res.json({
      timeframe,
      totalReadings,
      summary: {
        LOW: summary.find(s => s._id === 'LOW') || { count: 0, avgConfidence: 0, sensors: [] },
        MEDIUM: summary.find(s => s._id === 'MEDIUM') || { count: 0, avgConfidence: 0, sensors: [] },
        HIGH: summary.find(s => s._id === 'HIGH') || { count: 0, avgConfidence: 0, sensors: [] }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

// Fallback prediction function when AI service is unavailable
function generateFallbackPrediction(readings) {
  let riskScore = 0;
  const factors = [];
  
  // Simple rule-based risk assessment using new attributes
  if (readings.Slope_Angle > 50) {
    riskScore += 30;
    factors.push('Slope_Angle');
  }
  
  if (readings.Rainfall_mm > 50) {
    riskScore += 25;
    factors.push('Rainfall_mm');
  }
  
  if (readings.Earthquake_Activity > 2.0) {
    riskScore += 20;
    factors.push('Earthquake_Activity');
  }
  
  if (readings.Soil_Saturation > 0.7) {
    riskScore += 15;
    factors.push('Soil_Saturation');
  }
  
  if (readings.Vegetation_Cover < 0.3) {
    riskScore += 10;
    factors.push('Vegetation_Cover');
  }
  
  if (readings.Proximity_to_Water < 50) { // Close to water
    riskScore += 10;
    factors.push('Proximity_to_Water');
  }
  
  if (readings.Landslide > 0.5) {
    riskScore += 25;
    factors.push('Landslide');
  }
  
  // Soil type considerations
  if (readings.Soil_Type_Sand && readings.Soil_Saturation > 0.5) {
    riskScore += 5;
    factors.push('Soil_Type_Sand');
  }
  
  if (readings.Soil_Type_Silt && readings.Rainfall_mm > 30) {
    riskScore += 8;
    factors.push('Soil_Type_Silt');
  }
  
  let level, confidence;
  
  if (riskScore >= 60) {
    level = 'HIGH';
    confidence = 0.7;
  } else if (riskScore >= 30) {
    level = 'MEDIUM';
    confidence = 0.6;
  } else {
    level = 'LOW';
    confidence = 0.8;
  }
  
  return {
    level,
    confidence,
    factors,
    aiModelVersion: 'fallback-2.0',
    processingTime: 10
  };
}

module.exports = router;
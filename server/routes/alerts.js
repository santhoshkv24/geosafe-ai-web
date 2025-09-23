const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Alert = require('../models/Alert');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');

// Validation schema for alerts
const alertValidationSchema = Joi.object({
  sensorId: Joi.string().required().trim().uppercase(),
  sensorReadingId: Joi.string().required(),
  riskLevel: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').required(),
  confidence: Joi.number().min(0).max(1).required(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
  alertType: Joi.string().valid('ROCKFALL_RISK', 'EQUIPMENT_FAILURE', 'WEATHER_WARNING', 'SEISMIC_EVENT').default('ROCKFALL_RISK'),
  affectedArea: Joi.object({
    radius: Joi.number().min(1).max(10000),
    riskZone: Joi.string().valid('IMMEDIATE', 'NEARBY', 'EXTENDED')
  }).optional(),
  triggerFactors: Joi.array().items(Joi.object({
    factor: Joi.string().valid('Rainfall_mm', 'Slope_Angle', 'Soil_Saturation', 'Vegetation_Cover', 'Earthquake_Activity', 'Proximity_to_Water', 'Landslide', 'Soil_Type_Gravel', 'Soil_Type_Sand', 'Soil_Type_Silt').required(),
    value: Joi.number().required(),
    threshold: Joi.number().required(),
    severity: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').required()
  })).optional()
});

// GET /api/alerts - Get all alerts with filtering
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      riskLevel, 
      priority, 
      sensorId,
      startTime,
      endTime,
      limit = 50, 
      page = 1,
      sortBy = 'triggeredAt',
      sortOrder = 'desc'
    } = req.query;
    
    const filter = {};
    
    if (status) filter.status = status;
    if (riskLevel) filter.riskLevel = riskLevel;
    if (priority) filter.priority = priority;
    if (sensorId) filter.sensorId = sensorId.toUpperCase();
    
    if (startTime || endTime) {
      filter.triggeredAt = {};
      if (startTime) filter.triggeredAt.$gte = new Date(startTime);
      if (endTime) filter.triggeredAt.$lte = new Date(endTime);
    }
    
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection };
    
    const alerts = await Alert.find(filter)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort(sortObj)
      .populate('sensorReadingId');
    
    const total = await Alert.countDocuments(filter);
    
    res.json({
      alerts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
});

// GET /api/alerts/active - Get all active alerts
router.get('/active', async (req, res) => {
  try {
    const { riskLevel, priority } = req.query;
    
    const filter = { status: 'ACTIVE' };
    if (riskLevel) filter.riskLevel = riskLevel;
    if (priority) filter.priority = priority;
    
    const alerts = await Alert.find(filter)
      .sort({ priority: -1, triggeredAt: -1 })
      .populate('sensorReadingId');
    
    // Group by priority for easier frontend handling
    const groupedAlerts = {
      CRITICAL: alerts.filter(a => a.priority === 'CRITICAL'),
      HIGH: alerts.filter(a => a.priority === 'HIGH'),
      MEDIUM: alerts.filter(a => a.priority === 'MEDIUM'),
      LOW: alerts.filter(a => a.priority === 'LOW')
    };
    
    res.json({
      total: alerts.length,
      alerts,
      groupedAlerts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active alerts', details: error.message });
  }
});

// GET /api/alerts/:alertId - Get specific alert
router.get('/:alertId', async (req, res) => {
  try {
    const alert = await Alert.findOne({ alertId: req.params.alertId })
      .populate('sensorReadingId');
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    // Get sensor information
    const sensor = await Sensor.findOne({ sensorId: alert.sensorId });
    
    res.json({
      alert,
      sensor
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alert', details: error.message });
  }
});

// POST /api/alerts - Create new alert
router.post('/', async (req, res) => {
  try {
    const { error, value } = alertValidationSchema.validate(req.body);
    
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
    
    // Verify sensor reading exists
    const sensorReading = await SensorReading.findById(value.sensorReadingId);
    if (!sensorReading) {
      return res.status(404).json({ error: 'Sensor reading not found' });
    }
    
    // Generate unique alert ID
    const alertId = `ALERT_${Date.now()}_${value.sensorId}`;
    
    // Create alert with sensor location
    const alertData = {
      ...value,
      alertId,
      location: sensor.location,
      metadata: {
        aiModelVersion: sensorReading.riskPrediction?.aiModelVersion,
        processingTime: sensorReading.riskPrediction?.processingTime
      }
    };
    
    const alert = new Alert(alertData);
    await alert.save();
    
    // Emit real-time alert via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.emit('alert-trigger', {
        alert,
        sensor,
        sensorReading
      });
      
      // Emit to specific room for high priority alerts
      if (alert.priority === 'CRITICAL' || alert.priority === 'HIGH') {
        io.to('operators').emit('critical-alert', {
          alert,
          sensor,
          urgent: true
        });
      }
    }
    
    res.status(201).json({ 
      message: 'Alert created successfully', 
      alert 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create alert', details: error.message });
  }
});

// PATCH /api/alerts/:alertId/acknowledge - Acknowledge alert
router.patch('/:alertId/acknowledge', async (req, res) => {
  try {
    const { acknowledgedBy } = req.body;
    
    if (!acknowledgedBy) {
      return res.status(400).json({ error: 'acknowledgedBy is required' });
    }
    
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only active alerts can be acknowledged' });
    }
    
    await alert.acknowledge(acknowledgedBy);
    
    // Emit real-time update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('alert-acknowledged', {
        alertId: alert.alertId,
        acknowledgedBy,
        acknowledgedAt: alert.acknowledgedAt
      });
    }
    
    res.json({ 
      message: 'Alert acknowledged successfully', 
      alert 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge alert', details: error.message });
  }
});

// PATCH /api/alerts/:alertId/resolve - Resolve alert
router.patch('/:alertId/resolve', async (req, res) => {
  try {
    const { resolvedBy, resolution = 'RESOLVED' } = req.body;
    
    if (!resolvedBy) {
      return res.status(400).json({ error: 'resolvedBy is required' });
    }
    
    if (!['RESOLVED', 'FALSE_POSITIVE'].includes(resolution)) {
      return res.status(400).json({ error: 'Invalid resolution type' });
    }
    
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    if (alert.status === 'RESOLVED' || alert.status === 'FALSE_POSITIVE') {
      return res.status(400).json({ error: 'Alert is already resolved' });
    }
    
    await alert.resolve(resolvedBy, resolution);
    
    // Emit real-time update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('alert-resolved', {
        alertId: alert.alertId,
        resolvedBy,
        resolution,
        resolvedAt: alert.resolvedAt
      });
    }
    
    res.json({ 
      message: 'Alert resolved successfully', 
      alert 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve alert', details: error.message });
  }
});

// PATCH /api/alerts/:alertId/escalate - Escalate alert
router.patch('/:alertId/escalate', async (req, res) => {
  try {
    const { escalatedTo } = req.body;
    
    if (!escalatedTo) {
      return res.status(400).json({ error: 'escalatedTo is required' });
    }
    
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only active alerts can be escalated' });
    }
    
    if (alert.escalation.level >= 3) {
      return res.status(400).json({ error: 'Alert is already at maximum escalation level' });
    }
    
    await alert.escalate(escalatedTo);
    
    // Emit real-time update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('alert-escalated', {
        alertId: alert.alertId,
        escalationLevel: alert.escalation.level,
        escalatedTo,
        priority: alert.priority
      });
    }
    
    res.json({ 
      message: 'Alert escalated successfully', 
      alert 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to escalate alert', details: error.message });
  }
});

// POST /api/alerts/:alertId/actions - Add action taken for alert
router.post('/:alertId/actions', async (req, res) => {
  try {
    const { action, takenBy, notes } = req.body;
    
    if (!action || !takenBy) {
      return res.status(400).json({ error: 'action and takenBy are required' });
    }
    
    const alert = await Alert.findOne({ alertId: req.params.alertId });
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    alert.actionsTaken.push({
      action,
      takenBy,
      notes,
      takenAt: new Date()
    });
    
    await alert.save();
    
    res.json({ 
      message: 'Action recorded successfully', 
      alert 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record action', details: error.message });
  }
});

// GET /api/alerts/analytics/dashboard - Get alert dashboard analytics
router.get('/analytics/dashboard', async (req, res) => {
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
    
    const [totalAlerts, activeAlerts, riskLevelStats, priorityStats, escalatedAlerts] = await Promise.all([
      Alert.countDocuments({ triggeredAt: { $gte: startTime } }),
      Alert.countDocuments({ status: 'ACTIVE' }),
      Alert.aggregate([
        { $match: { triggeredAt: { $gte: startTime } } },
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } }
      ]),
      Alert.aggregate([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Alert.countDocuments({ 
        status: 'ACTIVE', 
        'escalation.level': { $gt: 0 } 
      })
    ]);
    
    // Get alerts that need escalation
    const alertsNeedingEscalation = await Alert.getAlertsNeedingEscalation();
    
    res.json({
      timeframe,
      summary: {
        totalAlerts,
        activeAlerts,
        escalatedAlerts,
        alertsNeedingEscalation: alertsNeedingEscalation.length
      },
      riskLevelDistribution: {
        LOW: riskLevelStats.find(s => s._id === 'LOW')?.count || 0,
        MEDIUM: riskLevelStats.find(s => s._id === 'MEDIUM')?.count || 0,
        HIGH: riskLevelStats.find(s => s._id === 'HIGH')?.count || 0
      },
      priorityDistribution: {
        LOW: priorityStats.find(s => s._id === 'LOW')?.count || 0,
        MEDIUM: priorityStats.find(s => s._id === 'MEDIUM')?.count || 0,
        HIGH: priorityStats.find(s => s._id === 'HIGH')?.count || 0,
        CRITICAL: priorityStats.find(s => s._id === 'CRITICAL')?.count || 0
      },
      alertsNeedingEscalation
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard analytics', details: error.message });
  }
});

module.exports = router;
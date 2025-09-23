const express = require('express');
const router = express.Router();
const SensorReading = require('../models/SensorReading');
const Sensor = require('../models/Sensor');

// Get historical sensor readings for analysis
router.get('/readings/historical', async (req, res) => {
  try {
    const { 
      sensorId, 
      startDate, 
      endDate, 
      riskLevel, 
      limit = 1000,
      page = 1 
    } = req.query;
    
    // Build query
    const query = {};
    
    if (sensorId) {
      query.sensorId = sensorId.toUpperCase();
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    if (riskLevel) {
      query['riskPrediction.level'] = riskLevel.toUpperCase();
    }
    
    // Execute query with pagination
    const readings = await SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    // Get total count for pagination
    const totalCount = await SensorReading.countDocuments(query);
    
    res.json({
      readings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching historical readings:', error);
    res.status(500).json({ error: 'Failed to fetch historical readings' });
  }
});

// Get sensor readings aggregated by time periods (for trend analysis)
router.get('/readings/aggregated', async (req, res) => {
  try {
    const { 
      sensorId, 
      startDate, 
      endDate, 
      interval = 'hour' // hour, day, week, month
    } = req.query;
    
    // Build match stage
    const matchStage = {};
    
    if (sensorId) {
      matchStage.sensorId = sensorId.toUpperCase();
    }
    
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }
    
    // Define date grouping based on interval
    let dateGroup = {};
    switch (interval) {
      case 'hour':
        dateGroup = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' }
        };
        break;
      case 'day':
        dateGroup = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        };
        break;
      case 'week':
        dateGroup = {
          year: { $year: '$timestamp' },
          week: { $week: '$timestamp' }
        };
        break;
      case 'month':
        dateGroup = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' }
        };
        break;
      default:
        dateGroup = {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' },
          hour: { $hour: '$timestamp' }
        };
    }
    
    const aggregatedData = await SensorReading.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: dateGroup,
          count: { $sum: 1 },
          avgRainfall: { $avg: '$readings.Rainfall_mm' },
          avgSlopeAngle: { $avg: '$readings.Slope_Angle' },
          avgSoilSaturation: { $avg: '$readings.Soil_Saturation' },
          avgVegetationCover: { $avg: '$readings.Vegetation_Cover' },
          avgEarthquakeActivity: { $avg: '$readings.Earthquake_Activity' },
          avgProximityToWater: { $avg: '$readings.Proximity_to_Water' },
          avgLandslide: { $avg: '$readings.Landslide' },
          riskLevels: {
            $push: '$riskPrediction.level'
          },
          avgConfidence: { $avg: '$riskPrediction.confidence' }
        }
      },
      {
        $addFields: {
          riskDistribution: {
            LOW: {
              $size: {
                $filter: {
                  input: '$riskLevels',
                  cond: { $eq: ['$$this', 'LOW'] }
                }
              }
            },
            MEDIUM: {
              $size: {
                $filter: {
                  input: '$riskLevels',
                  cond: { $eq: ['$$this', 'MEDIUM'] }
                }
              }
            },
            HIGH: {
              $size: {
                $filter: {
                  input: '$riskLevels',
                  cond: { $eq: ['$$this', 'HIGH'] }
                }
              }
            }
          }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1, '_id.hour': -1 } }
    ]);
    
    res.json({
      interval,
      data: aggregatedData
    });
    
  } catch (error) {
    console.error('Error fetching aggregated readings:', error);
    res.status(500).json({ error: 'Failed to fetch aggregated readings' });
  }
});

// Get risk pattern analysis for predictive modeling
router.get('/analysis/risk-patterns', async (req, res) => {
  try {
    const { sensorId, days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const query = {
      timestamp: { $gte: startDate }
    };
    
    if (sensorId) {
      query.sensorId = sensorId.toUpperCase();
    }
    
    // Get risk escalation patterns
    const riskPatterns = await SensorReading.aggregate([
      { $match: query },
      { $sort: { sensorId: 1, timestamp: 1 } },
      {
        $group: {
          _id: '$sensorId',
          readings: {
            $push: {
              timestamp: '$timestamp',
              riskLevel: '$riskPrediction.level',
              confidence: '$riskPrediction.confidence',
              readings: '$readings'
            }
          }
        }
      },
      {
        $addFields: {
          riskTransitions: {
            $map: {
              input: { $range: [1, { $size: '$readings' }] },
              as: 'index',
              in: {
                from: { $arrayElemAt: ['$readings.riskLevel', { $subtract: ['$$index', 1] }] },
                to: { $arrayElemAt: ['$readings.riskLevel', '$$index'] },
                timestamp: { $arrayElemAt: ['$readings.timestamp', '$$index'] },
                confidence: { $arrayElemAt: ['$readings.confidence', '$$index'] }
              }
            }
          }
        }
      }
    ]);
    
    // Calculate correlation between factors and risk levels
    const correlationData = await SensorReading.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$riskPrediction.level',
          count: { $sum: 1 },
          avgRainfall: { $avg: '$readings.Rainfall_mm' },
          avgSlopeAngle: { $avg: '$readings.Slope_Angle' },
          avgSoilSaturation: { $avg: '$readings.Soil_Saturation' },
          avgVegetationCover: { $avg: '$readings.Vegetation_Cover' },
          avgEarthquakeActivity: { $avg: '$readings.Earthquake_Activity' },
          avgProximityToWater: { $avg: '$readings.Proximity_to_Water' },
          avgLandslide: { $avg: '$readings.Landslide' }
        }
      }
    ]);
    
    res.json({
      timeRange: {
        startDate,
        endDate: new Date(),
        days: parseInt(days)
      },
      riskPatterns,
      correlationData
    });
    
  } catch (error) {
    console.error('Error analyzing risk patterns:', error);
    res.status(500).json({ error: 'Failed to analyze risk patterns' });
  }
});

// Get sensor data summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const { timeRange = 24 } = req.query; // hours
    
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - parseInt(timeRange));
    
    const summary = await SensorReading.aggregate([
      {
        $match: {
          timestamp: { $gte: startTime }
        }
      },
      {
        $group: {
          _id: null,
          totalReadings: { $sum: 1 },
          uniqueSensors: { $addToSet: '$sensorId' },
          riskLevels: {
            $push: '$riskPrediction.level'
          },
          avgConfidence: { $avg: '$riskPrediction.confidence' },
          lastReading: { $max: '$timestamp' }
        }
      },
      {
        $addFields: {
          uniqueSensorCount: { $size: '$uniqueSensors' },
          riskDistribution: {
            LOW: {
              $size: {
                $filter: {
                  input: '$riskLevels',
                  cond: { $eq: ['$$this', 'LOW'] }
                }
              }
            },
            MEDIUM: {
              $size: {
                $filter: {
                  input: '$riskLevels',
                  cond: { $eq: ['$$this', 'MEDIUM'] }
                }
              }
            },
            HIGH: {
              $size: {
                $filter: {
                  input: '$riskLevels',
                  cond: { $eq: ['$$this', 'HIGH'] }
                }
              }
            }
          }
        }
      }
    ]);
    
    res.json({
      timeRange: `${timeRange} hours`,
      summary: summary[0] || {
        totalReadings: 0,
        uniqueSensorCount: 0,
        riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0 },
        avgConfidence: 0,
        lastReading: null
      }
    });
    
  } catch (error) {
    console.error('Error fetching sensor data summary:', error);
    res.status(500).json({ error: 'Failed to fetch sensor data summary' });
  }
});

module.exports = router;
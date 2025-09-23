const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  sensorId: {
    type: String,
    required: true,
    ref: 'Sensor'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  readings: {
    Rainfall_mm: {
      type: Number,
      required: true,
      min: 0,
      max: 1000 // Assuming max 1000mm rainfall
    },
    Slope_Angle: {
      type: Number,
      required: true,
      min: 0,
      max: 90
    },
    Soil_Saturation: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    Vegetation_Cover: {
      type: Number,
      required: true,
      min: 0,
      max: 1 // Percentage as decimal (0-1)
    },
    Earthquake_Activity: {
      type: Number,
      required: true,
      min: 0,
      max: 10 // Assuming scale 0-10 for earthquake activity
    },
    Proximity_to_Water: {
      type: Number,
      required: true,
      min: 0 // Distance in meters or normalized 0-1
    },
    Landslide: {
      type: Number,
      required: true,
      min: 0,
      max: 1 // Binary indicator or probability
    },
    Soil_Type_Gravel: {
      type: Boolean,
      required: true,
      default: false
    },
    Soil_Type_Sand: {
      type: Boolean,
      required: true,
      default: false
    },
    Soil_Type_Silt: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  riskPrediction: {
    level: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    factors: [{
      type: String,
      enum: ['Rainfall_mm', 'Slope_Angle', 'Soil_Saturation', 'Vegetation_Cover', 'Earthquake_Activity', 'Proximity_to_Water', 'Landslide', 'Soil_Type_Gravel', 'Soil_Type_Sand', 'Soil_Type_Silt']
    }],
    aiModelVersion: {
      type: String,
      default: '1.0'
    },
    processingTime: {
      type: Number, // milliseconds
      default: null
    }
  },
  dataQuality: {
    completeness: {
      type: Number,
      min: 0,
      max: 1,
      default: 1
    },
    anomalies: [{
      type: String,
      field: String,
      severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH']
      }
    }]
  },
  metadata: {
    source: {
      type: String,
      enum: ['SENSOR', 'SIMULATION', 'MANUAL', 'BACKEND_SIMULATION'],
      default: 'SENSOR'
    },
    processed: {
      type: Boolean,
      default: false
    },
    processedAt: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
sensorReadingSchema.index({ sensorId: 1, timestamp: -1 });
sensorReadingSchema.index({ 'riskPrediction.level': 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });

// TTL index for automatic data cleanup (keep data for 6 months)
sensorReadingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 }); // 6 months

// Virtual for getting risk level as number for sorting
sensorReadingSchema.virtual('riskLevelNumber').get(function() {
  const levels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
  return levels[this.riskPrediction.level] || 0;
});

// Instance method to check if reading is recent
sensorReadingSchema.methods.isRecent = function(minutes = 30) {
  const now = new Date();
  const diffInMinutes = (now - this.timestamp) / (1000 * 60);
  return diffInMinutes <= minutes;
};

// Static method to get latest reading for a sensor
sensorReadingSchema.statics.getLatestForSensor = function(sensorId) {
  return this.findOne({ sensorId }).sort({ timestamp: -1 });
};

// Static method to get readings in time range
sensorReadingSchema.statics.getReadingsInRange = function(sensorId, startTime, endTime) {
  return this.find({
    sensorId,
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  }).sort({ timestamp: -1 });
};

// Ensure virtual fields are serialized
sensorReadingSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
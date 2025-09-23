const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true
  },
  sensorId: {
    type: String,
    required: true,
    ref: 'Sensor'
  },
  sensorReadingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SensorReading',
    required: true
  },
  riskLevel: {
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
  triggeredAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  acknowledgedBy: {
    type: String,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'],
    default: 'ACTIVE'
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    required: true
  },
  alertType: {
    type: String,
    enum: ['ROCKFALL_RISK', 'EQUIPMENT_FAILURE', 'WEATHER_WARNING', 'SEISMIC_EVENT'],
    default: 'ROCKFALL_RISK'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  affectedArea: {
    radius: {
      type: Number, // meters
      default: 100
    },
    riskZone: {
      type: String,
      enum: ['IMMEDIATE', 'NEARBY', 'EXTENDED'],
      default: 'IMMEDIATE'
    }
  },
  triggerFactors: [{
    factor: {
      type: String,
      enum: ['Rainfall_mm', 'Slope_Angle', 'Soil_Saturation', 'Vegetation_Cover', 'Earthquake_Activity', 'Proximity_to_Water', 'Landslide', 'Soil_Type_Gravel', 'Soil_Type_Sand', 'Soil_Type_Silt']
    },
    value: Number,
    threshold: Number,
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH']
    }
  }],
  actionsTaken: [{
    action: {
      type: String,
      required: true
    },
    takenBy: {
      type: String,
      required: true
    },
    takenAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  notifications: [{
    channel: {
      type: String,
      enum: ['EMAIL', 'SMS', 'WEBSOCKET', 'DASHBOARD'],
      required: true
    },
    recipient: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'FAILED'],
      default: 'SENT'
    }
  }],
  escalation: {
    level: {
      type: Number,
      default: 0,
      min: 0,
      max: 3
    },
    escalatedAt: {
      type: Date,
      default: null
    },
    escalatedTo: {
      type: String,
      default: null
    }
  },
  metadata: {
    aiModelVersion: String,
    processingTime: Number, // milliseconds
    falsePositiveProbability: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
alertSchema.index({ sensorId: 1, triggeredAt: -1 });
alertSchema.index({ status: 1, riskLevel: 1 });
alertSchema.index({ priority: 1, triggeredAt: -1 });
alertSchema.index({ location: '2dsphere' });
alertSchema.index({ alertId: 1 });

// TTL index for resolved alerts (keep for 1 year)
alertSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 31536000, partialFilterExpression: { status: 'RESOLVED' } });

// Virtual for getting alert age in minutes
alertSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((new Date() - this.triggeredAt) / (1000 * 60));
});

// Virtual for checking if alert needs escalation
alertSchema.virtual('needsEscalation').get(function() {
  if (this.status !== 'ACTIVE') return false;
  
  const escalationThresholds = {
    'HIGH': 5,     // 5 minutes for HIGH alerts
    'CRITICAL': 2, // 2 minutes for CRITICAL alerts
    'MEDIUM': 15,  // 15 minutes for MEDIUM alerts
    'LOW': 30      // 30 minutes for LOW alerts
  };
  
  const threshold = escalationThresholds[this.priority] || 30;
  return this.ageInMinutes > threshold && this.escalation.level < 3;
});

// Instance method to acknowledge alert
alertSchema.methods.acknowledge = function(acknowledgedBy) {
  this.status = 'ACKNOWLEDGED';
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = acknowledgedBy;
  return this.save();
};

// Instance method to resolve alert
alertSchema.methods.resolve = function(resolvedBy, resolution = 'RESOLVED') {
  this.status = resolution;
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  return this.save();
};

// Instance method to escalate alert
alertSchema.methods.escalate = function(escalatedTo) {
  this.escalation.level += 1;
  this.escalation.escalatedAt = new Date();
  this.escalation.escalatedTo = escalatedTo;
  
  // Increase priority if at maximum escalation
  if (this.escalation.level >= 3 && this.priority !== 'CRITICAL') {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const currentIndex = priorities.indexOf(this.priority);
    this.priority = priorities[Math.min(currentIndex + 1, 3)];
  }
  
  return this.save();
};

// Static method to get active alerts by risk level
alertSchema.statics.getActiveByRiskLevel = function(riskLevel) {
  return this.find({
    status: 'ACTIVE',
    riskLevel: riskLevel
  }).sort({ triggeredAt: -1 });
};

// Static method to get alerts needing escalation
alertSchema.statics.getAlertsNeedingEscalation = function() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000);
  
  return this.find({
    status: 'ACTIVE',
    'escalation.level': { $lt: 3 },
    $or: [
      { priority: 'CRITICAL', triggeredAt: { $lte: new Date(now.getTime() - 2 * 60000) } },
      { priority: 'HIGH', triggeredAt: { $lte: fiveMinutesAgo } },
      { priority: 'MEDIUM', triggeredAt: { $lte: fifteenMinutesAgo } },
      { priority: 'LOW', triggeredAt: { $lte: thirtyMinutesAgo } }
    ]
  });
};

// Ensure virtual fields are serialized
alertSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Alert', alertSchema);
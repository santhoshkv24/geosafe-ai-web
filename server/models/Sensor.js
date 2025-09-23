const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
  sensorId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;    // latitude
        },
        message: 'Invalid coordinates. Must be [longitude, latitude] within valid ranges.'
      }
    }
  },
  mineGrid: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    zone: { type: String, required: true }
  },
  sensorType: {
    type: String,
    enum: ['GEOLOGICAL', 'WEATHER', 'SEISMIC', 'COMBINED'],
    default: 'COMBINED'
  },
  configuration: {
    readingInterval: { type: Number, default: 300000 }, // 5 minutes in ms
    alertThresholds: {
      Rainfall_mm: { type: Number, default: 50 },
      Slope_Angle: { type: Number, default: 60 },
      Soil_Saturation: { type: Number, default: 0.7 },
      Vegetation_Cover: { type: Number, default: 0.3 },
      Earthquake_Activity: { type: Number, default: 2.0 },
      Proximity_to_Water: { type: Number, default: 100 }, // meters
      Landslide: { type: Number, default: 0.5 } // probability threshold
    }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ERROR'],
    default: 'ACTIVE'
  },
  lastReading: {
    type: Date,
    default: null
  },
  installationDate: {
    type: Date,
    default: Date.now
  },
  lastMaintenanceDate: {
    type: Date,
    default: null
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
sensorSchema.index({ location: '2dsphere' });

// Create indexes for common queries
sensorSchema.index({ sensorId: 1 });
sensorSchema.index({ status: 1 });
sensorSchema.index({ 'mineGrid.zone': 1 });

// Virtual for getting latitude/longitude in separate fields
sensorSchema.virtual('lat').get(function() {
  return this.location.coordinates[1];
});

sensorSchema.virtual('lng').get(function() {
  return this.location.coordinates[0];
});

// Ensure virtual fields are serialized
sensorSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Sensor', sensorSchema);
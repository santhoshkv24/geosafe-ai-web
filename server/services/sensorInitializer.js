const mongoose = require('mongoose');
const Sensor = require('../models/Sensor');
const { MINE_LOCATIONS } = require('./mineLocations');

// Initialize sensors in database if they don't exist
async function initializeSensors() {
  try {
    console.log('🔧 Checking sensor initialization...');
    
    const existingSensorCount = await Sensor.countDocuments();
    
    if (existingSensorCount > 0) {
      console.log(`✅ Found ${existingSensorCount} sensors in database`);
      return;
    }
    
    console.log('📍 No sensors found, initializing with sample data...');
    
    const sensors = [];
    
    // Create sensors for each mine location
    MINE_LOCATIONS.forEach((mine, mineIndex) => {
      const sensorsPerMine = Math.floor(Math.random() * 3) + 3; // 3-5 sensors per mine
      
      for (let i = 0; i < sensorsPerMine; i++) {
        const sensorTypes = ['GEOLOGICAL', 'WEATHER', 'SEISMIC', 'COMBINED'];
        const sensorType = sensorTypes[Math.floor(Math.random() * sensorTypes.length)];
        
        // Add some randomness to sensor positions around the mine
        const latOffset = (Math.random() - 0.5) * 0.02; // ±0.01 degrees
        const lngOffset = (Math.random() - 0.5) * 0.02;
        
        const sensorLetter = String.fromCharCode(65 + i); // A, B, C, D, E
        const mineCode = mine.state.substring(0, 3).toUpperCase() + mine.name.split(' ')[0].substring(0, 3).toUpperCase();
        const sensorId = `${mineCode}_${sensorLetter}${String(mineIndex + 1).padStart(2, '0')}`;
        
        const sensor = {
          sensorId,
          name: `${mine.name} Sensor ${sensorLetter}`,
          location: {
            type: 'Point',
            coordinates: [
              mine.location.lng + lngOffset, // longitude first in GeoJSON
              mine.location.lat + latOffset  // latitude second
            ]
          },
          mineGrid: {
            x: Math.floor(Math.random() * 1000) + 100,
            y: Math.floor(Math.random() * 1000) + 100,
            zone: mine.zone
          },
          sensorType,
          configuration: {
            readingInterval: 300000, // 5 minutes
            alertThresholds: {
              Rainfall_mm: 30 + Math.random() * 40, // 30-70mm
              Slope_Angle: 45 + Math.random() * 25, // 45-70 degrees
              Soil_Saturation: 0.5 + Math.random() * 0.3, // 0.5-0.8
              Vegetation_Cover: 0.2 + Math.random() * 0.3, // 0.2-0.5
              Earthquake_Activity: 1.5 + Math.random() * 2, // 1.5-3.5
              Proximity_to_Water: 50 + Math.random() * 200, // 50-250 meters
              Landslide: 0.3 + Math.random() * 0.4 // 0.3-0.7
            }
          },
          status: Math.random() > 0.15 ? 'ACTIVE' : 'INACTIVE', // 85% active
          installationDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date within last year
          batteryLevel: 60 + Math.random() * 40 // 60-100%
        };
        
        sensors.push(sensor);
      }
    });
    
    // Insert all sensors
    const insertedSensors = await Sensor.insertMany(sensors);
    console.log(`✅ Initialized ${insertedSensors.length} sensors in database`);
    
    // Log some sample sensor IDs
    console.log('📍 Sample sensor IDs created:');
    insertedSensors.slice(0, 5).forEach(sensor => {
      console.log(`   - ${sensor.sensorId} (${sensor.name})`);
    });
    
    return insertedSensors;
    
  } catch (error) {
    console.error('❌ Error initializing sensors:', error);
    throw error;
  }
}

module.exports = { initializeSensors };
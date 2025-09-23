const mongoose = require('mongoose');
require('dotenv').config();

const SensorReading = require('./models/SensorReading');
const Sensor = require('./models/Sensor');
const Alert = require('./models/Alert');

async function testDatabaseOperations() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geosafe-ai');
    console.log('✅ Connected to MongoDB');
    
    // Check sensor count
    const sensorCount = await Sensor.countDocuments();
    console.log(`📍 Total sensors in database: ${sensorCount}`);
    
    // Check sensor readings count
    const readingsCount = await SensorReading.countDocuments();
    console.log(`📊 Total sensor readings in database: ${readingsCount}`);
    
    // Check alerts count
    const alertsCount = await Alert.countDocuments();
    console.log(`🚨 Total alerts in database: ${alertsCount}`);
    
    // Get latest readings
    const latestReadings = await SensorReading.find()
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
    
    console.log('\n📈 Latest 5 sensor readings:');
    latestReadings.forEach((reading, index) => {
      console.log(`${index + 1}. ${reading.sensorId} - ${reading.riskPrediction.level} (${new Date(reading.timestamp).toLocaleString()})`);
    });
    
    // Get risk level distribution
    const riskDistribution = await SensorReading.aggregate([
      {
        $group: {
          _id: '$riskPrediction.level',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$riskPrediction.confidence' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    console.log('\n📊 Risk level distribution:');
    riskDistribution.forEach(risk => {
      console.log(`   ${risk._id}: ${risk.count} readings (avg confidence: ${(risk.avgConfidence * 100).toFixed(1)}%)`);
    });
    
    // Get readings by time range (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const recent24hReadings = await SensorReading.countDocuments({
      timestamp: { $gte: last24Hours }
    });
    
    console.log(`\n⏰ Readings in last 24 hours: ${recent24hReadings}`);
    
    // Test sensor reading creation
    console.log('\n🧪 Testing sensor reading creation...');
    
    const testSensor = await Sensor.findOne();
    if (testSensor) {
      const testReading = new SensorReading({
        sensorId: testSensor.sensorId,
        timestamp: new Date(),
        readings: {
          Rainfall_mm: 25.5,
          Slope_Angle: 45.2,
          Soil_Saturation: 0.65,
          Vegetation_Cover: 0.4,
          Earthquake_Activity: 1.2,
          Proximity_to_Water: 150,
          Landslide: 0.3,
          Soil_Type_Gravel: false,
          Soil_Type_Sand: true,
          Soil_Type_Silt: false
        },
        riskPrediction: {
          level: 'MEDIUM',
          confidence: 0.78,
          factors: ['Rainfall_mm', 'Slope_Angle']
        },
        metadata: {
          source: 'TEST',
          processed: true,
          processedAt: new Date()
        }
      });
      
      const savedReading = await testReading.save();
      console.log(`✅ Test reading saved: ${savedReading._id}`);
      
      // Clean up test reading
      await SensorReading.findByIdAndDelete(savedReading._id);
      console.log('🧹 Test reading cleaned up');
    }
    
    console.log('\n✅ Database operations test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the test
testDatabaseOperations();
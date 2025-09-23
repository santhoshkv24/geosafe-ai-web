const axios = require('axios');

// Correct URL for the Flask AI microservice
const BASE_URL = 'http://localhost:8000';

// Check if AI microservice is running
async function checkAIServiceAvailability() {
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 3000 });
    console.log('✅ AI Service Health Check:', response.data);
    return true;
  } catch (error) {
    console.log('⚠️  AI Service not running or not accessible:', error.message);
    return false;
  }
}

// Sample data that matches the Flask API format
const samplePredictionRequest = {
  "sensor_id": "SENSOR_001",
  "timestamp": "2025-09-23T10:30:00Z",
  "features": {
    "rainfall_mm": 32.5,
    "slope_angle": 47.8,
    "soil_saturation": 0.58,
    "vegetation_cover": 0.45,
    "earthquake_activity": 1.2,
    "proximity_to_water": 85,
    "landslide": 0.25,
    "soil_type_gravel": false,
    "soil_type_sand": true,
    "soil_type_silt": false
  }
};

// High-risk scenario for testing
const highRiskPredictionRequest = {
  "sensor_id": "SENSOR_002",
  "timestamp": "2025-09-23T11:00:00Z",
  "features": {
    "rainfall_mm": 245.2,     // High rainfall
    "slope_angle": 58.7,      // Steep slope
    "soil_saturation": 0.85,  // Very saturated
    "vegetation_cover": 0.2,  // Low vegetation
    "earthquake_activity": 5.2, // High seismic activity
    "proximity_to_water": 0.15, // Very close to water
    "landslide": 0.8,         // High landslide probability
    "soil_type_gravel": false,
    "soil_type_sand": true,
    "soil_type_silt": false
  }
};

// Low-risk scenario for testing
const lowRiskPredictionRequest = {
  "sensor_id": "SENSOR_003",
  "timestamp": "2025-09-23T11:30:00Z",
  "features": {
    "rainfall_mm": 5.0,
    "slope_angle": 25.0,
    "soil_saturation": 0.2,
    "vegetation_cover": 0.8,
    "earthquake_activity": 0.1,
    "proximity_to_water": 500,
    "landslide": 0.1,
    "soil_type_gravel": true,
    "soil_type_sand": false,
    "soil_type_silt": false
  }
};

async function testSinglePrediction(testData, testName) {
  try {
    console.log(`\n🧪 Testing ${testName}...`);
    console.log('Request data:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(`${BASE_URL}/predict`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Prediction successful:', response.data);
    console.log(`   Risk Level: ${response.data.risk_level}`);
    console.log(`   Confidence: ${response.data.confidence}`);
    console.log(`   Contributing Factors: ${response.data.contributing_factors.join(', ')}`);
    console.log(`   Model Version: ${response.data.model_version}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ ${testName} failed:`, error.response?.data || error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Headers:`, error.response.headers);
    }
    throw error;
  }
}

async function testBatchPrediction() {
  try {
    console.log('\n🧪 Testing Batch Prediction...');
    
    const batchRequest = {
      "readings": [
        samplePredictionRequest,
        highRiskPredictionRequest,
        lowRiskPredictionRequest
      ]
    };
    
    console.log('Batch request with', batchRequest.readings.length, 'readings');
    
    const response = await axios.post(`${BASE_URL}/predict/batch`, batchRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('✅ Batch prediction successful');
    console.log(`   Number of predictions: ${response.data.predictions.length}`);
    
    response.data.predictions.forEach((prediction, index) => {
      console.log(`   Reading ${index + 1}: ${prediction.risk_level} (confidence: ${prediction.confidence})`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Batch prediction failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testModelInfo() {
  try {
    console.log('\n🧪 Testing Model Info...');
    
    const response = await axios.get(`${BASE_URL}/model/info`, {
      timeout: 5000
    });
    
    console.log('✅ Model info retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Model info test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testInvalidRequest() {
  try {
    console.log('\n🧪 Testing Invalid Request (missing features)...');
    
    const invalidRequest = {
      "sensor_id": "SENSOR_INVALID",
      "timestamp": "2025-09-23T12:00:00Z",
      "features": {
        "rainfall_mm": 32.5
        // Missing required features
      }
    };
    
    const response = await axios.post(`${BASE_URL}/predict`, invalidRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    console.log('❌ Invalid request should have failed but got:', response.data);
  } catch (error) {
    if (error.response && error.response.status === 422) {
      console.log('✅ Invalid request properly rejected with status 422');
      console.log('   Error details:', error.response.data);
    } else {
      console.error('❌ Unexpected error for invalid request:', error.response?.data || error.message);
    }
  }
}

async function runFullTestSuite() {
  console.log('🔧 GeoSafe AI Microservice Test Suite');
  console.log('=====================================\n');
  
  try {
    // Check if service is available
    const serviceAvailable = await checkAIServiceAvailability();
    if (!serviceAvailable) {
      console.log('❌ AI microservice is not available. Please start the server first.');
      console.log('Run: python server.py');
      return;
    }
    
    // Test model info
    await testModelInfo();
    
    // Test single predictions
    await testSinglePrediction(samplePredictionRequest, 'Medium Risk Scenario');
    await testSinglePrediction(highRiskPredictionRequest, 'High Risk Scenario');
    await testSinglePrediction(lowRiskPredictionRequest, 'Low Risk Scenario');
    
    // Test batch prediction
    await testBatchPrediction();
    
    // Test error handling
    await testInvalidRequest();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- Health check: ✅ Passed');
    console.log('- Model info: ✅ Passed');
    console.log('- Single predictions: ✅ Passed');
    console.log('- Batch predictions: ✅ Passed');
    console.log('- Error handling: ✅ Passed');
    console.log('\n🚀 AI microservice is working correctly!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Helper function to test a specific scenario
async function testSpecificScenario(scenarioName, requestData) {
  console.log(`\n🎯 Testing ${scenarioName}...`);
  
  const serviceAvailable = await checkAIServiceAvailability();
  if (!serviceAvailable) {
    console.log('❌ AI microservice is not available.');
    return;
  }
  
  try {
    await testSinglePrediction(requestData, scenarioName);
  } catch (error) {
    console.error(`❌ ${scenarioName} test failed:`, error.message);
  }
}

// Run tests
if (require.main === module) {
  runFullTestSuite();
}

module.exports = {
  runFullTestSuite,
  testSpecificScenario,
  testSinglePrediction,
  testBatchPrediction,
  testModelInfo,
  checkAIServiceAvailability,
  samplePredictionRequest,
  highRiskPredictionRequest,
  lowRiskPredictionRequest
};
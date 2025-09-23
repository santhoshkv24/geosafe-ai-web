const axios = require('axios');

class AIService {
  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.AI_SERVICE_TIMEOUT) || 30000;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
    
    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GeoSafe-AI-Backend/1.0'
      }
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`AI Service Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('AI Service Request Error:', error.message);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`AI Service Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('AI Service Response Error:', error.message);
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Get risk prediction from AI service
   * @param {Object} sensorData - Sensor reading data
   * @returns {Promise<Object>} Prediction result
   */
  async getPrediction(sensorData) {
    const startTime = Date.now();
    
    try {
      const payload = this.formatPredictionPayload(sensorData);
      
      const response = await this.retryRequest(async () => {
        return await this.client.post('/predict', payload);
      });
      
      const processingTime = Date.now() - startTime;
      
      // Validate and format the AI response
      const prediction = this.validatePredictionResponse(response.data);
      prediction.processingTime = processingTime;
      
      console.log(`AI Prediction completed in ${processingTime}ms: ${prediction.level} (${prediction.confidence})`);
      
      return prediction;
      
    } catch (error) {
      console.error('AI Service prediction failed:', error.message);
      throw new Error(`AI prediction failed: ${error.message}`);
    }
  }
  
  /**
   * Get batch predictions for multiple sensor readings
   * @param {Array} sensorDataArray - Array of sensor reading data
   * @returns {Promise<Array>} Array of prediction results
   */
  async getBatchPredictions(sensorDataArray) {
    if (!Array.isArray(sensorDataArray) || sensorDataArray.length === 0) {
      throw new Error('Invalid sensor data array');
    }
    
    if (sensorDataArray.length > 50) {
      throw new Error('Maximum 50 predictions per batch');
    }
    
    const startTime = Date.now();
    
    try {
      const payload = {
        readings: sensorDataArray.map(data => this.formatPredictionPayload(data))
      };
      
      const response = await this.retryRequest(async () => {
        return await this.client.post('/predict/batch', payload);
      });
      
      const processingTime = Date.now() - startTime;
      
      // Validate and format batch response
      const predictions = response.data.predictions.map((pred, index) => {
        const prediction = this.validatePredictionResponse(pred);
        prediction.processingTime = processingTime / sensorDataArray.length; // Average per prediction
        return prediction;
      });
      
      console.log(`AI Batch prediction completed in ${processingTime}ms for ${predictions.length} readings`);
      
      return predictions;
      
    } catch (error) {
      console.error('AI Service batch prediction failed:', error.message);
      throw new Error(`AI batch prediction failed: ${error.message}`);
    }
  }
  
  /**
   * Get AI model information and health status
   * @returns {Promise<Object>} Model info and health status
   */
  async getModelInfo() {
    try {
      const response = await this.client.get('/model/info');
      return response.data;
    } catch (error) {
      console.error('Failed to get AI model info:', error.message);
      throw new Error(`Failed to get model info: ${error.message}`);
    }
  }
  
  /**
   * Check AI service health
   * @returns {Promise<boolean>} Service health status
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.error('AI Service health check failed:', error.message);
      return false;
    }
  }
  
  /**
   * Format sensor data for AI service prediction endpoint
   * @param {Object} sensorData - Raw sensor data
   * @returns {Object} Formatted payload
   */
  formatPredictionPayload(sensorData) {
    const { sensorId, readings, timestamp } = sensorData;
    
    return {
      sensor_id: sensorId,
      timestamp: timestamp || new Date().toISOString(),
      features: {
        rainfall_mm: readings.Rainfall_mm,
        slope_angle: readings.Slope_Angle,
        soil_saturation: readings.Soil_Saturation,
        vegetation_cover: readings.Vegetation_Cover,
        earthquake_activity: readings.Earthquake_Activity,
        proximity_to_water: readings.Proximity_to_Water,
        landslide: readings.Landslide,
        soil_type_gravel: readings.Soil_Type_Gravel,
        soil_type_sand: readings.Soil_Type_Sand,
        soil_type_silt: readings.Soil_Type_Silt
      }
    };
  }
  
  /**
   * Validate and format AI service response
   * @param {Object} response - Raw AI service response
   * @returns {Object} Validated prediction object
   */
  validatePredictionResponse(response) {
    if (!response) {
      throw new Error('Empty response from AI service');
    }
    
    const { risk_level, confidence, contributing_factors, model_version } = response;
    
    // Validate risk level
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(risk_level)) {
      throw new Error(`Invalid risk level: ${risk_level}`);
    }
    
    // Validate confidence score
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence score: ${confidence}`);
    }
    
    // Map AI service factor names to our schema
    const factorMapping = {
      'rainfall_mm': 'Rainfall_mm',
      'slope_angle': 'Slope_Angle',
      'soil_saturation': 'Soil_Saturation',
      'vegetation_cover': 'Vegetation_Cover',
      'earthquake_activity': 'Earthquake_Activity',
      'proximity_to_water': 'Proximity_to_Water',
      'landslide': 'Landslide',
      'soil_type_gravel': 'Soil_Type_Gravel',
      'soil_type_sand': 'Soil_Type_Sand',
      'soil_type_silt': 'Soil_Type_Silt'
    };
    
    const factors = (contributing_factors || [])
      .map(factor => factorMapping[factor] || factor)
      .filter(factor => factor); // Remove undefined factors
    
    return {
      level: risk_level,
      confidence: Math.round(confidence * 1000) / 1000, // Round to 3 decimal places
      factors,
      aiModelVersion: model_version || '1.0'
    };
  }
  
  /**
   * Retry mechanism for API requests
   * @param {Function} requestFn - Function that makes the API request
   * @returns {Promise} Request result
   */
  async retryRequest(requestFn) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors (4xx)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          throw error;
        }
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`AI Service request failed (attempt ${attempt}/${this.retryAttempts}). Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get service status and configuration
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      baseURL: this.baseURL,
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay,
      isConfigured: !!this.baseURL
    };
  }
}

// Create singleton instance
const aiService = new AIService();

// Export functions for backward compatibility
module.exports = {
  getPrediction: (sensorData) => aiService.getPrediction(sensorData),
  getBatchPredictions: (sensorDataArray) => aiService.getBatchPredictions(sensorDataArray),
  getModelInfo: () => aiService.getModelInfo(),
  healthCheck: () => aiService.healthCheck(),
  getStatus: () => aiService.getStatus(),
  
  // Export the service instance for advanced usage
  aiService
};
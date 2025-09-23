# GeoSafe AI Backend Server

This is the Node.js backend server for the GeoSafe AI mine safety monitoring system.

## Features

- **Real-time monitoring** via WebSockets
- **REST API** for sensor management and data ingestion
- **MongoDB** integration for data persistence
- **AI service integration** for risk prediction
- **Geospatial** data handling with location-based queries
- **Alert management** with escalation workflows
- **Rate limiting** and security middleware

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (local or cloud)
- Python AI Service (running on port 8000)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start development server
npm run dev
```

### Environment Variables

Key environment variables to configure:

- `MONGODB_URI`: MongoDB connection string
- `AI_SERVICE_URL`: URL of the Python AI microservice
- `FRONTEND_URL`: URL of the React frontend for CORS
- `JWT_SECRET`: Secret key for authentication (if implemented)

## API Endpoints

### Sensors

- `GET /api/sensors` - List all sensors
- `POST /api/sensors` - Create new sensor
- `GET /api/sensors/:sensorId` - Get specific sensor
- `PUT /api/sensors/:sensorId` - Update sensor
- `PATCH /api/sensors/:sensorId/status` - Update sensor status
- `GET /api/sensors/nearby/:lat/:lng` - Find nearby sensors
- `GET /api/sensors/:sensorId/health` - Get sensor health status

### Sensor Readings

- `GET /api/readings` - List readings with filters
- `POST /api/readings` - Create new reading (triggers AI prediction)
- `POST /api/readings/batch` - Create multiple readings
- `GET /api/readings/sensor/:sensorId` - Get readings for sensor
- `GET /api/readings/sensor/:sensorId/latest` - Get latest reading
- `GET /api/readings/analytics/summary` - Get analytics summary

### Alerts

- `GET /api/alerts` - List alerts with filters
- `GET /api/alerts/active` - Get active alerts
- `GET /api/alerts/:alertId` - Get specific alert
- `POST /api/alerts` - Create new alert
- `PATCH /api/alerts/:alertId/acknowledge` - Acknowledge alert
- `PATCH /api/alerts/:alertId/resolve` - Resolve alert
- `PATCH /api/alerts/:alertId/escalate` - Escalate alert
- `GET /api/alerts/analytics/dashboard` - Get dashboard analytics

## WebSocket Events

### Client → Server

- `authenticate` - Authenticate client with role
- `subscribe-sensor` - Subscribe to sensor updates
- `subscribe-area` - Subscribe to geographic area updates
- `acknowledge-alert` - Acknowledge an alert
- `request-risk-assessment` - Request manual risk assessment

### Server → Client

- `sensor-reading` - New sensor reading received
- `risk-update` - Risk level updated for sensor
- `alert-trigger` - New alert triggered
- `critical-alert` - Critical/High priority alert
- `alert-acknowledged` - Alert acknowledged by operator
- `alert-resolved` - Alert resolved
- `sensor-status` - Sensor status changed

## Data Models

### Sensor

```javascript
{
  sensorId: "SENSOR_001",
  name: "North Slope Sensor",
  location: {
    type: "Point",
    coordinates: [-46.6333, -23.5505] // [lng, lat]
  },
  mineGrid: { x: 100, y: 200, zone: "A" },
  status: "ACTIVE",
  configuration: {
    readingInterval: 300000,
    alertThresholds: { ... }
  }
}
```

### Sensor Reading

```javascript
{
  sensorId: "SENSOR_001",
  timestamp: "2025-09-23T10:30:00Z",
  readings: {
    Rainfall_mm: 45.2,
    Slope_Angle: 58.7,
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
    level: "MEDIUM",
    confidence: 0.87,
    factors: ["Rainfall_mm", "Slope_Angle", "Soil_Saturation"]
  }
}
```

### Alert

```javascript
{
  alertId: "ALERT_1695456600000_SENSOR_001",
  sensorId: "SENSOR_001",
  riskLevel: "HIGH",
  status: "ACTIVE",
  priority: "HIGH",
  triggeredAt: "2025-09-23T10:30:00Z",
  location: { ... },
  triggerFactors: [ ... ]
}
```

## Development

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## Integration with AI Service

The backend automatically forwards sensor readings to the Python AI microservice for risk prediction. Configure the AI service URL in your `.env` file:

```
AI_SERVICE_URL=http://localhost:8000
```

The system includes fallback prediction logic when the AI service is unavailable.

## Security Features

- Rate limiting on API endpoints
- CORS configuration
- Input validation with Joi
- Geospatial coordinate validation
- Error handling and logging

## Monitoring

- Health check endpoint: `GET /health`
- WebSocket connection monitoring
- Alert escalation automation
- Sensor health status tracking
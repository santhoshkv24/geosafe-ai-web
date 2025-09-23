# GeoSafe AI - Copilot Instructions

## Project Overview
GeoSafe AI is a real-time monitoring and alert system for preventing rockfall accidents in open-pit mines. The system transforms mine safety from reactive to proactive through AI-driven geological risk prediction and instant operator alerts.

## Architecture & Project Structure

### Microservice Architecture
```
[React Frontend] ←→ WebSockets ←→ [Node.js Backend] ←→ REST API ←→ [Python AI Microservice]
```

**Focus Area**: Web application layer (React + Node.js + MongoDB) - NOT the Python AI microservice

### Expected Directory Structure
```
/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page-level components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API communication layer
│   │   └── utils/       # Utility functions
├── server/              # Node.js backend
│   ├── routes/          # Express route handlers
│   ├── models/          # MongoDB schemas
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic layer
│   └── socket/          # WebSocket handlers
└── shared/              # Shared types/utilities
```

## Technology Stack & Key Libraries

### Frontend (React)
- **Leaflet.js**: Geospatial mapping for mine site visualization
- **Socket.IO Client**: Real-time communication for instant alerts
- **Axios**: HTTP client for API communication
- **React**: Component-based UI framework

### Backend (Node.js)
- **Express.js**: Web application framework
- **Socket.IO**: WebSocket implementation for real-time features
- **Mongoose**: MongoDB object modeling
- **MongoDB**: Primary database for sensor data and configurations

## Domain-Specific Patterns

### Geospatial Data Handling
- Use GeoJSON format for mine boundary and sensor location data
- Implement coordinate system transformations (lat/lng to mine grid coordinates)
- Handle map clustering for dense sensor deployments

### Real-Time Risk Monitoring
- WebSocket event pattern: `risk-update`, `alert-trigger`, `sensor-status`
- Risk levels: `LOW`, `MEDIUM`, `HIGH` with color coding (Green/Yellow/Red)
- Alert priority system with escalation thresholds

### Sensor Data Management
```javascript
// Current sensor data structure (Updated September 2025)
{
  sensorId: "SENSOR_001",
  location: { lat: -23.5505, lng: -46.6333 },
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

## Development Workflows

### API Communication Pattern
- Frontend ↔ Node.js Backend: REST + WebSockets
- Node.js ↔ Python AI Service: REST API calls to `/predict` endpoint
- Use environment variables for service URLs and API keys

### State Management
- Use React Context for global state (alerts, sensor data)
- Implement optimistic updates for real-time data
- Cache geospatial data to avoid repeated map reloads

### Database Schema Patterns
- **Sensors**: Location, configuration, last reading timestamp
- **Alerts**: Risk level, triggered timestamp, acknowledged status
- **SensorReadings**: Time-series data with automated cleanup policies

## Key Integration Points

### Real-Time Alert Flow
1. Sensor data arrives at Node.js backend
2. Backend forwards to Python AI service via `/predict` endpoint
3. AI prediction triggers WebSocket emission to frontend
4. Frontend displays instant visual alert on map interface

### Map-Based UI Patterns
- Sensor icons with dynamic color coding based on risk levels
- Click handlers for sensor details modal/sidebar
- Alert animations (flashing icons, toast notifications)
- Zoom-to-alert functionality for immediate operator focus

## Error Handling & Resilience

### API Failure Patterns
- Graceful degradation when AI service is unavailable
- Fallback to last-known risk levels during service outages
- Implement retry logic with exponential backoff for critical predictions

### Real-Time Connection Management
- Auto-reconnection for WebSocket disconnections
- Heartbeat mechanism to detect connection health
- Queue critical alerts during connection interruptions

## Performance Considerations

### Map Optimization
- Implement sensor clustering for high-density areas
- Lazy load historical data on demand
- Use map bounds to limit active sensor polling

### Data Efficiency
- Implement data compression for large sensor payloads
- Use pagination for historical alert queries
- Cache frequently accessed geospatial boundaries

## Security Patterns
- Validate all geospatial coordinates before database storage
- Implement rate limiting on prediction API calls
- Use CORS configuration for frontend-backend communication
- Sanitize sensor data inputs to prevent injection attacks

## Testing Approach
- Mock geospatial data for consistent testing
- Simulate WebSocket connections for real-time feature testing
- Use test data generators for various risk scenarios
- Implement integration tests for the prediction pipeline flow

## Critical Business Logic
- **Alert Escalation**: High-risk predictions must trigger immediate notifications
- **False Positive Handling**: Implement confidence thresholds to reduce noise
- **Operational Hours**: Consider mine shift schedules for alert routing
- **Emergency Protocols**: Critical alerts override normal notification channels
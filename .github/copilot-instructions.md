````instructions
# GeoSafe AI - Copilot Instructions

**IMPORTANT**: Always use Sequential Thinking (`mcp_sequentialthi_sequentialthinking`) for complex analysis and Context7 MCP server (`mcp_context7_resolve-library-id` and `mcp_context7_get-library-docs`) for up-to-date library documentation when working on this codebase.

## Project Overview
GeoSafe AI is a real-time monitoring and alert system for preventing rockfall accidents in open-pit mines. The system transforms mine safety from reactive to proactive through AI-driven geological risk prediction and instant operator alerts.

## Architecture & Project Structure

### Microservice Architecture
```
[React Frontend] ←→ WebSockets ←→ [Node.js Backend] ←→ REST API ←→ [Python AI Microservice]
```

**Focus Area**: Web application layer (React + Node.js + MongoDB) - NOT the Python AI microservice

### Actual Directory Structure
```
/
├── client/                      # React frontend (CRA TypeScript)
│   ├── src/
│   │   ├── components/         # MapComponent.tsx, SensorPanel.tsx
│   │   ├── services/           # api.ts, socket.ts, simulation.ts
│   │   ├── types/              # index.ts (comprehensive TypeScript definitions)
│   │   └── hooks/              # Custom React hooks (empty)
├── server/                     # Node.js backend
│   ├── routes/                 # alerts.js, sensors.js, sensorReadings.js
│   ├── models/                 # Alert.js, Sensor.js, SensorReading.js
│   ├── services/               # aiService.js, backendSensorSimulator.js, sensorInitializer.js
│   ├── socket/                 # socketHandlers.js
│   └── config/                 # database.js
└── prd.txt                     # Project Requirements Document
```

## Development Workflows

### Getting Started (Full Stack)
```bash
# Terminal 1 - Backend
cd server
npm install
cp .env.example .env  # Configure MongoDB URI and AI service URL
npm run dev           # Starts on :5000 with auto-sensor simulation

# Terminal 2 - Frontend  
cd client
npm install
npm start            # Starts on :3000 with proxy to backend

# Required: Python AI service on :8000 (external microservice)
```

### Critical Environment Variables
```bash
# server/.env
MONGODB_URI=mongodb://localhost:27017/geosafe-ai
AI_SERVICE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Database Initialization
- `server/services/sensorInitializer.js` auto-creates sensors on startup
- Uses MongoDB with 2dsphere geospatial indexes
- Sensor locations are hardcoded for Southern India mining areas

## Critical Implementation Patterns

### Sensor ID Convention
**CRITICAL**: All sensor IDs are normalized to UPPERCASE throughout the system
```javascript
// Backend always stores and queries uppercase
sensorId: sensorId.toUpperCase()

// Frontend must send uppercase to match
const sensorData = { sensorId: "SENSOR_001" }; // Correct format
```

### Coordinate System (GeoJSON Standard)
**CRITICAL**: Uses [longitude, latitude] format, NOT [lat, lng]
```javascript
// Correct GeoJSON format
location: {
  type: "Point", 
  coordinates: [75.7139, 15.3173] // [lng, lat]
}

// Access via virtuals in Mongoose
sensor.lat  // 15.3173
sensor.lng  // 75.7139
```

### Dual State Management Pattern
The frontend handles both simulated AND real backend data with complex synchronization:

```javascript
// App.tsx pattern - preserve WebSocket risk levels during HTTP refresh
const currentRiskLevels = new Map(currentSensors.map(s => [s.sensorId, s.riskLevel]));
const processedData = backendData.map(sensor => ({
  ...sensor,
  riskLevel: currentRiskLevels.get(sensor.sensorId) || 'LOW' // Preserve WebSocket updates
}));
```

### WebSocket Integration Pattern
- Singleton service (`services/socket.ts`) with exponential backoff reconnection
- Complex event handling for `sensor-reading`, `risk-update`, `alert-trigger`
- Authentication required: `socket.emit('authenticate', { role: 'operator', userId, name })`

### AI Service Integration
Backend `services/aiService.js` handles:
- Retry logic with exponential backoff (3 attempts)
- Payload transformation (snake_case ↔ PascalCase)
- Fallback predictions when AI service unavailable
- Batch prediction support (max 50 readings)

## Database Schema Patterns

### MongoDB Indexes
```javascript
// Critical geospatial index
sensorSchema.index({ location: '2dsphere' });

// Query patterns
Sensor.find({ location: { $near: { $geometry: { type: "Point", coordinates: [lng, lat] } } } })
```

### Virtual Fields Pattern
```javascript
// Mongoose virtuals for coordinate access
sensorSchema.virtual('lat').get(function() { return this.location.coordinates[1]; });
sensorSchema.virtual('lng').get(function() { return this.location.coordinates[0]; });
```

## Real-Time Alert Flow
1. `BackendSensorSimulator` generates sensor data every 30s
2. Data sent to Python AI service `/predict` endpoint
3. AI prediction triggers WebSocket `risk-update` event
4. Frontend updates sensor risk levels in real-time
5. HIGH risk generates Alert document and `alert-trigger` event

### WebSocket Event Patterns
```javascript
// Key events to handle
socket.on('sensor-reading', ({ sensorId, reading, sensor }) => { /* Update sensor data */ });
socket.on('risk-update', ({ sensorId, riskLevel, confidence }) => { /* Update risk display */ });
socket.on('alert-trigger', ({ alert, sensor, sensorReading }) => { /* Show alert */ });
socket.on('critical-alert', ({ alert, sensor, urgent }) => { /* Priority alert */ });
```

## Domain-Specific Patterns

### Geospatial Data Handling
- Mine boundary visualization with L.circle (2km radius)
- Sensor clustering for dense deployments
- Southern India coordinate system (Karnataka region)
- GeoJSON Point geometry for all locations

### Risk Level State Management
```javascript
// Risk level color mapping (consistent across app)
const riskColors = {
  'LOW': '#2ecc71',      // Green
  'MEDIUM': '#f39c12',   // Orange  
  'HIGH': '#e74c3c'      // Red
};

// Icon patterns for map markers
HIGH: '!', MEDIUM: '⚠', LOW: '✓'
```

### Alert Escalation System
- Automatic escalation after time thresholds
- Priority levels: LOW → MEDIUM → HIGH → CRITICAL
- Socket event: `alert-escalated` with escalation level

## Error Handling & Debugging

### WebSocket Debugging
```javascript
// Enable detailed logging
localStorage.setItem('debug', 'socket.io-client:*');

// Check connection status
socketService.isConnected()
socketService.getSocket()?.connected
```

### Common Issues
1. **Coordinate confusion**: Always use [lng, lat] for GeoJSON
2. **Case sensitivity**: Sensor IDs must be UPPERCASE
3. **WebSocket state sync**: Risk levels can be overwritten by HTTP refreshes
4. **AI service timeout**: Backend has 30s timeout with 3 retries

## Performance Considerations
- Sensor data refresh every 30s via HTTP + real-time WebSocket updates
- Map marker clustering for 20+ sensors
- MongoDB aggregation for dashboard analytics
- Frontend simulation service manages local state cache

## Security & Rate Limiting
- Express rate limiting: 100 requests per 15 minutes per IP
- CORS configured for development (relaxed) and production (strict)
- Helmet security middleware with WebSocket compatibility
- Input validation with Joi for API endpoints

## Testing Strategy
- Mock AI service responses for consistent testing
- WebSocket event simulation for frontend testing
- MongoDB in-memory database for integration tests
- Geospatial data generators for sensor placement testing
````
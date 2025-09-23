const Alert = require('../models/Alert');
const Sensor = require('../models/Sensor');
const SensorReading = require('../models/SensorReading');
const { getPrediction } = require('../services/aiService');

module.exports = (io) => {
  // Store connected clients with their roles
  const connectedClients = new Map();
  
  io.on('connection', (socket) => {
    console.log(`🟢 Client connected: ${socket.id} from ${socket.request.connection.remoteAddress}`);
    console.log(`📊 Total connected clients: ${io.sockets.sockets.size}`);
    
    // Handle client authentication and role assignment
    socket.on('authenticate', (data) => {
      const { role = 'operator', userId, name } = data;
      
      connectedClients.set(socket.id, {
        role,
        userId,
        name,
        connectedAt: new Date()
      });
      
      // Join role-based rooms
      socket.join(role);
      if (role === 'operator' || role === 'supervisor') {
        socket.join('operators');
      }
      
      console.log(`Client ${socket.id} authenticated as ${role}: ${name || userId}`);
      
      // Send welcome message with current stats
      socket.emit('authentication-success', {
        message: 'Connected to GeoSafe AI',
        role,
        serverTime: new Date()
      });
      
      // Send initial dashboard data
      sendInitialDashboardData(socket);
    });
    
    // Handle client subscribing to specific sensor updates
    socket.on('subscribe-sensor', (sensorId) => {
      if (sensorId) {
        socket.join(`sensor-${sensorId.toUpperCase()}`);
        console.log(`Client ${socket.id} subscribed to sensor ${sensorId}`);
        
        // Send latest reading for this sensor
        sendLatestSensorData(socket, sensorId);
      }
    });
    
    // Handle client unsubscribing from sensor updates
    socket.on('unsubscribe-sensor', (sensorId) => {
      if (sensorId) {
        socket.leave(`sensor-${sensorId.toUpperCase()}`);
        console.log(`Client ${socket.id} unsubscribed from sensor ${sensorId}`);
      }
    });
    
    // Handle subscribing to geographic area updates
    socket.on('subscribe-area', (bounds) => {
      // bounds: { north, south, east, west }
      socket.bounds = bounds;
      console.log(`Client ${socket.id} subscribed to area updates`);
    });
    
    // Handle alert acknowledgment from client
    socket.on('acknowledge-alert', async (data) => {
      try {
        const { alertId, acknowledgedBy } = data;
        const client = connectedClients.get(socket.id);
        
        if (!client || !['operator', 'supervisor'].includes(client.role)) {
          socket.emit('error', { message: 'Unauthorized to acknowledge alerts' });
          return;
        }
        
        const alert = await Alert.findOne({ alertId });
        if (alert && alert.status === 'ACTIVE') {
          await alert.acknowledge(acknowledgedBy || client.name || client.userId);
          
          // Broadcast acknowledgment to all operators
          io.to('operators').emit('alert-acknowledged', {
            alertId: alert.alertId,
            acknowledgedBy: acknowledgedBy || client.name,
            acknowledgedAt: alert.acknowledgedAt
          });
        }
      } catch (error) {
        console.error('Error acknowledging alert:', error);
        socket.emit('error', { message: 'Failed to acknowledge alert' });
      }
    });
    
    // Handle manual risk assessment request
    socket.on('request-risk-assessment', async (data) => {
      try {
        const { sensorId, force = false } = data;
        const client = connectedClients.get(socket.id);
        
        if (!client || !['operator', 'supervisor'].includes(client.role)) {
          socket.emit('error', { message: 'Unauthorized to request assessments' });
          return;
        }
        
        const latestReading = await SensorReading.getLatestForSensor(sensorId.toUpperCase());
        if (latestReading) {
          // Re-emit the latest reading to trigger dashboard update
          socket.emit('sensor-reading', {
            sensorId: latestReading.sensorId,
            reading: latestReading,
            requestedBy: client.name || client.userId
          });
        }
      } catch (error) {
        console.error('Error processing risk assessment request:', error);
        socket.emit('error', { message: 'Failed to process risk assessment' });
      }
    });
    
    // Handle new sensor reading from frontend simulation
    socket.on('new-sensor-reading', async (data) => {
      try {
        const { sensorId, timestamp, readings } = data;
        console.log(`📡 Received sensor reading from frontend: ${sensorId}`);
        
        // Get AI prediction for this reading
        const aiPrediction = await getPrediction({
          sensorId,
          timestamp,
          readings
        });
        
        console.log(`🤖 AI prediction for ${sensorId}: ${aiPrediction.level} (${aiPrediction.confidence})`);
        
        // Create and save sensor reading to database
        const sensorReading = new SensorReading({
          sensorId: sensorId.toUpperCase(),
          timestamp: new Date(timestamp),
          readings,
          riskPrediction: {
            level: aiPrediction.level,
            confidence: aiPrediction.confidence,
            factors: aiPrediction.factors || ['Rainfall_mm', 'Slope_Angle', 'Soil_Saturation'],
            aiModelVersion: '1.0',
            processingTime: 30 // Mock processing time
          },
          dataQuality: {
            completeness: 0.95 + Math.random() * 0.05,
            anomalies: []
          },
          metadata: {
            source: 'SIMULATION',
            processed: true,
            processedAt: new Date()
          }
        });
        
        // Save to database for historical analysis
        const savedReading = await sensorReading.save();
        console.log(`💾 Sensor reading saved to database: ${savedReading._id}`);
        
        // Update sensor's last reading timestamp
        await Sensor.findOneAndUpdate(
          { sensorId: sensorId.toUpperCase() },
          { lastReading: new Date(timestamp) },
          { upsert: false }
        );
        
        // Broadcast risk update to all clients
        io.broadcastRiskUpdate({
          sensorId,
          riskLevel: aiPrediction.level,
          confidence: aiPrediction.confidence,
          location: null, // Will be filled by client
          timestamp: new Date()
        });
        
        // Send sensor reading back to frontend
        socket.emit('sensor-reading', {
          sensorId,
          reading: {
            _id: savedReading._id,
            sensorId: savedReading.sensorId,
            timestamp: savedReading.timestamp,
            readings: savedReading.readings,
            riskPrediction: savedReading.riskPrediction,
            dataQuality: savedReading.dataQuality,
            metadata: savedReading.metadata
          }
        });
        
        // Generate and save alert if high risk
        if (aiPrediction.level === 'HIGH') {
          const sensor = await Sensor.findOne({ sensorId: sensorId.toUpperCase() });
          if (sensor) {
            const alert = new Alert({
              sensorId: sensor.sensorId,
              sensorReadingId: savedReading._id,
              riskLevel: aiPrediction.level,
              confidence: aiPrediction.confidence,
              triggeredAt: new Date(),
              status: 'ACTIVE',
              priority: 'CRITICAL',
              alertType: 'ROCKFALL_RISK',
              location: sensor.location,
              affectedArea: {
                radius: 200,
                riskZone: 'IMMEDIATE'
              },
              triggerFactors: aiPrediction.factors.map(factor => ({
                factor,
                value: readings[factor] || 0,
                threshold: sensor.configuration?.alertThresholds?.[factor] || 0,
                severity: aiPrediction.level
              }))
            });
            
            // Save alert to database
            const savedAlert = await alert.save();
            console.log(`🚨 Alert saved to database: ${savedAlert.alertId}`);
            
            // Broadcast alert
            io.broadcastAlert({
              alert: savedAlert,
              sensor,
              urgent: true
            });
          }
        }
        
      } catch (error) {
        console.error('Error processing new sensor reading:', error);
        socket.emit('error', { 
          message: 'Failed to process sensor reading',
          details: error.message 
        });
      }
    });
    
    // Handle heartbeat for connection monitoring
    socket.on('ping', () => {
      socket.emit('pong', { serverTime: new Date() });
    });
    
    // Handle client disconnect
    socket.on('disconnect', (reason) => {
      const client = connectedClients.get(socket.id);
      console.log(`Client disconnected: ${socket.id} (${client?.name || 'unknown'}) - Reason: ${reason}`);
      connectedClients.delete(socket.id);
      
      // Broadcast operator status update if it was an operator
      if (client && (client.role === 'operator' || client.role === 'supervisor')) {
        io.to('operators').emit('operator-disconnected', {
          userId: client.userId,
          name: client.name,
          disconnectedAt: new Date()
        });
      }
    });
    
    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });
  });
  
  // Helper functions
  async function sendInitialDashboardData(socket) {
    try {
      // Get active alerts
      const activeAlerts = await Alert.find({ status: 'ACTIVE' })
        .sort({ priority: -1, triggeredAt: -1 })
        .limit(10);
      
      // Get sensor status summary
      const sensorStats = await Sensor.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      // Get recent high-risk readings
      const highRiskReadings = await SensorReading.find({
        'riskPrediction.level': 'HIGH',
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).limit(5).sort({ timestamp: -1 });
      
      socket.emit('dashboard-data', {
        activeAlerts,
        sensorStats: {
          ACTIVE: sensorStats.find(s => s._id === 'ACTIVE')?.count || 0,
          INACTIVE: sensorStats.find(s => s._id === 'INACTIVE')?.count || 0,
          MAINTENANCE: sensorStats.find(s => s._id === 'MAINTENANCE')?.count || 0,
          ERROR: sensorStats.find(s => s._id === 'ERROR')?.count || 0
        },
        highRiskReadings
      });
    } catch (error) {
      console.error('Error sending initial dashboard data:', error);
    }
  }
  
  async function sendLatestSensorData(socket, sensorId) {
    try {
      const sensor = await Sensor.findOne({ sensorId: sensorId.toUpperCase() });
      const latestReading = await SensorReading.getLatestForSensor(sensorId.toUpperCase());
      
      if (sensor && latestReading) {
        socket.emit('sensor-data', {
          sensor,
          latestReading
        });
      }
    } catch (error) {
      console.error('Error sending latest sensor data:', error);
    }
  }
  
  // Broadcast functions for use by other parts of the application
  io.broadcastRiskUpdate = (data) => {
    const { sensorId, riskLevel, confidence, location, timestamp } = data;
    
    // Broadcast to all clients
    io.emit('risk-update', data);
    
    // Send to specific sensor subscribers
    io.to(`sensor-${sensorId}`).emit('sensor-risk-update', data);
    
    // Send to area subscribers if location is provided
    if (location && location.coordinates) {
      const [lng, lat] = location.coordinates;
      
      // Find clients subscribed to this area
      io.sockets.sockets.forEach((socket) => {
        if (socket.bounds && isLocationInBounds(lat, lng, socket.bounds)) {
          socket.emit('area-risk-update', data);
        }
      });
    }
    
    console.log(`Risk update broadcasted for sensor ${sensorId}: ${riskLevel} (${confidence})`);
  };
  
  io.broadcastAlert = (alertData) => {
    const { alert, sensor, urgent = false } = alertData;
    
    // Broadcast to all operators
    io.to('operators').emit('alert-trigger', alertData);
    
    // Send critical alerts to all connected clients
    if (urgent || alert.priority === 'CRITICAL' || alert.priority === 'HIGH') {
      io.emit('critical-alert', alertData);
    }
    
    // Send to specific sensor subscribers
    io.to(`sensor-${alert.sensorId}`).emit('sensor-alert', alertData);
    
    console.log(`Alert broadcasted: ${alert.alertId} (${alert.priority})`);
  };
  
  io.broadcastSensorStatus = (sensorData) => {
    const { sensorId, status, previousStatus } = sensorData;
    
    // Broadcast to all clients
    io.emit('sensor-status', sensorData);
    
    // Send to specific sensor subscribers
    io.to(`sensor-${sensorId}`).emit('sensor-status-update', sensorData);
    
    console.log(`Sensor status update broadcasted: ${sensorId} ${previousStatus} -> ${status}`);
  };
  
  // Utility function to check if location is within bounds
  function isLocationInBounds(lat, lng, bounds) {
    return lat >= bounds.south && 
           lat <= bounds.north && 
           lng >= bounds.west && 
           lng <= bounds.east;
  }
  
  // Periodic tasks
  setInterval(async () => {
    try {
      // Check for alerts that need escalation
      const alertsNeedingEscalation = await Alert.getAlertsNeedingEscalation();
      
      for (const alert of alertsNeedingEscalation) {
        // Auto-escalate if no manual escalation
        await alert.escalate('SYSTEM_AUTO_ESCALATION');
        
        io.to('operators').emit('alert-escalated', {
          alertId: alert.alertId,
          escalationLevel: alert.escalation.level,
          escalatedTo: 'SYSTEM_AUTO_ESCALATION',
          priority: alert.priority,
          autoEscalated: true
        });
        
        console.log(`Auto-escalated alert: ${alert.alertId} to level ${alert.escalation.level}`);
      }
      
      // Send connection stats to supervisors
      const connectedOperators = Array.from(connectedClients.values())
        .filter(client => client.role === 'operator' || client.role === 'supervisor');
      
      io.to('supervisor').emit('operator-status', {
        connectedOperators: connectedOperators.length,
        operators: connectedOperators.map(op => ({
          name: op.name,
          role: op.role,
          connectedAt: op.connectedAt
        }))
      });
      
    } catch (error) {
      console.error('Error in periodic WebSocket tasks:', error);
    }
  }, 60000); // Run every minute
  
  console.log('🔌 WebSocket handlers initialized');
  
  return io;
};
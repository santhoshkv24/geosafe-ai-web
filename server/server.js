require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/database');
const { initializeSensors } = require('./services/sensorInitializer');
const BackendSensorSimulator = require('./services/backendSensorSimulator');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://0.0.0.0:3000'
].filter(Boolean);

const io = socketIo(server, {
  path: '/socket.io',
  cors: {
    origin: (origin, callback) => {
      // Allow no-origin (mobile apps, curl) and dev localhost variants
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  // Increase timeouts to avoid premature disconnects on slower networks
  pingTimeout: 30000,
  pingInterval: 25000
});

// Connect to MongoDB
connectDB();

// Security middleware (relaxed for WebSocket cross-origin access)
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/readings', require('./routes/sensorReadings'));
app.use('/api/sensor-data', require('./routes/sensorData')); // New historical data route

// Socket.IO handlers
require('./socket/socketHandlers')(io);

// Make io available to routes
app.set('socketio', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      details: err.message
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`🚀 GeoSafe AI Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
  
  // Initialize sensors in database if needed
  try {
    await initializeSensors();
  } catch (error) {
    console.error('Failed to initialize sensors:', error);
  }
  
  // Start backend sensor simulation
  try {
    const sensorSimulator = new BackendSensorSimulator(io);
    await sensorSimulator.startSimulation();
    
    // Make simulator available globally for management
    app.set('sensorSimulator', sensorSimulator);
    
    console.log('✅ Backend sensor simulation started');
  } catch (error) {
    console.error('❌ Failed to start sensor simulation:', error);
  }
});

// Export for testing
module.exports = { app, server, io };
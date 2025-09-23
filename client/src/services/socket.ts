 import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second

  constructor() {
    // Don't connect in constructor - let App.tsx control when to connect
    console.log('🔧 SocketService initialized (not connected yet)');
  }

  connect() {
    if (this.socket?.connected || this.isConnecting) {
      console.log('🔍 Socket already connected or connecting, skipping...');
      return;
    }

    this.isConnecting = true;
    const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    console.log('🔌 Attempting to connect to:', serverUrl);
    console.log('🔌 Connection options:', {
      transports: ['websocket', 'polling'],
      timeout: 30000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: true,
      withCredentials: true
    });

    // Disconnect any existing socket first
    if (this.socket) {
      console.log('🔌 Disconnecting existing socket');
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(serverUrl, {
      path: '/socket.io',
      // Force polling only to diagnose WebSocket issues
      transports: ['polling'],
      timeout: 30000,
      forceNew: true,
      upgrade: false, // Disable upgrade to websocket
      rememberUpgrade: false,
      autoConnect: true,
      withCredentials: true
    });

    console.log('🔌 Socket instance created:', this.socket ? 'SUCCESS' : 'FAILED');
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) {
      console.error('❌ Cannot setup event handlers - socket is null');
      return;
    }

    console.log('🔧 Setting up event handlers...');

    // Connection events
    this.socket.on('connect', () => {
      console.log('🟢 Socket connected:', this.socket?.id);
      console.log('🟢 Socket transport:', this.socket?.io?.engine?.transport?.name);
      console.log('🟢 Socket readyState:', this.socket?.io?.engine?.readyState);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectInterval = 1000;
      
      // Authenticate the client
      this.authenticate('operator', 'dashboard-user', 'Dashboard User');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔴 Socket disconnected:', reason);
      console.log('🔴 Socket ID was:', this.socket?.id);
      this.isConnecting = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, manual reconnection needed
        console.log('🔄 Server disconnected, attempting reconnection...');
        this.handleReconnection();
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network issues, try to reconnect
        console.log('🔄 Network issue detected, attempting reconnection...');
        setTimeout(() => this.handleReconnection(), 1000);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        description: (error as any).description,
        context: (error as any).context,
        type: (error as any).type,
        stack: error.stack
      });
      console.error('❌ Transport state:', this.socket?.io?.engine?.transport?.name);
      this.isConnecting = false;
      this.handleReconnection();
    });

    // Authentication response
    this.socket.on('authentication-success', (data) => {
      console.log('✅ Socket authenticated:', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('🚨 Socket error:', error);
    });

    // Heartbeat
    this.socket.on('pong', (data) => {
      console.log('💓 Heartbeat received:', data);
    });

    console.log('🔧 Event handlers setup complete');
  }

  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Maximum reconnection attempts reached');
      return;
    }

    setTimeout(() => {
      console.log(`🔄 Attempting reconnection (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts++;
      this.reconnectInterval = Math.min(this.reconnectInterval * 2, 10000); // Exponential backoff, max 10s
      this.connect();
    }, this.reconnectInterval);
  }

  // Authentication
  authenticate(role: string, userId: string, name: string) {
    if (this.socket?.connected) {
      this.socket.emit('authenticate', { role, userId, name });
    }
  }

  // Sensor subscriptions
  subscribeToSensor(sensorId: string) {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-sensor', sensorId);
      console.log(`📡 Subscribed to sensor: ${sensorId}`);
    }
  }

  unsubscribeFromSensor(sensorId: string) {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe-sensor', sensorId);
      console.log(`📡 Unsubscribed from sensor: ${sensorId}`);
    }
  }

  // Area subscription
  subscribeToArea(bounds: { north: number; south: number; east: number; west: number }) {
    if (this.socket?.connected) {
      this.socket.emit('subscribe-area', bounds);
      console.log('📡 Subscribed to area updates:', bounds);
    }
  }

  // Alert actions
  acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    if (this.socket?.connected) {
      this.socket.emit('acknowledge-alert', { alertId, acknowledgedBy });
      console.log(`✅ Alert acknowledged: ${alertId}`);
    }
  }

  requestRiskAssessment(sensorId: string, force = false) {
    if (this.socket?.connected) {
      this.socket.emit('request-risk-assessment', { sensorId, force });
      console.log(`🔍 Risk assessment requested for: ${sensorId}`);
    }
  }

  // Heartbeat
  sendHeartbeat() {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  // Event listeners
  onSensorReading(callback: (data: { sensorId: string; reading: any; sensor?: any }) => void) {
    this.socket?.on('sensor-reading', callback);
  }

  onRiskUpdate(callback: (data: { sensorId: string; riskLevel: string; confidence: number; location: any; timestamp: Date }) => void) {
    this.socket?.on('risk-update', callback);
  }

  onAlertTrigger(callback: (data: { alert: any; sensor: any; sensorReading: any }) => void) {
    this.socket?.on('alert-trigger', callback);
  }

  onCriticalAlert(callback: (data: { alert: any; sensor: any; urgent: boolean }) => void) {
    this.socket?.on('critical-alert', callback);
  }

  onAlertAcknowledged(callback: (data: { alertId: string; acknowledgedBy: string; acknowledgedAt: Date }) => void) {
    this.socket?.on('alert-acknowledged', callback);
  }

  onAlertResolved(callback: (data: { alertId: string; resolvedBy: string; resolution: string; resolvedAt: Date }) => void) {
    this.socket?.on('alert-resolved', callback);
  }

  onAlertEscalated(callback: (data: { alertId: string; escalationLevel: number; escalatedTo: string; priority: string }) => void) {
    this.socket?.on('alert-escalated', callback);
  }

  onSensorStatus(callback: (data: { sensorId: string; status: string; previousStatus: string }) => void) {
    this.socket?.on('sensor-status', callback);
  }

  onDashboardData(callback: (data: { activeAlerts: any[]; sensorStats: any; highRiskReadings: any[] }) => void) {
    this.socket?.on('dashboard-data', callback);
  }

  // Remove event listeners
  offSensorReading(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('sensor-reading', callback);
    } else {
      this.socket?.off('sensor-reading');
    }
  }

  offRiskUpdate(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('risk-update', callback);
    } else {
      this.socket?.off('risk-update');
    }
  }

  offAlertTrigger(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('alert-trigger', callback);
    } else {
      this.socket?.off('alert-trigger');
    }
  }

  offCriticalAlert(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('critical-alert', callback);
    } else {
      this.socket?.off('critical-alert');
    }
  }

  offAlertAcknowledged(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('alert-acknowledged', callback);
    } else {
      this.socket?.off('alert-acknowledged');
    }
  }

  offSensorStatus(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('sensor-status', callback);
    } else {
      this.socket?.off('sensor-status');
    }
  }

  offDashboardData(callback?: (...args: any[]) => void) {
    if (callback) {
      this.socket?.off('dashboard-data', callback);
    } else {
      this.socket?.off('dashboard-data');
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Get socket instance for custom usage
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
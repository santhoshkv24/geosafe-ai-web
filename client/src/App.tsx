import React, { useState, useEffect } from 'react';
import './App.css';
import { Sensor, Alert } from './types';
import { simulationService } from './services/simulation';
import socketService from './services/socket';
import MapComponent from './components/MapComponent';
import SensorPanel from './components/SensorPanel';

const App: React.FC = () => {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    showNormal: true,
    showWarning: true,
    showAlert: true,
    showOffline: false
  });

  // Initialize real WebSocket connection and simulation service
  useEffect(() => {
    console.log('🔧 Initializing GeoSafe AI with real AI predictions...');
    
    // Set up WebSocket event listeners BEFORE connecting
    const socket = socketService.getSocket();
    
    // Connection event handlers
    const handleConnect = () => {
      console.log('✅ Connected to backend server');
      setConnected(true);
    };

    const handleDisconnect = (reason: string) => {
      console.log('❌ Disconnected from backend server:', reason);
      setConnected(false);
    };

    const handleConnectError = (error: any) => {
      console.error('💥 WebSocket connection error:', error);
      setConnected(false);
    };

    // Setup socket event handlers for backend-generated data
    const handleSensorReading = (data: { sensorId: string; reading: any; sensor?: any }) => {
      console.log('📡 Received sensor reading from backend:', data.sensorId, data.reading?.riskPrediction?.level);
      console.log('📡 Full sensor reading data:', JSON.stringify(data, null, 2));
      // Let simulation service handle the backend data
      simulationService.handleBackendSensorReading(data);
      
      // Also update the sensor in our local state with the new risk level
      setSensors(prevSensors => {
        return prevSensors.map(sensor => 
          sensor.sensorId === data.sensorId 
            ? { ...sensor, lastReading: data.reading, riskLevel: data.reading?.riskPrediction?.level || sensor.riskLevel }
            : sensor
        );
      });
    };

    const handleAlertTrigger = (data: { alert: Alert; sensor: Sensor }) => {
      console.log('🚨 Alert received from backend:', data.alert);
      setAlerts(prevAlerts => {
        const safeAlerts = prevAlerts || [];
        return [data.alert, ...safeAlerts.slice(0, 9)];
      });
    };

    const handleRiskUpdate = (data: { sensorId: string; riskLevel: string; confidence: number }) => {
      console.log('📊 Risk update from backend:', data.sensorId, '→', data.riskLevel, `(${data.confidence})`);
      console.log('📊 Full risk update data:', JSON.stringify(data, null, 2));
      // Update sensor risk level directly in state
      setSensors(prevSensors => {
        const updated = prevSensors.map(sensor => 
          sensor.sensorId === data.sensorId 
            ? { ...sensor, riskLevel: data.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' }
            : sensor
        );
        console.log('📊 Updated sensor state for', data.sensorId, 'to', data.riskLevel);
        return updated;
      });
    };

    // Set up event listeners using the socket service methods
    if (socket) {
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);
    }
    
    socketService.onSensorReading(handleSensorReading);
    socketService.onAlertTrigger(handleAlertTrigger);
    socketService.onRiskUpdate(handleRiskUpdate);
    
    // Connect to backend WebSocket AFTER setting up listeners
    console.log('🔌 Attempting to connect to backend...');
    console.log('🔌 Socket service state:', socketService.isConnected());
    
    // Test socket connection with immediate status check
    setTimeout(() => {
      console.log('🔍 Connection status after 1 second:', socketService.isConnected());
      const socket = socketService.getSocket();
      console.log('🔍 Socket instance:', socket ? 'exists' : 'null');
      console.log('🔍 Socket connected:', socket?.connected);
      console.log('🔍 Socket transport:', socket?.io?.engine?.transport?.name);
    }, 1000);
    
    // IMPORTANT: Always initiate the socket connection
    socketService.connect();
    
    // Test backend connectivity first
    fetch('http://localhost:5000/api/sensors?includeLatestReading=true')
      .then(response => {
        console.log('✅ Backend is reachable via HTTP:', response.status);
        if (response.ok) {
          return response.json();
        }
        throw new Error(`HTTP ${response.status}`);
      })
      .then(data => {
        console.log('📊 Backend sensors data:', data);
        if (data.sensors && Array.isArray(data.sensors)) {
          console.log(`🎯 Found ${data.sensors.length} sensors from backend`);
          console.log('📊 Sample sensor data:', data.sensors[0]);
          
          // Sensors now come with risk levels from database - no need to default
          const sensorsWithRiskLevels = data.sensors.map((sensor: any) => {
            return {
              ...sensor,
              riskLevel: sensor.riskLevel || 'LOW', // Risk level from database
              status: sensor.status || 'ACTIVE' // Default to ACTIVE so sensors are visible
            };
          });
          
          console.log('📊 Processed sensor with risk level:', sensorsWithRiskLevels[0]);
          
          // Update simulation service with backend sensors
          simulationService.setSensors(sensorsWithRiskLevels);
          setSensors(sensorsWithRiskLevels);
          
          // Set up periodic sensor data refresh every 5 seconds (shorter for real-time feel)
          const refreshInterval = setInterval(() => {
            fetch('http://localhost:5000/api/sensors?includeLatestReading=true')
              .then(response => response.json())
              .then(refreshData => {
                if (refreshData.sensors) {
                  console.log('🔄 Fetching sensor data with real-time risk levels from database...');
                  
                  // Process sensor data - now includes real risk levels from database
                  const processedRefreshData = refreshData.sensors.map((sensor: any) => {
                    return {
                      ...sensor,
                      riskLevel: sensor.riskLevel || 'LOW', // Risk level from database
                      status: sensor.status || 'ACTIVE'
                    };
                  });
                  
                  console.log(`🔄 Updated ${processedRefreshData.length} sensors with database risk levels`);
                  simulationService.setSensors(processedRefreshData);
                  setSensors(processedRefreshData);
                }
              })
              .catch(error => console.log('🔄 Sensor refresh failed:', error));
          }, 5000); // 5 seconds instead of 30
          
          // Set up periodic alerts refresh every 10 seconds
          const alertsInterval = setInterval(() => {
            fetch('http://localhost:5000/api/alerts?status=ACTIVE&limit=10&sortBy=triggeredAt&sortOrder=desc')
              .then(response => response.json())
              .then(alertsData => {
                if (alertsData.data && Array.isArray(alertsData.data)) {
                  console.log(`📢 Fetched ${alertsData.data.length} active alerts from backend`);
                  setAlerts(alertsData.data);
                } else {
                  console.log('📢 No alerts data received from backend');
                }
              })
              .catch(error => console.log('📢 Alerts refresh failed:', error));
          }, 10000); // 10 seconds for alerts
          
          // Set up periodic connection status check every 2 seconds
          const connectionCheckInterval = setInterval(() => {
            const isConnected = socketService.isConnected();
            const currentStatus = connected ? 'CONNECTED' : 'DISCONNECTED';
            const newStatus = isConnected ? 'CONNECTED' : 'DISCONNECTED';
            
            if (currentStatus !== newStatus) {
              console.log(`🔄 Connection status changed: ${currentStatus} → ${newStatus}`);
              setConnected(isConnected);
            }
          }, 2000);
          
          // Note: cleanup is handled by the effect's return below
          
          return () => {
            clearInterval(refreshInterval);
            clearInterval(alertsInterval);
          };
        }
        // Socket connect already initiated above
      })
      .catch(error => {
        console.error('❌ Backend is NOT reachable via HTTP:', error);
        console.error('❌ Make sure backend is running on port 5000');
        socketService.connect(); // Try anyway
      });
    
    // Check initial connection status
    if (socketService.isConnected()) {
      console.log('🔌 Socket already connected');
      setConnected(true);
    } else {
      console.log('🔌 Socket not yet connected, waiting for connection event');
    }
    
    // Inject socket service into simulation for real backend communication
    simulationService.setSocketService(socketService);
    
    // Load initial sensor data from simulation
    setSensors(simulationService.getSensors());
    setAlerts(simulationService.getAlerts());
    setLoading(false);
    
    // Set up simulation updates
    const handleSimulationUpdate = (updatedSensors: Sensor[], updatedAlerts: Alert[]) => {
      console.log('📊 Simulation data updated', { 
        sensors: updatedSensors.length, 
        alerts: updatedAlerts.length 
      });
      setSensors([...updatedSensors]); 
      setAlerts([...updatedAlerts]);
    };
    
    simulationService.onUpdate(handleSimulationUpdate);
    
    // Frontend is now ready to receive data from backend
    // IMPORTANT: NO local simulation - only backend data
    console.log('🔄 Frontend ready to receive sensor data from backend');
    console.log('⚠️ Frontend will NOT generate any data - backend only!');
    
    // DO NOT start any simulation - only receive backend data
    // simulationService.startSimulation(); // DISABLED - backend only
    
    return () => {
      // Clean up event listeners
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
      }
      socketService.offSensorReading(handleSensorReading);
      socketService.offAlertTrigger(handleAlertTrigger);
      socketService.offRiskUpdate(handleRiskUpdate);
      
      simulationService.stopSimulation();
      socketService.disconnect();
    };
  }, []);

  // Load initial data (now handled by simulation service in the first useEffect)
  // This effect is kept for potential future API integration
  useEffect(() => {
    // Data loading is now handled by simulation service
    // This placeholder remains for future API integration
  }, []);

  const handleSensorSelect = (sensorId: string) => {
    console.log(`🎯 Sensor selected in App: ${sensorId}`);
    setSelectedSensor(sensorId);
  };

  const handleFilterChange = (filterName: keyof typeof filters) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  const getFilteredSensors = () => {
    if (!sensors || !Array.isArray(sensors)) return [];
    return sensors.filter(sensor => {
      const riskLevel = sensor.riskLevel || 'LOW';
      const isOnline = sensor.status === 'ACTIVE';

      // Show sensors based on filters, but don't require them to be online unless "Show Offline" is unchecked
      switch (riskLevel) {
        case 'LOW':
          return filters.showNormal && (isOnline || filters.showOffline || true); // Show all LOW risk sensors
        case 'MEDIUM':
          return filters.showWarning && (isOnline || filters.showOffline || true); // Show all MEDIUM risk sensors  
        case 'HIGH':
          return filters.showAlert && (isOnline || filters.showOffline || true); // Show all HIGH risk sensors
        default:
          return isOnline || filters.showOffline || true; // Show all by default
      }
    });
  };

  const getCurrentMineInfo = () => {
    const safeSensors = sensors || [];
    const safeAlerts = alerts || [];
    const activeSensors = safeSensors.filter(s => s.status === 'ACTIVE').length;
    const totalSensors = safeSensors.length;
    const criticalAlerts = safeAlerts.filter(a => a.severity === 'CRITICAL').length;
    
    return {
      activeSensors,
      totalSensors,
      criticalAlerts
    };
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div>Loading GeoSafe AI Dashboard...</div>
      </div>
    );
  }

  const mineInfo = getCurrentMineInfo();
  const filteredSensors = getFilteredSensors();

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <h1>
          GeoSafe AI - Mine Safety Monitoring 
          <span style={{fontSize: '12px', background: '#2ecc71', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px'}}>LIVE AI</span>
          <span style={{
            fontSize: '12px', 
            background: connected ? '#2ecc71' : '#f39c12', 
            color: 'white',
            padding: '2px 6px', 
            borderRadius: '4px', 
            marginLeft: '8px'
          }}>
            {connected ? '🟢 WEBSOCKET' : '� POLLING MODE'}
          </span>
        </h1>
        <div className="mine-info">
          <span>Active Sensors: {mineInfo.activeSensors}/{mineInfo.totalSensors}</span>
          <span>Critical Alerts: {mineInfo.criticalAlerts}</span>
          <span>Southern India Mines</span>
          {!connected && <span style={{color: '#f39c12'}}>🔄 Polling Mode</span>}
        </div>
      </header>

      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        {/* Sensor Filters */}
        <div className="sidebar-section">
          <h3>Sensor Filters</h3>
          <div className="sensor-filters">
            <div className="filter-option">
              <input 
                type="checkbox" 
                id="normal"
                checked={filters.showNormal}
                onChange={() => handleFilterChange('showNormal')}
              />
              <label htmlFor="normal">🟢 Normal ({(sensors || []).filter(s => s.riskLevel === 'LOW').length})</label>
            </div>
            <div className="filter-option">
              <input 
                type="checkbox" 
                id="warning"
                checked={filters.showWarning}
                onChange={() => handleFilterChange('showWarning')}
              />
              <label htmlFor="warning">🟡 Warning ({(sensors || []).filter(s => s.riskLevel === 'MEDIUM').length})</label>
            </div>
            <div className="filter-option">
              <input 
                type="checkbox" 
                id="alert"
                checked={filters.showAlert}
                onChange={() => handleFilterChange('showAlert')}
              />
              <label htmlFor="alert">🔴 Alert ({(sensors || []).filter(s => s.riskLevel === 'HIGH').length})</label>
            </div>
            <div className="filter-option">
              <input 
                type="checkbox" 
                id="offline"
                checked={filters.showOffline}
                onChange={() => handleFilterChange('showOffline')}
              />
              <label htmlFor="offline">⚫ Show Offline</label>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="sidebar-section">
          <h3>Recent Alerts</h3>
          {alerts.length === 0 ? (
            <p style={{ color: '#666', fontSize: '14px' }}>No recent alerts</p>
          ) : (
            alerts.slice(0, 5).map((alert) => (
              <div 
                key={alert._id}
                className={`alert-panel ${alert.severity?.toLowerCase()}`}
                onClick={() => handleSensorSelect(alert.sensorId)}
                style={{ cursor: 'pointer' }}
              >
                <div className="alert-header">
                  <span className="sensor-id">{alert.sensorId}</span>
                  <span className="alert-badge">{alert.severity}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {alert.alertType.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  {new Date(alert.triggeredAt).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Sensor Details */}
        {selectedSensor && (
          <div className="sidebar-section" style={{ 
            background: '#f8f9fa', 
            border: '2px solid #3498db',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px'
          }}>
            <h3 style={{ color: '#2c3e50', marginBottom: '12px' }}>Sensor Details</h3>
            <SensorPanel 
              sensorId={selectedSensor} 
              onClose={() => setSelectedSensor(null)}
            />
          </div>
        )}

        {/* Live Data Summary */}
        <div className="sidebar-section">
          <h3>System Overview</h3>
          <div className="live-data">
            <div className="data-item">
              <span className="data-label">Total Sensors</span>
              <span className="data-value">{(sensors || []).length}</span>
            </div>
            <div className="data-item">
              <span className="data-label">Active</span>
              <span className="data-value">{mineInfo.activeSensors}</span>
            </div>
            <div className="data-item">
              <span className="data-label">High Risk</span>
              <span className="data-value" style={{ color: '#e74c3c' }}>
                {(sensors || []).filter(s => s.riskLevel === 'HIGH').length}
              </span>
            </div>
            <div className="data-item">
              <span className="data-label">Medium Risk</span>
              <span className="data-value" style={{ color: '#f39c12' }}>
                {(sensors || []).filter(s => s.riskLevel === 'MEDIUM').length}
              </span>
            </div>
            <div className="data-item">
              <span className="data-label">Normal</span>
              <span className="data-value" style={{ color: '#2ecc71' }}>
                {(sensors || []).filter(s => s.riskLevel === 'LOW').length}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Map Area */}
      <main className="dashboard-main">
        <MapComponent 
          sensors={filteredSensors}
          alerts={alerts}
          onSensorSelect={handleSensorSelect}
          selectedSensor={selectedSensor}
        />
      </main>
    </div>
  );
};

export default App;

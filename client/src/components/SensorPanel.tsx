import React, { useState, useEffect } from 'react';
import { Sensor } from '../types';
import { simulationService } from '../services/simulation';

interface SensorPanelProps {
  sensorId: string;
  onClose: () => void;
}

const SensorPanel: React.FC<SensorPanelProps> = ({ sensorId, onClose }) => {
  const [sensor, setSensor] = useState<Sensor | null>(null);

  const buttonStyle = {
    marginTop: '10px',
    padding: '8px 16px',
    border: 'none',
    background: '#e74c3c',
    color: 'white',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  useEffect(() => {
    const foundSensor = simulationService.getSensor(sensorId);
    setSensor(foundSensor || null);
  }, [sensorId]);

  if (!sensor) {
    return (
      <div>
        <h3>Sensor Details</h3>
        <p>Sensor not found</p>
        <button onClick={onClose} style={buttonStyle}>Close</button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#2ecc71';
      case 'INACTIVE': return '#95a5a6';
      case 'MAINTENANCE': return '#f39c12';
      case 'ERROR': return '#e74c3c';
      default: return '#666';
    }
  };

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'LOW': return '#2ecc71';
      case 'MEDIUM': return '#f39c12';
      case 'HIGH': return '#e74c3c';
      default: return '#666';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Sensor Details</h3>
        <button onClick={onClose} style={{ ...buttonStyle, background: '#95a5a6', marginTop: 0 }}>×</button>
      </div>
      
      <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>ID:</strong> {sensor.sensorId}
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Name:</strong> {sensor.name}
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Type:</strong> {sensor.sensorType}
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Status:</strong>{' '}
          <span style={{ color: getStatusColor(sensor.status), fontWeight: 'bold' }}>
            {sensor.status}
          </span>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Risk Level:</strong>{' '}
          <span style={{ color: getRiskColor(sensor.riskLevel), fontWeight: 'bold' }}>
            {sensor.riskLevel || 'UNKNOWN'}
          </span>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Battery:</strong> {sensor.batteryLevel}%
          <div style={{ 
            width: '100%', 
            height: '4px', 
            background: '#f0f0f0', 
            borderRadius: '2px', 
            marginTop: '2px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              width: `${sensor.batteryLevel}%`, 
              height: '100%', 
              background: sensor.batteryLevel > 50 ? '#2ecc71' : sensor.batteryLevel > 20 ? '#f39c12' : '#e74c3c',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Zone:</strong> {sensor.mineGrid.zone}
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Grid Position:</strong> ({sensor.mineGrid.x}, {sensor.mineGrid.y})
        </div>
        
        <div style={{ marginBottom: '8px' }}>
          <strong>Coordinates:</strong><br />
          <span style={{ fontSize: '12px', color: '#666' }}>
            {sensor.location.coordinates[1].toFixed(4)}, {sensor.location.coordinates[0].toFixed(4)}
          </span>
        </div>
        
        {sensor.lastReading && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: '#f8f9fa', 
            borderRadius: '4px',
            border: '1px solid #e9ecef'
          }}>
            <strong style={{ fontSize: '13px' }}>Latest Reading:</strong>
            <div style={{ marginTop: '4px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                <div>Rainfall: {sensor.lastReading.readings.Rainfall_mm.toFixed(1)} mm</div>
                <div>Slope: {sensor.lastReading.readings.Slope_Angle.toFixed(1)}°</div>
                <div>Soil Sat: {(sensor.lastReading.readings.Soil_Saturation * 100).toFixed(0)}%</div>
                <div>Vegetation: {(sensor.lastReading.readings.Vegetation_Cover * 100).toFixed(0)}%</div>
                <div>Seismic: {sensor.lastReading.readings.Earthquake_Activity.toFixed(1)}</div>
                <div>Water: {sensor.lastReading.readings.Proximity_to_Water.toFixed(0)}m</div>
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>
                Confidence: {(sensor.lastReading.riskPrediction.confidence * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                Updated: {new Date(sensor.lastReading.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
        
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#999' }}>
          <div>Installed: {new Date(sensor.installationDate).toLocaleDateString()}</div>
          {sensor.lastMaintenanceDate && (
            <div>Last Maintenance: {new Date(sensor.lastMaintenanceDate).toLocaleDateString()}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SensorPanel;
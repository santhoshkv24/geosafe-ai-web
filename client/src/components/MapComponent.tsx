import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Sensor, Alert } from '../types';
import { MINE_LOCATIONS } from '../services/simulation';

// Fix for default markers in Leaflet with Webpack
let DefaultIcon = L.divIcon({
  html: '<div style="background-color: #3498db; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  sensors: Sensor[];
  alerts: Alert[];
  onSensorSelect: (sensorId: string) => void;
  selectedSensor: string | null;
}

const MapComponent: React.FC<MapComponentProps> = ({
  sensors,
  alerts,
  onSensorSelect,
  selectedSensor
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Center on Southern India
    const map = L.map(mapRef.current, {
      center: [15.3173, 75.7139], // Centered on Karnataka/Southern India
      zoom: 7,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      touchZoom: true
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    // Add mine boundary areas
    MINE_LOCATIONS.forEach(mine => {
      const circle = L.circle([mine.location.lat, mine.location.lng], {
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 0.1,
        radius: 2000, // 2km radius
        weight: 2,
        opacity: 0.6
      }).addTo(map);

      circle.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #2c3e50;">${mine.name}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;">Zone: ${mine.zone}</p>
          <p style="margin: 0; font-size: 12px; color: #666;">${mine.description}</p>
        </div>
      `);
    });

    mapInstanceRef.current = map;
    setMapLoaded(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update sensors on map
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    
    console.log(`🗺️ MapComponent re-rendering with ${sensors.length} sensors`);
    
    // Clear existing markers
    Object.values(markersRef.current).forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = {};
    
    // If no sensors, show message on map
    if (sensors.length === 0) {
      console.log('🗺️ No sensors to display - waiting for backend data');
      return;
    }

    // Add sensors to map
    sensors.forEach(sensor => {
      if (!sensor.location?.coordinates) return;
      
      const [lng, lat] = sensor.location.coordinates;
      const isSelected = selectedSensor === sensor.sensorId;

      // Create risk-based icon
      const riskLevel = sensor.riskLevel || 'LOW';
      const riskColors = {
        'LOW': '#2ecc71',
        'MEDIUM': '#f39c12', 
        'HIGH': '#e74c3c'
      };

      const color = riskColors[riskLevel];

      const icon = L.divIcon({
        html: `<div style="
          background-color: ${color}; 
          width: ${isSelected ? 24 : 20}px; 
          height: ${isSelected ? 24 : 20}px; 
          border-radius: 50%; 
          border: 3px solid ${isSelected ? '#2c3e50' : 'white'}; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 10px;
        ">
          ${riskLevel === 'HIGH' ? '!' : riskLevel === 'MEDIUM' ? '⚠' : '✓'}
        </div>`,
        iconSize: [isSelected ? 24 : 20, isSelected ? 24 : 20],
        iconAnchor: [isSelected ? 12 : 10, isSelected ? 12 : 10],
        popupAnchor: [0, isSelected ? -12 : -10]
      });

      const marker = L.marker([lat, lng], { icon })
        .addTo(mapInstanceRef.current!);

      // Create detailed popup
      const lastReading = sensor.lastReading;
      const popupContent = `
        <div style="min-width: 250px;">
          <h3 style="margin: 0 0 8px 0; color: #2c3e50;">
            ${sensor.name || `Sensor ${sensor.sensorId}`}
          </h3>
          <div style="margin-bottom: 8px;">
            <span style="
              background: ${color}; 
              color: white; 
              padding: 2px 8px; 
              border-radius: 12px; 
              font-size: 12px; 
              font-weight: bold;
            ">
              ${riskLevel} RISK
            </span>
          </div>
          
          <div style="font-size: 12px; line-height: 1.4;">
            <strong>Sensor ID:</strong> ${sensor.sensorId}<br>
            <strong>Status:</strong> ${sensor.status}<br>
            
            ${lastReading ? `
              <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;">
              <strong>Latest Reading:</strong><br>
              <div style="margin-left: 8px;">
                <strong>Risk Level:</strong> ${lastReading.riskPrediction?.level || 'Unknown'}<br>
                <strong>Confidence:</strong> ${lastReading.riskPrediction?.confidence ? (lastReading.riskPrediction.confidence * 100).toFixed(1) + '%' : 'N/A'}<br>
              </div>
              <small style="color: #666;">
                Updated: ${new Date(lastReading.timestamp).toLocaleString()}
              </small>
            ` : '<em>No recent readings</em>'}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      // Handle click events
      marker.on('click', () => {
        onSensorSelect(sensor.sensorId);
      });

      markersRef.current[sensor.sensorId] = marker;
    });

  }, [sensors, selectedSensor, mapLoaded, onSensorSelect]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <div>Loading Southern India Mine Map...</div>
        </div>
      )}
      
      {/* Show empty state message when no sensors */}
      {mapLoaded && sensors.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          border: '2px solid #f39c12'
        }}>
          <div style={{ textAlign: 'center', color: '#e67e22' }}>
            <strong>⚠️ No Sensor Data Available</strong>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              Waiting for backend connection...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;
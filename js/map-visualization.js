/**
 * Map visualization using Leaflet for route display
 */
class MapVisualization {
    constructor(containerId) {
        this.containerId = containerId;
        this.map = null;
        this.routeLayer = null;
        this.startMarker = null;
        this.endMarker = null;
    }

    /**
     * Initialize the map
     * @param {Object} bounds - Map bounds {minLat, maxLat, minLon, maxLon, center}
     */
    initializeMap(bounds) {
        // Create map centered on route
        this.map = L.map(this.containerId).setView(
            [bounds.center.lat, bounds.center.lon],
            10
        );

        // Define base layers
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            name: 'Streets'
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, Earthstar Geographics',
            name: 'Satellite'
        });

        // Add default layer (streets)
        streetLayer.addTo(this.map);

        // Create base layer control
        const baseLayers = {
            'Streets': streetLayer,
            'Satellite': satelliteLayer
        };

        // Add layer control to map
        L.control.layers(baseLayers, null, {
            position: 'topright',
            collapsed: true
        }).addTo(this.map);

        // Fit map to route bounds
        this.map.fitBounds([
            [bounds.minLat, bounds.minLon],
            [bounds.maxLat, bounds.maxLon]
        ], { padding: [20, 20] });
    }

    /**
     * Display route on map
     * @param {Array} points - Route points with lat/lon
     * @param {Object} routeInfo - Route metadata
     */
    displayRoute(points, routeInfo) {
        if (!this.map) {
            throw new Error('Map not initialized');
        }

        // Remove existing route layer
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        // Remove existing markers
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }

        // Create route line
        const routeCoords = points.map(point => [point.lat, point.lon]);
        
        this.routeLayer = L.polyline(routeCoords, {
            color: '#3498db',
            weight: 4,
            opacity: 0.8,
            lineJoin: 'round',
            lineCap: 'round'
        }).addTo(this.map);

        // Add start marker (green)
        const startPoint = points[0];
        this.startMarker = L.circleMarker([startPoint.lat, startPoint.lon], {
            radius: 8,
            fillColor: '#2ecc71',
            color: 'white',
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(this.map);

        this.startMarker.bindPopup(`
            <div class="route-popup">
                <strong>Start</strong><br>
                Elevation: ${Math.round(startPoint.elevation)}m
            </div>
        `);

        // Add end marker (red)
        const endPoint = points[points.length - 1];
        this.endMarker = L.circleMarker([endPoint.lat, endPoint.lon], {
            radius: 8,
            fillColor: '#e74c3c',
            color: 'white',
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(this.map);

        this.endMarker.bindPopup(`
            <div class="route-popup">
                <strong>Finish</strong><br>
                Distance: ${this.formatDistance(endPoint.distance)}<br>
                Elevation: ${Math.round(endPoint.elevation)}m
            </div>
        `);

        // Add route info popup on click
        this.routeLayer.bindPopup(`
            <div class="route-popup">
                <strong>${routeInfo.name}</strong><br>
                Distance: ${this.formatDistance(routeInfo.stats.distance)}<br>
                Elevation Gain: ${Math.round(routeInfo.stats.elevationGain)}m<br>
                Elevation Loss: ${Math.round(routeInfo.stats.elevationLoss)}m<br>
                Points: ${routeInfo.stats.pointCount}
            </div>
        `);
    }

    /**
     * Fit map to route bounds
     * @param {Object} bounds 
     */
    fitToBounds(bounds) {
        if (this.map) {
            this.map.fitBounds([
                [bounds.minLat, bounds.minLon],
                [bounds.maxLat, bounds.maxLon]
            ], { padding: [20, 20] });
        }
    }

    /**
     * Clear all route data from map
     */
    clearRoute() {
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
            this.startMarker = null;
        }
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
            this.endMarker = null;
        }
    }

    /**
     * Format distance for display
     * @param {number} meters 
     * @returns {string}
     */
    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        }
        return `${(meters / 1000).toFixed(1)}km`;
    }

    /**
     * Destroy the map
     */
    destroy() {
        if (this.map) {
            this.clearRoute();
            this.map.remove();
            this.map = null;
        }
    }
}
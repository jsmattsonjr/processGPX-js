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
	 */
	initializeMap() {
		// Create map with default view
		this.map = L.map(this.containerId).setView([0, 0], 2);

		// Define base layers
		const streetLayer = L.tileLayer(
			"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
			{
				attribution: "© OpenStreetMap contributors",
				name: "Streets",
			},
		);

		const satelliteLayer = L.tileLayer(
			"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
			{
				attribution: "© Esri, Maxar, Earthstar Geographics",
				name: "Satellite",
			},
		);

		// Add default layer (streets)
		streetLayer.addTo(this.map);

		// Create base layer control
		const baseLayers = {
			Streets: streetLayer,
			Satellite: satelliteLayer,
		};

		// Add layer control to map
		L.control
			.layers(baseLayers, null, {
				position: "topright",
				collapsed: true,
			})
			.addTo(this.map);
	}

	/**
	 * Display route on map from GeoJSON
	 * @param {Object} geoJson - GeoJSON object
	 */
	displayRoute(geoJson) {
		if (!this.map) {
			throw new Error("Map not initialized");
		}

		// Clear existing route
		this.clearRoute();

		// Find the first LineString feature (track)
		const trackFeature = geoJson.features.find(
			(feature) => feature.geometry && feature.geometry.type === "LineString",
		);

		if (!trackFeature) {
			throw new Error("No track LineString found in GeoJSON");
		}

		// Use Leaflet's built-in GeoJSON layer
		this.routeLayer = L.geoJSON(trackFeature, {
			style: {
				color: "#3498db",
				weight: 4,
				opacity: 0.8,
				lineJoin: "round",
				lineCap: "round",
			},
		}).addTo(this.map);

		// Get coordinates for markers
		const coordinates = trackFeature.geometry.coordinates;
		const startCoord = coordinates[0];
		const endCoord = coordinates[coordinates.length - 1];

		// Add start marker (green)
		this.startMarker = L.circleMarker([startCoord[1], startCoord[0]], {
			radius: 8,
			fillColor: "#2ecc71",
			color: "white",
			weight: 3,
			opacity: 1,
			fillOpacity: 1,
		}).addTo(this.map);

		this.startMarker.bindPopup(`
            <div class="route-popup">
                <strong>Start</strong><br>
                Elevation: ${Math.round(startCoord[2] || 0)}m
            </div>
        `);

		// Add end marker (red)
		this.endMarker = L.circleMarker([endCoord[1], endCoord[0]], {
			radius: 8,
			fillColor: "#e74c3c",
			color: "white",
			weight: 3,
			opacity: 1,
			fillOpacity: 1,
		}).addTo(this.map);

		this.endMarker.bindPopup(`
            <div class="route-popup">
                <strong>Finish</strong><br>
                Elevation: ${Math.round(endCoord[2] || 0)}m
            </div>
        `);

		// Add route info popup on click
		const routeName = trackFeature.properties?.name || "Unnamed Route";
		this.routeLayer.bindPopup(`
            <div class="route-popup">
                <strong>${routeName}</strong><br>
                Points: ${coordinates.length}
            </div>
        `);

		// Fit map to route bounds
		this.map.fitBounds(this.routeLayer.getBounds(), { padding: [20, 20] });
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

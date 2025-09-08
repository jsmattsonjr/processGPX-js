/**
 * Map visualization using Leaflet for route display
 */
export class MapVisualization {
	constructor(containerId) {
		this.containerId = containerId;
		this.map = null;
		this.routeLayer = null;
		this.processedRouteLayer = null;
		this.startMarker = null;
		this.endMarker = null;
		this.crosshairMarkers = [];
		this.originalTrackFeature = null;
		this.processedTrackFeature = null;
		this.originalPointMarkers = [];
		this.processedPointMarkers = [];
		this.pointsVisible = false;
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

		// Add zoom event listener for track points visibility
		this.map.on('zoomend', () => {
			this.updatePointsVisibility();
		});
	}

	/**
	 * Display route on map from LineString feature
	 * @param {Object} trackFeature - LineString feature object
	 */
	displayRoute(trackFeature) {
		if (!this.map) {
			throw new Error("Map not initialized");
		}

		// Clear existing route
		this.clearRoute();

		// Validate that we have a LineString feature
		if (
			!trackFeature ||
			!trackFeature.geometry ||
			trackFeature.geometry.type !== "LineString"
		) {
			throw new Error("Invalid track feature provided");
		}

		// Store the original track feature
		this.originalTrackFeature = trackFeature;

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

		// Create track point markers and check initial visibility
		this.createTrackPointMarkers(trackFeature, 'original');
		
		// Force initial visibility check after a short delay to ensure markers are ready
		setTimeout(() => {
			this.updatePointsVisibility();
		}, 100);
	}

	/**
	 * Display processed route on map alongside original route
	 * @param {Object} processedTrackFeature - Processed LineString feature object
	 */
	displayProcessedRoute(processedTrackFeature) {
		if (!this.map) {
			throw new Error("Map not initialized");
		}

		// Validate that we have a LineString feature
		if (
			!processedTrackFeature ||
			!processedTrackFeature.geometry ||
			processedTrackFeature.geometry.type !== "LineString"
		) {
			throw new Error("Invalid processed track feature provided");
		}

		// Store the processed track feature
		this.processedTrackFeature = processedTrackFeature;

		// Remove existing processed route if any
		if (this.processedRouteLayer) {
			this.map.removeLayer(this.processedRouteLayer);
		}

		// Use Leaflet's built-in GeoJSON layer with different styling
		this.processedRouteLayer = L.geoJSON(processedTrackFeature, {
			style: {
				color: "#e74c3c", // Red color for processed route
				weight: 4,
				opacity: 0.8,
				lineJoin: "round",
				lineCap: "round",
			},
		}).addTo(this.map);

		// Add processed route info popup on click
		const routeName =
			processedTrackFeature.properties?.name || "Processed Route";
		const coordinates = processedTrackFeature.geometry.coordinates;
		this.processedRouteLayer.bindPopup(`
            <div class="route-popup">
                <strong>${routeName}</strong><br>
                Points: ${coordinates.length}<br>
                <em>Processed Route</em>
            </div>
        `);

		// Create processed track point markers and update visibility
		console.log('About to create processed track point markers');
		this.createTrackPointMarkers(processedTrackFeature, 'processed');
		
		// Update visibility for both original and processed markers
		setTimeout(() => {
			console.log('Delayed visibility update for processed route');
			this.updatePointsVisibility();
		}, 100);
	}

	/**
	 * Clear all route data from map
	 */
	clearRoute() {
		if (this.routeLayer) {
			this.map.removeLayer(this.routeLayer);
			this.routeLayer = null;
		}
		if (this.processedRouteLayer) {
			this.map.removeLayer(this.processedRouteLayer);
			this.processedRouteLayer = null;
		}
		if (this.startMarker) {
			this.map.removeLayer(this.startMarker);
			this.startMarker = null;
		}
		if (this.endMarker) {
			this.map.removeLayer(this.endMarker);
			this.endMarker = null;
		}
		this.clearCrosshairs();
		this.clearTrackPoints();
		this.originalTrackFeature = null;
		this.processedTrackFeature = null;
	}

	/**
	 * Update crosshair positions based on distance from elevation chart
	 * @param {number} distanceKm - Distance in kilometers from chart hover
	 */
	updateCrosshairs(distanceKm) {
		if (!this.map) return;

		// Clear existing crosshairs
		this.clearCrosshairs();

		// Convert distance to meters for calculations
		const distanceM = distanceKm * 1000;

		// Find positions on both routes at the given distance
		const positions = [];

		if (this.originalTrackFeature) {
			const pos = this.findPositionAtDistance(
				this.originalTrackFeature,
				distanceM,
			);
			if (pos) {
				positions.push({
					position: pos,
					color: "#3498db", // Blue for original route
					label: "Original",
				});
			}
		}

		if (this.processedTrackFeature) {
			const pos = this.findPositionAtDistance(
				this.processedTrackFeature,
				distanceM,
			);
			if (pos) {
				positions.push({
					position: pos,
					color: "#e74c3c", // Red for processed route
					label: "Processed",
				});
			}
		}

		// Create crosshair markers for each position found
		positions.forEach(({ position, color, label }) => {
			const marker = L.circleMarker([position.lat, position.lon], {
				radius: 6,
				fillColor: color,
				color: "black",
				weight: 2,
				opacity: 1,
				fillOpacity: 0.8,
			}).addTo(this.map);

			marker.bindPopup(`
				<div class="route-popup">
					<strong>${label} Route</strong><br>
					Distance: ${distanceKm.toFixed(2)}km<br>
					Elevation: ${Math.round(position.elevation || 0)}m
				</div>
			`);

			this.crosshairMarkers.push(marker);
		});
	}

	/**
	 * Clear all crosshair markers from the map
	 */
	clearCrosshairs() {
		this.crosshairMarkers.forEach((marker) => {
			this.map.removeLayer(marker);
		});
		this.crosshairMarkers = [];
	}

	/**
	 * Find position at given cumulative distance along a track
	 * @param {Object} trackFeature - LineString feature object
	 * @param {number} targetDistance - Target distance in meters
	 * @returns {Object|null} Position object with lat, lon, elevation
	 */
	findPositionAtDistance(trackFeature, targetDistance) {
		const coordinates = trackFeature.geometry.coordinates;
		let cumulativeDistance = 0;

		for (let i = 1; i < coordinates.length; i++) {
			const prev = coordinates[i - 1];
			const curr = coordinates[i];

			// Calculate distance between consecutive points using Turf.js
			const from = turf.point([prev[0], prev[1]]);
			const to = turf.point([curr[0], curr[1]]);
			const segmentDistance = turf.distance(from, to, { units: "meters" });

			if (cumulativeDistance + segmentDistance >= targetDistance) {
				// Target distance is within this segment - interpolate position
				const segmentProgress =
					(targetDistance - cumulativeDistance) / segmentDistance;

				// Linear interpolation
				const lat = prev[1] + (curr[1] - prev[1]) * segmentProgress;
				const lon = prev[0] + (curr[0] - prev[0]) * segmentProgress;
				const elevation = prev[2] + (curr[2] - prev[2]) * segmentProgress;

				return { lat, lon, elevation };
			}

			cumulativeDistance += segmentDistance;
		}

		// If target distance exceeds track length, return last point
		if (coordinates.length > 0) {
			const lastCoord = coordinates[coordinates.length - 1];
			return {
				lat: lastCoord[1],
				lon: lastCoord[0],
				elevation: lastCoord[2] || 0,
			};
		}

		return null;
	}

	/**
	 * Create individual track point markers for a route
	 * @param {Object} trackFeature - LineString feature object
	 * @param {string} routeType - 'original' or 'processed'
	 */
	createTrackPointMarkers(trackFeature, routeType) {
		if (!this.map) {
			console.log('No map available for createTrackPointMarkers');
			return;
		}

		if (!trackFeature || !trackFeature.geometry || !trackFeature.geometry.coordinates) {
			console.log('No valid track feature provided to createTrackPointMarkers');
			return;
		}

		const coordinates = trackFeature.geometry.coordinates;
		console.log(`Creating ${coordinates.length} markers for ${routeType} route`);
		
		const color = routeType === 'original' ? '#3498db' : '#e74c3c';

		// Clear existing markers for this route type FIRST
		if (routeType === 'original') {
			this.clearOriginalTrackPoints();
		} else {
			this.clearProcessedTrackPoints();
		}

		// Get the now-empty marker array reference
		const markers = routeType === 'original' ? this.originalPointMarkers : this.processedPointMarkers;

		// Create a marker for each track point
		coordinates.forEach((coord, index) => {
			if (!coord || coord.length < 2) {
				console.log(`Invalid coordinate at index ${index}:`, coord);
				return;
			}

			const marker = L.circleMarker([coord[1], coord[0]], {
				radius: routeType === 'original' ? 4 : 5, // Processed points slightly larger
				fillColor: color,
				color: 'white',
				weight: 2,
				opacity: 1,
				fillOpacity: 0.9,
			});

			// Add popup with point information
			marker.bindPopup(`
				<div class="route-popup">
					<strong>${routeType === 'original' ? 'Original' : 'Processed'} Point ${index + 1}</strong><br>
					Lat: ${coord[1].toFixed(6)}<br>
					Lon: ${coord[0].toFixed(6)}<br>
					Elevation: ${Math.round(coord[2] || 0)}m
				</div>
			`);

			markers.push(marker);
			
			// Debug: Log every 50th marker
			if (index % 50 === 0 || index === coordinates.length - 1) {
				console.log(`Added marker ${index + 1}/${coordinates.length}, array now has ${markers.length} markers`);
			}
		});

		console.log(`Created ${markers.length} markers for ${routeType} route`);
		// Note: Don't call updatePointsVisibility here as it's handled by the caller
	}

	/**
	 * Update visibility of track point markers based on zoom level
	 */
	updatePointsVisibility() {
		if (!this.map) return;

		const currentZoom = this.map.getZoom();
		const shouldShowPoints = currentZoom >= 16;
		
		const timestamp = new Date().toLocaleTimeString();
		console.log(`[${timestamp}] Current zoom: ${currentZoom}, Should show points: ${shouldShowPoints}, Points visible: ${this.pointsVisible}`);
		console.log(`[${timestamp}] Original markers: ${this.originalPointMarkers.length}, Processed markers: ${this.processedPointMarkers.length}`);

		if (shouldShowPoints) {
			if (!this.pointsVisible) {
				console.log('Showing track points');
				this.pointsVisible = true;
			}
			
			// Always ensure all available markers are visible when points should be shown
			this.originalPointMarkers.forEach(marker => {
				if (!this.map.hasLayer(marker)) {
					marker.addTo(this.map);
				}
			});
			this.processedPointMarkers.forEach(marker => {
				if (!this.map.hasLayer(marker)) {
					marker.addTo(this.map);
				}
			});
			
		} else if (this.pointsVisible) {
			// Hide points
			console.log('Hiding track points');
			this.originalPointMarkers.forEach(marker => {
				if (this.map.hasLayer(marker)) {
					this.map.removeLayer(marker);
				}
			});
			this.processedPointMarkers.forEach(marker => {
				if (this.map.hasLayer(marker)) {
					this.map.removeLayer(marker);
				}
			});
			this.pointsVisible = false;
		}
	}

	/**
	 * Clear original track point markers
	 */
	clearOriginalTrackPoints() {
		console.log(`Clearing ${this.originalPointMarkers.length} original markers`);
		this.originalPointMarkers.forEach(marker => {
			if (this.map.hasLayer(marker)) {
				this.map.removeLayer(marker);
			}
		});
		this.originalPointMarkers = [];
		console.log(`Original markers array cleared, length: ${this.originalPointMarkers.length}`);
	}

	/**
	 * Clear processed track point markers
	 */
	clearProcessedTrackPoints() {
		console.log(`Clearing ${this.processedPointMarkers.length} processed markers`);
		this.processedPointMarkers.forEach(marker => {
			if (this.map.hasLayer(marker)) {
				this.map.removeLayer(marker);
			}
		});
		this.processedPointMarkers = [];
		console.log(`Processed markers array cleared, length: ${this.processedPointMarkers.length}`);
	}

	/**
	 * Clear all track point markers
	 */
	clearTrackPoints() {
		this.clearOriginalTrackPoints();
		this.clearProcessedTrackPoints();
		this.pointsVisible = false;
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

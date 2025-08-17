/**
 * Elevation profile chart using Chart.js
 */

// Register the zoom plugin
if (typeof ChartZoom !== 'undefined') {
	Chart.register(ChartZoom);
}

// Custom crosshair plugin
const crosshairPlugin = {
	id: 'crosshair',
	afterDatasetsDraw(chart) {
		if (chart.crosshair) {
			const ctx = chart.ctx;
			const { top, bottom } = chart.chartArea;
			
			ctx.save();
			ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);
			
			ctx.beginPath();
			ctx.moveTo(chart.crosshair.x, top);
			ctx.lineTo(chart.crosshair.x, bottom);
			ctx.stroke();
			
			ctx.restore();
		}
	}
};

Chart.register(crosshairPlugin);

class ElevationChart {
	constructor(containerId) {
		this.containerId = containerId;
		this.chart = null;
	}

	/**
	 * Create elevation profile chart from GeoJSON
	 * @param {Object} geoJson - GeoJSON object
	 */
	createChart(geoJson) {
		// Extract elevation data from GeoJSON
		const elevationData = this.extractElevationData(geoJson);
		const ctx = document.createElement("canvas");
		const container = document.getElementById(this.containerId);
		container.innerHTML = "";
		container.appendChild(ctx);

		// Calculate elevation range for fixed y-axis
		const elevations = elevationData.elevations;
		const minElevation = Math.min(...elevations);
		const maxElevation = Math.max(...elevations);
		// Round to next multiple of 100m (handles negative elevations correctly)
		const yMin = Math.floor(minElevation / 100) * 100;
		const yMax = Math.ceil(maxElevation / 100) * 100;

		// Calculate distance range for x-axis
		const distances = elevationData.distances;
		const maxDistance = distances[distances.length - 1] / 1000; // Convert to km

		this.chart = new Chart(ctx, {
			type: "line",
			data: {
				datasets: [
					{
						label: "Elevation",
						data: elevationData.elevations.map((elevation, index) => ({
							x: elevationData.distances ? elevationData.distances[index] / 1000 : index,
							y: elevation
						})),
						borderColor: "#3498db",
						backgroundColor: "rgba(52, 152, 219, 0.1)",
						fill: true,
						tension: 0.1,
						pointRadius: 0,
						pointHoverRadius: 4,
						borderWidth: 2,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: null,
				},
				hover: {
					mode: null,
				},
				onHover: (event, activeElements, chart) => {
					const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
					const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
					
					if (dataX !== null && canvasPosition.x >= chart.chartArea.left && canvasPosition.x <= chart.chartArea.right) {
						chart.crosshair = {
							x: canvasPosition.x
						};
						chart.draw();
					}
				},
				plugins: {
					legend: {
						display: false,
					},
					tooltip: {
						callbacks: {
							title: function (context) {
								const distance = context[0].parsed.x;
								return `Distance: ${distance.toFixed(2)}km`;
							},
							label: function (context) {
								return `Elevation: ${Math.round(context.parsed.y)}m`;
							},
						},
					},
					zoom: {
						limits: {
							x: {min: 0, max: maxDistance},
							y: {min: yMin, max: yMax},
						},
						pan: {
							enabled: true,
							mode: 'x',
						},
						zoom: {
							wheel: {
								enabled: true,
							},
							mode: 'x',
						}
					},
				},
				scales: {
					x: {
						type: 'linear',
						display: true,
						title: {
							display: true,
							text: "Distance (km)",
						},
						grid: {
							color: "rgba(0, 0, 0, 0.1)",
						},
						min: 0,
						max: maxDistance,
					},
					y: {
						display: true,
						title: {
							display: true,
							text: "Elevation (m)",
						},
						grid: {
							color: "rgba(0, 0, 0, 0.1)",
						},
						min: yMin,
						max: yMax,
					},
				},
				elements: {
					point: {
						radius: 0,
					},
				},
			},
		});

		// Add mouse leave event to hide crosshair
		ctx.addEventListener('mouseleave', () => {
			this.chart.crosshair = null;
			this.chart.draw();
		});
	}

	/**
	 * Update chart with new GeoJSON data
	 * @param {Object} geoJson - GeoJSON object
	 */
	updateChart(geoJson) {
		if (this.chart) {
			const elevationData = this.extractElevationData(geoJson);
			this.chart.data.datasets[0].data = elevationData.elevations.map((elevation, index) => ({
				x: elevationData.distances ? elevationData.distances[index] / 1000 : index,
				y: elevation
			}));
			this.chart.update();
		} else {
			this.createChart(geoJson);
		}
	}

	/**
	 * Extract elevation data from GeoJSON using Turf.js
	 * @param {Object} geoJson - GeoJSON object
	 * @returns {Object} Elevation chart data
	 */
	extractElevationData(geoJson) {
		// Find the first LineString feature (track)
		const trackFeature = geoJson.features.find(
			(feature) => feature.geometry && feature.geometry.type === "LineString",
		);

		if (!trackFeature) {
			throw new Error("No track LineString found in GeoJSON");
		}

		const coordinates = trackFeature.geometry.coordinates;
		const elevations = [];
		const distances = [];
		let cumulativeDistance = 0;

		for (let i = 0; i < coordinates.length; i++) {
			const [lon, lat, elevation] = coordinates[i];

			// Calculate distance from previous point using Turf.js
			if (i > 0) {
				const prevCoord = coordinates[i - 1];
				const from = turf.point([prevCoord[0], prevCoord[1]]);
				const to = turf.point([lon, lat]);
				const distance = turf.distance(from, to, { units: 'meters' });
				cumulativeDistance += distance;
			}

			elevations.push(elevation || 0);
			distances.push(cumulativeDistance);
		}

		return {
			elevations,
			distances,
		};
	}

	/**
	 * Reset zoom to show full chart
	 */
	resetZoom() {
		if (this.chart) {
			this.chart.resetZoom();
		}
	}

	/**
	 * Destroy the chart
	 */
	destroy() {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
	}
}

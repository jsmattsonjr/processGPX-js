/**
 * Elevation profile chart using Chart.js
 */

// Register the zoom plugin
if (typeof ChartZoom !== "undefined") {
	Chart.register(ChartZoom);
}

// Custom crosshair plugin
const crosshairPlugin = {
	id: "crosshair",
	afterDatasetsDraw(chart) {
		if (chart.crosshair) {
			const ctx = chart.ctx;
			const { top, bottom } = chart.chartArea;

			ctx.save();
			ctx.strokeStyle = "rgba(255, 107, 107, 0.8)";
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);

			ctx.beginPath();
			ctx.moveTo(chart.crosshair.x, top);
			ctx.lineTo(chart.crosshair.x, bottom);
			ctx.stroke();

			ctx.restore();
		}
	},
};

Chart.register(crosshairPlugin);

export class ElevationChart {
	constructor(containerId) {
		this.containerId = containerId;
		this.chart = null;
	}

	/**
	 * Create elevation profile chart from LineString feature
	 * @param {Object} trackFeature - LineString feature object
	 */
	createChart(trackFeature) {
		// Extract elevation data from track feature
		const elevationData = this.extractElevationData(trackFeature);
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
						label: "Original Elevation",
						data: elevationData.elevations.map((elevation, index) => ({
							x: elevationData.distances
								? elevationData.distances[index] / 1000
								: index,
							y: elevation,
						})),
						borderColor: "#3498db",
						backgroundColor: "rgba(52, 152, 219, 0.3)",
						fill: "origin",
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
				onHover: (event, _activeElements, chart) => {
					const canvasPosition = Chart.helpers.getRelativePosition(
						event,
						chart,
					);
					const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);

					if (
						dataX !== null &&
						canvasPosition.x >= chart.chartArea.left &&
						canvasPosition.x <= chart.chartArea.right
					) {
						chart.crosshair = {
							x: canvasPosition.x,
						};
						chart.draw();
					}
				},
				plugins: {
					legend: {
						display: true,
						position: "top",
					},
					tooltip: {
						callbacks: {
							title: (context) => {
								const distance = context[0].parsed.x;
								return `Distance: ${distance.toFixed(2)}km`;
							},
							label: (context) => `Elevation: ${Math.round(context.parsed.y)}m`,
						},
					},
					zoom: {
						limits: {
							x: { min: 0, max: maxDistance },
							y: { min: yMin, max: yMax },
						},
						pan: {
							enabled: true,
							mode: "x",
						},
						zoom: {
							wheel: {
								enabled: true,
							},
							mode: "x",
						},
					},
				},
				scales: {
					x: {
						type: "linear",
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
		ctx.addEventListener("mouseleave", () => {
			this.chart.crosshair = null;
			this.chart.draw();
		});
	}

	/**
	 * Update chart with new track feature data
	 * @param {Object} trackFeature - LineString feature object
	 */
	updateChart(trackFeature) {
		if (this.chart) {
			const elevationData = this.extractElevationData(trackFeature);
			this.chart.data.datasets[0].data = elevationData.elevations.map(
				(elevation, index) => ({
					x: elevationData.distances
						? elevationData.distances[index] / 1000
						: index,
					y: elevation,
				}),
			);
			this.chart.update();
		} else {
			this.createChart(trackFeature);
		}
	}

	/**
	 * Extract elevation data from LineString feature using Turf.js
	 * @param {Object} trackFeature - LineString feature object
	 * @returns {Object} Elevation chart data
	 */
	extractElevationData(trackFeature) {
		// Validate that we have a LineString feature
		if (
			!trackFeature ||
			!trackFeature.geometry ||
			trackFeature.geometry.type !== "LineString"
		) {
			throw new Error("Invalid track feature provided");
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
				const distance = turf.distance(from, to, { units: "meters" });
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
	 * Add processed route data to existing chart
	 * @param {Object} processedTrackFeature - Processed LineString feature object
	 */
	addProcessedData(processedTrackFeature) {
		if (!this.chart) {
			throw new Error("Chart not initialized");
		}

		// Extract elevation data from processed track feature
		const processedElevationData = this.extractElevationData(
			processedTrackFeature,
		);

		// Get original data
		const originalData = this.chart.data.datasets[0].data;

		// Create datasets for the differential fill effect
		const processedData = processedElevationData.elevations.map(
			(elevation, index) => ({
				x: processedElevationData.distances
					? processedElevationData.distances[index] / 1000
					: index,
				y: elevation,
			}),
		);

		// Calculate the maximum distance from both original and processed data
		const originalMaxDistance = Math.max(...originalData.map(point => point.x));
		const processedMaxDistance = Math.max(...processedData.map(point => point.x));
		const maxDistance = Math.max(originalMaxDistance, processedMaxDistance);

		// Update chart limits to accommodate the longer track
		this.chart.options.plugins.zoom.limits.x.max = maxDistance;
		this.chart.options.scales.x.max = maxDistance;

		// Clear existing datasets and rebuild
		this.chart.data.datasets = [];

		// 1. Processed elevation with full fill (background layer)
		this.chart.data.datasets.push({
			label: "Processed Elevation",
			data: processedData,
			borderColor: "#e74c3c",
			backgroundColor: "rgba(231, 76, 60, 0.3)",
			fill: "origin",
			tension: 0.1,
			pointRadius: 0,
			pointHoverRadius: 4,
			borderWidth: 2,
			order: 1,
		});

		// 2. Original elevation with full fill (will overlay processed where higher)
		this.chart.data.datasets.push({
			label: "Original Elevation",
			data: originalData,
			borderColor: "#3498db",
			backgroundColor: "rgba(52, 152, 219, 0.3)",
			fill: "origin",
			tension: 0.1,
			pointRadius: 0,
			pointHoverRadius: 4,
			borderWidth: 2,
			order: 2,
		});

		this.chart.update();
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

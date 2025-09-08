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
			ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
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
	constructor(containerId, mapVisualization = null) {
		this.containerId = containerId;
		this.chart = null;
		this.mapVisualization = mapVisualization;
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
						pointRadius: (ctx) => {
							return this.shouldShowPoints() ? 3 : 0;
						},
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

						// Update map crosshairs if mapVisualization is available
						if (this.mapVisualization) {
							this.mapVisualization.updateCrosshairs(dataX);
						}
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
							onPan: () => {
								// Update point visibility after pan with multiple delayed attempts
								setTimeout(() => {
									this.updatePointVisibility();
								}, 50);
								setTimeout(() => {
									this.updatePointVisibility();
								}, 150);
								setTimeout(() => {
									this.updatePointVisibility();
								}, 300);
							},
						},
						zoom: {
							wheel: {
								enabled: true,
							},
							mode: "x",
							onZoom: () => {
								// Update point visibility after zoom with multiple delayed attempts
								setTimeout(() => {
									this.updatePointVisibility();
								}, 50);
								setTimeout(() => {
									this.updatePointVisibility();
								}, 150);
								setTimeout(() => {
									this.updatePointVisibility();
								}, 300);
							},
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

			// Clear map crosshairs when leaving chart
			if (this.mapVisualization) {
				this.mapVisualization.clearCrosshairs();
			}
		});

		// Add mouse wheel event to detect zoom changes
		ctx.addEventListener("wheel", () => {
			setTimeout(() => {
				this.updatePointVisibility();
			}, 100);
			setTimeout(() => {
				this.updatePointVisibility();
			}, 300);
			setTimeout(() => {
				this.updatePointVisibility();
			}, 600);
		});

		// Add mouse move event to detect pan operations
		let isMouseDown = false;
		ctx.addEventListener("mousedown", () => {
			isMouseDown = true;
		});
		
		ctx.addEventListener("mouseup", () => {
			if (isMouseDown) {
				setTimeout(() => {
					this.updatePointVisibility();
				}, 100);
				setTimeout(() => {
					this.updatePointVisibility();
				}, 300);
			}
			isMouseDown = false;
		});

		ctx.addEventListener("mousemove", () => {
			if (isMouseDown) {
				// Debounced update during pan
				clearTimeout(this.panTimeout);
				this.panTimeout = setTimeout(() => {
					this.updatePointVisibility();
				}, 200);
			}
		});

		// Initialize point visibility
		this.updatePointVisibility();

		// Add window resize listener to update point visibility when viewport changes
		window.addEventListener('resize', () => {
			setTimeout(() => {
				this.updatePointVisibility();
			}, 100);
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
		const originalMaxDistance = Math.max(
			...originalData.map((point) => point.x),
		);
		const processedMaxDistance = Math.max(
			...processedData.map((point) => point.x),
		);
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
			pointRadius: (ctx) => {
				return this.shouldShowPoints() ? 3 : 0;
			},
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
			pointRadius: (ctx) => {
				return this.shouldShowPoints() ? 3 : 0;
			},
			pointHoverRadius: 4,
			borderWidth: 2,
			order: 2,
		});

		this.chart.update();
	}

	/**
	 * Determine if individual track points should be shown based on zoom scale
	 * @returns {boolean} True if points should be visible
	 */
	shouldShowPoints() {
		if (!this.chart || !this.chart.scales || !this.chart.scales.x || !this.chart.chartArea) {
			console.log('Chart not ready for point visibility check');
			return false;
		}

		// Get the current x-axis scale
		const xScale = this.chart.scales.x;
		const chartArea = this.chart.chartArea;
		const chartWidth = chartArea.right - chartArea.left;
		const dataRange = xScale.max - xScale.min; // km
		
		// Calculate meters per pixel
		const metersPerPixel = (dataRange * 1000) / chartWidth;
		
		// Show points when scale is roughly 50cm (0.5m) per pixel or less
		const shouldShow = metersPerPixel <= 0.5;
		console.log(`Chart dimensions: left=${chartArea.left}, right=${chartArea.right}, width=${chartWidth}`);
		console.log(`Chart: dataRange=${dataRange}km, chartWidth=${chartWidth}px, metersPerPixel=${metersPerPixel}, shouldShow=${shouldShow}`);
		
		return shouldShow;
	}

	/**
	 * Update point visibility on all datasets
	 */
	updatePointVisibility() {
		if (!this.chart) return;

		// Force chart to resize and render before checking dimensions
		this.chart.resize();
		this.chart.render();
		
		// The point radius callbacks will automatically be called during update
		console.log(`Forcing chart update for point visibility`);
		this.chart.update('none'); // Update without animation for better performance
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

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
	 * Create elevation profile chart
	 * @param {Object} elevationData - Chart data with labels, elevations, distances
	 */
	createChart(elevationData) {
		const ctx = document.createElement("canvas");
		const container = document.getElementById(this.containerId);
		container.innerHTML = "";
		container.appendChild(ctx);

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
							x: {min: 'original', max: 'original'},
							y: {min: 'original', max: 'original'},
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
						beginAtZero: false,
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
	 * Update chart with new data
	 * @param {Object} elevationData
	 */
	updateChart(elevationData) {
		if (this.chart) {
			this.chart.data.datasets[0].data = elevationData.elevations.map((elevation, index) => ({
				x: elevationData.distances ? elevationData.distances[index] / 1000 : index,
				y: elevation
			}));
			this.chart.update();
		} else {
			this.createChart(elevationData);
		}
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

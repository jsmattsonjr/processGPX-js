/**
 * Elevation profile chart using Chart.js
 */
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
        const ctx = document.createElement('canvas');
        const container = document.getElementById(this.containerId);
        container.innerHTML = '';
        container.appendChild(ctx);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: elevationData.labels,
                datasets: [{
                    label: 'Elevation',
                    data: elevationData.elevations,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const index = context[0].dataIndex;
                                return `Distance: ${elevationData.labels[index]}`;
                            },
                            label: function(context) {
                                return `Elevation: ${Math.round(context.parsed.y)}m`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Distance'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Elevation (m)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        beginAtZero: false
                    }
                },
                elements: {
                    point: {
                        radius: 0
                    }
                }
            }
        });
    }

    /**
     * Update chart with new data
     * @param {Object} elevationData 
     */
    updateChart(elevationData) {
        if (this.chart) {
            this.chart.data.labels = elevationData.labels;
            this.chart.data.datasets[0].data = elevationData.elevations;
            this.chart.update();
        } else {
            this.createChart(elevationData);
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
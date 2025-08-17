/**
 * Main application controller for processGPX
 */
class ProcessGPXApp {
	constructor() {
		this.gpxParser = new GPXParser();
		this.mapVisualization = null;
		this.elevationChart = null;
		this.currentRoute = null;

		this.initializeEventListeners();
	}

	/**
	 * Initialize event listeners
	 */
	initializeEventListeners() {
		// File upload
		const fileInput = document.getElementById("gpxFile");
		fileInput.addEventListener("change", (e) => this.handleFileUpload(e));

		// Error back button
		const errorBackBtn = document.getElementById("errorBackBtn");
		errorBackBtn.addEventListener("click", () => this.showUploadScreen());
	}

	/**
	 * Handle GPX file upload
	 * @param {Event} event
	 */
	async handleFileUpload(event) {
		const file = event.target.files[0];
		if (!file) return;

		try {
			this.showLoading("Parsing GPX file...");

			// Parse GPX file to GeoJSON
			const geoJson = await this.gpxParser.parseFile(file);
			this.currentRoute = geoJson;

			this.updateLoadingMessage("Setting up visualization...");

			// Show results screen
			this.showResultsScreen();

			// Initialize map and chart
			await this.initializeVisualization(geoJson);

			this.hideLoading();
		} catch (error) {
			console.error("Error processing GPX file:", error);
			this.showError(error.message);
		}
	}

	/**
	 * Initialize map and elevation chart
	 * @param {Object} geoJson - GeoJSON object
	 */
	async initializeVisualization(geoJson) {
		// Initialize map
		this.mapVisualization = new MapVisualization("map");
		this.mapVisualization.initializeMap();
		this.mapVisualization.displayRoute(geoJson);

		// Initialize elevation chart
		this.elevationChart = new ElevationChart("elevationProfile");
		this.elevationChart.createChart(geoJson);
	}

	/**
	 * Show upload screen
	 */
	showUploadScreen() {
		document.getElementById("uploadScreen").classList.remove("hidden");
		document.getElementById("resultsScreen").classList.add("hidden");
		document.getElementById("loading").classList.add("hidden");
		document.getElementById("error").classList.add("hidden");

		// Clear file input
		document.getElementById("gpxFile").value = "";

		// Clean up visualizations
		if (this.mapVisualization) {
			this.mapVisualization.destroy();
			this.mapVisualization = null;
		}
		if (this.elevationChart) {
			this.elevationChart.destroy();
			this.elevationChart = null;
		}
	}

	/**
	 * Show results screen with map and elevation chart
	 */
	showResultsScreen() {
		document.getElementById("uploadScreen").classList.add("hidden");
		document.getElementById("resultsScreen").classList.remove("hidden");
		document.getElementById("loading").classList.add("hidden");
		document.getElementById("error").classList.add("hidden");
	}

	/**
	 * Show loading overlay
	 * @param {string} message
	 */
	showLoading(message = "Processing...") {
		document.getElementById("loadingMessage").textContent = message;
		document.getElementById("loading").classList.remove("hidden");
	}

	/**
	 * Update loading message
	 * @param {string} message
	 */
	updateLoadingMessage(message) {
		document.getElementById("loadingMessage").textContent = message;
	}

	/**
	 * Hide loading overlay
	 */
	hideLoading() {
		document.getElementById("loading").classList.add("hidden");
	}

	/**
	 * Show error overlay
	 * @param {string} message
	 */
	showError(message) {
		document.getElementById("errorMessage").textContent = message;
		document.getElementById("error").classList.remove("hidden");
		document.getElementById("loading").classList.add("hidden");
	}
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	new ProcessGPXApp();
});

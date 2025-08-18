/**
 * Main application controller for processGPX
 */
class ProcessGPXApp {
	constructor() {
		this.gpxParser = new GPXParser();
		this.mapVisualization = null;
		this.elevationChart = null;
		this.currentRoute = null;
		this.processedRoute = null;

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

		// ProcessGPX button
		const processGpxBtn = document.getElementById("processGpxBtn");
		processGpxBtn.addEventListener("click", () => this.handleProcessGPX());

		// Export GPX button
		const exportGpxBtn = document.getElementById("exportGpxBtn");
		exportGpxBtn.addEventListener("click", () => this.handleExportGPX());
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

			// Parse GPX file to get first LineString feature
			const trackFeature = await this.gpxParser.parseFile(file);
			this.currentRoute = trackFeature;

			this.updateLoadingMessage("Setting up visualization...");

			// Show results screen
			this.showResultsScreen();

			// Update track name in sidebar
			this.updateTrackName(trackFeature);

			// Initialize map and chart
			await this.initializeVisualization(trackFeature);

			this.hideLoading();
		} catch (error) {
			console.error("Error processing GPX file:", error);
			this.showError(error.message);
		}
	}

	/**
	 * Initialize map and elevation chart
	 * @param {Object} trackFeature - LineString feature object
	 */
	async initializeVisualization(trackFeature) {
		// Initialize map
		this.mapVisualization = new MapVisualization("map");
		this.mapVisualization.initializeMap();
		this.mapVisualization.displayRoute(trackFeature);

		// Initialize elevation chart
		this.elevationChart = new ElevationChart("elevationProfile");
		this.elevationChart.createChart(trackFeature);
	}

	/**
	 * Handle processGPX button click
	 */
	async handleProcessGPX() {
		if (!this.currentRoute) {
			console.error("No route loaded");
			return;
		}

		try {
			this.showLoading("Processing GPX route...");

			// Process the current route
			const processedRoute = processGPX(this.currentRoute);
			this.processedRoute = processedRoute;

			// Update visualizations to show both original and processed routes
			this.mapVisualization.displayProcessedRoute(processedRoute);
			this.elevationChart.addProcessedData(processedRoute);

			// Enable export button
			this.enableExportButton();

			this.hideLoading();
		} catch (error) {
			console.error("Error processing GPX route:", error);
			this.showError(error.message);
		}
	}

	/**
	 * Handle export processed GPX button click
	 */
	handleExportGPX() {
		if (!this.processedRoute) {
			console.error("No processed route available");
			return;
		}

		// Get the original track name and create processed filename
		const originalName = this.currentRoute?.properties?.name || "route";
		const processedFilename = `${originalName}_processed`;

		// Download the processed route
		downloadTrackAsGPX(this.processedRoute, processedFilename);
	}

	/**
	 * Enable the export button
	 */
	enableExportButton() {
		const exportBtn = document.getElementById("exportGpxBtn");
		exportBtn.disabled = false;
		exportBtn.classList.remove("disabled");
	}

	/**
	 * Disable the export button
	 */
	disableExportButton() {
		const exportBtn = document.getElementById("exportGpxBtn");
		exportBtn.disabled = true;
		exportBtn.classList.add("disabled");
	}

	/**
	 * Update track name display in sidebar
	 * @param {Object} trackFeature - LineString feature object
	 */
	updateTrackName(trackFeature) {
		const trackNameElement = document.getElementById("trackName");
		const trackName = trackFeature.properties?.name || "Unnamed Route";
		trackNameElement.textContent = trackName;
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

		// Reset route data and disable export button
		this.currentRoute = null;
		this.processedRoute = null;
		this.disableExportButton();

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

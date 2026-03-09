import { ElevationChart } from "./elevation-chart.js";
import { downloadTrackAsGPX } from "./gpx-export.js";
import { GPXParser } from "./gpx-parser.js";
import { MapVisualization } from "./map-visualization.js";
import { defaultOptions } from "./options.js";
import { processGPX } from "./process-gpx.js";

class ProcessGPXApp {
	constructor() {
		this.gpxParser = new GPXParser();
		this.mapVisualization = null;
		this.elevationChart = null;
		this.currentFile = null;
		this.currentRoute = null;
		this.processedRoute = null;
		this.currentOptions = { ...defaultOptions };

		this.cacheDom();
		this.initializeEventListeners();
		this.initializeOptionsUI();
	}

	cacheDom() {
		this.ui = {
			uploadScreen: document.getElementById("uploadScreen"),
			resultsScreen: document.getElementById("resultsScreen"),
			loading: document.getElementById("loading"),
			error: document.getElementById("error"),
			loadingMessage: document.getElementById("loadingMessage"),
			errorMessage: document.getElementById("errorMessage"),
			gpxFile: document.getElementById("gpxFile"),
			dropZone: document.getElementById("dropZone"),
			replaceFileBtn: document.getElementById("replaceFileBtn"),
			loadAnotherFileBtn: document.getElementById("loadAnotherFileBtn"),
			selectedFileInfo: document.getElementById("selectedFileInfo"),
			selectedFileName: document.getElementById("selectedFileName"),
			errorBackBtn: document.getElementById("errorBackBtn"),
			processGpxBtn: document.getElementById("processGpxBtn"),
			exportGpxBtn: document.getElementById("exportGpxBtn"),
			trackName: document.getElementById("trackName"),
			trackDistance: document.getElementById("trackDistance"),
			trackElevation: document.getElementById("trackElevation"),
			trackPoints: document.getElementById("trackPoints"),
			trackIsLoop: document.getElementById("trackIsLoop"),
			trackSegments: document.getElementById("trackSegments"),
			trackClimbs: document.getElementById("trackClimbs"),
		};
	}

	initializeEventListeners() {
		this.ui.gpxFile?.addEventListener("change", (event) => {
			const file = event.target.files?.[0];
			if (file) this.handleSelectedFile(file);
		});

		this.ui.errorBackBtn?.addEventListener("click", () => this.showUploadScreen());
		this.ui.processGpxBtn?.addEventListener("click", () => this.handleProcessGPX());
		this.ui.exportGpxBtn?.addEventListener("click", () => this.handleExportGPX());
		this.ui.replaceFileBtn?.addEventListener("click", () => this.ui.gpxFile?.click());
		this.ui.loadAnotherFileBtn?.addEventListener("click", () => this.showUploadScreen());

		this.initializeDragAndDrop();
	}

	initializeDragAndDrop() {
		const { dropZone } = this.ui;
		if (!dropZone) return;

		const preventDefaults = (event) => {
			event.preventDefault();
			event.stopPropagation();
		};

		["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
			dropZone.addEventListener(eventName, preventDefaults);
		});

		dropZone.addEventListener("dragenter", () => dropZone.classList.add("dragover"));
		dropZone.addEventListener("dragover", () => dropZone.classList.add("dragover"));
		dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
		dropZone.addEventListener("drop", (event) => {
			dropZone.classList.remove("dragover");
			const file = event.dataTransfer?.files?.[0];
			if (file) this.handleSelectedFile(file);
		});
	}

	initializeOptionsUI() {
		this.setCheckbox("flattenExtensionsOption", false);
		this.setCheckbox("addPointExtensionsOption", false);
		this.setCheckbox("simplifyProfileOption", defaultOptions.simplify === 1);
		this.setCheckbox("autoSegmentsOption", defaultOptions.auto === 1);
		this.setCheckbox("gradientSignsOption", defaultOptions.addGradientSigns === 1);
		this.setCheckbox("includeSegmentExtensionsOption", true);
		this.setCheckbox("includePointExtensionsOption", true);
		this.setCheckbox("debugLogsOption", !defaultOptions.quiet);
		this.setCheckbox("showWaypointsOption", false);
		this.setCheckbox("showSegmentsOption", false);
		this.setCheckbox("straightOption", false);
		this.setCheckbox("circleOption", false);
		this.setCheckbox("circuitFromPositionOption", false);
		this.setCheckbox("splitRouteOption", false);
		this.setNumber("gradientPowerInput", defaultOptions.gradientPower ?? 2);
		this.setNumber("thresholdInput", defaultOptions.gradientThreshold ?? 100);
		this.setNumber("marginInput", defaultOptions.autoSegmentMargin ?? 400);
		this.setNumber("stretchInput", defaultOptions.autoSegmentStretch ?? 0.05);
		this.setNumber("startMarginInput", defaultOptions.autoSegmentStartMargin ?? 0);
		this.setNumber("finishMarginInput", defaultOptions.autoSegmentFinishMargin ?? 0);
		this.setNumber("straightStartInput", "");
		this.setNumber("straightEndInput", "");
		this.setNumber("circleStartInput", "");
		this.setNumber("circleEndInput", "");
		this.setNumber("circuitPositionInput", 0);
		this.setNumber("circuitRepeatsInput", 1);
		this.setNumber("circuitsInput", 1);
		this.setNumber("minSplitLengthInput", 10);
		this.setNumber("splitNumberInput", 0);
		this.setNumber("startZoneInput", 0);
		this.setNumber("finishZoneInput", 0);
	}

	setCheckbox(id, value) {
		const element = document.getElementById(id);
		if (element) element.checked = Boolean(value);
	}

	setNumber(id, value) {
		const element = document.getElementById(id);
		if (element && value !== undefined && value !== null) {
			element.value = value;
		}
	}

	cloneFeature(feature) {
		if (!feature) return feature;
		if (typeof structuredClone === "function") {
			return structuredClone(feature);
		}
		return JSON.parse(JSON.stringify(feature));
	}

	async handleSelectedFile(file) {
		if (!file) return;

		const lowerName = file.name.toLowerCase();
		if (!lowerName.endsWith(".gpx")) {
			this.showError("Please select a valid GPX file.");
			return;
		}

		try {
			this.currentFile = file;
			this.updateSelectedFileInfo(file);
			this.showLoading("Parsing GPX file...");

			const trackFeature = await this.gpxParser.parseFile(file);
			this.currentRoute = trackFeature;
			this.processedRoute = null;
			this.disableExportButton();
			this.updateLoadingMessage("Preparing map and elevation profile...");

			this.showResultsScreen();
			await this.initializeVisualization(trackFeature);
			this.updateTrackSummary(trackFeature);
			this.hideLoading();
		} catch (error) {
			console.error("Error loading GPX file:", error);
			this.showError(error?.message || "Unable to parse GPX file.");
		}
	}

	updateSelectedFileInfo(file) {
		if (this.ui.selectedFileName) {
			this.ui.selectedFileName.textContent = file?.name || "-";
		}
		this.ui.selectedFileInfo?.classList.remove("hidden");
	}

	async initializeVisualization(trackFeature) {
		if (this.mapVisualization) {
			this.mapVisualization.destroy();
			this.mapVisualization = null;
		}
		if (this.elevationChart) {
			this.elevationChart.destroy();
			this.elevationChart = null;
		}

		this.mapVisualization = new MapVisualization("map");
		this.mapVisualization.initializeMap();
		this.mapVisualization.displayRoute(trackFeature);

		this.elevationChart = new ElevationChart("elevationProfile", this.mapVisualization);
		this.elevationChart.createChart(trackFeature);
	}

	collectOptionsFromUI() {
		const options = { ...defaultOptions };

		options.simplify = this.isChecked("simplifyProfileOption") ? 1 : 0;
		options.auto = this.isChecked("autoSegmentsOption") ? 1 : 0;
		options.addGradientSigns = this.isChecked("gradientSignsOption") ? 1 : 0;
		options.gradientPower = this.readNumber("gradientPowerInput", options.gradientPower ?? 2);
		options.gradientThreshold = this.readNumber("thresholdInput", options.gradientThreshold ?? 100);
		options.autoSegmentMargin = this.readNumber("marginInput", options.autoSegmentMargin ?? 400);
		options.autoSegmentStretch = this.readNumber("stretchInput", options.autoSegmentStretch ?? 0.05);
		options.autoSegmentStartMargin = this.readNumber("startMarginInput", options.autoSegmentStartMargin ?? 0);
		options.autoSegmentFinishMargin = this.readNumber("finishMarginInput", options.autoSegmentFinishMargin ?? 0);
		options.quiet = this.isChecked("debugLogsOption") ? 0 : 1;

		// Extensions / export related toggles for downstream processing.
		options.flattenExtensions = this.isChecked("flattenExtensionsOption") ? 1 : 0;
		options.addPointExtensions = this.isChecked("addPointExtensionsOption") ? 1 : 0;
		options.includeSegmentExtensions = this.isChecked("includeSegmentExtensionsOption") ? 1 : 0;
		options.includePointExtensions = this.isChecked("includePointExtensionsOption") ? 1 : 0;
		options.showWaypoints = this.isChecked("showWaypointsOption") ? 1 : 0;
		options.showSegments = this.isChecked("showSegmentsOption") ? 1 : 0;

		if (this.isChecked("straightOption")) {
			const straightStart = this.readOptionalNumber("straightStartInput");
			const straightEnd = this.readOptionalNumber("straightEndInput");
			if (straightStart !== undefined) options.straightStart = [straightStart];
			if (straightEnd !== undefined) options.straightEnd = [straightEnd];
			if (straightStart !== undefined || straightEnd !== undefined) {
				options.straight = [
					...(straightStart !== undefined ? [straightStart] : []),
					...(straightEnd !== undefined ? [straightEnd] : []),
				];
			}
		}

		if (this.isChecked("circleOption")) {
			const circleStart = this.readOptionalNumber("circleStartInput");
			const circleEnd = this.readOptionalNumber("circleEndInput");
			if (circleStart !== undefined) options.circleStart = [circleStart];
			if (circleEnd !== undefined) options.circleEnd = [circleEnd];
			if (circleStart !== undefined || circleEnd !== undefined) {
				options.circle = [
					...(circleStart !== undefined ? [circleStart] : []),
					...(circleEnd !== undefined ? [circleEnd] : []),
				];
			}
		}

		if (this.isChecked("circuitFromPositionOption")) {
			const position = this.readNumber("circuitPositionInput", 0);
			const repeats = this.readNumber("circuitRepeatsInput", 1);
			const circuits = this.readNumber("circuitsInput", 1);
			options.circuitFromPosition = [position];
			options.repeat = repeats;
			options.startCircuits = circuits;
		}

		if (this.isChecked("splitRouteOption")) {
			options.splitDistance = this.readNumberList("splitDistanceInput");
			options.startZone = this.readNumber("startZoneInput", 0);
			options.finishZone = this.readNumber("finishZoneInput", 0);
			options.minSplitLength = this.readNumber("minSplitLengthInput", 10);
			options.splitNumber = this.readNumber("splitNumberInput", 0);
		}

		this.currentOptions = options;
		return options;
	}

	isChecked(id) {
		return Boolean(document.getElementById(id)?.checked);
	}

	readNumber(id, fallback = 0) {
		const value = Number(document.getElementById(id)?.value);
		return Number.isFinite(value) ? value : fallback;
	}

	readOptionalNumber(id) {
		const rawValue = document.getElementById(id)?.value?.trim();
		if (!rawValue) return undefined;
		const value = Number(rawValue);
		return Number.isFinite(value) ? value : undefined;
	}

	readNumberList(id) {
		const raw = document.getElementById(id)?.value?.trim();
		if (!raw) return [];
		return raw
			.split(",")
			.map((value) => Number(value.trim()))
			.filter((value) => Number.isFinite(value));
	}

	async handleProcessGPX() {
		if (!this.currentRoute) {
			this.showError("Please load a GPX route first.");
			return;
		}

		try {
			this.showLoading("Processing GPX route...");
			const options = this.collectOptionsFromUI();

			await new Promise((resolve) => setTimeout(resolve, 10));
			const processedRoute = processGPX(this.cloneFeature(this.currentRoute), options);
			this.processedRoute = processedRoute;

			this.updateLoadingMessage("Updating map and elevation profile...");
			this.mapVisualization?.displayProcessedRoute(processedRoute);
			this.elevationChart?.addProcessedData(processedRoute);
			this.updateTrackSummary(processedRoute, true);
			this.enableExportButton();
			this.hideLoading();
		} catch (error) {
			console.error("Error processing GPX route:", error);
			this.showError(error?.message || "Failed to process GPX route.");
		}
	}

	handleExportGPX() {
		if (!this.processedRoute) {
			this.showError("No processed route is available for export.");
			return;
		}

		const baseName = (this.currentFile?.name || this.currentRoute?.properties?.name || "route")
			.replace(/\.gpx$/i, "")
			.replace(/\s+/g, "_");
		const outputName = `${baseName}_processed`;
		downloadTrackAsGPX(this.processedRoute, outputName, this.currentOptions);
	}

	updateTrackSummary(trackFeature, isProcessed = false) {
		const coords = trackFeature?.geometry?.coordinates || [];
		const stats = this.calculateRouteStats(coords);
		const trackName = trackFeature?.properties?.name || (isProcessed ? "Processed Route" : "Unnamed Route");

		if (this.ui.trackName) this.ui.trackName.textContent = trackName;
		if (this.ui.trackDistance) this.ui.trackDistance.textContent = `${stats.distanceKm.toFixed(2)} km`;
		if (this.ui.trackElevation) this.ui.trackElevation.textContent = `${Math.round(stats.elevationGainM)} m`;
		if (this.ui.trackPoints) this.ui.trackPoints.textContent = `${coords.length}`;
		if (this.ui.trackIsLoop) this.ui.trackIsLoop.textContent = stats.isLoop ? "Yes" : "No";
		if (this.ui.trackSegments) this.ui.trackSegments.textContent = this.inferSegmentCount(trackFeature);
		if (this.ui.trackClimbs) this.ui.trackClimbs.textContent = this.inferClimbCount(trackFeature);
		if (isProcessed) {
			this.ui.trackName.textContent = `${trackName}`;
		}
	}

	inferSegmentCount(trackFeature) {
		const segmentNames = trackFeature?.properties?.segmentName;
		if (segmentNames && typeof segmentNames === "object") {
			const trackEntries = Object.values(segmentNames);
			const nestedCount = trackEntries.reduce((count, entry) => {
				if (entry && typeof entry === "object") {
					return count + Object.keys(entry).length;
				}
				return count;
			}, 0);
			return `${nestedCount || Object.keys(segmentNames).length}`;
		}
		return "-";
	}

	inferClimbCount(trackFeature) {
		const waypoints =
			trackFeature?.properties?.waypoints ||
			trackFeature?.waypoints ||
			trackFeature?.properties?.gradientSigns;
		if (Array.isArray(waypoints)) {
			return `${waypoints.length}`;
		}
		return "-";
	}

	calculateRouteStats(coords) {
		if (!Array.isArray(coords) || coords.length === 0) {
			return { distanceKm: 0, elevationGainM: 0, isLoop: false };
		}

		let totalDistanceM = 0;
		let elevationGainM = 0;
		for (let i = 1; i < coords.length; i++) {
			totalDistanceM += this.haversineDistance(coords[i - 1], coords[i]);
			const prevEle = Number(coords[i - 1]?.[2]);
			const currEle = Number(coords[i]?.[2]);
			if (Number.isFinite(prevEle) && Number.isFinite(currEle) && currEle > prevEle) {
				elevationGainM += currEle - prevEle;
			}
		}

		const loopDistance = coords.length > 1 ? this.haversineDistance(coords[0], coords[coords.length - 1]) : Infinity;
		return {
			distanceKm: totalDistanceM / 1000,
			elevationGainM,
			isLoop: loopDistance <= 25,
		};
	}

	haversineDistance(a, b) {
		if (!a || !b) return 0;
		const toRad = (deg) => (deg * Math.PI) / 180;
		const lon1 = Number(a[0]);
		const lat1 = Number(a[1]);
		const lon2 = Number(b[0]);
		const lat2 = Number(b[1]);
		if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return 0;

		const R = 6371000;
		const dLat = toRad(lat2 - lat1);
		const dLon = toRad(lon2 - lon1);
		const phi1 = toRad(lat1);
		const phi2 = toRad(lat2);
		const h =
			Math.sin(dLat / 2) ** 2 +
			Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
		return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	}

	enableExportButton() {
		this.ui.exportGpxBtn.disabled = false;
		this.ui.exportGpxBtn.classList.remove("disabled");
	}

	disableExportButton() {
		this.ui.exportGpxBtn.disabled = true;
		this.ui.exportGpxBtn.classList.add("disabled");
	}

	showUploadScreen() {
		this.ui.uploadScreen.classList.remove("hidden");
		this.ui.resultsScreen.classList.add("hidden");
		this.ui.loading.classList.add("hidden");
		this.ui.error.classList.add("hidden");
		this.ui.gpxFile.value = "";
		this.currentFile = null;
		this.currentRoute = null;
		this.processedRoute = null;
		this.disableExportButton();
		this.resetTrackSummary();
		this.ui.selectedFileInfo?.classList.add("hidden");
		this.ui.selectedFileName.textContent = "-";

		if (this.mapVisualization) {
			this.mapVisualization.destroy();
			this.mapVisualization = null;
		}
		if (this.elevationChart) {
			this.elevationChart.destroy();
			this.elevationChart = null;
		}
	}

	resetTrackSummary() {
		if (this.ui.trackName) this.ui.trackName.textContent = "Unnamed Track";
		["trackDistance", "trackElevation", "trackPoints", "trackIsLoop", "trackSegments", "trackClimbs"].forEach((key) => {
			if (this.ui[key]) this.ui[key].textContent = "-";
		});
	}

	showResultsScreen() {
		this.ui.uploadScreen.classList.add("hidden");
		this.ui.resultsScreen.classList.remove("hidden");
		this.ui.loading.classList.add("hidden");
		this.ui.error.classList.add("hidden");
	}

	showLoading(message = "Processing...") {
		this.ui.loadingMessage.textContent = message;
		this.ui.loading.classList.remove("hidden");
	}

	updateLoadingMessage(message) {
		this.ui.loadingMessage.textContent = message;
	}

	hideLoading() {
		this.ui.loading.classList.add("hidden");
	}

	showError(message) {
		this.ui.errorMessage.textContent = message;
		this.ui.error.classList.remove("hidden");
		this.ui.loading.classList.add("hidden");
	}
}

document.addEventListener("DOMContentLoaded", () => {
	new ProcessGPXApp();
});

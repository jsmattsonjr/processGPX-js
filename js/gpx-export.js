/**
 * GPX export functionality using togpx with XML formatting
 */
import { formatXML } from "./xml-formatter.js";

/**
 * Convert a track feature to GPX XML format using togpx
 * @param {Object} trackFeature - LineString feature object
 * @returns {string} GPX XML string
 */
function trackFeatureToGPX(trackFeature) {
	// Create a FeatureCollection with the track feature
	const featureCollection = {
		type: "FeatureCollection",
		features: [trackFeature],
	};

	// Convert to GPX using togpx
	const gpxOutput = togpx(featureCollection, {
		creator: "processGPX-js",
		metadata: {
			name: trackFeature.properties?.name || "Processed Route",
			time: new Date(),
			author: {
				name: "processGPX-js",
			},
		},
	});

	// Format the XML with proper indentation and newlines
	return formatXML(gpxOutput);
}

/**
 * Download a track feature as a GPX file
 * @param {Object} trackFeature - LineString feature object
 * @param {string} filename - Filename for download (without extension)
 */
export function downloadTrackAsGPX(trackFeature, filename) {
	// Generate GPX content
	const gpxContent = trackFeatureToGPX(trackFeature);

	// Create blob and download
	const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
	const url = URL.createObjectURL(blob);

	// Create temporary download link
	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.gpx`;
	link.style.display = "none";

	// Trigger download
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Clean up object URL
	URL.revokeObjectURL(url);
}

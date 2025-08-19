/**
 * GPX export functionality
 */

/**
 * Convert a track feature to GPX XML format
 * @param {Object} trackFeature - LineString feature object
 * @returns {string} GPX XML string
 */
function trackFeatureToGPX(trackFeature) {
	const coordinates = trackFeature.geometry.coordinates;
	const trackName = trackFeature.properties?.name || "Processed Route";
	const timestamp = new Date().toISOString();

	// Generate track points XML
	const trackPoints = coordinates
		.map((coord) => {
			const [lon, lat, ele] = coord;
			const elevation =
				ele !== undefined ? `    <ele>${ele.toFixed(2)}</ele>\n` : "";
			return `  <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}">\n${elevation}  </trkpt>`;
		})
		.join("\n");

	// Generate complete GPX XML
	const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="processGPX-js" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(trackName)}</name>
    <time>${timestamp}</time>
    <author>
      <name>processGPX-js</name>
    </author>
  </metadata>
  <trk>
    <name>${escapeXml(trackName)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;

	return gpxXml;
}

/**
 * Escape XML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
	if (!text) return "";
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
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

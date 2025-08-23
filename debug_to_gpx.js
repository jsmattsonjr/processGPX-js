import fs from "node:fs";
import path from "node:path";

/**
 * Converts a debug point dump file to GPX format.
 *
 * @param {string} inputPath - The path to the debug dump file.
 */
function convertDebugToGPX(inputPath) {
	// Check if the input file exists
	if (!fs.existsSync(inputPath)) {
		console.error(`Error: Input file not found at ${inputPath}`);
		process.exit(1);
	}

	// Read the file content
	const fileContent = fs.readFileSync(inputPath, "utf8");
	const lines = fileContent.split("\n");

	const points = [];
	for (const line of lines) {
		// Skip header lines and empty lines
		if (line.startsWith("#") || line.trim() === "") {
			continue;
		}

		const parts = line.split("\t");
		if (parts.length >= 4) {
			const lat = parseFloat(parts[1]);
			const lon = parseFloat(parts[2]);
			const ele = parseFloat(parts[3]);

			if (!isNaN(lat) && !isNaN(lon)) {
				points.push({ lat, lon, ele: isNaN(ele) ? 0 : ele });
			}
		}
	}

	if (points.length === 0) {
		console.error("No valid points found in the input file.");
		return;
	}

	// Construct the GPX XML string
	const trackpoints = points
		.map(
			(p) =>
				`    <trkpt lat="${p.lat.toFixed(8)}" lon="${p.lon.toFixed(8)}"><ele>${p.ele.toFixed(2)}</ele></trkpt>`,
		)
		.join("\n");

	const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="debug_to_gpx.js" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <trk>
    <name>Converted Track from ${path.basename(inputPath)}</name>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>
`;

	// Determine output path
	const dir = path.dirname(inputPath);
	const baseName = path.basename(inputPath, path.extname(inputPath));
	const outputPath = path.join(dir, `${baseName}.gpx`);

	// Write the GPX file
	fs.writeFileSync(outputPath, gpxContent);
	console.log(`Successfully converted ${points.length} points.`);
	console.log(`GPX file saved to: ${outputPath}`);
}

// --- Main execution ---
const args = process.argv.slice(2);

if (args.length !== 1) {
	console.error("Usage: node debug_to_gpx.js <path_to_debug_file>");
	process.exit(1);
}

const inputFile = args[0];
convertDebugToGPX(inputFile);

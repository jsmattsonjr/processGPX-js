#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { gpx } from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import togpx from "togpx";
import { defaultOptions } from "./js/options.js";
import { processGPX } from "./js/process-gpx.js";

/**
 * Main function for the CLI tool
 */
async function main() {
	// Get filename from command line arguments
	const inputFile = process.argv[2];
	if (!inputFile) {
		console.error("Usage: node process-cli.js <input.gpx>");
		process.exit(1);
	}

	try {
		console.log(`Processing file: ${inputFile}`);

		// Read GPX file
		const gpxString = fs.readFileSync(inputFile, "utf-8");

		// Parse GPX to GeoJSON
		const gpxDoc = new DOMParser().parseFromString(gpxString, "text/xml");
		const geoJson = gpx(gpxDoc);

		if (!geoJson.features || geoJson.features.length === 0) {
			throw new Error("No tracks found in GPX file");
		}

		// Find the first LineString feature (track)
		const trackFeature = geoJson.features.find(
			(feature) => feature.geometry && feature.geometry.type === "LineString",
		);

		if (!trackFeature) {
			throw new Error("No track LineString found in GPX file");
		}

		// If track has no name, use filename without .gpx extension
		if (!trackFeature.properties || !trackFeature.properties.name) {
			const basename = path.basename(inputFile, ".gpx");
			if (!trackFeature.properties) {
				trackFeature.properties = {};
			}
			trackFeature.properties.name = basename;
		}

		// Get processing options
		const options = { ...defaultOptions };

		// Process the route
		console.log("Running processGPX pipeline...");
		const processedRoute = processGPX(trackFeature, options);
		console.log("Processing complete.");

		// Convert processed GeoJSON back to GPX
		const gpxOutput = togpx(processedRoute, {
			creator: "processGPX-js-cli",
			metadata: {
				name: processedRoute.properties?.name || "Processed Route",
				time: new Date(),
			},
		});

		// Generate output filename
		const dirname = path.dirname(inputFile);
		const ext = path.extname(inputFile);
		const base = path.basename(inputFile, ext);
		const outputFile = path.join(dirname, `${base}_jsprocessed.gpx`);

		// Write output GPX file
		fs.writeFileSync(outputFile, gpxOutput);
		console.log(`Successfully created ${outputFile}`);
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}
}

main();

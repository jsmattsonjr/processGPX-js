#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { gpx } from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import togpx from "togpx";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { processGPX } from "./js/process-gpx.js";

/**
 * Configure yargs parser matching processGPX Perl script options
 */
function setupYargsParser() {
	return yargs(hideBin(process.argv))
		.usage("Usage: $0 [options] <input.gpx>")
		.version("1.0.0")
		.alias("v", "version")
		.alias("h", "help")
		.options({
			// Basic boolean flags
			addCurvature: { type: "boolean", default: false },
			addDirection: { type: "boolean", default: false, alias: "addHeading" },
			addDistance: { type: "boolean", default: false },
			addGradient: { type: "boolean", default: false },
			addGradientSigns: { type: "boolean", default: false },
			addSigma: { type: "boolean", default: false },
			anchorSF: { type: "boolean", default: false },
			auto: { type: "boolean", default: false },
			autoLap: { type: "boolean", default: false, alias: ["autoLoop"] },
			autoSpacing: { type: "boolean", default: false },
			closed: { type: "boolean", default: false, alias: ["copyPoint"] },
			csv: { type: "boolean", default: false },
			enableAdvancedSmoothing: { type: "boolean", default: false },
			enableElevationFixes: { type: "boolean", default: false },
			fixCrossings: { type: "boolean", default: false },
			lap: { type: "boolean", default: false, alias: ["loop"] },
			loopLeft: { type: "boolean", default: false, alias: ["loopL"] },
			loopRight: { type: "boolean", default: false, alias: ["loopR"] },
			noSave: { type: "boolean", default: false },
			outAndBack: { type: "boolean", default: false },
			outAndBackLap: {
				type: "boolean",
				default: false,
				alias: ["outAndBackLoop"],
			},
			prune: { type: "boolean", default: false },
			quiet: { type: "boolean", default: false },
			reverse: { type: "boolean", default: false },
			saveSimplifiedCourse: { type: "boolean", default: false },
			stripSegments: { type: "boolean", default: false },

			// Numeric options
			append: { type: "number", default: 0 },
			arcFitDegs: { type: "number" },
			arcFitEnd: { type: "number" },
			arcFitMaxDegs: { type: "number", default: 60 },
			arcFitStart: { type: "number" },
			autoSegmentMargin: { type: "number", default: 400 },
			autoSegmentFinishMargin: { type: "number", default: 20 },
			autoSegmentStartMargin: { type: "number", default: 340 },
			autoSegmentPower: { type: "number", default: 0.5 },
			autoSegmentStretch: { type: "number", default: 0.05 },
			autoSmoothZ: { type: "number", default: 0 },
			autoSplits: { type: "number", default: 0 },
			autoStraightenLength: { type: "number" },
			autoStraightenDeviation: { type: "number" },
			cornerCrop: { type: "number", alias: ["cropCorners"] },
			cornerEffect: { type: "number", default: 1 },
			crop: { type: "number", alias: ["cropEnd", "cropMax", "cropStop"] },
			cropMin: { type: "number", alias: ["cropStart"] },
			crossingAngle: { type: "number" },
			crossingHeight: { type: "number", default: 2 },
			crossingTransition: { type: "number" },
			disableAdvancedSmoothing: { type: "number", default: 1 },
			disableElevationFixes: { type: "number", default: 1 },
			extend: { type: "number", default: 0 },
			extendBack: { type: "number" },
			finishCircuits: { type: "number", default: 0 },
			finishCircuitDistance: {
				type: "number",
				default: -1,
				alias: ["finishCircuitStart"],
			},
			gSmooth: { type: "number", default: 0, alias: ["gSigma"] },
			gradientPower: { type: "number", default: 2 },
			gradientThreshold: { type: "number", default: 100 },
			interpolate: { type: "number", alias: ["spacing"] },
			laneShift: { type: "number" },
			laneShiftEnd: { type: "number", alias: ["shiftEnd"] },
			laneShiftSF: { type: "number", alias: ["shiftSF"] },
			laneShiftStart: { type: "number", alias: ["shiftStart"] },
			laneShiftTransition: { type: "number", alias: ["shiftTransition"] },
			maxCornerCropDegs: { type: "number" },
			maxSlope: { type: "number", default: 30 },
			minCornerCropDegs: { type: "number" },
			minRadius: { type: "number" },
			minRadiusStart: { type: "number" },
			minRadiusEnd: { type: "number" },
			prepend: { type: "number", default: 0 },
			pruneD: { type: "number", default: 1, alias: ["pruneDistance"] },
			pruneX: { type: "number", default: 0.001, alias: ["pruneSine"] },
			prunedg: { type: "number", default: 0.0005, alias: ["pruneGradient"] },
			rCrossings: { type: "number", default: 6 },
			repeat: { type: "number", default: 0 },
			rLap: { type: "number" },
			rTurnaround: { type: "number" },
			rUTurn: { type: "number" },
			shiftZ: { type: "number", default: 0 },
			shiftZEnd: { type: "number" },
			shiftZStart: { type: "number" },
			sigma: { type: "number", alias: ["smooth"] },
			sigmag: { type: "number", alias: ["smoothG"] },
			sigmaz: { type: "number", alias: ["smoothZ", "zSigma", "zSmooth"] },
			smoothAngle: { type: "number" },
			smoothEnd: { type: "number" },
			smoothStart: { type: "number" },
			snap: { type: "number" },
			snapDistance: { type: "number", default: 2 },
			snapTransition: { type: "number" },
			snapAltitude: { type: "number", default: 1, alias: ["snapZ"] },
			spacing: { type: "number" },
			splineDegs: { type: "number" },
			splineEnd: { type: "number" },
			splineMaxDegs: { type: "number", default: 60 },
			splineStart: { type: "number" },
			splitNumber: { type: "number" },
			startCircuitDistance: {
				type: "number",
				default: -1,
				alias: ["startCircuitEnd"],
			},
			startCircuits: { type: "number", default: 0 },
			track: { type: "number", default: 0 },
			zOffset: { type: "number", default: 0 },
			zScaleRef: { type: "number", default: 0, alias: ["zScaleReference"] },
			zScale: { type: "number", default: 1 },

			// String options
			author: { type: "string" },
			autoSegmentNames: { type: "string", default: "" },
			copyright: { type: "string" },
			description: { type: "string" },
			keywords: { type: "string" },
			name: { type: "string", alias: ["title"] },
			out: { type: "string" },
			segment: { type: "string", alias: ["segments"] },
			startTime: { type: "string" },

			// Array options
			autoSegments: { type: "array", default: [] },
			autoStraighten: { type: "array", default: [] },
			circleStart: { type: "array", default: [] },
			circleEnd: { type: "array", default: [], alias: ["circleStop"] },
			circle: { type: "array", default: [] },
			circuitFromPosition: {
				type: "array",
				default: [],
				alias: [
					"circuitsFromPosition",
					"circuitFromPoint",
					"circuitsFromPoint",
				],
			},
			circuitToPosition: {
				type: "array",
				default: [],
				alias: ["circuitsToPosition", "circuitToPoint", "circuitsToPoint"],
			},
			deleteRange: { type: "array", default: [] },
			flatten: { type: "array", default: [] },
			join: { type: "array", default: [] },
			selectiveLaneShift: { type: "array", default: [] },
			selectiveGSmooth: {
				type: "array",
				default: [],
				alias: ["selectiveSmoothG"],
			},
			selectiveSmooth: { type: "array", default: [] },
			selectiveSmoothZ: {
				type: "array",
				default: [],
				alias: ["selectiveZSmooth"],
			},
			splitAt: { type: "array", default: [] },
			straight: { type: "array", default: [] },
			straightStart: { type: "array", default: [] },
			straightEnd: { type: "array", default: [], alias: ["straightStop"] },
		})
		.example("$0 --auto input.gpx", "Process with auto defaults")
		.example(
			"$0 --spacing 5 --smooth 10 --minRadius 8 input.gpx",
			"Custom processing",
		)
		.example(
			"$0 --auto --splineDegs 5 input.gpx",
			"Auto with custom spline angle",
		)
		.help();
}

/**
 * Main function for the CLI tool
 */
async function main() {
	// Parse command line arguments with yargs
	const parser = setupYargsParser();
	const argv = await parser.argv;

	// Get input files from positional arguments
	const inputFiles = argv._;
	if (inputFiles.length === 0) {
		console.error("Error: No input file specified");
		parser.showHelp();
		process.exit(1);
	}

	const inputFile = inputFiles[0]; // Use first input file
	const options = argv; // yargs provides all parsed options

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

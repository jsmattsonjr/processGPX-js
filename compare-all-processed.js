#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const gpxDir = "./gpx";
const perlDir = path.join(gpxDir, "perl");
const jsDir = path.join(gpxDir, "js");

// Get list of all Perl processed files
const perlFiles = fs
	.readdirSync(perlDir)
	.filter((file) => file.endsWith("_processed.gpx"));

console.log(`Found ${perlFiles.length} Perl-processed files to compare\n`);

let totalFiles = 0;
let equalRoutes = 0;
let equalGeometry = 0;
let equalAltitude = 0;
const results = [];

for (const perlFile of perlFiles.sort()) {
	// Derive the corresponding JS file name
	const baseName = perlFile.replace("_processed.gpx", "");
	const jsFile = `${baseName}_jsprocessed.gpx`;

	const perlPath = path.join(perlDir, perlFile);
	const jsPath = path.join(jsDir, jsFile);

	// Check if JS file exists
	if (!fs.existsSync(jsPath)) {
		console.log(`⚠️  Missing JS file for: ${baseName}`);
		continue;
	}

	totalFiles++;

	try {
		// Run comparison
		const output = execSync(`node gpx-compare.js "${perlPath}" "${jsPath}"`, {
			encoding: "utf-8",
			stdio: "pipe",
		});

		// Parse the output to extract results
		const lines = output.split("\n");
		const geometryLine = lines.find((l) =>
			l.includes("Routes geometrically equal:"),
		);
		const altitudeLine = lines.find((l) =>
			l.includes("Altitudes within tolerance"),
		);
		const overallLine = lines.find((l) => l.includes("Overall Result:"));

		const geometryEqual = geometryLine?.includes("✅") || false;
		const altitudeEqual = altitudeLine?.includes("✅") || false;
		const overallEqual = overallLine?.includes("EQUAL ✅") || false;

		if (geometryEqual) equalGeometry++;
		if (altitudeEqual) equalAltitude++;
		if (overallEqual) equalRoutes++;

		results.push({
			name: baseName,
			geometryEqual,
			altitudeEqual,
			overallEqual,
			output,
		});

		console.log(
			`${overallEqual ? "✅" : "❌"} ${baseName.padEnd(40)} | Geo: ${geometryEqual ? "✅" : "❌"} | Alt: ${altitudeEqual ? "✅" : "❌"}`,
		);
	} catch (error) {
		const errorOutput = error.stdout || error.stderr || error.message;
		const overallEqual = errorOutput.includes("EQUAL ✅");
		const geometryEqual = errorOutput.includes(
			"Routes geometrically equal: ✅",
		);
		const altitudeEqual =
			errorOutput.includes("Altitudes within tolerance") &&
			errorOutput.includes("✅");

		if (geometryEqual) equalGeometry++;
		if (altitudeEqual) equalAltitude++;
		if (overallEqual) equalRoutes++;

		results.push({
			name: baseName,
			geometryEqual,
			altitudeEqual,
			overallEqual,
			output: errorOutput,
		});

		console.log(
			`${overallEqual ? "✅" : "❌"} ${baseName.padEnd(40)} | Geo: ${geometryEqual ? "✅" : "❌"} | Alt: ${altitudeEqual ? "✅" : "❌"}`,
		);
	}
}

console.log(`\n📊 Summary:`);
console.log(`Total files compared: ${totalFiles}`);
console.log(
	`Overall equal routes: ${equalRoutes}/${totalFiles} (${((equalRoutes / totalFiles) * 100).toFixed(1)}%)`,
);
console.log(
	`Geometry matches: ${equalGeometry}/${totalFiles} (${((equalGeometry / totalFiles) * 100).toFixed(1)}%)`,
);
console.log(
	`Altitude matches: ${equalAltitude}/${totalFiles} (${((equalAltitude / totalFiles) * 100).toFixed(1)}%)`,
);

// Show detailed results for failed cases
const failedCases = results.filter((r) => !r.overallEqual);
if (failedCases.length > 0) {
	console.log(`\n❌ Failed Cases (${failedCases.length}):`);
	for (const failed of failedCases.slice(0, 5)) {
		// Show first 5 failures
		console.log(`\n--- ${failed.name} ---`);
		console.log(failed.output);
	}
	if (failedCases.length > 5) {
		console.log(`\n... and ${failedCases.length - 5} more failed cases`);
	}
}

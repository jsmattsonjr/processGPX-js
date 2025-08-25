#!/usr/bin/env node

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

const execAsync = promisify(exec);

/**
 * CLI Option Fuzzer for processGPX-js
 * Generates random combinations of CLI options based on the Yargs configuration
 */

// Extract option definitions from the Yargs config in process-cli.js
const OPTIONS_CONFIG = {
	// Boolean options
	boolean: [
		"addCurvature", "addDirection", "addDistance", "addGradient", 
		"addGradientSigns", "addSigma", "anchorSF", "auto", "autoLoop", 
		"copyPoint", "csv", "enableAdvancedSmoothing", "enableElevationFixes",
		"loop", "loopLeft", "loopRight", "noSave", "outAndBack", 
		"outAndBackLap", "quiet", "reverse", "saveCrossingsCSV", 
		"saveSimplifiedCourse", "stripSegments"
	],

	// Numeric options with reasonable ranges
	numeric: {
		append: [0, 10],
		arcFitDegs: [1, 90],
		arcFitEnd: [0, 100],
		arcFitMaxDegs: [30, 90],
		arcFitStart: [0, 100],
		autoSegmentMargin: [100, 1000],
		autoSegmentFinishMargin: [10, 100],
		autoSegmentStartMargin: [100, 500],
		autoSegmentDefaultPower: [0.1, 1.0],
		autoSegmentStretch: [0.01, 0.1],
		autoSplits: [0, 20],
		autoStraightenLength: [10, 1000],
		autoStraightenDeviation: [0.1, 10],
		cornerCrop: [0, 50],
		cornerCropEnd: [0, 50],
		cornerCropStart: [0, 50],
		cornerEffect: [0.1, 2.0],
		cropMax: [10, 1000],
		cropMin: [0, 500],
		crossingAngle: [10, 90],
		crossingHeight: [1, 10],
		crossingTransition: [1, 20],
		disableAdvancedSmoothing: [0, 2],
		disableElevationFixes: [0, 2],
		extend: [0, 100],
		extendBack: [0, 100],
		finishCircuits: [0, 10],
		finishCircuitDistance: [-1, 1000],
		gAutoSmooth: [0, 50],
		gSigma: [0, 50],
		gradientPower: [1, 5],
		gradientThreshold: [10, 500],
		laneShift: [-10, 10],
		lAutoSmooth: [0, 50],
		maxCornerCropDegs: [10, 90],
		maxSlope: [10, 60],
		minCornerCropDegs: [5, 45],
		minRadius: [1, 50],
		minRadiusStart: [1, 50],
		minRadiusEnd: [1, 50],
		prepend: [0, 10],
		pruneD: [0.1, 5],
		pruneX: [0.0001, 0.01],
		prunedg: [0.0001, 0.005],
		rCrossings: [1, 20],
		repeat: [0, 5],
		rLap: [1, 100],
		rTurnaround: [1, 50],
		rUTurn: [1, 50],
		shiftEnd: [-20, 20],
		shiftSF: [0, 2],
		shiftStart: [-20, 20],
		shiftTransition: [1, 100],
		sigma: [1, 100],
		simplifyD: [0.1, 2],
		simplifyZ: [0.01, 1],
		smoothAngle: [5, 45],
		smoothEnd: [1, 100],
		smoothStart: [1, 100],
		snap: [1, 20],
		snapDistance: [1, 10],
		snapTransition: [1, 50],
		snapAltitude: [0.1, 5],
		spacing: [1, 20],
		splineDegs: [1, 45],
		splineEnd: [0, 100],
		splineMaxDegs: [30, 90],
		splineStart: [0, 100],
		splitNumber: [1, 20],
		startCircuitDistance: [-1, 1000],
		startCircuits: [0, 10],
		selectedTrack: [0, 5],
		zAutoSmooth: [0, 50],
		zOffset: [-100, 100],
		zScaleRef: [0, 1000],
		zScale: [0.1, 3],
		zShift: [-50, 50],
		zShiftEnd: [-50, 50],
		zShiftStart: [-50, 50],
		sigmaz: [1, 100]
	},

	// String options
	string: [
		"author", "autoSegmentNames", "copyright", "description", 
		"keywords", "title", "out", "namedSegments", "startTime"
	],

	// Array options (generate 1-3 values each)
	array: [
		"autoSegments", "autoStraighten", "circleStart", "circleEnd", 
		"circle", "circuitFromPosition", "circuitToPosition", "deleteRange", 
		"flatten", "join", "selectiveLaneShift", "selectiveSmoothG", 
		"selectiveSmooth", "selectiveSmoothZ", "splitAt", "straight", 
		"straightStart", "straightEnd"
	],

	// Constraints from Yargs validation
	constraints: {
		mutuallyExclusive: [["loopLeft", "loopRight"]],
		dependencies: [
			{ option: "shiftSF", requires: ["loop"] } // shiftSF needs loop/lap
		]
	},

	// Options that use undefined as default (special handling)
	undefinedDefaults: ["autoSpacing", "fixCrossings", "prune", "simplifyPoints"]
};

class CLIOptionFuzzer {
	constructor() {
		this.testFile = "Twin_Bridges_Scenic_Bikeway.gpx";
		this.maxOptions = 10; // Max options per test
		this.runs = 0;
		this.successful = 0;
		this.failed = 0;
	}

	/**
	 * Generate a random value for a numeric option
	 */
	randomNumeric(option) {
		const range = OPTIONS_CONFIG.numeric[option];
		if (!range) return Math.floor(Math.random() * 100);
		
		const [min, max] = range;
		if (Number.isInteger(min) && Number.isInteger(max)) {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		} else {
			return Math.random() * (max - min) + min;
		}
	}

	/**
	 * Generate a random string value
	 */
	randomString() {
		const words = ["test", "fuzzer", "auto", "route", "bike", "gpx", "process"];
		return words[Math.floor(Math.random() * words.length)];
	}

	/**
	 * Generate random array values
	 */
	randomArray() {
		const count = Math.floor(Math.random() * 3) + 1;
		const values = [];
		for (let i = 0; i < count; i++) {
			values.push(Math.floor(Math.random() * 100));
		}
		return values;
	}

	/**
	 * Check if option combination violates constraints
	 */
	violatesConstraints(selectedOptions) {
		// Check mutual exclusions
		for (const group of OPTIONS_CONFIG.constraints.mutuallyExclusive) {
			const found = group.filter(opt => selectedOptions.has(opt));
			if (found.length > 1) {
				return `Mutually exclusive: ${found.join(", ")}`;
			}
		}

		// Check dependencies
		for (const dep of OPTIONS_CONFIG.constraints.dependencies) {
			if (selectedOptions.has(dep.option)) {
				const hasRequired = dep.requires.some(req => selectedOptions.has(req));
				if (!hasRequired) {
					return `${dep.option} requires one of: ${dep.requires.join(", ")}`;
				}
			}
		}

		return null;
	}

	/**
	 * Generate a random set of CLI options
	 */
	generateOptions() {
		const numOptions = Math.floor(Math.random() * this.maxOptions) + 1;
		const selectedOptions = new Set();
		const args = [];

		// Always include the test file
		args.push(this.testFile);

		let attempts = 0;
		while (selectedOptions.size < numOptions && attempts < 100) {
			attempts++;
			
			// Pick a random option type
			const typeChoice = Math.random();
			let option, value;

			if (typeChoice < 0.4) { // 40% boolean
				option = OPTIONS_CONFIG.boolean[Math.floor(Math.random() * OPTIONS_CONFIG.boolean.length)];
				if (selectedOptions.has(option)) continue;
				
				selectedOptions.add(option);
				
				// Test constraint violation before adding
				const violation = this.violatesConstraints(selectedOptions);
				if (violation) {
					selectedOptions.delete(option);
					continue;
				}
				
				args.push(`--${option}`);
				
			} else if (typeChoice < 0.7) { // 30% numeric
				const numericKeys = Object.keys(OPTIONS_CONFIG.numeric);
				option = numericKeys[Math.floor(Math.random() * numericKeys.length)];
				if (selectedOptions.has(option)) continue;
				
				selectedOptions.add(option);
				value = this.randomNumeric(option);
				args.push(`--${option}`, value.toString());
				
			} else if (typeChoice < 0.85) { // 15% string
				option = OPTIONS_CONFIG.string[Math.floor(Math.random() * OPTIONS_CONFIG.string.length)];
				if (selectedOptions.has(option)) continue;
				
				selectedOptions.add(option);
				value = this.randomString();
				args.push(`--${option}`, value);
				
			} else { // 15% array
				option = OPTIONS_CONFIG.array[Math.floor(Math.random() * OPTIONS_CONFIG.array.length)];
				if (selectedOptions.has(option)) continue;
				
				selectedOptions.add(option);
				const arrayValues = this.randomArray();
				for (const val of arrayValues) {
					args.push(`--${option}`, val.toString());
				}
			}
		}

		return args;
	}

	/**
	 * Run a single fuzz test
	 */
	async runTest(args) {
		this.runs++;
		const command = `node process-cli.js ${args.join(" ")}`;
		
		try {
			console.log(`\nTest ${this.runs}: ${command}`);
			const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
			
			if (stderr && !stderr.includes("Successfully created")) {
				console.log(`⚠️  Stderr: ${stderr.trim()}`);
			}
			
			this.successful++;
			console.log("✅ Success");
			return true;
			
		} catch (error) {
			this.failed++;
			console.log(`❌ Failed: ${error.message}`);
			
			// Log interesting failures (not just validation errors)
			if (!error.message.includes("ERROR: you cannot specify both") &&
			    !error.message.includes("ERROR: -shiftSF is only compatible")) {
				console.log(`   Command: ${command}`);
				console.log(`   Error: ${error.message.split("\n")[0]}`);
			}
			
			return false;
		}
	}

	/**
	 * Run multiple fuzz tests
	 */
	async fuzz(numTests = 50) {
		console.log(`🔍 Starting CLI fuzzer with ${numTests} tests`);
		console.log(`📁 Using test file: ${this.testFile}`);
		
		// Check test file exists
		if (!fs.existsSync(this.testFile)) {
			console.error(`❌ Test file not found: ${this.testFile}`);
			return;
		}

		const startTime = Date.now();
		
		for (let i = 0; i < numTests; i++) {
			const args = this.generateOptions();
			await this.runTest(args);
			
			// Brief pause between tests
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		const duration = (Date.now() - startTime) / 1000;
		
		console.log("\n" + "=".repeat(60));
		console.log("📊 FUZZER RESULTS");
		console.log("=".repeat(60));
		console.log(`Tests run: ${this.runs}`);
		console.log(`Successful: ${this.successful} (${(this.successful/this.runs*100).toFixed(1)}%)`);
		console.log(`Failed: ${this.failed} (${(this.failed/this.runs*100).toFixed(1)}%)`);
		console.log(`Duration: ${duration.toFixed(1)}s`);
		console.log(`Rate: ${(this.runs/duration).toFixed(1)} tests/sec`);
	}

	/**
	 * Generate a single random command for manual testing
	 */
	generateCommand() {
		const args = this.generateOptions();
		return `node process-cli.js ${args.join(" ")}`;
	}
}

// CLI interface
const fuzzer = new CLIOptionFuzzer();

// Parse command line args
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === "--help") {
	console.log(`
CLI Option Fuzzer for processGPX-js

Usage:
  node fuzz-cli.js [num-tests]     Run fuzzer with specified number of tests (default: 50)
  node fuzz-cli.js --generate      Generate a single random command
  node fuzz-cli.js --help          Show this help

Examples:
  node fuzz-cli.js 100            # Run 100 random tests
  node fuzz-cli.js --generate     # Generate one random command
`);
	process.exit(0);
}

if (args[0] === "--generate") {
	console.log(fuzzer.generateCommand());
} else {
	const numTests = parseInt(args[0]) || 50;
	fuzzer.fuzz(numTests);
}
/**
 * Default processing options for processGPX
 */
export const defaultOptions = {
	// Basic flags
	addCurvature: 0,
	addDirection: 0,
	addDistance: 0,
	addGradient: 0,
	addGradientSigns: 0,
	addSigma: 0,
	anchorSF: 0,

	// Distance settings
	append: 0,
	prepend: 0,
	extend: 0,

	// Arc fitting
	arcFitMaxDegs: 60,

	// Auto segment settings
	autoSegmentMargin: 400,
	autoSegmentFinishMargin: 20,
	autoSegmentStartMargin: 340,
	autoSegmentDefaultPower: 0.5,
	autoSegmentStretch: 0.05,
	autoSegmentNames: "",
	autoSplits: 0,

	// Smoothing settings
	cornerEffect: 1,
	copyPoint: 0,

	// Crossing settings
	crossingHeight: 2,

	// Output settings
	csv: 0,
	disableElevationFixes: 1,
	disableAdvancedSmoothing: 1,
	enableElevationFixes: 0,
	enableAdvancedSmoothing: 0,

	// Circuit settings
	finishCircuits: 0,
	finishCircuitDistance: -1,

	// Smoothing controls
	gAutoSmooth: 0,
	gradientPower: 2,
	gradientThreshold: 100,
	gSmooth: 0,

	// Loop and course settings
	isLoop: 0,
	lAutoSmooth: 0,

	// Slope and radius limits
	maxSlope: 30,

	// Segment settings
	namedSegments: "",
	needHelp: 0,
	newKeywords: "",
	noSave: 0,
	outFile: "",
	outAndBack: 0,
	outAndBackLap: 0,

	// Pruning settings
	pruneD: 1,
	pruneX: 0.001,
	prunedg: 0.0005,
	quiet: 0,

	// Crossing radius
	rCrossings: 6,

	// Course modifications
	repeat: 0,
	reverse: 0,

	// Shift settings
	shiftSFDefault: 0,
	shiftSF: 0,

	// Snapping settings
	snapAltitude: 1,
	snapDistance: 2,

	// Spline settings
	splineDegs: 5,
	splineMaxDegs: 60,

	// Circuit settings
	startCircuits: 0,
	startCircuitDistance: -1,
	selectedTrack: 0,

	// Version flag
	vFlag: 0,

	// Altitude settings
	zAutoSmooth: 0,
	zOffset: 0,
	zScale: 1,
	zScaleRef: 0,
	zShift: 0,

	// Arrays (initialized as empty)
	autoSegments: [],
	autoStraighten: [],
	circle: [],
	circleEnd: [],
	circleStart: [],
	circuitFromPosition: [],
	circuitToPosition: [],
	deleteRange: [],
	flatten: [],
	join: [],
	selectiveLaneShift: [],
	selectiveSmooth: [],
	selectiveSmoothG: [],
	selectiveSmoothZ: [],
	splitDistance: [],
	straight: [],
	straightEnd: [],
	straightStart: [],

	// shortcut options
	auto: 1, // TODO: hardcoded for now
};

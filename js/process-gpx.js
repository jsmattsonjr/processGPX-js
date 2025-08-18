/**
 * GPX processing functions for route optimization
 */

// Mathematical constants
const PI = Math.atan2(0, -1);
const TWOPI = 2 * PI;
const REARTH = 20037392 / PI;
const DEG2RAD = PI / 180;
const LAT2Y = REARTH * DEG2RAD;

/**
 * Logging function (equivalent to Perl's note function)
 * @param {...any} args - Arguments to log
 */
function note(...args) {
	console.log(...args);
}

/**
 * Reduce angle to range [-π, π]
 * @param {number} theta - Angle in radians
 * @returns {number} Reduced angle
 */
function reduceAngle(theta) {
	theta -= TWOPI * Math.floor(0.5 + theta / TWOPI);
	return theta;
}

/**
 * Calculate distance between two lat/lng points using haversine formula
 * @param {Object} p1 - First point with {lat, lon} properties
 * @param {Object} p2 - Second point with {lat, lon} properties
 * @returns {number} Distance in meters
 */
function latlngDistance(p1, p2) {
	const lat1 = DEG2RAD * p1.lat;
	const lat2 = DEG2RAD * p2.lat;
	const lng1 = DEG2RAD * p1.lon;
	const lng2 = DEG2RAD * p2.lon;
	const dlng = lng2 - lng1;
	const dlat = lat2 - lat1;
	const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
	const d = 2 * REARTH * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return d;
}

/**
 * Convert lat/lng difference to dx/dy in meters
 * @param {Object} p1 - First point with {lat, lon} properties
 * @param {Object} p2 - Second point with {lat, lon} properties
 * @returns {Array} [dx, dy] in meters
 */
function latlng2dxdy(p1, p2) {
	if (!p1) throw new Error("latlng2dxdy called with undefined point #1");
	if (!p2) throw new Error("latlng2dxdy called with undefined point #2");
	
	const c1 = Math.cos(DEG2RAD * p1.lat);
	const c2 = Math.cos(DEG2RAD * p2.lat);
	let dlon = p2.lon - p1.lon;
	dlon -= 360 * Math.floor(0.5 + dlon / 360);
	let dlat = p2.lat - p1.lat;
	dlat -= 360 * Math.floor(0.5 + dlat / 360);
	
	const dx = (c1 + c2) * LAT2Y * dlon / 2;
	const dy = LAT2Y * dlat;
	return [dx, dy];
}

/**
 * Calculate dot product between two lat/lng segments
 * @param {Object} p1 - First point of first segment
 * @param {Object} p2 - Second point of first segment
 * @param {Object} p3 - First point of second segment
 * @param {Object} p4 - Second point of second segment
 * @returns {number|null} Dot product or null if degenerate
 */
function latlngDotProduct(p1, p2, p3, p4) {
	const [dx12, dy12] = latlng2dxdy(p1, p2);
	const [dx34, dy34] = latlng2dxdy(p3, p4);
	const denom = Math.sqrt((dx12 ** 2 + dy12 ** 2) * (dx34 ** 2 + dy34 ** 2));
	return denom === 0 ? null : (dx12 * dx34 + dy12 * dy34) / denom;
}

/**
 * Calculate cross product between two lat/lng segments
 * @param {Object} p1 - First point of first segment
 * @param {Object} p2 - Second point of first segment
 * @param {Object} p3 - First point of second segment
 * @param {Object} p4 - Second point of second segment
 * @returns {number|null} Cross product or null if degenerate
 */
function latlngCrossProduct(p1, p2, p3, p4) {
	const [dx12, dy12] = latlng2dxdy(p1, p2);
	const [dx34, dy34] = latlng2dxdy(p3, p4);
	const denom = Math.sqrt((dx12 ** 2 + dy12 ** 2) * (dx34 ** 2 + dy34 ** 2));
	return denom === 0 ? null : (dx12 * dy34 - dx34 * dy12) / denom;
}

/**
 * Calculate angle between three points
 * @param {Object} p1 - First point
 * @param {Object} p2 - Vertex point
 * @param {Object} p3 - Third point
 * @returns {number|null} Angle in radians or null if degenerate
 */
function latlngAngle(p1, p2, p3) {
	const s = latlngCrossProduct(p1, p2, p2, p3);
	const c = latlngDotProduct(p1, p2, p2, p3);
	const a = (s !== null && c !== null) ? reduceAngle(Math.atan2(s, c)) : null;
	return a;
}

/**
 * Calculate quality score for a GPX track
 * @param {Object} options - Options object with points and isLoop properties
 * @returns {Array} [totalScore, directionScore, altitudeScore]
 */
function calcQualityScore({ points, isLoop }) {
	const sines = [];
	const ddirs = [];
	note("calculating altitude quality score..");
	let courseDistance = 0;
	let s2sum = 0;
	
	for (let i = 0; i < points.length; i++) {
		if (!isLoop && i === points.length - 1) break;
		
		// Distance and altitude change to next point
		const ds = latlngDistance(points[i], points[(i + 1) % points.length]);
		if (ds < 0.01) continue;
		courseDistance += ds;
		
		const dz = points[(i + 1) % points.length].ele - points[i].ele;
		if (Math.abs(ds) < 0.1 && Math.abs(dz) < 0.01) continue; // Skip duplicate points
		
		// Sine of inclination angle to next point
		const s = dz / Math.sqrt(dz ** 2 + ds ** 2);
		sines.push(s);
		s2sum += ds * (s ** 2 + 1e-4);
		
		ddirs.push(
			(!isLoop && i === 0) ?
				0 :
				latlngAngle(
					points[(i - 1 + points.length) % points.length],
					points[i],
					points[(i + 1) % points.length]
				)
		);
		
		if (!(ddirs[ddirs.length - 1] !== null && sines[sines.length - 1] !== null)) {
			sines.pop();
			ddirs.pop();
		}
	}
	
	let sum2 = 0;
	for (let i = 0; i < sines.length; i++) {
		if (!isLoop && i === sines.length - 1) break;
		// These are sine grades, not tangents, to avoid zero denominators
		const s1 = sines[i];
		const s2 = sines[(i + 1) % sines.length];
		sum2 += (s2 - s1) ** 2;
	}
	
	const scoreZ = courseDistance === 0 ? 0 : 10 * sum2 / s2sum;
	
	sum2 = 0;
	for (let i = 0; i < ddirs.length; i++) {
		sum2 += ddirs[i] ** 2;
	}
	const scoreD = courseDistance === 0 ? 0 : 100 * sum2 / courseDistance;
	
	const score = scoreZ + scoreD;
	
	return [score, scoreD, scoreZ];
}

/**
 * Process a GPX track feature to optimize and improve the route
 * @param {Object} trackFeature - LineString feature object from GPX parsing
 * @param {Object} options - Processing options dictionary
 * @returns {Object} Processed LineString feature object
 */
function processGPX(trackFeature, options = {}) {
	// Validate input
	if (!trackFeature || !trackFeature.geometry || trackFeature.geometry.type !== "LineString") {
		throw new Error("Invalid track feature provided to processGPX");
	}

	// Convert coordinates to points format expected by quality score calculation
	const points = trackFeature.geometry.coordinates.map(coord => ({
		lat: coord[1],
		lon: coord[0],
		ele: coord[2] || 0
	}));

	// Calculate quality score of original course
	note("points in original GPX track = ", points.length);
	const [score, scoreD, scoreZ] = calcQualityScore({ points, isLoop: options.isLoop || 0 });
	note("quality score of original course = ", score.toFixed(4));
	note("direction score of original course = ", scoreD.toFixed(4));
	note("altitude score of original course = ", scoreZ.toFixed(4));

	// For now, implement as identity function - return a deep copy of the input
	const processedFeature = {
		type: trackFeature.type,
		geometry: {
			type: trackFeature.geometry.type,
			coordinates: trackFeature.geometry.coordinates.map(coord => [...coord])
		},
		properties: {
			...trackFeature.properties,
			processed: true,
			processedAt: new Date().toISOString(),
			processOptions: { ...options }
		}
	};

	return processedFeature;
}
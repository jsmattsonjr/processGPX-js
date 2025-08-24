/**
 * GPX processing functions for route optimization
 */

// Mathematical constants
const PI = Math.atan2(0, -1);
const TWOPI = 2 * PI;
const REARTH = 20037392 / PI;
const DEG2RAD = PI / 180;
const LAT2Y = REARTH * DEG2RAD;

// Helper and debugging functions
/**
 * Perl-style int() function that truncates towards zero
 * @param {number} x - Number to truncate
 * @returns {number} Truncated integer
 */
function int(x) {
	return x < 0 ? Math.ceil(x) : Math.floor(x);
}

/**
 * JavaScript equivalent of Perl's spaceship operator (<=>)
 * Returns -1, 0, or 1 based on comparison
 * @param {number} a - First value
 * @param {number} b - Second value
 * @returns {number} -1 if a < b, 0 if a == b, 1 if a > b
 */
function spaceship(a, b) {
	return (a > b) - (a < b);
}

/**
 * Die function - equivalent to Perl's die()
 * Throws an error with the given message
 * @param {string} message - Error message
 */
function die(message) {
	throw new Error(message);
}

/**
 * Wrap array index to handle negative indices like Perl
 * @param {number} i - Index (can be negative)
 * @param {number} len - Array length
 * @returns {number} Wrapped index
 */
function wrapIndex(i, len) {
	return ((i % len) + len) % len;
}

/**
 * returns the last valid index of an array
 * @param {Array} x - array
 * @returns {number} last valid index
 */
function maxIndex(x) {
	return x.length - 1;
}

/**
 * Logging function (equivalent to Perl's note function)
 * @param {...any} args - Arguments to log
 */
function note(...args) {
	console.log(...args);

	// Dispatch progress events for the web UI
	if (typeof window !== "undefined") {
		const message = args.join(" ");
		// Check if it's a stage completion message
		if (message.includes("Stage") && message.includes("complete:")) {
			window.dispatchEvent(
				new CustomEvent("gpx-progress", {
					detail: { message, type: "stage" },
				}),
			);
		}
		// Check if it's a major processing step
		else if (
			message.includes("...") ||
			message.includes("setting") ||
			message.includes("checking")
		) {
			window.dispatchEvent(
				new CustomEvent("gpx-progress", {
					detail: { message, type: "step" },
				}),
			);
		}
	}
}

/**
 * Warning function (equivalent to Perl's warn function)
 * @param {...any} args - Arguments to warn
 */
function warn(...args) {
	console.log(...args);
}

/**
 * Debug function to dump points array to file in consistent format
 * Compatible with Perl processGPX dumpPoints() function
 * @param {Array} points - Array of point objects with lat, lon, ele, distance properties
 * @param {string} filename - Output filename
 */
function dumpPoints(points, filename) {
	// Extract stage number and basename for clearer messaging
	const match = filename.match(/^(\d+)-js-(.+)\.txt$/);
	if (match) {
		const [, stageNum, stageName] = match;
		note(`Stage ${stageNum} (${stageName}) complete: ${points.length} points`);
	} else {
		note(`Stage ${filename} complete: ${points.length} points`);
	}

	let output = `# Points dump: ${points.length} points\n`;
	output += "# Index\tLat\t\tLon\t\tEle\t\tDistance\n";

	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const lat = p.lat.toFixed(8);
		const lon = p.lon.toFixed(8);
		const ele = (p.ele || 0).toString();
		const dist = (p.distance || 0).toString();

		output += `${i}\t${lat}\t${lon}\t${ele}\t\t${dist}\n`;
	}

	// Check if running in Node.js environment
	if (
		typeof process !== "undefined" &&
		process.versions &&
		process.versions.node
	) {
		// Use dynamic import for ES modules compatibility
		import("node:fs")
			.then((fs) => {
				const debugPath = `debug/${filename}`;
				fs.writeFileSync(debugPath, output);
				note(`Dumped ${points.length} points to ${debugPath}`);
			})
			.catch(() => {
				// Fallback to console
				note(`=== Points dump to ${filename} ===`);
				note(output);
				note(`=== End dump ${filename} ===`);
			});
	}
}

/**
 * Regular expression for matching numeric values (equivalent to Perl's $number_regexp)
 */
const NUMBER_REGEXP = /^[+-]?\d*(?:\d|(?:\.\d+))(?:[eE][-+]?\d+)?$/;

/**
 * Check if a value is numeric
 * @param {any} value - Value to check
 * @returns {boolean} True if numeric
 */
function isNumeric(value) {
	if (typeof value === "number") {
		// Reject NaN and Infinity
		return Number.isFinite(value);
	}
	if (typeof value === "string") {
		return NUMBER_REGEXP.test(value);
	}
	return false;
}

// Functions in order of Perl script
/**
 * Transition function: 1 (x = -1) to 1/2 (x = 0) to 0 (x = 1)
 * @param {number} x - Input value
 * @returns {number} Transition value
 */
function transition(x) {
	const PI2 = Math.atan2(1, 0); // π/2
	return x < -1 ? 1 : x > 1 ? 0 : (1 - Math.sin(x * PI2)) / 2;
}

/**
 * Reduce angle to range (-π, π]
 * @param {number} theta - Angle in radians
 * @returns {number} Reduced angle
 */
function reduceAngle(theta) {
	theta -= TWOPI * Math.floor(0.5 + theta / TWOPI);

	// Ensure -π maps to π to match atan2()
	if (Math.abs(theta + PI) < PI * Number.EPSILON) {
		theta = PI;
	}

	return theta;
}

/**
 * Average two angles, handling wraparound correctly
 * @param {number} d1 - First angle in radians
 * @param {number} d2 - Second angle in radians
 * @returns {number} Average angle in radians
 */
function averageAngles(d1, d2) {
	return reduceAngle(d1 + 0.5 * reduceAngle(d2 - d1));
}

/**
 * Calculate difference between two angles
 * @param {number} d1 - First angle in radians
 * @param {number} d2 - Second angle in radians
 * @returns {number} Angle difference in radians
 */
function deltaAngle(d1, d2) {
	return reduceAngle(d2 - d1);
}

/**
 * find distance between lat, lng points
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
	const a =
		Math.sin(dlat / 2) ** 2 +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
	const d = 2 * REARTH * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return d;
}

/**
 * Calculate delta vector between two xy points
 * @param {Array} p1 - [x, y] first point
 * @param {Array} p2 - [x, y] second point
 * @returns {Array} [dx, dy] difference vector
 */
function deltaxy(p1, p2) {
	return [p2[0] - p1[0], p2[1] - p1[1]];
}

/**
 * Check if two points are close together
 * @param {Object} p1 - First point
 * @param {Object} p2 - Second point
 * @param {number} sMax - Maximum distance threshold (default 0.05m)
 * @param {number} zMax - Maximum altitude difference (default 1m)
 * @returns {boolean} True if points are close
 */
function pointsAreClose(p1, p2, sMax = 0.05, zMax = 1) {
	const dz = p1.ele !== undefined && p2.ele !== undefined ? p2.ele - p1.ele : 0;
	return Math.abs(dz) < zMax && latlngDistance(p1, p2) < sMax;
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
 * Calculate cross product between two segments defined by array coordinates
 * @param {Array} p1 - [x, y] coordinates of first point of first segment
 * @param {Array} p2 - [x, y] coordinates of second point of first segment
 * @param {Array} p3 - [x, y] coordinates of first point of second segment
 * @param {Array} p4 - [x, y] coordinates of second point of second segment
 * @returns {number|null} Normalized cross product or null if degenerate
 */
function crossProduct(p1, p2, p3, p4) {
	const dx12 = p2[0] - p1[0];
	const dx34 = p4[0] - p3[0];
	const dy12 = p2[1] - p1[1];
	const dy34 = p4[1] - p3[1];
	const denom = Math.sqrt((dx12 ** 2 + dy12 ** 2) * (dx34 ** 2 + dy34 ** 2));
	return denom === 0 ? null : (dx12 * dy34 - dx34 * dy12) / denom;
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
 * Determine turn direction of three points
 * @param {Array} v1 - [x, y] first point
 * @param {Array} v2 - [x, y] second point
 * @param {Array} v3 - [x, y] third point
 * @returns {number} -1, 0, or 1 indicating turn direction
 */
function turnDirection(v1, v2, v3) {
	const dv1 = deltaxy(v1, v2);
	const dv2 = deltaxy(v2, v3);
	return spaceship(dv1[1] * dv2[0], dv1[0] * dv2[1]);
}

/**
 * given 3 points, return the subtended angle
 * @param {Object} p1 - First point
 * @param {Object} p2 - Vertex point
 * @param {Object} p3 - Third point
 * @returns {number|null} Angle in radians or null if degenerate
 */
function latlngAngle(p1, p2, p3) {
	const s = latlngCrossProduct(p1, p2, p2, p3);
	const c = latlngDotProduct(p1, p2, p2, p3);
	const a = s !== null && c !== null ? reduceAngle(Math.atan2(s, c)) : null;
	return a;
}

/**
 * direction from p1 to p2
 * 0 deg = eastward
 * 90 deg: northward
 * 180 deg: westward
 * 270 deg: southward
 * @param {Object} p1 - First point
 * @param {Object} p2 - Second point
 * @returns {number} Direction in radians (0 = east, π/2 = north)
 */
function latlngDirection(p1, p2) {
	const [dx, dy] = latlng2dxdy(p1, p2);
	return Math.atan2(dy, dx);
}

/**
 * the direction of a point p2, which is the average
 * of the directions of the adjacent segments
 * @param {Object} p1 - Previous point
 * @param {Object} p2 - Current point
 * @param {Object} p3 - Next point
 * @returns {number} Direction in radians
 */
function pointDirection(p1, p2, p3) {
	return averageAngles(latlngDirection(p1, p2), latlngDirection(p2, p3));
}

/**
 * Shift a point by a given distance in a given direction
 * @param {Object} point - Point to shift
 * @param {number} direction - Direction in radians
 * @param {number} distance - Distance to shift
 * @returns {Object} New shifted point
 */
function shiftPoint(point, direction, distance) {
	const c = Math.cos(direction);
	const s = Math.sin(direction);

	// lane shift, 90 degrees
	const dx = s * distance;
	const dy = -c * distance;
	const dlng = dx / (LAT2Y * Math.cos(DEG2RAD * point.lat));
	const dlat = dy / LAT2Y;

	return {
		...point,
		lon: point.lon + dlng,
		lat: point.lat + dlat,
	};
}

/**
 * Shift a vertex by a given distance considering two directions
 * @param {Object} point - Point to shift
 * @param {Array} directions - Array of two directions in radians
 * @param {number} distance - Distance to shift
 * @returns {Object} New shifted point
 */
function shiftVertex(point, directions, distance) {
	const c1 = Math.cos(directions[0]);
	const s1 = Math.sin(directions[0]);
	const c2 = Math.cos(directions[1]);
	const s2 = Math.sin(directions[1]);

	// lane shift, 90 degrees
	const denom = c1 * s2 - c2 * s1;
	let dx, dy;

	if (Math.abs(denom) < 0.001) {
		dx = ((s1 + s2) * distance) / 2;
		dy = (-(c1 + c2) * distance) / 2;
	} else {
		dx = ((c1 - c2) / denom) * distance;
		dy = ((s1 - s2) / denom) * distance;
	}

	const dlng = dx / (LAT2Y * Math.cos(DEG2RAD * point.lat));
	const dlat = dy / LAT2Y;

	return {
		...point,
		lon: point.lon + dlng,
		lat: point.lat + dlat,
	};
}

/**
 * Convert lat/lng difference to dx/dy in meters
 * @param {Object} p1 - First point with {lat, lon} properties
 * @param {Object} p2 - Second point with {lat, lon} properties
 * @returns {Array} [dx, dy] in meters
 */
function latlng2dxdy(p1, p2) {
	if (!p1) die("latlng2dxdy called with undefined point #1");
	if (!p2) die("latlng2dxdy called with undefined point #2");

	const c1 = Math.cos(DEG2RAD * p1.lat);
	const c2 = Math.cos(DEG2RAD * p2.lat);
	let dlon = p2.lon - p1.lon;
	dlon -= 360 * Math.floor(0.5 + dlon / 360);
	let dlat = p2.lat - p1.lat;
	dlat -= 360 * Math.floor(0.5 + dlat / 360);

	const dx = ((c1 + c2) * LAT2Y * dlon) / 2;
	const dy = LAT2Y * dlat;
	return [dx, dy];
}

/**
 * point linearly interpolated between p1 and p2, with f the
 * fraction of the distance to p2
 * note since deleting repeated points results in the second point of a pair being deleted,
 * for non-numeric fields, I need to assume interpolated points are associated with the
 * latter point
 * for segments, I need to have the interpolated interval be a fresh segment
 * @param {Object} p1 - First point
 * @param {Object} p2 - Second point
 * @param {number} f - Fraction (0 = p1, 1 = p2)
 * @returns {Object} Interpolated point
 */
function interpolatePoint(p1, p2, f) {
	const newPoint = {};
	for (const k in p1) {
		if (p1[k] !== undefined && p2[k] !== undefined) {
			if (k === "segment") {
				if (p1[k] === p2[k]) {
					newPoint[k] = p1[k];
				} else {
					newPoint[k] = 0;
				}
			} else if (isNumeric(p1[k]) && isNumeric(p2[k])) {
				newPoint[k] = parseFloat(p1[k]) * (1 - f) + parseFloat(p2[k]) * f;
			} else {
				newPoint[k] = f < 0.5 ? p1[k] : p2[k];
			}
		}
	}
	return newPoint;
}

/**
 * for splines... p1 projects to p3, p2 projects to p4
 * interpolate and do a weighted average
 * @param {Array} points - Array of 4 points [p1, p2, p3, p4]
 * @param {number} f - interpolation factor (0-1)
 * @returns {Object} interpolated point
 */
function interpolateCorner(points, f) {
	const [p1, p2, p3, p4] = points;
	const px1 = interpolatePoint(p1, p3, f);
	const px2 = interpolatePoint(p4, p2, f);
	const px = interpolatePoint(px1, px2, f);
	return px;
}

/**
 * Calculate intersection between two line segments
 * @param {Array} s12 - First segment [p1, p2]
 * @param {Array} s34 - Second segment [p3, p4]
 * @returns {Array} Array of [f12, f34] intersection parameters, or empty array if no intersection
 */
function segmentIntercept(s12, s34) {
	const [p1, p2] = s12;
	const [p3, p4] = s34;

	if (!p1) die("segmentIntercept called with undefined point #1");
	if (!p2) die("segmentIntercept called with undefined point #2");
	if (!p3) die("segmentIntercept called with undefined point #3");
	if (!p4) die("segmentIntercept called with undefined point #4");

	const [x1, y1] = [0, 0];
	const [x2, y2] = latlng2dxdy(p1, p2);
	const [x3, y3] = latlng2dxdy(p1, p3);
	const [x4, y4] = latlng2dxdy(p1, p4);
	const [dx12, dy12] = [x2, y2];
	const [dx34, dy34] = latlng2dxdy(p3, p4);

	const denom = dx34 * dy12 - dx12 * dy34;
	const a = Math.sqrt((dx12 ** 2 + dy12 ** 2) * (dx34 ** 2 + dy34 ** 2));

	// lines are parallel
	if (a === 0 || Math.abs(denom) < 0.01 * a) {
		return [];
	}

	const f12 = (dx34 * (y3 - y1) - dy34 * (x3 - x1)) / denom;
	if (f12 >= 0 && f12 < 1) {
		const x = f12 * x2 + (1 - f12) * x1;
		const y = f12 * y2 + (1 - f12) * y1;
		const f23 =
			Math.abs(x3 - x4) > Math.abs(y3 - y4)
				? (x - x3) / (x4 - x3)
				: (y - y3) / (y4 - y3);
		if (f23 >= 0 && f23 < 1) {
			return [f12, f23];
		}
	}
	return [];
}

/**
 * add a vector to a point
 * a single iteration will use the average cosine for the path rather than
 * a starting cosine, just for maximal accuracy
 * note there will be no elevation field for this point:
 * that will need to be added somewhere else
 * @param {Object} point - Point with lat, lon properties
 * @param {Array} vector - [dx, dy] vector in meters
 * @returns {Object} New point with lat, lon properties
 */
function addVectorToPoint(point, vector) {
	const [dx, dy] = vector;
	const lon0 = point.lon;
	const lat0 = point.lat;
	const dlat = dy / LAT2Y; // this is independent of latitude
	let lat = lat0 + dlat;
	lat -= 360 * Math.floor(0.5 + lat / 360);

	if (Math.abs(lat) > 90) {
		die("ERROR -- attempted to cross beyond pole!");
	}

	const c = Math.cos(DEG2RAD * (lat0 + dlat / 2));
	const dlon = dx / c / LAT2Y;
	let lon = lon0 + dlon;
	lon -= 360 * Math.floor(0.5 + lon / 360);

	return { lat: lat, lon: lon };
}

/**
 * return points between p1 and p2 using a spline
 * using angles at beginning and end of the interval
 * @param {Object} p1 - start point
 * @param {Object} p2 - end point
 * @param {number} d1 - direction at p1 (radians)
 * @param {number} d2 - direction at p2 (radians)
 * @param {number} dd - minimum angle for spline (default PI/16)
 * @returns {Array} array of interpolated points
 */
function splineInterpolation(p1, p2, d1, d2, dd = PI / 16) {
	const sqrt2 = Math.sqrt(2);

	// calculate number of points based on the angle
	const deltad = reduceAngle(d2 - d1);
	let NPoints = Math.floor(Math.abs(deltad) / dd);

	// if the points are close, reduce the number of points: 1 point per 10 cm separation
	const NPointsMax = Math.floor(latlngDistance(p1, p2) / 0.1);
	if (NPoints > NPointsMax) {
		NPoints = NPointsMax;
	}

	if (NPoints <= 0) {
		return [];
	}

	const points = [];

	// distance to control points
	const r = latlngDistance(p1, p2) / sqrt2;

	// find projections of points along the directions
	const dx1 = Math.cos(d1) * r;
	const dy1 = Math.sin(d1) * r;
	const dx2 = -Math.cos(d2) * r;
	const dy2 = -Math.sin(d2) * r;
	const px1 = addVectorToPoint(p1, [dx1, dy1]);
	const px2 = addVectorToPoint(p2, [dx2, dy2]);

	// create points along asymptotes
	for (let i = 1; i <= NPoints; i++) {
		const f = i / (NPoints + 1);
		const p = interpolateCorner([p1, p2, px1, px2], f);
		points.push(p);
	}

	// adjust non-position fields to be linear with distance
	// since points are not necessarily equally spaced
	if (points.length > 0) {
		const ss = [latlngDistance(p1, points[0])];
		for (let i = 0; i < points.length - 1; i++) {
			ss.push(ss[ss.length - 1] + latlngDistance(points[i], points[i + 1]));
		}
		ss.push(ss[ss.length - 1] + latlngDistance(points[maxIndex(points)], p2));

		for (let i = 0; i < points.length; i++) {
			const f = ss[i] / ss[ss.length - 1];
			const p = points[i];
			for (const k in p1) {
				if (k !== "lat" && k !== "lon") {
					if (k === "segment") {
						if (p1[k] === p2[k]) {
							p[k] = p1[k];
						} else {
							p[k] = 0;
						}
					} else if (
						p1[k] !== undefined &&
						p2[k] !== undefined &&
						isNumeric(p1[k]) &&
						isNumeric(p2[k])
					) {
						p[k] = (1 - f) * p1[k] + f * p2[k];
					} else {
						p[k] = p1[k];
					}
				}
			}
		}
	}

	return points;
}

/**
 * Arc fit interpolation between points
 * @param {Object} p1 - First point (for first circle fit)
 * @param {Object} p2 - Second point (interpolation starts here)
 * @param {Object} p3 - Third point (interpolation ends here)
 * @param {Object} p4 - Fourth point (for second circle fit)
 * @param {number} dd - Interpolation angle (default π/16)
 * @returns {Array} Array of interpolated points
 */
function arcFitInterpolation(p1, p2, p3, p4, dd = Math.PI / 16) {
	const xy1 = latlng2dxdy(p2, p1);
	const xy2 = [0, 0];
	const xy3 = latlng2dxdy(p2, p3);
	const xy4 = latlng2dxdy(p2, p4);

	const [cxy0, cr0] = circle3PointFit(xy1, xy2, xy3);
	const [cxy1, cr1] = circle3PointFit(xy2, xy3, xy4);

	// Check the circle is on the right side of the corner
	const t1 = turnDirection(xy1, xy2, xy3);
	const t2 = turnDirection(xy2, xy3, xy4);

	// Points: find which circle spans the greatest angle, and divide that angle by
	// the angle spacing
	let phi11, phi12, dphi1, phi21, phi22, dphi2;
	let dphiMax = 0;

	if (cxy0 !== undefined) {
		// Check turn directions match
		if (
			!(
				t1 === turnDirection(xy1, xy2, cxy0) &&
				t1 === turnDirection(xy2, xy3, cxy0)
			)
		) {
			return [];
		}

		// Calculate angles
		phi11 = Math.atan2(xy2[1] - cxy0[1], xy2[0] - cxy0[0]);
		phi12 = Math.atan2(xy3[1] - cxy0[1], xy3[0] - cxy0[0]);
		dphi1 = deltaAngle(phi11, phi12);
		dphiMax = Math.max(dphiMax, Math.abs(dphi1));
	}

	if (cxy1 !== undefined) {
		// Check turn directions match
		if (
			!(
				t2 === turnDirection(xy2, xy3, cxy1) &&
				t2 === turnDirection(xy3, xy4, cxy1)
			)
		) {
			return [];
		}

		phi21 = Math.atan2(xy2[1] - cxy1[1], xy2[0] - cxy1[0]);
		phi22 = Math.atan2(xy3[1] - cxy1[1], xy3[0] - cxy1[0]);
		dphi2 = deltaAngle(phi21, phi22);
		dphiMax = Math.max(dphiMax, Math.abs(dphi2));
	}

	// Find number of points to interpolate
	let NPoints = Math.floor(dphiMax / Math.abs(dd));
	const NPointsMax = Math.floor(latlngDistance(p2, p3) / 0.1);
	NPoints = Math.min(NPoints, NPointsMax);

	const points = [];
	for (let i = 1; i <= NPoints; i++) {
		const f = i / (NPoints + 1);
		let phi1, phi2;
		if (dphi1 !== undefined) {
			phi1 = phi11 + dphi1 * f;
		}
		if (dphi2 !== undefined) {
			phi2 = phi21 + dphi2 * f;
		}

		let x1, y1, x2, y2;
		if (phi1 !== undefined) {
			x1 = cxy0[0] + cr0 * Math.cos(phi1);
			y1 = cxy0[1] + cr0 * Math.sin(phi1);
		} else {
			x1 = xy2[0] + f * (xy3[0] - xy2[0]);
			y1 = xy2[1] + f * (xy3[1] - xy2[1]);
		}

		if (phi2 !== undefined) {
			x2 = cxy1[0] + cr1 * Math.cos(phi2);
			y2 = cxy1[1] + cr1 * Math.sin(phi2);
		} else {
			x2 = xy2[0] + f * (xy4[0] - xy3[0]);
			y2 = xy2[1] + f * (xy4[1] - xy3[1]);
		}

		const dx = (1 - f) * x1 + f * x2 - xy2[0];
		const dy = (1 - f) * y1 + f * y2 - xy2[1];
		const p = addVectorToPoint(p2, [dx, dy]);
		points.push(p);
	}

	// Interpolate points with respect to distance along spline
	// Spline does not in general have equally spaced points, so point
	// interpolation, which would have been provided by interpolatePoint,
	// wouldn't work
	if (points.length > 0) {
		const ss = [latlngDistance(p2, points[0])];
		for (let i = 0; i < points.length - 1; i++) {
			ss.push(ss[ss.length - 1] + latlngDistance(points[i], points[i + 1]));
		}
		ss.push(ss[ss.length - 1] + latlngDistance(points[points.length - 1], p3));

		for (let i = 0; i < points.length; i++) {
			const f = ss[i] / ss[ss.length - 1];
			const p = points[i];
			for (const k in p2) {
				if (k !== "lat" && k !== "lon") {
					if (k === "segment") {
						if (p2[k] === p3[k]) {
							p[k] = p2[k];
						} else {
							p[k] = 0;
						}
					} else if (isNumeric(p2[k]) && isNumeric(p3[k])) {
						p[k] = (1 - f) * p2[k] + f * p3[k];
					} else {
						p[k] = p2[k];
					}
				}
			}
		}
	}
	return points;
}

/**
 * remove duplicate points of the same segment, and reduce point triplets
 * @param {Array} points - Array of points to process
 * @param {number} isLoop - Whether the track is a loop (0 or 1)
 * @returns {Array} New array of points with duplicates removed
 */
function removeDuplicatePoints(points, isLoop = 0) {
	note("removing duplicate points...");

	const pNew = [];
	let removedCount = 0;
	let i = 0;

	while (i <= maxIndex(points)) {
		const p = points[i];
		if (!p || p.lat === undefined) break;

		const lat0 = p.lat;
		const lng0 = p.lon;

		// Find all consecutive points with same coordinates
		let i1 = i;
		let iNext = (i1 + 1) % points.length;

		while (
			(iNext > i || (isLoop && iNext !== i)) &&
			Math.abs(points[iNext].lat - lat0) < 1e-9 &&
			Math.abs(points[iNext].lon - lng0) < 1e-9 &&
			(iNext + 1) % points.length !== i
		) {
			i1 = iNext;
			iNext = (iNext + 1) % points.length;
		}

		if (i1 === i) {
			// No duplicates, keep the point
			pNew.push({ ...p });
		} else {
			// Found duplicates - average them together
			if (removedCount === 0) {
				// Clean out derived fields on first removal
				deleteDerivedFields(points);
				deleteDerivedFields(pNew);
			}
			removedCount += i1 - i;

			const sum1 = {};
			const sum0 = {};
			const newPoint = { ...p };

			// Average numeric fields from duplicate points
			let j = i;
			while (j !== (i1 + 1) % points.length) {
				for (const key in points[j]) {
					if (
						key !== "segment" &&
						typeof points[j][key] !== "object" &&
						isNumeric(points[j][key])
					) {
						sum1[key] = (sum1[key] || 0) + parseFloat(points[j][key]);
						sum0[key] = (sum0[key] || 0) + 1;
					}
				}
				j = (j + 1) % points.length;
			}

			// Apply averages to new point
			for (const key in sum1) {
				if (sum0[key] > 1) {
					newPoint[key] = sum1[key] / sum0[key];
				}
			}

			pNew.push(newPoint);

			// If we wrapped around, also replace the first point
			if (i1 < i) {
				pNew[0] = { ...newPoint };
				break;
			}
		}

		if (iNext < i) break;
		i = iNext;
	}

	if (removedCount > 0) {
		warn(`Removed ${removedCount} duplicate points`);
	}

	return pNew;
}

/**
 * Crop corners by removing points within a specified distance of sharp turns
 * @param {Object} options - Options object with points, cornerCrop, minRadians, maxRadians, start, end, isLoop
 * @returns {Array} New array with cropped corners
 */
function cropCorners(
	points,
	cornerCrop = 0,
	minRadians = PI / 3,
	maxRadians,
	start,
	end,
	isLoop = 0,
) {
	// Threshold distance for points aligning with corner point
	const epsilon = 0.01 + 0.05 * cornerCrop;

	// If arguments exclude any points or angles
	if (
		(maxRadians !== undefined &&
			minRadians !== undefined &&
			maxRadians < minRadians) ||
		(!isLoop && start !== undefined && end !== undefined && start > end)
	) {
		return points;
	}

	// Create a direction field
	addDirectionField(points, isLoop);

	// Find indices of corners meeting the cropping criteria
	const cropCorners = [];
	for (let i = 0; i <= maxIndex(points); i++) {
		if (!isLoop && (i === 0 || i === maxIndex(points))) continue;

		const p0 = points[(i - 1 + points.length) % points.length];
		const p1 = points[i];
		const p2 = points[(i + 1) % points.length];
		const a = latlngAngle(p0, p1, p2);
		const absA = a !== null ? Math.abs(a) : 0;

		if (absA >= minRadians && (maxRadians === undefined || absA < maxRadians)) {
			cropCorners.push(i);
		}
	}

	if (cropCorners.length === 0) return points;

	// Add a distance field if needed
	if (
		points[0].distance === undefined &&
		(start !== undefined || end !== undefined)
	) {
		addDistanceField(points);
	}

	// Corners which are too close get pruned
	const dMin = 2 * cornerCrop;
	const courseDistance = calcCourseDistance(points, isLoop);

	const cc = [];
	for (let ic = 0; ic < cropCorners.length; ic++) {
		const d = points[cropCorners[ic]].distance;
		let dPrev;
		if (!isLoop && ic === 0) {
			dPrev = 0;
		} else {
			dPrev =
				points[cropCorners[(ic - 1 + cropCorners.length) % cropCorners.length]]
					.distance;
			if (ic === 0) dPrev -= courseDistance;
		}

		let dNext;
		if (!isLoop && ic === cropCorners.length - 1) {
			dNext = points[maxIndex(points)].distance;
		} else {
			dNext = points[cropCorners[(ic + 1) % cropCorners.length]].distance;
			if (ic === cropCorners.length - 1) dNext += courseDistance;
		}

		// Pass criteria:
		// 1. point is in limits defined by start and/or stop
		// 2. corner is sufficiently far from neighbor corners
		let inLimits = true;
		if (start !== undefined) {
			if (end !== undefined) {
				if (isLoop && end < start) {
					inLimits = d >= end && d <= start;
				} else {
					inLimits = d <= end && d >= start;
				}
			} else {
				inLimits = d >= start;
			}
		} else {
			inLimits = end === undefined || d <= end;
		}

		const distanceCheck = dNext >= d + dMin && dPrev <= d - dMin;

		if (inLimits && distanceCheck) {
			cc.push(cropCorners[ic]);
		}
	}

	const finalCropCorners = cc;
	if (finalCropCorners.length === 0) return points;

	// We've identified corners to be cropped.
	// Insert points before and after, then eliminate points between the inserted points
	const pNew = [];

	// Wrap-around cropped corners
	let pointAdded = false;
	if (isLoop && !pointsAreClose(points[0], points[maxIndex(points)])) {
		pointAdded = true;
		points.push({ ...points[0] });
	}

	let ic = 0;
	let dc1 = points[finalCropCorners[ic]].distance - cornerCrop;
	dc1 -= courseDistance * Math.floor(dc1 / courseDistance);
	let dc2 = dc1 + 2 * cornerCrop;
	let i = 0;
	let p1 = points[i];
	let p2 = points[(i + 1) % points.length];

	pointsLoop: while (i < points.length) {
		// If it's point to point and we reached the last point, we're done
		if (!isLoop && i === maxIndex(points)) {
			pNew.push(points[i]);
			break;
		}

		let dp1 = p1.distance; // this point
		let dp2 = p2.distance; // next point
		if (dp2 < dp1) dp2 += courseDistance; // if wrap-around

		// If the first point is before or roughly coincident with the corner, it gets added
		if (dp1 <= dc1 + epsilon) {
			pNew.push(p1);
		}

		// If the next point is still before the crop interval, skip to next point
		if (dp2 < dc1 + epsilon) {
			i++;
			p1 = points[i];
			p2 = points[(i + 1) % points.length];
			continue;
		}

		// Next point > start of crop interval: interpolate a point if needed
		if (dc1 > dp1 + epsilon && dc1 < dp2 - epsilon) {
			p1 = interpolatePoint(
				points[i],
				points[(i + 1) % points.length],
				(dc1 - dp1) / (dp2 - dp1),
			);
			dp1 = dc1;
			pNew.push(p1);
		}

		// Skip points in crop interval
		while (dp2 < dc2 - epsilon) {
			if (i > maxIndex(points)) break pointsLoop;
			i++;
			p1 = p2;
			p2 = points[(i + 1) % points.length];
			dp1 = dp2;
			dp2 = p2.distance;
			if (dp2 < dp1) dp2 += courseDistance; // if wrap-around
		}

		// Handle exit point
		if (Math.abs(dp2 - dc2) < epsilon) {
			i++;
			p1 = p2;
			p2 = points[(i + 1) % points.length];
			dp1 = dp2;
			dp2 = p2.distance;
			if (dp2 < dp1) dp2 += courseDistance; // if wrap-around
		} else if (Math.abs(dp1 - dc2) > epsilon) {
			p1 = interpolatePoint(
				points[i],
				points[(i + 1) % points.length],
				(dc2 - dp1) / (dp2 - dp1),
			);
			dp1 = dc2;
		}

		// Skip to next corner point
		ic++;

		// Skip to next crop corner, else dump rest of points
		if (ic > finalCropCorners.length - 1) {
			if (!(pNew.length > 0 && pointsAreClose(pNew[pNew.length - 1], p1))) {
				pNew.push(p1);
			}
			pNew.push(...points.slice(i + 1));
			break;
		}

		// Set corner points for new corner
		dc1 = points[finalCropCorners[ic]].distance - cornerCrop;
		dc1 -= courseDistance * Math.floor(dc1 / courseDistance);
		dc2 = dc1 + 2 * cornerCrop;
	}

	if (pointAdded) {
		points.pop();
	}

	deleteDerivedFields(pNew);
	return pNew;
}

/**
 * adds splines to points
 * this can also be used for arc fitting
 * @param {Array} points - array of points to process
 * @param {number} minRadians - minimum angle for spline processing
 * @param {number} maxRadians - maximum angle for spline processing
 * @param {number} start - start distance (optional)
 * @param {number} end - end distance (optional)
 * @param {number} isLoop - whether the track is a loop (0 or 1)
 * @param {string} splineType - type of spline ("spline" or "arcFit")
 * @returns {Array} new array of points with splines added
 */
function addSplines(
	points,
	minRadians,
	maxRadians,
	start,
	end,
	isLoop = 0,
	splineType = "spline",
) {
	note(`starting ${splineType} processing...`);

	// create a direction field
	addDirectionField(points, isLoop);

	// add a distance field if needed
	if (!points[0].distance && (start !== undefined || end !== undefined)) {
		addDistanceField(points);
	}

	// find corners which meet spline criteria
	// two turns in the same direction, both less than max
	// assume sharper or single-point turns are intentional
	const pNew = [];
	const isArcFit = splineType === "arcFit";

	let count = 0;

	// i : first point on interpolation interval
	iLoop: for (let i = 0; i <= maxIndex(points); i++) {
		pNew.push(points[i]);

		// add points if appropriate
		// splines cannot be fit to first or last interval unless it's a loop
		if (isLoop || (i > 0 && i < maxIndex(points) - 1)) {
			const j = (i + 1) % points.length;
			if (pointsAreClose(points[i], points[j], 1)) {
				continue;
			}

			// if start and stop points are specified, then check these
			// both points i and j must pass the test
			if (start !== undefined && end !== undefined && end < start) {
				if (points[i].distance > start || points[j].distance > start) continue;
				if (points[i].distance < end || points[j].distance < end) continue;
			} else {
				if (
					start !== undefined &&
					(points[i].distance < start || points[j].distance < start)
				)
					continue;
				if (
					end !== undefined &&
					(points[i].distance > end || points[j].distance > end)
				)
					continue;
			}

			let k = (i - 1 + points.length) % points.length;
			while (pointsAreClose(points[i], points[k], 1)) {
				if (k === (isLoop ? j : 0)) continue iLoop;
				k = (k - 1 + points.length) % points.length;
			}

			let l = (j + 1) % points.length;
			while (pointsAreClose(points[j], points[l], 1)) {
				l = (l + 1) % points.length;
				if (isLoop) {
					if (l <= i && l >= k) continue iLoop;
				} else {
					if (l <= j) continue iLoop;
				}
			}
			if (isLoop) {
				if (l <= j && l >= k) continue;
			} else {
				if (l <= j) continue;
			}

			// turn angles
			const a1 = latlngAngle(points[k], points[i], points[j]);
			const a2 = latlngAngle(points[i], points[j], points[l]);
			if (a1 === null || a2 === null) continue;

			const turn = (a1 + a2) / 2;
			if (Math.abs(turn) > minRadians && Math.abs(turn) <= maxRadians) {
				let newPoints;
				if (isArcFit) {
					newPoints = arcFitInterpolation(
						points[k],
						points[i],
						points[j],
						points[l],
						minRadians,
					);
				} else {
					newPoints = splineInterpolation(
						points[i],
						points[j],
						points[i].heading,
						points[j].heading,
						minRadians,
					);
				}
				count += newPoints.length;
				for (const p of newPoints) {
					pNew.push(p);
				}
			}
		}
	}

	// remove distance field if we've added any points
	if (pNew.length > 0 && count > 0) {
		for (const field of ["direction", "distance"]) {
			if (pNew[0][field] !== undefined) {
				deleteField2(pNew, field);
			}
		}
	}

	return pNew;
}

/**
 * Calculate closest point on line segment from p1 to p2 to test point p3
 * @param {Array} p1 - First point [x, y]
 * @param {Array} p2 - Second point [x, y]
 * @param {Array} p3 - Test point [x, y]
 * @returns {Array} [f, d] where f is fraction along line, d is distance
 */
function xyPointOnLine(p1, p2, p3) {
	const [x1, y1] = p1;
	const [x2, y2] = p2;
	const [x3, y3] = p3;

	if (x1 === x2 && y1 === y2) {
		return [undefined, undefined];
	}

	const f =
		((y3 - y1) * (y2 - y1) + (x3 - x1) * (x2 - x1)) /
		((y2 - y1) ** 2 + (x2 - x1) ** 2);
	const d = Math.sqrt(
		(x1 - x3 + f * (x2 - x1)) ** 2 + (y1 - y3 + f * (y2 - y1)) ** 2,
	);

	return [f, d];
}

/**
 * checks whether px is on the line connecting p1 and p2
 * @param {Object} p1 - First point with {lat, lon} properties
 * @param {Object} p2 - Second point with {lat, lon} properties
 * @param {Object} px - Test point with {lat, lon} properties
 * @param {number} dmax - Maximum distance threshold (default 1m)
 * @returns {boolean} True if point is on the road segment
 */
function isPointOnRoad(p1, p2, px, dmax = 1) {
	// If point is "on" an endpoint (within 10 cm) then true
	if (pointsAreClose(p1, px) || pointsAreClose(p2, px)) {
		return true;
	}

	// Check if it is within the margin of the line
	const [dx1, dy1] = latlng2dxdy(px, p1);
	const [dx2, dy2] = latlng2dxdy(px, p2);
	const [f, d] = xyPointOnLine([dx1, dy1], [dx2, dy2], [0, 0]);

	return f !== undefined && d !== undefined && f >= 0 && f <= 1 && d <= dmax;
}

/**
 * a corner version of whether the point is on the road...
 * but requires more points.
 * given 4 points, takes a direction from p1 to p2
 * and a direction from p3 to p4
 * if the direction from p2 to px, and from px to p3, falls in
 * between the directions from p1 to p2 and from p2 to p3,
 * then it's compatible with being on the line
 * @param {Object} p1 - First reference point
 * @param {Object} p2 - Second reference point
 * @param {Object} p3 - Third reference point
 * @param {Object} p4 - Fourth reference point
 * @param {Object} px - Test point
 * @returns {boolean} True if point is on the road corner
 */
function isPointOnRoadCorner(p1, p2, p3, p4, px) {
	if (!px || !p2 || !p3) return false;

	if (pointsAreClose(px, p2) || pointsAreClose(px, p3)) {
		return true;
	}

	if (!p1 || !p4) return false;

	if (
		pointsAreClose(p2, p3) ||
		pointsAreClose(p1, p2) ||
		pointsAreClose(p3, p4)
	) {
		return false;
	}

	const d12 = latlngDirection(p1, p2);
	const d34 = latlngDirection(p3, p4);
	const d2x = latlngDirection(p2, px);
	const dx3 = latlngDirection(px, p3);

	// These angles are between -pi/2 and +pi/2
	const dA = deltaAngle(d12, d2x);
	const dB = deltaAngle(d12, dx3);
	const dC = deltaAngle(d12, d34);

	// If angles are monotonic, success
	return (dA >= 0 && dB >= dA && dC >= dB) || (dA <= 0 && dB <= dA && dC <= dB);
}

/**
 * do tests of if point i falls on the road in the range (j, k, l, m)
 * @param {Array} points - Array of points
 * @param {number} j - Point before first point
 * @param {number} k - First point
 * @param {number} l - Second point
 * @param {number} m - Point after second point
 * @param {number} i - Test point index
 * @param {number} d - Distance error margin
 * @returns {boolean} True if point passes road test
 */
function roadTest(points, j, k, l, m, i, d) {
	// First check to see if the point i falls in the range k .. l
	if (
		!(
			i > 0 &&
			k > 0 &&
			l > 0 &&
			i <= maxIndex(points) &&
			k <= maxIndex(points) &&
			l <= maxIndex(points)
		)
	) {
		return false;
	}

	if (isPointOnRoad(points[k], points[l], points[i], d)) {
		return true;
	}

	if (!(j > 0 && m > 0 && j <= maxIndex(points) && m <= maxIndex(points))) {
		return false;
	}

	const cornerResult = isPointOnRoadCorner(
		points[j],
		points[k],
		points[l],
		points[m],
		points[i],
	);

	return cornerResult;
}

/**
 * zig-zags: pairs of 180 degree turns within a certain distance are probably misplaced control points
 * this is just a warning for now... easy to fix if it's along a line, but what if it goes around a corner?
 * @param {Array} points - Array of points
 * @returns {Array} New array with zig-zags fixed
 */
function fixZigZags(points) {
	note("checking for zig-zags...");
	const dzigzag = 100;
	const UTurns = [];

	// Find all U-turns
	for (let i = 1; i <= maxIndex(points) - 1; i++) {
		if (UTurnCheck(points[i - 1], points[i], points[i], points[i + 1], -0.9)) {
			UTurns.push(i);
		}
	}

	addDistanceField(points);

	if (UTurns.length > 0) {
		let zigzagCount = 0;

		while (UTurns.length > 1) {
			const U1 = UTurns.shift();
			const U2 = UTurns[0];
			const p1 = points[U1];
			const p2 = points[U2];

			if (p2.distance - p1.distance < dzigzag) {
				warn(
					`WARNING: zig-zag found on points (0, 2, 3 ...) : ${U1} and ${U2} : ` +
						`${(0.001 * p1.distance).toFixed(4)} km: (${p1.lon}, ${p1.lat}) to ` +
						`${(0.001 * p2.distance).toFixed(4)} km: (${p2.lon}, ${p2.lat}) : ` +
						`separation = ${(p2.distance - p1.distance).toFixed(4)} meters`,
				);

				// Repairing zig-zags...
				// zig-zags are two U-turns within a specified distance
				// p1 -> p2 -> ... -> p3 -> p4
				// U-turn @ p2, and U-turn @ p3
				// 1. eliminate all points between p2 and p3
				// 2. as long as P3 has a U-turn, delete it... there will be a new P3
				// 3. as long as P2 has a U-turn, delete it...
				// 4. go back step 2 if we deleted any U-turns

				warn("repairing zig-zag...");
				let u = U1; // keep points up to u
				let v = U2 + 1; // keep points starting with v

				note(
					`DEBUG: initial u=${u}, initial v=${v}, points.length=${points.length}`,
				);

				while (
					v < maxIndex(points) &&
					UTurnCheck(points[u], points[v], points[v], points[v + 1])
				) {
					note(`DEBUG: extending v from ${v} to ${v + 1} due to UTurn check`);
					v++;
				}

				while (
					u > 0 &&
					UTurnCheck(points[u - 1], points[u], points[u], points[v])
				) {
					note(`DEBUG: extending u from ${u} to ${u - 1} due to UTurn check`);
					u--;
				}

				note(
					`DEBUG: final u=${u}, final v=${v}, eliminating points ${u + 1} to ${v - 1} (${v - u - 1} points)`,
				);
				warn(`eliminating ${v - u - 1} points`);
				zigzagCount++;

				const pNew = [...points.slice(0, u + 1), ...points.slice(v)];

				// If we ran out of points, something is wrong
				if (pNew.length < 2) {
					die("repairing zig-zags eliminated entire route");
				}

				points = pNew;

				// We've eliminated the next U-turn, so remove it
				UTurns.shift();

				// Adjust coordinates of remaining U-turns
				for (let i = 0; i < UTurns.length; i++) {
					UTurns[i] += u - v + 1;
				}

				// Get rid of obsolete U-turns
				while (UTurns.length > 0 && UTurns[0] < 0) {
					UTurns.shift();
				}
			}
		}

		// May need to redo distance if zig-zag repair
		if (zigzagCount > 0) {
			addDistanceField(points);
		}
	}

	return points;
}

/**
 * look for loops
 * @param {Array} points - Array of points
 * @param {number} isLoop - Whether route is a loop
 */
function findLoops(points, isLoop) {
	note("checking for loops...");
	const loopDistance = 100;

	// Add direction field: distance field was just calculated by zig-zag check
	addDirectionField(points, isLoop);

	let u = 0;
	let v = 0;
	const loopAngle = 0.7 * TWOPI;

	while (v < points.length - 1) {
		const p = points[u];

		// Find endpoint within loop distance
		while (
			v < points.length - 1 &&
			points[v + 1].distance < p.distance + loopDistance
		) {
			v++;
		}

		if (Math.abs(p.heading - points[v].heading) > loopAngle) {
			// Find starting point of loop
			while (
				u + 1 < v &&
				Math.abs(points[u + 1].heading - points[v].heading) > loopAngle
			) {
				u++;
			}

			warn(
				`WARNING: loop between distance: ` +
					`${(points[u].distance / 1000).toFixed(3)} km and ${(points[v].distance / 1000).toFixed(3)} km`,
			);

			u = v;
			continue;
		}
		u++;
	}

	// Clean up heading field
	deleteField(points, "heading");
}

/**
 * Apply lane shift to all points based on their shift field
 * @param {Array} points - Array of points with shift field
 * @param {number} isLoop - Whether this is a loop course
 * @returns {Array} New array of shifted points
 */
function applyLaneShift(points, isLoop) {
	if (!points.length) return points;

	const pNew = [];

	// create list of (x, y) coordinates
	const dxs = [];
	const dys = [];
	const dss = [];
	const ss = [0];
	const dirs = [];

	for (let i = 0; i < points.length; i++) {
		if (i > 0) ss.push(ss[ss.length - 1] + dss[dss.length - 1]);
		if (isLoop || i < maxIndex(points)) {
			const [dx, dy] = latlng2dxdy(points[i], points[(i + 1) % points.length]);
			dxs.push(dx);
			dys.push(dy);
			dss.push(Math.sqrt(dx ** 2 + dy ** 2));
			dirs.push(Math.atan2(dy, dx));
		}
	}

	// final point for point-to-point
	if (!isLoop) {
		dxs.push(dxs[dxs.length - 1]);
		dys.push(dys[dys.length - 1]);
		dss.push(dss[dss.length - 1]);
		dirs.push(dirs[dirs.length - 1]);
	}

	// lane shift: to right, which means adding pi/2 to the direction
	for (let i = 0; i < points.length; i++) {
		let dir1, dir2;
		if (i > 0 || isLoop) {
			dir1 = dirs[wrapIndex(i - 1, dirs.length)];
			dir2 = dir1 + reduceAngle(dirs[i] - dir1);
		} else {
			dir1 = dirs[i];
			dir2 = dirs[i];
		}

		// for sharp turns repeat a point: there's no way to decide if it's an "inside" or "outside" sharp turn
		if (
			(isLoop || (i > 0 && i < maxIndex(points))) &&
			Math.abs(dir2 - dir1) > 0.99 * PI
		) {
			const pTurns = [];
			for (const dir of [dir1, dir2]) {
				pTurns.push(shiftPoint(points[i], dir, points[i].shift || 0));
			}
			// check if there's a knot.. if not use the doubled points
			const fs = segmentIntercept(
				[points[wrapIndex(i - 1, points.length)], pTurns[0]],
				[pTurns[1], points[(i + 1) % points.length]],
			);
			if (fs.length === 0) {
				pNew.push(...pTurns);
				continue;
			}
		}

		pNew.push(shiftVertex(points[i], [dir1, dir2], points[i].shift || 0));
	}

	deleteDerivedFields(pNew);
	return pNew;
}

/**
 * Smoothing function that applies Gaussian smoothing to specified fields
 * @param {Array} points - Array of points to smooth
 * @param {Array} fields - Fields to smooth (e.g., ["lat", "lon"], ["ele"], ["gradient"])
 * @param {number} isLoop - Whether the track is a loop (0 or 1)
 * @param {string} sigmaField - Name of field containing per-point sigma values (optional)
 * @param {number} sigmaFactor - Factor to scale sigma field values (default: 1)
 * @param {number} sigma - Uniform smoothing sigma value (default: 0)
 * @param {Array} weighting - Per-point weighting array (optional)
 * @param {number} cornerEffect - Corner effect factor (default: 0)
 * @returns {Array} New array of smoothed points
 */
function smoothing(
	points,
	fields,
	isLoop = 0,
	sigmaField = "",
	sigmaFactor = 1,
	sigma = 0,
	weighting = [],
	cornerEffect = 0,
) {
	const sigma02 = sigma ** 2;

	note("smoothing proc called...");
	note(`smoothing ${fields.join(",")} with σ = ${sigma}`);
	if (sigmaField !== "") {
		note(`smoothing sigma field = ${sigmaField}`);
	}

	if (
		!(
			fields.length > 0 &&
			(sigma > 0 || (sigmaField && sigmaField !== "" && sigmaFactor > 0))
		)
	) {
		return points;
	}

	const pNew = [];

	if (cornerEffect && points[0].curvature === undefined) {
		addCurvatureField(points, isLoop);
	}

	const useWeighting = weighting.length > 0;
	if (useWeighting) {
		note(`smoothing ${fields.join(",")} with weighting.`);
	}
	if (cornerEffect > 0) {
		note(
			`smoothing ${fields.join(",")} with the corner effect = ${cornerEffect}.`,
		);
	}

	// step thru the points
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const sigmap =
			p[sigmaField] !== undefined ? Math.abs(sigmaFactor * p[sigmaField]) : 0;
		const effectiveSigma =
			sigmap <= 0
				? sigma
				: sigma <= 0
					? sigmap
					: Math.sqrt(sigma02 + sigmap ** 2);

		// create smoothed data: initialize with unsmoothed data
		const newPoint = { ...p };

		if (effectiveSigma > 0) {
			let adjustedSigma = effectiveSigma;
			if (useWeighting && weighting[i] > 0) {
				adjustedSigma /= weighting[i];
			}

			if (adjustedSigma < 0.01) {
				pNew.push(p);
				continue;
			}

			const dsMax = Math.abs(4 * adjustedSigma);

			let j = i;
			let s = 0;
			while ((j > 0 || isLoop) && j > i - points.length && s < dsMax) {
				const p1 = points[wrapIndex(j, points.length)];
				const p2 = points[wrapIndex(j - 1, points.length)];
				const ds = latlngDistance(p1, p2);
				s += ds;

				// a 1 radian turn is the same as 2 sigma for cornerEffect = 1
				if (cornerEffect > 0) {
					s +=
						ds * cornerEffect * (p2.curvature + p1.curvature) * adjustedSigma;
				}
				j--;
			}

			s = 0;
			let k = i;
			while (
				(k < maxIndex(points) || isLoop) &&
				k < i + points.length &&
				s < dsMax
			) {
				const l = k % points.length;
				const m = (k + 1) % points.length;
				const ds = latlngDistance(points[l], points[m]);
				s += ds;
				if (cornerEffect > 0) {
					s +=
						ds *
						cornerEffect *
						(points[l].curvature + points[m].curvature) *
						adjustedSigma;
				}
				k++;
			}

			// create list of separations
			s = 0;
			const ss = [0];
			for (let ii = j; ii < k; ii++) {
				s += latlngDistance(
					points[wrapIndex(ii + 1, points.length)],
					points[wrapIndex(ii, points.length)],
				);
				ss.push(s);
			}

			let sum0 = 0;
			const sum1 = {};

			const us = [];

			// find normalized distance to center point
			for (let ii = 0; ii < ss.length; ii++) {
				us.push((ss[ii] - ss[i - j]) / adjustedSigma);
			}

			if (us.length < 2) {
				pNew.push(p);
				continue;
			}

			// linearized approximation
			// more sophisticated approach could use 2D convolution
			for (let ii = 0; ii < us.length; ii++) {
				const u = us[ii];
				const point = points[wrapIndex(j + ii, points.length)];

				// weight by distance
				let du = ii > 0 ? u - us[ii - 1] : 0;
				if (ii < us.length - 1) {
					du += us[ii + 1] - u;
				}
				const w = Math.exp(-(u ** 2) / 2) * du;
				sum0 += w;

				for (const field of fields) {
					sum1[field] = (sum1[field] || 0) + w * point[field];
				}
			}
			for (const field of fields) {
				if (sum0 !== 0) {
					newPoint[field] = sum1[field] / sum0;
				}
			}
		}
		pNew.push(newPoint);
	}

	// delete curvature field if we modified position
	if (
		fields.some((f) => f.startsWith("lat")) ||
		fields.some((f) => f.startsWith("lon"))
	) {
		deleteDerivedFields(pNew);
	}

	return pNew;
}

/**
 * Automatic spacing interpolation at corners to improve smoothing resolution
 * Iterates through points and adds interpolated points around sharp corners
 * to provide better smoothing resolution for subsequent processing
 * @param {Array} points - Array of points with lat, lon, ele properties
 * @param {boolean} isLoop - Whether the route is a closed loop
 * @param {number} lSmooth - Smoothing length parameter
 * @param {number} smoothAngle - Smoothing angle threshold in degrees
 * @param {number} minRadius - Minimum radius constraint
 * @returns {Array} Modified points array with additional interpolated points
 */
function doAutoSpacing(points, isLoop, lSmooth, smoothAngle, minRadius) {
	const smoothRadians = smoothAngle * DEG2RAD;

	// iterate a few times
	for (
		let autoSpacingIteration = 0;
		autoSpacingIteration <= 0;
		autoSpacingIteration++
	) {
		// do this in each direction
		for (let direction = 0; direction <= 1; direction++) {
			const pNew = [];

			// refine distance -- need to exceed the smoothing length
			// on spacing: minRadius will increase the separation of points,
			// so we need to be careful how we consider this
			const lambda = Math.sqrt(1 + lSmooth ** 2);
			const dRefine = 3 * Math.sqrt(lSmooth ** 2 + minRadius ** 2);

			iLoop: for (let i = 0; i <= maxIndex(points); i++) {
				pNew.push(points[i]); // temporarily put the latest point on the new points list

				// there's nothing behind the first point -- copy it to the last point to get refinement
				if (i === 0) {
					continue;
				}

				if (isLoop || i < maxIndex(points)) {
					// find points which define an angle
					let i1 = wrapIndex(i - 1, points.length);
					let i2 = (i + 1) % points.length;
					let d1;
					let d2;

					while ((d1 = latlngDistance(points[i1], points[i])) < 0.01) {
						i1--;
						if ((!isLoop && i1 < 0) || i1 === i) {
							continue iLoop;
						}
						i1 = ((i1 % points.length) + points.length) % points.length;
					}

					while ((d2 = latlngDistance(points[i2], points[i])) < 0.01) {
						i2++;
						if ((!isLoop && i2 > maxIndex(points)) || i2 === i) {
							continue iLoop;
						}
						i2 = i2 % points.length;
					}

					// determine the angle between the points
					const a = latlngAngle(points[i1], points[i], points[i2]);

					// add points if needed
					if (smoothRadians === undefined) {
						die(
							`ERROR: smoothRadians not defined (smoothAngle = ${smoothAngle})`,
						);
					}

					if (Math.abs(a) > Math.abs(smoothRadians)) {
						// refine spacing -- need to refine to sufficient resolution to resolve the angle
						// this was multiplied by 0.5, but that generated too many points, so updating
						const spacing = lambda * (0.01 + Math.abs(smoothRadians / a));

						// tricky bit -- we need to insert points back to the desired range, but that may extend earlier than points
						// which we've already placed, so we'll need to keep track of points as we rewind.

						// find interval on which to add first point
						let s = 0;
						let i3 = maxIndex(pNew);
						const ds = [];
						ds[i3] = 0;

						while (s < dRefine) {
							if (i3 <= 0) {
								break;
							}
							i3--;
							ds[i3] = latlngDistance(pNew[i3], pNew[i3 + 1]);
							s += ds[i3];
						}

						// find the start point, between point i3 and i3 + 1
						let f;
						if (s > dRefine) {
							f = (s - dRefine) / ds[i3]; // how far over the segment goes
						} else {
							f = 0;
						}

						// strip off the points beyond i3, to save for later
						const pStack = [];
						while (maxIndex(pNew) > i3) {
							pStack.push(pNew.pop());
						}

						// add first point for corner smoothing, unless another point is close
						const ff = (0.5 * spacing) / ds[maxIndex(pNew)]; // normalized spacing of new points
						if (f > ff && f < 1 - ff) {
							pNew.push(
								interpolatePoint(
									pNew[maxIndex(pNew)],
									pStack[maxIndex(pStack)],
									f,
								),
							);
							// adjust spacing to next point to account for interpolated point
							ds[maxIndex(pNew)] = ds[maxIndex(pNew) - 1] * (1 - f);
							ds[maxIndex(pNew) - 1] *= f;
						}

						// go thru points in stack, and adjust spacings
						while (pStack.length > 0) {
							const p1 = pNew[maxIndex(pNew)];
							const p2 = pStack[maxIndex(pStack)];
							const dsTot = latlngDistance(p1, p2);
							const N = Math.round(dsTot / spacing);

							if (N > 0) {
								ds[maxIndex(pNew)] = dsTot / N;
								for (let n = 1; n <= N - 1; n++) {
									pNew.push(interpolatePoint(p1, p2, n / N));
									ds[maxIndex(pNew)] = dsTot / N;
								}
							} else {
								ds[maxIndex(pNew)] = dsTot;
							}
							pNew.push(pStack.pop());
							ds[maxIndex(pNew)] = 0;
						}
					}
				}
			}
			points = pNew.slice().reverse();
		}
	}
	return points;
}

/**
 * Interpolates points along a route to achieve consistent spacing
 * @param {Array} points - Array of points with lat, lon, ele properties
 * @param {number} isLoop - Whether this is a loop route (1) or point-to-point (0)
 * @param {number} spacing - Desired spacing between points in meters
 * @returns {Array} Array with interpolated points added
 */
function doPointInterpolation(points, isLoop, spacing) {
	note("interpolation..");
	const pNew = [];
	const iMax = maxIndex(points) - (isLoop ? 0 : 1);

	for (let i = 0; i <= iMax; i++) {
		const p1 = points[i];
		const p2 = points[(i + 1) % points.length];
		pNew.push(p1);

		const ps = latlngDistance(p1, p2);
		const npoints = int(ps / spacing + 0.5);

		// interpolate points...
		for (let n = 1; n <= npoints - 1; n++) {
			pNew.push(interpolatePoint(p1, p2, n / npoints));
		}
	}

	if (!isLoop) {
		pNew.push(points[points.length - 1]);
	}

	note(
		`interpolation increased course from ${points.length} to ${pNew.length} points`,
	);
	return pNew;
}

/**
 * Snap overlapping segments of a GPS track to align with earlier segments
 * @param {Array} points - Array of GPS points with lat, lon, ele properties
 * @param {Array} snap - Reference points to snap to (usually same as points)
 * @param {number} snapDistance - Maximum distance threshold for snapping (default: 2m)
 * @param {number} snapAltitude - Maximum altitude difference for snapping (default: 1m)
 * @param {number} snapTransition - Distance for altitude transition smoothing (default: 0m)
 * @param {number} spacing - Point spacing parameter (default: 0)
 * @returns {Array} New array with snapped points
 */
function snapPoints(
	points,
	snap,
	snapDistance = 2,
	snapAltitude = 1,
	snapTransition = 0,
	spacing = 0,
) {
	if (!points.length) return points;

	// Ensure distance field exists
	addDistanceField(points);

	// snap = 1: subsequent laps snap to position of earlier laps
	// snap = 2: earlier laps snap to position of later laps
	// snap 2 can be handled by reversing points, then doing snap, then reversing back

	// If we're snapping later for earlier, flip points
	if (snap === 2) {
		points.reverse();
	}

	// On large courses, since initial search is O(N-squared), step thru multiple points, then refine
	// Snap step 1 has a potential bug (infinite loop) so lower bound is 2
	const snapStep = 2 + int(points.length / 200);

	// Maximum range at which we check for snapping...
	// so if colinear points are spaced more than twice this, we may miss snapping onto that interval
	let snapRange = spacing > 0 ? snapStep * spacing : 100;
	snapRange = Math.min(snapRange, 100);

	// Threshold for checking if points are close for snapping
	const dsClose = snapDistance / 2;

	// i is on the "earlier" segment, j on the "later" segment
	// note this excludes starting point and end point
	iLoop: for (let i = 0; i < maxIndex(points) - 1; i += snapStep) {
		const p1 = points[i];
		const visited = new Set();

		let j = i + snapStep;
		if (j > maxIndex(points)) continue;

		// Get out of snap range: get point j beyond the snap range of point i
		// This is geometric distance, not course distance, which could potentially be an issue
		let d = 0;
		while ((d = latlngDistance(p1, points[j])) <= snapRange) {
			j += snapStep;
			if (j >= maxIndex(points)) continue iLoop;
		}

		// Keep going until distance between j and i stops increasing
		while (j <= maxIndex(points)) {
			const d2 = latlngDistance(p1, points[j]);
			if (d2 < d) break;
			d = d2;
			j += snapStep;
			if (j >= maxIndex(points)) continue iLoop;
		}

		// Keep moving until j comes back into snap range of i
		jLoop1: while (j <= maxIndex(points)) {
			// Make sure we don't try the same value twice (moving forward and backward could cause this)
			if (visited.has(j)) continue iLoop;
			visited.add(j);

			// Looking for j sufficiently close to i and connected with less than a 30% slope
			// Slope requirement avoids snapping across tight switchbacks or a hypothetical "spiral"
			while (
				(d = latlngDistance(p1, points[j])) > snapRange ||
				Math.abs(p1.ele - points[j].ele) > snapAltitude + 0.3 * d
			) {
				j += snapStep;
				if (j >= maxIndex(points)) continue iLoop;
			}

			// Find local minimum of distance... reduced step distance to 1
			while (j <= maxIndex(points)) {
				d = latlngDistance(p1, points[j]);

				// Distance to point forward
				const df =
					j < maxIndex(points) ? latlngDistance(p1, points[j + 1]) : undefined;
				// Distance to point backward
				const db = j > 0 ? latlngDistance(p1, points[j - 1]) : undefined;

				if (df !== undefined && df < d) {
					j++;
					continue;
				}
				if (db !== undefined && db < d) {
					j--;
					continue;
				}
				break;
			}

			// We've now brought point j close to point i. This could be fooled with a sufficiently complicated
			// route, but so far it seems to work fairly well

			// Check altitude. If altitude is out of range, maybe we're across a tight switchback, or there's a bridge or tunnel
			// This was already done previously, but now we're closer
			if (Math.abs(p1.ele - points[j].ele) > 1 + 0.3 * d) {
				j += snapStep;
				continue;
			}

			// We've got a possible point match between two points.
			// Check dot products - the lines need to be in similar directions

			// Set direction for checking dot product
			let di = 0;
			if (j < maxIndex(points) && i < maxIndex(points)) {
				di = 1;
			} else if (j > 0 && i > 0) {
				di = -1;
			} else {
				continue iLoop;
			}

			const p2 = points[i + di];
			const p3 = points[j];
			const p4 = points[j + di];

			// Dot product
			// dot product = 1: same direction
			// dot product = -1: opposite direction
			// dot product close to zero: intersection, perhaps -- ignore
			// Set for 45 degree angle right now
			const dot = latlngDotProduct(p1, p2, p3, p4) ?? 0;
			let sign;
			if (dot > 0.7) {
				sign = 1;
			} else if (dot < -0.7) {
				sign = -1;
			} else {
				// Vectors are relatively perpendicular, move on
				j += snapStep;
				continue;
			}

			// Point i is matched to point j, and the two are moving in the same direction
			// For each point j, if it falls on a line of points i, then replace the nearest point i
			// First we need to find values of j which are encapsulated by i
			// j will be replaced by i
			let ja, jb;

			jLoop2_2: while (true) {
				// Search range near j: j was point nearest i so it should be close
				// Nearest found the nearest point, but we're looking for the segment,
				// and the nearest point may not mark the intersecting segment, so check proximity
				for (ja of [j, j - sign, j + sign, j - 2 * sign]) {
					jb = ja + sign;

					// Checking if point i falls on the line between ja and jb
					if (roadTest(points, ja - 1, ja, jb, jb + 1, i, snapDistance)) {
						j = jb;
						break jLoop2_2;
					}
				}
				// Didn't find a match... move to next point
				continue iLoop;
			}

			let j1 = j - sign;
			let j2 = j;

			// Starting point:
			// j1 ... i1 ... i2 ... j2
			// i's are encapsulated by j's
			// Initial point is we have only a single point i1 = i2 = i
			// j2 = j1 + 1

			let i1 = i;
			let i2 = i;

			// Keep shifting boundaries until we don't expand them anymore
			let flag1, flag2;

			do {
				// Shift i1 down as long as along line from j1 to j2
				while (
					i1 > 0 &&
					roadTest(points, j1 - sign, j1, j2, j2 + sign, i1 - 1, snapDistance)
				) {
					i1--;
				}

				// As long as they are coincident, increase i1 and j1 together (short cut)
				while (
					i1 > 0 &&
					j1 > i2 &&
					j1 < maxIndex(points) &&
					pointsAreClose(
						points[i1 - 1],
						points[j1 - sign],
						dsClose,
						snapAltitude,
					)
				) {
					i1--;
					j1 -= sign;
				}

				// Shift up i2 as long as along line from j1 to j2
				while (
					i2 < j1 &&
					roadTest(points, j1 - sign, j1, j2, j2 + sign, i2 + 1, snapDistance)
				) {
					i2++;
				}

				// As long as they are coincident, increase i2 and j2 together (short cut)
				while (
					i2 < j1 &&
					j2 > i2 &&
					j2 < maxIndex(points) &&
					pointsAreClose(
						points[i2 + 1],
						points[j2 + sign],
						dsClose,
						snapAltitude,
					)
				) {
					i2++;
					j2 += sign;
				}

				flag1 = false;
				const iTest = i1 - 1;
				if (iTest > 0) {
					// Push jTest up against iTest
					let jTest = j1;
					while (
						jTest > i2 &&
						jTest <= maxIndex(points) &&
						roadTest(
							points,
							iTest - 1,
							iTest,
							iTest + 1,
							iTest + 2,
							jTest - sign,
							snapDistance,
						)
					) {
						jTest -= sign;
					}

					// Hop jTest past iTest: test that iTest lays in line of j points
					if (
						jTest > i2 &&
						jTest <= maxIndex(points) &&
						(flag1 = roadTest(
							points,
							jTest - 2 * sign,
							jTest - sign,
							jTest,
							jTest + sign,
							iTest,
							snapDistance,
						))
					) {
						jTest -= sign;
					}

					if (flag1) {
						j1 = jTest;
						i1 = iTest;
					}
				}

				flag2 = false;
				const iTest2 = i2 + 1;
				if (iTest2 >= j1) {
					let jTest = j2;

					// Push jTest up against iTest2 (it's between j2 and jTest)
					while (
						jTest > iTest2 &&
						jTest <= maxIndex(points) &&
						roadTest(
							points,
							iTest2 - 2,
							iTest2 - 1,
							iTest2,
							iTest2 + 1,
							jTest + sign,
							snapDistance,
						)
					) {
						jTest += sign;
					}

					// Hop past iTest2
					if (
						jTest > iTest2 &&
						jTest <= maxIndex(points) &&
						(flag2 = roadTest(
							points,
							jTest - sign,
							jTest,
							jTest + sign,
							jTest + 2 * sign,
							iTest2,
							snapDistance,
						))
					) {
						jTest += sign;
					}

					if (flag2) {
						j2 = jTest;
						i2 = iTest2;
					}
				}
			} while (flag1 || flag2);

			// Splice in the snapped points
			// irange encapsulates j range
			// May need to retain outer points of j range if they're not duplicated by points in irange

			// Avoid duplicate points at ends of range
			// This is the same independent of sign: i1 connects with j1, i2 connects with j2
			while (i1 < i2 && pointsAreClose(points[i1], points[j1])) {
				i1++;
			}
			while (i2 > i1 && pointsAreClose(points[i2], points[j2])) {
				i2--;
			}

			if (i1 >= i2) {
				j += snapStep;
				continue;
			}

			if (sign === 0) {
				die("Zero sign encountered");
			}

			// Now check for zig-zags at start... algorithm shouldn't allow them.
			while (true) {
				const p1_zig = points[j1];
				const p2_zig = points[i1];
				const p3_zig = points[i1 + 1];
				if (p1_zig && p2_zig && p3_zig) {
					const dot_zig = latlngDotProduct(p1_zig, p2_zig, p2_zig, p3_zig);
					if (dot_zig !== null && dot_zig > -0.9) break;
				}
				i1++;
				if (i1 >= i2) {
					j += snapStep;
					continue jLoop1;
				}
			}

			// Now check for zig-zags at end... algorithm shouldn't allow them.
			while (true) {
				const p1_zig = points[j2];
				const p2_zig = points[i2];
				const p3_zig = points[i2 - 1];
				if (p1_zig && p2_zig && p3_zig) {
					const dot_zig = latlngDotProduct(p1_zig, p2_zig, p2_zig, p3_zig);
					if (dot_zig !== null && dot_zig > -0.9) break;
				}
				i2--;
				if (i1 >= i2) {
					j += snapStep;
					continue jLoop1;
				}
			}

			if (i2 > i1 && Math.abs(j2 - j1) > 0) {
				note(
					`i = ${i}, j = ${j}: snapping ${sign > 0 ? "forward" : "reverse"} segment: ${i1} .. ${i2} <=> ${j1} .. ${j2}`,
				);

				const pNew = [];
				if (sign > 0) {
					// Keep everything up to start of j range
					pNew.push(...points.slice(0, j1 + 1));

					// Splice in i range (exclude end-points)
					// Try to match up segments if possible
					// Segment matching by relative distance, but we need to nudge if we encounter a duplicate
					let j = j1;
					for (let i = i1; i <= i2; i++) {
						if (
							j < j2 &&
							Math.abs(points[i].distance - points[i - 1].distance) < 0.05
						) {
							j++;
						}

						while (
							j < j2 &&
							Math.abs(
								Math.abs(points[j + 1].distance - points[j1].distance) -
									Math.abs(points[i].distance - points[i1].distance),
							) <
								Math.abs(
									Math.abs(points[j].distance - points[j1].distance) -
										Math.abs(points[i].distance - points[i1].distance),
								)
						) {
							j++;
						}

						const p = { ...points[i] };
						p.segment = points[j].segment;
						pNew.push(p);
					}

					pNew.push(...points.slice(j2)); // Keep everything which follows j range
				} else {
					pNew.push(...points.slice(0, j2 + 1));

					let j = j2;
					for (let i = i2; i >= i1; i--) {
						if (
							j < j1 &&
							Math.abs(points[i].distance - points[i - 1].distance) < 0.05
						) {
							j++;
						}

						while (
							j < j1 &&
							Math.abs(
								Math.abs(points[j + 1].distance - points[j1].distance) -
									Math.abs(points[i].distance - points[i1].distance),
							) <
								Math.abs(
									Math.abs(points[j].distance - points[j1].distance) -
										Math.abs(points[i].distance - points[i1].distance),
								)
						) {
							j++;
						}

						const p = { ...points[i] };
						p.segment = points[j].segment;
						pNew.push(p);
					}

					pNew.push(...points.slice(j1));
				}

				points = pNew;
			}

			// Snap transition...
			// Adjust altitude...
			// The first pass goes from i1 to i2
			// The replaced portion goes from j3 to j4
			// For points beyond this range, transition the altitude
			// This presently does not work with loops
			if (snapTransition > 0) {
				const j3 = (sign > 0 ? j1 : j2) + 1;
				const j4 = j3 + i2 - i1 + 1;

				// d = 1: forward direction, -1: backward direction
				for (const d of [-1, 1]) {
					let s = 0;
					let i_trans = d > 0 ? i2 : i1;
					const sis = [0];
					const is = [i_trans];

					while (
						s < snapTransition &&
						i_trans > 0 &&
						i_trans < maxIndex(points)
					) {
						s += latlngDistance(points[i_trans], points[i_trans + d]);
						i_trans += d;
						sis.push(s);
						is.push(i_trans);
					}

					const jd = d * sign;
					let j_trans = jd > 0 ? j4 : j3;
					const sjs = [0];
					const js = [j_trans];

					s = 0;
					while (
						s < snapTransition &&
						j_trans > 0 &&
						j_trans < maxIndex(points)
					) {
						s += latlngDistance(points[j_trans], points[j_trans + jd]);
						j_trans += jd;
						sjs.push(s);
						js.push(j_trans);
					}

					// Step thru and adjust altitudes
					let u = 0;
					let v = 0;
					const zis = [points[is[0]].ele];
					const zjs = [points[js[0]].ele];

					while (u < sis.length - 1 && v < sjs.length - 1) {
						const _i = is[u];
						const _j = js[v];

						if (sis[u + 1] < sjs[v + 1]) {
							u++;
							// Interpolate the point onto the other interval
							const f = (sis[u] - sjs[v]) / (sjs[v + 1] - sjs[v]);
							const z0 =
								(1 - f) * points[js[v]].ele + f * points[js[v + 1]].ele;
							// Note: in limit of being close to the snapped section, altitude is average of two branches, then it diverges
							const g = (1 + Math.cos((PI * sis[u]) / snapTransition)) / 4; // From 0.5 to 0
							if (g < 0) die("Negative g!");
							const z1 = points[is[u]].ele;
							zis[u] = g * z0 + (1 - g) * z1;
						} else {
							v++;
							const f = (sjs[v] - sis[u]) / (sis[u + 1] - sis[u]);
							const z0 =
								(1 - f) * points[is[u]].ele + f * points[is[u + 1]].ele;
							const g = (1 + Math.cos((PI * sjs[v]) / snapTransition)) / 4; // From 0.5 to 0
							if (g < 0) die("Negative g!");
							// Note: in limit of being close to the snapped section, altitude is average of two branches, then it diverges
							const z1 = points[js[v]].ele;
							zjs[v] = g * z0 + (1 - g) * z1;
						}
					}

					// Assign the new elevations to the appropriate points
					for (let u_assign = 0; u_assign < zis.length; u_assign++) {
						points[is[u_assign]].ele = zis[u_assign];
					}
					for (let v_assign = 0; v_assign < zjs.length; v_assign++) {
						points[js[v_assign]].ele = zjs[v_assign];
					}
				}
			}
			// End of snap transition

			// Jump to next ivalue outside of range if we did replacement
			// This isn't perfect, but note points in j range are changed, so
			// j indices are no longer valid: this is why need to jump to outer loop
			if (i2 > i) {
				i = i2;
			}
			continue iLoop;
		}
	}

	if (snap === 2) {
		points.reverse();
	}

	return points;
}

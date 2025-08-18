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
 * Transition function: 1 (x = -1) to 1/2 (x = 0) to 0 (x = 1)
 * @param {number} x - Input value
 * @returns {number} Transition value
 */
function transition(x) {
	const PI2 = Math.atan2(1, 0); // π/2
	return x < -1 ? 1 : x > 1 ? 0 : (1 - Math.sin(x * PI2)) / 2;
}

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
 * Regular expression for matching numeric values (equivalent to Perl's $number_regexp)
 */
const NUMBER_REGEXP = /^[+-]?\d*(?:\d|(?:\.\d+))(?:[eE][-+]?\d+)?$/;

/**
 * Check if a value is numeric
 * @param {any} value - Value to check
 * @returns {boolean} True if numeric
 */
function isNumeric(value) {
	return typeof value === 'string' && NUMBER_REGEXP.test(value);
}

/**
 * Delete a field from all points in array
 * @param {Array} points - Array of points
 * @param {string} field - Field name to delete
 */
function deleteField({ points, field }) {
	if (!field) return;
	for (const p of points) {
		if (field in p) {
			delete p[field];
		}
	}
}

/**
 * Delete an extension field from all points in array
 * @param {Array} points - Array of points
 * @param {string} field - Extension field name to delete
 */
function deleteExtensionField({ points, field }) {
	if (!field) return;
	for (const p of points) {
		if (p.extensions && typeof p.extensions === 'object' && field in p.extensions) {
			delete p.extensions[field];
		}
	}
}

/**
 * Delete both regular and extension fields
 * @param {Array} points - Array of points
 * @param {string} field - Field name to delete
 */
function deleteField2({ points, field }) {
	deleteField({ points, field });
	deleteExtensionField({ points, field });
}

/**
 * Delete derived fields from points array
 * @param {Array} points - Array of points
 * @param {Array} fields - Fields to delete (default: curvature, distance, gradient, heading)
 */
function deleteDerivedFields(points, fields = ["curvature", "distance", "gradient", "heading"]) {
	for (const field of fields) {
		deleteField2({ points, field });
	}
}

/**
 * Remove duplicate points that have identical lat/lon coordinates
 * @param {Object} options - Options object with points and isLoop properties
 * @returns {Array} New array of points with duplicates removed
 */
function removeDuplicatePoints({ points, isLoop = 0 }) {
	note("removing duplicate points...");
	
	const pNew = [];
	let removedCount = 0;
	let i = 0;
	
	while (i < points.length) {
		const p = points[i];
		if (!p || p.lat === undefined) break;
		
		const lat0 = p.lat;
		const lng0 = p.lon;
		
		// Find all consecutive points with same coordinates
		let i1 = i;
		let iNext = (i1 + 1) % points.length;
		
		while (
			((iNext > i) || (isLoop && iNext !== i)) &&
			Math.abs(points[iNext].lat - lat0) < 1e-9 &&
			Math.abs(points[iNext].lon - lng0) < 1e-9 &&
			((iNext + 1) % points.length !== i)
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
			removedCount += (i1 - i);
			
			const sum1 = {};
			const sum0 = {};
			const newPoint = { ...p };
			
			// Average numeric fields from duplicate points
			let j = i;
			while (j !== (i1 + 1) % points.length) {
				for (const key in points[j]) {
					if (key !== "segment" && 
						typeof points[j][key] !== 'object' && 
						isNumeric(points[j][key])) {
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
		console.warn(`Removed ${removedCount} duplicate points`);
	}
	
	return pNew;
}

/**
 * Add distance field to points array (cumulative distance from start)
 * @param {Array} points - Array of points
 */
function addDistanceField({ points }) {
	if (!points.length) return;
	points[0].distance = 0;
	for (let i = 1; i < points.length; i++) {
		points[i].distance = points[i - 1].distance + latlngDistance(points[i - 1], points[i]);
	}
}

/**
 * Calculate total course distance
 * @param {Object} options - Options object with points and isLoop properties
 * @returns {number} Total distance in meters
 */
function calcCourseDistance({ points, isLoop }) {
	if (!points.length) return 0;
	if (points[points.length - 1].distance === undefined) {
		addDistanceField({ points });
	}
	let distance = points[points.length - 1].distance;
	if (isLoop && points.length > 1) {
		distance += latlngDistance(points[points.length - 1], points[0]);
	}
	return distance;
}

/**
 * Interpolate point between two points at fraction f
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
				newPoint[k] = (f < 0.5) ? p1[k] : p2[k];
			}
		}
	}
	return newPoint;
}

/**
 * Crop points based on distance ranges and delete ranges
 * @param {Object} options - Options object with points, isLoop, deleteRange, min, max
 * @returns {Array} New array of cropped points
 */
function cropPoints({ points, isLoop = 0, deleteRange = [], min: cropMin, max: cropMax }) {
	const ranges = [];
	
	const courseDistance = calcCourseDistance({ points, isLoop });
	
	// If cropMin and cropMax are reversed, treat them as a delete range
	if (cropMin !== undefined && cropMax !== undefined && cropMax < cropMin) {
		ranges.push([cropMax, cropMin]);
		cropMin = undefined;
		cropMax = undefined;
	}
	
	// Process deleteRange pairs
	for (let i = 0; i < deleteRange.length; i += 2) {
		let r1 = deleteRange[i];
		let r2 = deleteRange[i + 1];
		
		// Points reversed: acts like cropMin, cropMax
		if (r1 === undefined || r2 === undefined || r2 < r1) {
			if (r1 !== undefined && (cropMax === undefined || r1 < cropMax)) {
				cropMax = r1;
			}
			if (r2 !== undefined && (cropMin === undefined || r2 > cropMin)) {
				cropMin = r2;
			}
		} else {
			// Check to see if range overlaps beginning or end of the course
			let s1 = points[0].distance;
			if (cropMin !== undefined && cropMin > s1) s1 = cropMin;
			let s2 = courseDistance;
			if (cropMax !== undefined && cropMax < s2) s2 = cropMax;
			
			// Skip if range outside of course
			if ((r1 < s1 && r2 < s1) || (r1 > s2 && r2 > s2)) continue;
			
			// Adjust crop limits if range overlaps edge of course
			let overlap = 0;
			if (r1 < s1) {
				cropMin = r2;
				overlap++;
			}
			if (r2 > s2) {
				cropMax = r1;
				overlap++;
			}
			if (overlap) continue;
			
			// Check if existing points overlap any ranges so far
			let doOverlaps = true;
			while (doOverlaps) {
				doOverlaps = false;
				for (let j = 0; j < ranges.length; j++) {
					const r = ranges[j];
					const r3 = r[0];
					const r4 = r[1];
					
					let rangeOverlap = 0;
					// New range straddles beginning of old range
					if (r1 < r3 && r2 > r3) {
						rangeOverlap++;
						if (r4 > r2) r2 = r4;
					} else if (r2 < r4 && r2 > r4) {
						// Extend existing range
						r1 = r3;
						rangeOverlap++;
					}
					
					// If overlap, delete the existing range and continue
					if (rangeOverlap) {
						ranges.splice(j, 1);
						doOverlaps = true;
						break;
					}
				}
			}
			ranges.push([r1, r2]);
		}
	}
	
	if (cropMin !== undefined || cropMax !== undefined) {
		note("cropping ", 
			cropMin !== undefined ? `from ${cropMin} ` : "",
			cropMax !== undefined ? `to ${cropMax} ` : "", 
			"meters...");
	}
	
	for (const r of ranges) {
		note(`deleting range from ${r[0]} meters to ${r[1]} meters.`);
	}
	
	// Interpolate needed points
	const interpolatePoints = [];
	if (cropMin !== undefined) interpolatePoints.push(cropMin);
	if (cropMax !== undefined) interpolatePoints.push(cropMax);
	for (const r of ranges) {
		if (r[0] !== undefined) interpolatePoints.push(r[0]);
		if (r[1] !== undefined) interpolatePoints.push(r[1]);
	}
	
	const pNew = [];
	let s;
	
	pointLoop: for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const sPrev = s;
		s = p.distance;
		
		// Add interpolated points if needed
		for (const s0 of interpolatePoints) {
			if (i > 0 && s0 > 0 && s > s0 && sPrev < s0) {
				const ds = s - sPrev;
				const f = (s0 - sPrev) / ds;
				const d1 = f * ds;
				const d2 = (1 - f) * ds;
				if (d1 > 0.01 && d2 > 0.01) {
					pNew.push(interpolatePoint(points[i - 1], p, f));
				}
			}
		}
		
		// Skip points outside crop bounds
		if (cropMin !== undefined && s < cropMin) continue pointLoop;
		if (cropMax !== undefined && s > cropMax) continue pointLoop;
		
		// Skip points inside delete ranges
		for (const r of ranges) {
			if (s > r[0] && s < r[1]) continue pointLoop;
		}
		
		pNew.push(p);
	}
	
	deleteDerivedFields(pNew);
	return pNew;
}

/**
 * Check whether two segments are in opposite direction (U-turn check)
 * @param {Object} p1 - First point of first segment
 * @param {Object} p2 - Second point of first segment  
 * @param {Object} p3 - First point of second segment
 * @param {Object} p4 - Second point of second segment
 * @param {number} dotMax - Maximum dot product threshold (default -0.98)
 * @returns {boolean} True if segments form a U-turn
 */
function UTurnCheck(p1, p2, p3, p4, dotMax = -0.98) {
	const d = latlngDotProduct(p1, p2, p3, p4);
	return d !== null && d < dotMax;
}

/**
 * Fix zig-zag patterns in route by detecting and removing U-turn sequences
 * @param {Array} points - Array of points
 * @returns {Array} New array with zig-zags fixed
 */
function fixZigZags(points) {
	note("checking for zig-zags...");
	const dzigzag = 100;
	const UTurns = [];
	
	// Find all U-turns
	for (let i = 1; i < points.length - 1; i++) {
		if (UTurnCheck(points[i - 1], points[i], points[i], points[i + 1], -0.9)) {
			UTurns.push(i);
		}
	}
	
	addDistanceField({ points });
	
	if (UTurns.length > 0) {
		let zigzagCount = 0;
		
		while (UTurns.length > 1) {
			const U1 = UTurns.shift();
			const U2 = UTurns[0];
			const p1 = points[U1];
			const p2 = points[U2];
			
			if (p2.distance - p1.distance < dzigzag) {
				console.warn(`WARNING: zig-zag found on points (0, 2, 3 ...) : ${U1} and ${U2} : ` +
					`${(0.001 * p1.distance).toFixed(4)} km: (${p1.lon}, ${p1.lat}) to ` +
					`${(0.001 * p2.distance).toFixed(4)} km: (${p2.lon}, ${p2.lat}) : ` +
					`separation = ${(p2.distance - p1.distance).toFixed(4)} meters`);
				
				// Repairing zig-zags...
				// zig-zags are two U-turns within a specified distance
				// p1 -> p2 -> ... -> p3 -> p4
				// U-turn @ p2, and U-turn @ p3
				// 1. eliminate all points between p2 and p3
				// 2. as long as P3 has a U-turn, delete it... there will be a new P3
				// 3. as long as P2 has a U-turn, delete it...
				// 4. go back step 2 if we deleted any U-turns
				
				console.warn("repairing zig-zag...");
				let u = U1;            // keep points up to u
				let v = U2 + 1;        // keep points starting with v
				
				while (v < points.length - 1 && 
					   UTurnCheck(points[u], points[v], points[v], points[v + 1])) {
					v++;
				}
				
				console.warn(`eliminating ${v - u - 1} points`);
				zigzagCount++;
				
				const pNew = [...points.slice(0, u + 1), ...points.slice(v)];
				
				// If we ran out of points, something is wrong
				if (pNew.length < 2) {
					throw new Error("repairing zig-zags eliminated entire route");
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
			addDistanceField({ points });
		}
	}
	
	return points;
}

/**
 * Calculate direction from p1 to p2 in radians
 * @param {Object} p1 - First point
 * @param {Object} p2 - Second point
 * @returns {number} Direction in radians (0 = east, π/2 = north)
 */
function latlngDirection(p1, p2) {
	const [dx, dy] = latlng2dxdy(p1, p2);
	return Math.atan2(dy, dx);
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
 * Calculate direction of point p2 as average of adjacent segments
 * @param {Object} p1 - Previous point
 * @param {Object} p2 - Current point
 * @param {Object} p3 - Next point
 * @returns {number} Direction in radians
 */
function pointDirection(p1, p2, p3) {
	return averageAngles(latlngDirection(p1, p2), latlngDirection(p2, p3));
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
	const dz = (p1.ele !== undefined && p2.ele !== undefined) ? (p2.ele - p1.ele) : 0;
	return Math.abs(dz) < zMax && latlngDistance(p1, p2) < sMax;
}

/**
 * Add direction (heading) field to all points
 * @param {Object} options - Options object with points and isLoop properties
 */
function addDirectionField({ points, isLoop = 0 }) {
	if (!points.length) return;
	
	let u = isLoop ? points.length - 1 : 0;
	let v = 0;
	let w = 1;
	let dPrev;
	
	while (v < points.length) {
		u = v;
		w = v;
		
		// Find previous point that's not too close
		while (pointsAreClose(points[u], points[v])) {
			if (isLoop ? ((u - 1 + points.length) % points.length !== w) : (u > 0)) {
				u = (u - 1 + points.length) % points.length;
			} else {
				u = v;
				break;
			}
		}
		
		// Find next point that's not too close
		while (pointsAreClose(points[w], points[v])) {
			if (isLoop ? ((w + 1) % points.length !== u) : (w < points.length - 1)) {
				w = (w + 1) % points.length;
			} else {
				w = v;
				break;
			}
		}
		
		let d = dPrev ?? 0;
		if (u === v) {
			if (v !== w) {
				d = latlngDirection(points[v], points[w]);
			}
		} else {
			if (v === w) {
				d = latlngDirection(points[u], points[v]);
			} else {
				d = pointDirection(points[u], points[v], points[w]);
			}
		}
		
		if (dPrev !== undefined) {
			d = dPrev + reduceAngle(d - dPrev);
		}
		dPrev = d;
		points[v].heading = d;
		v++;
	}
}

/**
 * Find and report loops in the route
 * @param {Array} points - Array of points
 * @param {number} isLoop - Whether route is a loop
 */
function findLoops(points, isLoop) {
	note("checking for loops...");
	const loopDistance = 100;
	
	// Add direction field: distance field was just calculated by zig-zag check
	addDirectionField({ points, isLoop });
	
	let u = 0;
	let v = 0;
	const loopAngle = 0.7 * TWOPI;
	
	while (v < points.length - 1) {
		const p = points[u];
		
		// Find endpoint within loop distance
		while (v < points.length - 1 && points[v + 1].distance < p.distance + loopDistance) {
			v++;
		}
		
		if (Math.abs(p.heading - points[v].heading) > loopAngle) {
			// Find starting point of loop
			while (u + 1 < v && Math.abs(points[u + 1].heading - points[v].heading) > loopAngle) {
				u++;
			}
			
			console.warn(`WARNING: loop between distance: ` +
				`${(points[u].distance / 1000).toFixed(3)} km and ${(points[v].distance / 1000).toFixed(3)} km`);
			
			u = v;
			continue;
		}
		u++;
	}
	
	// Clean up heading field
	deleteField({ points, field: "heading" });
}

/**
 * Reverse points and adjust distance, direction, curvature and laneshift fields
 * @param {Array} points - Array of points to reverse
 */
function reversePoints(points) {
	points.reverse();
	if (!points.length) return;
	
	// Adjust distance field if it exists
	if (points[0].distance !== undefined) {
		const dLast = points[points.length - 1].distance;
		for (const p of points) {
			p.distance = dLast - p.distance;
		}
	}
	
	// Negate heading, curvature, and laneShift fields
	for (const field of ["heading", "curvature", "laneShift"]) {
		if (points[0][field] !== undefined) {
			for (const p of points) {
				p[field] = -p[field];
			}
		}
	}
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

	// Convert coordinates to points format expected by processing functions
	let points = trackFeature.geometry.coordinates.map(coord => ({
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

	// Eliminate duplicate x,y points
	points = removeDuplicatePoints({ points, isLoop: options.isLoop || 0 });

	// If repeat is specified, then create replicates
	if ((options.repeat || 0) > 0) {
		deleteField2({ points, field: "distance" });
		const pNew = [...points];
		for (let i = 1; i <= options.repeat; i++) {
			for (const p of points) {
				pNew.push({ ...p });
			}
		}
		points = pNew;
	}

	// Skip 'join' functionality and convert unnamed segments to 0

	// Crop ranges if specified
	// This is done before auto-options since it may change whether the course is a loop
	points = cropPoints({ 
		points, 
		isLoop: options.isLoop || 0, 
		deleteRange: options.deleteRange || [],
		min: options.cropMin,
		max: options.cropMax
	});

	// AutoLoop: automatically determine if -loop should be invoked
	let isLoop = options.isLoop || 0;
	let copyPoint = options.copyPoint || 0;
	const autoLoop = options.autoLoop !== undefined ? options.autoLoop : options.auto;
	
	if (autoLoop) {
		if (!isLoop &&
			options.cropMin === undefined &&
			options.cropMax === undefined &&
			latlngDistance(points[0], points[points.length - 1]) < 150 &&
			points.length > 3 &&
			latlngDotProduct(points[points.length - 2], points[points.length - 1], points[0], points[1]) > -0.1) {
			isLoop = 1;
			copyPoint = 0;
			note("setting -loop");
		}
	}

	// Auto: auto option will turn on options based on the course
	if (options.auto) {
		note("auto-setting options...");
		
		const courseDistance = calcCourseDistance({ points, isLoop });
		
		// Calculate position interpolation
		if (options.spacing === undefined) {
			options.spacing = 3 * Math.pow(1 + courseDistance / 250, 1/4);
			note(`setting spacing to ${options.spacing.toFixed(3)} meters (distance = ${(courseDistance / 1000).toFixed(3)} km)`);
		}
		
		// Smoothing
		if (options.lSmooth === undefined) {
			options.lSmooth = 5;
			note(`setting smoothing to ${options.lSmooth} meters`);
		}
		
		// Other options
		if (options.autoSpacing === undefined) {
			note("setting -autoSpacing...");
			options.autoSpacing = 1;
		}
		
		if (options.smoothAngle === undefined) {
			options.smoothAngle = 10;
			note(`setting -smoothAngle ${options.smoothAngle} ...`);
		}
		
		if (options.minRadius === undefined) {
			options.minRadius = 6;
			note(`setting minimum corner radius to ${options.minRadius} ...`);
		}
		
		if (options.prune === undefined) {
			note("setting -prune ...");
			options.prune = 1;
		}
		
		if (options.zSmooth === undefined) {
			options.zSmooth = 15;
			note(`setting altitude smoothing to ${options.zSmooth} meters`);
		}
		
		if (options.fixCrossings === undefined) {
			note("setting -fixCrossings ...");
			options.fixCrossings = 1;
		}
		
		if (options.rUTurn === undefined) {
			options.rUTurn = 6;
			note(`setting -RUTurn ${options.rUTurn} (meters) ...`);
		}
		
		if (options.snap === undefined) {
			options.snap = 1;
			note("setting -snap 1 ...");
		}
		
		if (options.snapTransition === undefined) {
			options.snapTransition = 10;
			note(`setting -snapTransition ${options.snapTransition} meters...`);
		}
		
		if (options.cornerCrop === undefined) {
			options.cornerCrop = 6;
			note(`setting -cornerCrop ${options.cornerCrop} meters...`);
		}
	}

	// Set default values for options that are still undefined
	options.fixCrossings = options.fixCrossings ?? 0;
	options.laneShift = options.laneShift ?? 0;
	options.minRadius = options.minRadius ?? 0;
	options.prune = options.prune ?? 0;
	options.rLap = options.rLap ?? 0;
	options.spacing = options.spacing ?? 0;
	options.zSmooth = options.zSmooth ?? 0;
	options.snap = options.snap ?? 0;
	options.snapTransition = options.snapTransition ?? 0;
	options.lSmooth = options.lSmooth ?? 0;

	// Check for invalid option combinations
	if (options.snap > 0 && options.snapDistance > options.lSmooth) {
		console.warn(`WARNING: if snapping distance (${options.snapDistance}) is more than smoothing distance (${options.lSmooth}), then abrupt transitions between snapped and unsnapped points may occur`);
	}

	if (isLoop && (options.rTurnaround || 0) > 0) {
		console.warn("WARNING: ignoring -lap or -loop option when rTurnaround > 0");
		isLoop = 0;
	}

	// AutoSpacing triggered if max angle specified
	if (options.smoothAngle !== undefined && options.smoothAngle <= 0) {
		options.smoothAngle = 10;
		options.autoSpacing = options.autoSpacing ?? 1;
	}
	if (options.autoSpacing) {
		options.smoothAngle = options.smoothAngle ?? 15;
	}

	// Convert angle options to radians
	options.splineDegs = options.splineDegs ?? 0;
	const splineRadians = options.splineDegs * DEG2RAD;
	const splineMaxRadians = options.splineMaxDegs * DEG2RAD;

	options.arcFitDegs = options.arcFitDegs ?? 0;
	const arcFitRadians = options.arcFitDegs * DEG2RAD;
	const arcFitMaxRadians = options.arcFitMaxDegs * DEG2RAD;

	// Check if loop specified for apparent point-to-point
	if (isLoop) {
		const d = latlngDistance(points[0], points[points.length - 1]);
		if (d > 150) {
			console.warn(`WARNING: -loop or -lap specified, with large (${d} meter) distance between first and last point: are you sure you wanted -loop or -lap?`);
		}
	}

	// If shiftSF is specified but not loop, that's an error
	if (options.shiftSF !== options.shiftSFDefault && !isLoop) {
		throw new Error("ERROR: -shiftSF is only compatible with the -lap (or -loop) option.");
	}

	// Look for zig-zags
	points = fixZigZags(points);

	// Look for loops
	findLoops(points, isLoop);

	// Adjust altitudes if requested
	if (((options.zShift !== undefined && options.zShift !== 0) || 
		 (options.zScale !== undefined && options.zScale !== 1))) {
		// Transition set to change gradient by up to 5%
		note(`applying z shift = ${options.zShift || 0}, and z scale = ${options.zScale || 1}`);
		if (options.zShiftStart !== undefined) {
			note(`zShift start = ${options.zShiftStart}`);
		}
		if (options.zShiftEnd !== undefined) {
			note(`zShift end = ${options.zShiftEnd}`);
		}
		
		const zShift = options.zShift || 0;
		const zScale = options.zScale || 1;
		const zOffset = options.zOffset || 0;
		const zScaleRef = options.zScaleRef || 0;
		const zShiftDistance = 20 * (1 + Math.abs(zShift));
		
		for (const p of points) {
			const s = p.distance;
			let dz = (p.ele + zOffset - zScaleRef) * zScale + zShift + zScaleRef - p.ele;
			
			if (options.zShiftStart !== undefined && 
				options.zShiftEnd !== undefined && 
				options.zShiftEnd < options.zShiftStart) {
				dz *= transition((options.zShiftStart - s) / zShiftDistance) * 
					  transition((s - options.zShiftEnd) / zShiftDistance);
			} else {
				if (options.zShiftStart !== undefined) {
					dz *= transition((options.zShiftStart - s) / zShiftDistance);
				}
				if (options.zShiftEnd !== undefined) {
					dz *= transition((s - options.zShiftEnd) / zShiftDistance);
				}
			}
			p.ele += dz;
		}
	}

	// Reverse the points of the original course
	// Points reference segments so segments order is also reversed
	if (options.reverse) {
		note("reversing course direction..");
		reversePoints(points);
	}

	// Convert processed points back to coordinates format for output
	const processedFeature = {
		type: trackFeature.type,
		geometry: {
			type: trackFeature.geometry.type,
			coordinates: points.map(p => [p.lon, p.lat, p.ele])
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
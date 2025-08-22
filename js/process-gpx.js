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
function _spaceship(a, b) {
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
 * returns the last valid index of an array
 * @param {Array} x - array
 * @returns {number} last valid index
 */
function max_index(x) {
	return x.length - 1;
}

/**
 * Logging function (equivalent to Perl's note function)
 * @param {...any} args - Arguments to log
 */
function note(...args) {
	console.log(...args);
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
	let output = `# Points dump: ${points.length} points\n`;
	output += "# Index\tLat\t\tLon\t\tEle\t\tDistance\n";

	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const lat = p.lat.toFixed(8);
		const lon = p.lon.toFixed(8);
		const ele = (p.ele || 0).toFixed(2);
		const dist = (p.distance || 0).toFixed(2);

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
				console.log(`=== Points dump to ${filename} ===`);
				console.log(output);
				console.log(`=== End dump ${filename} ===`);
			});
	} else {
		// Browser environment - log to console instead
		console.log(`=== Points dump to ${filename} ===`);
		console.log(output);
		console.log(`=== End dump ${filename} ===`);
	}
}

/**
 * Reduce angle to range [-π, π]
 * @param {number} theta - Angle in radians
 * @returns {number} Reduced angle
 */
function reduceAngle(theta) {
	theta -= TWOPI * Math.floor(0.5 + theta / TWOPI);

	// Ensure π maps to -π to match Perl behavior
	if (Math.abs(theta - PI) < PI * Number.EPSILON) {
		theta = -PI;
	}

	return theta;
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

	const dx = ((c1 + c2) * LAT2Y * dlon) / 2;
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

/**
 * delete a field from the points
 * @param {Array} points - Array of points
 * @param {string} field - Field name to delete
 */
function deleteField(points, field) {
	if (!field) return;
	for (const p of points) {
		if (field in p) {
			delete p[field];
		}
	}
}

/**
 * delete an extension field
 * @param {Array} points - Array of points
 * @param {string} field - Extension field name to delete
 */
function deleteExtensionField(points, field) {
	if (!field) return;
	for (const p of points) {
		if (
			p.extensions &&
			typeof p.extensions === "object" &&
			field in p.extensions
		) {
			delete p.extensions[field];
		}
	}
}

/**
 * delete field and any extension
 * @param {Array} points - Array of points
 * @param {string} field - Field name to delete
 */
function deleteField2(points, field) {
	deleteField(points, field);
	deleteExtensionField(points, field);
}

/**
 * strip fields which are derived: needed if route has been changed by processing
 * @param {Array} points - Array of points
 * @param {Array} fields - Fields to delete (default: curvature, distance, gradient, heading)
 */
function deleteDerivedFields(
	points,
	fields = ["curvature", "distance", "gradient", "heading"],
) {
	for (const field of fields) {
		deleteField2(points, field);
	}
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

	while (i < points.length) {
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
 * add distance field to points
 * @param {Array} points - Array of points
 */
function addDistanceField(points) {
	if (!points.length) return;
	points[0].distance = 0;
	for (let i = 1; i < points.length; i++) {
		points[i].distance =
			points[i - 1].distance + latlngDistance(points[i - 1], points[i]);
	}
}

/**
 * calculate the net course distance
 * need to "wrap around" for lapped courses
 * @param {Array} points - Array of points
 * @param {number} isLoop - Whether the track is a loop (0 or 1)
 * @returns {number} Total distance in meters
 */
function calcCourseDistance(points, isLoop) {
	if (!points.length) return 0;
	if (points[max_index(points)].distance === undefined) {
		addDistanceField(points);
	}
	let distance = points[max_index(points)].distance;
	if (isLoop && points.length > 1) {
		distance += latlngDistance(points[max_index(points)], points[0]);
	}
	return distance;
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
 * crop points
 * @param {Array} points - Array of points to crop
 * @param {number} isLoop - Whether the track is a loop (0 or 1)
 * @param {Array} deleteRange - Array of distance ranges to delete
 * @param {number} cropMin - Minimum distance to keep
 * @param {number} cropMax - Maximum distance to keep
 * @returns {Array} New array of cropped points
 */
function cropPoints(points, isLoop = 0, deleteRange = [], cropMin, cropMax) {
	const ranges = [];

	const courseDistance = calcCourseDistance(points, isLoop);

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
		note(
			"cropping ",
			cropMin !== undefined ? `from ${cropMin} ` : "",
			cropMax !== undefined ? `to ${cropMax} ` : "",
			"meters...",
		);
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
		if (cropMin !== undefined && s < cropMin) continue;
		if (cropMax !== undefined && s > cropMax) continue;

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
 * UTurnCheck
 * check whether p1->p2 and p3->p4 are in the opposite direction
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
	for (let i = 1; i < points.length - 1; i++) {
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
				const u = U1; // keep points up to u
				let v = U2 + 1; // keep points starting with v

				while (
					v < points.length - 1 &&
					UTurnCheck(points[u], points[v], points[v], points[v + 1])
				) {
					v++;
				}

				warn(`eliminating ${v - u - 1} points`);
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
			addDistanceField(points);
		}
	}

	return points;
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
 * Average two angles, handling wraparound correctly
 * @param {number} d1 - First angle in radians
 * @param {number} d2 - Second angle in radians
 * @returns {number} Average angle in radians
 */
function averageAngles(d1, d2) {
	return reduceAngle(d1 + 0.5 * reduceAngle(d2 - d1));
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
 * add direction field to points
 * @param {Array} points - Array of points to process
 * @param {number} isLoop - Whether the track is a loop (0 or 1)
 */
function addDirectionField(points, isLoop = 0) {
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
			if (isLoop ? (u - 1 + points.length) % points.length !== w : u > 0) {
				u = (u - 1 + points.length) % points.length;
			} else {
				u = v;
				break;
			}
		}

		// Find next point that's not too close
		while (pointsAreClose(points[w], points[v])) {
			if (isLoop ? (w + 1) % points.length !== u : w < max_index(points)) {
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
 * reverse points and adjust distance, direction, curvature and laneshift fields, if present
 * @param {Array} points - Array of points to reverse
 */
function reversePoints(points) {
	points.reverse();
	if (!points.length) return;

	// Adjust distance field if it exists
	if (points[0].distance !== undefined) {
		const dLast = points[max_index(points)].distance;
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
	for (let i = 0; i < points.length; i++) {
		if (!isLoop && (i === 0 || i === max_index(points))) continue;

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
			dNext = points[max_index(points)].distance;
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
	if (isLoop && !pointsAreClose(points[0], points[max_index(points)])) {
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
		if (!isLoop && i === max_index(points)) {
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
			if (i > max_index(points)) break pointsLoop;
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
 * calculate a quality metric for the route
 * @param {Array} points - Array of points to analyze
 * @param {number} isLoop - Whether the track is a loop (0 or 1)
 * @returns {Array} [totalScore, directionScore, altitudeScore]
 */
function calcQualityScore(points, isLoop) {
	const sines = [];
	const ddirs = [];
	note("calculating altitude quality score..");
	let courseDistance = 0;
	let s2sum = 0;

	for (let i = 0; i < points.length; i++) {
		if (!isLoop && i === max_index(points)) break;

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
			!isLoop && i === 0
				? 0
				: latlngAngle(
						points[(i - 1 + points.length) % points.length],
						points[i],
						points[(i + 1) % points.length],
					),
		);

		if (
			!(ddirs[ddirs.length - 1] !== null && sines[sines.length - 1] !== null)
		) {
			sines.pop();
			ddirs.pop();
		}
	}

	let sum2 = 0;
	for (let i = 0; i < sines.length; i++) {
		if (!isLoop && i === max_index(sines)) break;
		// These are sine grades, not tangents, to avoid zero denominators
		const s1 = sines[i];
		const s2 = sines[(i + 1) % sines.length];
		sum2 += (s2 - s1) ** 2;
	}

	const scoreZ = courseDistance === 0 ? 0 : (10 * sum2) / s2sum;

	sum2 = 0;
	for (let i = 0; i < ddirs.length; i++) {
		sum2 += ddirs[i] ** 2;
	}
	const scoreD = courseDistance === 0 ? 0 : (100 * sum2) / courseDistance;

	const score = scoreZ + scoreD;

	return [score, scoreD, scoreZ];
}

/**
 * calculate deviation statistics for a range of points relative to connection of endpoints
 * @param {Array} points - Array of points
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @returns {Array} [avg, max, rms] deviation statistics
 */
function calcDeviationStats(points, startIndex, endIndex) {
	let max = 0;
	const p1 = points[startIndex % points.length];
	const p2 = points[endIndex % points.length];
	const c = Math.cos(((p1.lat + p2.lat) * DEG2RAD) / 2.0);
	const dx0 = (p2.lon - p1.lon) * LAT2Y * c;
	const dy0 = (p2.lat - p1.lat) * LAT2Y;
	const L = Math.sqrt(dx0 ** 2 + dy0 ** 2);

	if (Math.abs(L) < 0.001 || endIndex < startIndex + 1) {
		return [0, 0, 0];
	}

	const du0 = dx0 / L;
	const dv0 = dy0 / L;
	let sum = 0;
	let sum2 = 0;

	for (let i = startIndex + 1; i <= endIndex - 1; i++) {
		const dx = (points[i % points.length].lon - p1.lon) * LAT2Y * c;
		const dy = (points[i % points.length].lat - p1.lat) * LAT2Y;
		// deviation to the right
		const deviation = dx * dv0 - dy * du0;
		sum += deviation;
		sum2 += deviation ** 2;
		if (Math.abs(deviation) > max) {
			max = Math.abs(deviation);
		}
	}

	const avg = sum / (endIndex - startIndex - 1);
	const rms = Math.sqrt(sum2 / (endIndex - startIndex - 1));
	return [avg, max, rms];
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
		throw new Error("ERROR -- attempted to cross beyond pole!");
	}

	const c = Math.cos(DEG2RAD * (lat0 + dlat / 2));
	const dlon = dx / c / LAT2Y;
	let lon = lon0 + dlon;
	lon -= 360 * Math.floor(0.5 + lon / 360);

	return { lat: lat, lon: lon };
}

/**
 * straighten points between indices
 * @param {Array} points - Array of points
 * @param {boolean} _isLoop - Whether route is a loop
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 */
function straightenPoints(points, _isLoop, startIndex, endIndex) {
	// Ensure distance field exists
	if (points[0].distance === undefined) {
		addDistanceField(points);
	}

	// If we wrap around, then use a negative number for the start index
	if (startIndex > endIndex) {
		startIndex -= points.length;
	}

	const [rx, ry] = latlng2dxdy(points[startIndex], points[endIndex]);

	// If neither rx nor ry is nonzero, do nothing
	if (rx === 0 && ry === 0) {
		return;
	}

	const r2 = rx ** 2 + ry ** 2;

	// For each point, find the projection of the point on the segment
	for (let i = startIndex + 1; i <= endIndex - 1; i++) {
		const [dx, dy] = latlng2dxdy(points[startIndex], points[i]);
		// Find the projection onto the line
		// projection: r dot rLine / r
		const f = (dx * rx + dy * ry) / r2;
		const pNew = addVectorToPoint(points[startIndex], [rx * f, ry * f]);
		points[i].lat = pNew.lat;
		points[i].lon = pNew.lon;
	}
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
			i < points.length &&
			k < points.length &&
			l < points.length
		)
	) {
		return false;
	}

	if (isPointOnRoad(points[k], points[l], points[i], d)) {
		return true;
	}

	if (!(j > 0 && m > 0 && j < points.length && m < points.length)) {
		return false;
	}

	return isPointOnRoadCorner(
		points[j],
		points[k],
		points[l],
		points[m],
		points[i],
	);
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
	iLoop: for (let i = 0; i < points.length - 2; i += snapStep) {
		const p1 = points[i];
		const jCount = [];

		let j = i + snapStep;
		if (j > max_index(points)) continue;

		// Get out of snap range: get point j beyond the snap range of point i
		// This is geometric distance, not course distance, which could potentially be an issue
		let d = 0;
		while ((d = latlngDistance(p1, points[j])) <= snapRange) {
			j += snapStep;
			if (j >= max_index(points)) continue iLoop;
		}

		// Keep going until distance between j and i stops increasing
		while (j <= max_index(points)) {
			const d2 = latlngDistance(p1, points[j]);
			if (d2 < d) break;
			d = d2;
			j += snapStep;
			if (j >= max_index(points)) continue iLoop;
		}

		// Keep moving until j comes back into snap range of i
		jLoop1: while (j <= max_index(points)) {
			// Make sure we don't try the same value twice (moving forward and backward could cause this)
			jCount[j] = (jCount[j] || 0) + 1;
			if (jCount[j] > 1) continue iLoop;

			// Looking for j sufficiently close to i and connected with less than a 30% slope
			// Slope requirement avoids snapping across tight switchbacks or a hypothetical "spiral"
			while (
				(d = latlngDistance(p1, points[j])) > snapRange ||
				Math.abs(p1.ele - points[j].ele) > snapAltitude + 0.3 * d
			) {
				j += snapStep;
				if (j >= max_index(points)) continue iLoop;
			}

			// Find local minimum of distance... reduced step distance to 1
			while (j <= max_index(points)) {
				d = latlngDistance(p1, points[j]);

				// Distance to point forward
				const df =
					j < max_index(points) ? latlngDistance(p1, points[j + 1]) : undefined;
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
			if (j < max_index(points) && i < max_index(points)) {
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
					j1 < max_index(points) &&
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
					j2 < max_index(points) &&
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
						jTest <= max_index(points) &&
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
						jTest <= max_index(points) &&
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
						jTest <= max_index(points) &&
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
						jTest <= max_index(points) &&
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
				throw new Error("Zero sign encountered");
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
					let j_seg = j1;
					for (let i_seg = i1; i_seg <= i2; i_seg++) {
						if (
							j_seg < j2 &&
							Math.abs(points[i_seg].distance - points[i_seg - 1].distance) <
								0.05
						) {
							j_seg++;
						}

						while (
							j_seg < j2 &&
							Math.abs(
								Math.abs(points[j_seg + 1].distance - points[j1].distance) -
									Math.abs(points[i_seg].distance - points[i1].distance),
							) <
								Math.abs(
									Math.abs(points[j_seg].distance - points[j1].distance) -
										Math.abs(points[i_seg].distance - points[i1].distance),
								)
						) {
							j_seg++;
						}

						const p = { ...points[i_seg] };
						p.segment = points[j_seg].segment;
						pNew.push(p);
					}

					pNew.push(...points.slice(j2)); // Keep everything which follows j range
				} else {
					pNew.push(...points.slice(0, j2 + 1));

					let j_seg = j2;
					for (let i_seg = i2; i_seg >= i1; i_seg--) {
						if (
							j_seg < j1 &&
							Math.abs(points[i_seg].distance - points[i_seg - 1].distance) <
								0.05
						) {
							j_seg++;
						}

						while (
							j_seg < j1 &&
							Math.abs(
								Math.abs(points[j_seg + 1].distance - points[j1].distance) -
									Math.abs(points[i_seg].distance - points[i1].distance),
							) <
								Math.abs(
									Math.abs(points[j_seg].distance - points[j1].distance) -
										Math.abs(points[i_seg].distance - points[i1].distance),
								)
						) {
							j_seg++;
						}

						const p = { ...points[i_seg] };
						p.segment = points[j_seg].segment;
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
						i_trans <= max_index(points)
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
						j_trans <= max_index(points)
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
							if (g < 0) throw new Error("Negative g!");
							const z1 = points[is[u]].ele;
							zis[u] = g * z0 + (1 - g) * z1;
						} else {
							v++;
							const f = (sjs[v] - sis[u]) / (sis[u + 1] - sis[u]);
							const z0 =
								(1 - f) * points[is[u]].ele + f * points[is[u + 1]].ele;
							const g = (1 + Math.cos((PI * sjs[v]) / snapTransition)) / 4; // From 0.5 to 0
							if (g < 0) throw new Error("Negative g!");
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

/**
 * automatically find segments to be straightened
 * segments have a maximum deviation and also a check on
 * the correlation of the deviations
 * step through the route (perhaps with wrap-around for a loop)
 * with first index at each point, a second index at the minimum
 * length, keeping track of the maximum, rms, and average deviations
 * if the minimum length meets the criteria, then extend the length
 * until the criteria are broken, then jump to the endpoint
 * and continue (straight segments cannot overlap)
 * @param {Array} points - Array of points
 * @param {boolean} isLoop - Whether route is a loop
 * @param {number} minLength - Minimum length for straightening
 * @param {number} maxDeviation - Maximum deviation for straightening
 */
function autoStraighten(points, isLoop, minLength, maxDeviation) {
	const courseDistance =
		points[0].distance !== undefined
			? calcCourseDistance(points, isLoop)
			: (() => {
					addDistanceField(points);
					return calcCourseDistance(points, isLoop);
				})();

	function alignmentTest(points, i, j, maxDeviation) {
		const [avg, max, rms] = calcDeviationStats(points, i, j);
		return (
			max < maxDeviation &&
			Math.abs(avg) < maxDeviation / 4 &&
			rms < maxDeviation / 2
		);
	}

	let j = 1;
	let pointCount = 0;

	iLoop: for (let i = 0; i <= points.length - 1; i++) {
		// Keep point j ahead of i at min distance
		while (
			j < i + 2 ||
			points[j].distance +
				int(j / points.length) * courseDistance -
				points[i].distance <
				minLength
		) {
			j++;
			// If we cannot get a segment long enough on point-to-point, we're too close to the finish
			if (!(isLoop || j <= max_index(points))) {
				break iLoop;
			}
		}

		// Check if points meet the alignment test
		if (!alignmentTest(points, i, j, maxDeviation)) {
			continue;
		}

		// We've got a line: try to extend it
		while (true) {
			const k = j + 1;
			if (!isLoop && k > max_index(points)) {
				break;
			}
			if (!alignmentTest(points, i, k, maxDeviation)) {
				break;
			}
			j = k;
		}

		// See if we can improve the score by removing points from the ends
		// There's a tendency for the algorithm to extend the straight into turns, which affects
		// the direction of the straight, so try to back down on that
		let [_avg, _max, rms] = calcDeviationStats(points, i, j);
		let L = latlngDistance(
			points[i % points.length],
			points[j % points.length],
		);

		while (true) {
			let count = 0;
			let k = j - 1;
			if (k < i + 2) {
				break;
			}
			const L2 = latlngDistance(
				points[i % points.length],
				points[k % points.length],
			);
			if (L2 > minLength) {
				const [avg2, max2, rms2] = calcDeviationStats(points, i, k);
				if (rms2 * L < rms * L2) {
					j = k;
					L = L2;
					_avg = avg2;
					_max = max2;
					rms = rms2;
					count++;
				}
			}

			k = i + 1;
			if (k > j - 2) {
				break;
			}
			const L3 = latlngDistance(
				points[k % points.length],
				points[j % points.length],
			);
			if (L3 > minLength) {
				const [avg3, max3, rms3] = calcDeviationStats(points, k, j);
				if (rms3 * L < rms * L3) {
					j = k;
					L = L3;
					_avg = avg3;
					_max = max3;
					rms = rms3;
					count++;
				}
			}
			if (count === 0) {
				break;
			}
		}

		// We found a straight section! Now straighten it, and start over with the last straightened point
		// This deletes the distance field
		straightenPoints(points, isLoop, i, j);
		pointCount += j - i - 2;
		// Jump to end of straightened portion
		i = j;
	}

	// These fields are now invalid
	if (pointCount > 0) {
		note(`autoStraighten: total straightened points = ${pointCount}`);
		deleteField(points, "distance");
		if (points[0].heading !== undefined) {
			deleteField(points, "heading");
		}
	}
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
		ss.push(ss[ss.length - 1] + latlngDistance(points[max_index(points)], p2));

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
	iLoop: for (let i = 0; i < points.length; i++) {
		pNew.push(points[i]);

		// add points if appropriate
		// splines cannot be fit to first or last interval unless it's a loop
		if (isLoop || (i > 0 && i < max_index(points) - 1)) {
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
					// arcFitInterpolation not implemented yet - skip for now
					warn("arcFitInterpolation not implemented, skipping");
					newPoints = [];
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
 * Process a GPX track feature to optimize and improve the route
 * @param {Object} trackFeature - LineString feature object from GPX parsing
 * @param {Object} options - Processing options dictionary
 * @returns {Object} Processed LineString feature object
 */
export function processGPX(trackFeature, options = {}) {
	// Validate input
	if (
		!trackFeature ||
		!trackFeature.geometry ||
		trackFeature.geometry.type !== "LineString"
	) {
		throw new Error("Invalid track feature provided to processGPX");
	}

	// Make sure repeat is in range
	if ((options.repeat || 0) > 99) {
		throw new Error("-repeat limited to range 0 to 99");
	}

	// Check loopLeft and loopRight
	if (options.loopLeft && options.loopRight) {
		throw new Error("ERROR: you cannot specify both -loopLeft and -loopRight");
	}

	// Short-cut for out-and-back
	if (options.outAndBack || options.outAndBackLap) {
		if (options.outAndBackLap) {
			options.rLap = options.rLap ?? 8;
		} else {
			options.rLap = options.rLap ?? 0;
		}
		options.autoSpacing = options.autoSpacing ?? 1;
		options.lSmooth = options.lSmooth ?? 5;
		options.laneShift =
			options.laneShift ?? (options.selectiveLaneShift?.length ? 0 : 6);
		options.minRadius = options.minRadius ?? 6;
		options.prune = options.prune ?? 1;
		options.rTurnaround = options.rTurnaround ?? 8;
		options.rUTurn = options.rUTurn ?? 8;
		options.spacing = options.spacing ?? 10;
		options.splineDegs = options.splineDegs ?? 0;
	}

	// Loop sign
	const _loopSign = options.loopLeft
		? -1
		: options.loopRight
			? 1
			: options.laneShift !== undefined && options.laneShift < 0
				? -1
				: 1;

	// Auto-straighten
	options.autoStraightenDeviation =
		options.autoStraightenDeviation ?? options.autoStraighten?.[0] ?? 0;
	options.autoStraightenLength =
		options.autoStraightenLength ?? options.autoStraighten?.[1] ?? 100;

	// Named segments
	// const namedSegments = (options.namedSegments || "").split(/[;]/);
	// const autoSegmentNames = (options.autoSegmentNames || "")
	// 	.split(/[,;]/)
	// 	.map((s) => s.replace(/^\s*(.*?)\s*$/, "$1"));

	// Convert max slope to percent
	if (options.maxSlope !== undefined && options.maxSlope < 1) {
		options.maxSlope *= 100;
	}

	// If extendBack is specified, we need a turnaround loop... calculate crop later
	options.extendBack = options.extendBack ?? 0;
	options.rTurnaround = options.rTurnaround ?? 0;
	if (options.extendBack > 0 && options.rTurnaround <= 0) {
		options.rTurnaround = 5;
	}

	if (
		options.cropMin !== undefined &&
		options.cropMax !== undefined &&
		options.cropMax > 0 &&
		options.cropMin > options.cropMax
	) {
		throw new Error("Crop window minimum exceeds crop window maximum");
	}

	// Apply extend
	options.prepend = (options.prepend || 0) + (options.extend || 0);
	options.append = (options.append || 0) + (options.extend || 0);

	// Convert coordinates to points format expected by processing functions
	let points = trackFeature.geometry.coordinates.map((coord) => ({
		lat: coord[1],
		lon: coord[0],
		ele: coord[2] || 0,
	}));

	// Calculate quality score of original course
	note("points in original GPX track = ", points.length);
	const [score, scoreD, scoreZ] = calcQualityScore(points, options.isLoop || 0);
	note("quality score of original course = ", score.toFixed(4));
	note("direction score of original course = ", scoreD.toFixed(4));
	note("altitude score of original course = ", scoreZ.toFixed(4));
	dumpPoints(points, "js-00-original.txt");

	// Eliminate duplicate x,y points
	points = removeDuplicatePoints(points, options.isLoop || 0);
	dumpPoints(points, "js-01-duplicates-removed.txt");

	// If repeat is specified, then create replicates
	if ((options.repeat || 0) > 0) {
		deleteField2(points, "distance");
		const pNew = [...points];
		for (let i = 1; i <= options.repeat; i++) {
			for (const p of points) {
				pNew.push({ ...p });
			}
		}
		points = pNew;
		dumpPoints(points, "js-02-repeated.txt");
	}

	// Skip 'join' functionality and convert unnamed segments to 0

	// Crop ranges if specified
	// This is done before auto-options since it may change whether the course is a loop
	points = cropPoints(
		points,
		options.isLoop || 0,
		options.deleteRange || [],
		options.cropMin,
		options.cropMax,
	);
	dumpPoints(points, "js-03-cropped.txt");

	// AutoLoop: automatically determine if -loop should be invoked
	options.isLoop = options.isLoop || 0;
	options.copyPoint = options.copyPoint || 0;
	options.autoLoop = options.autoLoop || options.auto;

	if (options.autoLoop) {
		if (
			!options.isLoop &&
			options.cropMin === undefined &&
			options.cropMax === undefined &&
			latlngDistance(points[0], points[max_index(points)]) < 150 &&
			points.length > 3 &&
			latlngDotProduct(
				points[max_index(points) - 1],
				points[max_index(points)],
				points[0],
				points[1],
			) > -0.1
		) {
			options.isLoop = 1;
			options.copyPoint = 0;
			note("setting -loop");
		}
	}

	// Auto: auto option will turn on options based on the course
	if (options.auto) {
		note("auto-setting options...");

		const courseDistance = calcCourseDistance(points, options.isLoop);

		// Calculate position interpolation
		if (options.spacing === undefined) {
			options.spacing = 3 * (1 + courseDistance / 250) ** (1 / 4);
			note(
				`setting spacing to ${options.spacing.toFixed(3)} meters (distance = ${(courseDistance / 1000).toFixed(3)} km)`,
			);
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
		warn(
			`WARNING: if snapping distance (${options.snapDistance}) is more than smoothing distance (${options.lSmooth}), then abrupt transitions between snapped and unsnapped points may occur`,
		);
	}

	if (options.isLoop && (options.rTurnaround || 0) > 0) {
		warn("WARNING: ignoring -lap or -loop option when rTurnaround > 0");
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
	const _splineRadians = options.splineDegs * DEG2RAD;
	const _splineMaxRadians = options.splineMaxDegs * DEG2RAD;

	options.arcFitDegs = options.arcFitDegs ?? 0;
	const _arcFitRadians = options.arcFitDegs * DEG2RAD;
	const _arcFitMaxRadians = options.arcFitMaxDegs * DEG2RAD;

	// Check if loop specified for apparent point-to-point
	if (options.isLoop) {
		const d = latlngDistance(points[0], points[max_index(points)]);
		if (d > 150) {
			warn(
				`WARNING: -loop or -lap specified, with large (${d} meter) distance between first and last point: are you sure you wanted -loop or -lap?`,
			);
		}
	}

	// If shiftSF is specified but not loop, that's an error
	if (options.shiftSF !== options.shiftSFDefault && !options.isLoop) {
		throw new Error(
			"ERROR: -shiftSF is only compatible with the -lap (or -loop) option.",
		);
	}

	// Look for zig-zags
	points = fixZigZags(points);
	dumpPoints(points, "js-04-zigzags-fixed.txt");

	// Look for loops
	findLoops(points, options.isLoop);

	// Adjust altitudes if requested
	if (
		(options.zShift !== undefined && options.zShift !== 0) ||
		(options.zScale !== undefined && options.zScale !== 1)
	) {
		// Transition set to change gradient by up to 5%
		note(
			`applying z shift = ${options.zShift || 0}, and z scale = ${options.zScale || 1}`,
		);
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
			let dz =
				(p.ele + zOffset - zScaleRef) * zScale + zShift + zScaleRef - p.ele;

			if (
				options.zShiftStart !== undefined &&
				options.zShiftEnd !== undefined &&
				options.zShiftEnd < options.zShiftStart
			) {
				dz *=
					transition((options.zShiftStart - s) / zShiftDistance) *
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
		dumpPoints(points, "js-05-altitude-adjusted.txt");
	}

	// Reverse the points of the original course
	// Points reference segments so segments order is also reversed
	if (options.reverse) {
		note("reversing course direction..");
		reversePoints(points);
		dumpPoints(points, "js-06-reversed.txt");
	}

	// Corner cropping
	options.cornerCrop = options.cornerCrop ?? 0;
	options.minCornerCropDegs = options.minCornerCropDegs ?? 75;
	if (options.maxCornerCropDegs === undefined) {
		if (options.minCornerCropDegs < 90) {
			options.maxCornerCropDegs = 135;
		} else {
			options.maxCornerCropDegs = options.minCornerCropDegs + 45;
		}
	}

	if (options.cornerCrop > 0) {
		points = cropCorners(
			points,
			options.cornerCrop,
			options.minCornerCropDegs * DEG2RAD,
			options.maxCornerCropDegs * DEG2RAD,
			options.cornerCropStart,
			options.cornerCropEnd,
			options.isLoop,
		);
		dumpPoints(points, "js-07-corners-cropped.txt");
	}

	// Auto-straighten
	if ((options.autoStraightenDeviation || 0) > 0) {
		note("auto-Straightening...");
		autoStraighten(
			points,
			options.isLoop,
			options.autoStraightenLength || 100,
			options.autoStraightenDeviation,
		);
		dumpPoints(points, "js-08-auto-straightened.txt");
	}

	// Check for snapping
	if ((options.snap || 0) > 0 && (options.snapDistance || 0) >= 0) {
		note("snapping repeated points (pass 1)...");
		points = snapPoints(
			points,
			options.snap,
			options.snapDistance || 2,
			options.snapAltitude || 1,
			options.snapTransition || 0,
			options.spacing || 0,
		);
		dumpPoints(points, "js-09-snapped.txt");
	}

	// spline of corners
	if (_splineRadians > 0) {
		dumpPoints(points, "js-10-before-splines.txt");
		note("corner splines, pre-smoothing...");
		points = addSplines(
			points,
			_splineRadians,
			_splineMaxRadians,
			options.splineStart,
			options.splineEnd,
			options.isLoop || 0,
			"spline",
		);
		dumpPoints(points, "js-11-after-splines.txt");
	}

	// Skip circuit processing

	// Convert processed points back to coordinates format for output
	const processedFeature = {
		type: trackFeature.type,
		geometry: {
			type: trackFeature.geometry.type,
			coordinates: points.map((p) => [p.lon, p.lat, p.ele]),
		},
		properties: {
			...trackFeature.properties,
			processed: true,
			processedAt: new Date().toISOString(),
			processOptions: { ...options },
		},
	};

	return processedFeature;
}

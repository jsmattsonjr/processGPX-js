/**
 * GPX export functionality using togpx with XML formatting and custom extensions.
 */
import { formatXML } from "./xml-formatter.js";

const RGT_NAMESPACE_URI = "https://landixus.github.io/processGPX-js/rgt";
const POINT_EXTENSION_FIELDS = [
	"heading",
	"curvature",
	"distance",
	"gradient",
	"shift",
	"sigma",
	"direction",
];

/**
 * Convert a track feature to GPX XML format using togpx.
 * Supports optional waypoint export, segment extensions, and point extensions.
 *
 * @param {Object} trackFeature - LineString feature object
 * @param {Object} [exportOptions={}] - Export options
 * @returns {string} GPX XML string
 */
function trackFeatureToGPX(trackFeature, exportOptions = {}) {
	const options = {
		includeSegmentExtensions: true,
		includePointExtensions: true,
		includeWaypoints: true,
		...exportOptions,
	};

	const featureCollection = {
		type: "FeatureCollection",
		features: [trackFeature, ...getWaypointFeatures(trackFeature, options)],
	};

	let gpxOutput = togpx(featureCollection, {
		creator: "processGPX-js",
		metadata: {
			name: trackFeature.properties?.name || "Processed Route",
			time: new Date(),
			author: {
				name: "processGPX-js",
			},
		},
	});

	if (options.includeSegmentExtensions) {
		gpxOutput = addSegmentExtensionsToXML(gpxOutput, trackFeature.properties?.segmentName);
	}

	if (options.includePointExtensions) {
		gpxOutput = addPointExtensionsToXML(gpxOutput, getPointExtensionData(trackFeature));
	}

	return formatXML(gpxOutput);
}

/**
 * Build waypoint point features from route properties.
 *
 * @param {Object} trackFeature - LineString feature object
 * @param {Object} exportOptions - Export options
 * @returns {Object[]} GeoJSON point features
 */
function getWaypointFeatures(trackFeature, exportOptions = {}) {
	if (!exportOptions.includeWaypoints) {
		return [];
	}

	const rawWaypoints =
		trackFeature?.properties?.waypoints ||
		trackFeature?.waypoints ||
		trackFeature?.properties?.gradientSigns ||
		[];

	if (!Array.isArray(rawWaypoints)) {
		return [];
	}

	return rawWaypoints
		.map((waypoint) => {
			const lon = Number(waypoint?.lon ?? waypoint?.lng ?? waypoint?.longitude);
			const lat = Number(waypoint?.lat ?? waypoint?.latitude);
			const ele = Number(waypoint?.ele ?? waypoint?.elevation);
			if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
				return null;
			}

			const coordinates = Number.isFinite(ele) ? [lon, lat, ele] : [lon, lat];
			return {
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates,
				},
				properties: {
					name: waypoint?.name || waypoint?.desc || waypoint?.cmt || "Waypoint",
					cmt: waypoint?.cmt || waypoint?.name || undefined,
					desc: waypoint?.desc || waypoint?.name || undefined,
					src: waypoint?.src || undefined,
					sym: waypoint?.sym || undefined,
					type: waypoint?.type || undefined,
					fix: waypoint?.fix || undefined,
				},
			};
		})
		.filter(Boolean);
}

/**
 * Extract per-point extension data from a processed route.
 * Supports several possible storage layouts.
 *
 * @param {Object} trackFeature - LineString feature object
 * @returns {Object[]} Array aligned to track points
 */
function getPointExtensionData(trackFeature) {
	const properties = trackFeature?.properties || {};
	const candidates = [
		properties.pointExtensions,
		properties.pointData,
		properties.points,
		trackFeature.pointExtensions,
	];

	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			return candidate.map((point) => normalizePointExtensionData(point));
		}
	}

	return [];
}

/**
 * Normalize one point extension entry to an extensions object.
 *
 * @param {Object} point - Per-point data object
 * @returns {Object} Normalized extension fields
 */
function normalizePointExtensionData(point) {
	if (!point || typeof point !== "object") {
		return {};
	}

	if (point.extensions && typeof point.extensions === "object" && !Array.isArray(point.extensions)) {
		return { ...point.extensions };
	}

	const normalized = {};
	for (const field of POINT_EXTENSION_FIELDS) {
		if (field in point) {
			normalized[field] = point[field];
		}
	}
	return normalized;
}

/**
 * Add named segment extensions to each GPX track segment.
 *
 * @param {string} xml - GPX XML string
 * @param {Object} segmentNameMap - Nested segment name map
 * @returns {string} Updated GPX XML string
 */
function addSegmentExtensionsToXML(xml, segmentNameMap) {
	if (!segmentNameMap || typeof segmentNameMap !== "object") {
		return xml;
	}

	const doc = new DOMParser().parseFromString(xml, "application/xml");
	const gpx = doc.documentElement;
	if (!gpx) {
		return xml;
	}

	let hasAnySegmentName = false;
	const tracks = Array.from(gpx.getElementsByTagName("trk"));
	tracks.forEach((trk, trackIndex) => {
		const trackKey = String(trackIndex + 1);
		const segmentNamesForTrack = segmentNameMap?.[trackKey] ?? segmentNameMap?.[trackIndex + 1];
		if (!segmentNamesForTrack || typeof segmentNamesForTrack !== "object") {
			return;
		}

		const segments = Array.from(trk.children).filter((node) => node.tagName === "trkseg");
		segments.forEach((trkseg, segmentIndex) => {
			const segmentKey = String(segmentIndex + 1);
			const segmentName =
				segmentNamesForTrack?.[segmentKey] ?? segmentNamesForTrack?.[segmentIndex + 1] ?? "";
			if (!segmentName) {
				return;
			}

			hasAnySegmentName = true;
			let extensionsNode = Array.from(trkseg.children).find((node) => node.tagName === "extensions");
			if (!extensionsNode) {
				extensionsNode = doc.createElement("extensions");
				trkseg.appendChild(extensionsNode);
			}

			// Remove any previous namedSegment to avoid duplicates on repeated export.
			Array.from(extensionsNode.children)
				.filter((node) => node.tagName === "rgt:namedSegment" || node.localName === "namedSegment")
				.forEach((node) => extensionsNode.removeChild(node));

			const namedSegmentNode = doc.createElementNS(RGT_NAMESPACE_URI, "rgt:namedSegment");
			namedSegmentNode.textContent = String(segmentName);
			extensionsNode.appendChild(namedSegmentNode);
		});
	});

	if (hasAnySegmentName) {
		gpx.setAttribute("xmlns:rgt", RGT_NAMESPACE_URI);
	}

	return new XMLSerializer().serializeToString(doc);
}

/**
 * Add point extensions to GPX track points.
 *
 * @param {string} xml - GPX XML string
 * @param {Object[]} pointExtensions - Array of extension maps aligned to track points
 * @returns {string} Updated GPX XML string
 */
function addPointExtensionsToXML(xml, pointExtensions) {
	if (!Array.isArray(pointExtensions) || pointExtensions.length === 0) {
		return xml;
	}

	const doc = new DOMParser().parseFromString(xml, "application/xml");
	const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
	if (trkpts.length === 0) {
		return xml;
	}

	const pointCount = Math.min(trkpts.length, pointExtensions.length);
	for (let i = 0; i < pointCount; i++) {
		const extensions = pointExtensions[i];
		if (!extensions || typeof extensions !== "object") {
			continue;
		}

		const fields = Object.entries(extensions).filter(([, value]) => value !== undefined && value !== null && value !== "");
		if (fields.length === 0) {
			continue;
		}

		const trkpt = trkpts[i];
		let extensionsNode = Array.from(trkpt.children).find((node) => node.tagName === "extensions");
		if (!extensionsNode) {
			extensionsNode = doc.createElement("extensions");
			trkpt.appendChild(extensionsNode);
		}

		for (const [field, value] of fields) {
			Array.from(extensionsNode.children)
				.filter((node) => node.tagName === field || node.localName === field)
				.forEach((node) => extensionsNode.removeChild(node));

			const fieldNode = doc.createElement(field);
			fieldNode.textContent = String(value);
			extensionsNode.appendChild(fieldNode);
		}
	}

	return new XMLSerializer().serializeToString(doc);
}

/**
 * Download a track feature as a GPX file.
 *
 * @param {Object} trackFeature - LineString feature object
 * @param {string} filename - Filename for download (without extension)
 * @param {Object} [exportOptions={}] - Export options
 */
export function downloadTrackAsGPX(trackFeature, filename, exportOptions = {}) {
	const gpxContent = trackFeatureToGPX(trackFeature, exportOptions);
	const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = `${filename}.gpx`;
	link.style.display = "none";

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export { trackFeatureToGPX };

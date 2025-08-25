#!/usr/bin/env node

import fs from "fs";
import { DOMParser } from "@xmldom/xmldom";
import { gpx } from "@tmcw/togeojson";
import * as turf from "@turf/turf";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .command("$0 <file1> <file2>", "Compare two GPX files for route equality")
  .positional("file1", {
    describe: "First GPX file",
    type: "string"
  })
  .positional("file2", {
    describe: "Second GPX file", 
    type: "string"
  })
  .option("buffer", {
    alias: "b",
    describe: "Buffer distance in meters",
    type: "number",
    default: 1
  })
  .option("altitude-interval", {
    alias: "i",
    describe: "Altitude interpolation interval in meters", 
    type: "number",
    default: 100
  })
  .option("altitude-tolerance", {
    alias: "t",
    describe: "Altitude tolerance in meters",
    type: "number"
  })
  .option("verbose", {
    alias: "v",
    describe: "Verbose output",
    type: "boolean",
    default: false
  })
  .help()
  .argv;

function parseGpxFile(filePath) {
  try {
    const gpxContent = fs.readFileSync(filePath, "utf8");
    const dom = new DOMParser().parseFromString(gpxContent, "text/xml");
    const geoJson = gpx(dom);
    return geoJson;
  } catch (error) {
    console.error(`Error parsing GPX file ${filePath}:`, error.message);
    process.exit(1);
  }
}

function extractLineStrings(geoJson) {
  const lineStrings = [];
  
  if (geoJson.features) {
    for (const feature of geoJson.features) {
      if (feature.geometry && feature.geometry.type === "LineString") {
        lineStrings.push(feature.geometry);
      }
    }
  }
  
  return lineStrings;
}

function interpolateAltitudePoints(lineString, intervalMeters) {
  const coordinates = lineString.coordinates;
  if (coordinates.length === 0) return [];
  
  const interpolatedPoints = [];
  let totalDistance = 0;
  let nextInterpolationDistance = 0;
  
  // Add first point
  const firstPoint = coordinates[0];
  if (firstPoint.length >= 3) {
    interpolatedPoints.push({
      coordinates: [firstPoint[0], firstPoint[1]],
      elevation: firstPoint[2],
      distance: 0
    });
  }
  
  // Interpolate points along the line
  for (let i = 1; i < coordinates.length; i++) {
    const currentPoint = turf.point(coordinates[i-1]);
    const nextPoint = turf.point(coordinates[i]);
    const segmentDistance = turf.distance(currentPoint, nextPoint, { units: "meters" });
    
    const segmentStartDistance = totalDistance;
    const segmentEndDistance = totalDistance + segmentDistance;
    
    // Add interpolated points along this segment
    while (nextInterpolationDistance <= segmentEndDistance && nextInterpolationDistance > segmentStartDistance) {
      const ratio = (nextInterpolationDistance - segmentStartDistance) / segmentDistance;
      
      const interpolatedLng = coordinates[i-1][0] + (coordinates[i][0] - coordinates[i-1][0]) * ratio;
      const interpolatedLat = coordinates[i-1][1] + (coordinates[i][1] - coordinates[i-1][1]) * ratio;
      
      let interpolatedElevation = 0;
      if (coordinates[i-1].length >= 3 && coordinates[i].length >= 3) {
        interpolatedElevation = coordinates[i-1][2] + (coordinates[i][2] - coordinates[i-1][2]) * ratio;
      }
      
      interpolatedPoints.push({
        coordinates: [interpolatedLng, interpolatedLat],
        elevation: interpolatedElevation,
        distance: nextInterpolationDistance
      });
      
      nextInterpolationDistance += intervalMeters;
    }
    
    totalDistance = segmentEndDistance;
  }
  
  // Add last point if it's not already included
  const lastPoint = coordinates[coordinates.length - 1];
  if (lastPoint.length >= 3 && 
      (interpolatedPoints.length === 0 || 
       interpolatedPoints[interpolatedPoints.length - 1].distance < totalDistance)) {
    interpolatedPoints.push({
      coordinates: [lastPoint[0], lastPoint[1]],
      elevation: lastPoint[2],
      distance: totalDistance
    });
  }
  
  return interpolatedPoints;
}

function compareRouteGeometry(lineString1, lineString2, bufferDistance) {
  // Create buffered polygons from each route
  const line1 = turf.lineString(lineString1.coordinates);
  const line2 = turf.lineString(lineString2.coordinates);
  
  const buffer1 = turf.buffer(line1, bufferDistance / 1000, { units: "kilometers" });
  const buffer2 = turf.buffer(line2, bufferDistance / 1000, { units: "kilometers" });
  
  // Check if each route is within the other's buffer
  const line1InBuffer2 = turf.booleanWithin(line1, buffer2);
  const line2InBuffer1 = turf.booleanWithin(line2, buffer1);
  
  return {
    route1WithinRoute2Buffer: line1InBuffer2,
    route2WithinRoute1Buffer: line2InBuffer1,
    routesEqual: line1InBuffer2 && line2InBuffer1
  };
}

function compareAltitudes(points1, points2, tolerance) {
  if (points1.length === 0 && points2.length === 0) {
    return { altitudesEqual: true, differences: [], maxDifference: 0, avgDifference: 0 };
  }
  
  if (points1.length === 0 || points2.length === 0) {
    return { altitudesEqual: false, differences: [], maxDifference: Number.POSITIVE_INFINITY, avgDifference: Number.POSITIVE_INFINITY };
  }
  
  const differences = [];
  const maxDistance = Math.min(
    points1[points1.length - 1].distance,
    points2[points2.length - 1].distance
  );
  
  let p1Index = 0;
  let p2Index = 0;
  
  // Compare altitudes at matching distances
  for (let distance = 0; distance <= maxDistance; distance += 100) {
    // Find closest points at this distance
    while (p1Index < points1.length - 1 && points1[p1Index + 1].distance <= distance) {
      p1Index++;
    }
    while (p2Index < points2.length - 1 && points2[p2Index + 1].distance <= distance) {
      p2Index++;
    }
    
    if (p1Index < points1.length && p2Index < points2.length) {
      const elevation1 = points1[p1Index].elevation;
      const elevation2 = points2[p2Index].elevation;
      const difference = Math.abs(elevation1 - elevation2);
      
      differences.push({
        distance,
        elevation1,
        elevation2,
        difference
      });
    }
  }
  
  const maxDifference = differences.length > 0 ? Math.max(...differences.map(d => d.difference)) : 0;
  const avgDifference = differences.length > 0 ? differences.reduce((sum, d) => sum + d.difference, 0) / differences.length : 0;
  
  return {
    altitudesEqual: maxDifference <= tolerance,
    differences,
    maxDifference,
    avgDifference
  };
}

function main() {
  const bufferDistance = argv.buffer;
  const altitudeInterval = argv["altitude-interval"];
  const altitudeTolerance = argv["altitude-tolerance"] || bufferDistance;
  const verbose = argv.verbose;
  
  console.log(`Comparing GPX files: ${argv.file1} and ${argv.file2}`);
  console.log(`Buffer distance: ${bufferDistance}m`);
  console.log(`Altitude interval: ${altitudeInterval}m`);
  console.log(`Altitude tolerance: ${altitudeTolerance}m`);
  console.log("");
  
  // Parse GPX files
  const geoJson1 = parseGpxFile(argv.file1);
  const geoJson2 = parseGpxFile(argv.file2);
  
  // Extract linestrings
  const lineStrings1 = extractLineStrings(geoJson1);
  const lineStrings2 = extractLineStrings(geoJson2);
  
  console.log(`Routes found: ${lineStrings1.length} in file1, ${lineStrings2.length} in file2`);
  
  if (lineStrings1.length === 0 || lineStrings2.length === 0) {
    console.log("❌ No routes found in one or both files");
    process.exit(1);
  }
  
  // For simplicity, compare the first (main) route from each file
  const mainRoute1 = lineStrings1[0];
  const mainRoute2 = lineStrings2[0];
  
  console.log(`Route 1: ${mainRoute1.coordinates.length} points`);
  console.log(`Route 2: ${mainRoute2.coordinates.length} points`);
  console.log("");
  
  // Compare route geometry
  console.log("🗺️  Geometry Comparison:");
  const geometryResult = compareRouteGeometry(mainRoute1, mainRoute2, bufferDistance);
  
  console.log(`Route 1 within Route 2 buffer (${bufferDistance}m): ${geometryResult.route1WithinRoute2Buffer ? "✅" : "❌"}`);
  console.log(`Route 2 within Route 1 buffer (${bufferDistance}m): ${geometryResult.route2WithinRoute1Buffer ? "✅" : "❌"}`);
  console.log(`Routes geometrically equal: ${geometryResult.routesEqual ? "✅" : "❌"}`);
  console.log("");
  
  // Compare altitudes
  console.log("📈 Altitude Comparison:");
  const altitudePoints1 = interpolateAltitudePoints(mainRoute1, altitudeInterval);
  const altitudePoints2 = interpolateAltitudePoints(mainRoute2, altitudeInterval);
  
  console.log(`Altitude points: ${altitudePoints1.length} from route 1, ${altitudePoints2.length} from route 2`);
  
  const altitudeResult = compareAltitudes(altitudePoints1, altitudePoints2, altitudeTolerance);
  
  console.log(`Max altitude difference: ${altitudeResult.maxDifference.toFixed(2)}m`);
  console.log(`Average altitude difference: ${altitudeResult.avgDifference.toFixed(2)}m`);
  console.log(`Altitudes within tolerance (${altitudeTolerance}m): ${altitudeResult.altitudesEqual ? "✅" : "❌"}`);
  console.log("");
  
  // Overall result
  const routesEqual = geometryResult.routesEqual && altitudeResult.altitudesEqual;
  console.log(`🏁 Overall Result: Routes are ${routesEqual ? "EQUAL" : "NOT EQUAL"} ${routesEqual ? "✅" : "❌"}`);
  
  // Verbose output
  if (verbose && altitudeResult.differences.length > 0) {
    console.log("\n📊 Detailed Altitude Differences:");
    console.log("Distance(m) | Route1(m) | Route2(m) | Diff(m)");
    console.log("-----------|-----------|-----------|--------");
    for (const diff of altitudeResult.differences.slice(0, 20)) { // Show first 20
      console.log(`${diff.distance.toString().padStart(10)} | ${diff.elevation1.toFixed(1).padStart(9)} | ${diff.elevation2.toFixed(1).padStart(9)} | ${diff.difference.toFixed(1).padStart(7)}`);
    }
    if (altitudeResult.differences.length > 20) {
      console.log(`... and ${altitudeResult.differences.length - 20} more points`);
    }
  }
  
  process.exit(routesEqual ? 0 : 1);
}

main();
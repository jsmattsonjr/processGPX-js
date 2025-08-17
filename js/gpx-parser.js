/**
 * GPX parsing and route data extraction using gpxparser@3.0.8
 */
class GPXParser {
    constructor() {
        // gpxparser is loaded from CDN
    }

    /**
     * Parse GPX file and extract route data
     * @param {File} file - GPX file to parse
     * @returns {Promise<Object>} Route data with coordinates, elevation, and metadata
     */
    async parseFile(file) {
        try {
            const gpxText = await this.readFileAsText(file);
            const parser = new gpxParser();
            parser.parse(gpxText);
            
            if (!parser.tracks || parser.tracks.length === 0) {
                throw new Error('No tracks found in GPX file');
            }

            const track = parser.tracks[0]; // Use first track
            const points = this.extractTrackPoints(track);
            
            if (points.length === 0) {
                throw new Error('No track points found in GPX file');
            }

            const routeData = {
                name: track.name || 'Unnamed Route',
                points: points,
                bounds: this.calculateBounds(points),
                stats: this.calculateStats(points),
                elevationData: this.extractElevationData(points)
            };

            return routeData;
        } catch (error) {
            throw new Error(`Failed to parse GPX file: ${error.message}`);
        }
    }

    /**
     * Read file as text
     * @param {File} file 
     * @returns {Promise<string>}
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Extract track points from parsed track (gpxparser format)
     * @param {Object} track - Parsed GPX track from gpxparser
     * @returns {Array} Array of point objects
     */
    extractTrackPoints(track) {
        const points = [];
        let cumulativeDistance = 0;

        // gpxparser structure: track.points is array of points
        for (let i = 0; i < track.points.length; i++) {
            const point = track.points[i];
            
            // Calculate distance from previous point
            if (i > 0) {
                const prevPoint = points[points.length - 1];
                const distance = this.calculateDistance(
                    prevPoint.lat, prevPoint.lon,
                    point.lat, point.lon
                );
                cumulativeDistance += distance;
            }

            points.push({
                lat: point.lat,
                lon: point.lon,
                elevation: point.ele || 0,
                distance: cumulativeDistance,
                time: point.time || null
            });
        }

        return points;
    }

    /**
     * Calculate bounds for the route
     * @param {Array} points - Route points
     * @returns {Object} Bounds object
     */
    calculateBounds(points) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        for (const point of points) {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        }

        return {
            minLat,
            maxLat,
            minLon,
            maxLon,
            center: {
                lat: (minLat + maxLat) / 2,
                lon: (minLon + maxLon) / 2
            }
        };
    }

    /**
     * Calculate route statistics
     * @param {Array} points - Route points
     * @returns {Object} Statistics object
     */
    calculateStats(points) {
        if (points.length === 0) {
            return { distance: 0, elevationGain: 0, elevationLoss: 0, minElevation: 0, maxElevation: 0 };
        }

        const lastPoint = points[points.length - 1];
        const totalDistance = lastPoint.distance;

        let elevationGain = 0;
        let elevationLoss = 0;
        let minElevation = points[0].elevation;
        let maxElevation = points[0].elevation;

        for (let i = 1; i < points.length; i++) {
            const prevElevation = points[i - 1].elevation;
            const currentElevation = points[i].elevation;
            const elevationChange = currentElevation - prevElevation;

            if (elevationChange > 0) {
                elevationGain += elevationChange;
            } else {
                elevationLoss += Math.abs(elevationChange);
            }

            minElevation = Math.min(minElevation, currentElevation);
            maxElevation = Math.max(maxElevation, currentElevation);
        }

        return {
            distance: totalDistance,
            elevationGain,
            elevationLoss,
            minElevation,
            maxElevation,
            pointCount: points.length
        };
    }

    /**
     * Extract elevation data for charting
     * @param {Array} points - Route points
     * @returns {Object} Elevation chart data
     */
    extractElevationData(points) {
        const chartData = {
            labels: [],
            elevations: [],
            distances: []
        };

        // Sample points for chart (limit to reasonable number for performance)
        const maxPoints = 500;
        const step = Math.max(1, Math.floor(points.length / maxPoints));

        for (let i = 0; i < points.length; i += step) {
            const point = points[i];
            chartData.labels.push(this.formatDistance(point.distance));
            chartData.elevations.push(point.elevation);
            chartData.distances.push(point.distance);
        }

        // Always include the last point
        if (points.length > 1 && (points.length - 1) % step !== 0) {
            const lastPoint = points[points.length - 1];
            chartData.labels.push(this.formatDistance(lastPoint.distance));
            chartData.elevations.push(lastPoint.elevation);
            chartData.distances.push(lastPoint.distance);
        }

        return chartData;
    }

    /**
     * Calculate distance between two points using Haversine formula with WGS84 equatorial radius
     * @param {number} lat1 
     * @param {number} lon1 
     * @param {number} lat2 
     * @param {number} lon2 
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6378137; // WGS84 equatorial radius in meters
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees 
     * @returns {number}
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Format distance for display
     * @param {number} meters 
     * @returns {string}
     */
    formatDistance(meters) {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        }
        return `${(meters / 1000).toFixed(1)}km`;
    }
}
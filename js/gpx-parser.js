/**
 * GPX parsing using togeojson
 */
class GPXParser {
	constructor() {
		// togeojson is loaded from CDN
	}

	/**
	 * Parse GPX file to GeoJSON and return first LineString feature
	 * @param {File} file - GPX file to parse
	 * @returns {Promise<Object>} First LineString feature from GeoJSON
	 */
	async parseFile(file) {
		try {
			const gpxText = await this.readFileAsText(file);
			const gpxDoc = new DOMParser().parseFromString(gpxText, "text/xml");
			const geoJson = toGeoJSON.gpx(gpxDoc);

			if (!geoJson.features || geoJson.features.length === 0) {
				throw new Error("No tracks found in GPX file");
			}

			// Find the first LineString feature (track)
			const trackFeature = geoJson.features.find(
				(feature) => feature.geometry && feature.geometry.type === "LineString",
			);

			if (!trackFeature) {
				throw new Error("No track LineString found in GPX file");
			}

			// If track has no name, use filename without .gpx extension
			if (!trackFeature.properties || !trackFeature.properties.name) {
				const basename = file.name.replace(/\.gpx$/i, '');
				if (!trackFeature.properties) {
					trackFeature.properties = {};
				}
				trackFeature.properties.name = basename;
			}

			return trackFeature;
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
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsText(file);
		});
	}
}

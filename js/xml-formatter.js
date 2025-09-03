/**
 * XML formatting utilities for GPX output
 */

/**
 * Format XML with newlines between tags
 * @param {string} xmlString - Minified XML string
 * @returns {string} Formatted XML with newlines
 */
export function formatXML(xmlString) {
	// Simple formatter that adds newlines between tags
	return xmlString.replace(/>(<)/g, ">\n$1") + "\n";
}

/**
 * XML formatting utilities for GPX output
 */

/**
 * Format XML with proper indentation and newlines
 * @param {string} xmlString - Minified XML string
 * @returns {string} Formatted XML with indentation and newlines
 */
export function formatXML(xmlString) {
	// Simple formatter that adds newlines between tags and proper indentation
	let formatted = xmlString;
	
	// Add newlines between adjacent tags (> followed by <)
	formatted = formatted.replace(/>(<)/g, ">\n$1");
	
	// Split into lines and add proper indentation
	const lines = formatted.split("\n");
	let indentLevel = 0;
	
	return lines.map(line => {
		const trimmed = line.trim();
		if (!trimmed) return "";
		
		// Decrease indent for closing tags
		if (trimmed.startsWith("</")) {
			indentLevel = Math.max(0, indentLevel - 1);
		}
		
		const indented = "  ".repeat(indentLevel) + trimmed;
		
		// Increase indent for opening tags (but not self-closing or closing tags)
		if (trimmed.startsWith("<") && !trimmed.startsWith("</") && !trimmed.endsWith("/>") && !trimmed.startsWith("<?xml")) {
			indentLevel++;
		}
		
		return indented;
	}).join("\n") + "\n";
}
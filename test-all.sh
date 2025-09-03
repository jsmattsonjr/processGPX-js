#!/bin/bash

# Flexible script to test all GPX files with specified options
# Usage: ./test-all-flexible.sh [options...]
# Example: ./test-all-flexible.sh --auto --simplify
# Example: ./test-all-flexible.sh --spacing 5 --sigma 10

# Check for help request
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    echo "Usage: $0 [options...]"
    echo ""
    echo "This script runs all GPX files in the gpx/ directory through both"
    echo "JavaScript (process-cli.js) and Perl (processGPX) with the same options."
    echo "Output files are organized in gpx/js/ and gpx/perl/ directories."
    echo ""
    echo "Examples:"
    echo "  $0                        # No options (default processing)"
    echo "  $0 --auto --simplify"
    echo "  $0 --spacing 5 --sigma 10"
    echo "  $0 --auto --minRadius 8 --splineDegs 5"
    echo ""
    echo "After processing, use 'node compare-all-processed.js' to compare results."
    exit 0
fi

# Create output directories
mkdir -p gpx/js gpx/perl logs

# Clean up old processed files
rm -f gpx/js/*.gpx
rm -f gpx/perl/*.gpx

# Get the options string for display and filenames
options_str="$*"
options_safe=$(echo "$options_str" | sed 's/[^a-zA-Z0-9]/_/g' | sed 's/__*/_/g' | sed 's/^_\|_$//g')

echo "=== Processing all GPX files with options: $options_str ==="
echo ""

failed_files_js=0
processed_files_js=0
failed_files_perl=0
processed_files_perl=0

echo "=== JavaScript Processing ==="
echo ""

# Process with JavaScript
find gpx/ -name "*.gpx" -not -path "gpx/js/*" -not -path "gpx/perl/*" -not -name "*processed*" | sort | while IFS= read -r gpx_file; do
    base_name=$(basename "$gpx_file" .gpx)
    output_file="gpx/js/${base_name}_jsprocessed.gpx"
    log_file="logs/${base_name// /_}_${options_safe}_js.log"
    
    echo "Processing: $base_name"
    
    # Run JavaScript version with --out to specify output location
    if node process-cli.js "$gpx_file" "$@" --out "$output_file" > "$log_file" 2>&1; then
        echo "  ✅ JS: Success -> $output_file"
        ((processed_files_js++))
    else
        echo "  ❌ JS: Failed - see $log_file"
        ((failed_files_js++))
    fi
done

# Count JavaScript results
js_processed=$(find gpx/js/ -name "*.gpx" | wc -l)
echo ""
echo "JavaScript Results:"
echo "  Output files created: $js_processed"
echo ""

echo "=== Perl Processing ==="
echo ""

# Process with Perl
find gpx/ -name "*.gpx" -not -path "gpx/js/*" -not -path "gpx/perl/*" -not -name "*processed*" | sort | while IFS= read -r gpx_file; do
    base_name=$(basename "$gpx_file" .gpx)
    output_file="gpx/perl/${base_name}_processed.gpx"
    log_file="logs/${base_name// /_}_${options_safe}_perl.log"
    
    echo "Processing: $base_name"
    
    # Run Perl version with --out to specify output location  
    if ./processGPX "$gpx_file" "$@" --out "$output_file" > "$log_file" 2>&1; then
        echo "  ✅ Perl: Success -> $output_file"
        ((processed_files_perl++))
    else
        echo "  ❌ Perl: Failed - see $log_file"
        ((failed_files_perl++))
    fi
done

# Count Perl results
perl_processed=$(find gpx/perl/ -name "*.gpx" | wc -l)
echo ""
echo "Perl Results:"
echo "  Output files created: $perl_processed"
echo ""

echo "=== Processing Complete ==="
echo "Options used: $options_str"
echo "JavaScript processed files: $js_processed"
echo "Perl processed files: $perl_processed"
echo "JavaScript output directory: gpx/js/"
echo "Perl output directory: gpx/perl/"
echo ""
echo "Ready for comparison with:"
echo "  node compare-all-processed.js"
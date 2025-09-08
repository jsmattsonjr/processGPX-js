# processGPX-js

A JavaScript port of processGPX, designed to improve and create GPX files for cycling emulation platforms like BikeTerra. This project provides both a working web interface and command-line tool with the powerful GPX processing capabilities of the original Perl tool.

## About

processGPX is a series of algorithms to improve and create GPX files, particularly for cycling emulation platforms. The original tool was written for RGT and is now being ported to JavaScript for use as a client-side web application.

### Key Features

- **GPX Processing**: Improves low-resolution GPX files from online mapping tools
- **Route Smoothing**: Smooths altitude data and position coordinates to eliminate anomalies
- **Corner Rounding**: Ensures corners are sufficiently round for realistic cycling simulation
- **Gradient Correction**: Fixes anomalously large gradient changes between points
- **Point Interpolation**: Adds points where needed for better route definition
- **Out-and-Back Routes**: Creates turn-around loops and lane-shifted return paths
- **Quality Analysis**: Calculates quality scores based on gradient and direction changes

### Original processGPX

The original processGPX (v0.53) was written in Perl by Daniel Connelly. It addresses common issues with GPX files exported from tools like Strava Route Editor:

- Too low resolution in position data
- Small errors in altitude measurements
- Sharp corners that need rounding
- Gradient anomalies between points

## Project Structure

```
processGPX-js/
├── js/                       # Core JavaScript modules
│   ├── process-gpx.js        # Main GPX processing algorithms (5200+ lines, 70+ functions)
│   ├── gpx-parser.js         # GPX XML parsing
│   ├── gpx-export.js         # GPX file generation
│   ├── options.js            # CLI option definitions
│   ├── main.js               # Web interface controller
│   ├── map-visualization.js  # Leaflet map integration
│   └── elevation-chart.js    # Route elevation profiles
├── gpx/                      # Test GPX files and processing results
├── __tests__/                # Jest test suite with fuzzing
├── debug/                    # Processing debug outputs
├── coverage/                 # Test coverage reports
├── index.html               # Web interface
├── process-cli.js           # Command-line interface
├── fuzz-cli.js              # CLI option fuzzer
└── gpx-compare.js           # GPX file comparison utility
```

## Testing

This project uses Jest for testing with a comprehensive fuzzing approach to ensure robust coverage of the GPX processing pipeline.

### Test Setup

The testing framework combines:
- **CLI Option Fuzzer**: Generates random combinations of CLI options for comprehensive testing
- **Jest Integration**: Collects code coverage while testing both `process-cli.js` and `js/process-gpx.js`
- **Direct Function Testing**: Tests the core processing functions with realistic option combinations

### Running Tests

```bash
# Run basic tests
npm test

# Run tests with coverage reporting
npm run test:coverage

# Run standalone fuzzer (without Jest)
npm run test:fuzz 50  # Run 50 random test combinations
```

### Fuzzing Architecture

The fuzzer (`fuzz-cli.js`) provides comprehensive testing by:
1. **Generating Random Options**: Creates realistic combinations of CLI options
2. **Testing Multiple GPX Files**: Uses 70+ real-world GPX files from the `gpx/` directory
3. **Validating Constraints**: Respects option dependencies and mutual exclusions
4. **Collecting Coverage**: Jest tracks code paths exercised during fuzzing

```bash
# Generate sample fuzz commands
node fuzz-cli.js --generate

# Generate option arrays for Jest
node fuzz-cli.js --generate-options
```

### Test Coverage

The Jest setup captures coverage from:
- **CLI Processing** (`process-cli.js`): Argument parsing, file I/O, error handling
- **Core Algorithms** (`js/process-gpx.js`): GPX processing pipeline, smoothing, interpolation
- **Edge Cases**: Random option combinations reveal corner cases and error conditions

Example coverage output:
```
--------------------------|---------|----------|---------|---------|
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
process-cli.js           |   85.2  |   73.1   |  100.0  |   84.8  |
js/process-gpx.js        |   78.9  |   65.4   |   91.3  |   78.2  |
--------------------------|---------|----------|---------|---------|
```

## Debugging

The `dumpPoints()` function in `js/process-gpx.js` is used to dump the state of the points array at various stages of processing. These dumps are saved as tab-separated text files in the `debug/` directory.

A utility script, `debug_to_gpx.js`, is provided to convert these debug files back into GPX format for visualization and analysis.

### Converting Debug Dumps to GPX

To convert a debug file to a GPX file, run the following command:

```bash
npm run debug:to-gpx -- debug/your_debug_file.txt
```

This will create a new file, `your_debug_file.gpx`, in the same directory.

## Usage

The project provides both a web interface and command-line tool:

### Web Interface

The web interface uses ES6 modules and requires serving through an HTTP server (not opening directly with `file://`).

**Running the Web Interface:**

```bash
# Option 1: Using Python
python3 -m http.server 8000

# Option 2: Using Node.js
npx serve .

# Option 3: Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

**Features:**
- Drag and drop GPX files for processing
- Interactive map visualization with before/after comparison
- Elevation profile charts
- Downloadable processed GPX files
- Real-time processing with configurable options

### Command Line Interface

Process GPX files from the command line:

```bash
# Basic usage with auto processing
node process-cli.js input.gpx

# Custom options
node process-cli.js input.gpx --smooth 15 --smoothZ 25 --spacing 10

# Loop processing
node process-cli.js loop.gpx --loop --spacing 5

# Out-and-back route creation
node process-cli.js route.gpx --outAndBack --laneShift 3
```

The CLI supports all major processGPX options including smoothing, spacing, loop processing, and advanced features.

## Key Processing Options

The JavaScript port implements the full range of processGPX options:

- `auto`: Automatic processing with reasonable defaults
- `smooth`: Position smoothing distance in meters
- `smoothZ`: Altitude smoothing distance in meters  
- `spacing`: Point interpolation spacing in meters
- `loop`: Treat as loop/circuit course
- `outAndBack`: Create out-and-back course with turn-around
- `laneShift`: Shift lanes for out-and-back separation
- `minRadius`: Minimum corner radius enforcement
- `prune`: Remove unnecessary points
- `straighten`: Straighten sections of route
- `simplify`: Reduce point density while preserving route shape

See `node process-cli.js --help` for the complete list of available options.

## Development Status

**Current Status: Functional Beta (v0.1.1)**

This JavaScript port of processGPX is now functionally complete with the core processing pipeline implemented:

✅ **Completed Features:**
- Core GPX parsing and generation
- Position and altitude smoothing algorithms (Gaussian smoothing)
- Point interpolation and spacing algorithms
- Corner detection, rounding, and spline fitting
- Gradient analysis and correction
- Out-and-back route generation with lane shifting
- Loop/circuit processing
- Route straightening and simplification
- Quality scoring system
- Web interface with interactive maps and elevation charts
- Command-line interface with full option support
- Comprehensive testing with fuzzing (70+ functions, 5200+ lines of core algorithms)
- XML formatting and GPX export
- Route comparison and validation tools

🚧 **In Development:**
- Expanded web interface options and controls

## Target Platforms

- **BikeTerra**: Primary target for custom route creation
- **RGT**: Original target platform (now legacy)
- **General GPX**: Any platform accepting standard GPX files

## Reference

This JavaScript port is based on the original processGPX v0.53 by Daniel Connelly, maintaining algorithmic compatibility while providing modern web and CLI interfaces. The project has been synchronized with processGPX version 0.53 as of the latest commits.

## License

Following Perl's licensing model, this project is available under either:
- GNU General Public License (GPL)
- Artistic License

You may choose either license that best fits your needs. See the LICENSE file for complete terms.

## Contributing

This project is in early development. Contributions are welcome as the codebase takes shape.

## Acknowledgments

- Original processGPX by Daniel Connelly
- Designed for cycling simulation platforms
- Based on real-world GPX processing needs for route creation

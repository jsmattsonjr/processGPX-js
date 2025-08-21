# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About processGPX-js

This is a JavaScript port of the original Perl processGPX tool (v0.52) designed to improve and create GPX files for cycling emulation platforms like BikeTerra. The project is in early development, porting comprehensive GPX processing algorithms from Perl to JavaScript for client-side browser usage and Node.js environments.

## Development Guidelines

### Code Standards and Formatting
- Prefer `""` for string literals
- Add a newline at EOF
- Replace `console.warn()` with `console.log()` for translations of Perl's `warn()` - Perl's `warn()` doesn't dump a backtrace
- Use biome format --write before git commit

### Testing and Development Commands
- Use biome check --fix before git commit, and fix any remaining issues 
- Use `node process-cli.js <filename>` to test the processGPX pipeline
- Sample input file: `Twin_Bridges_Scenic_Bikeway.gpx`
- Feel free to modify the local copy (`./processGPX`) of the Perl reference script for debugging

## Architecture

The JavaScript port implements a dual-target architecture:

### Browser Environment
- Client-side GPX processing without server dependencies
- Web interface for drag-and-drop GPX file processing
- Real-time preview of processing results
- Downloadable processed GPX files

### Node.js Environment  
- Command-line interface matching original processGPX functionality
- Programmatic API for server-side GPX processing
- Batch processing capabilities

### Core Processing Pipeline
1. **GPX Parsing** - Parse XML GPX format into JavaScript objects
2. **Track Processing** - Extract and process track points, segments
3. **Algorithm Application** - Apply smoothing, interpolation, and optimization
4. **Quality Assessment** - Calculate route quality metrics
5. **GPX Generation** - Export processed data back to GPX format

## Implementation Details

### Core Algorithms
- **Position Smoothing** - Gaussian smoothing for route coordinates
- **Altitude Smoothing** - Separate altitude processing with gradient preservation
- **Point Interpolation** - Dynamic point spacing based on route geometry
- **Corner Detection** - Identify and process sharp turns
- **Route Quality Scoring** - Metrics based on gradient and direction changes

### Processing Options
- `auto` mode with intelligent defaults
- Position and altitude smoothing with configurable radii
- Point spacing and interpolation controls
- Loop vs point-to-point route detection
- Out-and-back route generation with lane shifting
- Corner radius enforcement and spline fitting

### API Design Pattern
```javascript
const processor = new ProcessGPX();
const result = await processor
  .loadFile(gpxInput)
  .process(options)
  .quality()
  .export();
```

## Reference Implementation

The original Perl implementation is located in `reference/processGPX/` and provides:
- Complete algorithm specifications in `processGPX.pdf`
- Working Perl code for algorithm reference
- Test GPX files for validation
- Comprehensive option documentation

### Working with Reference Code
- When searching for `sub <function_name>` in the Perl reference, read several lines above that line to capture any function header comment that might precede the string match

### Known Issues in Reference Code
When crossporting code from `reference/processGPX/processGPX`, be watchful for bugs that have been identified in the Perl source:

1. **Floating point precision issue** in `cropCorners()` modulo operations (commit 338961b)
2. **L2 assignment bug** in `autoStraighten()` function (commit c679fd6)
3. **Elevation differences ignored** in `pointsAreClose()` function (commit ee3854f)
4. **Inconsistent documentation** - `-auto` sets `-RUTurn 6` (commit e777e96)

The Perl reference code, while comprehensive, is not perfect and should be reviewed carefully during porting.

### JavaScript Porting Guidelines

When translating Perl function signatures to JavaScript, use named positional parameters rather than destructured object parameters:

```javascript
// Preferred - like autoStraighten()
function processPoints(points, isLoop, minLength, maxDeviation) {
    // Function body
}

// Avoid - like cropPoints()  
function processPoints({
    points,
    isLoop = 0,
    minLength,
    maxDeviation
}) {
    // Function body
}
```

This approach maintains consistency with the `autoStraighten()` pattern and provides cleaner function signatures.

#### Critical Perl to JavaScript Translation Issues

When porting Perl code to JavaScript, be aware of these subtle but critical differences:

1. **Array Length vs Last Index**:
   - Perl: `$#array` = last valid index (length - 1)
   - JavaScript: `array.length` = number of elements
   - When translating `$#points - 1` use `points.length - 2`

2. **Array Auto-vivification**:
   - Perl: `$array[index]++` automatically creates array elements and treats `undef` as 0
   - JavaScript: `array[index]++` on undefined results in `NaN`, breaking numeric logic
   - Solution: Use `array[index] = (array[index] || 0) + 1; if (array[index] > 1) ...`

These issues can cause infinite loops or incorrect behavior that's difficult to debug.

### Key Algorithms to Port
- Gaussian smoothing for position and altitude
- Spline interpolation for corner rounding  
- Point density optimization
- Route snapping for overlapping segments
- Quality metric calculations

## Target Platforms

- **BikeTerra** - Primary target for custom route creation
- **General GPX** - Standard GPX compatibility for any platform
- **RGT** - Legacy support (original target platform)

## Development Approach

1. Start with core GPX parsing and generation
2. Implement basic smoothing algorithms
3. Add point interpolation and spacing
4. Build quality assessment system
5. Create web interface and CLI
6. Add advanced features (out-and-back, segments, etc.)

The original processGPX handles 100+ command-line options - the JavaScript port should prioritize the most commonly used features first, with `auto` mode providing sensible defaults.

## Git Commit Guidelines

When creating git commits, include proper co-authorship:

```bash
git commit -m "Commit message

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Jim Mattson <jsmattsonjr@gmail.com>"
```


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About processGPX-js

This is a JavaScript port of the original Perl processGPX tool (v0.52) designed to improve and create GPX files for cycling emulation platforms like BikeTerra. The project is in early development, porting comprehensive GPX processing algorithms from Perl to JavaScript for client-side browser usage and Node.js environments.

## Code Standards and Formatting

Prefer "" for string literals.
Add a newline at EOF.

## Planned Architecture

The JavaScript port will implement a dual-target architecture:

### Browser Environment
- Client-side GPX processing without server dependencies
- Web interface for drag-and-drop GPX file processing
- Real-time preview of processing results
- Downloadable processed GPX files

### Node.js Environment  
- Command-line interface matching original processGPX functionality
- Programmatic API for server-side GPX processing
- Batch processing capabilities

### Core Processing Pipeline (To Be Implemented)

1. **GPX Parsing** - Parse XML GPX format into JavaScript objects
2. **Track Processing** - Extract and process track points, segments
3. **Algorithm Application** - Apply smoothing, interpolation, and optimization
4. **Quality Assessment** - Calculate route quality metrics
5. **GPX Generation** - Export processed data back to GPX format

## Key Components to Implement

Based on the original processGPX functionality:

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

### Known Issues in Reference Code

When crossporting code from `reference/processGPX/processGPX`, be watchful for bugs that have been identified in the Perl source:

1. **Floating point precision issue** in `cropCorners()` modulo operations (commit 338961b)
2. **L2 assignment bug** in `autoStraighten()` function (commit c679fd6)
3. **Elevation differences ignored** in `pointsAreClose()` function (commit ee3854f)
4. **Inconsistent documentation** - `-auto` sets `-RUTurn 6` (commit e777e96)

The Perl reference code, while comprehensive, is not perfect and should be reviewed carefully during porting.

Key algorithms to port:
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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About processGPX-js

This is a JavaScript port of the original Perl processGPX tool (v0.53) designed to improve and create GPX files for cycling emulation platforms like BikeTerra. The project is in early development, porting comprehensive GPX processing algorithms from Perl to JavaScript for client-side browser usage and Node.js environments.

## Development Guidelines

### Code Standards and Formatting
- Prefer `""` for string literals
- Add a newline at EOF
- Use `warn()` function for translations of Perl's `warn()` - this maps to `console.log()` since Perl's `warn()` doesn't dump a backtrace
- Use biome format --write before git commit

### Testing and Development Commands
- Use biome check --fix before git commit, and fix any remaining issues 
- Use `node process-cli.js <filename>` to test the processGPX pipeline
- Sample input file: `gpx/Twin_Bridges_Scenic_Bikeway.gpx`
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
5. **Incomplete zig-zag repair** in `fixZigZags()` function - the Perl version only extends `v` forward when eliminating UTurns, but fails to extend `u` backwards as described in the algorithm comments. The JavaScript version correctly implements both forward and backward extension, resulting in more thorough zig-zag elimination.

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
   - Perl: `$#$array` = last valid index (length - 1)
   - JavaScript: `array.length` = number of elements
   - When translating `$#$points` use `maxIndex(points)`

2. **Array Auto-vivification**:
   - Perl: `$array[index]++` automatically creates array elements and treats `undef` as 0
   - JavaScript: `array[index]++` on undefined results in `NaN`, breaking numeric logic
   - Solution: Use `array[index] = (array[index] || 0) + 1; if (array[index] > 1) ...`

3. **Negative Array Indexing**:
   - Perl: `$array[-1]` returns the last element, `$array[-2]` returns second-to-last, etc.
   - JavaScript: `array[-1]` returns `undefined` (negative indices are not supported)
   - Solution: Use the `ix(arr, i)` helper function: `ix(points, -1)` instead of `points[-1]`
   - The `ix()` function handles both positive and negative indices correctly using modulo arithmetic
   - For assignments to negative indices, normalize the index manually or use proper modulo arithmetic

These issues can cause infinite loops or incorrect behavior that's difficult to debug.

### Version Upgrades and Algorithmic Changes

When upgrading the JavaScript port to match newer versions of processGPX, be aware that some changes involve major algorithmic rewrites, not just minor modifications:

#### processGPX 0.52 → 0.53 Upgrade Lessons (January 2025)

This upgrade involved **6 major algorithmic changes** that required complete function rewrites:

1. **`latlng2dxdy()` - Spherical Geometry**: Changed from linear approximation to proper spherical coordinate calculation using distance and heading formulas. This is a fundamental change that affects all coordinate interpolation.

2. **`interpolateFields()` - New Function**: Added to handle field interpolation for spline functions, replacing inline code that was duplicated across multiple functions.

3. **`interpolatePoint()` - Distance-Based Interpolation**: Changed from simple linear lat/lng interpolation to using `latlng2dxdy()` and `addVectorToPoint()` for accurate spherical geometry.

4. **`interpolateCorner()` - Catmull-Rom Splines**: Complete rewrite from simple 4-point averaging to proper Catmull-Rom spline mathematics with normalized distance parameters.

5. **`splineInterpolation()` - 4-Point Catmull-Rom**: Complete algorithmic change from direction-based spline generation to 4-point Catmull-Rom splines, changing both the algorithm and function signature.

6. **`fixZigZags()` - Loop Support & Iterations**: Added multi-iteration logic (up to 10 passes), proper loop route support, and improved zig-zag detection ranges.

#### Key Insights for Future Upgrades

- **Function signatures can change**: Don't assume parameter lists remain the same
- **Dependencies cascade**: Changes to fundamental functions like `latlng2dxdy()` affect many other functions
- **Test thoroughly**: Algorithmic changes can introduce subtle bugs that only appear with specific route geometries
- **Check all callers**: When function signatures change, update all call sites
- **Use positional parameters**: Maintain consistency with the established pattern rather than switching to destructured objects
- **Follow the diff carefully**: Version upgrade diffs from the Perl source are the authoritative reference for changes

#### Recommended Upgrade Process

1. **Read the complete diff**: Understand all changes before starting implementation
2. **Identify algorithmic vs cosmetic changes**: Focus on algorithmic changes first
3. **Update fundamental functions first**: Start with utility functions that other functions depend on
4. **Test incrementally**: Test after each major function update
5. **Update all callers**: When signatures change, find and update all call sites
6. **Validate with reference**: Compare output with Perl version to ensure correctness

### Translation Progress and Function Organization

The JavaScript functions in `js/process-gpx.js` are organized to exactly match the Perl function ordering from `reference/processGPX/processGPX`. This makes it easy to:
- Compare implementations side-by-side
- Check if dependencies are already translated
- Find the correct placement for new translations

#### Function Translation Status (81/110 Complete)

**✅ Translated Functions** (81):
- Basic math: `transition`, `reduceAngle`, `averageAngles`, `deltaAngle`, `deltaxy`, `deltalngRadians`, `deltalng`
- Distance/geometry: `latlngDistance`, `pointsAreClose`, `latlngDotProduct`, `crossProduct`, `latlngCrossProduct`, `turnDirection`, `latlngAngle`, `latlngDirection`, `pointDirection`, `latlng2dxdy`
- Point operations: `shiftPoint`, `shiftVertex`, `interpolatePoint`, `interpolateCorner`, `addVectorToLatLng`, `addVectorToPoint`, `interpolateFields`
- Geometric algorithms: `segmentIntercept`, `splineInterpolation`, `arcFitInterpolation`, `circle3PointFit`
- Point processing: `removeDuplicatePoints`, `checkAutoLoop`, `cropCorners`, `arcFit`, `addSplines`, `fixZigZags`, `fixSteps`, `findLoops`
- Lane operations: `applyLaneShift`
- Smoothing: `smoothing`, `calcSmoothingSigma`
- Spacing/interpolation: `doAutoSpacing`, `doPointInterpolation`
- Road detection: `xyPointOnLine`, `isPointOnLine`, `isPointOnCorner`, `roadTest`, `snapPoints`
- Point filtering: `isPointPrunable`, `simplifyPoints`
- Speed modeling: `bikeSpeedModel`, `distanceDifference`, `pointSeparation`
- Straightening: `straightenPoints`, `calcDeviationStats`, `autoStraighten`
- Field operations: `addDistanceField`, `addDistanceFieldIfNeeded`, `addGradientField`, `integrateGradientField`, `addDirectionField`, `addHeadingField`, `addCurvatureField`, `calcCourseDistance`
- Data management: `deleteField`, `deleteExtensionField`, `deleteField2`, `deleteDerivedFields`
- Route operations: `reversePoints`, `cropPoints`, `UTurnCheck`, `makeLoop`
- Quality: `calcQualityScore`
- Utilities: `note`

**❌ Not Yet Translated** (29):
- File operations: `setFileNameSuffix`, `loadURL`, `loadGPX`, `loadBTRoute`
- Point utilities: `points2String`, `checkForUndefinedPoints`, `copyPoint`, `copyField`, `createLinks`, `linkedListToPoints`, `isPointInInterval`
- Geometry: `splicePoints`, `pointAtPosition`, `bracketPosition`, `fieldAtPosition`, `fitCircle`, `processCircle`
- Climbing analysis: `climbRating`, `findClimbs`, `placeGradientSigns`, `findCorners`, `addCornerWaypoints`
- Auto segments: `addAutoSegments`
- Straightening: `processStraight`, `checkRange`, `findArcs`, `fitArc`, `fitArcs`, `findAndFitArcs`
- Circuit operations: `circuitFromPosition`, `shiftCircuit`, `calcSeparation`
- Spacing: `applySelectiveSpacing`, `applyUniformGradient`
- Time: `addDuration`, `distanceAtDuration`, `addTime`
- Profile operations: `simplifyProfile`, `simplifyMonotonicProfile`
- Route operations: `splitPoints`, `fixMissingElevation`
- Extensions: `addPointExtensions`, `flattenPointExtensions`, `getExtensions`, `addExtensions`

#### Finding Function Placement

When translating a new Perl function:
1. Find its position in the Perl `sub` declaration order (use `grep '^sub ' reference/processGPX/processGPX`)
2. Look for the corresponding `// TODO: Translate functionName() from Perl` comment in `js/process-gpx.js`
3. Replace the TODO comment with the translated function
4. Check dependencies - all functions above it in the Perl order should already be translated

#### Checking Dependencies

Before translating a function, verify its dependencies are already available:
- Functions can call any function that appears **earlier** in the Perl ordering
- Functions can call utility functions (at the top of the file)
- If a dependency is missing (has a TODO comment), translate it first

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


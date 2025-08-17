# processGPX-js

A JavaScript port of processGPX, designed to improve and create GPX files for cycling emulation platforms like BikeTerra. This client-side application brings the powerful GPX processing capabilities of the original Perl tool to the browser.

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

The original processGPX (v0.52) was written in Perl by Daniel Connelly. It addresses common issues with GPX files exported from tools like Strava Route Editor:

- Too low resolution in position data
- Small errors in altitude measurements
- Sharp corners that need rounding
- Gradient anomalies between points

## Project Structure

```
processGPX-js/
├── reference/processGPX/     # Original Perl documentation and reference
├── src/                      # JavaScript source code
├── docs/                     # Documentation
├── examples/                 # Example GPX files and usage
├── tests/                    # Test files
└── dist/                     # Built distribution files
```

## Usage (Planned)

The JavaScript port will provide both programmatic API access and a web interface:

### Web Interface
```html
<!-- Load processGPX in the browser -->
<script src="processGPX.js"></script>
<script>
  const processor = new ProcessGPX();
  processor.loadFile(gpxFile)
    .process({ auto: true })
    .then(result => {
      // Download processed GPX
      result.download();
    });
</script>
```

### Node.js API
```javascript
import { ProcessGPX } from 'processGPX-js';

const processor = new ProcessGPX();
const result = await processor
  .loadFile('input.gpx')
  .process({
    auto: true,
    smooth: 10,
    smoothZ: 20,
    spacing: 5
  });

await result.save('output.gpx');
```

## Key Processing Options (Planned)

Based on the original processGPX functionality:

- `auto`: Automatic processing with reasonable defaults
- `smooth`: Position smoothing distance in meters
- `smoothZ`: Altitude smoothing distance in meters
- `spacing`: Point interpolation spacing in meters
- `loop`: Treat as loop/circuit course
- `outAndBack`: Create out-and-back course with turn-around
- `laneShift`: Shift lanes for out-and-back separation
- `minRadius`: Minimum corner radius enforcement
- `prune`: Remove unnecessary points

## Development Status

🚧 **This project is currently in development** 🚧

This is a port of the original Perl processGPX tool to JavaScript. The following components are planned:

- [ ] Core GPX parsing and generation
- [ ] Position and altitude smoothing algorithms
- [ ] Point interpolation and spacing
- [ ] Corner detection and rounding
- [ ] Gradient analysis and correction
- [ ] Out-and-back route generation
- [ ] Quality scoring system
- [ ] Web interface for browser usage
- [ ] Command-line interface for Node.js

## Target Platforms

- **BikeTerra**: Primary target for custom route creation
- **RGT**: Original target platform (now legacy)
- **General GPX**: Any platform accepting standard GPX files

## Reference

This JavaScript port is based on the original processGPX v0.52 by Daniel Connelly. See `reference/processGPX/` for the complete original documentation and specifications.

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
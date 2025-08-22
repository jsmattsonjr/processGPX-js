import re

def apply_changes(content):
    lines = content.split('\n')

    # Stage 0
    lines.insert(4824, "# Stage 0: Initial Points from GPX")
    lines[4848] = re.sub(r'perl-00-original.txt', 'perl-00-initial-points.txt', lines[4848])

    # Stage 1
    lines.insert(4850, "# Stage 1: Remove Duplicate Points")

    # Stage 2
    lines.insert(4854, "# Stage 2: Repeat Track")

    # Stage 3
    lines.insert(4890, "# Stage 3: Crop Points")

    # Stage 4
    lines.insert(4950, "# Stage 4: Fix Zig-Zags")

    # Stage 5
    lines.insert(4955, "# Stage 5: Adjust Altitudes")

    # Stage 6
    lines.insert(4975, "# Stage 6: Reverse Course")

    # Stage 7
    lines.insert(4982, "# Stage 7: Crop Corners")

    # Stage 8
    lines.insert(5008, "# Stage 8: Auto-Straighten")

    # Stage 9
    lines.insert(5050, "# Stage 9: Snap Repeated Points (Pass 1)")

    # Stage 10
    lines.insert(5063, "# Stage 10: Add Corner Splines")
    lines[5068] = re.sub(r'perl-10-after-splines.txt', 'perl-10-splines-added.txt', lines[5068])

    # Stage 11
    lines.insert(5069, "# Stage 11: Add Corner Arc Fits")
    lines[5074] = re.sub(r'perl-11-after-arcfit.txt', 'perl-11-arcfit-added.txt', lines[5074])

    # Stage 12
    lines.insert(5078, "# Stage 12: Auto-Spacing at Corners")

    # Stage 13
    lines.insert(5090, "# Stage 13: Point Interpolation")
    lines.insert(5097, '    dumpPoints($points, "perl-13-interpolated.txt");')

    # Stage 14
    lines.insert(5099, "# Stage 14: Process Straight Sections")
    lines.insert(5104, '    dumpPoints($points, "perl-14-straights-processed.txt");')

    # Stage 15
    lines.insert(5105, "# Stage 15: Process Circular Fits")
    lines.insert(5110, '    dumpPoints($points, "perl-15-circles-processed.txt");')

    # Stage 16
    lines.insert(5111, "# Stage 16: Snap Repeated Points (Pass 2)")
    lines.insert(5123, '    dumpPoints($points, "perl-16-snapped-pass2.txt");')

    # Stage 17
    lines.insert(5220, "# Stage 17: Add Corner Splines (Post-smoothing)")
    lines.insert(5224, '    dumpPoints($points, "perl-17-splines-added-post-smoothing.txt");')

    # Stage 18
    lines.insert(5225, "# Stage 18: Add Corner Arc Fits (Post-smoothing)")
    lines.insert(5229, '    dumpPoints($points, "perl-18-arcfit-added-post-smoothing.txt");')

    # Stage 19
    lines.insert(5230, "# Stage 19: Flatten Sections")

    # Stage 20
    lines.insert(5253, "# Stage 20: Fix Crossings")

    # Stage 21
    lines.insert(5406, "# Stage 21: Auto-Segments")

    # Stage 22
    lines.insert(5458, "# Stage 22: Final Crop")
    lines.insert(5464, '    dumpPoints($points, "perl-22-final-crop.txt");')

    # Stage 23
    lines.insert(5465, "# Stage 23: Prune Points")

    # Stage 24
    lines.insert(5530, "# Stage 24: Apply Lane Shift")
    lines.insert(5566, '    dumpPoints($points, "perl-24-lane-shift-applied.txt");')

    # Stage 25
    lines.insert(5567, "# Stage 25: Add Return Points (Out-and-back)")
    lines.insert(5572, '    dumpPoints($points, "perl-25-return-points-added.txt");')

    # Stage 26
    lines.insert(5573, "# Stage 26: Crop for extendBack")
    lines.insert(5575, '  dumpPoints($points, "perl-26-cropped-for-extend-back.txt")')

    # Stage 27
    lines.insert(5577, "# Stage 27: Add U-Turn Loops")

    # Stage 28
    lines.insert(5648, "# Stage 28: Apply Minimum Radius")

    # Stage 29
    lines.insert(5712, "# Stage 29: Shift Start/Finish")

    # Stage 30
    lines.insert(5767, "# Stage 30: Copy Start Point to End")
    lines.insert(5776, '    dumpPoints($points, "perl-30-start-point-copied.txt");')

    return "\n".join(lines)

with open('processGPX', 'r') as f:
    content = f.read()

new_content = apply_changes(content)

with open('processGPX_new', 'w') as f:
    f.write(new_content)

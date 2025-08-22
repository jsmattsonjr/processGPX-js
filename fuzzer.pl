#!/usr/bin/env perl
use strict;
use warnings;

# List of options for processGPX
# Based on GetOptions call in processGPX script
my @options = (
    # Flags (boolean)
    { name => 'addCurvature', type => 'flag' },
    { name => 'addDirection', type => 'flag' },
    { name => 'addDistance', type => 'flag' },
    { name => 'addGradient', type => 'flag' },
    { name => 'addGradientSigns', type => 'flag' },
    { name => 'addSigma', type => 'flag' },
    { name => 'anchorSF', type => 'flag' },
    { name => 'auto', type => 'flag' },
    { name => 'autoLap', type => 'flag' },
    { name => 'autoSpacing', type => 'flag' },
    { name => 'copyPoint', type => 'flag' },
    { name => 'csv', type => 'flag' },
    { name => 'enableAdvancedSmoothing', type => 'flag' },
    { name => 'enableElevationFixes', type => 'flag' },
    { name => 'fixCrossings', type => 'flag' },
    { name => 'help', type => 'flag' },
    { name => 'loop', type => 'flag' },
    { name => 'loopLeft', type => 'flag' },
    { name => 'loopRight', type => 'flag' },
    { name => 'noSave', type => 'flag' },
    { name => 'outAndBack', type => 'flag' },
    { name => 'outAndBackLap', type => 'flag' },
    { name => 'prune', type => 'flag' },
    { name => 'quiet', type => 'flag' },
    { name => 'reverse', type => 'flag' },
    { name => 'saveSimplifiedCourse', type => 'flag' },
    { name => 'stripSegments', type => 'flag' },
    { name => 'version', type => 'flag' },

    # String
    { name => 'author', type => 'string' },
    { name => 'copyright', type => 'string' },
    { name => 'description', type => 'string' },
    { name => 'keywords', type => 'string' },
    { name => 'title', type => 'string' },
    { name => 'out', type => 'string' },
    { name => 'segments', type => 'string' },
    { name => 'startTime', type => 'string' },
    { name => 'autoSegmentNames', type => 'string' },

    # Integer
    { name => 'disableAdvancedSmoothing', type => 'int' },
    { name => 'disableElevationFixes', type => 'int' },
    { name => 'finishCircuits', type => 'int' },
    { name => 'repeat', type => 'int', range => [0, 99] },
    { name => 'snap', type => 'int', range => [0, 2] },
    { name => 'autoSplits', type => 'int' },
    { name => 'splitNumber', type => 'int' },
    { name => 'track', type => 'int' },

    # Float
    { name => 'append', type => 'float' },
    { name => 'arcFitDegs', type => 'float' },
    { name => 'arcFitEnd', type => 'float' },
    { name => 'arcFitMaxDegs', type => 'float' },
    { name => 'arcFitStart', type => 'float' },
    { name => 'autoSegmentMargin', type => 'float' },
    { name => 'autoSegmentFinishMargin', type => 'float' },
    { name => 'autoSegmentStartMargin', type => 'float' },
    { name => 'autoSegmentPower', type => 'float' },
    { name => 'autoSegmentStretch', type => 'float' },
    { name => 'autoSmoothZ', type => 'float' },
    { name => 'autoStraightenLength', type => 'float' },
    { name => 'autoStraightenDeviation', type => 'float' },
    { name => 'cornerCrop', type => 'float' },
    { name => 'cornerEffect', type => 'float' },
    { name => 'cropMax', type => 'float' },
    { name => 'cropMin', type => 'float' },
    { name => 'crossingAngle', type => 'float' },
    { name => 'crossingHeight', type => 'float' },
    { name => 'crossingTransition', type => 'float' },
    { name => 'extend', type => 'float' },
    { name => 'extendBack', type => 'float' },
    { name => 'finishCircuitDistance', type => 'float' },
    { name => 'gSmooth', type => 'float' },
    { name => 'gradientPower', type => 'float' },
    { name => 'gradientThreshold', type => 'float' },
    { name => 'spacing', type => 'float' },
    { name => 'laneShift', type => 'float' },
    { name => 'shiftEnd', type => 'float' },
    { name => 'laneShiftSF', type => 'float' },
    { name => 'shiftStart', type => 'float' },
    { name => 'shiftTransition', type => 'float' },
    { name => 'maxCornerCropDegs', type => 'float' },
    { name => 'maxSlope', type => 'float' },
    { name => 'minCornerCropDegs', type => 'float' },
    { name => 'minRadius', type => 'float' },
    { name => 'minRadiusStart', type => 'float' },
    { name => 'minRadiusEnd', type => 'float' },
    { name => 'prepend', type => 'float' },
    { name => 'pruneD', type => 'float' },
    { name => 'pruneX', type => 'float' },
    { name => 'prunedg', type => 'float' },
    { name => 'rCrossings', type => 'float' },
    { name => 'rLap', type => 'float' },
    { name => 'rTurnaround', type => 'float' },
    { name => 'rUTurn', type => 'float' },
    { name => 'shiftZ', type => 'float' },
    { name => 'zShiftEnd', type => 'float' },
    { name => 'zShiftStart', type => 'float' },
    { name => 'smooth', type => 'float' },
    { name => 'smoothAngle', type => 'float' },
    { name => 'smoothEnd', type => 'float' },
    { name => 'smoothStart', type => 'float' },
    { name => 'smoothG', type => 'float' },
    { name => 'smoothZ', type => 'float' },
    { name => 'snapDistance', type => 'float' },
    { name => 'snapAltitude', type => 'float' },
    { name => 'splineDegs', type => 'float' },
    { name => 'splineEnd', type => 'float' },
    { name => 'splineMaxDegs', type => 'float' },
    { name => 'splineStart', type => 'float' },
    { name => 'startCircuitDistance', type => 'float' },
    { name => 'zOffset', type => 'float' },
    { name => 'zScaleRef', type => 'float' },
    { name => 'zScale', type => 'float' },

    # Array of floats
    { name => 'autoSegments', type => 'float_array', range => [1, 2] },
    { name => 'autoStraighten', type => 'float_array', range => [0, 2] },
    { name => 'circleStart', type => 'float_array', range => [1, 5] },
    { name => 'circleEnd', type => 'float_array', range => [1, 5] },
    { name => 'circle', type => 'float_array', range => [1, 5] },
    { name => 'circuitFromPosition', type => 'float_array', range => [1, 5] },
    { name => 'circuitToPosition', type => 'float_array', range => [1, 3] },
    { name => 'deleteRange', type => 'float_array', range => [1, 5] },
    { name => 'flatten', type => 'float_array', range => [1, 5] },
    { name => 'selectiveLaneShift', type => 'float_array', range => [0, 5] },
    { name => 'selectiveGSmooth', type => 'float_array', range => [0, 5] },
    { name => 'selectiveSmooth', type => 'float_array', range => [0, 5] },
    { name => 'selectiveSmoothZ', type => 'float_array', range => [0, 5] },
    { name => 'splitAt', type => 'float_array', range => [1, 5] },
    { name => 'straight', type => 'float_array', range => [1, 5] },
    { name => 'straightStart', type => 'float_array', range => [1, 5] },
    { name => 'straightEnd', type => 'float_array', range => [1, 5] },

    # Array of strings
    { name => 'join', type => 'string_array', range => [1, 3] },
);

# Function to generate a random string
sub random_string {
    my ($len) = @_;
    $len //= int(rand(10)) + 1;
    my @chars = ('a'..'z', 'A'..'Z', '0'..'9', ' ', '-', '_');
    my $string = '';
    $string .= $chars[rand @chars] for 1..$len;
    return "'$string'";
}

# Function to generate a random float
sub random_float {
    return rand(1000) - 500;
}

# Function to generate a random integer
sub random_int {
    my ($range) = @_;
    if ($range) {
        return int(rand($range->[1] - $range->[0] + 1)) + $range->[0];
    }
    return int(rand(2000)) - 1000;
}

# Main fuzzing loop
my $num_tests = 100; # Number of fuzzed commands to generate
for (1..$num_tests) {
    my @cmd_parts = ('./processGPX');

    # Randomly select a number of options to use
    my $num_options_to_use = int(rand(scalar(@options) / 2)) + 1;

    my %used_options;
    for (1..$num_options_to_use) {
        my $option_ref = $options[rand @options];
        my $option = { %$option_ref }; # dereference and copy
        next if exists $used_options{$option->{name}};
        $used_options{$option->{name}} = 1;

        my $prefix = (rand() < 0.5) ? '-' : '--';
        push @cmd_parts, $prefix . $option->{name};

        if ($option->{type} eq 'string') {
            push @cmd_parts, random_string();
        } elsif ($option->{type} eq 'int') {
            push @cmd_parts, random_int($option->{range});
        } elsif ($option->{type} eq 'float') {
            push @cmd_parts, sprintf("%.2f", random_float());
        } elsif ($option->{type} eq 'float_array') {
            my $count = int(rand($option->{range}->[1] - $option->{range}->[0] + 1)) + $option->{range}->[0];
            for (1..$count) {
                push @cmd_parts, sprintf("%.2f", random_float());
            }
        } elsif ($option->{type} eq 'string_array') {
            my $count = int(rand($option->{range}->[1] - $option->{range}->[0] + 1)) + $option->{range}->[0];
            for (1..$count) {
                push @cmd_parts, random_string();
            }
        }
    }
    push @cmd_parts, "Twin_Bridges_Scenic_Bikeway.gpx"; # Add input file

    print join(' ', @cmd_parts), "\n";
}

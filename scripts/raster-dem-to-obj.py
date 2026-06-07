#!/usr/bin/env python3

import argparse
import math
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def parse_args():
    parser = argparse.ArgumentParser(
        description="Convert a global equirectangular DEM to a UV-mapped OBJ."
    )
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--width", type=int, default=384)
    parser.add_argument("--height", type=int, default=192)
    parser.add_argument(
        "--mode",
        choices=("radius", "elevation"),
        required=True,
        help="Whether raster samples are absolute radii or elevations.",
    )
    parser.add_argument(
        "--unit-scale",
        type=float,
        default=1.0,
        help="Multiplier converting raster samples to kilometers.",
    )
    parser.add_argument(
        "--axes",
        type=float,
        nargs=3,
        metavar=("A", "B", "C"),
        help="Reference ellipsoid axes in kilometers for elevation rasters.",
    )
    parser.add_argument(
        "--offset",
        type=float,
        default=0.0,
        help="Value added to every raster sample before unit conversion.",
    )
    return parser.parse_args()


def ellipsoid_radius(latitude, longitude, axes):
    a, b, c = axes
    cos_latitude = math.cos(latitude)
    direction = (
        cos_latitude * math.cos(longitude),
        math.sin(latitude),
        -cos_latitude * math.sin(longitude),
    )
    denominator = math.sqrt(
        (direction[0] / a) ** 2
        + (direction[2] / b) ** 2
        + (direction[1] / c) ** 2
    )
    return 1.0 / denominator


def main():
    args = parse_args()
    if args.mode == "elevation" and not args.axes:
        raise ValueError("--axes is required for elevation rasters")

    source = Image.open(args.input)
    source.load()
    resized = source.resize(
        (args.width, args.height), resample=Image.Resampling.BILINEAR
    )
    samples = list(resized.getdata())
    finite_samples = [
        float(value)
        for value in samples
        if math.isfinite(float(value)) and abs(float(value)) < 1e20
    ]
    fallback = sorted(finite_samples)[len(finite_samples) // 2]

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    row_size = args.width + 1
    lines = [
        f"# Generated from {Path(args.input).name}",
        "# Positive-east equirectangular raster mapped into the app's body frame.",
    ]
    positions = []

    for row in range(args.height):
        v = row / (args.height - 1)
        latitude = math.pi / 2 - v * math.pi
        cos_latitude = math.cos(latitude)
        sin_latitude = math.sin(latitude)
        for column in range(row_size):
            source_column = column % args.width
            sample = float(samples[row * args.width + source_column])
            if not math.isfinite(sample) or abs(sample) >= 1e20:
                sample = fallback
            value_km = (sample + args.offset) * args.unit_scale
            longitude = (column / args.width - 0.5) * math.pi * 2
            if args.mode == "radius":
                radius = value_km
            else:
                radius = ellipsoid_radius(latitude, longitude, args.axes) + value_km
            x = radius * cos_latitude * math.cos(longitude)
            y = radius * sin_latitude
            z = -radius * cos_latitude * math.sin(longitude)
            positions.append((x, y, z))
            lines.append(f"v {x:.8f} {y:.8f} {z:.8f}")

    for row in range(args.height):
        v = 1 - row / (args.height - 1)
        for column in range(row_size):
            u = column / args.width
            lines.append(f"vt {u:.8f} {v:.8f}")

    def position(row, column):
        return positions[row * row_size + (column % args.width)]

    for row in range(args.height):
        for column in range(row_size):
            current = position(row, column)
            if row == 0 or row == args.height - 1:
                length = math.sqrt(sum(value * value for value in current))
                normal = tuple(value / length for value in current)
            else:
                left = position(row, column - 1)
                right = position(row, column + 1)
                north = position(row - 1, column)
                south = position(row + 1, column)
                longitude_tangent = tuple(
                    right[index] - left[index] for index in range(3)
                )
                latitude_tangent = tuple(
                    north[index] - south[index] for index in range(3)
                )
                normal = (
                    longitude_tangent[1] * latitude_tangent[2]
                    - longitude_tangent[2] * latitude_tangent[1],
                    longitude_tangent[2] * latitude_tangent[0]
                    - longitude_tangent[0] * latitude_tangent[2],
                    longitude_tangent[0] * latitude_tangent[1]
                    - longitude_tangent[1] * latitude_tangent[0],
                )
                length = math.sqrt(sum(value * value for value in normal))
                normal = tuple(value / length for value in normal)
                if sum(normal[index] * current[index] for index in range(3)) < 0:
                    normal = tuple(-value for value in normal)
            lines.append(
                f"vn {normal[0]:.8f} {normal[1]:.8f} {normal[2]:.8f}"
            )

    def vertex_index(row, column):
        return row * row_size + column + 1

    for row in range(args.height - 1):
        for column in range(args.width):
            lower_left = vertex_index(row, column)
            lower_right = vertex_index(row, column + 1)
            upper_left = vertex_index(row + 1, column)
            upper_right = vertex_index(row + 1, column + 1)
            lines.append(
                f"f {lower_left}/{lower_left}/{lower_left} "
                f"{upper_left}/{upper_left}/{upper_left} "
                f"{upper_right}/{upper_right}/{upper_right}"
            )
            lines.append(
                f"f {lower_left}/{lower_left}/{lower_left} "
                f"{upper_right}/{upper_right}/{upper_right} "
                f"{lower_right}/{lower_right}/{lower_right}"
            )

    output.write_text("\n".join(lines) + "\n", encoding="ascii")
    print(
        f"{output}: {(args.width + 1) * args.height} vertices, "
        f"{args.width * (args.height - 1) * 2} triangles"
    )


if __name__ == "__main__":
    main()

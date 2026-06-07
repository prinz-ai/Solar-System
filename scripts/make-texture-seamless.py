#!/usr/bin/env python3

import argparse
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(
        description="Cross-fade the longitude edges of a global texture."
    )
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--blend", type=int, default=32)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGB")
    pixels = source.load()
    original = source.copy()
    original_pixels = original.load()
    blend = min(args.blend, source.width // 4)

    for distance in range(blend):
        weight = distance / max(1, blend - 1)
        left_x = distance
        right_x = source.width - 1 - distance
        for y in range(source.height):
            left = original_pixels[left_x, y]
            right = original_pixels[right_x, y]
            average = tuple((left[channel] + right[channel]) / 2 for channel in range(3))
            pixels[left_x, y] = tuple(
                round(average[channel] * (1 - weight) + left[channel] * weight)
                for channel in range(3)
            )
            pixels[right_x, y] = tuple(
                round(average[channel] * (1 - weight) + right[channel] * weight)
                for channel in range(3)
            )

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    source.save(output, quality=92, method=6)
    print(output)


if __name__ == "__main__":
    main()

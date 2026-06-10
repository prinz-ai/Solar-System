#!/usr/bin/env python3

import argparse
import json
import random
import urllib.request
from pathlib import Path

import numpy as np
import spiceypy as spice

DE442_URL = (
    "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
    "spk/planets/de442.bsp"
)
LSK_URL = (
    "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
    "lsk/naif0012.tls"
)
START_UTC = "1550-01-01T00:00:00"
STOP_UTC = "2650-01-01T00:00:00"
FRAME = "ECLIPJ2000"
DEGREE = 15

TARGETS = [
    ("mercury", 199, 10, 2.0),
    ("venus", 299, 10, 4.0),
    ("earth", 399, 10, 4.0),
    ("mars", 4, 10, 4.0),
    ("jupiter", 5, 10, 8.0),
    ("saturn", 6, 10, 8.0),
    ("uranus", 7, 10, 16.0),
    ("neptune", 8, 10, 16.0),
    ("pluto", 9, 10, 16.0),
    ("moon", 301, 399, 1.0),
]


def download(url: str, path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, path)


def sample_epochs(first: float, last: float, step_days: float) -> np.ndarray:
    step_seconds = step_days * spice.spd()
    epochs = np.arange(first, last, step_seconds, dtype=np.float64)
    if epochs.size == 0 or epochs[-1] < last:
        epochs = np.append(epochs, last)
    return epochs


def sample_states(
    target: int,
    center: int,
    epochs: np.ndarray,
) -> np.ndarray:
    states = np.empty((epochs.size, 6), dtype=np.float64)
    for index, epoch in enumerate(epochs):
        states[index] = spice.spkgeo(target, float(epoch), FRAME, center)[0]
    return states


def validate_kernel(
    source_path: Path,
    output_path: Path,
    first: float,
    last: float,
) -> dict[str, float]:
    spice.kclear()
    spice.furnsh(str(source_path))
    reference = {}
    rng = random.Random(442)
    epochs = [rng.uniform(first, last) for _ in range(160)]
    for name, target, center, _step_days in TARGETS:
        reference[name] = [
            spice.spkgeo(target, epoch, FRAME, center)[0][:3]
            for epoch in epochs
        ]

    spice.kclear()
    spice.furnsh(str(output_path))
    errors = {}
    for name, target, center, _step_days in TARGETS:
        maximum = 0.0
        for index, epoch in enumerate(epochs):
            actual = spice.spkgeo(target, epoch, FRAME, center)[0][:3]
            error = float(np.linalg.norm(actual - reference[name][index]))
            maximum = max(maximum, error)
        errors[name] = maximum
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the browser-sized DE442 SPICE kernel.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("/tmp/solar-spice-kernels/de442.bsp"),
    )
    parser.add_argument(
        "--lsk",
        type=Path,
        default=Path("public/spice/naif0012.tls"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/spice/solar-system-de442.bsp"),
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=Path("public/spice/solar-system-de442.json"),
    )
    args = parser.parse_args()

    download(DE442_URL, args.source)
    download(LSK_URL, args.lsk)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.unlink(missing_ok=True)

    spice.kclear()
    spice.furnsh(str(args.lsk))
    spice.furnsh(str(args.source))
    first = spice.str2et(START_UTC)
    last = spice.str2et(STOP_UTC)

    handle = spice.spkopn(
        str(args.output),
        "SOLAR_SYSTEM_DE442",
        4_096,
    )
    try:
        for name, target, center, step_days in TARGETS:
            epochs = sample_epochs(first, last, step_days)
            states = sample_states(target, center, epochs)
            spice.spkw13(
                handle,
                target,
                center,
                FRAME,
                float(epochs[0]),
                float(epochs[-1]),
                f"DE442 {name}",
                DEGREE,
                int(epochs.size),
                states,
                epochs,
            )
            print(f"{name}: {epochs.size:,} states at {step_days:g}-day steps")
    finally:
        spice.spkcls(handle)

    errors = validate_kernel(args.source, args.output, first, last)
    metadata = {
        "source": "NASA/JPL DE442",
        "sourceUrl": DE442_URL,
        "leapsecondsUrl": LSK_URL,
        "frame": FRAME,
        "coverage": ["1550-01-01", "2650-01-01"],
        "interpolation": f"SPK type 13, degree {DEGREE}",
        "targets": [target[0] for target in TARGETS],
        "validationMaxErrorKm": errors,
    }
    args.metadata.write_text(json.dumps(metadata, indent=2) + "\n")

    print(f"Wrote {args.output} ({args.output.stat().st_size / 1_048_576:.1f} MiB)")
    print(f"Wrote {args.metadata}")
    for name, error in errors.items():
        print(f"{name}: maximum sampled error {error:.6f} km")


if __name__ == "__main__":
    main()

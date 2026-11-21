#!/usr/bin/env python3
"""Compare a Chromium screenshot against a same-size PNG exported from Figma."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory

from PIL import Image, ImageChops, ImageOps


def on_white(path):
    with Image.open(path) as source:
        foreground = source.convert("RGBA")
        background = Image.new("RGBA", foreground.size, "white")
        return Image.alpha_composite(background, foreground).convert("RGB")


def compare(expected, actual, tolerance):
    if expected.size != actual.size:
        raise ValueError(f"Image size mismatch: expected {expected.size}, got {actual.size}.")
    red, green, blue = ImageChops.difference(expected, actual).split()
    largest = ImageChops.lighter(red, ImageChops.lighter(green, blue))
    mask = largest.point(lambda delta: 255 if delta > tolerance else 0)
    mismatched = mask.histogram()[255]
    return mismatch_result(expected.size, mismatched), mask


def mismatch_result(size, mismatched):
    width, height = size
    return {
        "width": width,
        "height": height,
        "pixelsDifferent": mismatched,
        "mismatchPercent": 100 * mismatched / (width * height),
    }


def screenshot(browser, html, output, viewport, profile):
    width, height = viewport
    command = [
        browser, "--headless", "--disable-gpu", "--disable-dev-shm-usage",
        "--hide-scrollbars", "--force-device-scale-factor=1",
        f"--user-data-dir={profile}", f"--window-size={width},{height}",
        f"--screenshot={output}", html.resolve().as_uri(),
    ]
    try:
        process = subprocess.run(command, capture_output=True, timeout=45, text=True)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError(f"Chromium capture could not start: {error}") from error
    if process.returncode or not output.is_file():
        raise ValueError(f"Chromium capture failed with status {process.returncode}:\n{process.stderr[-2000:]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, type=Path, help="Figma PNG exported at 1×")
    actual = parser.add_mutually_exclusive_group(required=True)
    actual.add_argument("--html", type=Path, help="Generated static HTML, with assets beside it")
    actual.add_argument("--actual", type=Path, help="Existing 1× browser screenshot instead of running Chromium")
    parser.add_argument("--browser", default=shutil.which("chromium") or shutil.which("google-chrome") or "chromium")
    parser.add_argument("--tolerance", type=int, default=8, help="Maximum per-channel difference for a matching pixel")
    parser.add_argument("--max-mismatch", type=float, default=1.0, help="Fail above this percentage of changed pixels")
    parser.add_argument("--diff", type=Path, help="Optional PNG highlighting mismatched pixels in red")
    args = parser.parse_args()
    if not 0 <= args.tolerance <= 255 or not 0 <= args.max_mismatch <= 100:
        parser.error("Tolerance must be 0–255 and maximum mismatch must be 0–100 percent.")

    try:
        expected = on_white(args.reference)
        with TemporaryDirectory(prefix="figma-visual-") as scratch:
            candidate = args.actual or Path(scratch, "actual.png")
            if args.html:
                screenshot(args.browser, args.html, candidate, expected.size, Path(scratch, "profile"))
            observed = on_white(candidate)
            report, mask = compare(expected, observed, args.tolerance)
        if args.diff:
            muted = ImageOps.grayscale(expected).convert("RGB")
            Image.composite(Image.new("RGB", expected.size, "#ff0040"), muted, mask).save(args.diff)
        print(json.dumps(report, indent=2))
        return int(report["mismatchPercent"] > args.max_mismatch)
    except (OSError, ValueError) as error:
        parser.exit(2, f"{error}\n")


if __name__ == "__main__":
    raise SystemExit(main())

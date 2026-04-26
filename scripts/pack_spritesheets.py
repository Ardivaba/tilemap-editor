#!/usr/bin/env python3
"""
Pack individual animation frame PNGs from the Treasure Hunters asset pack
into spritesheet images. Each animation goes on a separate row.

Usage:
    python3 scripts/pack_spritesheets.py [INPUT_DIR] [OUTPUT_DIR]

Defaults:
    INPUT_DIR  = ~/Downloads/Treasure Hunters
    OUTPUT_DIR = ~/Downloads/Treasure Hunters/Export
"""

import os
import re
import sys
from pathlib import Path
from PIL import Image

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_INPUT = os.path.expanduser("~/Downloads/Treasure Hunters")
DEFAULT_OUTPUT = os.path.expanduser("~/Downloads/Treasure Hunters/Export")

# Files/dirs to skip entirely (tileset images, not frame-based sprites)
SKIP_PATHS = {
    "Terrain (32x32).png",
    "Platforms (32x32).png",
    "Terrain and Back Wall (32x32).png",
}

SKIP_DIRS = {
    "Aseprite",
    "Tilesets",
    "Terrain",
    ".DS_Store",
}

# Preferred animation order for sorting. Lower = earlier.
ANIM_ORDER = [
    "idle", "no wind", "wind",
    "walk", "run", "jump", "fall", "ground", "land",
    "anticipation",
    "attack 1", "attack1", "attack 2", "attack2", "attack 3", "attack3",
    "air attack 1", "air attack 2",
    "fire", "bite", "opening", "open",
    "hit", "hurt",
    "dead hit", "dead ground", "dead", "destroyed", "closing", "close",
    "throw", "spinning", "embedded",
    "folding", "unfolding",
    "padlock", "unlocked",
    "effect", "in", "out",
    "transition to wind", "transition to no wind",
    "exclamation", "interrogation",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def natural_sort_key(s):
    """Sort strings with embedded numbers naturally: 'frame 2' < 'frame 10'."""
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", str(s))
    ]


def anim_sort_key(name):
    """Return a sort key for animation name based on preferred order."""
    lower = re.sub(r"^\d+[-\s]*", "", name).strip().lower()
    for i, pattern in enumerate(ANIM_ORDER):
        if pattern in lower or lower in pattern:
            return (i, lower)
    return (len(ANIM_ORDER), lower)


def load_frames(directory):
    """Load all PNG frames from a directory, sorted naturally."""
    files = sorted(
        [f for f in os.listdir(directory) if f.lower().endswith(".png")],
        key=natural_sort_key,
    )
    frames = []
    for f in files:
        path = os.path.join(directory, f)
        try:
            img = Image.open(path).convert("RGBA")
            frames.append(img)
        except Exception as e:
            print(f"  Warning: could not load {path}: {e}")
    return frames


def find_sprite_objects(root_dir):
    """
    Walk the asset tree and discover sprite objects.

    Returns a list of dicts:
    {
        "name": "Captain Clown Nose without Sword",
        "category": "Captain Clown Nose",
        "animations": [
            {"name": "01-Idle", "frames": [<PIL.Image>, ...]},
            ...
        ]
    }
    """
    objects = []

    for category in sorted(os.listdir(root_dir)):
        cat_path = os.path.join(root_dir, category)
        if not os.path.isdir(cat_path):
            continue
        if category in ("Export", ".DS_Store"):
            continue

        sprites_dir = os.path.join(cat_path, "Sprites")
        if not os.path.isdir(sprites_dir):
            continue

        _walk_sprites(sprites_dir, category, objects)

    return objects


def _walk_sprites(directory, category, objects, prefix=""):
    """
    Recursively discover sprite objects.

    An "object" is identified when we find a directory that either:
    (a) Contains PNG files directly (single animation), or
    (b) Contains subdirectories that each contain PNG files (multi-animation)
    """
    entries = sorted(os.listdir(directory))

    # Filter out skipped dirs
    subdirs = []
    pngs = []
    for e in entries:
        full = os.path.join(directory, e)
        if e in SKIP_DIRS or e in SKIP_PATHS:
            continue
        if os.path.isdir(full):
            subdirs.append(e)
        elif e.lower().endswith(".png") and e not in SKIP_PATHS:
            pngs.append(e)

    has_pngs = len(pngs) > 0
    has_subdirs = len(subdirs) > 0

    if has_pngs and not has_subdirs:
        # Leaf directory with PNGs → single animation object
        name = prefix or os.path.basename(directory)
        frames = load_frames(directory)
        if frames:
            objects.append({
                "name": name,
                "category": category,
                "animations": [{"name": name, "frames": frames}],
            })
        return

    if has_subdirs:
        # Check if subdirs contain PNGs (animation states) or are nested objects
        anim_subdirs = []
        nested_subdirs = []

        for sd in subdirs:
            sd_path = os.path.join(directory, sd)
            sd_pngs = [f for f in os.listdir(sd_path) if f.lower().endswith(".png")]
            sd_subdirs = [
                f for f in os.listdir(sd_path)
                if os.path.isdir(os.path.join(sd_path, f)) and f not in SKIP_DIRS
            ]

            if sd_pngs and not sd_subdirs:
                anim_subdirs.append(sd)
            elif sd_subdirs:
                nested_subdirs.append(sd)
            elif sd_pngs:
                anim_subdirs.append(sd)

        obj_name = prefix or os.path.basename(directory)

        # If we have animation subdirs, build a multi-animation object
        if anim_subdirs:
            animations = []
            for sd in sorted(anim_subdirs, key=anim_sort_key):
                sd_path = os.path.join(directory, sd)
                frames = load_frames(sd_path)
                if frames:
                    animations.append({"name": sd, "frames": frames})

            # Also include any PNGs at this level as a "base" animation
            if has_pngs:
                frames = load_frames(directory)
                if frames:
                    animations.insert(0, {"name": obj_name, "frames": frames})

            if animations:
                objects.append({
                    "name": obj_name,
                    "category": category,
                    "animations": animations,
                })

        # Recurse into nested subdirs
        for sd in nested_subdirs:
            sd_path = os.path.join(directory, sd)
            child_prefix = f"{obj_name} - {sd}" if prefix else sd
            _walk_sprites(sd_path, category, objects, prefix=child_prefix)

        # If only nested (no anim_subdirs) and we have PNGs at this level too
        if not anim_subdirs and has_pngs:
            frames = load_frames(directory)
            if frames:
                objects.append({
                    "name": obj_name,
                    "category": category,
                    "animations": [{"name": obj_name, "frames": frames}],
                })


def create_spritesheet(sprite_obj, output_dir):
    """
    Create a spritesheet PNG for a sprite object.

    Each animation row uses the max frame size across ALL animations in
    the object, so all cells are uniform. Rows may have different numbers
    of columns (frames).
    """
    animations = sprite_obj["animations"]
    if not animations:
        return

    # Find the max frame dimensions across all animations
    max_w = 0
    max_h = 0
    for anim in animations:
        for frame in anim["frames"]:
            max_w = max(max_w, frame.width)
            max_h = max(max_h, frame.height)

    if max_w == 0 or max_h == 0:
        return

    # Calculate sheet dimensions
    max_cols = max(len(anim["frames"]) for anim in animations)
    num_rows = len(animations)
    sheet_w = max_cols * max_w
    sheet_h = num_rows * max_h

    # Create the sheet
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    for row_idx, anim in enumerate(animations):
        for col_idx, frame in enumerate(anim["frames"]):
            # Center the frame in its cell if it's smaller than max
            x_offset = (max_w - frame.width) // 2
            y_offset = (max_h - frame.height) // 2
            x = col_idx * max_w + x_offset
            y = row_idx * max_h + y_offset
            sheet.paste(frame, (x, y), frame)

    # Build output path
    cat_dir = os.path.join(output_dir, sprite_obj["category"])
    os.makedirs(cat_dir, exist_ok=True)

    # Clean filename
    safe_name = sprite_obj["name"].replace("/", "-").replace("\\", "-")
    out_path = os.path.join(cat_dir, f"{safe_name}.png")

    # Avoid overwriting by appending a number
    if os.path.exists(out_path):
        base, ext = os.path.splitext(out_path)
        counter = 2
        while os.path.exists(f"{base}_{counter}{ext}"):
            counter += 1
        out_path = f"{base}_{counter}{ext}"

    sheet.save(out_path, "PNG")

    # Build animation metadata summary
    anim_info = []
    for anim in animations:
        anim_info.append(f"{anim['name']} ({len(anim['frames'])} frames)")

    print(f"  {sprite_obj['category']}/{safe_name}.png  "
          f"({sheet_w}x{sheet_h}, {max_w}x{max_h} cells, {num_rows} rows)")
    for info in anim_info:
        print(f"    - {info}")

    return out_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    input_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    output_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT

    if not os.path.isdir(input_dir):
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print(f"Input:  {input_dir}")
    print(f"Output: {output_dir}")
    print()
    print("Scanning for sprite objects...")
    objects = find_sprite_objects(input_dir)
    print(f"Found {len(objects)} sprite objects\n")

    print("Creating spritesheets...")
    print("-" * 60)

    created = 0
    for obj in objects:
        result = create_spritesheet(obj, output_dir)
        if result:
            created += 1

    print("-" * 60)
    print(f"\nDone! Created {created} spritesheets in {output_dir}")


if __name__ == "__main__":
    main()

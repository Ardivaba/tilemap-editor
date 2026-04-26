#!/usr/bin/env python3
"""
Create a zip archive from the Treasure Hunters Export directory.

The zip structure mirrors the Export directory:
  Category/Name.png
  Category/Name.json   (sidecar metadata for spritesheets)

Tileset images (no .json companion) are included as-is.

Usage:
    python3 scripts/create_asset_zip.py [EXPORT_DIR] [OUTPUT_ZIP]

Defaults:
    EXPORT_DIR = ~/Downloads/Treasure Hunters/Export
    OUTPUT_ZIP = ~/Downloads/Treasure Hunters/TreasureHunters.zip
"""

import os
import sys
import zipfile

DEFAULT_EXPORT = os.path.expanduser("~/Downloads/Treasure Hunters/Export")
DEFAULT_ZIP = os.path.expanduser("~/Downloads/Treasure Hunters/TreasureHunters.zip")


def main():
    export_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EXPORT
    output_zip = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_ZIP

    if not os.path.isdir(export_dir):
        print(f"Error: Export directory not found: {export_dir}")
        sys.exit(1)

    count = 0
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(export_dir):
            for f in sorted(files):
                if f.startswith("."):
                    continue
                full = os.path.join(root, f)
                arcname = os.path.relpath(full, export_dir)
                zf.write(full, arcname)
                count += 1
                print(f"  + {arcname}")

    size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(f"\nCreated {output_zip}")
    print(f"  {count} files, {size_mb:.1f} MB")


if __name__ == "__main__":
    main()

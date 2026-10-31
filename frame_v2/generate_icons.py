#!/usr/bin/env python3
import os
from collections import deque
from PIL import Image

def main():
    src_path = "/home/bala/.gemini/antigravity-ide/brain/a78d4af8-d2ce-4f5b-8347-d92a49e31b81/.user_uploaded/media_1791606224624.png"
    img = Image.open(src_path).convert("RGBA")

    # Crop squircle icon region
    crop_box = (365, 124, 660, 409)
    cropped = img.crop(crop_box)
    cw, ch = cropped.size

    # Flood fill outer white background starting from all 4 corners
    visited = set()
    queue = deque([(0, 0), (cw - 1, 0), (0, ch - 1), (cw - 1, ch - 1)])
    for p in queue:
        visited.add(p)

    while queue:
        cx, cy = queue.popleft()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cw and 0 <= ny < ch and (nx, ny) not in visited:
                r, g, b, _ = cropped.getpixel((nx, ny))
                # Outer background is nearly pure white
                if r >= 242 and g >= 242 and b >= 242:
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    # Identify boundary pixels
    level1 = set()
    for vx, vy in visited:
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = vx + dx, vy + dy
            if 0 <= nx < cw and 0 <= ny < ch and (nx, ny) not in visited:
                level1.add((nx, ny))

    result = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    rpix = result.load()
    cpix = cropped.load()

    for y in range(ch):
        for x in range(cw):
            if (x, y) in visited:
                rpix[x, y] = (0, 0, 0, 0)
            elif (x, y) in level1:
                r, g, b, _ = cpix[x, y]
                brightness = (r + g + b) / 3.0
                if brightness >= 240:
                    alpha = int(max(0, (255 - brightness) / 15.0 * 50))
                    rpix[x, y] = (0, 30, 90, alpha)
                elif brightness > 140:
                    alpha_factor = (255 - brightness) / 115.0
                    alpha = int(alpha_factor * 255)
                    a_float = max(0.2, alpha_factor)
                    fg_r = max(0, min(255, int((r - (1 - a_float) * 255) / a_float)))
                    fg_g = max(0, min(255, int((g - (1 - a_float) * 255) / a_float)))
                    fg_b = max(0, min(255, int((b - (1 - a_float) * 255) / a_float)))
                    rpix[x, y] = (fg_r, fg_g, fg_b, alpha)
                else:
                    rpix[x, y] = (r, g, b, 255)
            else:
                rpix[x, y] = cpix[x, y]

    bbox = result.getbbox()
    icon_cropped = result.crop(bbox)

    # Pad to square canvas so icon is centered
    dim = max(icon_cropped.width, icon_cropped.height)
    # Give a tiny 2% margin so edges are not clipped during scaling
    canvas_dim = int(dim * 1.04)
    square_icon = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
    ox = (canvas_dim - icon_cropped.width) // 2
    oy = (canvas_dim - icon_cropped.height) // 2
    square_icon.paste(icon_cropped, (ox, oy), icon_cropped)

    # Target destinations
    dest_dir = "/home/bala/BeatNect/frame_v2/static/images"
    os.makedirs(dest_dir, exist_ok=True)

    # 1. High-res 512x512 transparent icon for frame.png
    icon_512 = square_icon.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(dest_dir, "frame.png"), "PNG", optimize=True)
    icon_512.save(os.path.join(dest_dir, "logo.png"), "PNG", optimize=True)

    # 2. 192x192 icon for manifest
    icon_192 = square_icon.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(os.path.join(dest_dir, "icon-192.png"), "PNG", optimize=True)

    # 3. 512x512 icon for manifest
    icon_512.save(os.path.join(dest_dir, "icon-512.png"), "PNG", optimize=True)

    # 4. Favicon (32x32, 48x48, 64x64 multi-res ICO + PNG)
    icon_64 = square_icon.resize((64, 64), Image.Resampling.LANCZOS)
    icon_32 = square_icon.resize((32, 32), Image.Resampling.LANCZOS)
    icon_16 = square_icon.resize((16, 16), Image.Resampling.LANCZOS)
    icon_32.save("/home/bala/BeatNect/frame_v2/static/favicon.png", "PNG", optimize=True)
    square_icon.resize((48, 48), Image.Resampling.LANCZOS).save(
        "/home/bala/BeatNect/frame_v2/static/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )

    # 5. Also copy favicon to root static/images
    square_icon.resize((48, 48), Image.Resampling.LANCZOS).save(
        os.path.join(dest_dir, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
    )

    print("Successfully generated all icons:")
    print(" - frame_v2/static/images/frame.png (512x512)")
    print(" - frame_v2/static/images/logo.png (512x512)")
    print(" - frame_v2/static/images/icon-192.png (192x192)")
    print(" - frame_v2/static/images/icon-512.png (512x512)")
    print(" - frame_v2/static/favicon.png (32x32)")
    print(" - frame_v2/static/favicon.ico (16,32,48,64 multi-res)")

if __name__ == "__main__":
    main()

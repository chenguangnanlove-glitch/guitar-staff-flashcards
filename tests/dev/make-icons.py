#!/usr/bin/env python3
"""重新生成 icons/ 下的 PNG 图标（需要 Pillow）。

这是开发辅助脚本，不参与应用运行。图标是深绿底 + 五线谱 + 四分音符。
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'icons'
OUT.mkdir(exist_ok=True)

SIZE = 1024
BG = (61, 107, 92)
CREAM = (247, 241, 224)
GOLD = (222, 184, 113)


def draw_icon(size, rounded=True):
    image = Image.new('RGB', (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(image)
    for index in range(5):
        top = 340 + index * 64
        draw.rounded_rectangle((180, top, 844, top + 8), radius=4, fill=CREAM)
    draw.ellipse((330, 560, 525, 655), fill=CREAM)
    draw.rounded_rectangle((500, 245, 530, 620), radius=14, fill=CREAM)
    draw.polygon(
        [(510, 250), (690, 292), (712, 420), (600, 360), (540, 395)],
        fill=CREAM,
    )
    draw.ellipse((715, 705, 770, 760), fill=GOLD)
    if rounded:
        mask = Image.new('L', (SIZE, SIZE), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, SIZE - 1, SIZE - 1), radius=220, fill=255,
        )
        image.putalpha(mask)
    return image.resize((size, size), Image.Resampling.LANCZOS)


draw_icon(512).save(OUT / 'icon-512.png')
draw_icon(192).save(OUT / 'icon-192.png')
draw_icon(180, rounded=False).save(OUT / 'apple-touch-icon.png')
draw_icon(32).save(OUT / 'favicon-32.png')
draw_icon(512, rounded=False).save(OUT / 'icon-maskable-512.png')
print('icons written to', OUT)

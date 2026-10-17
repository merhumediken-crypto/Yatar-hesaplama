"""Eklenti simgelerini (terazi) üretir: python3 scripts/ikon_uret.py"""
from pathlib import Path
from PIL import Image, ImageDraw

HEDEF = Path(__file__).resolve().parent.parent / "extension" / "icons"
LACIVERT = (31, 58, 104, 255)
BEYAZ = (255, 255, 255, 255)


def ciz(boyut: int) -> Image.Image:
    o = 8  # süper örnekleme
    S = boyut * o
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=LACIVERT)
    w = max(int(S * 0.07), o)
    cx = S // 2
    # direk ve taban
    d.rectangle([cx - w // 2, int(S * 0.22), cx + w // 2, int(S * 0.78)], fill=BEYAZ)
    d.rounded_rectangle([int(S * 0.30), int(S * 0.74), int(S * 0.70), int(S * 0.82)], radius=w // 2, fill=BEYAZ)
    # kiriş
    d.rectangle([int(S * 0.18), int(S * 0.27), int(S * 0.82), int(S * 0.27) + w], fill=BEYAZ)
    d.ellipse([cx - w, int(S * 0.17), cx + w, int(S * 0.17) + 2 * w], fill=BEYAZ)
    # kefeler
    for x in (0.25, 0.75):
        kx = int(S * x)
        ust = int(S * 0.27) + w
        alt = int(S * 0.56)
        ince = max(w // 3, o // 2)
        d.line([kx, ust, kx - int(S * 0.11), alt], fill=BEYAZ, width=ince)
        d.line([kx, ust, kx + int(S * 0.11), alt], fill=BEYAZ, width=ince)
        d.pieslice([kx - int(S * 0.14), alt - int(S * 0.08), kx + int(S * 0.14), alt + int(S * 0.08)], 0, 180, fill=BEYAZ)
    return im.resize((boyut, boyut), Image.LANCZOS)


if __name__ == "__main__":
    HEDEF.mkdir(parents=True, exist_ok=True)
    for b in (16, 32, 48, 128):
        ciz(b).save(HEDEF / f"icon{b}.png")
        print("yazıldı", HEDEF / f"icon{b}.png")

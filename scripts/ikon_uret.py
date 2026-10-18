"""Eklenti simgelerini üretir: python3 scripts/ikon_uret.py

Marka işareti (popup.html → .marka-isaret) Taeuber-Arp esinli dört biçimdir: kapalı (kırmızı
daire), denetimli serbestlik (mavi dikdörtgen), açık (yeşil yarım daire) ve kâğıt kare.
Simgede biçimler mürekkep zemin üzerindedir; açık ve koyu araç çubuğunda seçilir.
"""
from pathlib import Path
from PIL import Image, ImageDraw

HEDEF = Path(__file__).resolve().parent.parent / "extension" / "icons"
MUREKKEP = (28, 26, 23, 255)
KAGIT = (242, 236, 225, 255)
KIRMIZI = (198, 63, 43, 255)
YESIL = (47, 107, 79, 255)
MAVI = (35, 71, 154, 255)


def ciz(boyut: int) -> Image.Image:
    o = 8  # süper örnekleme
    S = boyut * o
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.14), fill=MUREKKEP)
    # 32 birimlik ızgarada marka işaretinin biçimleri, 4 birim kenar boşluğuyla.
    b = S / 40
    k = lambda x: int(round((x + 4) * b))
    d.ellipse([k(2), k(2), k(17), k(17)], fill=KIRMIZI)
    d.rectangle([k(18), k(2), k(30), k(18)], fill=MAVI)
    d.pieslice([k(2), k(22), k(18), k(38)], 180, 360, fill=YESIL)
    d.rectangle([k(20), k(22), k(30), k(30)], fill=KAGIT)
    return im.resize((boyut, boyut), Image.LANCZOS)


if __name__ == "__main__":
    HEDEF.mkdir(parents=True, exist_ok=True)
    for boyut in (16, 32, 48, 128):
        ciz(boyut).save(HEDEF / f"icon{boyut}.png")
        print("yazıldı", HEDEF / f"icon{boyut}.png")

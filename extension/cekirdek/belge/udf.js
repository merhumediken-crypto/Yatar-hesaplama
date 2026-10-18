// Dosyadan metin: UYAP UDF (.udf), HTML (kaydedilmiş "Evrak Görüntüleme" sayfası) ve düz metin.
//
// UDF bir ZIP arşividir; belge metni content.xml içindeki <content><![CDATA[…]]></content>
// alanındadır. ZIP okuması kütüphanesiz yapılır: merkezî dizin okunur, kayıt
// "stored" (0) veya "deflate" (8) ise çözülür (DecompressionStream 'deflate-raw';
// Chrome 103+, Node 18+). Ağ isteği yoktur.

const ZIP_SON = 0x06054b50;
const ZIP_MERKEZ = 0x02014b50;
const ZIP_YEREL = 0x04034b50;

export class BelgeHatasi extends Error {}

async function inflateRaw(veri) {
  if (typeof DecompressionStream !== 'function') throw new BelgeHatasi('Bu tarayıcı sıkıştırılmış UDF dosyasını açamıyor; belge metnini kopyalayıp yapıştırın.');
  const akis = new Blob([veri]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(akis).arrayBuffer());
}

// ZIP içindeki dosyalar: [{ ad, oku: () => Promise<Uint8Array> }]
export function zipIcerigi(tampon) {
  const v = new DataView(tampon);
  const b = new Uint8Array(tampon);
  let son = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === ZIP_SON) {
      son = i;
      break;
    }
  }
  if (son < 0) throw new BelgeHatasi('Dosya ZIP/UDF biçiminde değil.');
  const adet = v.getUint16(son + 10, true);
  let p = v.getUint32(son + 16, true);
  const kayitlar = [];
  const metinCoz = new TextDecoder('utf-8');
  for (let n = 0; n < adet; n++) {
    if (v.getUint32(p, true) !== ZIP_MERKEZ) throw new BelgeHatasi('UDF arşivi bozuk (merkezî dizin).');
    const yontem = v.getUint16(p + 10, true);
    const sikisik = v.getUint32(p + 20, true);
    const adUz = v.getUint16(p + 28, true);
    const ekUz = v.getUint16(p + 30, true);
    const yorumUz = v.getUint16(p + 32, true);
    const yerel = v.getUint32(p + 42, true);
    const ad = metinCoz.decode(b.subarray(p + 46, p + 46 + adUz));
    kayitlar.push({
      ad,
      oku: async () => {
        if (v.getUint32(yerel, true) !== ZIP_YEREL) throw new BelgeHatasi('UDF arşivi bozuk (yerel başlık).');
        const veriBas = yerel + 30 + v.getUint16(yerel + 26, true) + v.getUint16(yerel + 28, true);
        const veri = b.subarray(veriBas, veriBas + sikisik);
        if (yontem === 0) return veri;
        if (yontem === 8) return inflateRaw(veri);
        throw new BelgeHatasi(`Desteklenmeyen sıkıştırma yöntemi (${yontem}).`);
      },
    });
    p += 46 + adUz + ekUz + yorumUz;
  }
  return kayitlar;
}

// HTML/XML'den düz metin: blok etiketleri satır sonuna çevrilir, varlıklar çözülür.
export function htmlMetni(html) {
  const varlik = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|table|paragraph)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, k) => (k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : Number(k.slice(1))) : varlik[k.toLowerCase()] ?? m));
}

// UDF content.xml → metin. CDATA içindeki metin esastır; yoksa etiketler soyulur.
export function udfXmlMetni(xml) {
  const m = /<content>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content>/i.exec(xml);
  return m ? m[1] : htmlMetni(xml);
}

const BASLIK = (b, ...imza) => imza.every((x, i) => b[i] === x);

// Herhangi bir dosya → düz metin. Dönüş: { metin, bicim }
export async function dosyaMetni(dosya) {
  const tampon = await dosya.arrayBuffer();
  const b = new Uint8Array(tampon);
  const ad = (dosya.name || '').toLowerCase();
  if (BASLIK(b, 0x50, 0x4b, 0x03, 0x04) || ad.endsWith('.udf')) {
    const icerik = zipIcerigi(tampon);
    const kayit = icerik.find((k) => /(^|\/)content\.xml$/i.test(k.ad)) || icerik.find((k) => /\.xml$/i.test(k.ad));
    if (!kayit) throw new BelgeHatasi('UDF içinde belge metni (content.xml) bulunamadı.');
    return { metin: udfXmlMetni(new TextDecoder('utf-8').decode(await kayit.oku())), bicim: 'udf' };
  }
  if (BASLIK(b, 0x25, 0x50, 0x44, 0x46)) throw new BelgeHatasi('PDF dosyası doğrudan okunamıyor. PDF\'i açıp metni kopyalayın ve "Metni yapıştır" alanına yapıştırın; ya da UYAP\'tan .udf olarak indirin.');
  const metin = new TextDecoder(b[0] === 0xff && b[1] === 0xfe ? 'utf-16le' : 'utf-8').decode(b);
  if (/<html|<body|<div|<table/i.test(metin.slice(0, 4000))) return { metin: htmlMetni(metin), bicim: 'html' };
  return { metin, bicim: 'metin' };
}

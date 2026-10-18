// Test ve e2e için en küçük ZIP/UDF üreticisi: tek dosya, deflate (yöntem 8).
import zlib from 'node:zlib';

export function zip(ad, icerik) {
  const veri = Buffer.from(icerik, 'utf8');
  const sikisik = zlib.deflateRawSync(veri);
  const adB = Buffer.from(ad);
  const yerel = Buffer.alloc(30);
  yerel.writeUInt32LE(0x04034b50, 0);
  yerel.writeUInt16LE(8, 8);
  yerel.writeUInt32LE(sikisik.length, 18);
  yerel.writeUInt32LE(veri.length, 22);
  yerel.writeUInt16LE(adB.length, 26);
  const merkez = Buffer.alloc(46);
  merkez.writeUInt32LE(0x02014b50, 0);
  merkez.writeUInt16LE(8, 10);
  merkez.writeUInt32LE(sikisik.length, 20);
  merkez.writeUInt32LE(veri.length, 24);
  merkez.writeUInt16LE(adB.length, 28);
  merkez.writeUInt32LE(0, 42);
  const merkezBas = yerel.length + adB.length + sikisik.length;
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(1, 8);
  son.writeUInt16LE(1, 10);
  son.writeUInt32LE(merkez.length + adB.length, 12);
  son.writeUInt32LE(merkezBas, 16);
  return Buffer.concat([yerel, adB, sikisik, merkez, adB, son]);
}

// UYAP UDF: ZIP içinde content.xml, belge metni CDATA'da.
export const udf = (metin) => zip('content.xml', `<?xml version="1.0" encoding="UTF-8"?><template format_id="1.8"><content><![CDATA[${metin}]]></content><properties/></template>`);

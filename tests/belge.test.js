// Belge okuyucu: içtima kararı, müddetname, gerekçeli karar, UDF/HTML dosyaları.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { belgeOku, dosyaMetni, BelgeHatasi } from '../extension/cekirdek/index.js';
import { aramaKopyasi, cezalar, normallestir, tarihler } from '../extension/cekirdek/belge/metin.js';

const belge = (ad) => fs.readFileSync(new URL(`./belgeler/${ad}`, import.meta.url), 'utf8');

test('Arama kopyası özgün metinle aynı uzunlukta; Türkçe büyük harf ve aksan bağımsız', () => {
  const s = 'Hâkimliği İÇTİMASINA ığdır ŞÜPHELİ';
  assert.equal(aramaKopyasi(s).length, s.length);
  assert.equal(aramaKopyasi(s), 'HAKIMLIGI ICTIMASINA IGDIR SUPHELI');
});

test('Ceza ve tarih desenleri', () => {
  const c = (s) => cezalar(aramaKopyasi(s)).map((x) => x.ceza);
  assert.deepEqual(c('4 YIL 8 AY 7 GÜN HAPİS'), [{ yil: 4, ay: 8, gun: 7 }]);
  assert.deepEqual(c('1 YIL 15 GÜN'), [{ yil: 1, ay: 0, gun: 15 }]);
  assert.deepEqual(c('4 AY 15 GÜN hapis'), [{ yil: 0, ay: 4, gun: 15 }]);
  assert.deepEqual(c('2 (İKİ) YIL 6 (ALTI) AY'), [{ yil: 2, ay: 6, gun: 0 }]);
  assert.deepEqual(c('5 yıllık süre, 2 aylık'), [], 'kelime parçası ceza değildir');
  assert.deepEqual(tarihler('12/07/2018 ve 1.2.2019, 31/02/2020 geçersiz').map((t) => t.iso), ['2018-07-12', '2019-02-01']);
  assert.equal(normallestir('﻿A\tB  C\r\nD'), 'A B C\nD');
});

test('İçtima kararı: 6 ilam, mahkeme/esas/karar/infaz no, ceza ve toplam doğrulaması', () => {
  const r = belgeOku(belge('ictima-karari.txt'));
  assert.equal(r.tur, 'ictima_karari');
  assert.deepEqual(r.karar, { mahkeme: 'Diyarbakır 1. İnfaz Hâkimliği', dosya_no: '2025/5778', karar_no: '2025/5517', karar_tarihi: '2025-09-19', basvuru_tarihi: '2025-09-10' });
  assert.equal(r.kisi.ad, 'Ahmet Örnek');
  assert.equal(r.kisi.dogum_tarihi, '1990-09-19');
  assert.doesNotMatch(r.kisi.kaynak, /\d{11}/, 'TC kimlik no maskelenir');
  assert.equal(r.ilamlar.length, 6);
  assert.deepEqual(r.ilamlar.map((i) => [i.mahkeme_kisa, i.karar_tarihi, i.esas_no, i.karar_no, i.infaz_no]), [
    ['Diyarbakır 12. Asliye Ceza', '2018-07-12', '2017/157', '2018/343', '2020/2-4124'],
    ['Diyarbakır 12. Asliye Ceza', '2018-07-12', '2017/157', '2018/343', '2020/2-4123'],
    ['Diyarbakır 5. Ağır Ceza', '2014-12-16', '2014/249', '2014/203', '2021/1-4466'],
    ['Aydın 3. Ağır Ceza', '2024-04-24', '2023/399', '2024/172', '2025/7-3427'],
    ['Diyarbakır 4. Asliye Ceza', '2025-05-08', '2024/2475', '2025/699', '2025/2-10594'],
    ['Antalya 21. Asliye Ceza', '2025-06-18', '2025/446', '2025/555', '2025/7-15447'],
  ]);
  assert.deepEqual(r.ilamlar.map((i) => i.ceza), [
    { yil: 4, ay: 8, gun: 7 },
    { yil: 1, ay: 8, gun: 0 },
    { yil: 4, ay: 2, gun: 0 },
    { yil: 1, ay: 0, gun: 15 },
    { yil: 1, ay: 3, gun: 0 },
    { yil: 0, ay: 4, gun: 15 },
  ]);
  assert.ok(r.ilamlar.every((i) => i.ceza_turu === 'sureli_hapis'));
  assert.deepEqual(r.toplam.ceza, { yil: 11, ay: 25, gun: 37 });
  assert.equal(r.toplam.uyusuyor, true);
  assert.deepEqual(r.uyarilar, []);
});

test('İçtima kararı: toplam uyuşmazsa uyarı; satır sarması ve adli paradan çevrilen hapis', () => {
  const metin = belge('ictima-karari.txt')
    .replace('11 YIL 25 AY 37 GÜN', '11 YIL 25 AY 30 GÜN')
    .replace('ilamı ile verilen 4 AY 15 GÜN HAPİS cezası', 'ilamı ile verilen adli para cezasından çevrili\n4 AY 15 GÜN HAPİS cezası');
  const r = belgeOku(metin);
  assert.equal(r.toplam.uyusuyor, false);
  assert.match(r.uyarilar[0], /uyuşmuyor/);
  assert.equal(r.ilamlar[5].ceza_turu, 'adli_paradan_cevrilen_hapis');
  assert.deepEqual(r.ilamlar[5].ceza, { yil: 0, ay: 4, gun: 15 });
});

test('Müddetname: ilam alanları, infaza başlama, gözaltı/tutukluluk aralıkları, infaz tarihleri', () => {
  const r = belgeOku(belge('muddetname.txt'));
  assert.equal(r.tur, 'muddetname');
  const i = r.ilamlar[0];
  assert.equal(i.mahkeme_kisa, 'Diyarbakır 4. Asliye Ceza');
  assert.deepEqual([i.esas_no, i.karar_no, i.karar_tarihi, i.suc_tarihi, i.kesinlesme_tarihi], ['2024/2475', '2025/699', '2025-05-08', '2024-02-03', '2025-06-10']);
  assert.deepEqual(i.ceza, { yil: 1, ay: 3, gun: 0 });
  assert.equal(i.suc_adi, 'Kasten yaralama');
  assert.deepEqual(i.maddeler.map((m) => [m.madde, m.fikra]), [['86', '2']]);
  assert.equal(r.infaz.baslama, '2025-08-05');
  assert.deepEqual(r.infaz.mahsuplar.map(({ kaynak, ...m }) => m), [
    { tur: 'gozalti', baslangic: '2024-02-02', bitis: '2024-02-03' },
    { tur: 'tutukluluk', baslangic: '2024-02-04', bitis: '2024-03-20' },
  ]);
  assert.deepEqual(r.muddetname, { acik: '2025-09-04', cikis: '2025-09-18', ks: '2026-09-18', bitis: '2026-09-18' });
  assert.equal(r.kisi.dogum_tarihi, '1990-09-19');
});

test('Gerekçeli karar: suç tarihi, suç adı, özel hüküm maddeleri ve sonuç ceza', () => {
  const r = belgeOku(belge('gerekceli-karar.txt'));
  assert.equal(r.tur, 'gerekceli_karar');
  const i = r.ilamlar[0];
  assert.equal(i.suc_tarihi, '2024-02-03');
  assert.equal(i.suc_adi, 'Kasten Yaralama');
  assert.deepEqual(i.ceza, { yil: 1, ay: 3, gun: 0 }, 'son "cezalandırılmasına" sonuç cezadır');
  assert.deepEqual(i.maddeler.map((m) => `${m.madde}/${m.fikra}-${m.bent}`), ['86/2-null', '86/3-e'], 'TCK 62 genel hükümdür, suç maddesi sayılmaz');
  assert.equal(i.karar_tarihi, '2025-05-08');
  assert.match(r.uyarilar[0], /birden çok suç maddesi/);
});

test('Tanınmayan veya kısa metin', () => {
  assert.equal(belgeOku('merhaba').tur, 'bilinmiyor');
  assert.equal(belgeOku('Bu bir dilekçedir ve içinde ceza bilgisi yoktur, sadece metin.').tur, 'bilinmiyor');
});

// En küçük ZIP: tek dosya, deflate (yöntem 8).
function zip(ad, icerik) {
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
const dosya = (ad, veri) => new File([veri], ad);

test('UDF (ZIP içinde content.xml CDATA) dosyası okunur', async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><template format_id="1.8"><content><![CDATA[${belge('ictima-karari.txt')}]]></content><properties/></template>`;
  const { metin, bicim } = await dosyaMetni(dosya('karar.udf', zip('content.xml', xml)));
  assert.equal(bicim, 'udf');
  const r = belgeOku(metin);
  assert.equal(r.tur, 'ictima_karari');
  assert.equal(r.ilamlar.length, 6);
});

test('HTML sayfası ve PDF uyarısı', async () => {
  const html = `<html><body><div>${belge('muddetname.txt').split('\n').join('</div><div>')}</div></body></html>`;
  const { metin, bicim } = await dosyaMetni(dosya('evrak.html', html));
  assert.equal(bicim, 'html');
  assert.equal(belgeOku(metin).muddetname.ks, '2026-09-18');
  await assert.rejects(dosyaMetni(dosya('karar.pdf', '%PDF-1.7 …')), BelgeHatasi);
});

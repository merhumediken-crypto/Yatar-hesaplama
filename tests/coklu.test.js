// Çok ilamlı dosya ve belgeden aktarım: içtima kararı → ilamlar, müddetname → eşleşen ilam,
// ilam başına soru sırası, ilam görünümü yönlendirmesi, toplama sonucu ve kayıt/yükleme.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { belgeOku, hesapla } from '../extension/cekirdek/index.js';
import { belgeyiAktar, eslesenIlamlar, sucOnerileri } from '../extension/ui/belge-aktar.js';
import { bosDosya, dosyaYukle, hesaplanabilir, ilamEkle, ilamGorunumu, ilamSil, vakaKur } from '../extension/ui/dosya.js';
import { ayniOrnek, bilinmiyorCevabi, cevapGruplari, cevapla, gorunenSira, soru, sonrakiSoru, temelSira, varsayimSatirlari } from '../extension/ui/sorular.js';
import { paylasimMetni, sonucOzeti } from '../extension/ui/ozet.js';
import { kt, HESAP } from './yardimci.js';

const metin = (ad) => fs.readFileSync(new URL(`./belgeler/${ad}`, import.meta.url), 'utf8');
const oku = (ad) => belgeOku(metin(ad));
const SUC_TARIHLERI = ['2017-01-10', '2017-01-10', '2014-03-01', '2023-02-01', null, '2025-02-01'];

// İçtima kararı + müddetname; eksik suç tarihleri doldurulmuş, cevaplanabilir dosya.
function hazirDosya() {
  let { dosya: d } = belgeyiAktar(null, oku('ictima-karari.txt'), { mod: 'yeni' });
  ({ dosya: d } = belgeyiAktar(d, oku('muddetname.txt'), { mod: 'birlestir' }));
  d.ilamlar.forEach((il, i) => {
    il.suc_tarihi ||= SUC_TARIHLERI[i];
  });
  return d;
}

test('içtima kararı aktarımı: her ilam bir kayıt, doğum tarihi ve karar özeti dosyaya', () => {
  const { dosya: d, degisiklikler, uyarilar } = belgeyiAktar(null, oku('ictima-karari.txt'), { mod: 'yeni' });
  assert.equal(d.ilamlar.length, 6);
  assert.deepEqual(uyarilar, []);
  assert.deepEqual(d.ilamlar.map((il) => il.meta.infaz_no), ['2020/2-4124', '2020/2-4123', '2021/1-4466', '2025/7-3427', '2025/2-10594', '2025/7-15447']);
  assert.deepEqual(d.ilamlar[0].ceza, { yil: 4, ay: 8, gun: 7 });
  assert.equal(d.ilamlar[0].meta.etiket, 'Diyarbakır 12. Asliye Ceza 2017/157 E.');
  assert.equal(d.ilamlar[2].meta.karar_tarihi, '2014-12-16');
  // İçtima kararında suç tarihi ve suç yok: sorulacak.
  assert.ok(d.ilamlar.every((il) => !il.suc_tarihi && !il.suc));
  assert.equal(d.ek.dogum_tarihi, '1990-09-19');
  assert.deepEqual(d.belge.toplam, { yil: 11, ay: 25, gun: 37 });
  assert.equal(d.belge.uyusuyor, true);
  assert.equal(degisiklikler.length, 7);
  assert.match(degisiklikler.at(-1), /Doğum tarihi 19\.09\.1990/);
});

test('müddetname birleştirme: infaz numarasıyla eşleşen ilam dolar, giriş ve tarihler aktarılır', () => {
  const { dosya: ilk } = belgeyiAktar(null, oku('ictima-karari.txt'), { mod: 'yeni' });
  const okuma = oku('muddetname.txt');
  assert.deepEqual(eslesenIlamlar(ilk, okuma.ilamlar[0]), [4]);
  const { dosya: d, degisiklikler, uyarilar } = belgeyiAktar(ilk, okuma, { mod: 'birlestir' });
  const il = d.ilamlar[4];
  assert.equal(il.suc_tarihi, '2024-02-03');
  assert.deepEqual(il.suc, { kanun: 5237, madde: '86', fikra: '2', bent: null });
  assert.deepEqual(il.mahsup, [
    { tur: 'gozalti', baslangic: '2024-02-02', bitis: '2024-02-03' },
    { tur: 'tutukluluk', baslangic: '2024-02-04', bitis: '2024-03-20' },
  ]);
  assert.equal(il.meta.suc_adi, 'Kasten yaralama');
  assert.deepEqual([d.konum, d.giris], ['cezaevinde', { tur: 'tarih', tarih: '2025-08-05' }]);
  // Tek ilamın müddetnamesi: KS ve tahliye tarihleri toplanan cezalarla karşılaştırılmaz.
  assert.deepEqual(d.muddetname, {});
  assert.equal(uyarilar.length, 1);
  assert.match(uyarilar[0], /yalnız Diyarbakır 4\. Asliye Ceza 2024\/2475 E\. için düzenlenmiş \(1 yıl 3 ay\)/);
  // Diğer ilamlara dokunulmaz; içtima kararının özeti korunur.
  assert.ok(d.ilamlar.filter((_, i) => i !== 4).every((x) => !x.suc_tarihi && !x.mahsup));
  assert.equal(d.belge.tur, 'ictima_karari');
  assert.ok(degisiklikler.some((x) => /Cezaevine giriş 05\.08\.2025/.test(x)));
  // Mevcut dosya değiştirilmez (aktarım kopya üzerinde yapılır).
  assert.equal(ilk.ilamlar[4].suc_tarihi, null);
});

test('birleştirme avukatın girdiği cevapları değiştirmez', () => {
  const { dosya: ilk } = belgeyiAktar(null, oku('ictima-karari.txt'), { mod: 'yeni' });
  ilk.ilamlar[4].suc_tarihi = '2024-01-15';
  ilk.ilamlar[4].suc = { kanun: 5237, madde: '86', fikra: '3', bent: 'e' };
  ilk.ilamlar[4].mahsup = [];
  ilk.giris = { tur: 'tarih', tarih: '2025-08-01' };
  const { dosya: d, degisiklikler } = belgeyiAktar(ilk, oku('muddetname.txt'), { mod: 'birlestir' });
  assert.equal(d.ilamlar[4].suc_tarihi, '2024-01-15');
  assert.equal(d.ilamlar[4].suc.fikra, '3');
  assert.deepEqual(d.ilamlar[4].mahsup, []);
  assert.equal(d.giris.tarih, '2025-08-01');
  assert.ok(!degisiklikler.some((x) => /suç tarihi|Cezaevine giriş|Gözaltı/.test(x)));
});

test('aynı hükümden birden çok ilamla eşleşen belge: suç tarihi ve mahsup otomatik aktarılmaz', () => {
  const { dosya: ilk } = belgeyiAktar(null, oku('ictima-karari.txt'), { mod: 'yeni' });
  const md = metin('muddetname.txt')
    .replace(/İnfaz No : .*\n/, '')
    .replace('Esas No : 2024/2475', 'Esas No : 2017/157')
    .replace('Karar No : 2025/699', 'Karar No : 2018/343')
    .replace('Cezası : 1 YIL 3 AY HAPİS', 'Cezası : 2 YIL HAPİS');
  const okuma = belgeOku(md);
  assert.deepEqual(eslesenIlamlar(ilk, okuma.ilamlar[0]), [0, 1]);
  const { dosya: d, uyarilar } = belgeyiAktar(ilk, okuma, { mod: 'birlestir' });
  assert.equal(d.ilamlar[0].suc_tarihi, null);
  assert.equal(d.ilamlar[1].suc_tarihi, null);
  assert.equal(d.ilamlar[0].mahsup, null);
  assert.ok(uyarilar.some((u) => /birden çok ilamla eşleşti/.test(u)));
  assert.ok(uyarilar.some((u) => /hangi ilama ait olduğu belirlenemediği/.test(u)));
  // Ceza miktarı ayırt ederse tek ilama iner.
  const tek = belgeOku(md.replace('Cezası : 2 YIL HAPİS', 'Cezası : 1 YIL 8 AY HAPİS'));
  assert.deepEqual(eslesenIlamlar(ilk, tek.ilamlar[0]), [1]);
});

test('"yeni" kipi mevcut dosyayı tamamen değiştirir; boş dosyaya birleştirme yeni başlangıçtır', () => {
  const eski = bosDosya();
  eski.konum = 'girmedi';
  eski.ilamlar[0].suc_tarihi = '2024-01-01';
  const yeni = belgeyiAktar(eski, oku('ictima-karari.txt'), { mod: 'yeni' }).dosya;
  assert.equal(yeni.konum, null);
  assert.equal(yeni.ilamlar.length, 6);
  // Yalnız konum cevaplanmış boş dosya: ilamlar belgeden gelir, konum korunur.
  const bos = bosDosya();
  bos.konum = 'cezaevinde';
  const b = belgeyiAktar(bos, oku('ictima-karari.txt'), { mod: 'birlestir' }).dosya;
  assert.equal(b.konum, 'cezaevinde');
  assert.equal(b.ilamlar.length, 6);
});

test('gerekçeli karar: birden çok madde varsa öneri olarak saklanır, kesin madde seçilmez', () => {
  const okuma = oku('gerekceli-karar.txt');
  const oneriler = sucOnerileri(okuma.ilamlar[0]);
  assert.ok(oneriler.length > 1);
  const d = belgeyiAktar(null, okuma, { mod: 'yeni' }).dosya;
  assert.equal(d.ilamlar[0].suc, null);
  assert.equal(d.ilamlar[0].meta.madde_onerileri.length, oneriler.length);
});

test('çok ilamda soru sırası: önce dosya soruları, sonra her ilamın soruları', () => {
  const { dosya: d } = belgeyiAktar(null, oku('ictima-karari.txt'), { mod: 'yeni' });
  const sira = temelSira(d).map((o) => `${o.s.id}@${o.i ?? '-'}`);
  assert.deepEqual(sira.slice(0, 8), ['konum@-', 'giris@-', 'suc_tarihi@0', 'ceza@0', 'suc@0', 'tekerrur@0', 'esas_ceza@0', 'mahsup@0']);
  assert.equal(sira.length, 2 + 6 * 6);
  const ilk = sonrakiSoru(kt, d, HESAP, null);
  assert.deepEqual([ilk.s.id, ilk.i], ['konum', null]);
  cevapla(ilk.g, ilk.s, 'cezaevinde');
  const giris = sonrakiSoru(kt, d, HESAP, null);
  cevapla(giris.g, giris.s, { tur: 'tarih', tarih: '2025-08-05' });
  // Ceza belgeden geldi: ilk ilamda suç tarihinden sonra suç sorulur.
  const s1 = sonrakiSoru(kt, d, HESAP, null);
  assert.deepEqual([s1.s.id, s1.i], ['suc_tarihi', 0]);
  cevapla(s1.g, s1.s, '2017-01-10');
  const s2 = sonrakiSoru(kt, d, HESAP, null);
  assert.deepEqual([s2.s.id, s2.i], ['suc', 0]);
  bilinmiyorCevabi(s2.g, 'suc');
  assert.deepEqual(d.ilamlar[0].bilinmiyor, ['suc']);
  assert.deepEqual(d.bilinmiyor, []);
  const s3 = sonrakiSoru(kt, d, HESAP, null);
  assert.deepEqual([s3.s.id, s3.i], ['tekerrur', 0]);
  // Görünen sıra: cevaplanan ve sıradaki soru örnekleri; "geri" bir önceki örneğe gider.
  const gs = gorunenSira(d);
  const n = gs.findIndex((o) => ayniOrnek(o, s3));
  assert.deepEqual([gs[n - 1].s.id, gs[n - 1].i], ['suc', 0]);
});

test('ilam görünümü: ilam alanları ilama, kişi alanları dosyaya yazılır', () => {
  const d = bosDosya();
  ilamEkle(d);
  const g = ilamGorunumu(d, 1);
  cevapla(g, soru('suc_tarihi'), '2024-05-01');
  cevapla(g, soru('magdur_yakinlik'), 'es');
  cevapla(g, soru('rapor'), false);
  bilinmiyorCevabi(g, 'tekerrur');
  bilinmiyorCevabi(g, 'kadin_cocuk');
  assert.equal(d.ilamlar[1].suc_tarihi, '2024-05-01');
  assert.equal(d.ilamlar[0].suc_tarihi, null);
  assert.deepEqual(d.ilamlar[1].ek, { magdur_yakinlik: 'es' });
  assert.deepEqual(d.ek, { rapor: false });
  assert.deepEqual(d.ilamlar[1].bilinmiyor, ['tekerrur']);
  assert.deepEqual(d.bilinmiyor, ['kadin_cocuk']);
  // Kişi cevabı her ilam görünümünden okunur.
  assert.equal(ilamGorunumu(d, 0).ek.rapor, false);
  assert.equal(ilamGorunumu(d, 0).ek.magdur_yakinlik, undefined);
});

test('çok ilamlı hesap: toplama sonucu, ilam dökümü, ilam adlı cevap grupları ve paylaşım metni', () => {
  const d = hazirDosya();
  d.ilamlar[0].bilinmiyor = ['tekerrur'];
  assert.ok(hesaplanabilir(d));
  const c = hesapla(kt, vakaKur(d, HESAP));
  const o = sonucOzeti(kt, d, c, null, hesapla(kt, vakaKur(d, HESAP, { dsTalebi: false })));
  assert.equal(o.durum, 'tamam');
  assert.equal(o.senaryo, 'birlesik');
  assert.equal(o.baslik, 'Toplanan cezalar · 6 ilam');
  assert.deepEqual([o.kapali, o.acik, o.ds], [432, 1557, 365]);
  assert.deepEqual(o.toplama.toplam_ceza, { yil: 11, ay: 25, gun: 37 });
  assert.equal(o.toplama.ilamlar.length, 6);
  assert.equal(o.toplama.ks_gun, 2402);
  assert.equal(o.gerekce.adimlar.length, 6);
  assert.match(paylasimMetni(d, o), /^Toplam 11 yıl 25 ay 37 gün hapis · 6 ilam \(toplanarak infaz\)/);
  // Aynı hükümden iki ilam aynı etiketi taşır; metinde sırayla ayrılır.
  assert.ok(o.varsayimlar.includes('Diyarbakır 12. Asliye Ceza 2017/157 E. (1. ilam): Tekerrür bilinmiyor: tekerrürsüz gösterildi, tekerrürlü sonuçlar altta.'));
  const gruplar = cevapGruplari(d);
  assert.equal(gruplar.length, 7);
  assert.equal(gruplar[0].baslik, null);
  assert.deepEqual(gruplar[5].cevaplar.map((x) => x.metin), ['Suç 03.02.2024', '1 yıl 3 ay', 'TCK 86/2 · Kasten yaralama', 'Mahsup 48 gün']);
  assert.ok(gruplar.slice(1).every((g, i) => g.i === i && g.cevaplar.every((x) => x.i === i)));
  // Sıradaki soru belgeli ilamın sorusudur (dosya soruları cevaplı).
  const s = sonrakiSoru(kt, d, HESAP, c);
  assert.deepEqual([s.s.id, s.i], ['suc', 0]);
});

test('kayıt ve yükleme: çok ilamlı dosya bütün alanlarıyla geri gelir; ilam ekleme/çıkarma', () => {
  const d = hazirDosya();
  d.ilamlar[2].meta.madde_onerileri = [{ kanun: 5237, madde: '86', fikra: '2', bent: null }];
  const geri = dosyaYukle(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(geri, d);
  // Bozuk ilam alanları atılır, dosya açılır.
  const bozuk = JSON.parse(JSON.stringify(d));
  bozuk.ilamlar[1].suc_tarihi = '2017-13-45';
  bozuk.ilamlar[1].ceza = { yil: -1 };
  bozuk.ilamlar[1].meta.karar_tarihi = 'dün';
  const y = dosyaYukle(bozuk);
  assert.deepEqual([y.ilamlar[1].suc_tarihi, y.ilamlar[1].ceza, y.ilamlar[1].meta.karar_tarihi], [null, null, undefined]);
  assert.equal(y.ilamlar.length, 6);
  // İlam ekleme ve çıkarma; son ilam çıkarılamaz.
  const i = ilamEkle(d);
  assert.equal(i, 6);
  assert.equal(hesaplanabilir(d), false);
  assert.ok(temelSira(d).some((o) => o.s.id === 'suc_tarihi' && o.i === 6));
  ilamSil(d, 6);
  ilamSil(d, 0);
  assert.equal(d.ilamlar.length, 5);
  const tek = bosDosya();
  ilamSil(tek, 0);
  assert.equal(tek.ilamlar.length, 1);
  assert.deepEqual(varsayimSatirlari(tek), []);
});

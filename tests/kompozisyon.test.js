// Kompozisyon: sonucun geometrik resmi (ui/kompozisyon.js). Biçimler veriyle orantılı,
// çıktı belirlenimci ve geçerli SVG olmalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sonucKompozisyonu, seritGenislikleri, bosKompozisyon, fazSimgeleri } from '../extension/ui/kompozisyon.js';

const ornek = (ek = {}) => ({ kapali: 30, acik: 175, ds: 365, tarihler: { acik: '2026-01-31', cikis: '2026-07-25', ks: '2027-07-25', bitis: '2029-02-15' }, ...ek });
const seritler = (svg) => [...svg.matchAll(/<rect class="kz-(kapali|acik|ds|kalan)" x="([\d.]+)" y="122" width="([\d.]+)"/g)].map((m) => ({ tur: m[1], x: Number(m[2]), w: Number(m[3]) }));

test('şerit genişlikleri günlerle orantılı; dar bölüm en az 10, toplam 600', () => {
  const w = seritGenislikleri([30, 175, 365, 571]);
  assert.equal(Math.round(w.reduce((a, b) => a + b, 0)), 600);
  assert.ok(Math.abs(w[1] / w[2] - 175 / 365) < 0.01);
  assert.deepEqual(seritGenislikleri([0, 0, 0, 0]), [0, 0, 0, 0]);
  const dar = seritGenislikleri([1, 0, 5000, 0]);
  assert.equal(dar[0], 10);
  assert.equal(dar[1], 0);
  assert.equal(Math.round(dar[0] + dar[2]), 600);
});

test('kompozisyon: her evre şeritte sırayla; çıkış çizgisi açık bölümün sonunda', () => {
  const svg = sonucKompozisyonu(ornek());
  assert.match(svg, /^<svg class="kompozisyon" viewBox="0 0 600 224" role="img" aria-label="Kompozisyon: 30 gün kapalı, 175 gün açık, 365 gün denetimli serbestlik, koşullu salıverilmeden ceza bitişine 571 gün">/);
  const s = seritler(svg);
  assert.deepEqual(s.map((x) => x.tur), ['kapali', 'acik', 'ds', 'kalan']);
  for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i].x - (s[i - 1].x + s[i - 1].w)) < 0.2, 'bölümler bitişik');
  const cikis = Number(/<line class="kz-cizgi" x1="([\d.]+)"/.exec(svg)[1]);
  assert.ok(Math.abs(cikis - (s[1].x + s[1].w)) < 0.2);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  // Her evrenin biçimi: kapalı daire, açık yarım daire (yol), DS kare.
  assert.match(svg, /<circle class="kz-kapali"/);
  assert.match(svg, /<path class="kz-acik" d="M/);
  assert.equal((svg.match(/class="kz-ds"/g) || []).length >= 2, true);
});

test('kompozisyon belirlenimci; farklı dosya farklı resim verir', () => {
  assert.equal(sonucKompozisyonu(ornek()), sonucKompozisyonu(ornek()));
  assert.notEqual(sonucKompozisyonu(ornek()), sonucKompozisyonu(ornek({ kapali: 31 })));
});

test('kompozisyon: sıfır evre, KS yok (bütün süre kapalı) ve uzun cezalar', () => {
  const kapali = sonucKompozisyonu({ kapali: 730, acik: 0, ds: 0, tarihler: { cikis: '2028-01-01', ks: null, bitis: '2028-01-01' } });
  assert.deepEqual(seritler(kapali).map((x) => x.tur), ['kapali']);
  assert.doesNotMatch(kapali, /kz-ince|NaN/);
  const uzun = sonucKompozisyonu({ kapali: 432, acik: 1557, ds: 365, tarihler: { cikis: '2031-01-15', ks: '2032-01-15', bitis: '2038-08-14' } });
  const kare = /<rect class="kz-ds" x="([\d.]+)" y="164" width="([\d.]+)"/.exec(uzun);
  const ks = Number(/<line class="kz-ince" x1="([\d.]+)"/.exec(uzun)[1]);
  assert.ok(kare, 'dar DS bölümünün karesi şeridin altına asılır');
  assert.ok(Number(kare[1]) + Number(kare[2]) <= ks - 5, 'asılı kare KS çizgisine çarpmaz');
});

test('boş ekran resmi ve evre simgeleri', () => {
  assert.match(bosKompozisyon(), /role="img"/);
  assert.match(fazSimgeleri(), /kz-kapali.*kz-acik.*kz-ds/);
});

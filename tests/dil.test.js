// infaz-kosul 1.0 uyum testleri: kural tabanındaki karar_mantigi_testleri (M001-M125)
// başvuru yorumlayıcısıyla aynı sonucu vermelidir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { degerlendir, izliDegerlendir, ifadeyiDogrula } from '../extension/cekirdek/index.js';
import { KAYNAK, kt } from './yardimci.js';

const testler = KAYNAK.karar_mantigi_testleri.testler;

test('Kural tabanı 125 mantık testi içerir ve hepsi başvuru yorumlayıcısında geçmiştir', () => {
  assert.equal(testler.length, 125);
  assert.equal(KAYNAK.karar_mantigi_testleri.basarisiz, 0);
});

for (const t of testler) {
  test(`${t.test_id}: ${t.amac}`, () => {
    const ifade = t.ifade || (t.hedef_id.startsWith('SC') ? kt.seciciler.get(t.hedef_id).kosul : kt.dugum(t.hedef_id).kosul);
    assert.equal(degerlendir(ifade, t.girdi, { seciciler: kt.seciciler }), t.beklenen);
  });
}

test('Kleene doğruluk tabloları', () => {
  const D = [true, false, null];
  const ifade = (op) => ({ op, kosullar: [{ op: 'eq', alan: 'a', deger: true }, { op: 'eq', alan: 'b', deger: true }] });
  for (const a of D) {
    for (const b of D) {
      const ve = a === false || b === false ? false : a === true && b === true ? true : null;
      const veya = a === true || b === true ? true : a === false && b === false ? false : null;
      assert.equal(degerlendir(ifade('and'), { a, b }), ve, `and ${a}/${b}`);
      assert.equal(degerlendir(ifade('or'), { a, b }), veya, `or ${a}/${b}`);
    }
  }
  assert.equal(degerlendir({ op: 'not', kosul: { op: 'eq', alan: 'a', deger: true } }, {}), null);
});

test('Tip uyuşmazlığı belirsizdir ve veri hatası kaydedilir; string sayı çevrilmez', () => {
  const r = izliDegerlendir({ op: 'gte', alan: 'kisi.suc_yasi', deger: 18 }, { kisi: { suc_yasi: '30' } });
  assert.equal(r.deger, null);
  assert.equal(r.veriHatalari.length, 1);
});

test('once_kesinlesme: aynı gün sıra belirsiz', () => {
  const ifade = { op: 'once_kesinlesme', sol: 'onceki.k', sag: 'ilam.s' };
  assert.equal(degerlendir(ifade, { onceki: { k: '2025-01-01' }, ilam: { s: '2025-01-02' } }), true);
  assert.equal(degerlendir(ifade, { onceki: { k: '2025-01-02' }, ilam: { s: '2025-01-01' } }), false);
  assert.equal(degerlendir(ifade, { onceki: { k: '2025-01-01' }, ilam: { s: '2025-01-01' } }), null);
});

test('Belirsiz alanlar yalnız sonucu etkileyen dallardan toplanır', () => {
  const ifade = { op: 'or', kosullar: [{ op: 'eq', alan: 'a', deger: 1 }, { op: 'eq', alan: 'b', deger: 1 }] };
  assert.deepEqual(izliDegerlendir(ifade, { a: 1 }).belirsizAlanlar, []);
  assert.deepEqual(izliDegerlendir(ifade, { a: 2 }).belirsizAlanlar, ['b']);
});

test('Tanımsız operatör ve seçici reddedilir; ifade eval edilmez', () => {
  assert.throws(() => degerlendir({ op: 'eval', alan: 'x', deger: 'process.exit()' }, {}));
  assert.throws(() => degerlendir({ op: 'secici', secici_id: 'SC99' }, {}, { seciciler: kt.seciciler }));
  assert.ok(ifadeyiDogrula({ op: 'eq', alan: 'bilinmeyen.alan', deger: 1 }, { alanlar: new Set(kt.alanSozlugu.keys()) }).length);
});

test('Bütün karar düğümü ve seçici ifadeleri şemaya ve alan sözlüğüne uyar', () => {
  const alanlar = new Set(kt.alanSozlugu.keys());
  for (const s of kt.seciciler.values()) assert.deepEqual(ifadeyiDogrula(s.kosul, { alanlar, seciciler: kt.seciciler }), [], s.secici_id);
  for (const d of kt.dugumler.values()) assert.deepEqual(ifadeyiDogrula(d.kosul, { alanlar, seciciler: kt.seciciler }), [], d.dugum_id);
});

// Birden çok ilamın toplanarak infazı (cekirdek/toplama).
import test from 'node:test';
import assert from 'node:assert/strict';
import { hesapla, takvim as T, Kesir } from '../extension/cekirdek/index.js';
import { kt, HESAP } from './yardimci.js';

const ilam = (n, suc_tarihi, ceza, madde = '141', ek = {}) => ({
  ilam_id: `I${n}`,
  etiket: `${n}. ilam`,
  suc_tarihi,
  hukumdeki_sonuc_ceza: ceza,
  kanun_madde_fikra_bent: { kanun: 5237, madde },
  hukumdeki_ceza_turu: 'sureli_hapis',
  hukumdeki_tekerrur: 'yok',
  kast_turu: 'kasit',
  teror_kanunu_kapsami: false,
  orgut_faaliyeti: false,
  ...ek,
});
const vaka = (ilamlar, ek = {}) => ({ hesap_tarihi: HESAP, infaza_baslama_tarihi: '2026-01-01', iyi_hal: true, ds_talebi: true, mahsup_kayitlari: [], suclar_ve_ilamlar: ilamlar, ...ek });
const birlesik = (c) => c.senaryolar.birlesik;
const E = '2026-01-01';
const gun = (c) => T.gunFarki(E, T.cezaEkle(E, c));

test('İki ilam tek cezaya denktir: 1 yıl + 1 yıl (2025) = 2 yıl', () => {
  const c = hesapla(kt, vaka([ilam(1, '2025-07-01', { yil: 1 }), ilam(2, '2025-08-01', { yil: 1 })]));
  const S = birlesik(c);
  assert.equal(c.secili_senaryo, 'birlesik');
  assert.deepEqual(c.toplama.toplam_ceza, { yil: 2, ay: 0, gun: 0 });
  const tek = hesapla(kt, { ...vaka([ilam(1, '2025-07-01', { yil: 2 })]), suclar_ve_ilamlar: [{ ...ilam(1, '2025-07-01', { yil: 2 }), kesinlesme_tarihi: '2025-12-01' }] }).senaryolar.yok;
  assert.equal(S.ks_gun, tek.ks_gun);
  assert.equal(S.takvim.kosullu_saliverilme, tek.takvim.kosullu_saliverilme);
  assert.equal(S.takvim.hak_ederek_tahliye, '2028-01-01');
  assert.equal(S.acik_kurum.yol, 'dogrudan', 'toplam 2 yıl: doğrudan açık');
  assert.equal(S.asgari_kurum.gun, 36, 'onda bir: (182,5 + 182,5) / 10');
  assert.equal(S.kurumda_kalis_gun, 36);
});

test('Her ilam kendi oranıyla: kasten öldürme 2/3 + hırsızlık 1/2', () => {
  const a = { yil: 6 };
  const b = { yil: 2, ay: 6 };
  const c = hesapla(kt, vaka([ilam(1, '2021-01-01', a, '81'), ilam(2, '2021-02-01', b, '141')]));
  const S = birlesik(c);
  const [k1, k2] = c.toplama.ilamlar;
  assert.equal(String(k1.oran), '2/3');
  assert.equal(String(k2.oran), '1/2');
  assert.equal(k1.gun, gun(a));
  assert.equal(k2.gun, gun(b));
  const beklenen = new Kesir(gun(a)).carp(new Kesir(2, 3)).topla(new Kesir(gun(b)).carp(new Kesir(1, 2)));
  assert.equal(S.ks_ham_gun.karsilastir(beklenen), 0);
  assert.equal(S.ks_gun, Math.floor(beklenen.pay / beklenen.payda), 'kesirli gün aşağı yuvarlanır');
  assert.ok(S.izler.some((i) => i.adim === 'KS paylarının toplamı'));
});

test('107/3-e: birden fazla süreli hapiste KS süresi en fazla 28 yıl', () => {
  const c = hesapla(kt, vaka([ilam(1, '2021-01-01', { yil: 20 }, '81'), ilam(2, '2021-02-01', { yil: 20 }, '81'), ilam(3, '2021-03-01', { yil: 20 }, '81')]));
  const S = birlesik(c);
  assert.equal(S.ks_gun, T.gunFarki(E, T.yilEkle(E, 28)));
  assert.ok(S.izler.some((i) => i.adim === '107/3-4 tavanı'));
});

test('Karma rejim: 2019 ve 2025 suçlarında geçici 6/1 ve 10/6 bütün toplama uygulanmaz', () => {
  const c = hesapla(kt, vaka([ilam(1, '2019-01-01', { yil: 4 }), ilam(2, '2025-07-01', { yil: 1 })]));
  const S = birlesik(c);
  assert.notEqual(S.secilen_ds_yolu, 'DS_gecici6_1');
  assert.notEqual(S.secilen_ds_yolu, 'gecici10_6');
  const g61 = S.ds_yollari.find((y) => y.id === 'DS_gecici6_1');
  assert.equal(g61.uygun, false);
  assert.ok(g61.karma);
  assert.match(g61.neden, /^2\. ilam/);
  assert.ok(S.notlar.some((n) => n.seviye === 'inceleme' && /Karma rejim/.test(n.mesaj)));
  assert.equal(c.durum, 'hukuki_inceleme_gerekli');
  assert.equal(S.asgari_kurum.uygulanir, true, 'yalnız 2025 ilamının payına onda bir');
});

test('Bütün ilamlar 31/07/2023 öncesi: geçici 10/6 toplama uygulanır', () => {
  const c = hesapla(kt, vaka([ilam(1, '2022-01-01', { yil: 3 }), ilam(2, '2023-01-01', { yil: 3 })]));
  const S = birlesik(c);
  assert.equal(S.secilen_ds_yolu, 'gecici10_6');
  assert.equal(S.ds_yollari.find((y) => y.id === 'gecici10_6').karma, undefined);
});

test('Açık kurum: bir ilamda terör suçu varsa toplamda açığa ayrılma yasağı', () => {
  const c = hesapla(kt, vaka([ilam(1, '2021-01-01', { yil: 3 }), ilam(2, '2021-01-01', { yil: 3 }, '314', { teror_kanunu_kapsami: true })]));
  const S = birlesik(c);
  assert.equal(S.acik_kurum.yol, 'yasak');
  assert.match(S.acik_kurum.yasaklar[0].neden, /^2\. ilam/);
});

test('Tekerrür ilam başına: 1. tekerrürde 108/2 sınırı o ilamın önceki cezasıyla', () => {
  const c = hesapla(kt, vaka([ilam(1, '2021-01-01', { yil: 6 }, '141', { hukumdeki_tekerrur: 'birinci', tekerrure_esas_en_agir_ceza: { ay: 2 } }), ilam(2, '2021-02-01', { yil: 1 })]));
  const [k1, k2] = c.toplama.ilamlar;
  assert.equal(k1.tekerrur, 'birinci');
  assert.match(k1.neden, /108\/2 sınırı uygulandı/);
  // pay = 6 yıl × 1/2 + 2 ay (60 gün)
  assert.equal(k1.ks_ham_gun.karsilastir(new Kesir(gun({ yil: 6 })).carp(new Kesir(1, 2)).topla(60)), 0);
  assert.equal(k2.tekerrur, 'yok');
});

test('Adli paradan çevrilen hapis toplamaya aynen çekilecek süre olarak girer; DS kapanır', () => {
  const c = hesapla(kt, vaka([ilam(1, '2025-07-01', { yil: 2 }), ilam(2, '2025-07-01', { ay: 6 }, '141', { hukumdeki_ceza_turu: 'adli_para', infazdaki_ceza_turu: 'adli_paradan_cevrilen_hapis', para_cezasindan_cevrilme: true })]));
  const S = birlesik(c);
  const k2 = c.toplama.ilamlar[1];
  assert.equal(k2.para_hapis, true);
  assert.equal(String(k2.oran), '1');
  assert.equal(S.secilen_ds_yolu, null);
  assert.equal(S.takvim.kurumdan_cikis, S.takvim.kosullu_saliverilme);
});

test('Müebbet içeren toplama hesaplanmaz; eksik suç tarihi ilam adıyla bildirilir', () => {
  const m = hesapla(kt, vaka([ilam(1, '2021-01-01', null, '81', { hukumdeki_ceza_turu: 'muebbet' }), ilam(2, '2021-01-01', { yil: 2 })]));
  assert.equal(m.durum, 'hukuki_inceleme_gerekli');
  assert.match(m.notlar[0].mesaj, /Müebbet/);
  const e = hesapla(kt, vaka([ilam(1, null, { yil: 1 }), ilam(2, '2021-01-01', { yil: 2 })]));
  assert.equal(e.durum, 'eksik_veri');
  assert.match(e.eksik_veri[0].mesaj, /^1\. ilam: suç tarihi/);
});

test('Mahsup toplam cezadan düşülür; hak ederek tahliye toplam bileşenlerle', () => {
  const c = hesapla(kt, vaka([ilam(1, '2017-01-10', { yil: 4, ay: 8, gun: 7 }), ilam(2, '2014-03-01', { yil: 1, ay: 8 })], { mahsup_kayitlari: [{ tur: 'tutukluluk', gun: 100 }] }));
  const S = birlesik(c);
  assert.equal(S.takvim.etkin_baslangic, T.gunEkle(E, -100));
  assert.equal(S.takvim.hak_ederek_tahliye, T.cezaEkle(T.gunEkle(E, -100), { yil: 5, ay: 16, gun: 7 }));
});

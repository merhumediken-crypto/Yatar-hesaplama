// Kural tabanındaki kabul senaryoları (K01-K34). Her test, ilgili senaryonun
// "beklenti" alanını hesap motorunun çıktısına eşler.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  hesapla,
  KuralTabani,
  katalogEslesir,
  oncekiMahkumiyetDegerlendir,
  tekerrurTespit,
  toplamaDegerlendir,
  gunAgirligiBelirle,
  agirlikliGunToplami,
} from '../extension/engine/index.js';

const db = JSON.parse(fs.readFileSync(new URL('../extension/data/kural_tabani.json', import.meta.url), 'utf8'));
const kt = new KuralTabani(db);
const IZINLI = db.hesap_politikasi.bu_paket_ile_izin_verilen_sonuc;
const HESAP = '2026-10-17';

function vaka(ilam = {}, ek = {}) {
  return {
    hesap_tarihi: HESAP,
    infaza_baslama_tarihi: '2026-01-01',
    mahsup_gun: 0,
    dogum_tarihi: '1990-01-01',
    ...ek,
    ilam: {
      hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 },
      kast_turu: 'kasit',
      ceza_turu: 'sureli_hapis',
      teror_kanunu_kapsami: false,
      orgut_faaliyeti: false,
      orgut_kurma_yonetme: false,
      para_cezasindan_cevrilme: false,
      kanun_madde_fikra_bent: { kanun: 5237, madde: '141' },
      ...ilam,
    },
  };
}

function onceki(ek = {}) {
  return {
    ilam_id: 'O1',
    suc_tarihi: '2015-01-01',
    kesinlesme_tarihi: '2016-01-01',
    kast_turu: 'kasit',
    ceza_turu: 'sureli_hapis',
    ceza: { yil: 1, ay: 0, gun: 0 },
    infaz_durumu: 'tamamlandi',
    infaz_tamamlanma_tarihi: '2024-01-01',
    tekerrur_uygulanmis_mi: false,
    karar_turu: 'mahkumiyet',
    tekerrure_esas_olamaz: false,
    yabanci_mahkeme_karari: false,
    sirf_askeri_suc: false,
    ...ek,
  };
}

const yeni = (ek = {}) => ({ suc_tarihi: '2025-07-01', kast_turu: 'kasit', dogum_tarihi: '1990-01-01', ...ek });

test('Kural tabanında 34 kabul senaryosu bulunur', () => {
  assert.equal(db.kabul_senaryolari.length, 34);
});

test('K01: İki alanla kesin sonuç verilemez', () => {
  const r = hesapla(db, { hesap_tarihi: HESAP, ilam: { suc_tarihi: '2025-06-05', hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 } } });
  assert.equal(r.durum, 'eksik_veri');
  assert.equal(r.tekerrur.belgelerden_aday_tespit, null);
  assert.equal(r.tekerrur.hukumde_uygulanan, null);
  assert.equal(r.kurumda_kalacak_sure_gun, null);
  // Üç senaryo yalnız karşılaştırmalı/varsayımlı olarak üretilir.
  for (const s of Object.values(r.senaryolar)) assert.notEqual(s.durum, 'kaynaklari_dogrulanmis_hesap');
});

test('K02: 03/06/2025 suçunda onda bir şartı yok', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-06-03' }));
  assert.equal(r.senaryolar.yok.asgari_kurum.uygulanir, false);
});

test('K03: 04/06/2025 sınır gününde onda bir şartı var', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-06-04' }));
  assert.equal(r.senaryolar.yok.asgari_kurum.uygulanir, true);
});

test('K04: 05/06/2025 suçunda onda bir şartı var', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-06-05' }));
  assert.equal(r.senaryolar.yok.asgari_kurum.uygulanir, true);
});

test('K05: Geçici 6 son gününde 3 yıllık DS penceresi', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2020-03-30' }));
  assert.equal(r.ds_penceresi.yil, 3);
  assert.equal(r.ds_penceresi.kural, 'R050');
});

test('K06: 31/03/2020 suçu geçici 6/1 dışında', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2020-03-31' }));
  assert.equal(r.ds_penceresi.yil, 1);
  assert.ok(r.ds_penceresi.elenen.some((e) => e.yol.startsWith('Geçici 6/1')));
});

test('K07: Geçici 10/6 son suç gününde tarih koşulu sağlanır, nihai uygunluk diğer şartlara bağlı', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2023-07-31', hukumdeki_sonuc_ceza: { yil: 10, ay: 0, gun: 0 } }));
  const s = r.senaryolar.yok;
  assert.ok(!s.elenen_yollar.some((e) => e.yol === 'Geçici 10/6' && /31\/07\/2023 sonrası/.test(e.neden)));
  const yol = s.alternatif_yollar.find((y) => y.yol === 'Geçici 10/6');
  assert.ok(yol);
  assert.equal(yol.durum, 'hukuki_inceleme_gerekli');
});

test('K08: 01/08/2023 suçunda geçici 10/6 tarih koşulu yok', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2023-08-01', hukumdeki_sonuc_ceza: { yil: 10, ay: 0, gun: 0 } }));
  assert.ok(r.senaryolar.yok.elenen_yollar.some((e) => e.yol === 'Geçici 10/6' && /31\/07\/2023 sonrası/.test(e.neden)));
  assert.equal(r.senaryolar.yok.alternatif_yollar.length, 0);
});

test('K09: 6545 öncesi TCK 188 için 2/3', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2014-06-27', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }));
  assert.equal(r.temel_oran.oran.toString(), '2/3');
  assert.equal(r.temel_oran.kural_id, 'R026');
});

test('K10: 6545 sınır gününde TCK 188 için 3/4', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2014-06-28', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }));
  assert.equal(r.temel_oran.oran.toString(), '3/4');
  assert.equal(r.temel_oran.kural_id, 'R022');
});

test('K11: TCK 188 çocukta 2/3; yetişkin 108/9 uygulanmaz', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }, { dogum_tarihi: '2008-01-01' }));
  assert.equal(r.temel_oran.oran.toString(), '2/3');
  assert.equal(r.temel_oran.kural_id, 'R025');
  assert.ok(!r.temel_oran.adaylar.some((a) => a.kural === 'R022'));
});

test('K12: Özel hayat suçunda (TCK 134) 2/3', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', kanun_madde_fikra_bent: { kanun: 5237, madde: '134' } }));
  assert.equal(r.temel_oran.oran.toString(), '2/3');
  assert.equal(r.temel_oran.kural_id, 'R021');
});

test('K13: Yeni suçtan sonra kesinleşen hüküm tekerrüre esas değildir', () => {
  const d = oncekiMahkumiyetDegerlendir(kt, onceki({ kesinlesme_tarihi: '2025-08-01', infaz_durumu: 'baslamadi' }), yeni());
  assert.equal(d.sonuc, 'esas_degil');
});

test('K14: Önceki cezanın çekilmemiş olması tek başına eleme nedeni değildir', () => {
  const d = oncekiMahkumiyetDegerlendir(kt, onceki({ kesinlesme_tarihi: '2025-01-01', infaz_durumu: 'baslamadi', infaz_tamamlanma_tarihi: null }), yeni());
  assert.equal(d.sonuc, 'esas');
});

test('K15: 5 yıl önceki ceza → infazdan sonra 3 yıllık tekerrür süresi', () => {
  const o = onceki({ ceza: { yil: 5, ay: 0, gun: 0 }, infaz_tamamlanma_tarihi: '2020-01-01' });
  assert.equal(oncekiMahkumiyetDegerlendir(kt, o, yeni({ suc_tarihi: '2022-12-31' })).sonuc, 'esas');
  const d = oncekiMahkumiyetDegerlendir(kt, o, yeni({ suc_tarihi: '2023-01-02' }));
  assert.equal(d.sonuc, 'esas_degil');
  assert.ok(d.nedenler.some((n) => /\(3 yıl\)/.test(n.metin)));
});

test('K16: 5 yıl 1 gün önceki ceza → 5 yıllık tekerrür süresi', () => {
  const o = onceki({ ceza: { yil: 5, ay: 0, gun: 1 }, infaz_tamamlanma_tarihi: '2020-01-01' });
  const d = oncekiMahkumiyetDegerlendir(kt, o, yeni({ suc_tarihi: '2024-06-01' }));
  assert.equal(d.sonuc, 'esas');
  assert.ok(d.nedenler.some((n) => /5 yıllık/.test(n.metin)));
});

test('K17: 17 yaşında işlenen önceki suç tekerrüre esas değildir', () => {
  const d = oncekiMahkumiyetDegerlendir(kt, onceki({ suc_tarihi: '2007-06-01' }), yeni());
  assert.equal(d.sonuc, 'esas_degil');
  assert.ok(d.nedenler.some((n) => n.kural_id === 'R013' && n.etki === 'eler'));
});

test('K18: Kasıtlı ile taksirli suç arasında tekerrür yok', () => {
  const d = oncekiMahkumiyetDegerlendir(kt, onceki({ kast_turu: 'kasit' }), yeni({ kast_turu: 'taksir' }));
  assert.equal(d.sonuc, 'esas_degil');
});

test('K19: Üç ilam otomatik ikinci tekerrür değildir', () => {
  const v = vaka({ suc_tarihi: '2025-07-01' }, {
    onceki_mahkumiyet_kayitlari_tam_mi: true,
    onceki_mahkumiyetler: [1, 2, 3].map((i) => onceki({ ilam_id: `O${i}`, tekerrur_uygulanmis_mi: null })),
  });
  const t = tekerrurTespit(kt, v);
  assert.notEqual(t.belgelerden_aday_tespit, 'ikinci');
  const r = hesapla(db, v);
  assert.equal(r.durum, 'eksik_veri');
});

test('K20: İlk tekerrürde 108/2 ek süre üst sınırı', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 0, ay: 0, gun: 600 } }, { tekerrure_esas_en_agir_ceza: { yil: 0, ay: 0, gun: 30 } }));
  assert.equal(r.senaryolar.yok.ks_ham_gun.toString(), '300');
  const s = r.senaryolar.birinci;
  assert.ok(s.izler.some((i) => /400/.test(i.aciklama)));
  assert.equal(s.ks_ham_gun.toString(), '330');
  assert.equal(r.kurumda_kalacak_sure_gun, null);
});

test('K21: İkinci tekerrürde 108/2 uygulanmaz', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 0, ay: 0, gun: 600 } }, { tekerrure_esas_en_agir_ceza: { yil: 0, ay: 0, gun: 30 } }));
  assert.equal(r.senaryolar.ikinci.ks_ham_gun.toString(), '450');
  assert.notEqual(r.senaryolar.ikinci.ks_ham_gun.toString(), '330');
});

test('K22: Adli paradan çevrilen hapiste olağan 105/A ve genel KS oranı yok', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', para_cezasindan_cevrilme: true }));
  const s = r.senaryolar.yok;
  assert.equal(s.oran, null);
  assert.equal(s.takvim.DSye_hak_kazanma, null);
  assert.equal(s.takvim.kosullu_saliverilme, null);
});

test('K23: TCK 188 için istisna listeleri farklıdır', () => {
  const ilam = { kanun_madde_fikra_bent: { kanun: 5237, madde: '188' }, orgut_faaliyeti: false, teror_kanunu_kapsami: false };
  assert.equal(katalogEslesir(kt.katalog('gecici_6_1_uc_yil_ds_istisnalari'), ilam).sonuc, true);
  assert.equal(katalogEslesir(kt.katalog('gecici_10_6_guncel_istisnalar'), ilam).sonuc, false);
  const r = hesapla(db, vaka({ suc_tarihi: '2020-01-01', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }));
  assert.ok(r.ds_penceresi.elenen.some((e) => e.yol.startsWith('Geçici 6/1')));
});

test('K24: TCK 105 bütün cinsel suçlarla eşitlenmez', () => {
  const ilam = { kanun_madde_fikra_bent: { kanun: 5237, madde: '105' }, orgut_faaliyeti: false, teror_kanunu_kapsami: false };
  assert.equal(katalogEslesir(kt.katalog('gecici_10_6_guncel_istisnalar'), ilam).sonuc, false);
  const r = hesapla(db, vaka({ suc_tarihi: '2023-01-01', kanun_madde_fikra_bent: { kanun: 5237, madde: '105' } }));
  assert.equal(r.temel_oran.oran.toString(), '2/3');
});

test('K25: Güncel 10/6 TCK 82/1-e öldürmeyi dışlar; önceki rejim hukuki inceleme', () => {
  const ilam = { kanun_madde_fikra_bent: { kanun: 5237, madde: '82', fikra: '1', bent: 'e' }, orgut_faaliyeti: false, teror_kanunu_kapsami: false };
  assert.equal(katalogEslesir(kt.katalog('gecici_10_6_guncel_istisnalar'), ilam).sonuc, true);
  const r = hesapla(db, vaka({ suc_tarihi: '2023-01-01', hukumdeki_sonuc_ceza: { yil: 20, ay: 0, gun: 0 }, kanun_madde_fikra_bent: ilam.kanun_madde_fikra_bent }));
  assert.ok(r.senaryolar.yok.notlar.some((n) => n.kod === 'R058' && n.seviye === 'inceleme'));
});

test('K26: Normal DS daha erkense geçici 10/6 için 3 ay açıkta bekletilmez', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2023-01-01', hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 } }));
  const s = r.senaryolar.yok;
  assert.equal(s.kurumda_kalis_gun, 0);
  assert.ok(s.elenen_yollar.some((e) => e.yol === 'Geçici 10/6' && e.kural === 'R056'));
});

test('K27: İkinci tekerrürde salt oran/onda birden 27 gün kesin tahliye üretilmez', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', hukumdeki_tekerrur: 'ikinci' }));
  assert.equal(r.durum, 'hukuki_inceleme_gerekli');
  assert.equal(r.kurumda_kalacak_sure_gun, null);
  assert.equal(r.senaryolar.ikinci.acik_kurum.dogrudan, false);
  assert.ok(r.engelleyici_konu_idleri.includes('Q01'));
});

test('K28: 7593 tekerrür yaşını 15e indirmedi; 16 yaşındaki önceki fiil esas alınmaz', () => {
  assert.equal(kt.p('R013')['7593_tck_58i_degistirdi'], false);
  const d = oncekiMahkumiyetDegerlendir(kt, onceki({ suc_tarihi: '2006-06-01' }), yeni());
  assert.equal(d.sonuc, 'esas_degil');
});

test('K29: Geçici 6/4 gün çarpanları (10 gün×3 + 10 gün×2 = 50)', () => {
  const ctx = { cocuk: true, dogum: '2006-01-01', suc: '2020-03-30', hesapTarihi: HESAP, ilam: {} };
  const g = gunAgirligiBelirle(kt, ctx);
  assert.equal(g.kural, 'R052');
  assert.equal(agirlikliGunToplami([{ yas: 14, gun: 10 }, { yas: 16, gun: 10 }], g.agirlik), 50);
  // Bihakkın tahliyeye aktarılmaz: ağırlık yalnız koşullu salıverilmeye uygulanır.
  assert.equal(kt.p('R052').uygulama, 'yalniz_kosullu_saliverilme_suresi');
});

test('K30: 7595 tetikleyicisi belirsizken otomatik erteleme yok', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2025-07-01', teror_kanunu_kapsami: true, hukumdeki_tekerrur: 'yok' }));
  assert.ok(r.ozel_infaz_notlari.some((n) => n.kural === 'R075'));
  assert.equal(r.durum, 'hukuki_inceleme_gerekli');
});

test('K31: 1 yıl ile 12 ay aynı girdiye ezilmez', () => {
  const a = hesapla(db, vaka({ suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 } }));
  const b = hesapla(db, vaka({ suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 0, ay: 12, gun: 0 } }));
  assert.equal(a.senaryolar.yok.takvim.toplam_ceza_gun, 365);
  assert.equal(b.senaryolar.yok.takvim.toplam_ceza_gun, 360);
});

test('K32: Karma tarihli toplamada geçici 6 ve onda bir bütün toplama uygulanmaz', () => {
  const t = toplamaDegerlendir(kt, [{ suc_tarihi: '2020-03-30' }, { suc_tarihi: '2025-06-05' }]);
  assert.equal(t.durum, 'hukuki_inceleme_gerekli');
  assert.equal(t.tum_toplama_gecici6_uygula, false);
  assert.equal(t.tum_toplama_onda_bir_uygula, false);
  assert.ok(t.hata_kodlari.includes('E007'));
});

test('K33: İyi hâl kararı yokken iyi hâl otomatik kabul edilmez', () => {
  const r = hesapla(db, vaka({ suc_tarihi: '2024-01-01', hukumdeki_tekerrur: 'yok' }));
  assert.ok(IZINLI.includes(r.durum));
  assert.ok(r.hukuki_kabuller.some((m) => /İyi hâl kararı varsayıldı/.test(m)));
  assert.ok(r.hata_kodlari.includes('E008'));
  assert.equal('kesin_tahliye' in r, false);
});

test('K34: Kesin hükümdeki ceza yazılımca değiştirilmez', () => {
  const v = vaka({ suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 2, ay: 3, gun: 4 } });
  const once = JSON.stringify(v);
  const r = hesapla(db, v);
  assert.equal(JSON.stringify(v), once);
  assert.ok(r.secilen_kural_idleri.includes('R006'));
});

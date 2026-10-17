import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hesapla, KuralTabani, tekerrurTespit, Kesir, tarih } from '../extension/engine/index.js';

const db = JSON.parse(fs.readFileSync(new URL('../extension/data/kural_tabani.json', import.meta.url), 'utf8'));
const kt = new KuralTabani(db);
const IZINLI = db.hesap_politikasi.bu_paket_ile_izin_verilen_sonuc;

test('Kesir: sadeleştirme, karşılaştırma ve yuvarlama', () => {
  const x = new Kesir(365, 2);
  assert.equal(x.toString(), '365/2');
  assert.equal(x.ondalik(), '182,5');
  assert.equal(new Kesir(730, 3).ondalik(), '243,333…');
  assert.equal(x.carp(new Kesir(1, 10)).asagi(), 18);
  assert.equal(x.carp(new Kesir(1, 10)).yukari(), 19);
  assert.equal(Kesir.max(new Kesir(1, 2), new Kesir(2, 3)).toString(), '2/3');
  assert.equal(new Kesir(4, 8).esit(new Kesir(1, 2)), true);
});

test('Takvim: yıl resmî takvim, ay 30 gün; artık gün', () => {
  assert.equal(tarih.cezaEkle('2025-01-01', { yil: 1, ay: 0, gun: 0 }), '2026-01-01');
  assert.equal(tarih.cezaEkle('2024-01-01', { yil: 1, ay: 0, gun: 0 }), '2025-01-01');
  assert.equal(tarih.gunFarki('2024-01-01', '2025-01-01'), 366);
  assert.equal(tarih.cezaEkle('2025-01-31', { yil: 0, ay: 1, gun: 0 }), '2025-03-02');
  assert.equal(tarih.yilEkle('2024-02-29', 1), '2025-02-28');
  assert.equal(tarih.subat29Kirpilir('2024-02-29', 1), true);
  assert.equal(tarih.yilEkle('2024-02-29', 4), '2028-02-29');
  assert.equal(tarih.yasHesapla('2008-07-02', '2026-07-01'), 17);
  assert.equal(tarih.yasHesapla('2008-07-01', '2026-07-01'), 18);
  assert.equal(tarih.gecerliTarih('2025-02-30'), false);
});

test('Görseldeki 18/24/27 iddiası: aynı sayılar yalnız varsayımlarla çıkar ve kesin değildir', () => {
  const r = hesapla(db, {
    hesap_tarihi: '2026-10-17',
    ilam: { suc_tarihi: '2025-06-05', hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 } },
  });
  assert.equal(r.senaryolar.yok.kurumda_kalis_gun, 18);
  assert.equal(r.senaryolar.birinci.kurumda_kalis_gun, 24);
  assert.equal(r.senaryolar.birinci.en_cok, true); // 108/2 üst sınırı bilinmiyor
  assert.equal(r.senaryolar.ikinci.kurumda_kalis_gun, 27);
  assert.equal(r.senaryolar.ikinci.durum, 'hukuki_inceleme_gerekli');
  assert.equal(r.senaryolar.ikinci.alt_sinir, true); // açık kurum şartı doğrulanmadı
  assert.equal(db.gorseldeki_iddia_incelemesi.kesin_18_24_27_dogrulandi, false);
});

test('04/06/2025 öncesi 1 yıllık cezada asgari süre yok; DS hemen', () => {
  const r = hesapla(db, { hesap_tarihi: '2026-10-17', infaza_baslama_tarihi: '2026-01-01', mahsup_gun: 0, ilam: { suc_tarihi: '2024-05-01', hukumdeki_sonuc_ceza: { yil: 1 }, hukumdeki_tekerrur: 'yok' } });
  assert.equal(r.senaryolar.yok.kurumda_kalis_gun, 0);
  assert.equal(r.senaryolar.yok.takvim.kosullu_saliverilme, '2026-07-02');
});

test('Uzun cezada DS penceresi ve mahsup', () => {
  const r = hesapla(db, {
    hesap_tarihi: '2026-10-17',
    infaza_baslama_tarihi: '2025-01-01',
    mahsup_gun: 100,
    dogum_tarihi: '1985-05-05',
    ilam: { suc_tarihi: '2024-03-01', hukumdeki_sonuc_ceza: { yil: 6 }, kast_turu: 'kasit', teror_kanunu_kapsami: false, orgut_faaliyeti: false, kanun_madde_fikra_bent: { kanun: 5237, madde: '148' }, hukumdeki_tekerrur: 'yok' },
  });
  const s = r.senaryolar.yok;
  // Etkin başlangıç = 2025-01-01 - 100 gün = 2024-09-23; 6 yıl = 2191 gün; 1/2 = 1095,5 → 1095
  assert.equal(s.takvim.etkin_baslangic, '2024-09-23');
  assert.equal(s.takvim.toplam_ceza_gun, 2191);
  assert.equal(s.ks_gun, 1095);
  assert.equal(s.takvim.kosullu_saliverilme, '2027-09-23');
  assert.equal(s.takvim.DSye_hak_kazanma, '2026-09-23');
  // 6 yıl > 3 yıl: doğrudan açık yok → Q01 ile alt sınır
  assert.equal(s.acik_kurum.dogrudan, false);
  assert.equal(s.alt_sinir, true);
  assert.equal(s.durum, 'hukuki_inceleme_gerekli');
});

test('Birinci tekerrürde önceki mahkûmiyetten 108/2 üst sınırı otomatik alınır', () => {
  const r = hesapla(db, {
    hesap_tarihi: '2026-10-17',
    infaza_baslama_tarihi: '2026-01-01',
    mahsup_gun: 0,
    dogum_tarihi: '1990-01-01',
    onceki_mahkumiyet_kayitlari_tam_mi: true,
    onceki_mahkumiyetler: [{ ilam_id: 'A', suc_tarihi: '2020-01-01', kesinlesme_tarihi: '2021-01-01', kast_turu: 'kasit', ceza_turu: 'sureli_hapis', ceza: { ay: 2 }, infaz_durumu: 'tamamlandi', infaz_tamamlanma_tarihi: '2023-01-01', tekerrur_uygulanmis_mi: false, karar_turu: 'mahkumiyet', tekerrure_esas_olamaz: false }],
    ilam: { suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 2 }, kast_turu: 'kasit', hukumdeki_tekerrur: 'birinci' },
  });
  assert.equal(r.tekerrur.belgelerden_aday_tespit, 'birinci');
  assert.equal(r.tekerrur.uyusuyor_mu, true);
  assert.equal(r.secili_senaryo, 'birinci');
  const s = r.senaryolar.birinci;
  // 730 gün × 2/3 = 486,67; üst sınır 365 + 60 = 425
  assert.equal(s.ks_ham_gun.toString(), '425');
  assert.equal(s.en_cok, false);
});

test('Hükümdeki tekerrür ile belgelerden aday uyuşmazsa E004', () => {
  const r = hesapla(db, {
    hesap_tarihi: '2026-10-17',
    dogum_tarihi: '1990-01-01',
    onceki_mahkumiyet_kayitlari_tam_mi: true,
    onceki_mahkumiyetler: [],
    ilam: { suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 1 }, kast_turu: 'kasit', hukumdeki_tekerrur: 'birinci' },
  });
  assert.equal(r.tekerrur.belgelerden_aday_tespit, 'yok');
  assert.equal(r.tekerrur.uyusuyor_mu, false);
  assert.ok(r.hata_kodlari.includes('E004'));
  assert.equal(r.durum, 'hukuki_inceleme_gerekli');
});

test('İkinci tekerrür adayı: tekerrür uygulanmış önceki ilam', () => {
  const t = tekerrurTespit(kt, {
    dogum_tarihi: '1990-01-01',
    onceki_mahkumiyetler: [{ suc_tarihi: '2018-01-01', kesinlesme_tarihi: '2019-01-01', kast_turu: 'kasit', ceza_turu: 'sureli_hapis', ceza: { yil: 1 }, infaz_durumu: 'tamamlandi', infaz_tamamlanma_tarihi: '2024-01-01', tekerrur_uygulanmis_mi: true }],
    ilam: { suc_tarihi: '2025-07-01', kast_turu: 'kasit' },
  });
  assert.equal(t.belgelerden_aday_tespit, 'ikinci');
});

test('18 yaş altı yeni suçta tekerrür senaryoları uygulanamaz', () => {
  const r = hesapla(db, { hesap_tarihi: '2026-10-17', dogum_tarihi: '2009-01-01', ilam: { suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 1 } } });
  assert.equal(r.senaryolar.birinci.durum, 'uygulanamaz');
  assert.equal(r.senaryolar.ikinci.durum, 'uygulanamaz');
  assert.equal(r.tekerrur.belgelerden_aday_tespit, 'uygulanmaz');
  assert.equal(r.secili_senaryo, 'yok');
});

test('Terör kapsamında yetişkin süreli hapis 3/4', () => {
  const r = hesapla(db, { hesap_tarihi: '2026-10-17', dogum_tarihi: '1990-01-01', ilam: { suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 5 }, teror_kanunu_kapsami: true } });
  assert.equal(r.temel_oran.oran.toString(), '3/4');
  assert.equal(r.senaryolar.birinci.oran.toString(), '3/4');
});

test('Müebbet: genel 24 yıl, birinci tekerrürde 33 yıl', () => {
  const r = hesapla(db, { hesap_tarihi: '2026-10-17', infaza_baslama_tarihi: '2020-01-01', mahsup_gun: 0, dogum_tarihi: '1980-01-01', ilam: { suc_tarihi: '2019-01-01', ceza_turu: 'muebbet', orgut_faaliyeti: false, orgut_kurma_yonetme: false, teror_kanunu_kapsami: false } });
  assert.equal(r.senaryolar.yok.takvim.kosullu_saliverilme, '2044-01-01');
  assert.equal(r.senaryolar.birinci.takvim.kosullu_saliverilme, '2053-01-01');
  assert.equal(r.senaryolar.yok.durum, 'hukuki_inceleme_gerekli');
});

test('Geçici 6/2: 70 yaşını bitirmiş hükümlüde 4 yıllık pencere', () => {
  const r = hesapla(db, { hesap_tarihi: '2026-10-17', dogum_tarihi: '1950-01-01', ilam: { suc_tarihi: '2019-01-01', hukumdeki_sonuc_ceza: { yil: 10 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '157' }, teror_kanunu_kapsami: false, orgut_faaliyeti: false } });
  assert.equal(r.ds_penceresi.yil, 4);
  assert.equal(r.ds_penceresi.kural, 'R051');
});

test('Çocukta 2026 sürümü gün ağırlığı KS tarihini öne çeker', () => {
  const v = (dogum) => ({ hesap_tarihi: '2026-10-17', infaza_baslama_tarihi: '2026-09-01', mahsup_gun: 0, dogum_tarihi: dogum, ilam: { suc_tarihi: '2026-08-20', hukumdeki_sonuc_ceza: { yil: 2 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '148' }, teror_kanunu_kapsami: false, orgut_faaliyeti: false } });
  const kucuk = hesapla(db, v('2013-01-01')); // 13 yaş: her gün 2
  const s = kucuk.senaryolar.yok;
  assert.ok(s.izler.some((i) => i.adim === 'Çocukta gün ağırlığı'));
  // 730 × 1/2 = 365 ağırlıklı gün → 183 takvim günü
  assert.equal(tarih.gunFarki(s.takvim.etkin_baslangic, s.takvim.kosullu_saliverilme), 183);
});

test('Politika: motor yalnız izin verilen durumları üretir', () => {
  const tarihler = ['2004-12-31', '2014-06-27', '2020-03-30', '2023-07-31', '2025-06-04', '2026-09-01'];
  const maddeler = [null, '81', '102', '141', '188', '220', '314'];
  const cezalar = [{ gun: 10 }, { ay: 8 }, { yil: 2, ay: 6 }, { yil: 12 }];
  const turler = ['yok', 'birinci', 'ikinci', null];
  for (const suc of tarihler)
    for (const madde of maddeler)
      for (const ceza of cezalar)
        for (const t of turler) {
          const r = hesapla(db, { hesap_tarihi: '2026-10-17', ilam: { suc_tarihi: suc, hukumdeki_sonuc_ceza: ceza, kanun_madde_fikra_bent: { kanun: 5237, madde }, hukumdeki_tekerrur: t } });
          assert.ok(IZINLI.includes(r.durum), `${suc} ${madde} ${JSON.stringify(ceza)} ${t}: ${r.durum}`);
          for (const s of Object.values(r.senaryolar)) {
            assert.ok([...IZINLI, 'uygulanamaz'].includes(s.durum));
            if (s.kurumda_kalis_gun !== null) assert.ok(s.kurumda_kalis_gun >= 0);
          }
        }
});

test('Eksik suç tarihi veya ceza → eksik_veri', () => {
  assert.equal(hesapla(db, { ilam: { hukumdeki_sonuc_ceza: { yil: 1 } } }).durum, 'eksik_veri');
  assert.equal(hesapla(db, { ilam: { suc_tarihi: '2025-01-01' } }).durum, 'eksik_veri');
  assert.equal(hesapla(db, { ilam: { suc_tarihi: '2025-01-01', hukumdeki_sonuc_ceza: { yil: 0, ay: 0, gun: 0 } } }).durum, 'eksik_veri');
});

// Sayısal hesap ve dal davranışı testleri.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hesapla, Kesir, takvim as T, sikayetSuresi, ozetMetni } from '../extension/cekirdek/index.js';
import { kt, IZINLI, HESAP, vaka, onceki, senaryo } from './yardimci.js';

test('Kesir: sadeleştirme, karşılaştırma, yuvarlama', () => {
  const x = new Kesir(365, 2);
  assert.equal(x.toString(), '365/2');
  assert.equal(x.ondalik(), '182,5');
  assert.equal(new Kesir(730, 3).ondalik(), '243,333…');
  assert.equal(x.carp(new Kesir(1, 10)).asagi(), 18);
  assert.equal(x.carp(new Kesir(1, 10)).yukari(), 19);
  assert.equal(Kesir.max(new Kesir(1, 2), new Kesir(2, 3)).toString(), '2/3');
});

test('Takvim: yıl resmî takvim, ay 30 gün, artık gün, takvim ayı ve hafta sonu', () => {
  assert.equal(T.cezaEkle('2025-01-01', { yil: 1 }), '2026-01-01');
  assert.equal(T.gunFarki('2024-01-01', '2025-01-01'), 366);
  assert.equal(T.cezaEkle('2025-01-31', { ay: 1 }), '2025-03-02');
  assert.equal(T.takvimAyiEkle('2025-01-31', 1), '2025-02-28');
  assert.equal(T.yilEkle('2024-02-29', 1), '2025-02-28');
  assert.equal(T.yasHesapla('2008-07-02', '2026-07-01'), 17);
  assert.equal(T.haftaSonuSonrasi('2026-10-18'), '2026-10-19');
});

test('Görseldeki 18/24/27 iddiası: 2. tekerrürde açık kuruma ayrılma süresiyle 30 gün', () => {
  const c = hesapla(kt, { hesap_tarihi: HESAP, suclar_ve_ilamlar: [{ suc_tarihi: '2025-06-05', hukumdeki_sonuc_ceza: { yil: 1 } }] });
  const [a, b, d] = ['yok', 'birinci', 'ikinci'].map((k) => senaryo(c, k));
  assert.equal(a.kurumda_kalis_gun, 18);
  assert.equal(b.kurumda_kalis_gun, 24);
  assert.equal(b.en_cok, true); // 108/2 üst sınırı bilinmiyor
  assert.equal(d.asgari_kurum.gun, 27);
  assert.equal(d.kurumda_kalis_gun, 30); // Yönetmelik m.6/1-a: kurumda 1 ay
  assert.equal(d.durum, 'hukuki_inceleme_gerekli');
  assert.equal(a.durum, 'varsayimli_senaryo');
});

test('04/06/2025 öncesi 1 yıllık cezada asgari süre yok; doğrudan açık, DS hemen', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2024-05-01', hukumdeki_tekerrur: 'yok' })));
  assert.equal(S.kurumda_kalis_gun, 0);
  assert.equal(S.acik_kurum.yol, 'dogrudan');
  assert.equal(S.takvim.kosullu_saliverilme, '2026-07-02');
});

test('6 yıl yağma, 100 gün tutukluluk: kapalıdan açığa 1 ay, DS KS\'den 1 yıl önce', () => {
  const c = hesapla(kt, vaka({ suc_tarihi: '2024-03-01', hukumdeki_sonuc_ceza: { yil: 6 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '148' }, hukumdeki_tekerrur: 'yok' }, { infaza_baslama_tarihi: '2025-01-01', mahsup_kayitlari: [{ tur: 'tutukluluk', gun: 100 }] }));
  const S = senaryo(c);
  assert.equal(S.takvim.etkin_baslangic, '2024-09-23');
  assert.equal(S.takvim.toplam_ceza_gun, 2191);
  assert.equal(S.ks_gun, 1095);
  assert.equal(S.takvim.kosullu_saliverilme, '2027-09-23');
  assert.equal(S.takvim.DSye_hak_kazanma, '2026-09-23');
  assert.equal(S.acik_kurum.yol, 'kapalidan');
  assert.ok(S.acik_kurum.kapali.kalemler.some((k) => k.dugum_id === 'D035')); // TCK 148: KS'ye 5 yıldan az
  assert.equal(S.kurumda_kalis_gun, 630);
  assert.equal(c.durum, 'varsayimli_senaryo');
  assert.equal(c.kurumda_kalacak_sure_gun, 630);
  assert.ok(S.gerekli_kararlar.some((k) => /açık kuruma ayırma/.test(k.metin)));
});

test('Konutu terk etmeme adli kontrolü 2 gün = 1 gün mahsup edilir (CMK 109/6)', () => {
  const v = (gun, profil) => vaka({ hukumdeki_tekerrur: 'yok' }, { mahsup_kayitlari: [{ tur: 'konutu_terk_etmeme', gun: 31 }, { tur: 'gozalti', gun: 2 }], profil });
  assert.equal(senaryo(hesapla(kt, v())).takvim.mahsup_gun, 17); // 15,5 + 2 = 17,5 → 17
  assert.equal(senaryo(hesapla(kt, v(0, { gun_kusurati: 'yukari' }))).takvim.mahsup_gun, 18);
});

test('Hesap profili: yukarı yuvarlama ve takvim ayı seçenekleri sonucu değiştirir ve kimliğe yansır', () => {
  const temel = hesapla(kt, vaka());
  const yukari = hesapla(kt, vaka({}, { profil: { gun_kusurati: 'yukari' } }));
  assert.equal(senaryo(temel).asgari_kurum.gun, 18);
  assert.equal(senaryo(yukari).asgari_kurum.gun, 19);
  assert.notEqual(temel.hesap_profili_id, yukari.hesap_profili_id);
  const ay = hesapla(kt, vaka({ suc_tarihi: '2025-01-01' }, { infaza_baslama_tarihi: '2026-01-31', profil: { kurum_ayi: 'takvim_ayi' } }));
  assert.equal(senaryo(ay, 'ikinci').acik_kurum.tarih, '2026-02-28');
});

test('Birinci tekerrürde 108/2 sınırı önceki mahkûmiyetten otomatik alınır', () => {
  const c = hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 2 }, hukumdeki_tekerrur: 'birinci' }, {
    onceki_mahkumiyet_kayitlari_tam_mi: true,
    onceki_mahkumiyetler: [onceki({ ceza: { ay: 2 }, suc_tarihi: '2020-01-01', kesinlesme_tarihi: '2021-01-01', infaz_tamamlanma_tarihi: '2023-01-01' })],
  }));
  assert.equal(c.tekerrur.belgelerden_aday_tespit, 'birinci');
  assert.equal(c.tekerrur.uyusuyor_mu, true);
  const S = senaryo(c, 'birinci');
  assert.equal(S.ks_ham_gun.toString(), '425'); // 730×2/3 = 486,67; sınır 365 + 60
  assert.equal(S.ust_sinir_108_2.uygulandi, true);
  assert.equal(S.en_cok, false);
});

test('Hükümdeki tekerrür belgelerden adayla uyuşmazsa E004 ve hukuki inceleme', () => {
  const c = hesapla(kt, vaka({ hukumdeki_tekerrur: 'birinci' }, { onceki_mahkumiyet_kayitlari_tam_mi: true, onceki_mahkumiyetler: [] }));
  assert.equal(c.tekerrur.belgelerden_aday_tespit, 'yok');
  assert.equal(c.tekerrur.uyusuyor_mu, false);
  assert.ok(c.hata_kodlari.includes('E004'));
  assert.equal(c.durum, 'hukuki_inceleme_gerekli');
});

test('Geçerli tekerrür uygulanmış önceki ilam ikinci tekerrür zinciri adayıdır', () => {
  const c = hesapla(kt, vaka({}, { onceki_mahkumiyetler: [onceki({ tekerrur_uygulanmis_mi: true })] }));
  assert.equal(c.tekerrur.belgelerden_aday_tespit, 'ikinci');
  assert.equal(c.secili_senaryo, 'ikinci');
});

test('18 yaş altı yeni suçta tekerrür senaryoları uygulanamaz', () => {
  const c = hesapla(kt, vaka({}, { dogum_tarihi: '2009-01-01' }));
  assert.equal(senaryo(c, 'birinci').durum, 'uygulanamaz');
  assert.equal(senaryo(c, 'ikinci').durum, 'uygulanamaz');
  assert.equal(c.secili_senaryo, 'yok');
});

test('Çocukta 107/5 (2026) gün ağırlığı KS tarihini öne çeker', () => {
  const c = hesapla(kt, vaka({ suc_tarihi: '2026-08-20', kesinlesme_tarihi: '2026-08-30', hukumdeki_sonuc_ceza: { yil: 2 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '148' } }, { infaza_baslama_tarihi: '2026-09-01', dogum_tarihi: '2013-01-01' }));
  const S = senaryo(c);
  assert.ok(S.izler.some((i) => i.adim === 'Çocukta gün ağırlığı'));
  assert.equal(T.gunFarki(S.takvim.etkin_baslangic, S.takvim.kosullu_saliverilme), 183); // 365 ağırlıklı gün
});

test('Terör kapsamında yetişkin: 3/4 oran ve açık kuruma ayrılma yasağı (Yönetmelik m.8/1-ç)', () => {
  const S = senaryo(hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 5 }, teror_kanunu_kapsami: true })));
  assert.equal(S.oran.toString(), '3/4');
  assert.equal(S.acik_kurum.yol, 'yasak');
  assert.equal(S.secilen_ds_yolu, null);
  assert.equal(S.takvim.kurumdan_cikis, S.takvim.kosullu_saliverilme);
  assert.equal(S.durum, 'hukuki_inceleme_gerekli');
});

test('Terör suçlusunun ağırlaştırılmış müebbeti: koşullu salıverilme yok (3713 m.17)', () => {
  const S = senaryo(hesapla(kt, vaka({ hukumdeki_ceza_turu: 'agirlastirilmis_muebbet', hukumdeki_sonuc_ceza: null, teror_kanunu_kapsami: true })));
  assert.equal(S.yol, 'ks_yasagi');
  assert.equal(S.hesaplanamadi, true);
});

test('Müebbet: genel 24 yıl, birinci ve ikinci tekerrürde 33 yıl (108/1, 108/3); DS için açık KS\'ye 5 yıl', () => {
  const c = hesapla(kt, vaka({ suc_tarihi: '2023-08-01', hukumdeki_ceza_turu: 'muebbet', hukumdeki_sonuc_ceza: null }, { infaza_baslama_tarihi: '2024-01-01' }));
  assert.equal(senaryo(c).takvim.kosullu_saliverilme, '2048-01-01');
  assert.equal(senaryo(c).acik_kurum.tarih, '2043-01-01');
  assert.equal(senaryo(c).takvim.DSye_hak_kazanma, '2047-01-01');
  assert.equal(senaryo(c, 'birinci').takvim.kosullu_saliverilme, '2057-01-01');
  assert.equal(senaryo(c, 'ikinci').takvim.kosullu_saliverilme, '2057-01-01');
  // 30/03/2020 öncesi suçta geçici 6/1 müebbette de 3 yıllık pencere verir (kapalıda da, m.6/3)
  const eski = senaryo(hesapla(kt, vaka({ suc_tarihi: '2019-01-01', hukumdeki_ceza_turu: 'muebbet', hukumdeki_sonuc_ceza: null }, { infaza_baslama_tarihi: '2020-01-01', hesap_tarihi: '2025-06-01' })));
  assert.equal(eski.secilen_ds_yolu, 'DS_gecici6_1');
  assert.equal(eski.takvim.DSye_hak_kazanma, '2041-01-01');
});

test('Geçici 10/6 müebbette: kapalıda 3 ay, normal açıktan 3 yıl önce açığa; normal DS\'den 3 yıl önce DS', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2021-01-01', hukumdeki_ceza_turu: 'muebbet', hukumdeki_sonuc_ceza: null }, { infaza_baslama_tarihi: '2022-01-01' })));
  assert.equal(S.takvim.kosullu_saliverilme, '2046-01-01');
  assert.equal(S.acik_kurum.kapali.normal_tarih, '2041-01-01');
  assert.equal(S.acik_kurum.tarih, '2038-01-01');
  assert.equal(S.secilen_ds_yolu, 'gecici10_6');
  assert.equal(S.takvim.DSye_hak_kazanma, '2042-01-01');
});

test('Geçici 10/6: 3 yıl 1 ay 15 gün hırsızlık (2023) → 1 ay kapalı, 3 ay açık, sonra DS', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-01-01', hukumdeki_sonuc_ceza: { yil: 3, ay: 1, gun: 15 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '142' } })));
  assert.equal(S.acik_kurum.tarih, '2026-01-31');
  assert.equal(S.secilen_ds_yolu, 'gecici10_6');
  assert.equal(S.takvim.kurumdan_cikis, '2026-05-01'); // 31.01 + 3 ay (90 gün)
  assert.equal(S.takvim.kosullu_saliverilme, '2027-07-25');
  assert.equal(S.kurumda_kalis_gun, 120);
  // Aynı dosya 01/08/2023 suçunda olağan yola döner
  const yeni = senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-08-01', hukumdeki_sonuc_ceza: { yil: 3, ay: 1, gun: 15 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '142' } })));
  assert.equal(yeni.secilen_ds_yolu, 'DS_105A_1');
  assert.equal(yeni.takvim.kurumdan_cikis, '2026-07-25');
});

test('Geçici 10/6 tarih bileşimi (kural tabanı GT01-GT05): yürürlükten önce tarih üretmez', () => {
  // GT04: normal DS 2027-01-01, açık 3 ay 2025-11-01 → 2025-12-25
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2022-01-01', hukumdeki_sonuc_ceza: { yil: 2 } }, { infaza_baslama_tarihi: '2025-08-01', hesap_tarihi: '2026-01-10' })));
  const y = S.ds_yollari.find((x) => x.id === 'gecici10_6');
  assert.equal(y.uygun, true);
  assert.ok(y.tarih >= '2025-12-25');
  // İstisna suç (TCK 102) geçici 10/6 dışında
  const istisna = senaryo(hesapla(kt, vaka({ suc_tarihi: '2022-01-01', hukumdeki_sonuc_ceza: { yil: 8 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '102', fikra: '1' } })));
  assert.equal(istisna.ds_yollari.find((x) => x.id === 'gecici10_6').uygun, false);
  assert.equal(istisna.acik_kurum.kapali.gecici10, null);
});

test('Ağırlaştırılmış müebbet (terör dışı): 30 yıl; açığa ayrılamaz, DS yolu yok', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2021-01-01', hukumdeki_ceza_turu: 'agirlastirilmis_muebbet', hukumdeki_sonuc_ceza: null }, { infaza_baslama_tarihi: '2022-01-01' })));
  assert.equal(S.takvim.kosullu_saliverilme, '2052-01-01');
  assert.equal(S.acik_kurum.yol, 'yasak');
  assert.equal(S.secilen_ds_yolu, null);
  assert.equal(S.takvim.kurumdan_cikis, '2052-01-01');
});

test('Geçici 6/1 kapalı kurumda da uygulanır: DS = KS − 3 yıl', () => {
  // Hesap tarihi güncel geçici 10/6 yürürlüğünden (25/12/2025) önce: 10/6 devreye girmez.
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2019-06-01', hukumdeki_sonuc_ceza: { yil: 8 }, hukumdeki_tekerrur: 'yok' }, { hesap_tarihi: '2025-06-01' })));
  assert.equal(S.secilen_ds_yolu, 'DS_gecici6_1');
  assert.equal(S.takvim.DSye_hak_kazanma, T.yilEkle(S.takvim.kosullu_saliverilme, -3));
});

test('Geçici 6/2-a: 70 yaşını bitirmiş hükümlüde 4 yıllık pencere', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2019-01-01', hukumdeki_sonuc_ceza: { yil: 10 }, kanun_madde_fikra_bent: { kanun: 5237, madde: '157' } }, { dogum_tarihi: '1950-01-01', hesap_tarihi: '2025-06-01' })));
  assert.equal(S.ds_yollari.find((y) => y.id === 'DS_gecici6_2a').uygun, true);
  assert.equal(S.secilen_ds_yolu, 'DS_gecici6_2a');
});

test('10 yıl ve üzeri cezada kapalıda toplam cezanın onda biri', () => {
  const S = senaryo(hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 12 } })));
  const k = S.acik_kurum.kapali.kalemler.find((x) => x.dugum_id === 'D033');
  assert.ok(k);
  assert.equal(k.tarih, T.gunEkle('2026-01-01', 438)); // 4383 gün / 10 = 438,3 → 438
});

test('Fıkrası bilinmeyen TCK 102: daha ağır 3/4 oranı ihtiyaten, sonuç "en çok"', () => {
  const belirsiz = senaryo(hesapla(kt, vaka({ kanun_madde_fikra_bent: { kanun: 5237, madde: '102' } })));
  assert.equal(belirsiz.oran.toString(), '3/4');
  assert.equal(belirsiz.en_cok, true);
  assert.ok(belirsiz.belirsiz_kosullar.includes('ilam.fikra'));
  const bir = senaryo(hesapla(kt, vaka({ kanun_madde_fikra_bent: { kanun: 5237, madde: '102', fikra: '1' } })));
  assert.equal(bir.oran.toString(), '2/3');
  assert.equal(bir.en_cok, false);
});

test('Adli paradan çevrilen hapiste tek hükümde 3 yıl üst sınırı (5275 m.106/7)', () => {
  const S = senaryo(hesapla(kt, vaka({ para_cezasindan_cevrilme: true, hukumdeki_sonuc_ceza: { yil: 4 } })));
  assert.equal(S.takvim.kurumdan_cikis, '2029-01-01');
});

test('Doğrulanmış özel KS yasağı ve geri alma dalları', () => {
  assert.equal(senaryo(hesapla(kt, vaka({ ozel_ks_yasagi: true }))).yol, 'ks_yasagi');
  const g = senaryo(hesapla(kt, vaka({ ks_geri_alindi: true })));
  assert.equal(g.yol, 'geri_alma');
  assert.equal(g.takvim.kurumdan_cikis, g.takvim.hak_ederek_tahliye);
});

test('Hesap tarihi 04/06/2025 öncesiyse ikinci tekerrürde tarihsel KS yasağı', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2024-01-01' }, { hesap_tarihi: '2025-05-01' })), 'ikinci');
  assert.ok(S.izler.some((i) => i.adim === 'İkinci tekerrür (eski 108/3)'));
});

test('Girdi tip hataları düzeltilmez; sorun kaydı ve eksik veri üretir', () => {
  const c = hesapla(kt, { hesap_tarihi: HESAP, suclar_ve_ilamlar: [{ suc_tarihi: '2025-13-01', hukumdeki_sonuc_ceza: { yil: '1' } }] });
  assert.equal(c.durum, 'eksik_veri');
  assert.equal(c.girdi_sorunlari.length, 2);
});

test('0.1 sürümü vaka biçimi geriye uyumlu okunur', () => {
  const c = hesapla(kt, { hesap_tarihi: HESAP, infaza_baslama_tarihi: '2026-01-01', mahsup_gun: 10, ilam: { suc_tarihi: '2025-07-01', hukumdeki_sonuc_ceza: { yil: 1 }, hukumdeki_tekerrur: 'yok' } });
  assert.equal(senaryo(c).takvim.mahsup_gun, 10);
});

test('Şikâyet süresi: öğrenmeden 15 gün, işlemden her hâlde 30 gün', () => {
  assert.equal(sikayetSuresi(kt, { ogrenme: '2026-10-10', islem: '2026-09-15' }).son_gun.tarih, '2026-10-15');
});

test('Belirlenimcilik: aynı girdi aynı çıktıyı üretir; çıktı paket ve profil kimliğini taşır', () => {
  const v = vaka({}, { onceki_mahkumiyetler: [onceki()] });
  const a = JSON.stringify(hesapla(kt, v));
  assert.equal(JSON.stringify(hesapla(kt, v)), a);
  const c = JSON.parse(a);
  assert.equal(c.veri_paketi_sha256, kt.sha256);
  assert.match(c.hesap_profili_id, /^A01-taslak/);
  assert.match(ozetMetni(hesapla(kt, v)), /Kural tabanı: 0\.4\.0/);
});

test('Politika: motor yalnız izin verilen durumları üretir; kurumda kalış negatif olmaz', () => {
  const tarihler = ['2004-12-31', '2014-06-27', '2020-03-30', '2023-07-31', '2025-06-04', '2026-09-01'];
  const maddeler = [null, '81', '102', '141', '188', '220', '314'];
  const cezalar = [{ gun: 10 }, { ay: 8 }, { yil: 2, ay: 6 }, { yil: 12 }];
  for (const suc of tarihler)
    for (const madde of maddeler)
      for (const ceza of cezalar)
        for (const t of ['yok', 'birinci', 'ikinci', null]) {
          const c = hesapla(kt, { hesap_tarihi: HESAP, suclar_ve_ilamlar: [{ suc_tarihi: suc, hukumdeki_sonuc_ceza: ceza, kanun_madde_fikra_bent: { kanun: 5237, madde }, hukumdeki_tekerrur: t }] });
          assert.ok(IZINLI.includes(c.durum), `${suc} ${madde} ${JSON.stringify(ceza)} ${t}: ${c.durum}`);
          for (const S of Object.values(c.senaryolar)) {
            assert.ok([...IZINLI, 'uygulanamaz'].includes(S.durum));
            if (S.kurumda_kalis_gun !== null) assert.ok(S.kurumda_kalis_gun >= 0);
            if (S.takvim?.kurumdan_cikis && S.takvim.kosullu_saliverilme) assert.ok(!T.sonra(S.takvim.kurumdan_cikis, S.takvim.kosullu_saliverilme));
          }
        }
});

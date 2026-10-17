// Kural tabanındaki 57 kabul senaryosu (K01-K57). Her test, senaryonun "beklenti"
// alanını motorun çıktısına eşler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hesapla,
  toplamaDegerlendir,
  acikEsikleri,
  gunAgirligiBelirle,
  agirlikliGunToplami,
  dsBasvuruSuresi,
  itirazSuresi,
  degerlendir,
} from '../extension/cekirdek/index.js';
import { Notlar } from '../extension/cekirdek/cikti/notlar.js';
import { KAYNAK, kt, IZINLI, HESAP, vaka, onceki, senaryo } from './yardimci.js';

const yol = (S, id) => S.ds_yollari.find((y) => y.id === id);
const tekerrurVaka = (oncekiler, ilam = {}, ek = {}) => vaka(ilam, { onceki_mahkumiyetler: oncekiler, onceki_mahkumiyet_kayitlari_tam_mi: true, ...ek });
const ilkDegerlendirme = (c) => c.tekerrur.degerlendirmeler[0];
const sec = (id, ilam) => degerlendir({ op: 'secici', secici_id: id }, { ilam }, { seciciler: kt.seciciler });

test('Kural tabanında 57 kabul senaryosu bulunur', () => {
  assert.equal(KAYNAK.kabul_senaryolari.length, 57);
});

test('K01: İki alanla kesin sonuç verilemez', () => {
  const c = hesapla(kt, { hesap_tarihi: HESAP, suclar_ve_ilamlar: [{ suc_tarihi: '2025-06-05', hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 } }] });
  assert.equal(c.durum, 'eksik_veri');
  assert.equal(c.tekerrur.belgelerden_aday_tespit, null);
  assert.equal(c.tekerrur.hukumde_uygulanan, null);
  assert.equal(c.kurumda_kalacak_sure_gun, null);
});

test('K02: 03/06/2025 suçunda onda bir şartı yok', () => {
  assert.equal(senaryo(hesapla(kt, vaka({ suc_tarihi: '2025-06-03' }))).asgari_kurum.uygulanir, false);
});

test('K03: 04/06/2025 sınır gününde onda bir şartı var', () => {
  assert.equal(senaryo(hesapla(kt, vaka({ suc_tarihi: '2025-06-04' }))).asgari_kurum.uygulanir, true);
});

test('K04: 05/06/2025 suçunda onda bir şartı var', () => {
  assert.equal(senaryo(hesapla(kt, vaka({ suc_tarihi: '2025-06-05' }))).asgari_kurum.uygulanir, true);
});

test('K05: Geçici 6 son gününde 3 yıllık DS penceresi', () => {
  const y = yol(senaryo(hesapla(kt, vaka({ suc_tarihi: '2020-03-30', hukumdeki_sonuc_ceza: { yil: 8 } }))), 'DS_gecici6_1');
  assert.equal(y.uygun, true);
  assert.equal(y.pencere_yil, 3);
});

test('K06: 31/03/2020 suçu geçici 6/1 dışında', () => {
  assert.equal(yol(senaryo(hesapla(kt, vaka({ suc_tarihi: '2020-03-31', hukumdeki_sonuc_ceza: { yil: 8 } }))), 'DS_gecici6_1').uygun, false);
});

test('K07: Geçici 10/6 son suç gününde tarih koşulu var; nihai uygunluk diğer şartlara bağlı', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-07-31', hukumdeki_sonuc_ceza: { yil: 10 } })));
  assert.equal(yol(S, 'gecici10_6').uygun, true);
  const alt = S.alternatif_yollar.find((y) => y.id === 'gecici10_6');
  assert.ok(alt);
  assert.equal(alt.durum, 'hukuki_inceleme_gerekli');
});

test('K08: 01/08/2023 suçunda geçici 10/6 tarih koşulu yok', () => {
  const y = yol(senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-08-01', hukumdeki_sonuc_ceza: { yil: 10 } }))), 'gecici10_6');
  assert.equal(y.uygun, false);
  assert.match(y.neden, /31\/07\/2023 sonrası/);
});

test('K09: 6545 öncesi TCK 188 için 2/3 (geçici 9/4)', () => {
  const t = senaryo(hesapla(kt, vaka({ suc_tarihi: '2014-06-27', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }))).temel_oran;
  assert.equal(t.oran.toString(), '2/3');
  assert.equal(t.dugum_id, 'D017');
});

test('K10: 6545 sınır gününde TCK 188 için 3/4', () => {
  const t = senaryo(hesapla(kt, vaka({ suc_tarihi: '2014-06-28', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }))).temel_oran;
  assert.equal(t.oran.toString(), '3/4');
  assert.equal(t.dugum_id, 'D010');
});

test('K11: TCK 188 çocukta 2/3; yetişkin 108/9 uygulanmaz', () => {
  const S = senaryo(hesapla(kt, vaka({ kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } }, { dogum_tarihi: '2008-01-01' })));
  assert.equal(S.temel_oran.oran.toString(), '2/3');
  assert.equal(S.temel_oran.dugum_id, 'D012');
  assert.equal(S.oran_adaylari.find((a) => a.dugum_id === 'D010').cozulen, false);
});

test('K12: Özel hayat suçunda (TCK 134) 2/3', () => {
  const t = senaryo(hesapla(kt, vaka({ kanun_madde_fikra_bent: { kanun: 5237, madde: '134' } }))).temel_oran;
  assert.equal(t.oran.toString(), '2/3');
  assert.equal(t.dugum_id, 'D011');
});

test('K13: Yeni suçtan sonra kesinleşen hüküm tekerrüre esas değildir', () => {
  const d = ilkDegerlendirme(hesapla(kt, tekerrurVaka([onceki({ kesinlesme_tarihi: '2025-08-01', infaz_durumu: 'baslamadi' })])));
  assert.equal(d.sonuc, 'esas_degil');
  assert.equal(d.kosullar.find((k) => k.dugum_id === 'D100').deger, false);
});

test('K14: Önceki cezanın çekilmemiş olması tek başına eleme nedeni değildir', () => {
  const d = ilkDegerlendirme(hesapla(kt, tekerrurVaka([onceki({ kesinlesme_tarihi: '2025-01-01', infaz_durumu: 'baslamadi', infaz_tamamlanma_tarihi: null })])));
  assert.equal(d.sonuc, 'esas');
});

test('K15: 5 yıl önceki ceza → infazdan sonra 3 yıllık tekerrür süresi', () => {
  const o = onceki({ ceza: { yil: 5 }, infaz_tamamlanma_tarihi: '2020-01-01' });
  const a = ilkDegerlendirme(hesapla(kt, tekerrurVaka([o], { suc_tarihi: '2022-12-31' })));
  assert.equal(a.sonuc, 'esas');
  assert.equal(a.tekerrur_suresi.yil, 3);
  assert.equal(ilkDegerlendirme(hesapla(kt, tekerrurVaka([o], { suc_tarihi: '2023-01-02' }))).sonuc, 'esas_degil');
});

test('K16: 5 yıl 1 gün önceki ceza → 5 yıllık tekerrür süresi', () => {
  const d = ilkDegerlendirme(hesapla(kt, tekerrurVaka([onceki({ ceza: { yil: 5, ay: 0, gun: 1 }, infaz_tamamlanma_tarihi: '2020-01-01' })], { suc_tarihi: '2024-06-01' })));
  assert.equal(d.tekerrur_suresi.yil, 5);
  assert.equal(d.sonuc, 'esas');
});

test('K17: 17 yaşında işlenen önceki suç tekerrüre esas değildir', () => {
  const d = ilkDegerlendirme(hesapla(kt, tekerrurVaka([onceki({ suc_tarihi: '2007-06-01' })])));
  assert.equal(d.sonuc, 'esas_degil');
  assert.equal(d.kosullar.find((k) => k.dugum_id === 'D101').deger, false);
});

test('K18: Kasıtlı ile taksirli suç arasında tekerrür yok', () => {
  assert.equal(ilkDegerlendirme(hesapla(kt, tekerrurVaka([onceki({ kast_turu: 'kasit' })], { kast_turu: 'taksir' }))).sonuc, 'esas_degil');
});

test('K19: Üç ilam otomatik ikinci tekerrür değildir', () => {
  const c = hesapla(kt, tekerrurVaka([1, 2, 3].map((i) => onceki({ ilam_id: `O${i}`, tekerrur_uygulanmis_mi: null }))));
  assert.notEqual(c.tekerrur.belgelerden_aday_tespit, 'ikinci');
  assert.equal(c.tekerrur.belgelerden_aday_tespit, 'birinci_veya_ikinci');
  assert.equal(c.durum, 'eksik_veri');
});

test('K20: İlk tekerrür ek süre üst sınırı (108/2)', () => {
  const c = hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 0, ay: 0, gun: 600 } }, { tekerrure_esas_en_agir_ceza: { yil: 0, ay: 0, gun: 30 } }));
  assert.equal(senaryo(c).ks_ham_gun.toString(), '300');
  const S = senaryo(c, 'birinci');
  assert.ok(S.izler.some((i) => /400/.test(i.aciklama)));
  assert.equal(S.ks_ham_gun.toString(), '330');
  assert.equal(c.kurumda_kalacak_sure_gun, null);
});

test('K21: İkinci tekerrürde 108/2 uygulanmaz', () => {
  const c = hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 0, ay: 0, gun: 600 } }, { tekerrure_esas_en_agir_ceza: { yil: 0, ay: 0, gun: 30 } }));
  assert.equal(senaryo(c, 'ikinci').ks_ham_gun.toString(), '450');
});

test('K22: Adli paradan çevrilen hapiste olağan 105/A ve genel KS oranı yok', () => {
  const S = senaryo(hesapla(kt, vaka({ para_cezasindan_cevrilme: true })));
  assert.equal(S.yol, 'para_hapis');
  assert.equal(S.oran, null);
  assert.equal(S.takvim.DSye_hak_kazanma, null);
  assert.equal(S.takvim.kosullu_saliverilme, null);
});

test('K23: TCK 188 için istisna listeleri farklıdır', () => {
  const ilam = { kanun: 5237, madde: '188', fikra: null, bent: null, teror: false, orgut_faaliyeti: false, kitap: 2, kisim: 3, bolum: 3, suc_grubu: 'diger', magdur_yakinlik: null, magdur_savunmasiz: null, deprem_yapi_olumu: null };
  assert.equal(sec('SC04', ilam), true);
  assert.equal(sec('SC06', ilam), false);
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2020-01-01', kanun_madde_fikra_bent: { kanun: 5237, madde: '188' } })));
  assert.equal(yol(S, 'DS_gecici6_1').uygun, false);
  assert.equal(yol(S, 'gecici10_6').uygun, true); // sırf TCK 188 olduğu için 10/6 istisnası değildir
});

test('K24: TCK 105 bütün cinsel suçlarla eşitlenmez', () => {
  assert.equal(sec('SC06', { kanun: 5237, madde: '105', fikra: null, bent: null, teror: false, orgut_faaliyeti: false, kitap: 2, kisim: 2, bolum: 6, suc_grubu: 'diger', deprem_yapi_olumu: null }), false);
  assert.equal(senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-01-01', kanun_madde_fikra_bent: { kanun: 5237, madde: '105' } }))).temel_oran.oran.toString(), '2/3');
});

test('K25: Güncel 10/6 TCK 82/1-e öldürmeyi dışlar; önceki rejim hukuki inceleme', () => {
  const mfb = { kanun: 5237, madde: '82', fikra: '1', bent: 'e' };
  assert.equal(sec('SC06', { ...mfb, teror: false, orgut_faaliyeti: false, kitap: 2, kisim: 2, bolum: 1, suc_grubu: 'oldurme', deprem_yapi_olumu: null }), true);
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-01-01', hukumdeki_sonuc_ceza: { yil: 20 }, kanun_madde_fikra_bent: mfb })));
  assert.equal(yol(S, 'gecici10_6').uygun, false);
  assert.ok(S.notlar.some((n) => n.seviye === 'inceleme' && n.kurallar.includes('R058')));
});

test('K26: Normal DS daha erkense geçici 10/6 için 3 ay açıkta bekletilmez', () => {
  const S = senaryo(hesapla(kt, vaka({ suc_tarihi: '2023-01-01' })));
  assert.equal(S.kurumda_kalis_gun, 0);
  assert.equal(S.alternatif_yollar.length, 0);
});

test('K27: İkinci tekerrürde salt oran/onda birden 27 gün kesin tahliye üretilmez', () => {
  const c = hesapla(kt, vaka({ hukumdeki_tekerrur: 'ikinci' }));
  assert.equal(c.durum, 'hukuki_inceleme_gerekli');
  assert.equal(c.kurumda_kalacak_sure_gun, null);
  const S = senaryo(c, 'ikinci');
  assert.equal(S.acik_kurum.yol, 'kapalidan');
  assert.notEqual(S.kurumda_kalis_gun, 27);
});

test('K28: 7593 tekerrür yaşını 15e indirmedi; 16 yaşındaki önceki fiil esas alınmaz', () => {
  assert.equal(kt.p('R013')['7593_tck_58i_degistirdi'], false);
  assert.equal(ilkDegerlendirme(hesapla(kt, tekerrurVaka([onceki({ suc_tarihi: '2006-06-01' })]))).sonuc, 'esas_degil');
});

test('K29: Geçici 6/4 gün çarpanları (10 gün×3 + 10 gün×2 = 50)', () => {
  const ortam = { sucYasi: 14, vaka: { dogum_tarihi: '2006-01-01' }, E: '2020-04-01', ilam: { suc_tarihi: '2020-03-30' }, hesapTarihi: HESAP };
  const g = gunAgirligiBelirle(kt, ortam, { ilam: {} }, new Notlar());
  assert.equal(g.kural, 'R052');
  assert.equal(agirlikliGunToplami([{ yas: 14, gun: 10 }, { yas: 16, gun: 10 }], g.agirlik), 50);
  assert.equal(kt.p('R052').uygulama, 'yalniz_kosullu_saliverilme_suresi');
});

test('K30: 7595 tetikleyicisi belirsizken otomatik erteleme yok', () => {
  const c = hesapla(kt, vaka({ teror_kanunu_kapsami: true, hukumdeki_tekerrur: 'yok' }));
  assert.ok(c.ozel_infaz_notlari.some((n) => n.kural === 'R075'));
  assert.equal(c.durum, 'hukuki_inceleme_gerekli');
});

test('K31: 1 yıl ile 12 ay aynı girdiye ezilmez', () => {
  assert.equal(senaryo(hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 1, ay: 0, gun: 0 } }))).takvim.toplam_ceza_gun, 365);
  assert.equal(senaryo(hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 0, ay: 12, gun: 0 } }))).takvim.toplam_ceza_gun, 360);
});

test('K32: Karma tarihli toplamada geçici 6 ve onda bir bütün toplama uygulanmaz', () => {
  const t = toplamaDegerlendir(kt, [{ suc_tarihi: '2020-03-30' }, { suc_tarihi: '2025-06-05' }]);
  assert.equal(t.durum, 'hukuki_inceleme_gerekli');
  assert.equal(t.tum_toplama_gecici6_uygula, false);
  assert.equal(t.tum_toplama_onda_bir_uygula, false);
  assert.ok(t.hata_kodlari.includes('E007'));
});

test('K33: İyi hâl kararı yokken iyi hâl otomatik kabul edilmez', () => {
  const c = hesapla(kt, vaka({ suc_tarihi: '2024-01-01', hukumdeki_tekerrur: 'yok' }, { iyi_hal: null }));
  assert.ok(IZINLI.includes(c.durum));
  assert.ok(c.hukuki_kabuller.some((m) => /İyi hâl varsayıldı/.test(m)));
  assert.ok(c.hata_kodlari.includes('E008'));
  assert.equal('kesin_tahliye' in c, false);
});

test('K34: Kesin hükümdeki ceza yazılımca değiştirilmez', () => {
  const v = vaka({ hukumdeki_sonuc_ceza: { yil: 2, ay: 3, gun: 4 } });
  const once = JSON.stringify(v);
  const c = hesapla(kt, v);
  assert.equal(JSON.stringify(v), once);
  assert.ok(c.secilen_kural_idleri.includes('R006'));
});

test('K35: 10 yıldan az cezada kapalıdan açığa 1 ay; KS\'ye 7 yıl dahil', () => {
  const e = acikEsikleri(kt);
  assert.deepEqual(e.kapaliAsgari(true), { ay: 1 });
  assert.equal(e.genelKalanSaglandi(7), true);
  assert.equal(e.genelKalanSaglandi(7.01), false);
});

test('K36: Tam 10 yılda kapalıda toplam cezanın onda biri', () => {
  assert.equal(acikEsikleri(kt).kapaliAsgari(false).oran.toString(), '1/10');
  const S = senaryo(hesapla(kt, vaka({ hukumdeki_sonuc_ceza: { yil: 10 } })));
  assert.ok(S.acik_kurum.kapali.kalemler.some((k) => k.dugum_id === 'D033'));
});

test('K37: TCK 142 özel açık kurum eşiğinde 5 yıl eşitliği yetmez', () => {
  assert.equal(acikEsikleri(kt).ozelKalanSaglandi('D035', 5), false);
  assert.equal(acikEsikleri(kt).ozelKalanSaglandi('D035', 4.99), true);
});

test('K38: TCK 102 özel açık kurum eşiğinde 3 yıl eşitliği yetmez', () => {
  assert.equal(acikEsikleri(kt).ozelKalanSaglandi('D036', 3), false);
});

const cekVaka = (ilam = {}, cek = {}) =>
  vaka({ kanun_madde_fikra_bent: { kanun: 5941, madde: '5', fikra: '1' }, hukumdeki_ceza_turu: 'adli_para', infazdaki_ceza_turu: 'adli_paradan_cevrilen_hapis', para_cezasindan_cevrilme: true, hukumdeki_sonuc_ceza: { yil: 0, ay: 0, gun: 300 }, ...ilam }, { cek });

test('K39: Çek m.5 hapse çevrilmiş: KS, 105/A ve kamu işi yok', () => {
  const c = hesapla(kt, cekVaka());
  assert.equal(c.cek_sonucu.yol, 'cek_5_11');
  const S = senaryo(c);
  assert.equal(S.yol, 'cek_5_11');
  assert.equal(S.oran, null);
  assert.equal(S.takvim.DSye_hak_kazanma, null);
  assert.equal(kt.dugum('D002').sonuc_adayi.kamu_isi_on_asamasi, false);
});

test('K40: Çek m.7 doğrudan hapis genel hapis yoluna girer', () => {
  const c = hesapla(kt, vaka({ kanun_madde_fikra_bent: { kanun: 5941, madde: '7', fikra: '6' } }));
  assert.equal(c.cek_sonucu.yol, 'genel_sureli_hapis');
  assert.equal(senaryo(c).yol, 'sureli_hapis');
});

test('K41: Çocuk hakkındaki adli para hapse çevrilmez', () => {
  const S = senaryo(hesapla(kt, vaka({ hukumdeki_ceza_turu: 'adli_para', cocuk_hakkinda_adli_para_hukmu: true, hukumdeki_sonuc_ceza: null })));
  assert.equal(S.uygulanabilir, false);
  assert.match(S.neden, /hapse çevrilemez/);
});

test('K42: Birden fazla para hükmünde hapis tavanı 5 yıl; bakiye silinmez', () => {
  const p = kt.p('R103');
  assert.equal(p.birden_fazla_hukum_azami_yil, 5);
  assert.match(p.hapis_ile_karsilanmayan_para, /otomatik silinmez/);
});

test('K43: Çek m.6 bedel ve faiz tam ödemede hükmün ortadan kaldırılması istenir', () => {
  const c = hesapla(kt, cekVaka({}, { m6_bedel_ve_faiz_tam_odendi_dogrulandi: true }));
  assert.ok(c.cek_sonucu.talepler.some((t) => t.dugum_id === 'D040' && /ortadan kaldırılması/.test(t.metin)));
});

test('K44: Çek m.6 kısmi ödemede tam ödeme şartı yok', () => {
  const c = hesapla(kt, cekVaka({}, { m6_bedel_ve_faiz_tam_odendi_dogrulandi: false }));
  assert.equal(c.cek_sonucu.talepler.some((t) => t.dugum_id === 'D040'), false);
});

test('K45: Hazineye ödeme çek borcunu kendiliğinden sona erdirmez', () => {
  const c = hesapla(kt, cekVaka({}, { kalan_infaz_gun_karsiligi_tam_odendi_dogrulandi: true }));
  assert.ok(c.cek_sonucu.talepler.some((t) => t.dugum_id === 'D045' && /kendiliğinden sona ermez/.test(t.metin)));
  assert.equal(kt.dugum('D045').sonuc_adayi.cek_borcu_kendiliginden_biter, false);
});

test('K46: Çek geçici 5 sınır günü dahil', () => {
  const c = hesapla(kt, cekVaka({ suc_tarihi: '2021-04-30' }));
  assert.ok(c.cek_sonucu.gecis.some((g) => g.dugum_id === 'D042' && /kapsamında/.test(g.metin)));
});

test('K47: Çek geçici 5 sınır sonrası kapsam dışı', () => {
  const c = hesapla(kt, cekVaka({ suc_tarihi: '2021-05-01' }));
  assert.ok(c.cek_sonucu.gecis.some((g) => g.dugum_id === 'D042' && /kapsamı dışında/.test(g.metin)));
});

test('K48: Çek geçici 5 ilk aksama: taksit sona eklenir, otomatik infaza devam yok', () => {
  const c = hesapla(kt, cekVaka({}, { gecici5_uygulama_karari_dogrulandi: true, vadeli_taksit_aksama_sayisi: 1 }));
  assert.ok(c.cek_sonucu.gecis.some((g) => g.dugum_id === 'D043'));
  assert.equal(c.cek_sonucu.gecis.some((g) => g.dugum_id === 'D044'), false);
});

test('K49: Çek geçici 5 ikinci aksama: şikâyet ve karar incelenir', () => {
  const c = hesapla(kt, cekVaka({}, { gecici5_uygulama_karari_dogrulandi: true, vadeli_taksit_aksama_sayisi: 2 }));
  assert.ok(c.cek_sonucu.gecis.some((g) => g.dugum_id === 'D044' && /şikâyeti/.test(g.metin)));
});

test('K50: Geçmiş ödeme planı bugün yeniden başlatılmaz', () => {
  assert.equal(kt.p('R109').bugun_yeni_30_aylik_plan_baslat, false);
  assert.equal(kt.dugum('D042').sonuc_adayi.bugun_yeni_plan_baslat, false);
});

test('K51: DS müdürlüğüne başvuru süresi ayrılışı izleyen gün başlar', () => {
  const s = dsBasvuruSuresi(kt, '2026-10-12');
  assert.equal(s.ilk_sayilan_gun, '2026-10-13');
  assert.equal(s.son_gun.ham_tarih, '2026-10-17'); // Cumartesi
  assert.equal(s.son_gun.tarih, '2026-10-19');
  assert.equal(s.son_gun.hafta_sonundan_kaydirildi, true);
});

test('K52: DS ihlalinde çocuk ve yetişkin sayıları farklıdır; sonuç otomatik değildir', () => {
  const p = kt.p('R091');
  assert.equal(p.yetiskin_bir_yilda_kasitli_mazeretsiz_ihlal, 3);
  assert.equal(p.cocuk_ve_DS_baslangicinda_cocuk_bir_yilda_ihlal, 4);
  assert.equal(p.nihai_karar_otomatik, false);
});

test('K53: Özel infazda eski yönetmelik eşiği kanunu daraltmaz', () => {
  const c = hesapla(kt, vaka({ hukumdeki_tekerrur: 'yok' }, { cinsiyet: 'kadin' }));
  const n = c.ozel_infaz_notlari.find((x) => x.baslik === 'Konutta infaz');
  assert.equal(n.kural, 'R070');
  assert.match(n.metin, /N02/);
});

test('K54: İkinci mükerrirde 27 gün genellemesi yapılmaz; açık kurum ayrıca', () => {
  const S = senaryo(hesapla(kt, vaka()), 'ikinci');
  assert.equal(S.asgari_kurum.gun, 27);
  assert.equal(S.kurumda_kalis_gun, 30);
  assert.equal(S.acik_kurum.yol, 'kapalidan');
});

test('K55: İnfaz hâkimliği kararına itiraz süresi tebliğden iki hafta', () => {
  const s = itirazSuresi(kt, { teblig: '2026-10-01' });
  assert.equal(s.sure_hafta, 2);
  assert.equal(s.son_gun.tarih, '2026-10-15');
});

test('K56: Çek m.5/1 alt sınır iptali m.6/1 faizini kendiliğinden kaldırmaz', () => {
  assert.ok(hesapla(kt, cekVaka()).cek_sonucu.bilgiler.some((b) => b.kural === 'R113'));
});

test('K57: Ağır hasta para-hapis hükümlüsünde normal DS yok; özel konutta infaz incelenir', () => {
  const S = senaryo(hesapla(kt, vaka({ para_cezasindan_cevrilme: true }, { rapor_105A_3_b: true })));
  assert.equal(S.takvim.DSye_hak_kazanma, null);
  assert.ok(S.notlar.some((n) => n.kod === 'R071'));
});

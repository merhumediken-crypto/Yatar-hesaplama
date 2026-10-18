// Arayüz modelleri: dosya → vaka, sıralı sorular, sonuç özeti ve paylaşım metni.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hesapla, takvim as T } from '../extension/cekirdek/index.js';
import { bosDosya, dosyaYukle, vakaKur, ozelDurum, kapsamDisi, hesaplanabilir, mahsupGunu, ilamGorunumu, tamDosya } from '../extension/ui/dosya.js';
import { sonrakiSoru, cevapla, bilinmiyorCevabi, soru, cevaplar, varsayimSatirlari, TEMEL_SORULAR } from '../extension/ui/sorular.js';
import { sonucOzeti, paylasimMetni, kurumBolumleri, muddetnameKarsilastir } from '../extension/ui/ozet.js';
import { sucAra, maddeCoz } from '../extension/ui/tck-maddeleri.js';
import { kt, HESAP } from './yardimci.js';

// Temel soruları cevaplanmış tek ilamlı dosyanın ilam görünümü (dosya.js → ilamGorunumu).
function dosya(ek = {}) {
  return Object.assign(ilamGorunumu(bosDosya(), 0), {
    konum: 'girmedi',
    suc_tarihi: '2025-07-01',
    ceza: { yil: 3, ay: 1, gun: 15 },
    suc: { kanun: 5237, madde: '142', fikra: null, bent: null },
    tekerrur: 'yok',
    giris: { tur: 'tarih', tarih: '2026-01-01' },
    mahsup: [],
    ...ek,
  });
}
const hesap = (d) => hesapla(kt, vakaKur(d, HESAP));
const ozet = (d, anahtar) => sonucOzeti(kt, d, hesap(d), anahtar, hesapla(kt, vakaKur(d, HESAP, { dsTalebi: false })));

// Bütün ek soruları "Bilmiyorum" diyerek geçer; sorulan soru kimliklerini döner.
function sorulanlar(d) {
  const liste = [];
  for (let s = sonrakiSoru(kt, d, HESAP, hesap(d)); s; s = sonrakiSoru(kt, d, HESAP, hesap(d))) {
    liste.push(s.s.id);
    bilinmiyorCevabi(s.g, s.s.id);
    if (liste.length > 20) throw new Error('soru döngüsü');
  }
  return liste;
}

test('dosya → vaka: iyi hâl ve DS talebi açık, kast maddeden, örgüt/terör maddeden', () => {
  const v = vakaKur(dosya(), HESAP);
  assert.equal(v.iyi_hal, true);
  assert.equal(v.ds_talebi, true);
  assert.equal(v.infaza_baslama_tarihi, '2026-01-01');
  const i = v.suclar_ve_ilamlar[0];
  assert.equal(i.kast_turu, 'kasit');
  assert.equal(i.teror_kanunu_kapsami, false);
  assert.equal(i.orgut_uyelik, false);
  assert.equal(vakaKur(dosya({ suc: { kanun: 5237, madde: '85' } }), HESAP).suclar_ve_ilamlar[0].kast_turu, 'taksir');
  const teror = vakaKur(dosya({ suc: { kanun: 5237, madde: '314', fikra: '2' } }), HESAP).suclar_ve_ilamlar[0];
  assert.equal(teror.teror_kanunu_kapsami, true);
  assert.equal(teror.orgut_uyelik, true);
  assert.equal(teror.orgut_kurma_yonetme, false);
  assert.equal(teror.orgut_faaliyeti, false, 'üyelik tek başına örgüt faaliyeti sayılmaz (R023)');
  // Avukatın seçimi otomatiği ezer
  assert.equal(vakaKur(dosya({ suc: { kanun: 5237, madde: '314' }, ozel: { teror: false, orgut: null, taksir: null } }), HESAP).suclar_ve_ilamlar[0].teror_kanunu_kapsami, false);
  assert.equal(ozelDurum(dosya({ suc: { kanun: 5237, madde: '310', fikra: '2' } })).teror, false, '310 yalnız 1. fıkrada terör suçu');
});

test('dosya → vaka: giriş bugün, mahsup, 108/2 cezası, paradan çevrilen hapis', () => {
  const v = vakaKur(dosya({ giris: { tur: 'bugun' }, mahsup: [{ tur: 'gozalti', gun: 3 }, { tur: 'tutukluluk', baslangic: '2025-01-01', bitis: '2025-02-09' }], tekerrur: 'birinci', esas_ceza: { yil: 1, ay: 0, gun: 0 } }), HESAP);
  assert.equal(v.infaza_baslama_tarihi, HESAP);
  assert.deepEqual(v.mahsup_kayitlari, [
    { kayit_id: 'M1', tur: 'gozalti', gun: 3 },
    { kayit_id: 'M2', tur: 'tutukluluk', baslangic: '2025-01-01', bitis: '2025-02-09' },
  ]);
  // Faz 1 biçimindeki kayıt da okunur
  assert.deepEqual(vakaKur(dosya({ mahsup: { gozalti: 2, tutukluluk: 0 } }), HESAP).mahsup_kayitlari, [{ kayit_id: 'M1', tur: 'gozalti', gun: 2 }]);
  assert.deepEqual(v.tekerrure_esas_en_agir_ceza, { yil: 1, ay: 0, gun: 0 });
  const p = vakaKur(dosya({ ceza_turu: 'adli_paradan_cevrilen_hapis', ceza: { yil: 0, ay: 6, gun: 0 } }), HESAP).suclar_ve_ilamlar[0];
  assert.equal(p.infazdaki_ceza_turu, 'adli_paradan_cevrilen_hapis');
  assert.equal(p.para_cezasindan_cevrilme, true);
});

test('dosya yükleme: eski sürüm atılır, alanlar korunur', () => {
  assert.deepEqual(dosyaYukle({ surum: 2, alanlar: {} }), bosDosya());
  const d = dosyaYukle(JSON.parse(JSON.stringify(tamDosya(dosya({ ek: { rapor: false }, bilinmiyor: ['yas'] })))));
  assert.equal(d.ilamlar[0].suc.madde, '142');
  assert.deepEqual(d.ek, { rapor: false });
  assert.deepEqual(d.bilinmiyor, ['yas']);
});

test('temel sorular sırayla sorulur', () => {
  const d = bosDosya();
  const sira = [];
  for (let o = sonrakiSoru(kt, d, HESAP, null); o && TEMEL_SORULAR.includes(o.s); o = sonrakiSoru(kt, d, HESAP, hesaplanabilir(d) ? hesap(d) : null)) {
    const s = o.s;
    sira.push(s.id);
    const cevap = { konum: 'cezaevinde', suc_tarihi: '2025-07-01', ceza: { ceza_turu: 'sureli_hapis', ceza: { yil: 2, ay: 0, gun: 0 } }, tekerrur: 'birinci', esas_ceza: { ceza: { yil: 1, ay: 0, gun: 0 } }, giris: { tur: 'tarih', tarih: '2026-03-01' }, mahsup: [] }[s.id];
    if (cevap === undefined) bilinmiyorCevabi(o.g, s.id);
    else cevapla(o.g, s, cevap);
  }
  assert.deepEqual(sira, ['konum', 'suc_tarihi', 'ceza', 'suc', 'tekerrur', 'esas_ceza', 'giris', 'mahsup']);
  assert.equal(soru('esas_ceza').gorunur({ ...d, tekerrur: 'yok' }), false, '108/2 sorusu yalnız 1. tekerrürde');
});

test('ek sorular yalnız sonucu değiştirdiğinde sorulur', () => {
  // 3 yıl 1 ay 15 gün nitelikli hırsızlık: kast, örgüt, fıkra sorulmaz.
  assert.deepEqual(sorulanlar(dosya()), ['kadin_cocuk', 'rapor']);
  // 2 yıl kasten yaralama: asgari kurum süresi bağlar; kişisel sorular sonucu değiştirmez.
  assert.ok(!sorulanlar(dosya({ suc: { kanun: 5237, madde: '86' }, ceza: { yil: 2, ay: 0, gun: 0 } })).includes('kadin_cocuk'));
  // 2019 uyuşturucu ticareti: çocukta oran farklı → yaş sorulur.
  assert.ok(sorulanlar(dosya({ suc: { kanun: 5237, madde: '188' }, suc_tarihi: '2019-01-01', ceza: { yil: 10, ay: 0, gun: 0 } })).includes('yas'));
  // 220'de fıkra kurma ile üyeliği ayırır.
  assert.equal(sorulanlar(dosya({ suc: { kanun: 5237, madde: '220' }, ceza: { yil: 3, ay: 0, gun: 0 } }))[0], 'fikra');
});

test('cevaplanan ek soru tekrar sorulmaz; çocuk seçilince doğum tarihi sorulur', () => {
  const d = dosya({ suc: { kanun: 5237, madde: '188' }, suc_tarihi: '2019-01-01', ceza: { yil: 10, ay: 0, gun: 0 } });
  const s = sonrakiSoru(kt, d, HESAP, hesap(d)).s;
  assert.equal(s.id, 'yas');
  cevapla(d, s, 'cocuk');
  assert.equal(sonrakiSoru(kt, d, HESAP, hesap(d)).s.id, 'dogum_tarihi');
  cevapla(d, soru('dogum_tarihi'), '2002-06-01');
  assert.notEqual(sonrakiSoru(kt, d, HESAP, hesap(d))?.s.id, 'yas');
  assert.ok(cevaplar(d).some((c) => c.metin === 'Suçta 18 yaş altı'));
});

test('sonuç özeti: 3y1a15g hırsızlık → 30 kapalı, 175 açık, 365 DS', () => {
  const o = ozet(dosya());
  assert.equal(o.durum, 'tamam');
  assert.deepEqual([o.kapali, o.acik, o.ds, o.icerde], [30, 175, 365, 205]);
  assert.deepEqual(o.olaylar.map((e) => [e.tur, e.tarih]), [
    ['giris', '2026-01-01'],
    ['acik', '2026-01-31'],
    ['cikis', '2026-07-25'],
    ['ks', '2027-07-25'],
    ['bitis', '2029-02-15'],
  ]);
  assert.match(o.neden.kapali.metin, /Yönetmelik m\.6\/1-a/);
  assert.equal(o.neden.kapali.madde, 'U04:govde:6');
  assert.equal(o.neden.cikis.madde, 'U03:govde:105/A');
  assert.match(o.neden.ks.metin, /1\/2/);
  assert.deepEqual(o.karsilastirma.map((k) => k.gun), [205, 395, 489]);
  assert.equal(o.kapali + o.acik, o.icerde, 'kapalı + açık = cezaevinde kalış');
});

test('sonuç özeti: doğrudan açık, mahsup, 2005 öncesi ve boş dosya', () => {
  const kisa = ozet(dosya({ ceza: { yil: 1, ay: 0, gun: 0 }, suc: { kanun: 5237, madde: '141' } }));
  assert.deepEqual([kisa.kapali, kisa.acik], [0, 18]);
  assert.equal(kisa.olaylar[0].baslik, 'Açık cezaevine giriş');
  const mahsuplu = ozet(dosya({ mahsup: [{ tur: 'tutukluluk', gun: 20 }] }));
  assert.equal(mahsuplu.kapali, 10, 'tutuklulukta geçen 20 gün kapalıdaki 1 aydan düşülür');
  assert.match(mahsuplu.olaylar[0].aciklama, /20 gün mahsup/);
  const eski = dosya({ suc_tarihi: '2004-12-31' });
  assert.ok(kapsamDisi(eski));
  assert.equal(sonucOzeti(kt, eski, null).durum, 'kapsam_disi');
  assert.equal(sonrakiSoru(kt, eski, HESAP, null), null);
  assert.equal(sonucOzeti(kt, bosDosya(), null).durum, 'bos');
});

test('sonuç özeti: tekerrür bilinmiyorsa tekerrürsüz gösterilir, karşılaştırma seçilebilir', () => {
  const d = dosya({ ceza: { yil: 1, ay: 0, gun: 0 }, suc: { kanun: 5237, madde: '141' }, suc_tarihi: '2025-06-05', tekerrur: null, bilinmiyor: ['tekerrur'] });
  const o = ozet(d);
  assert.equal(o.senaryo, 'yok');
  assert.deepEqual(o.karsilastirma.map((k) => k.gun), [18, 24, 30]);
  assert.ok(o.varsayimlar.some((v) => /Tekerrür bilinmiyor/.test(v)));
  const ikinci = ozet(d, 'ikinci');
  assert.deepEqual([ikinci.kapali, ikinci.acik], [30, 0], 'ikinci tekerrürde doğrudan açık yasak; 1 ay kapalı');
});

test('kurum bölümleri: açığa geçiş çıkıştan sonraysa bütün süre kapalıda', () => {
  const S = { takvim: { infaza_baslama: '2026-01-01', kapalidan_aciga_hak_kazanma: '2026-06-01', kurumdan_cikis: '2026-03-01' } };
  assert.deepEqual(kurumBolumleri(S), { kapali: 59, acik: 0, acikTarih: null });
  assert.deepEqual(kurumBolumleri({ takvim: { ...S.takvim, kapalidan_aciga_hak_kazanma: null } }).kapali, 59);
});

test('paylaşım metni müvekkile gönderilebilir biçimdedir', () => {
  const d = dosya();
  const metin = paylasimMetni(d, ozet(d));
  assert.match(metin, /^3 yıl 1 ay 15 gün · Nitelikli hırsızlık · suç tarihi 01\.07\.2025/);
  assert.match(metin, /30 gün kapalı, 175 gün açık cezaevinde kalır; sonra 365 gün denetimli serbestlik\./);
  assert.match(metin, /25\.07\.2026 {2}Cezaevinden çıkış/);
  assert.match(metin, /iyi hâl şartıyla/);
  assert.doesNotMatch(metin, /\bR\d{3}\b|\bD\d{3}\b/, 'kural/düğüm kodu yok');
});

test('varsayım satırları yalnız "Bilmiyorum" cevaplarından gelir', () => {
  const d = dosya();
  assert.deepEqual(varsayimSatirlari(d), []);
  bilinmiyorCevabi(d, 'suc');
  assert.equal(d.suc, null);
  assert.equal(varsayimSatirlari(d).length, 1);
  cevapla(d, soru('suc'), { kanun: 5237, madde: '141' });
  assert.deepEqual(varsayimSatirlari(d), []);
});

test('suç arama ve madde çözümleme', () => {
  assert.deepEqual(sucAra('hirsizlik').map((s) => s.madde), ['141', '142']);
  assert.equal(sucAra('188')[0].madde, '188');
  assert.equal(sucAra('ruhsatsız silah')[0].kanun, 6136);
  assert.deepEqual(maddeCoz('87/2-d'), { madde: '87', fikra: '2', bent: 'd' });
  assert.equal(maddeCoz('yağma'), null);
});

test('31/07/2023 öncesi suç: geçici 10/6 ile 1 ay kapalı, 3 ay açık, sonra DS', () => {
  const d = dosya({ suc_tarihi: '2023-01-01' });
  const o = ozet(d);
  assert.deepEqual([o.kapali, o.acik, o.ds], [30, 90, 450]);
  const cikis = o.olaylar.find((e) => e.tur === 'cikis');
  assert.equal(cikis.tarih, '2026-05-01');
  assert.match(cikis.aciklama, /geçici 10\/6/);
  assert.match(o.neden.cikis.metin, /Geçici 10\/6/);
  assert.equal(o.neden.cikis.madde, 'U03:govde:gecici_10');
  // Talep etmezse koşullu salıverilmede çıkar
  assert.deepEqual(o.talepsiz, { cikis: '2027-07-25', icerde: 570, kapali: 30, acik: 540, ks: true });
  assert.match(paylasimMetni(d, o), /talep etmezse: 25\.07\.2027 tarihinde koşullu salıverilme ile çıkar \(570 gün cezaevinde\)/);
  // 10 yıl: kapalıda 3 ay, açığa geçiş normal tarihten (01.01.2027) önce
  const uzun = ozet(dosya({ suc_tarihi: '2023-01-01', ceza: { yil: 10, ay: 0, gun: 0 }, suc: { kanun: 5237, madde: '141' } }));
  assert.deepEqual([uzun.kapali, uzun.acik], [90, 275]);
  assert.match(uzun.olaylar.find((e) => e.tur === 'acik').aciklama, /normalde 01\.01\.2027/);
  assert.match(uzun.neden.kapali.metin, /Geçici 10\/6: kapalıda 3 ay/);
});

test('mahsup kayıtları: tarih aralığı, konutu terk etmeme 2:1, kullanılan DS', () => {
  assert.deepEqual(mahsupGunu({ tur: 'tutukluluk', baslangic: '2025-01-01', bitis: '2025-01-31' }), { takvim: 31, dusulen: 31 });
  assert.deepEqual(mahsupGunu({ tur: 'konutu_terk_etmeme', gun: 45 }), { takvim: 45, dusulen: 22.5 }); // toplamda aşağı yuvarlanır
  // 31 gün tutukluluk + 2 gün gözaltı: kapalıdaki 1 ay tamamen mahsupla karşılanır
  const d = dosya({ mahsup: [{ tur: 'gozalti', gun: 2 }, { tur: 'tutukluluk', baslangic: '2025-01-01', bitis: '2025-01-31' }] });
  const o = ozet(d);
  assert.equal(hesap(d).senaryolar.yok.takvim.mahsup_gun, 33);
  assert.equal(o.kapali, 0);
  assert.equal(o.olaylar[0].tarih, '2026-01-01');
  assert.match(cevaplar(d).find((c) => c.id === 'mahsup').metin, /Mahsup 33 gün/);
  // Kullanılan DS: infazdan sayılır, hükümlü açık cezaevinde devam eder (105/A/6-7)
  const ds = dosya({ mahsup: [{ tur: 'denetimli_serbestlik', baslangic: '2025-03-01', bitis: '2025-05-29' }] });
  const od = ozet(ds);
  assert.equal(od.kapali, 0);
  assert.match(od.neden.kapali.metin, /105\/A\/6-7/);
  assert.equal(hesap(ds).senaryolar.yok.takvim.kosullu_saliverilme, T.gunEkle('2027-07-25', -90));
  assert.match(cevaplar(ds).find((c) => c.id === 'mahsup').metin, /DS dahil/);
  // Mahsup çıkış şartını girişten önce karşılarsa çıkış giriş günü gösterilir
  const fazla = ozet(dosya({ suc_tarihi: '2023-01-01', mahsup: [{ tur: 'tutukluluk', gun: 200 }] }));
  const cikis = fazla.olaylar.find((e) => e.tur === 'cikis');
  assert.equal(cikis.tarih, '2026-01-01'); // çekirdek geçmişte kalan eşiği girişe çeker (0.6.1)
  assert.equal(fazla.icerde, 0);
  assert.equal(fazla.ds, T.gunFarki('2026-01-01', hesap(dosya({ suc_tarihi: '2023-01-01', mahsup: [{ tur: 'tutukluluk', gun: 200 }] })).senaryolar.yok.takvim.kosullu_saliverilme));
  assert.equal(fazla.karsilastirma[0].cikis, '2026-01-01');
});

test('müddetname karşılaştırması: fark gün olarak, müddetname daha geçse artı', () => {
  const o = ozet(dosya());
  const r = muddetnameKarsilastir(o, { ks: '2027-07-27', cikis: '2026-07-25' });
  assert.deepEqual(r.map((x) => [x.id, x.hesap, x.fark]), [
    ['acik', '2026-01-31', null],
    ['cikis', '2026-07-25', 0],
    ['ks', '2027-07-25', 2],
    ['bitis', '2029-02-15', null],
  ]);
  assert.deepEqual(muddetnameKarsilastir({ durum: 'bos' }, {}), []);
  assert.deepEqual(dosyaYukle({ ...bosDosya(), muddetname: { ks: '2027-07-27' } }).muddetname, { ks: '2027-07-27' });
  // Sürüm 3 (düz) kayıt sürüm 4'e çevrilir; ilama özgü ek cevap ilama taşınır
  const v3 = dosyaYukle({ surum: 3, konum: 'cezaevinde', suc_tarihi: '2024-01-01', ceza: { yil: 2 }, suc: { kanun: 5237, madde: '86' }, ek: { magdur_yakinlik: 'es', rapor: false }, bilinmiyor: ['tekerrur', 'yas'], muddetname: { ks: '2027-07-27' } });
  assert.equal(v3.surum, 4);
  assert.equal(v3.ilamlar.length, 1);
  assert.deepEqual([v3.ilamlar[0].suc_tarihi, v3.ilamlar[0].suc.madde, v3.ilamlar[0].ek.magdur_yakinlik], ['2024-01-01', '86', 'es']);
  assert.deepEqual([v3.ek, v3.bilinmiyor, v3.ilamlar[0].bilinmiyor], [{ rapor: false }, ['yas'], ['tekerrur']]);
});

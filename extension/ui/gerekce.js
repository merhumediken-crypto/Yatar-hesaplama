// Anlatım katmanı: seçili senaryonun gerçek hesap kayıtlarını okunur hâle getirir.
// Yeni infaz tarihi veya hukuki uygunluk üretmez; tarih seçimlerini motor belirler.
import { takvim as T, Kesir, profilOlustur } from '../cekirdek/index.js';
import { mahsupHesapla } from '../cekirdek/hesap/mahsup.js';
import { maddeEtiketi, sucAdi } from './tck-maddeleri.js';

const tr = (t) => t ? T.trTarih(t) : 'Yok';
const sayi = (n) => Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 8 });
const kesir = (x) => x == null ? '—' : String(Kesir.from(x));
const ondalik = (x) => {
  if (x == null) return '—';
  const k = Kesir.from(x);
  return sayi(k.pay / k.payda);
};
const tekil = (xs) => [...new Set(xs.filter(Boolean))];
const izler = (S, adlar) => S.izler.filter((i) => adlar.includes(i.adim));

function kaynaklar(kt, ids) {
  return tekil(ids).filter((id) => kt.kurallar.has(id)).map((id) => {
    const k = kt.kuralOzeti(id);
    return { id, ad: k.mevzuat.join(' · '), ozet: k.ozet, madde: k.madde_idleri[0] || null };
  });
}

// Bir yol içindeki şartlar birlikte gerekir: en geç tarih bağlayıcıdır.
// Ayrı uygun yollar ise birbiriyle yarışır: en erken yararlı yol seçilir.
function sartlar(kalemler, tarih) {
  return (kalemler || []).map((k) => ({ ad: k.ad, tarih: k.tarih, belirleyici: k.tarih === tarih }));
}

function yolNedeni(y, S) {
  if (y.id === S.secilen_ds_yolu) return 'Şartları sağlayan yollar içinde en erken tarihi verdiği için seçildi. Eşit tarihte ilk uygun yol korunur.';
  if (y.yarar_yok) return y.neden;
  if (y.uygun === true && y.tarih) {
    const secilen = S.ds_yollari.find((x) => x.id === S.secilen_ds_yolu);
    return secilen?.tarih === y.tarih ? 'Seçilen yolla aynı tarih; ayrıca bir erken çıkış sağlamıyor.' : 'Uygun, ancak seçilen yoldan daha geç çıkış sağlıyor.';
  }
  // Teknik düğüm numarası yerine belgeli koşulun nedenini açıkla.
  if (y.neden === 'Düğüm koşulları sağlanmıyor.') {
    if (y.id === 'DS_105A_3_a') return '0–6 yaş çocuğu bulunan kadın hükümlü koşulu bu dosyada sağlanmadı.';
    if (y.id === 'DS_105A_3_b') return 'Bu özel yol için aranan sağlık raporu koşulu bu dosyada sağlanmadı.';
    return 'Olağan DS için aranan kurum veya kişisel koşullar bu senaryoda sağlanmadı.';
  }
  if (y.neden === 'Geçici 10/6 istisna suçu (SC06).') return 'Girilen suç, geçici 10/6 için kapsam dışında değerlendirildi. Suçun fıkra/bendi ve ilgili maddedeki istisna listesi bu yolun kapsamını belirler.';
  return y.neden || (y.uygun === null ? 'Gerekli koşulların tamamı belirlenemedi.' : 'Bu dosyada uygulanabilir değil.');
}

export function gerekceKur(kt, d, c, S, o) {
  const t = S.takvim;
  const profil = profilOlustur(c.vaka.profil || {});
  const mahsup = mahsupHesapla(kt, c.vaka.mahsup_kayitlari, profil, { ekle() {} });
  const dsYolu = S.ds_yollari.find((y) => y.id === S.secilen_ds_yolu);
  const gercekDS = o.ds > 0;
  const acik = S.acik_kurum;
  const ceza = d.ceza ? T.cezaMetni(d.ceza) : d.ceza_turu === 'agirlastirilmis_muebbet' ? 'Ağırlaştırılmış müebbet' : 'Müebbet';
  const bilgiler = [
    { etiket: 'Suç tarihi', deger: tr(d.suc_tarihi) },
    { etiket: 'Suç', deger: d.suc ? `${maddeEtiketi(d.suc)} · ${sucAdi(d.suc) || 'Girilen madde'}` : 'Bilinmiyor; ihtiyatlı kabul kullanıldı' },
    { etiket: 'Hükümdeki ceza', deger: ceza },
    { etiket: 'İnfaza başlama', deger: `${tr(t.infaza_baslama)}${d.konum !== 'cezaevinde' ? ' · varsayılan giriş' : ' · girilen giriş'}` },
    { etiket: 'Görüntülenen senaryo', deger: o.baslik },
  ];
  const cezaIz = izler(S, ['Ceza süresi', '106/7 üst sınırı']);
  const oranIz = izler(S, ['Temel oran', 'Birinci tekerrür', 'İkinci tekerrür', '108/2 üst sınırı', 'Çocukta gün ağırlığı', 'Müebbet koşullu salıverilme', 'Koşullu salıverilme yasağı', 'Geri alma', 'Adli paradan çevrilen hapis']);
  const ksKural = S.anahtar !== 'yok' && S.oran ? S.anahtar === 'ikinci' ? 'R028' : 'R027' : S.temel_oran?.kaynak || S.muebbet?.kural;
  const kapaliMetin = o.kapali === 0
    ? `Bu girişten sonra kapalı kurumda geçirilecek süre 0 gün.${acik?.yol === 'dogrudan' || S.yol === 'para_hapis' || S.yol === 'cek_5_11' ? ' İnfaz doğrudan açık kurumda başlıyor.' : ' Mahsup ve seçilen çıkış tarihi birlikte değerlendirildi.'}`
    : `${tr(t.infaza_baslama)} girişinden ${tr(o.tarihler.acik || o.tarihler.cikis)} tarihine kadar ${o.kapali} gün kapalı kurum hesabı var.${!o.tarihler.acik ? ' Bu girişte çıkıştan önce açık kurum dönemi oluşmuyor.' : ''}`;
  const acikMetin = o.acik > 0
    ? `${tr(o.tarihler.acik)} ile ${tr(o.tarihler.cikis)} arasındaki ${o.acik} gün açık kurumda geçiyor. Açığa ayrılma cezaevinden çıkış anlamına gelmiyor.`
    : 'Bu giriş ile cezaevinden çıkış arasında açık kurumda geçirilecek ek süre oluşmuyor. Sıfır gün, ayrıca bir açık kurum dönemi olmadığı anlamına gelir.';
  const dsMetin = gercekDS
    ? `${tr(o.tarihler.cikis)} tarihinde cezaevinden çıkış, ${tr(o.tarihler.ks)} tarihinde koşullu salıverilme hesaplandı. Bu iki tarih arasındaki ${o.ds} gün denetimli serbestliktir; oran hesabıyla bulunan toplam KS süresi değildir.`
    : `Bu senaryoda cezaevinden çıkıştan önce yarar sağlayan bir DS dönemi oluşmuyor. Çıkış ${t.kosullu_saliverilme ? 'koşullu salıverilme' : 'uygulanan infaz sınırı'} esasına göre ${tr(o.tarihler.cikis)}.`;

  const acikSartlar = acik?.kapali?.gecici10 ? acik.kapali.gecici10.kalemler : acik?.kapali?.kalemler;
  const acikParagraflar = [kapaliMetin, acikMetin];
  if (acik?.dogrudan?.neden) acikParagraflar.push(acik.dogrudan.neden);
  if (acik?.kapali?.gecici10) acikParagraflar.push(`Geçici 10/6 erken açığa ayrılma şartları daha erken tarih verdi. Olağan açığa ayrılma ${tr(acik.kapali.normal_tarih)}, kullanılan tarih ${tr(acik.tarih)}. Bu değişiklik KS tarihini değiştirmez.`);
  if (acik?.yol === 'yasak') acikParagraflar.push(...acik.yasaklar.map((y) => y.neden));

  const dsParagraflar = [dsMetin, dsYolu
    ? `Seçilen yol: ${dsYolu.ad}. Aynı yolun bütün tarih şartları birlikte sağlanmalıdır; bu nedenle aşağıdaki tarihlerden en geç olanı esas alınır. Ardından diğer uygun yollarla karşılaştırılıp en erken yararlı sonuç seçilir.`
    : 'Uygun ve yararlı bir DS yolu seçilmedi. Uygulanmayan yolların gerekçeleri aşağıda ayrı gösterilir.'];
  if (dsYolu && !gercekDS) dsParagraflar.push('Seçilen yol ek bir DS günü sağlamadı; DS süresi 0 gün. Çıkış tarihi KS tarihini geçemez.');
  if (S.asgari_kurum?.uygulanir) dsParagraflar.push(`105/A asgari kurum eşiği bu suç tarihinde uygulanıyor: ${S.asgari_kurum.gun} gün, hesap eşiği ${tr(S.asgari_kurum.tarih)}. Bu, ayrıca cezaya eklenen gün değildir; ilgili DS yollarının tarih şartıdır.`);
  else if (S.asgari_kurum) dsParagraflar.push('Suç tarihi nedeniyle 105/A’daki onda bir ve en az 5 gün eşiği bu hesapta uygulanmadı.');
  if (dsYolu?.id === 'gecici10_6') dsParagraflar.push('Geçici 10/6’da normal DS tarihinden 3 yıl erken yararlanma tek başına çıkış tarihi değildir. En az 3 ay açık kurum ve yürürlük eşiği de birlikte kontrol edildi. 3 ay açık şartı diğer DS yollarına taşınmaz.');
  const birlesimNotu = S.notlar.find((n) => n.kod === 'R133');
  if (birlesimNotu) dsParagraflar.push(birlesimNotu.mesaj);
  if (o.talepsiz) dsParagraflar.push(`Ana hesapta DS talebi var kabul edildi. Talep olmazsa çıkış ${tr(o.talepsiz.cikis)}, cezaevinde ${o.talepsiz.icerde} gün (${o.talepsiz.kapali} kapalı + ${o.talepsiz.acik} açık). Açığa erken ayrılma hesabı talep olmadığı için kaldırılmaz.`);

  const ksParagraflar = oranIz.map((i) => i.aciklama.replace(/\s*\(D\d+\)/g, ''));
  if (S.ks_gun !== null) ksParagraflar.push(`KS için hesaplanan süre ${ondalik(S.ks_ham_gun)} gün; gün artığı ${profil.gun_kusurati === 'asagi' ? 'aşağı' : 'yukarı'} yuvarlanarak ${S.ks_gun} gün alındı. Mahsup ve varsa çocukta gün ağırlığıyla takvime işlendi. Gösterilen KS tarihi ${tr(t.kosullu_saliverilme)}.`);
  if (!t.kosullu_saliverilme) ksParagraflar.push('Bu ceza yolunda koşullu salıverilme tarihi oluşturulmadı. Süreli hapis oranı veya olağan DS uygulanmış gibi gösterilmez.');
  else ksParagraflar.push('KS oranı, iyi hâlle koşullu salıverilmeye kadar infaz edilmesi gereken süreyi belirler. Kapalı/açık ayrımı ve DS’ye çıkış tarihi sonraki adımlarda ayrıca hesaplanır.');

  const kabuller = tekil([
    ...(o.varsayimlar || []), ...S.varsayimlar.map((v) => v.mesaj),
    ...S.notlar.filter((n) => n.seviye === 'varsayim').map((n) => n.mesaj),
  ]);
  const adimlar = [
    { id: 'veriler', baslik: 'Hangi bilgilerle hesaplandı?', ozet: `${ceza} · ${o.baslik}`, paragraflar: cezaIz.map((i) => i.aciklama), satirlar: bilgiler, kaynaklar: kaynaklar(kt, cezaIz.flatMap((i) => i.kurallar)) },
    { id: 'mahsup', baslik: 'Mahsup tarihlere nasıl yansıdı?', ozet: `${t.mahsup_gun} gün mahsup`, paragraflar: [
      t.mahsup_gun ? `${tr(t.infaza_baslama)} girişinden ${t.mahsup_gun} gün geriye gidilerek ${tr(t.etkin_baslangic)} etkin hesap başlangıcı kullanıldı. Bu, kişinin o tarihte fiilen cezaevine girdiği anlamına gelmez. Gösterilen kapalı ve açık günleri bu girişten sonra kalan günlerdir.` : 'Hesaba düşülecek bir mahsup günü eklenmedi. Etkin hesap başlangıcı giriş tarihiyle aynı.',
      ...(mahsup.kalemler.length ? [`Kayıtlar kabul oranlarıyla önce toplanır: ${ondalik(mahsup.ham)} gün → ${mahsup.gun} gün. Tarih aralığı kullanıldığında başlangıç ve bitiş günleri dahildir; kurumda kalış ise iki tarih arasındaki gün farkıdır.`] : []),
    ], satirlar: mahsup.kalemler.map((k) => ({ etiket: k.etiket, deger: `${k.gun} gün × ${kesir(k.oran)} = ${ondalik(k.kabul)} gün` })), kaynaklar: kaynaklar(kt, mahsup.kalemler.length ? ['R004', 'R003', ...(mahsup.kalemler.some((k) => k.tur === 'denetimli_serbestlik') ? ['R040'] : [])] : []) },
    { id: 'oran', baslik: 'Koşullu salıverilme nasıl bulundu?', ozet: t.kosullu_saliverilme ? `${S.oran ? kesir(S.oran) + ' oran · ' : ''}${tr(t.kosullu_saliverilme)}` : 'Bu yolda KS uygulanmıyor', paragraflar: ksParagraflar, kaynaklar: kaynaklar(kt, [...oranIz.flatMap((i) => i.kurallar), ksKural, ...(S.ks_gun !== null ? ['R003'] : [])]) },
    { id: 'kurum', baslik: 'Neden bu kadar kapalı ve açık?', ozet: `${o.kapali} gün kapalı + ${o.acik} gün açık`, paragraflar: acikParagraflar, sartlar: sartlar(acikSartlar, acik?.tarih), islem: `${o.kapali} gün kapalı + ${o.acik} gün açık = ${o.icerde} gün cezaevinde`, kaynaklar: kaynaklar(kt, tekil([...(acikSartlar || []).map((k) => k.kural), ...(acik?.yol === 'dogrudan' || S.yol === 'para_hapis' || S.yol === 'cek_5_11' ? ['R060'] : []), ...(acik?.yasaklar || []).map((y) => y.kural), ...(acik?.kapali?.gecici10 ? ['R130', 'R131'] : [])])) },
    { id: 'ds', baslik: 'Çıkış tarihini hangi şart belirledi?', ozet: `${tr(o.tarihler.cikis)} · ${o.ds} gün DS`, paragraflar: dsParagraflar, sartlar: sartlar(dsYolu?.kalemler, dsYolu?.tarih), islem: gercekDS ? `${tr(o.tarihler.ks)} − ${tr(o.tarihler.cikis)} = ${o.ds} gün denetimli serbestlik` : null, yollar: S.ds_yollari.map((y) => ({ id: y.id, ad: y.ad, tarih: y.tarih, secili: y.id === S.secilen_ds_yolu, durum: y.id === S.secilen_ds_yolu ? 'Seçilen yol' : y.uygun === true && !y.yarar_yok ? 'Diğer uygun yol' : y.uygun === null ? 'Belirsiz' : 'Uygulanmadı', neden: yolNedeni(y, S), kural: y.kural })), kaynaklar: kaynaklar(kt, [dsYolu?.kural, ...(S.asgari_kurum ? ['R042'] : []), ...(dsYolu?.id === 'gecici10_6' ? ['R132', 'R133', 'R134'] : [])]) },
    { id: 'kabuller', baslik: 'Sonuç hangi kabullere bağlı?', ozet: `${S.gerekli_kararlar.length} karar koşulu · ${kabuller.length} kabul / bilinmeyen`, paragraflar: [
      'İyi hâl ve gerekli kurum/hâkimlik kararlarının olumlu olması üzerinden hesap yapıldı. Tarihler otomatik veya koşulsuz tahliye taahhüdü değildir.',
      `Takvim yöntemi: yıl resmî takvimle, ceza ayı 30 günle hesaplanır. Kurum ayı ${profil.kurum_ayi === '30_gun' ? '30 gün' : 'takvim ayı'}; kesirli gün ${profil.gun_kusurati === 'asagi' ? 'aşağı' : 'yukarı'} yuvarlanır. Yaklaşık yıl/ay etiketleri yalnız okumayı kolaylaştırır; hesap gün ve tarih üzerinden yapılır.`,
      `Mahsup edilen günler ${profil.mahsup_kurumda_gecmis_sayilir ? 'bu profilde kurumda geçmiş kabul edilerek KS, asgari kurum ve açığa ayrılma eşiklerine sayılır' : 'bu profilde asgari kurumda geçmiş kabul edilmez'}. Takvim ve mahsup bileşimleri, kural tabanında gerçek müddetnamelerle kabul testi bekleyen A01 profilindedir.`,
    ], kabuller, kararlar: S.gerekli_kararlar, satirlar: [{ etiket: 'Hesap tarihi', deger: tr(c.hesap_tarihi) }, { etiket: 'Kural paketi', deger: c.paket_surumu }, { etiket: 'Hesap profili', deger: c.hesap_profili_id }], kaynaklar: kaynaklar(kt, S.gerekli_kararlar.map((k) => k.kural)) },
  ];
  return { yol: gercekDS ? dsYolu?.ad || 'Denetimli serbestlik' : t.kosullu_saliverilme ? 'Koşullu salıverilme ile çıkış' : 'DS ve KS uygulanmayan infaz', adimlar, fazlar: { kapali: { metin: kapaliMetin, adim: 'kurum' }, acik: { metin: acikMetin, adim: 'kurum' }, ds: { metin: dsMetin, adim: 'ds' } } };
}

export function gerekceMetni(o) {
  if (o.durum !== 'tamam' || !o.gerekce) return o.mesaj || '';
  const satirlar = [`İnfaz hesabının gerekçesi · ${o.baslik}`, `Uygulanan yol: ${o.gerekce.yol}`];
  for (const [i, a] of o.gerekce.adimlar.entries()) {
    satirlar.push('', `${i + 1}. ${a.baslik}`, a.ozet, ...a.paragraflar);
    for (const r of a.satirlar || []) satirlar.push(`${r.etiket}: ${r.deger}`);
    for (const r of a.sartlar || []) satirlar.push(`${r.ad}: ${tr(r.tarih)}${r.belirleyici ? ' · belirleyici eşik' : ''}`);
    if (a.islem) satirlar.push(a.islem);
    for (const y of a.yollar || []) satirlar.push(`${y.ad}: ${y.durum}${y.tarih ? ' · ' + tr(y.tarih) : ''}. ${y.neden}`);
    for (const k of a.kabuller || []) satirlar.push(`Kabul / bilinmeyen: ${k}`);
    for (const k of a.kararlar || []) satirlar.push(`Gerekli karar: ${k.metin}`);
    for (const k of a.kaynaklar) satirlar.push(`Dayanak ${k.id}: ${k.ad}. ${k.ozet}`);
  }
  for (const not of o.dikkat || []) satirlar.push(`İnceleme notu: ${not}`);
  satirlar.push('', 'Ön değerlendirmedir; resmî müddetnamenin yerine geçmez.');
  return satirlar.join('\n');
}

# Mimari

Bu belge, İnfaz & Tekerrür Hesabı eklentisinin yapısını, tasarım kararlarını ve
genişletme yollarını anlatır. Hedef: hukuki mantığın **veride**, hesap mantığının
**saf ve test edilebilir bir çekirdekte**, gösterimin **ince bir arayüzde** durması.

## 1. Tasarım ilkeleri

| İlke | Uygulama |
|---|---|
| **Tek doğruluk kaynağı** | `kaynak/kural_tabani.json` (0.4.0-gecici10-butunlesik, ~5 MB). Oranlar, süreler, tarih eşikleri, istisna listeleri ve karar koşulları buradan okunur; kodda hukuki sayı sabiti yoktur. |
| **Hukuk mantığı veride** | Suç kapsamları ve kapılar `infaz-kosul 1.0` diliyle yazılmış 48 karar düğümü ve 9 seçicidir. Motor bu ifadeleri yorumlar; `eval`/`Function` kullanılmaz. |
| **Üç değerli mantık** | Bilinmeyen alan `null` kalır, `false` sayılmaz (güçlü Kleene). Tip uyuşmazlığı belirsizdir ve veri hatası olarak kaydedilir. |
| **Varsayımlar açık** | Varsayımlı senaryo iki katmanla üretilir: belgeli bağlam (yalnız girilen bilgi) + kayda geçen "olağan dosya" varsayımları. Hâlâ belirsiz kalan düğüm hükümlü aleyhine çözülür ve sonuç **en çok** diye işaretlenir. |
| **Kesin sonuç iddiası yok** | Durum makinesi yalnız `eksik_veri`, `hukuki_inceleme_gerekli` ve `varsayimli_senaryo` üretir. Karar gerektiren her şey (iyi hâl, açığa ayırma, DS, KS) "gerekli kararlar" listesine yazılır, gerçekleşmiş sayılmaz. |
| **İzlenebilirlik** | Her sayı → hesap izi → kural (R…) → karar düğümü (D…) → kanıt (R…:K…) → madde (U03:govde:105/A) → tam metin. Kanıt metninin SHA-256 özeti derlemede ve tarayıcıda yeniden doğrulanır. |
| **Belirlenimcilik ve sürümleme** | Çekirdek saftır: aynı paket + vaka + hesap tarihi → aynı çıktı. Çıktı, veri paketinin SHA-256 özetini ve hesap profili kimliğini taşır. |
| **Gizlilik** | Hesap yerel; ağ isteği yok. Manifest yalnız `storage` izni ister, CSP `script-src 'self'`. |

## 2. Katmanlar

```
 kaynak/kural_tabani.json                        tek doğruluk kaynağı
        │  scripts/veri-derle.mjs  (doğrula → türet → böl)
        ▼
 extension/veri/paket.json         350 KB        kurallar, düğümler, seçiciler, kanıt kayıtları, TCK yapısı
 extension/veri/metin/U01…U13.json 2,4 MB        madde dizini, dipnot, değişiklik işaretleri, kanıt metinleri (tembel)
        │
        ▼
 extension/cekirdek/   saf ES modülleri (DOM ve chrome API'si yok; Node'da test edilir)
   dil/       infaz-kosul 1.0 yorumlayıcısı, yapısal + anlamsal ifade doğrulaması
   bilgi/     KuralTabani (dizinli depo), MevzuatDeposu (tembel tam metin, kanıt, arama)
   baglam/    vaka normalleştirme → karar bağlamı, türetilen alanlar, olağan varsayımlar
   karar/     KararMotoru: düğüm değerlendirme, ihtiyat yönü tablosu, koşul izi
   zaman/     rasyonel sayı, takvim, hesap profili (A01)
   hesap/     oran · mahsup · çocuk gün ağırlığı · açık kurum · DS yolları · senaryo · usul süreleri
   toplama/   birden çok ilamın toplanması (5275 m.99, 101/2, 107/3-4): ilam başına oran, ortak takvim
   tekerrur/  önceki ilam başına D100-D106 değerlendirmesi, aday derece, 108/2 tabanı
   cek/       5941: rejim seçimi, m.6 ödeme/vazgeçme, geçici m.5
   belge/     belge okuyucu: metin normalleştirme, içtima kararı, müddetname, gerekçeli karar, UDF (ZIP)
   cikti/     çıktı modeli, durum makinesi, notlar, düz metin özet
        │  index.js (tek genel API)
        ▼
 extension/ui/         ince arayüz (bkz. §2.1)
 extension/popup.html  bölümler: Hesap · Mevzuat · Süreler (telefonda alt menü)
```

Bağımlılık yönü tek yönlüdür: `ui → cekirdek/index.js → alt modüller → zaman/dil`.
Çekirdek arayüzü bilmez; arayüz hukuki karar vermez.

### 2.1 Arayüz katmanı

| Modül | Görev | DOM |
|---|---|---|
| `ui/dosya.js` | Avukatın cevapları ("dosya", sürüm 4) → kanonik vaka. Dosya = kişi düzeyi alanlar + `ilamlar` listesi; tek ilamlı hesap tek elemanlı listedir. İyi hâl ve DS talebi açıkça var; kast, terör (3713 m.3) ve örgüt kurma/üyelik (220, 314) maddeden türetilir, avukatın seçimi önce gelir. 01/06/2005 öncesi (herhangi bir ilamda) kapsam dışı. Sürüm 3 kaydı yüklenirken çevrilir. | yok |
| `ui/sorular.js` | Temel sorular sırayla; ek sorular yalnız sonucu değiştirdiğinde. Ek soru için çekirdeğin belgeli bağlamda belirsiz dediği alanlara bakılır (toplamada ilgili ilamın alanları), her cevap seçeneği ayrı hesaplanır, kapalı/açık/çıkış/KS imzası değişiyorsa soru sorulur. "Bilmiyorum" alanı boş bırakır; çekirdek olağan varsayımı veya ihtiyat çözümünü uygular. | yok |
| `ui/belge-aktar.js` | Belge okuma sonucu → dosya. "Yeni" kipi dosyayı belgeden kurar; "birleştir" kipi ilamları infaz no ya da esas+karar no ile (gerekirse ceza miktarıyla) eşler ve yalnız boş alanları doldurur. Her aktarım değişiklik satırı olarak döner. | yok |
| `ui/ozet.js` | Seçili senaryonun takviminden kapalı / açık / DS günleri, zaman çizelgesi, nedenler (kural → madde bağlantısı), karşılaştırma ya da ilam dökümü ve paylaşım metni. | yok |
| `ui/gerekce.js` | Altı adımlı gerekçe; toplamada veriler ve KS adımı ilam dökümüyle. | yok |
| `ui/ekran.js` | Belge paneli, cevap kutucukları (ilam grupları), soru kartı ve sonuç çizimi. | var |
| `ui/uygulama.js` | Durum, olaylar, kalıcı kayıt (`chrome.storage` yoksa `localStorage`). Belge metni kaydedilmez. | var |

**İlam görünümü.** Soru tanımları tek bir ilam üzerinde yazılmıştır (`d.suc_tarihi`, `d.konum`,
`d.ek.yas`). `ilamGorunumu(dosya, i)` bir Proxy'dir: ilam alanlarını (suç tarihi, ceza, suç,
tekerrür, mahsup, mağdur gibi ilama özgü ek cevaplar) `dosya.ilamlar[i]`'ye, kişi alanlarını
(konum, giriş, yaş, doğum, rapor) dosyaya yönlendirir; `bilinmiyor` listesi okunurken birleşir,
yazılırken soru kapsamına göre bölünür. Böylece aynı soru tanımı her ilam için çalışır.
Ekrandaki soru bir **soru örneği**dir: `{ s: soru, i: ilam sırası | null, g: görünüm }`.
Tek ilamda sıra Faz 1 ile aynıdır; birden çok ilamda önce kişi ve giriş, sonra her ilamın
suç tarihi → ceza → suç → tekerrür → (önceki ceza) → mahsup soruları gelir.

**Belge okuyucu** (`cekirdek/belge/`). Metin NFC'ye çevrilir, satır sonları ve boşluklar
düzenlenir; eşleştirme aynı uzunluktaki ASCII büyük harf "arama kopyası" üzerinde yapılır,
bulunan aralık özgün metinden kesilir (her değer kaynak satırıyla döner, T.C. kimlik no
maskelenir). Belge türü imzalarla belirlenir: içtima kararı ("İÇTİMASINA", numaralı
"1) …" satırları), müddetname (başlık ya da en az iki infaz tarihi etiketi), gerekçeli karar
("CEZALANDIRILMASINA", "HÜKÜM:"). İçtima kararında her numaralı satır bir ilamdır: mahkeme,
hüküm tarihi, esas/karar no, ceza ve parantezdeki infaz no; karardaki toplamla ilam
cezalarının bileşen toplamı (yıl, ay, gün ayrı) karşılaştırılır. Müddetnamede etiket eş
anlamlıları aranır (açığa ayrılma, DS, KS, hak ederek tahliye, yakalama/infaza başlama) ve
gözaltı/tutukluluk/konutu terk etmeme/kullanılan DS satırları aralık ya da gün olarak okunur.
TCK maddelerinden yalnız özel hüküm maddeleri (m.76 ve sonrası) suç önerisidir. UDF, ZIP
içindeki `content.xml`'dir; `DecompressionStream('deflate-raw')` ile açılır, CDATA metni
alınır. PDF okunmaz (metnin yapıştırılması istenir). Okunamayan alan boş kalır ve sorulur;
tahminle doldurulmaz.

**Müddetname tarihleri** karşılaştırmaya yalnız müddetname bütün dosyaya aitse aktarılır:
dosyada tek ilam varsa ya da müddetnamedeki ceza ilam cezalarının toplamına eşitse. Toplanan
cezalarda tek ilamın müddetnamesi (o ilamın KS ve tahliye tarihleri) uyarıyla dışarıda kalır.

Mahsup kayıtları (`dosya.mahsup`) gün ya da tarih aralığıdır; çekirdek aralığı iki uç dahil
sayar, çakışmayı denetler (V08) ve konutu terk etmemeyi 2:1 uygular. Bu ilamda kullanılan
denetimli serbestlik `denetimli_serbestlik` türüyle infazdan sayılır ve açık kurum planı
"DS'den dönüş: açıkta devam" (105/A/6-7) olur. Müddetname karşılaştırması (`ozet.js →
muddetnameKarsilastir`) hesap tarihleriyle girilen tarihleri gün farkıyla gösterir.

Kapalı gün = giriş → açığa geçiş, açık gün = açığa geçiş → kurumdan çıkış; ikisinin
toplamı çekirdeğin `kurumda_kalis_gun` değerine eşittir. Açığa geçiş çıkıştan sonraysa
(ör. geçici 6/1 ile kapalıdan DS) bütün süre kapalıda sayılır.

## 3. Veri derleme hattı (`npm run veri`)

1. **Doğrulama** (hata varsa derleme durur): kimlik tekilliği; kural → kaynak/düğüm/kanıt/madde,
   düğüm → kural, seçici → kural atıfları; bütün koşul ifadelerinin şema ve alan sözlüğü
   uyumu; 13 tam metnin ve 180 kanıt aralığının SHA-256 özetleri.
2. **Türetme**: TCK kitap/kısım/bölüm konumları tam metindeki başlıklardan çıkarılır
   (SC04-SC07 seçicilerinin `ilam.kitap/kisim/bolum` alanları için).
3. **Bölme**: çalışma paketi + kanun başına metin dosyaları. Çıktı belirlenimcidir;
   `tests/veri.test.js` paketlerin kaynakla birebir güncel olduğunu denetler.

## 4. Hesap akışı (senaryo başına)

Vakada birden çok ilam varsa `toplama/toplama.js` devreye girer (§4.2); tek ilamda aşağıdaki
akış üç senaryo için çalışır.

`hesapla(kt, vaka)` üç senaryoyu (tekerrürsüz / birinci / ikinci) bağımsız hesaplar.
Sıra, kural tabanındaki `uygulama_sirasi` ile aynıdır:

1. **Bağlam**: belgeli bağlam + olağan varsayımlar (`OLAGAN_VARSAYIMLAR`).
2. **Ceza yolu**: özel cezalar (D005), çocuk adli parası (D004), para-hapis ve çek m.5/11 (D001/D002).
3. **KS engelleri**: kanuni/özel yasak (D018; 107/16, 3713 m.17 türetilir), geri alma (107/13).
4. **KS süresi**: oran adayları D010-D014, D017 (yoksa R020 1/2); tekerrürde D015/D016,
   ilk tekerrürde 108/2 tavanı (önceki ilamlardan otomatik). Müebbette kanuni süre kategorileri.
5. **Çocukta gün ağırlığı**: geçici 6/4 veya 107/5 (2026, SC09 istisnası).
6. **Açık kurum**: doğrudan (D030/D031, D034) · kapalıdan açığa (Yönetmelik m.6: D032/D033,
   KS'ye 7 yıl, D035/D036 özel eşikler, yüksek güvenlik) · yasak (Yönetmelik m.8).
7. **DS yolları**: 105/A-1, 105/A-3-a/b (D020-D022, aday tarihte kapı kabulüyle),
   geçici 6/1, 6/2-a/b (kapalıda da), asgari kurum süresi (D025) ve geçici 10/6 (D024).
   En erken uygun yol seçilir. Hükümlü DS talep etmezse hiçbir yol uygulanmaz; arayüz
   talepsiz hâli ayrıca hesaplayıp gösterir.

### 4.1 Geçici 10/6 (31/07/2023 ve öncesi suçlar; 7571 m.27, yürürlük 25/12/2025)

Kapsam D024'tür: suç tarihi ≤ 31/07/2023, SC06 istisnası yok, hesap tarihi ≥ 25/12/2025.
Ayrıntılı kurallar R130-R135'tedir. D060-D065 anlık durum düğümleri (bugün sağlanıyor mu?)
olduğundan zaman çizelgesi aynı formülle kurulur (`gecici_10_6_modulu.tarih_formulleri`):

* **Erken açık** (`hesap/acik-kurum.js`): max(25/12/2025, kapalıda 1 ay ya da 10 yıl ve
  üzeri/müebbette 3 ay, normal açığa ayrılmadan 3 yıl önce). Normal tarihten erkense açığa
  geçiş tarihi olur. Talebe bağlı değildir.
* **Erken DS** (`hesap/ds.js`): max(25/12/2025, açıkta 3 ayın tamamlanması, normal DS
  tarihinden 3 yıl önce). Normal DS tarihi kişinin hukuken geçerli pencereli yolundan
  alınır (`tarih_formulleri.normal_DS_tarihi`; 10/6'daki "ilgili mevzuat uyarınca"):
  105/A/1, 105/A/3-a/b ve 30/03/2020 öncesi suçta geçici 6/1 (3 yıl) ya da 6/2-a (4 yıl).
  Böylece 6/1 ile 10/6 birlikte uygulanır (3 + 3 = KS'ye 6 yıl); seçilen dayanak
  `dayanak_yol`, toplam pencere `toplam_pencere_yil` olarak kaydedilir ve gerekçede
  yazılır. Toplamada belirleyici (en geç) ilamın dayanağı esas alınır. Olağan yol daha
  erkense olağan yol seçilir (R134). KS tarihi değişmez.
8. **Takvim ve durum**: kurumdan çıkış, KS, hak ederek tahliye, 107/6 denetim bitişi;
   gerekli kararlar; notların seviyesinden durum.

Tekerrür tespiti (`tekerrur/tespit.js`) senaryolardan bağımsızdır; seçili senaryo önce
hükümdeki tekerrürden, yoksa belgelerden belirlenen adaydan seçilir.

### 4.2 Cezaların toplanması (5275 m.99, 101/2, 107/3-4; R005, R031)

Çıktıda tek senaryo vardır: `birlesik`. Her ilam kendi rejimini korur (R005):

1. **İlam başına değerlendirme**: ilamın kendi bağlamı (suç tarihi, madde, tekerrür, 108/2
   için `tekerrure_esas_en_agir_ceza`) ile KS oranı; para-hapis ilamı oran 1 (106/9) ve DS'yi
   kapatır; tazyik/disiplin hapsi (D005) ve KS yasağı/geri alma (D018) toplamayı durdurur.
2. **KS süresi**: ilam paylarının (gün × oran) toplamı; 107/3-e (28 yıl), örgüt/tekerrürde
   107/4-e ve 108/1-c (32 yıl) tavanı. Bihakkın tarih yıl/ay/gün bileşenlerinin toplamıyla.
3. **Açık kurum**: bir ilamda yasak varsa yasak; hepsi doğrudansa doğrudan; aksi hâlde en
   kısıtlayıcı ilamın şartı (Yönetmelik m.6/3; en geç normal tarih).
4. **DS yolları**: bir yol yalnız bütün ilamlar için uygunsa uygulanır (Kleene VE); karma
   rejimde inceleme notu. Asgari kurum süresi yalnız 04/06/2025 sonrası ilamların payından.
5. **Takvim**: tek ilamdaki DS seçimi ve takvim kurulumu (`hesap/senaryo.js →
   dsSecVeTakvimKur`) aynen kullanılır.

Müebbet içeren toplama ve toplamada çocuk gün ağırlığı desteklenmez: müebbet reddedilir,
çocukta ağırlık uygulanmaz ve sonuç "en çok" işaretlenir.

## 5. Varsayım ve ihtiyat politikası

* **Olağan varsayımlar** yalnız `null` alanlara uygulanır ve her biri çıktıda listelenir
  (terör/örgüt değil, yetişkin, kasıtlı, iyi hâl ve DS talebi var, özel yasak yok…).
* **İhtiyat yönü** (`karar/motor.js → IHTIYAT_YONU`): olağan varsayımlardan sonra hâlâ
  belirsiz kalan düğüm, grubuna göre hükümlü aleyhine çözülür (ör. fıkrası bilinmeyen
  TCK 102'de 3/4 oranı; belirsiz DS yolu uygulanmaz). Sonuç "en çok" olarak işaretlenir.
* **Belirsiz koşullar**: belgeli bağlamda sonucu belirsiz bırakan alanlar arayüzde
  sırayla sorulan ek soruların adayıdır; yalnız sonucu değiştirenler sorulur (§2.1).

## 6. Hesap profili (A01)

Kesirli gün yönü ve yönetmelikteki "ay" yöntemi kural tabanında kabul testine bırakılmıştır.
Bu seçimler `zaman/profil.js` içinde adlandırılmış bir profilde toplanır ve her çıktıda
`hesap_profili_id` olarak saklanır. Arayüz varsayılan profili kullanır.

## 7. Test stratejisi (`npm test`, 309 test)

| Katman | Dosya | Kapsam |
|---|---|---|
| Dil uyumu | `tests/dil.test.js` | Kural tabanındaki 162 mantık testi (M001-M125, G10_001-G10_037), Kleene tabloları, tip ve güvenlik |
| Veri | `tests/veri.test.js` | Kaynak doğrulaması, paket güncelliği, SHA-256, TCK yapısı, madde çözümleme |
| Kabul | `tests/kabul.test.js` | 57 kabul senaryosu (K01-K57) |
| Hesap | `tests/hesap.test.js` | Sayısal sonuçlar, dallar, profil, belirlenimcilik, politika ızgarası (672 vaka) |
| Toplama | `tests/toplama.test.js` | İlam başına oran, pay toplamı, 107/3-4 tavanı, para-hapis, engeller, karma DS rejimi |
| Belge | `tests/belge.test.js` | Arama kopyası, ceza/tarih desenleri, içtima kararı, müddetname, gerekçeli karar, UDF/HTML/PDF |
| Arayüz | `tests/arayuz.test.js` | Dosya → vaka, soru sırası, sonucu değiştiren soru seçimi, sonuç özeti, paylaşım metni, sürüm 3 → 4 göçü |
| Çok ilam | `tests/coklu.test.js` | Belge aktarımı (yeni/birleştir, eşleştirme, avukat cevabının korunması), ilam başına soru sırası, ilam görünümü, toplama özeti, kayıt/yükleme |
| Uçtan uca | `scripts/e2e.mjs` | Gerçek Chromium'da telefon (390×844), açılır pencere (400px) ve masaüstü: adım adım soru akışı, sonuç, neden ve madde, kanıt doğrulama, süreler, kayıt, karanlık tema; içtima kararı yapıştırma, müddetname `.udf` yükleme, 6 ilamın soruları, ekrandaki sonucun Node modeliyle eşitliği, ilam ekleme/çıkarma |

Belge testlerindeki örnek belgeler (`tests/belgeler/`) anonimleştirilmiştir; gerçek kişi
bilgisi depoya konmaz.

## 8. Kural tabanını güncelleme

`kaynak_guncelleme_sozlesmesi` uyarınca:

1. Yeni nüshayı `kaynak/kural_tabani.json` olarak koyun.
2. `npm run veri` — doğrulama hatası varsa düzeltilmeden paket üretilmez.
3. `npm test` — değişen madde → kural → düğüm → senaryo etkisini testler gösterir.
4. Hukuki inceleme sonrası eklenti sürümünü artırın. Eski çıktılar kendi
   `veri_paketi_sha256` değerini taşıdığı için sessizce değişmez.

Yeni bir karar düğümü yalnız koşul ve sonuç adayı içeriyorsa kod değişmeden
değerlendirilir ve gerekçe tablosunda görünür; hesaba bağlanması için ilgili
`hesap/` modülüne tek bir okuma eklenir.

## 9. Bilinen sınırlar

Çıktıdaki `desteklenmeyen_dallar` listesi: müebbet içeren toplama ve toplamada çocuk gün
ağırlığı, infaz kesintileri (firar, izin, erteleme, başka tutuklama), 2005 öncesi dosyalar,
geçici 10/2, 7595 özel ertelemesi, disiplin/iyi hâl süreçleri, çek m.6 faiz tutarı. Bunlar
sonuçta açıkça gösterilir; sessizce varsayılmaz.

Belge okuyucu UYAP metin biçimlerine dayanır; biçimi çok farklı bir müddetname veya birden
çok ilamı tablo hâlinde listeleyen içtimalı müddetname kısmen okunabilir. Okunan her değer
önizlemede gösterilir ve onaysız aktarılmaz. Toplamada infaza başlama tek tarihtir; giriş
tarihinden sonra işlenmiş suç (cezaevinde suç) içeren dosya hesaplanmaz.

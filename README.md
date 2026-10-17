# İnfaz & Tekerrür Hesabı (Chrome eklentisi)

Suç tarihi ve hükümdeki cezayı girdiğiniz anda **tekerrürsüz**, **birinci tekerrür (mükerrir)** ve **ikinci tekerrür** için kurumda kalış süresini, koşullu salıverilme ve denetimli serbestlik tarihlerini yan yana gösterir. Her sayının hangi kanun maddesine ve hangi kurala dayandığı, hangi varsayımla üretildiği ve hangi konuların hukuki inceleme gerektirdiği sonuçla birlikte verilir.

Bütün sayısal değerler (oranlar, süreler, tarih eşikleri, istisna suç katalogları) `extension/data/kural_tabani.json` dosyasından okunur (*Infaz_Mevzuat_Kural_Tabani 0.1.0-arastirma*, 51 kural, 27 kaynak). Hesap tamamen tarayıcıda yapılır, hiçbir veri dışarı gönderilmez.

> **Hukuki sınır:** Kural tabanının hesap politikası gereği araç yalnız `varsayimli_senaryo`, `hukuki_inceleme_gerekli` ve `eksik_veri` sonuçlarını üretir. Kesin tahliye tarihi vermez. İyi hâl, açık kuruma ayrılma, infaz hâkimi kararı gibi karar gerektiren koşullar tarih hesabından türetilmez. Sonuç, resmî müddetnamenin yerine geçmez.

## Kurulum

1. Bu depoyu indirin (veya `npm run paketle` ile oluşan zip dosyasını açın).
2. Chrome'da `chrome://extensions` sayfasını açın, sağ üstten **Geliştirici modu**nu açın.
3. **Paketlenmemiş öğe yükle** düğmesine basın ve `extension` klasörünü seçin.
4. Araç çubuğundaki terazi simgesine tıklayın. Geniş görünüm için **Tam ekran** düğmesini kullanın.

## Kullanım

| Adım | Ne girilir | Ne değişir |
|---|---|---|
| Hızlı giriş | Suç tarihi, ceza (yıl/ay/gün) | Üç senaryo hemen hesaplanır (varsayımlı) |
| Suç maddesi | Örn. `TCK 188`, `87/2-d` | Özel oranlar (2/3, 3/4), geçici 6 ve 10/6 istisnaları, doğrudan açık kurum |
| Hükümdeki tekerrür | Yok / birinci / ikinci | İlgili senaryo seçilir; belgelerden tespitle karşılaştırılır |
| Dosya ayrıntıları | İnfaza başlama, mahsup, doğum tarihi, terör/örgüt, kadın 0-6 çocuk, ağır hastalık, 108/2 için önceki en ağır ceza… | Takvim tarihleri, çocuk oranları ve gün ağırlığı, özel DS pencereleri |
| Tekerrür tespiti | Önceki mahkûmiyetler | TCK 58'e göre her ilam tek tek sınanır, aday derece ve 108/2 üst sınırı çıkarılır |

Örnek (görseldeki iddia): 05/06/2025 tarihli suç, 1 yıl ceza → **18 / 24 / 27 gün**. Araç bu sayıları üretir, ancak:
- birinci tekerrürde 108/2 üst sınırı bilinmediği için **"en çok 24"**,
- ikinci tekerrürde doğrudan açık kuruma kabul yasak olduğu (5275 m.14/2-a) ve açık kuruma ayrılma süresi doğrulanmadığı için (Q01) **"en az 27 · hukuki inceleme gerekli"**

olarak gösterir.

## Hesaplanan kurallar

- **Süre birimi** (TCK 61/6, R003): yıl resmî takvim, ay 30 gün; oranlar rasyonel sayı olarak işlenir, yuvarlama tek adımda yapılır.
- **Temel koşullu salıverilme oranı**: genel 1/2 (R020); 107/2 suç grubu 2/3 (R021); 108/9 cinsel suç ve uyuşturucu ticareti 3/4 (R022), 28/06/2014 öncesinde 2/3 (R026); örgüt 2/3 (R023); terör 3/4, çocukta 2/3 (R024); çocukta sayılan suçlar 2/3 (R025).
- **Tekerrür**: birinci tekerrürde `min(max(temel, 2/3), temel + tekerrüre esas en ağır ceza)` (5275 m.108/1-2, R027); ikinci tekerrürde 3/4, 108/2 sınırı yok (7550 ile 108/3, R028); 04/06/2025 öncesi salıverilme yasağı tarihsel sürüm olarak (R029).
- **Tekerrür tespiti** (TCK 58, R010-R016): kesinleşme sırası, 3/5 yıllık tekerrür süresi, 18 yaş, kast/taksir, sırf askerî ve yabancı hüküm, HAGB ve CMK 272/3 engeli. Mahkûmiyet sayısı tek başına derece sayılmaz.
- **Denetimli serbestlik**: genel 1 yıl (R040); 0-6 yaş çocuklu kadın 2 yıl, ağır hasta 3 yıl (R041); 30/03/2020 ve öncesi suçta geçici 6/1 ile 3 yıl (R050) ve geçici 6/2 özel pencereleri (R051), ayrı istisna katalogları ile.
- **Asgari kurum süresi**: 04/06/2025 ve sonrası suçta `max(5 gün, KS süresi / 10)` (R042).
- **Geçici 10/6 yolu** (R055-R058): 31/07/2023 ve öncesi suçta, istisna kataloğu ve açık kurum şartlarıyla alternatif yol olarak.
- **Müebbet** (R030), **adli paradan çevrilen hapis** (R044), **koşullu salıverilmenin geri alınması** (R032, R074), **çocukta kurum günü ağırlığı** (R052, R053), **özel infaz olanakları** (R070, R071), **7595 tetikleyicisi** (R075).

Kapsam dışı / hukuki inceleme gerektirenler (kural tabanındaki açık konular): güncel Açık Kuruma Ayrılma Yönetmeliği süreleri (Q01), 5275 konsolide metni (Q02), kesirli gün uygulaması (Q03), mahsup–asgari süre etkileşimi (Q04), 2005 öncesi dosyalar (Q06), birden çok ilamın toplanması (Q10) vb. Bu konular sonuçta kod olarak gösterilir.

## Geliştirme

```sh
npm test          # 34 kabul senaryosu (K01-K34) + motor testleri
npm run paketle   # dist/infaz-tekerrur-hesabi-<sürüm>.zip
python3 scripts/ikon_uret.py   # simgeleri yeniden üretir (Pillow gerekir)
```

Bağımlılık yoktur; Node 18+ yeterlidir.

```
extension/
  manifest.json          Manifest V3, yalnız "storage" izni
  popup.html/css/js      Arayüz (açılır pencere ve tam ekran)
  engine/
    hesap.js             Senaryo hesabı, DS penceresi, açık kurum, geçici yollar
    tekerrur.js          TCK 58 aday tespiti
    katalog.js           Madde/fıkra/bent seçicileri (üç değerli eşleştirme)
    kurallar.js          Kural tabanına erişim, mevzuat etiketleri
    tarih.js, rasyonel.js
  data/
    kural_tabani.json    Mevzuat kural tabanı (tek veri kaynağı)
    tck_maddeleri.js     Formdaki madde başlıkları (yalnız gösterim)
tests/                   node:test
```

### Kural tabanını güncellemek

`extension/data/kural_tabani.json` yerine yeni sürümü koyun ve `npm test` çalıştırın. Motor, oranları ve tarihleri kural kimlikleriyle (`R020`, `R042` …) okur. Yeni bir kural eklendiğinde veya parametre adı değiştiğinde ilgili fonksiyon güncellenmelidir. Kural tabanı politikası gereği yeni metin, hukuki incelemeden sonra yayına alınmalıdır.

# Yatar Hesabı · İnfaz ve Tekerrür (Chrome eklentisi)

Müvekkile söylenecek cümleyi verir: **"Şu kadar gün kapalıda, şu kadar gün açıkta kalırsın, sonra şu kadar gün denetimli serbestlik."** Cezaevindeki, hüküm alıp henüz girmemiş ya da "şu kadar ceza alırsa" diye soran biri için çalışır. Sonuç, suç tarihine göre yürürlükteki kurallarla hesaplanır.

Araç eksik bilgiyi **sırayla, tek tek** sorar. Her soruda "Bilmiyorum" seçeneği vardır. Yalnız **sonucu değiştiren** ek sorular sorulur: 3 yıl 1 ay 15 gün nitelikli hırsızlıkta kast, örgüt ya da fıkra sorulmaz.

**Belgeden okuma (0.7):** İçtima (cezaların toplanması) kararı, müddetname veya gerekçeli kararın metni yapıştırılır ya da UYAP'tan indirilen `.udf` dosyası seçilir. İçtima kararındaki her ilam ayrı kayıt olur (mahkeme, esas/karar no, hüküm tarihi, ceza, infaz no); belgede olmayan bilgiler (suç tarihi, suç, tekerrür, gözaltı/tutukluluk) **her ilam için sırayla** sorulur. Ardından gelen müddetname infaz numarasıyla doğru ilama eşlenir ve suç tarihini, suçu, gözaltı/tutukluluk aralıklarını ve cezaevine giriş tarihini doldurur. Cezalar 5275 m.99'a göre toplanarak tek takvimde hesaplanır.

Hukuki içerik **İnfaz Mevzuat Kural Tabanı 0.4.0-gecici10-butunlesik** dosyasından gelir: 106 kural, 48 karar düğümü, 186 kaynak kanıtı ve 13 kanun/yönetmeliğin tam metni. Hesap cihazda yapılır; UYAP'tan veri çekilmez, hiçbir veri dışarı gönderilmez.

> **Hukuki sınır:** Tarihler iyi hâl şartıyla en erken tarihlerdir. Açığa ayrılma, DS ve koşullu salıverilme kararları gerçekleşmiş sayılmaz. Sonuç resmî müddetnamenin yerine geçmez. 01/06/2005 öncesi suçlar hesaplanmaz.

## Ekran

| Bölüm | İçerik |
|---|---|
| **Belgeden oku** | Metin yapıştırma veya `.udf`/`.txt`/`.html` dosyası. Önizlemede okunan ilamlar, karardaki toplamın ilam cezalarıyla uyuşup uyuşmadığı ve uyarılar görünür; onaylanmadan hiçbir şey hesaba aktarılmaz. **Mevcut dosyaya ekle** yalnız boş alanları doldurur, avukatın cevaplarını değiştirmez. Metin yalnız bellekte tutulur, kaydedilmez. |
| **Cevaplar** | Verilen cevaplar kutucuk olarak durur; dokununca o soru yeniden açılır. "Bilmiyorum" cevapları kesik çizgilidir. Birden çok ilamda her ilam katlanır bir gruptur (bekleyen soru sayısı veya ✓); ilam eklenebilir, iki dokunuşla çıkarılabilir. |
| **Soru kartı** | Sıradaki soru: kişinin durumu → suç tarihi → ceza → suç → tekerrür (1. tekerrürde önceki ceza) → giriş tarihi → mahsuplar → sonucu değiştiren ek sorular (fıkra, yaş, 0-6 yaş çocuklu kadın, sağlık raporu, mağdur…). Birden çok ilamda önce kişi ve giriş, sonra her ilamın soruları; kartın üstünde hangi ilamın sorulduğu yazar. Aynı hükümdeki ikinci ilamda suç tarihi tek dokunuşla önerilir; belgede geçen TCK maddeleri suç sorusunda öneri olarak çıkar. |
| **Mahsuplar (müddetname)** | Birden çok kayıt: gözaltı, tutukluluk, konutu terk etmeme (2 gün = 1 gün), kullanılan denetimli serbestlik. Her kayıt gün sayısı ya da tarih aralığıyla (iki uç dahil) girilir; çakışan aralıklar uyarılır. DS'den geri gönderilen hükümlü açık cezaevinde devam eder (105/A/6-7). |
| **Müddetname ile karşılaştır** | Müddetnamedeki açığa ayrılma, DS'ye ayrılma, koşullu salıverilme ve bihakkın tahliye tarihleri girilir; hesapla farkı gün olarak gösterilir. |
| **Sonuç** | Kapalı / açık / denetimli serbestlik gün sayıları, tarihli zaman çizelgesi (giriş → açığa geçiş → cezaevinden çıkış → koşullu salıverilme → ceza bitişi), tekerrürsüz / 1. / 2. tekerrür karşılaştırması (toplanan cezalarda **ilam dökümü**: ilam başına ceza, KS oranı ve payı), bilinmeyenler, hesabın adımları. Sayıya dokununca nedeni ve madde metni bağlantısı açılır. **Kopyala / Paylaş** müvekkile gönderilecek düz metni verir. |
| **Mevzuat** | 13 tam metinde madde/kelime arama; kural kanıtı (SHA-256 tarayıcıda doğrulanır); hesabın dayandığı kurallar. |
| **Süreler** | DS müdürlüğüne başvuru (5 gün), infaz işlemine şikâyet (15/30 gün), infaz hâkimliği kararına itiraz (2 hafta). |

Telefonda tek sütun ve alt menü, geniş ekranda soru solda sonuç sağda görünür. Karanlık tema sistem ayarını izler. Dosya cihazda saklanır; **Yeni** ile temizlenir.

## Örnek: 01/07/2025 · 3 yıl 1 ay 15 gün · TCK 142 · giriş 01/01/2026

| | Kapalı | Açık | DS | Cezaevinden çıkış |
|---|---|---|---|---|
| Tekerrürsüz | 30 gün | 175 gün | 365 gün | 25.07.2026 |

Zaman çizelgesi: 01.01.2026 giriş → 31.01.2026 açığa geçiş (Yönetmelik m.6/1-a, 1 ay) → 25.07.2026 DS ile çıkış (105/A-1, KS'ye 1 yıl) → 25.07.2027 koşullu salıverilme (1/2) → 15.02.2029 ceza bitişi.

### 31/07/2023 ve öncesi suçlar: geçici 10/6 (7571 m.27, yürürlük 25/12/2025)

Aynı dosya suç tarihi 01/01/2023 olursa:

| | Kapalı | Açık | DS | Cezaevinden çıkış |
|---|---|---|---|---|
| Talep ederse (ana sonuç) | 30 gün | 90 gün | 450 gün | 01.05.2026 |
| DS talep etmezse | 30 gün | 540 gün | — | 25.07.2027 (koşullu salıverilme) |

- **Erken açık:** kapalıda 1 ay (toplam ceza 10 yıl ve üzeri ya da müebbette 3 ay) ve normal açığa ayrılmaya 3 yıl veya az kalması.
- **Erken DS:** açıkta en az 3 ay ve normal DS tarihinden 3 yıl önce; hiçbir tarih 25/12/2025'ten önce olamaz.
- **Kapsam dışı (SC06):** TCK 82/1-d,e,f; deprem/yapı ölümleri; TCK 102, 103, 104/2-3; İkinci Kitap Dördüncü Kısım 4-7. bölümler; terör ve örgüt faaliyeti suçları.
- **Olağan yol daha erkense:** olağan yol seçilir; 3 ay şartı ona taşınmaz.
- **30/03/2020 öncesi suçlar:** 10/6, olağan 105/A tarihi üzerinden kurulur. Geçici 6 penceresiyle birlikte (3 + 3 yıl) uygulanması otomatik yapılmaz, "Dikkat edilmesi gerekenler" altında belirtilir.

DS talebi olağan kabul edilir. Talep olmazsa çıkış koşullu salıverilmede olur ve sonuç kartında ayrı satır olarak gösterilir.

## Örnek: içtima kararı + müddetname (6 ilam)

Diyarbakır 1. İnfaz Hâkimliği içtima kararı (6 ilam, toplam 11 yıl 25 ay 37 gün) yapıştırılır, 5. ilamın müddetnamesi `.udf` olarak seçilir. Müddetname 5. ilamın suç tarihini (03.02.2024), suçunu (TCK 86/2), gözaltı ve tutukluluk aralıklarını (48 gün) ve giriş tarihini (05.08.2025) doldurur. Diğer beş ilamın suç tarihi, suçu ve tekerrürü sorulur. Her ilamın KS payı kendi oranıyla bulunur ve toplanır (bu örnekte 2402 gün). Tek ilamın müddetnamesindeki KS ve tahliye tarihleri toplam hesapla karşılaştırılamayacağı için karşılaştırma tablosuna aktarılmaz; araç bunu uyarı olarak söyler.

Desteklenmeyen toplama hâlleri sessizce hesaplanmaz: müebbet içeren toplama, tazyik/disiplin hapsi, KS yasağı veya geri alma olan ilam, toplamada çocuk gün ağırlığı (en çok değer, inceleme notuyla).

## Kurulum

**Bilgisayar (Chrome):** `chrome://extensions` → Geliştirici modu → **Paketlenmemiş öğe yükle** → `extension` klasörü. Simgeye basınca açılır; **Tam sayfa** ile sekmede açılır.

**Telefon (Lemur Browser vb. eklenti destekleyen Chromium tarayıcılar):** `npm run paketle` ile oluşan `dist/…zip` dosyasını telefona aktarın, tarayıcının eklenti sayfasında geliştirici modunu açıp zip/klasörden yükleyin. Simgeye dokununca hesap tam sekmede açılır (dar açılır pencere kullanılmaz). Sayfa telefon ekranına göre tasarlanmıştır.

**Güncelleme:** Kayıtlı dosyanın korunması için eklentiyi kaldırmadan, aynı klasörün/zip'in yeni sürümüyle güncelleyin. 0.6 ve öncesinde kaydedilen tek ilamlı dosya ilk açılışta yeni biçime (sürüm 4, ilam listesi) kendiliğinden çevrilir.

## Mimari

Ayrıntılı tasarım: [docs/MIMARI.md](docs/MIMARI.md).

```
kaynak/kural_tabani.json ──(npm run veri: doğrula, türet, böl)──▶ extension/veri/
extension/cekirdek/   saf hesap çekirdeği: koşul dili · karar motoru · hesap · toplama · tekerrür · çek · belge okuyucu · çıktı
extension/ui/         dosya (cevaplar→vaka, ilam görünümü) · sorular (ilam başına sıra, sonucu değiştiren soru) · belge aktarımı · özet · ekran
tests/                dil (162) · veri · kabul (57) · hesap · toplama · belge · arayüz · çok ilam
scripts/              veri-derle.mjs · e2e.mjs · paketle.sh · ikon_uret.py
```

## Geliştirme

```sh
npm test              # 309 test: dil uyumu (162), veri bütünlüğü, 57 kabul senaryosu, hesap, toplama, belge okuyucu, arayüz modelleri
npm run veri          # kaynak kural tabanından çalışma paketlerini derler
npm run veri:kontrol  # paketlerin güncel olduğunu denetler
npm run e2e           # gerçek Chromium'da telefon ve masaüstü: soru akışı, belge yapıştırma, .udf yükleme, 6 ilamlı toplama
npm run paketle       # dist/infaz-tekerrur-hesabi-<sürüm>.zip
```

Çalışma zamanı bağımlılığı yoktur; Node 18+ yeterlidir.

### Kural tabanını güncellemek

Yeni nüshayı `kaynak/kural_tabani.json` olarak koyun, `npm run veri` ve `npm test` çalıştırın. Derleme; kimlik, atıf, koşul ifadesi ve kanıt özeti hatalarında durur.

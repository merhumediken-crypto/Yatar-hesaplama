# İnfaz & Tekerrür Hesabı (Chrome eklentisi)

Suç tarihi ve hükümdeki cezayı girdiğiniz anda **tekerrürsüz**, **birinci tekerrür (mükerrir)** ve **ikinci tekerrür** için kurumda kalış süresini, açık kuruma ayrılma, denetimli serbestlik, koşullu salıverilme ve hak ederek tahliye tarihlerini yan yana gösterir. Her sayının hangi karar düğümüne, kurala ve kanun maddesine dayandığı; hangi varsayımla üretildiği ve hangi kararların gerektiği sonuçla birlikte verilir. Kuralın dayandığı madde metni eklentinin içinde açılır ve SHA-256 özetiyle doğrulanır.

Hukuki içerik tamamen **İnfaz Mevzuat Kural Tabanı 0.3.0-karar-modelli** dosyasından gelir: 100 kural, 42 karar düğümü, 9 makine seçici, 180 kaynak kanıtı ve 13 kanun/yönetmeliğin tam metni (TCK, CMK, 5275, 3713, 4675, 5402, 5395, 5941 ve 5 yönetmelik). Hesap tarayıcıda yapılır; hiçbir veri dışarı gönderilmez.

> **Hukuki sınır:** Araç yalnız `varsayimli_senaryo`, `hukuki_inceleme_gerekli` ve `eksik_veri` sonuçlarını üretir; kesin tahliye tarihi vermez. İyi hâl, açık kuruma ayırma, DS ve koşullu salıverilme kararları gerçekleşmiş sayılmaz. Sonuç resmî müddetnamenin yerine geçmez.

## Kurulum

1. Depoyu indirin (veya `npm run paketle` ile oluşan zip'i açın).
2. Chrome'da `chrome://extensions` → sağ üstten **Geliştirici modu**.
3. **Paketlenmemiş öğe yükle** → `extension` klasörü.
4. Araç çubuğundaki terazi simgesi. Geniş görünüm için **Tam ekran**.

## Sekmeler

| Sekme | İçerik |
|---|---|
| **Hesap** | Hızlı giriş, üç senaryo kartı, "Sonucu kesinleştirmek için" eksik bilgi kısayolları, suç tarihine göre rejim, dosya ayrıntıları (mahsup türleri, kişi, suç niteliği, hesap profili), tekerrür tespiti, çek ve ödeme paneli |
| **Gerekçe** | Senaryo başına hesap izi, DS yolları tablosu, açık kurum planı, gerekli kararlar, varsayımlar ve notlar, 42 karar düğümünün belgeli/varsayımlı değeri ve koşul izi |
| **Mevzuat** | 13 tam metinde madde/kelime arama, dipnot ve değişiklik işaretleri; kural ayrıntısı ve kanıt metni (SHA-256 doğrulamalı); hesabın dayanak listesi |
| **Süreler** | DS müdürlüğüne başvuru (5 gün), infaz işlemine şikâyet (15/30 gün), infaz hâkimliği kararına itiraz (2 hafta) |

Vakayı JSON olarak **kaydedip yükleyebilir**, sonucu panoya **özet metin**, **JSON** veya **PDF** olarak alabilirsiniz.

## Örnek: 05/06/2025 · 1 yıl hapis

| | Tekerrürsüz | 1. Tekerrür | 2. Tekerrür |
|---|---|---|---|
| KS oranı | 1/2 | 2/3 | 3/4 |
| Asgari kurum (105/A, onda bir) | 18 gün | 24 gün | 27 gün |
| Açık kurum | doğrudan | doğrudan | kapalıdan, en az 1 ay (Yönetmelik m.6/1-a) |
| **Kurumda kalış** | **18 gün** | **en çok 24 gün** (108/2 tavanı için önceki ceza girilmedi) | **30 gün** · hukuki inceleme |

Sosyal medyada dolaşan "18 / 24 / 27" iddiasındaki 27 gün, ikinci tekerrürde doğrudan açık kuruma kabul yasağını (5275 m.14/2-a) ve kapalıdan açığa ayrılma şartını gözden kaçırır.

## Mimari

Ayrıntılı tasarım: [docs/MIMARI.md](docs/MIMARI.md).

```
kaynak/kural_tabani.json ──(npm run veri: doğrula, türet, böl)──▶ extension/veri/
extension/cekirdek/   saf hesap çekirdeği: koşul dili · karar motoru · hesap · tekerrür · çek · çıktı
extension/ui/         ince arayüz: form ↔ vaka, görünümler, mevzuat görüntüleyici
tests/                dil (125) · veri · kabul (57) · hesap
scripts/              veri-derle.mjs · e2e.mjs · paketle.sh · ikon_uret.py
```

## Geliştirme

```sh
npm test              # 224 test: dil uyumu, veri bütünlüğü, 57 kabul senaryosu, hesap
npm run veri          # kaynak kural tabanından çalışma paketlerini derler
npm run veri:kontrol  # paketlerin güncel olduğunu denetler
npm run e2e           # gerçek Chromium'da uçtan uca test (playwright gerekir)
npm run paketle       # dist/infaz-tekerrur-hesabi-<sürüm>.zip
```

Çalışma zamanı bağımlılığı yoktur; Node 18+ yeterlidir.

### Kural tabanını güncellemek

Yeni nüshayı `kaynak/kural_tabani.json` olarak koyun, `npm run veri` ve `npm test` çalıştırın. Derleme; kimlik, atıf, koşul ifadesi ve kanıt özeti hatalarında durur. Çıktılar kullandıkları veri paketinin SHA-256 özetini taşır; yeni veri eski hesabı sessizce değiştirmez.

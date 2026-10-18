# Yatar Hesabı 0.6.1

Telefon ve masaüstü için yerel çalışan infaz hesabı eklentisi. UYAP bağlantısı, hesap veya sunucu gerektirmez.

## Açılış düzeltmesi

Eklenti simgesine dokununca hesap doğrudan tam sayfada yeni sekmede açılır. Lemur’un açılır pencereyi dar bir şerit olarak boyutlandırması bu şekilde devre dışı bırakıldı. Kayıtlı dosya aynı yerel depodan yüklenir.

## Bu sürüm

- Belirgin çıkış tarihi, kapalı/açık/DS kartları, süre dağılımı ve yenilenmiş zaman çizelgesi.
- Altı adımda gerekçe: veriler, mahsup, koşullu salıverilme, kurum ayrımı, DS yolları, kabuller ve kararlar.
- DS tarihini belirleyen şart ve diğer yolların seçilmeme nedenleri.
- Kaynak madde/kural bağlantıları ve gerekçeli metni kopyalama.
- Kayıt okuma ve pano hatalarında görünür bildirim; DS uygulanmayan hesapta müddetname DS satırının düzeltilmesi.
- Tam sayfa düğmesi telefonda ve geniş açılır pencerede korunur. Yalnız zaten tam sayfada açılmışsa gizlenir.

## Kurulum / güncelleme

ZIP'in kökünde manifest.json vardır. Masaüstünde ZIP'i bir klasöre çıkarın; Chrome/Edge uzantılar sayfasından geliştirici modunda bu klasörü yükleyin. Mevcut kurulumu güncellerken aynı klasörde dosyaları değiştirip eklentiyi yeniden yüklemek, tarayıcıdaki yerel kaydın korunmasını sağlar. Lemur'da tarayıcının ZIP yükleme/güncelleme işlevini kullanın. Eklentiyi kaldırmak yerel veriyi silebilir.

## Sonucu okuma

Üç kart, girilen/varsayılan girişten SONRA kalan kapalı, açık ve DS günlerini gösterir. Mahsup edilen eski süreler bu kartlara tekrar eklenmez. DS, cezaevinden çıkış ile koşullu salıverilme arasındaki dönemdir; cezanın tamamının bittiği tarih değildir.

Bir karta dokununca kısa açıklama açılır. Ayrıntılı gerekçede kullanılan bilgiler, işlemler, tarih şartları ve kaynak maddeler bulunur. Ana sonuç DS talebi var kabulüyle hesaplanır; talep olmazsa çıkış ayrıca gösterilir.

## Doğrulama sınırı

Çalışma kural paketi ve hesap çekirdeği önceki 0.5.1 sürümüyle aynıdır. Yazılım testleri, sağlanan mevzuat modelinin resmî/eksiksiz hukuki doğrulaması anlamına gelmez. A01 takvim/mahsup profili gerçek müddetnamelerle kabul testi bekler; bu durum gerekçede görünür. Çoklu ilamın birleşik hesabı ve 01.06.2005 öncesi suçlar hesaplanmaz.

Test ortamı: Chromium 154, 320–1440 px ekranlar; gerçek Lemur cihazı testi yapılmadı. Test kaynakları ve ayrıntılı rapor ayrı teslim edilir.

#!/usr/bin/env node
// Uçtan uca test: eklentiyi gerçek Chromium'a yükler, telefon ve masaüstü
// boyutunda ana akışları sürer, ekrandaki sonuçları doğrular.
//
//   npm i -D playwright   (veya PLAYWRIGHT_MODUL=/yol/playwright/index.mjs)
//   CHROMIUM=/yol/chrome npm run e2e
//   EKRAN_GORUNTUSU=klasör  → telefon/masaüstü/karanlık ekran görüntüleri
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuralTabani, hesapla, takvim as T } from '../extension/cekirdek/index.js';
import { dosyaYukle, vakaKur } from '../extension/ui/dosya.js';
import { sonucOzeti } from '../extension/ui/ozet.js';
import { udf } from '../tests/zip.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EKLENTI = path.join(KOK, 'extension');
const GORUNTU = process.env.EKRAN_GORUNTUSU || null;
const { chromium } = await import(process.env.PLAYWRIGHT_MODUL || 'playwright').catch(() => {
  console.error('Playwright bulunamadı: npm i -D playwright veya PLAYWRIGHT_MODUL ortam değişkeni.');
  process.exit(2);
});

const TELEFON = { width: 390, height: 844 };
const MASAUSTU = { width: 1280, height: 900 };

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'infaz-e2e-'));
const ctx = await chromium.launchPersistentContext(profil, {
  headless: true,
  executablePath: process.env.CHROMIUM || undefined,
  args: [`--disable-extensions-except=${EKLENTI}`, `--load-extension=${EKLENTI}`, '--headless=new'],
  viewport: TELEFON,
  deviceScaleFactor: 2,
  locale: 'tr-TR',
  timezoneId: 'Europe/Istanbul',
});
const hatalar = [];
const goruntu = async (page, ad) => GORUNTU && page.screenshot({ path: path.join(GORUNTU, `${ad}.png`), fullPage: true });

try {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => hatalar.push(e.message));
  page.on('console', (m) => m.type() === 'error' && hatalar.push(m.text()));
  await page.goto('chrome://extensions');
  const id = await page.evaluate(() => [...document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelectorAll('extensions-item')][0].id);
  const adres = `chrome-extension://${id}/popup.html?tam=1`;
  await page.goto(adres);
  await page.waitForSelector('body.hazir');
  if (GORUNTU) fs.mkdirSync(GORUNTU, { recursive: true });

  const soru = () => page.locator('#soruKarti h2').innerText();
  const devam = () => page.click('[data-eylem="devam"]');
  // Bir süre kartının kısa nedeni + bağlandığı gerekçe adımının metni (0.6.1 gerekçe ekranı).
  const gerekce = async (tur) => {
    await page.click(`[data-neden="${tur}"]`);
    await page.click('.neden-kutu .gerekceye-git');
    const adim = page.locator('details.gerekce-adim[open]').first();
    return { adim, metin: `${await page.locator('.neden-kutu').innerText()}\n${await adim.innerText()}` };
  };
  const sayilar = async () => (await page.locator('.sayi-kutu .deger').allInnerTexts()).map((s) => s.replace(/\D/g, ''));

  // 1) Telefonda adım adım: 3 yıl 1 ay 15 gün · nitelikli hırsızlık · 01.07.2025
  assert.equal(await soru(), 'Kişi şu an nerede?');
  await goruntu(page, '1-telefon-ilk-soru');
  await page.click('.secenek:has-text("Hüküm var, henüz girmedi")');
  assert.equal(await soru(), 'Suç tarihi');
  await page.fill('#s_tarih', '2025-07-01');
  await devam();
  assert.equal(await soru(), 'Hükümdeki ceza');
  await page.fill('#s_yil', '3');
  await page.fill('#s_ay', '1');
  await page.fill('#s_gun', '15');
  await devam();
  assert.equal(await soru(), 'Suç');
  await page.fill('#s_ara', 'hırsız');
  await goruntu(page, '1b-telefon-suc');
  await page.click('[data-suc="5237|142"]');
  assert.match(await soru(), /Tekerrür/);
  await page.click('.secenek:has-text("Yok")');
  assert.match(await soru(), /Ne zaman girdiği/);
  await page.click('[data-giris="tarih"]');
  await page.fill('#s_tarih', '2026-01-01');
  await devam();
  assert.match(await soru(), /Gözaltı/);
  await page.click('[data-mahsup-yok]');
  // Ek sorular yalnız sonucu değiştirenler: kast, örgüt vb. sorulmaz.
  assert.match(await soru(), /0-6 yaş/);
  await page.click('.secenek:has-text("Hayır")');
  assert.match(await soru(), /rapor/);
  await page.click('[data-eylem="bilmiyorum"]');
  await page.waitForSelector('.soru-karti.bitti');
  assert.deepEqual(await sayilar(), ['30', '175', '365']);
  const sonuc = await page.locator('#sonuc').innerText();
  assert.match(sonuc, /25\.07\.2026/);
  assert.match(sonuc, /Cezaevinden çıkış · denetimli serbestlik/);
  assert.match(sonuc, /Sağlık raporu olmadığı varsayıldı/);
  await goruntu(page, '2-telefon-sonuc');

  // 2) Neden ve madde metni
  const kapaliNeden = await gerekce('kapali');
  assert.match(kapaliNeden.metin, /Yönetmelik m\.6\/1-a/);
  await kapaliNeden.adim.locator('.madde-bag[data-madde="U04:govde:6"]').first().click();
  await page.waitForSelector('#goruntuleyici .madde-metni');
  assert.match(await page.locator('#goruntuleyici').innerText(), /Açık Ceza İnfaz Kurumlarına Ayrılma/);
  await goruntu(page, '3-telefon-mevzuat');

  // 3) Mevzuat arama ve kural kanıtı (SHA-256 tarayıcıda doğrulanır)
  await page.selectOption('#mevzuatSec', 'U03');
  await page.fill('#mevzuatAra', '105/A');
  await page.click('#mevzuatSonuc [data-madde="U03:govde:105/A"]');
  assert.match(await page.locator('#goruntuleyici').innerText(), /onda birini/);
  await page.click('#dayanaklarKutu summary');
  await page.click('#dayanaklar .cip.kural >> nth=0');
  await page.waitForSelector('#goruntuleyici .cip.tamam:has-text("SHA-256 doğrulandı")');

  // 4) Süreler
  await page.click('#sekme-sureler');
  await page.fill('#sure_teblig', '2026-10-01');
  assert.match(await page.locator('#sure_itiraz').innerText(), /15\.10\.2026/);

  // 5) Cevabı değiştirme: 1 yıl, suç 05.06.2025, tekerrür bilinmiyor → 18 / en çok 24 / 30
  await page.click('#sekme-hesap');
  await page.click('[data-duzenle="ceza"]');
  await page.fill('#s_yil', '1');
  await page.fill('#s_ay', '');
  await page.fill('#s_gun', '');
  await devam();
  await page.click('[data-duzenle="suc_tarihi"]');
  await page.fill('#s_tarih', '2025-06-05');
  await devam();
  await page.click('[data-duzenle="suc"]');
  await page.fill('#s_ara', '141');
  await page.click('[data-suc="5237|141"]');
  await page.click('[data-duzenle="tekerrur"]');
  await page.click('[data-eylem="bilmiyorum"]');
  const kiyas = (await page.locator('.kiyas b').allInnerTexts()).map((s) => s.replace(/\D/g, ''));
  assert.deepEqual(kiyas, ['18', '24', '30']);
  assert.match(await page.locator('#sonuc').innerText(), /Tekerrür bilinmiyor: tekerrürsüz gösterildi/);
  await page.click('.kiyas[data-senaryo="ikinci"]');
  assert.match(await page.locator('.sonuc-kart').innerText(), /2\. TEKERRÜR/i);
  assert.deepEqual(await sayilar(), ['30', '0', '243']);

  // 6) 2005 öncesi suç hesaplanmaz
  await page.click('[data-duzenle="suc_tarihi"]');
  await page.fill('#s_tarih', '2004-05-01');
  await devam();
  assert.match(await page.locator('#sonuc').innerText(), /01\.06\.2005 öncesi suçlar bu araçta hesaplanmaz/);
  await page.click('[data-duzenle="suc_tarihi"]');
  await page.fill('#s_tarih', '2025-07-01');
  await devam();

  // 6b) 31/07/2023 öncesi suç: geçici 10/6 → 1 ay kapalı, 3 ay açık, sonra DS; talepsiz satırı
  await page.click('[data-duzenle="suc_tarihi"]');
  await page.fill('#s_tarih', '2023-01-01');
  await devam();
  await page.click('[data-duzenle="ceza"]');
  await page.fill('#s_yil', '3');
  await page.fill('#s_ay', '1');
  await page.fill('#s_gun', '15');
  await devam();
  await page.click('[data-duzenle="suc"]');
  await page.fill('#s_ara', '142');
  await page.click('[data-suc="5237|142"]');
  assert.deepEqual(await sayilar(), ['30', '90', '450']);
  const g10 = await page.locator('.sonuc-kart').innerText();
  assert.match(g10, /geçici 10\/6/);
  assert.match(g10, /talep etmezse:.*25\.07\.2027/);
  assert.match((await gerekce('ds')).metin, /Geçici 10\/6/);
  await goruntu(page, '2b-telefon-gecici10');

  // 6c) Müddetname: tarih aralıklı tutukluluk + kullanılan DS, sonra karşılaştırma
  await page.click('[data-duzenle="mahsup"]');
  assert.equal(await page.locator('.mahsup-satir').count(), 2, 'boş gözaltı ve tutukluluk satırı');
  await page.locator('.mahsup-satir >> nth=0').locator('[data-m="gun"]').fill('2');
  const tut = page.locator('.mahsup-satir >> nth=1');
  await tut.locator('[data-m="baslangic"]').fill('2025-01-01');
  await tut.locator('[data-m="bitis"]').fill('2025-01-31');
  assert.match(await tut.locator('.mahsup-hesap').innerText(), /31 gün cezadan düşülür/);
  await page.click('[data-mahsup-ekle]');
  const ds = page.locator('.mahsup-satir >> nth=2');
  await ds.locator('[data-m="tur"]').selectOption('denetimli_serbestlik');
  await ds.locator('[data-m="gun"]').fill('60');
  assert.equal(await tut.locator('[data-m="bitis"]').inputValue(), '2025-01-31', 'satır eklerken değerler korunur');
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= TELEFON.width, 'telefonda yatay taşma yok');
  await goruntu(page, '2c-telefon-mahsup');
  await devam();
  assert.match(await page.locator('#cevaplar').innerText(), /Mahsup 93 gün · DS dahil/);
  assert.match((await gerekce('kapali')).metin, /Denetimli serbestlikten geri gönderilen/);
  await page.click('.muddetname summary');
  await page.fill('[data-md="ks"]', '2030-01-01');
  assert.match(await page.locator('#mdTablo').innerText(), /01\.01\.2030/);
  assert.match(await page.locator('#mdTablo').innerText(), /\+\d+ gün/);
  await goruntu(page, '2d-telefon-muddetname');
  await page.fill('[data-md="ks"]', '');
  await page.click('[data-duzenle="mahsup"]');
  await page.click('[data-mahsup-yok]');

  // 7) Kayıt: sayfa yenilenince dosya geri gelir
  await page.reload();
  await page.waitForSelector('body.hazir');
  assert.ok((await page.locator('.cevap').count()) >= 6);

  // 8) Masaüstü açılır penceresi (400px)
  const acilir = await ctx.newPage();
  acilir.on('pageerror', (e) => hatalar.push(e.message));
  await acilir.setViewportSize({ width: 400, height: 600 });
  await acilir.goto(adres.replace('?tam=1', ''));
  await acilir.waitForSelector('body.hazir');
  assert.ok(await acilir.locator('#tamEkran').isVisible());
  assert.equal(await acilir.evaluate(() => document.documentElement.scrollWidth), 400, 'yatay kaydırma yok');
  await acilir.close();

  // 9) Masaüstü ve karanlık tema
  await page.setViewportSize(MASAUSTU);
  await page.reload();
  await page.waitForSelector('body.hazir');
  const kolon = await page.evaluate(() => getComputedStyle(document.getElementById('ekran-hesap')).gridTemplateColumns.split(' ').length);
  assert.equal(kolon, 2);
  await goruntu(page, '4-masaustu');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize(TELEFON);
  await goruntu(page, '5-telefon-karanlik');

  // 10) Belgeden okuma: içtima kararı (yapıştırma) + müddetname (.udf) → 6 ilam; her ilam için
  //     eksik bilgiler sırayla sorulur; sonuç cezaların toplanmasıyla hesaplanır.
  const belgeMetni = (ad) => fs.readFileSync(path.join(KOK, 'tests/belgeler', ad), 'utf8');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.click('#yeniHesap');
  await page.click('#yeniHesap');
  await page.click('[data-belge="ac"]');
  await page.fill('#belgeMetni', belgeMetni('ictima-karari.txt'));
  await page.click('[data-belge="oku"]');
  await page.waitForSelector('.belge-onizleme');
  assert.equal(await page.locator('.belge-ilamlar > li').count(), 6);
  assert.match(await page.locator('.belge-toplam').innerText(), /11 yıl 25 ay 37 gün/);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= TELEFON.width, 'önizlemede yatay taşma yok');
  await goruntu(page, '6-telefon-belge-onizleme');
  await page.click('[data-belge="birlestir"]');
  await page.waitForSelector('#belgeKarti >> text=Belgeden aktarıldı');
  assert.equal(await page.locator('.ilam-grup').count(), 6);
  await page.click('[data-belge="baska"]');
  await page.setInputFiles('#belgeDosyasi', { name: 'muddetname.udf', mimeType: 'application/octet-stream', buffer: udf(belgeMetni('muddetname.txt')) });
  await page.waitForSelector('.belge-onizleme');
  assert.match(await page.locator('.belge-onizleme').innerText(), /Müddetname/);
  await page.click('[data-belge="birlestir"]');
  const aktarilan = await page.locator('#belgeKarti').innerText();
  assert.match(aktarilan, /suç tarihi 03\.02\.2024/);
  assert.match(aktarilan, /Tutukluluk 04\.02\.2024 – 20\.03\.2024/);
  assert.match(aktarilan, /Cezaevine giriş 05\.08\.2025/);
  assert.match(aktarilan, /karşılaştırma tablosuna aktarılmadı/, 'tek ilamın müddetnamesi toplamla karşılaştırılmaz');
  await goruntu(page, '6b-telefon-belge-aktarildi');
  await page.click('[data-belge="kapat"]');
  assert.equal(await soru(), 'Suç tarihi');
  assert.match(await page.locator('.ilam-baglam').textContent(), /\/ 6Diyarbakır 12\. Asliye Ceza 2017\/157 E\./);
  await goruntu(page, '6c-telefon-ilam-sorusu');
  const sucTarihleri = { 1: '2017-01-10', 3: '2014-03-01', 4: '2023-02-01', 6: '2025-02-01' };
  let hizli = 0;
  for (let n = 0; n < 80 && !(await page.locator('.soru-karti.bitti').count()); n++) {
    const baslik = await soru();
    const no = (await page.locator('.ilam-baglam .ilam-no').count()) ? Number(await page.locator('.ilam-baglam .ilam-no').innerText()) : null;
    if (baslik === 'Suç tarihi') {
      if (await page.locator('[data-tarih-hizli]').count()) {
        hizli++;
        await page.click('[data-tarih-hizli]');
      } else {
        await page.fill('#s_tarih', sucTarihleri[no]);
        await devam();
      }
    } else if (baslik === 'Suç' && no === 1) {
      await page.fill('#s_ara', 'hırsız');
      await page.click('[data-suc="5237|142"]');
    } else if (/Tekerrür/.test(baslik)) await page.click('.secenek:has-text("Yok")');
    else if (/Gözaltı/.test(baslik)) await page.click('[data-mahsup-yok]');
    else if (await page.locator('[data-eylem="bilmiyorum"]').count()) await page.click('[data-eylem="bilmiyorum"]');
    else await page.click('#soruKarti .secenek >> nth=0');
  }
  await page.waitForSelector('.soru-karti.bitti');
  assert.equal(hizli, 1, 'aynı hükmün ikinci ilamında suç tarihi tek dokunuşla önerilir');
  // Ekrandaki sonuç = kayıtlı dosyanın Node'daki modeli
  const modelOzeti = async () => {
    const kayit = await page.evaluate(() => chrome.storage.local.get('infaz-dosya-v3'));
    const d = dosyaYukle(kayit['infaz-dosya-v3']);
    const kt = new KuralTabani(JSON.parse(fs.readFileSync(path.join(EKLENTI, 'veri/paket.json'), 'utf8')));
    const bugun = T.bugunIstanbul();
    return { d, o: sonucOzeti(kt, d, hesapla(kt, vakaKur(d, bugun)), null, hesapla(kt, vakaKur(d, bugun, { dsTalebi: false }))) };
  };
  await page.waitForTimeout(200);
  const { d: kayitli, o: model } = await modelOzeti();
  assert.equal(kayitli.ilamlar.length, 6);
  assert.equal(model.durum, 'tamam');
  assert.deepEqual(await sayilar(), [model.kapali, model.acik, model.ds].map(String));
  const coklu = await page.locator('#sonuc').textContent();
  assert.match(coklu, /Toplanan cezalar · 6 ilam/);
  assert.ok(coklu.includes(T.trTarih(model.tarihler.cikis)));
  assert.equal(await page.locator('.ilam-dokumu tbody tr').count(), 6);
  assert.match(await page.locator('.ilam-dokumu tfoot').innerText(), /11 yıl 25 ay 37 gün/);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= TELEFON.width, 'çok ilamda yatay taşma yok');
  await goruntu(page, '6d-telefon-toplama-sonuc');

  // Sorular bitince ilam grupları katlanır; her biri tamam işaretiyle tek satır.
  assert.equal(await page.locator('.ilam-grup[open]').count(), 0);
  assert.equal(await page.locator('.ilam-durum.tamam').count(), 6);

  // 10b) İlamın cevabını değiştirme: grup açılır; hüküm tarihinden sonraki suç tarihi reddedilir
  await page.click('[data-ilam-grup="5"] > summary');
  assert.equal(await page.locator('.ilam-grup[open]').count(), 1);
  await page.click('[data-duzenle="suc_tarihi"][data-ilam="5"]');
  assert.equal(await page.locator('.ilam-baglam .ilam-no').innerText(), '6');
  await page.fill('#s_tarih', '2025-07-01');
  await devam();
  assert.match(await page.locator('#soruKarti .uyari').innerText(), /hüküm tarihinden \(18\.06\.2025\) sonra olamaz/);
  await page.fill('#s_tarih', '2025-03-01');
  await devam();
  assert.match(await page.locator('.ilam-grup >> nth=5').innerText(), /Suç 01\.03\.2025/);

  // 10c) Elle ilam ekleme ve iki dokunuşla çıkarma
  await page.click('[data-ilam-ekle]');
  assert.equal(await page.locator('.ilam-grup').count(), 7);
  assert.equal(await soru(), 'Suç tarihi');
  assert.match(await page.locator('.ilam-baglam').textContent(), /7\. ilam \/ 7Elle eklenen ilam/);
  const sil = page.locator('[data-ilam-sil="6"]');
  await sil.click();
  assert.equal(await page.locator('.ilam-grup').count(), 7, 'ilk dokunuş yalnız onay ister');
  await sil.click();
  assert.equal(await page.locator('.ilam-grup').count(), 6);
  await page.waitForSelector('.soru-karti.bitti');

  // 10d) Kayıt, masaüstü görünümü
  await page.reload();
  await page.waitForSelector('body.hazir');
  assert.equal(await page.locator('.ilam-grup').count(), 6);
  assert.equal(await page.locator('.ilam-dokumu tbody tr').count(), 6);
  await page.setViewportSize(MASAUSTU);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= MASAUSTU.width);
  await goruntu(page, '7-masaustu-coklu');
  await page.setViewportSize(TELEFON);

  assert.deepEqual(hatalar, []);
  console.log('e2e: tüm akışlar geçti');
} finally {
  await ctx.close();
  fs.rmSync(profil, { recursive: true, force: true });
}

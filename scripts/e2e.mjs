#!/usr/bin/env node
// Uçtan uca duman testi: eklentiyi gerçek Chromium'a yükler, ana akışları sürer ve
// ekrandaki sonuçları doğrular.
//
//   npm i -D playwright   (veya PLAYWRIGHT_MODUL=/yol/playwright/index.mjs)
//   CHROMIUM=/yol/chrome npm run e2e
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EKLENTI = path.join(KOK, 'extension');
const { chromium } = await import(process.env.PLAYWRIGHT_MODUL || 'playwright').catch(() => {
  console.error('Playwright bulunamadı: npm i -D playwright veya PLAYWRIGHT_MODUL ortam değişkeni.');
  process.exit(2);
});

const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'infaz-e2e-'));
const ctx = await chromium.launchPersistentContext(profil, {
  headless: true,
  executablePath: process.env.CHROMIUM || undefined,
  args: [`--disable-extensions-except=${EKLENTI}`, `--load-extension=${EKLENTI}`, '--headless=new'],
  viewport: { width: 1280, height: 1200 },
});
const hatalar = [];
try {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => hatalar.push(e.message));
  page.on('console', (m) => m.type() === 'error' && hatalar.push(m.text()));
  await page.goto('chrome://extensions');
  const id = await page.evaluate(() => [...document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-item-list').shadowRoot.querySelectorAll('extensions-item')][0].id);
  await page.goto(`chrome-extension://${id}/popup.html?tam=1`);
  await page.waitForSelector('#paketBilgi:has-text("0.3.0")');

  // 1) Hızlı giriş: 05/06/2025 · 1 yıl → 18 / en çok 24 / 30
  await page.fill('#suc_tarihi', '2025-06-05');
  await page.fill('#ceza_yil', '1');
  await page.waitForTimeout(300);
  const sayilar = await page.locator('#senaryolar .sayi').allInnerTexts();
  assert.deepEqual(sayilar, ['18', '24', '30']);
  assert.match(await page.locator('#senaryolar').innerText(), /EN ÇOK/);

  // 2) Gerekçe ve kural kanıtı (SHA-256 tarayıcıda doğrulanır)
  await page.click('[data-gerekce="ikinci"]');
  assert.match(await page.locator('#gerekce').innerText(), /Yönetmelik m\.6\/1-a/);
  await page.click('#gerekce .cip.kural >> nth=0');
  await page.waitForSelector('#goruntuleyici .cip.tamam:has-text("SHA-256 doğrulandı")');

  // 3) Mevzuat arama
  await page.fill('#mevzuatAra', '105/A');
  await page.click('#mevzuatSonuc [data-madde="U03:govde:105/A"]');
  assert.match(await page.locator('#goruntuleyici').innerText(), /onda birini/);

  // 4) Süreler
  await page.click('#sekme-sureler');
  await page.fill('#sure_teblig', '2026-10-01');
  assert.match(await page.locator('#sure_itiraz').innerText(), /15\.10\.2026/);

  assert.deepEqual(hatalar, []);
  console.log('e2e: tüm akışlar geçti');
} finally {
  await ctx.close();
  fs.rmSync(profil, { recursive: true, force: true });
}

// Veri paketi bütünlüğü: derlenmiş paketler kaynakla güncel ve tutarlı olmalı.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { derle, dogrula } from '../scripts/veri-derle.mjs';
import { sha256Hex } from '../extension/cekirdek/index.js';
import { KAYNAK, KAYNAK_METNI, PAKET, kt, mevzuat } from './yardimci.js';

test('Kaynak kural tabanı doğrulamadan hatasız geçer (kimlik, atıf, ifade, kanıt SHA-256)', () => {
  assert.deepEqual(dogrula(KAYNAK), []);
});

test('Derlenmiş paketler kaynakla birebir güncel (npm run veri)', () => {
  const { dosyalar, hatalar } = derle(KAYNAK_METNI);
  assert.deepEqual(hatalar, []);
  for (const [ad, icerik] of Object.entries(dosyalar)) {
    const yol = new URL(`../extension/veri/${ad}`, import.meta.url);
    assert.equal(fs.readFileSync(yol, 'utf8'), icerik, `${ad} güncel değil`);
  }
});

test('Paket kimliği kaynak dosyanın SHA-256 özetini taşır', () => {
  assert.equal(PAKET.kimlik.kaynak_sha256, crypto.createHash('sha256').update(KAYNAK_METNI).digest('hex'));
  assert.equal(PAKET.kimlik.paket_surumu, '0.3.0-karar-modelli');
});

test('TCK yapısı tam metin başlıklarından doğru türetilir', () => {
  assert.deepEqual(kt.tckKonumu('81'), [2, 2, 1]); // Kişilere karşı / hayata karşı
  assert.deepEqual(kt.tckKonumu('102'), [2, 2, 6]); // Cinsel dokunulmazlık
  assert.deepEqual(kt.tckKonumu('188'), [2, 3, 3]); // Kamunun sağlığına karşı
  assert.deepEqual(kt.tckKonumu('220'), [2, 3, 5]); // Kamu barışına karşı
  assert.deepEqual(kt.tckKonumu('302'), [2, 4, 4]); // Devletin güvenliği
  assert.deepEqual(kt.tckKonumu('314'), [2, 4, 5]); // Anayasal düzen
  assert.deepEqual(kt.tckKonumu('326'), [2, 4, 7]); // Casusluk
  assert.deepEqual(kt.tckKonumu('339'), [2, 4, 7]);
});

test('Kanıt metinleri yeniden özetlendiğinde kaynakla aynıdır (tarayıcı SubtleCrypto yolu)', async () => {
  for (const id of ['R020:K01', 'R042:K01', 'R081:K01'].filter((x) => kt.kanitlar.has(x))) {
    const k = await mevzuat.kanit(id);
    assert.equal(await sha256Hex(k.metin), k.madde_metin_sha256, id);
  }
});

test('Madde arama ve kural atıfları', async () => {
  const [m] = await mevzuat.ara('U03', '105/A');
  assert.equal(m.madde_id, 'U03:govde:105/A');
  assert.match(m.metin, /onda birini/);
  const a = await mevzuat.madde('U04:govde:6');
  assert.match(a.madde.metin, /yedi yıl veya daha az/);
  assert.equal(kt.maddeIdCoz('5275:105/A/1-2'), 'U03:govde:105/A');
  assert.equal(kt.maddeIdCoz('5275:gecici6/1,3'), 'U03:govde:gecici_6');
  assert.equal(kt.maddeIdCoz('16564:6/1-a'), 'U04:govde:6');
});

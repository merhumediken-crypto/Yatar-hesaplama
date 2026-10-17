// Süreler sekmesi: usul süreleri hesaplayıcıları.
import { dsBasvuruSuresi, sikayetSuresi, itirazSuresi } from '../cekirdek/index.js';
import { $, esc } from './yardimci.js';
import { kuralCipi } from './gorunum.js';

export function surelerCiz(kt) {
  const yaz = (id, sonuc) => ($(id).innerHTML = sonuc ? `${esc(sonuc.aciklama)} ${kuralCipi(sonuc.kural)}` : '<span class="ipucu">Tarih girin.</span>');
  const ayrilis = $('sure_ayrilis').value;
  yaz('sure_ds', ayrilis ? dsBasvuruSuresi(kt, ayrilis) : null);
  const ogrenme = $('sure_ogrenme').value || null;
  const islem = $('sure_islem').value || null;
  yaz('sure_sikayet', ogrenme || islem ? sikayetSuresi(kt, { ogrenme, islem }) : null);
  const teblig = $('sure_teblig').value;
  yaz('sure_itiraz', teblig ? itirazSuresi(kt, { teblig, karar_tarihi: $('sure_karar').value || null }) : null);
}

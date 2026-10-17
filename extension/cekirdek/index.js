// Çekirdek genel API'si. Arayüz ve testler yalnız bu modülü kullanır.
export { hesapla, toplamaDegerlendir, SENARYOLAR, DESTEKLENMEYEN_DALLAR } from './cikti/sonuc.js';
export { ozetMetni } from './cikti/ozet.js';
export { KuralTabani, mevzuatEtiketi } from './bilgi/kural-tabani.js';
export { MevzuatDeposu, sha256Hex } from './bilgi/mevzuat.js';
export { KararMotoru, IHTIYAT_YONU, izMetni } from './karar/motor.js';
export { degerlendir, izliDegerlendir, ifadeyiDogrula } from './dil/kosul.js';
export { vakaNormallestir } from './baglam/vaka.js';
export { kararBaglami, varsayimlariUygula, OLAGAN_VARSAYIMLAR } from './baglam/karar-baglami.js';
export { tekerrurTespit, oncekiBaglami, adayMetni } from './tekerrur/tespit.js';
export { cekDegerlendir } from './cek/cek.js';
export { acikEsikleri } from './hesap/acik-kurum.js';
export { agirlikliGunToplami, gunAgirligiBelirle } from './hesap/cocuk.js';
export { dsBasvuruSuresi, sikayetSuresi, itirazSuresi } from './hesap/usul.js';
export { profilOlustur, VARSAYILAN_PROFIL, PROFIL_SECENEKLERI } from './zaman/profil.js';
export { Kesir } from './zaman/rasyonel.js';
export * as takvim from './zaman/takvim.js';

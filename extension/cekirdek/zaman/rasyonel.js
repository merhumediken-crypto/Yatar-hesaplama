// Rasyonel sayı (pay/payda). Kural tabanı: "Oranlar pay/payda biçiminde rasyonel
// sayı; ara adımlarda ondalıklı kayan nokta kullanılmamalı." (hesap_politikasi.sayisal_temsil)

function ebob(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export class Kesir {
  constructor(pay, payda = 1) {
    if (!Number.isSafeInteger(pay) || !Number.isSafeInteger(payda) || payda === 0) {
      throw new RangeError(`Geçersiz veya güvenli tamsayı sınırını aşan kesir: ${pay}/${payda}`);
    }
    if (payda < 0) {
      pay = -pay;
      payda = -payda;
    }
    const g = ebob(pay, payda);
    this.pay = pay / g;
    this.payda = payda / g;
  }

  static from(x) {
    if (x instanceof Kesir) return x;
    if (typeof x === 'number') return new Kesir(x, 1);
    if (x && typeof x === 'object' && 'pay' in x && 'payda' in x) return new Kesir(x.pay, x.payda);
    throw new Error('Kesire çevrilemez: ' + JSON.stringify(x));
  }

  carp(x) {
    const k = Kesir.from(x);
    return new Kesir(this.pay * k.pay, this.payda * k.payda);
  }

  bol(x) {
    const k = Kesir.from(x);
    return new Kesir(this.pay * k.payda, this.payda * k.pay);
  }

  topla(x) {
    const k = Kesir.from(x);
    return new Kesir(this.pay * k.payda + k.pay * this.payda, this.payda * k.payda);
  }

  cikar(x) {
    return this.topla(Kesir.from(x).carp(-1));
  }

  karsilastir(x) {
    const k = Kesir.from(x);
    const fark = BigInt(this.pay) * BigInt(k.payda) - BigInt(k.pay) * BigInt(this.payda);
    return fark < 0n ? -1 : fark > 0n ? 1 : 0;
  }

  esit(x) {
    return this.karsilastir(x) === 0;
  }

  static max(...xs) {
    return xs.map(Kesir.from).reduce((a, b) => (a.karsilastir(b) >= 0 ? a : b));
  }

  static min(...xs) {
    return xs.map(Kesir.from).reduce((a, b) => (a.karsilastir(b) <= 0 ? a : b));
  }

  asagi() {
    return Math.floor(this.pay / this.payda);
  }

  yukari() {
    return Math.ceil(this.pay / this.payda);
  }

  tamMi() {
    return this.payda === 1;
  }

  // Yuvarlama profili: "asagi" (R003: gün artığı infaz edilmez) veya "yukari".
  yuvarla(profil) {
    return profil === 'yukari' ? this.yukari() : this.asagi();
  }

  toString() {
    return this.payda === 1 ? String(this.pay) : `${this.pay}/${this.payda}`;
  }

  // Okunur gösterim: 182,5 / 24,333…
  ondalik(basamak = 3) {
    if (this.payda === 1) return String(this.pay);
    const tam = Math.trunc(this.pay / this.payda);
    let kalan = Math.abs(this.pay % this.payda);
    let s = '';
    for (let i = 0; i < basamak && kalan; i++) {
      kalan *= 10;
      s += Math.floor(kalan / this.payda);
      kalan %= this.payda;
    }
    const isaret = this.pay < 0 && tam === 0 ? '-' : '';
    return `${isaret}${tam}${s ? ',' + s : ''}${kalan ? '…' : ''}`;
  }

  toJSON() {
    return { pay: this.pay, payda: this.payda };
  }
}

export const k = (pay, payda = 1) => new Kesir(pay, payda);

export const store = {
  data: [],
  async load() {
    // data.json: src dizinde
    const res = await fetch("./src/data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("data.json okunamadı: " + res.status);
    const json = await res.json();

    // Dosyada direkt array bekliyoruz: [ {...}, {...} ]
    if (!Array.isArray(json)) {
      throw new Error("data.json array değil. Örn: [ {...}, {...} ] olmalı.");
    }

    // Normalize: date_key zorunlu
    this.data = json.filter(x => x && x.date_key);
    return this.data;
  }
};
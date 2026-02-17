export const store = {
  data: [],
  async load() {
    const res = await fetch("./src/datacikis.json", { cache: "no-store" });
    if (!res.ok) throw new Error("datacikis.json okunamadı: " + res.status);
    const json = await res.json();

    if (!Array.isArray(json)) {
      throw new Error("datacikis.json array değil. Örn: [ {...}, {...} ] olmalı.");
    }

    // Normalize: date_key zorunlu, status + duration_sec dönüşümü
    this.data = json.filter(x => x && x.date_key).map(x => ({
      ...x,
      status: x.status === "SUCCESS" ? "COMPLETED" : x.status === "Error" ? "ERROR" : x.status,
      duration_sec: parseInt(x.duration_sec, 10) || 0
    }));
    return this.data;
  }
};

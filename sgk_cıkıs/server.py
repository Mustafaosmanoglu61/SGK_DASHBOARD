import json
import os
from datetime import datetime
from math import isfinite
from flask import Flask, jsonify, request, send_from_directory

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "src", "datacikis.json")

MANUAL_TIME_SECONDS = 240
WORKING_HOURS_PER_DAY = 8
WORKING_DAYS_PER_MONTH = 22
SECONDS_PER_HOUR = 3600
TOTAL_WORKING_SECONDS_PER_MONTH = WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * SECONDS_PER_HOUR

# SGK Çıkış Nedeni Kodları
CIKIS_NEDENI_MAP = {
    "01": "Deneme süreli iş sözl. işverence feshi",
    "02": "Deneme süreli iş sözl. işçi tarafından feshi",
    "03": "Belirsiz süreli iş sözl. işçi tarafından feshi (istifa)",
    "04": "Belirsiz süreli iş sözl. işveren tarafından haklı sebep bildirilmeden feshi",
    "05": "Belirli süreli iş sözleşmesinin sona ermesi",
    "08": "Emeklilik (yaşlılık) veya toptan ödeme",
    "09": "Malulen emeklilik",
    "10": "Ölüm",
    "12": "Askerlik",
    "13": "Kadın işçinin evlenmesi",
    "14": "Emeklilik için yaş dışında diğer şartların tamamlanması",
    "16": "Sözleşme sona ermeden sigortalının aynı işverene ait diğer işyerine nakli",
    "17": "İşyerinin kapanması",
    "18": "İşin sona ermesi",
    "22": "Diğer nedenler",
    "25": "İşçi tarafından zorunlu nedenle fesih",
    "27": "İşveren tarafından zorunlu nedenle fesih",
    "28": "İşveren tarafından sendikal nedenle fesih",
    "44": "İşveren tarafından 4857/25-II ile fesih",
    "45": "İşçi tarafından 4857/24-II ile fesih",
    "46": "Belirli süreli iş sözleşmesinin işveren tarafından feshi",
    "48": "Toplu işçi çıkarma",
    "49": "Fazla çalışmaya onay vermeme nedeniyle fesih",
    "50": "İşyeri devri nedeniyle fesih",
}

app = Flask(__name__, static_folder="src", static_url_path="/src")


def safe_float(v):
    try:
        n = float(v)
        return n if isfinite(n) else 0.0
    except Exception:
        return 0.0


def clean_pozisyon(pozisyon):
    if not pozisyon or not isinstance(pozisyon, str):
        return ""
    cleaned = pozisyon.strip()
    dot_index = cleaned.find(".")
    if dot_index != -1 and dot_index < len(cleaned) - 1:
        cleaned = cleaned[dot_index + 1 :].strip()
    if cleaned.endswith("."):
        cleaned = cleaned[:-1].strip()
    return cleaned


def parse_hour(iso):
    if not iso or "T" not in iso:
        return None
    try:
        hh = iso.split("T", 1)[1][:2]
        return int(hh)
    except Exception:
        return None


def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    cleaned = []
    for r in data:
        if not isinstance(r, dict):
            continue
        rr = dict(r)
        # Normalize status
        if rr.get("status") == "SUCCESS":
            rr["status"] = "COMPLETED"
        elif rr.get("status") == "Error":
            rr["status"] = "ERROR"
        # Parse duration_sec from string
        try:
            rr["duration_sec"] = int(rr.get("duration_sec", 0))
        except (ValueError, TypeError):
            rr["duration_sec"] = 0
        rr["pozisyon_clean"] = clean_pozisyon(rr.get("pozisyon"))
        cleaned.append(rr)
    return cleaned


def top_counts(rows, key, topn=5):
    m = {}
    for r in rows:
        k = r.get(key) or "—"
        m[k] = m.get(k, 0) + 1
    return sorted(m.items(), key=lambda x: x[1], reverse=True)[:topn]


def compute_stats(rows):
    total = len(rows)
    completed = sum(1 for r in rows if r.get("status") == "COMPLETED")
    error = sum(1 for r in rows if r.get("status") == "ERROR")

    durations = [safe_float(r.get("duration_sec")) for r in rows]
    durations = [d for d in durations if d > 0]
    total_sec = sum(durations)
    avg_sec = total_sec / len(durations) if durations else 0

    date_keys = sorted({r.get("date_key") for r in rows if r.get("date_key")})
    date_min = date_keys[0] if date_keys else None
    date_max = date_keys[-1] if date_keys else None
    daily_avg = total / len(date_keys) if date_keys else total

    manual_total_sec = total * MANUAL_TIME_SECONDS
    saved_time_sec = manual_total_sec - total_sec
    saved_time_hours = saved_time_sec / SECONDS_PER_HOUR
    fte_saved = saved_time_sec / TOTAL_WORKING_SECONDS_PER_MONTH

    return {
        "total": total,
        "completed": completed,
        "error": error,
        "success_rate": (completed / total * 100) if total else 0,
        "total_sec": total_sec,
        "avg_sec": avg_sec,
        "date_min": date_min,
        "date_max": date_max,
        "daily_avg": daily_avg,
        "fte_saved": fte_saved,
        "saved_time_hours": saved_time_hours,
        "top_cikis_nedeni": top_counts(rows, "cikis_nedeni", 5),
        "top_pozisyon": top_counts(rows, "pozisyon_clean", 5),
        "top_isyeri": top_counts(rows, "isyeri", 5),
    }


def parse_month_key(date_key):
    if not date_key or not isinstance(date_key, str):
        return None
    try:
        dt = datetime.strptime(date_key, "%Y-%m-%d")
        return (dt.year, dt.month)
    except Exception:
        return None


def compute_latest_month_summary(rows):
    buckets = {}
    for r in rows:
        mk = parse_month_key(r.get("date_key"))
        if not mk:
            continue
        buckets.setdefault(mk, []).append(r)
    if not buckets:
        return None
    latest_month = max(buckets.keys())
    month_rows = buckets[latest_month]
    stats = compute_stats(month_rows)
    return {
        "year": latest_month[0],
        "month": latest_month[1],
        "stats": stats,
    }


def find_known_value(q, values):
    ql = q.lower()
    matches = [v for v in values if v and v.lower() in ql]
    if not matches:
        return None
    return max(matches, key=len)


def subset_stats(rows):
    total = len(rows)
    completed = sum(1 for r in rows if r.get("status") == "COMPLETED")
    error = sum(1 for r in rows if r.get("status") == "ERROR")
    return total, completed, error


def answer_from_data(question, rows, stats, uniq_isyeri, uniq_pozisyon):
    q = (question or "").strip()
    ql = q.lower()

    isyeri = None
    if "isyeri" in ql or "işyeri" in ql or "hastane" in ql:
        isyeri = find_known_value(ql, uniq_isyeri)

    pozisyon = None
    if "pozisyon" in ql:
        pozisyon = find_known_value(ql, uniq_pozisyon)

    if isyeri:
        subset = [r for r in rows if r.get("isyeri") == isyeri]
        total, completed, error = subset_stats(subset)
        return (
            f"{isyeri} için toplam kayıt: {total}. Başarılı: {completed}, Hatalı: {error}.",
            {"confident": True, "matched": "isyeri", "value": isyeri},
        )

    if pozisyon:
        subset = [r for r in rows if r.get("pozisyon_clean") == pozisyon]
        total, completed, error = subset_stats(subset)
        return (
            f"{pozisyon} pozisyonu için toplam kayıt: {total}. Başarılı: {completed}, Hatalı: {error}.",
            {"confident": True, "matched": "pozisyon", "value": pozisyon},
        )

    if "toplam" in ql and ("kayıt" in ql or "kayit" in ql):
        return (f"Toplam kayıt sayısı: {stats['total']}", {"confident": True})

    if "başarılı" in ql or "completed" in ql:
        return (f"Başarılı işten çıkış sayısı: {stats['completed']}", {"confident": True})

    if "hatalı" in ql or "error" in ql:
        return (f"Hatalı işten çıkış sayısı: {stats['error']}", {"confident": True})

    if "başarı oran" in ql or "basari oran" in ql:
        return (f"Başarı oranı: {stats['success_rate']:.1f}%", {"confident": True})

    if "ortalama" in ql and ("süre" in ql or "sure" in ql):
        return (f"Ortalama işlem süresi: {stats['avg_sec']:.1f} sn", {"confident": True})

    if "toplam süre" in ql or "toplam sure" in ql:
        hours = stats["total_sec"] / SECONDS_PER_HOUR
        return (f"Toplam süre: {hours:.1f} saat", {"confident": True})

    if "günlük" in ql and ("ortalama" in ql or "ort" in ql):
        return (f"Günlük ortalama işten çıkış: {stats['daily_avg']:.1f}", {"confident": True})

    if "fte" in ql:
        return (f"FTE tasarrufu: {stats['fte_saved']:.2f}", {"confident": True})

    if "kazanılan" in ql or "kazanim" in ql or "kazanım" in ql:
        return (f"Manuel kazanılan zaman: {stats['saved_time_hours']:.1f} saat", {"confident": True})

    if "çıkış nedeni" in ql or "cikis nedeni" in ql:
        top = stats["top_cikis_nedeni"]
        lines = [f"- {CIKIS_NEDENI_MAP.get(k, k)} ({v})" for k, v in top]
        return ("Top çıkış nedenleri:\n" + "\n".join(lines), {"confident": True})

    if "en yoğun pozisyon" in ql or ("pozisyon" in ql and "en" in ql):
        top = stats["top_pozisyon"][0] if stats["top_pozisyon"] else ("-", 0)
        return (f"En yoğun pozisyon: {top[0]} ({top[1]} kayıt)", {"confident": True})

    if "en yoğun işyeri" in ql or ("isyeri" in ql and "en" in ql) or ("işyeri" in ql and "en" in ql):
        top = stats["top_isyeri"][0] if stats["top_isyeri"] else ("-", 0)
        return (f"En yoğun işyeri: {top[0]} ({top[1]} kayıt)", {"confident": True})

    if "tarih" in ql and ("aral" in ql or "range" in ql):
        return (
            f"Veri tarih aralığı: {stats['date_min']} - {stats['date_max']}",
            {"confident": True},
        )

    return (
        "Şu an temel metrikleri yanıtlayabiliyorum. Örnek: 'Toplam kayıt', 'Başarı oranı', 'En yoğun pozisyon', 'Çıkış nedeni'.",
        {"confident": False},
    )


def build_context(stats):
    def fmt_top(items):
        return ", ".join([f"{k} ({v})" for k, v in items]) if items else "-"

    return (
        f"Toplam: {stats['total']}, Başarılı: {stats['completed']}, Hatalı: {stats['error']}, "
        f"Başarı Oranı: {stats['success_rate']:.1f}%.\n"
        f"Tarih aralığı: {stats['date_min']} - {stats['date_max']}.\n"
        f"Ortalama süre: {stats['avg_sec']:.1f} sn, Toplam süre: {stats['total_sec'] / SECONDS_PER_HOUR:.1f} saat.\n"
        f"Günlük ortalama: {stats['daily_avg']:.1f}.\n"
        f"En yoğun çıkış nedenleri: {fmt_top(stats['top_cikis_nedeni'])}.\n"
        f"En yoğun pozisyonlar: {fmt_top(stats['top_pozisyon'])}.\n"
        f"En yoğun işyerleri: {fmt_top(stats['top_isyeri'])}."
    )


DATA = load_data()
STATS = compute_stats(DATA)
UNIQ_ISYERI = sorted({r.get("isyeri") for r in DATA if r.get("isyeri")})
UNIQ_POZISYON = sorted({r.get("pozisyon_clean") for r in DATA if r.get("pozisyon_clean")})
LATEST_MONTH = compute_latest_month_summary(DATA)

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
client = OpenAI() if OpenAI and os.getenv("OPENAI_API_KEY") else None


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.post("/api/chat")
def api_chat():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()

    if not question:
        return jsonify({"answer": "Soru boş olamaz."}), 400

    answer, meta = answer_from_data(question, DATA, STATS, UNIQ_ISYERI, UNIQ_POZISYON)
    used_openai = False
    openai_error = None

    if not meta.get("confident") and client:
        context = build_context(STATS)
        system = (
            "Sen SGK işten çıkış dashboard verileri hakkında yardım eden bir asistansın. "
            "Sadece verilen özet veriye dayan ve emin olmadığın yerde açıkça belirt."
        )
        prompt = f"Kontekst:\n{context}\n\nSoru: {question}"
        try:
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            )
            answer = (resp.choices[0].message.content or "").strip() or answer
            used_openai = True
        except Exception as e:
            openai_error = str(e)
    elif not client:
        openai_error = "OpenAI istemcisi başlatılamadı. OPENAI_API_KEY ayarlı mı?"

    return jsonify({"answer": answer, "used_openai": used_openai, "openai_error": openai_error})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001, debug=True)

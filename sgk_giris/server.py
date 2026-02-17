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
DATA_PATH = os.path.join(BASE_DIR, "src", "data.json")
SUMMARY_PATH = os.path.join(BASE_DIR, "src", "monthly_summary.txt")

MANUAL_TIME_SECONDS = 240
WORKING_HOURS_PER_DAY = 8
WORKING_DAYS_PER_MONTH = 22
SECONDS_PER_HOUR = 3600
TOTAL_WORKING_SECONDS_PER_MONTH = WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * SECONDS_PER_HOUR

app = Flask(__name__, static_folder="src", static_url_path="/src")


def safe_float(v):
    try:
        n = float(v)
        return n if isfinite(n) else 0.0
    except Exception:
        return 0.0


def clean_departman(departman):
    if not departman or not isinstance(departman, str):
        return ""
    trimmed = departman.strip()
    dot_index = trimmed.find(".")
    if dot_index != -1 and dot_index < len(trimmed) - 1:
        return trimmed[dot_index + 1 :].strip()
    return trimmed


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


def classify_error_label(error_comment):
    s = (error_comment or "").strip()
    if not s:
        return "Bilinmeyen hata"

    if s.startswith("SYS") or s.startswith("BUS"):
        idx = s.find(":")
        if idx != -1:
            desc = s[idx + 1 :].strip()
            return desc or s
        return s

    dot_idx = s.find(". ")
    if dot_idx != -1 and dot_idx < 60:
        return s[: dot_idx + 1]
    return s[:57] + "..." if len(s) > 60 else s


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
        rr["departman_clean"] = clean_departman(rr.get("departman"))
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

    error_types = {}
    for r in rows:
        if r.get("status") != "ERROR":
            continue
        label = classify_error_label(r.get("error_comment"))
        error_types[label] = error_types.get(label, 0) + 1
    top_errors = sorted(error_types.items(), key=lambda x: x[1], reverse=True)[:5]

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
        "top_departman": top_counts(rows, "departman_clean", 5),
        "top_pozisyon": top_counts(rows, "pozisyon_clean", 5),
        "top_isyeri": top_counts(rows, "isyeri", 5),
        "top_errors": top_errors,
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


def answer_from_data(question, rows, stats, uniq_isyeri, uniq_departman, uniq_pozisyon):
    q = (question or "").strip()
    ql = q.lower()

    isyeri = None
    if "isyeri" in ql or "işyeri" in ql or "hastane" in ql:
        isyeri = find_known_value(ql, uniq_isyeri)

    departman = None
    if "departman" in ql:
        departman = find_known_value(ql, uniq_departman)

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

    if departman:
        subset = [r for r in rows if r.get("departman_clean") == departman]
        total, completed, error = subset_stats(subset)
        return (
            f"{departman} departmanı için toplam kayıt: {total}. Başarılı: {completed}, Hatalı: {error}.",
            {"confident": True, "matched": "departman", "value": departman},
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
        return (f"Başarılı işe giriş sayısı: {stats['completed']}", {"confident": True})

    if "hatalı" in ql or "error" in ql:
        return (f"Hatalı işe giriş sayısı: {stats['error']}", {"confident": True})

    if "başarı oran" in ql or "basari oran" in ql:
        return (f"Başarı oranı: {stats['success_rate']:.1f}%", {"confident": True})

    if "ortalama" in ql and ("süre" in ql or "sure" in ql):
        return (f"Ortalama işlem süresi: {stats['avg_sec']:.1f} sn", {"confident": True})

    if "toplam süre" in ql or "toplam sure" in ql:
        hours = stats["total_sec"] / SECONDS_PER_HOUR
        return (f"Toplam süre: {hours:.1f} saat", {"confident": True})

    if "günlük" in ql and ("ortalama" in ql or "ort" in ql):
        return (f"Günlük ortalama işe giriş: {stats['daily_avg']:.1f}", {"confident": True})

    if "fte" in ql:
        return (f"FTE tasarrufu: {stats['fte_saved']:.2f}", {"confident": True})

    if "kazanılan" in ql or "kazanim" in ql or "kazanım" in ql:
        return (f"Manuel kazanılan zaman: {stats['saved_time_hours']:.1f} saat", {"confident": True})

    if "bu ay" in ql and ("özet" in ql or "ozet" in ql):
        if MONTHLY_SUMMARY_TEXT:
            return (MONTHLY_SUMMARY_TEXT, {"confident": True})
        return ("Bu ay özeti için yeterli veri yok.", {"confident": True})

    if "en yoğun departman" in ql or ("departman" in ql and "en" in ql):
        top = stats["top_departman"][0] if stats["top_departman"] else ("-", 0)
        return (f"En yoğun departman: {top[0]} ({top[1]} kayıt)", {"confident": True})

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

    if "hata" in ql and ("neden" in ql or "sebep" in ql or "tip" in ql):
        lines = [f"- {k} ({v})" for k, v in stats["top_errors"]]
        return ("Top hata nedenleri:\n" + "\n".join(lines), {"confident": True})

    return (
        "Şu an temel metrikleri yanıtlayabiliyorum. Örnek: 'Toplam kayıt', 'Başarı oranı', 'En yoğun departman'.",
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
        f"En yoğun departmanlar: {fmt_top(stats['top_departman'])}.\n"
        f"En yoğun pozisyonlar: {fmt_top(stats['top_pozisyon'])}.\n"
        f"En yoğun işyerleri: {fmt_top(stats['top_isyeri'])}.\n"
        f"Top hata nedenleri: {fmt_top(stats['top_errors'])}."
    )


DATA = load_data()
STATS = compute_stats(DATA)
UNIQ_ISYERI = sorted({r.get("isyeri") for r in DATA if r.get("isyeri")})
UNIQ_DEPARTMAN = sorted({r.get("departman_clean") for r in DATA if r.get("departman_clean")})
UNIQ_POZISYON = sorted({r.get("pozisyon_clean") for r in DATA if r.get("pozisyon_clean")})
LATEST_MONTH = compute_latest_month_summary(DATA)
try:
    with open(SUMMARY_PATH, "r", encoding="utf-8") as f:
        MONTHLY_SUMMARY_TEXT = f.read().strip()
except Exception:
    MONTHLY_SUMMARY_TEXT = ""

OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.2")
client = OpenAI() if OpenAI and os.getenv("OPENAI_API_KEY") else None


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/chat")
def chat():
    from flask import redirect
    return redirect("/ai")


# ── AI Interpreter sayfası ──
AI_DIR = os.path.join(BASE_DIR, "..", "ai")
CIKIS_SRC = os.path.join(BASE_DIR, "..", "sgk_cıkıs", "src")


@app.get("/ai")
@app.get("/ai/")
def ai_page():
    return send_from_directory(AI_DIR, "interpreter.html")


@app.get("/ai/<path:filename>")
def ai_static(filename):
    return send_from_directory(AI_DIR, filename)


@app.get("/src/datacikis.json")
def serve_datacikis():
    return send_from_directory(CIKIS_SRC, "datacikis.json")


@app.post("/api/chat")
def api_chat():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()

    if not question:
        return jsonify({"answer": "Soru boş olamaz."}), 400

    answer, meta = answer_from_data(question, DATA, STATS, UNIQ_ISYERI, UNIQ_DEPARTMAN, UNIQ_POZISYON)
    used_openai = False
    openai_error = None

    if not meta.get("confident") and client:
        context = build_context(STATS)
        system = (
            "Sen SGK işe giriş dashboard verileri hakkında yardım eden bir asistansın. "
            "Sadece verilen özet veriye dayan ve emin olmadığın yerde açıkça belirt."
        )
        prompt = f"Kontekst:\n{context}\n\nSoru: {question}"
        try:
            resp = client.responses.create(
                model=OPENAI_MODEL,
                instructions=system,
                input=prompt,
            )
            answer = (resp.output_text or "").strip() or answer
            used_openai = True
        except Exception as e:
            openai_error = str(e)
    elif not client:
        openai_error = "OpenAI istemcisi başlatılamadı. OPENAI_API_KEY ayarlı mı?"

    return jsonify({"answer": answer, "used_openai": used_openai, "openai_error": openai_error})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

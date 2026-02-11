export function uniqSorted(arr) {
  return Array.from(new Set(arr)).filter(Boolean).sort((a,b) => String(a).localeCompare(String(b), "tr"));
}

export function inRange(dateKey, from, to) {
  // dateKey: "YYYY-MM-DD"
  if (!dateKey) return false;
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

export function applyFilters(data, f) {
  return data.filter(r => {
    if (!inRange(r.date_key, f.from, f.to)) return false;
    if (f.isyeri !== "ALL" && r.isyeri !== f.isyeri) return false;
    if (f.departman !== "ALL" && r.departman !== f.departman) return false;
    if (f.status !== "ALL" && r.status !== f.status) return false;
    return true;
  });
}

export function kpis(rows) {
  const total = rows.length;
  const completed = rows.filter(x => x.status === "COMPLETED").length;
  const error = rows.filter(x => x.status === "ERROR").length;

  const durations = rows
    .map(x => Number(x.duration_sec))
    .filter(n => Number.isFinite(n) && n >= 0)
    .sort((a,b) => a-b);

  const sum = durations.reduce((a,b)=>a+b,0);
  const avg = durations.length ? sum / durations.length : 0;

  const p95 = durations.length ? percentile(durations, 0.95) : 0;

  const successRate = total ? (completed / total) * 100 : 0;

  return { total, completed, error, successRate, avg, p95 };
}

function percentile(sortedArr, p) {
  // sortedArr ascending
  const n = sortedArr.length;
  if (n === 0) return 0;
  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const w = idx - lo;
  return sortedArr[lo] * (1 - w) + sortedArr[hi] * w;
}

export function dailyTrend(rows) {
  // return [{date_key, completed, error}]
  const map = new Map();
  for (const r of rows) {
    const k = r.date_key;
    if (!k) continue;
    if (!map.has(k)) map.set(k, { date_key: k, completed: 0, error: 0 });
    const o = map.get(k);
    if (r.status === "COMPLETED") o.completed++;
    else if (r.status === "ERROR") o.error++;
  }
  return Array.from(map.values()).sort((a,b)=>a.date_key.localeCompare(b.date_key));
}

export function topErrorsByIşyeri(rows, topN=10) {
  const map = new Map();
  for (const r of rows) {
    if (r.status !== "ERROR") continue;
    const k = r.isyeri || "—";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a,b)=>b.value-a.value)
    .slice(0, topN);
}

// SGK Dashboard - tek kaynak: ./data.json
// Yükle butonu yok. Sayfa açılınca fetch eder, filtre + widget + tabloyu basar.

const DATA_URL = "./src/data.json";
const SLA_SECONDS = 60;

// Manuel işlem süresi varsayımı (saniye)
const MANUAL_TIME_SECONDS = 240; // 4 dakika

// FTE hesaplama sabitleri
const WORKING_HOURS_PER_DAY = 8;
const WORKING_DAYS_PER_MONTH = 22;
const SECONDS_PER_HOUR = 3600;
const TOTAL_WORKING_SECONDS_PER_MONTH = WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH * SECONDS_PER_HOUR;

let raw = [];
let filtered = [];

const el = (id) => document.getElementById(id);

function safeNum(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toPct(n){ return `${(n*100).toFixed(1)}%`; }

function fmtInt(n){
  return new Intl.NumberFormat("tr-TR").format(n);
}

function fmt2(n){
  return new Intl.NumberFormat("tr-TR",{maximumFractionDigits:2}).format(n);
}

function percentile(values, p){
  if(!values.length) return 0;
  const arr = [...values].sort((a,b)=>a-b);
  const idx = Math.ceil((p/100)*arr.length)-1;
  return arr[Math.max(0, Math.min(arr.length-1, idx))];
}

function uniq(list){
  return [...new Set(list.filter(x => x !== undefined && x !== null && String(x).trim() !== ""))];
}

function parseHour(iso){
  // "2026-01-31T11:48:53"
  if(!iso || typeof iso !== "string") return null;
  const t = iso.split("T")[1];
  if(!t) return null;
  const hh = t.slice(0,2);
  const h = Number(hh);
  return Number.isFinite(h) ? h : null;
}

// ── Data cleaning utilities ──
function cleanDepartman(departman) {
  if (!departman || typeof departman !== 'string') return '';
  const trimmed = departman.trim();
  const dotIndex = trimmed.indexOf('.');
  if (dotIndex !== -1 && dotIndex < trimmed.length - 1) {
    return trimmed.substring(dotIndex + 1).trim();
  }
  return trimmed;
}

function cleanPozisyon(pozisyon) {
  if (!pozisyon || typeof pozisyon !== 'string') return '';
  let cleaned = pozisyon.trim();
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1 && dotIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(dotIndex + 1).trim();
  }
  if (cleaned.endsWith('.')) {
    cleaned = cleaned.substring(0, cleaned.length - 1).trim();
  }
  return cleaned;
}

// Hata açıklamasını grupla:
// "BUS100: Kişinin kaydı daha önce yapılmış." → "Kişinin kaydı daha önce yapılmış."
// "SYS105 : Onay ekranlarında obje bulunamadı." → "Onay ekranlarında obje bulunamadı."
// "Mailbox unavailable. The server …"          → "Mailbox unavailable."  (ilk cümle)
function classifyErrorLabel(r){
  const s = (r.error_comment || "").toString().trim();
  if(!s) return "Bilinmeyen hata";

  // SYS / BUS kodlu mu? → ilk ":" sonrası alın
  if(/^(SYS|BUS)\s*\d/i.test(s)){
    const idx = s.indexOf(":");
    if(idx !== -1){
      const desc = s.slice(idx+1).trim();
      return desc || s; // boş kalırsa orijinal
    }
    return s;
  }

  // Diğer mesajlar → ilk cümle (nokta + boşluk veya sona kadar)
  const dotIdx = s.indexOf(". ");
  if(dotIdx !== -1 && dotIdx < 60) return s.slice(0, dotIdx+1);

  // 60 char'dan uzunsa truncate
  return s.length > 60 ? s.slice(0,57) + "…" : s;
}

function setSelectOptions(selectEl, values, placeholder="Hepsi"){
  const prev = selectEl.value;
  selectEl.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = placeholder;
  selectEl.appendChild(o0);

  values.forEach(v=>{
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    selectEl.appendChild(o);
  });

  // try restore
  if([...selectEl.options].some(o => o.value === prev)) selectEl.value = prev;
}

function applyFilters(){
  const dateRange = window.selectedDateRange || null; // [startDate, endDate] or null
  const fIsyeri = el("fIsyeri").value;
  const fDepartman = el("fDepartman").value;
  const fStatus = el("fStatus").value;
  const q = (el("fSearch").value || "").trim().toLowerCase();

  filtered = raw.filter(r=>{
    // Date range filter (check if r.date_key is within range)
    if(dateRange && dateRange.length === 2){
      const [start, end] = dateRange;
      const rDate = r.date_key || "";
      if(rDate < start || rDate > end) return false;
    }
    
    if(fIsyeri && r.isyeri !== fIsyeri) return false;
    if(fDepartman && r.departman_clean !== fDepartman) return false;
    if(fStatus && r.status !== fStatus) return false;

    if(q){
      const hay = [
        r.ad, r.soyad, r.unvan, r.pozisyon,
        r.departman, r.isyeri, r.meslek_kodu,
        r.egitim, r.calisan_kategori, r.gorev_kategori,
        r.error_comment
      ].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  renderAll();
}

function renderKPIs(){
  const total = filtered.length;
  const completed = filtered.filter(x=>x.status==="COMPLETED").length;
  const error = filtered.filter(x=>x.status==="ERROR").length;

  // All durations
  const durations = filtered.map(x=>safeNum(x.duration_sec)).filter(n=>n>0);
  const totalSec = durations.reduce((a,b)=>a+b,0);
  const totalHours = totalSec / 3600; // Convert to hours
  
  // Average duration
  const avg = durations.length ? totalSec/durations.length : 0;

  // Success/Error time splits
  const successDurations = filtered.filter(x=>x.status==="COMPLETED").map(x=>safeNum(x.duration_sec));
  const errorDurations = filtered.filter(x=>x.status==="ERROR").map(x=>safeNum(x.duration_sec));
  const successTotalSec = successDurations.reduce((a,b)=>a+b,0);
  const errorTotalSec = errorDurations.reduce((a,b)=>a+b,0);
  const successTotalHours = successTotalSec / 3600;
  const errorTotalHours = errorTotalSec / 3600;

  // Daily average (based on unique date_keys in filtered data)
  const uniqueDates = new Set(filtered.map(r=>r.date_key).filter(Boolean));
  const dayCount = uniqueDates.size || 1;
  const dailyAvg = total / dayCount;

  // FTE ve Manuel Tasarruf Hesaplamaları
  // Manuel toplam süre = işlem sayısı × manuel süre varsayımı
  const manualTotalSec = total * MANUAL_TIME_SECONDS;
  
  // RPA toplam süre = gerçek işlem süreleri toplamı
  const rpaTotalSec = totalSec;
  
  // Kazanılan zaman = manuel - RPA
  const savedTimeSec = manualTotalSec - rpaTotalSec;
  const savedTimeHours = savedTimeSec / 3600;
  
  // FTE Tasarrufu = Kazanılan zaman / Aylık çalışma süresi
  const fteSaved = savedTimeSec / TOTAL_WORKING_SECONDS_PER_MONTH;

  el("kpiTotal").textContent = fmtInt(total);
  el("kpiCompleted").textContent = fmtInt(completed);
  el("kpiError").textContent = fmtInt(error);

  el("kpiSuccessRate").textContent = total ? toPct(completed/total) : "-";

  // Total time in hours
  el("kpiTotalTime").textContent = `${fmt2(totalHours)} saat`;
  el("kpiTotalSecHint").textContent = totalSec ? `${fmtInt(totalSec)} sn` : "";

  // Avg duration
  el("kpiAvgDuration").textContent = fmt2(avg);

  // Success/Error times
  el("kpiSuccessTime").textContent = `${fmt2(successTotalHours)} saat`;
  el("kpiErrorTime").textContent = `${fmt2(errorTotalHours)} saat`;

  // Daily average
  el("kpiDailyAvg").textContent = fmt2(dailyAvg);
  
  // FTE Tasarrufu (yeni)
  el("kpiFTE").textContent = fmt2(fteSaved);
  el("kpiFTEHint").textContent = `${fmt2(savedTimeHours)} saat tasarruf`;
  
  // Manuel Kazanılan Zaman (yeni)
  el("kpiSavedTime").textContent = `${fmt2(savedTimeHours)} saat`;
  el("kpiSavedTimeHint").textContent = `${fmtInt(savedTimeSec)} sn`;
}

function renderBars(containerId, items, valueFormatter=(v)=>fmtInt(v)){
  const host = el(containerId);
  host.innerHTML = "";
  if(!items.length){
    host.innerHTML = `<div class="hint">Veri yok</div>`;
    return;
  }
  const max = Math.max(...items.map(x=>x.value), 1);
  items.forEach(it=>{
    const row = document.createElement("div");
    row.className = "bar-row";

    const name = document.createElement("div");
    name.className = "bar-name";
    name.title = it.name;
    name.textContent = it.name;

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = `${(it.value/max)*100}%`;
    bar.appendChild(fill);

    const val = document.createElement("div");
    val.className = "bar-val";
    val.textContent = valueFormatter(it.value);

    row.appendChild(name);
    row.appendChild(bar);
    row.appendChild(val);

    host.appendChild(row);
  });
}

// ── Line-chart range state ──
let trendRangeDays = 15;

function renderTrendChart(){
  const byDate = new Map();
  filtered.forEach(r=>{
    const k = r.date_key || "UNKNOWN";
    if(!byDate.has(k)) byDate.set(k, { total:0, err:0 });
    const o = byDate.get(k);
    o.total += 1;
    if(r.status==="ERROR") o.err += 1;
  });

  let trend = [...byDate.entries()]
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .map(([date, {total, err}])=>({ date, total, err, ok: total - err }));

  // range filter if needed
  if(trendRangeDays > 0 && trend.length > trendRangeDays){
    trend = trend.slice(-trendRangeDays);
  }

  const host = el("wDailyTrend");
  if(!host) return;

  const svg = el("trendSvg");
  if(!svg) return;

  if(!trend.length){
    svg.innerHTML = `<text x="50%" y="50%" text-anchor="middle" fill="#9fb0d0" font-size="13">Veri yok</text>`;
    return;
  }

  const w = host.clientWidth || 800;
  const h = 270; // 200'den 270'e yükseltildi (1/3 daha fazla)
  const padT = 20, padB = 30, padL = 40, padR = 20;
  const gW = w - padL - padR;
  const gH = h - padT - padB;

  svg.setAttribute("width", w);
  svg.setAttribute("height", h);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  svg.innerHTML = "";

  const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
  const grad1 = document.createElementNS("http://www.w3.org/2000/svg","linearGradient");
  grad1.setAttribute("id","gradOk");
  grad1.setAttribute("x1","0%");
  grad1.setAttribute("y1","0%");
  grad1.setAttribute("x2","0%");
  grad1.setAttribute("y2","100%");
  grad1.innerHTML = `<stop offset="0%" stop-color="rgba(96,165,250,0.6)"/>
                     <stop offset="100%" stop-color="rgba(96,165,250,0.05)"/>`;

  const grad2 = document.createElementNS("http://www.w3.org/2000/svg","linearGradient");
  grad2.setAttribute("id","gradErr");
  grad2.setAttribute("x1","0%");
  grad2.setAttribute("y1","0%");
  grad2.setAttribute("x2","0%");
  grad2.setAttribute("y2","100%");
  grad2.innerHTML = `<stop offset="0%" stop-color="rgba(248,113,113,0.5)"/>
                     <stop offset="100%" stop-color="rgba(248,113,113,0.05)"/>`;

  defs.appendChild(grad1);
  defs.appendChild(grad2);
  svg.appendChild(defs);

  const maxVal = Math.max(...trend.map(d => d.total), 1);
  const yScale = (v) => padT + gH - (v/maxVal)*gH;
  const xScale = (i) => padL + (i/(trend.length-1||1))*gW;

  // Yatay grid çizgileri (İşlem Yoğunluğu gibi)
  const gridG = document.createElementNS("http://www.w3.org/2000/svg","g");
  const gridSteps = 5; // 5 yatay çizgi
  for(let i = 0; i <= gridSteps; i++){
    const val = (maxVal / gridSteps) * i;
    const yPos = yScale(val);
    const gridLine = document.createElementNS("http://www.w3.org/2000/svg","line");
    gridLine.setAttribute("x1", padL);
    gridLine.setAttribute("y1", yPos);
    gridLine.setAttribute("x2", padL + gW);
    gridLine.setAttribute("y2", yPos);
    gridLine.setAttribute("stroke", "#d1dce8"); // Daha belirgin gri
    gridLine.setAttribute("stroke-width", "1");
    gridLine.setAttribute("opacity", "0.5");
    gridG.appendChild(gridLine);
  }
  svg.appendChild(gridG);

  // axis lines
  const axisG = document.createElementNS("http://www.w3.org/2000/svg","g");
  const xLine = document.createElementNS("http://www.w3.org/2000/svg","line");
  xLine.setAttribute("x1", padL);
  xLine.setAttribute("y1", padT+gH);
  xLine.setAttribute("x2", padL+gW);
  xLine.setAttribute("y2", padT+gH);
  xLine.setAttribute("stroke","#3b4b6b");
  xLine.setAttribute("stroke-width","1");
  axisG.appendChild(xLine);

  const yLine = document.createElementNS("http://www.w3.org/2000/svg","line");
  yLine.setAttribute("x1", padL);
  yLine.setAttribute("y1", padT);
  yLine.setAttribute("x2", padL);
  yLine.setAttribute("y2", padT+gH);
  yLine.setAttribute("stroke","#3b4b6b");
  yLine.setAttribute("stroke-width","1");
  axisG.appendChild(yLine);
  svg.appendChild(axisG);

  // labels
  const yLabelG = document.createElementNS("http://www.w3.org/2000/svg","g");
  [0, maxVal/2, maxVal].forEach(v=>{
    const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
    txt.setAttribute("x", padL - 8);
    txt.setAttribute("y", yScale(v)+4);
    txt.setAttribute("text-anchor","end");
    txt.setAttribute("fill","#9fb0d0");
    txt.setAttribute("font-size","10");
    txt.textContent = Math.round(v);
    yLabelG.appendChild(txt);
  });
  svg.appendChild(yLabelG);

  const xLabelG = document.createElementNS("http://www.w3.org/2000/svg","g");
  const step = Math.ceil(trend.length/6);
  trend.forEach((d,i)=>{
    if(i % step !== 0 && i !== trend.length-1) return;
    const txt = document.createElementNS("http://www.w3.org/2000/svg","text");
    txt.setAttribute("x", xScale(i));
    txt.setAttribute("y", padT+gH+16);
    txt.setAttribute("text-anchor","middle");
    txt.setAttribute("fill","#9fb0d0");
    txt.setAttribute("font-size","9");
    txt.textContent = d.date.slice(5); // MM-DD
    xLabelG.appendChild(txt);
  });
  svg.appendChild(xLabelG);

  // area + line for OK
  const okPoints = trend.map((d,i)=> [xScale(i), yScale(d.ok)]);
  let dOk = `M ${padL},${padT+gH}`;
  okPoints.forEach(([x,y])=> dOk += ` L ${x},${y}`);
  dOk += ` L ${padL+gW},${padT+gH} Z`;

  const areaOk = document.createElementNS("http://www.w3.org/2000/svg","path");
  areaOk.setAttribute("d", dOk);
  areaOk.setAttribute("fill","url(#gradOk)");
  svg.appendChild(areaOk);

  let lineOk = `M ${okPoints[0][0]},${okPoints[0][1]}`;
  for(let i=1; i<okPoints.length; i++){
    lineOk += ` L ${okPoints[i][0]},${okPoints[i][1]}`;
  }
  const pathOk = document.createElementNS("http://www.w3.org/2000/svg","path");
  pathOk.setAttribute("d", lineOk);
  pathOk.setAttribute("stroke","#60a5fa");
  pathOk.setAttribute("stroke-width","2");
  pathOk.setAttribute("fill","none");
  svg.appendChild(pathOk);

  // area + line for Error
  const errPoints = trend.map((d,i)=> [xScale(i), yScale(d.err)]);
  let dErr = `M ${padL},${padT+gH}`;
  errPoints.forEach(([x,y])=> dErr += ` L ${x},${y}`);
  dErr += ` L ${padL+gW},${padT+gH} Z`;

  const areaErr = document.createElementNS("http://www.w3.org/2000/svg","path");
  areaErr.setAttribute("d", dErr);
  areaErr.setAttribute("fill","url(#gradErr)");
  svg.appendChild(areaErr);

  let lineErr = `M ${errPoints[0][0]},${errPoints[0][1]}`;
  for(let i=1; i<errPoints.length; i++){
    lineErr += ` L ${errPoints[i][0]},${errPoints[i][1]}`;
  }
  const pathErr = document.createElementNS("http://www.w3.org/2000/svg","path");
  pathErr.setAttribute("d", lineErr);
  pathErr.setAttribute("stroke","#f87171");
  pathErr.setAttribute("stroke-width","2");
  pathErr.setAttribute("fill","none");
  svg.appendChild(pathErr);

  // dots + tooltip
  const tooltip = el("trendTooltip");
  trend.forEach((d,i)=>{
    [
      {x:xScale(i), y:yScale(d.ok), color:"#60a5fa", label:"Başarılı"},
      {x:xScale(i), y:yScale(d.err), color:"#f87171", label:"Hatalı"}
    ].forEach(pt=>{
      const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
      circle.setAttribute("cx", pt.x);
      circle.setAttribute("cy", pt.y);
      circle.setAttribute("r", 4);
      circle.setAttribute("fill", pt.color);
      circle.setAttribute("stroke", "#1e2739");
      circle.setAttribute("stroke-width", 2);
      circle.style.cursor = "pointer";
      circle.style.transition = "r 0.2s";

      circle.addEventListener("mouseenter", (e)=>{
        circle.setAttribute("r", 6);
        const val = pt.label === "Başarılı" ? d.ok : d.err;
        tooltip.innerHTML = `<div class="tt-date">${d.date}</div><div class="tt-row"><div class="tt-dot" style="background:${pt.color}"></div><span class="tt-label">${pt.label}:</span> <span class="tt-val">${val}</span></div>`;
        tooltip.classList.add("visible");
        tooltip.style.left = (e.pageX + 10) + "px";
        tooltip.style.top = (e.pageY - 30) + "px";
      });
      circle.addEventListener("mousemove", (e)=>{
        tooltip.style.left = (e.pageX + 10) + "px";
        tooltip.style.top = (e.pageY - 30) + "px";
      });
      circle.addEventListener("mouseleave", ()=>{
        circle.setAttribute("r", 4);
        tooltip.classList.remove("visible");
      });
      svg.appendChild(circle);
    });
  });
}

// ── Hourly distribution chart ──
let hourlyChartInstance = null;

function renderVBarChart(containerId, items, compact=false){
  const host = el(containerId);
  host.innerHTML = "";
  if(!items.length){
    host.innerHTML = `<div class="hint">Veri yok</div>`;
    return;
  }

  const max = Math.max(...items.map(x=>x.value), 1);
  items.forEach((it, idx)=>{
    const col = document.createElement("div");
    col.className = "vbar-col";

    const bar = document.createElement("div");
    bar.className = "vbar-bar";
    const fillHeight = (it.value/max)*100;
    bar.style.height = fillHeight + "%";
    bar.title = `${it.name}: ${fmtInt(it.value)}`;

    const label = document.createElement("div");
    label.className = "vbar-label";
    label.textContent = compact && it.name.length > 20 ? it.name.slice(0,18)+"…" : it.name;
    label.title = it.name;

    const val = document.createElement("div");
    val.className = "vbar-val";
    val.textContent = fmtInt(it.value);

    col.appendChild(val);
    col.appendChild(bar);
    col.appendChild(label);
    host.appendChild(col);
  });
}

function renderHourlyChart(){
  const byHour = new Array(24).fill(0).map(()=>0);
  filtered.forEach(r=>{
    const h = parseHour(r.start_date);
    if(h !== null) byHour[h]++;
  });

  const ctx = el("hourlyChart");
  if(!ctx) return;

  if(hourlyChartInstance) hourlyChartInstance.destroy();

  hourlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: byHour.map((_, i)=> i.toString().padStart(2,'0')+":00"),
      datasets: [{
        label: 'İşlem Sayısı',
        data: byHour,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96, 165, 250, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#1e2739',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          cornerRadius: 8,
          displayColors: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(59, 75, 107, 0.3)',
            drawBorder: false
          },
          ticks: {
            color: '#9fb0d0',
            font: {
              size: 11
            },
            callback: function(value){
              return value + ' işlem';
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#9fb0d0',
            font: {
              size: 10
            },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12
          }
        }
      },
      animation: {
        duration: 1200,
        easing: 'easeInOutQuart'
      }
    }
  });
}

// ── Bubble Grid Chart for Personnel Distribution ──
let bubbleGridChartInstance = null;
let departmentTreemapInstance = null;

function renderBubbleGridChart(){
  // Pozisyonlara göre gruplama
  const positionCount = new Map();
  
  filtered.forEach(r => {
    const pos = r.pozisyon_clean || "Bilinmeyen";
    positionCount.set(pos, (positionCount.get(pos) || 0) + 1);
  });

  // Pozisyonları sayıya göre sırala ve top 30'u al
  const sortedPositions = [...positionCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  // Treemap için points hazırla
  const points = sortedPositions.map(([pos, count]) => {
    // Pozisyon kodu oluştur (kısaltma)
    let code = '';
    if (pos.length <= 12) {
      code = pos;
    } else {
      const words = pos.split(' ');
      if (words.length > 1) {
        // Kelime başharfleri
        code = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
      } else {
        // İlk 3 harf
        code = pos.substring(0, 3).toUpperCase();
      }
    }

    return {
      name: pos,
      y: count,
      attributes: { code: code }
    };
  });

  const chartDiv = el('bubbleGridChart');
  if (!chartDiv) return;

  if (bubbleGridChartInstance) {
    bubbleGridChartInstance.dispose();
  }

  bubbleGridChartInstance = JSC.chart('bubbleGridChart', {
    type: 'treemap',
    title_label_text: 'Pozisyon Dağılımı (Top 30)',
    defaultPoint_tooltip: '%name<br/>Kayıt Sayısı: %yValue',
    defaultPoint_label_text: '%code<br/>%yValue',
    palette: {
      pointValue: '%yValue',
      colors: [
        '#F8C1A8',
        '#EF9198',
        '#E8608A',
        '#C0458A',
        '#8F3192',
        '#63218F',
        '#4B186C',
        '#33104A'
      ],
      colorBar_axis_defaultTick_label_text: '{%value:n0}'
    },
    legend_title_label_text: 'Kayıt Sayısı',
    series: [
      {
        name: 'Pozisyonlar',
        points: points
      }
    ]
  });
}

// ── Render Department Treemap Chart ──
function renderDepartmentTreemapChart(){
  // Departmanlara göre gruplama
  const departmentCount = new Map();
  
  filtered.forEach(r => {
    const dept = r.departman_clean || "Bilinmeyen";
    departmentCount.set(dept, (departmentCount.get(dept) || 0) + 1);
  });

  // Departmanları sayıya göre sırala ve top 30'u al
  const sortedDepartments = [...departmentCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  // Treemap için points hazırla
  const points = sortedDepartments.map(([dept, count]) => {
    // Departman kodu oluştur (kısaltma)
    let code = '';
    if (dept.length <= 12) {
      code = dept;
    } else {
      const words = dept.split(' ');
      if (words.length > 1) {
        // Kelime başharfleri (max 4 harf)
        code = words.map(w => w[0]).join('').substring(0, 4).toUpperCase();
      } else {
        // İlk 3 harf
        code = dept.substring(0, 3).toUpperCase();
      }
    }

    return {
      name: dept,
      y: count,
      attributes: { code: code }
    };
  });

  const chartDiv = el('departmentTreemapChart');
  if (!chartDiv) return;

  if (departmentTreemapInstance) {
    departmentTreemapInstance.dispose();
  }

  departmentTreemapInstance = JSC.chart('departmentTreemapChart', {
    type: 'treemap',
    title_label_text: 'Departman Dağılımı (Top 30)',
    defaultPoint_tooltip: '%name<br/>Kayıt Sayısı: %yValue',
    defaultPoint_label_text: '%code<br/>%yValue',
    palette: {
      pointValue: '%yValue',
      colors: [
        '#C8E6C9',
        '#A5D6A7',
        '#81C784',
        '#66BB6A',
        '#4CAF50',
        '#43A047',
        '#388E3C',
        '#2E7D32'
      ],
      colorBar_axis_defaultTick_label_text: '{%value:n0}'
    },
    legend_title_label_text: 'Kayıt Sayısı',
    series: [
      {
        name: 'Departmanlar',
        points: points
      }
    ]
  });
}

// ── Personnel distribution: Top Department KPI ──
function renderPersonnelDistribution(){
  // 1) KPI: En yoğun departman
  const byDept = new Map();
  filtered.forEach(r=>{
    const k = r.departman_clean || "Bilinmeyen";
    byDept.set(k, (byDept.get(k)||0) + 1);
  });
  
  const topDept = [...byDept.entries()].sort((a,b)=>b[1]-a[1])[0] || null;
  if(el("kpiTopDept")){
    el("kpiTopDept").textContent = topDept ? topDept[0] : "-";
  }
  if(el("kpiTopDeptHint")){
    const total = filtered.length || 1;
    el("kpiTopDeptHint").textContent = topDept
      ? `${fmtInt(topDept[1])} kayıt • ${toPct(topDept[1]/total)}`
      : "";
  }

  // 1.5) KPI: En yoğun pozisyon
  const byPos = new Map();
  filtered.forEach(r=>{
    const k = r.pozisyon_clean || "Bilinmeyen";
    byPos.set(k, (byPos.get(k)||0) + 1);
  });
  
  const topPos = [...byPos.entries()].sort((a,b)=>b[1]-a[1])[0] || null;
  if(el("kpiTopPos")){
    el("kpiTopPos").textContent = topPos ? topPos[0] : "-";
  }
  if(el("kpiTopPosHint")){
    const total = filtered.length || 1;
    el("kpiTopPosHint").textContent = topPos
      ? `${fmtInt(topPos[1])} kayıt • ${toPct(topPos[1]/total)}`
      : "";
  }

  // 2) Render position treemap chart
  renderBubbleGridChart();
  
  // 3) Render department treemap chart
  renderDepartmentTreemapChart();
}

// ── Pie chart instances ──
let errorIsyeriPieInstance = null;
let successIsyeriPieInstance = null;

function renderIsyeriPieCharts(){
  // Error isyeri pie chart (top 10 hatalı)
  const byIsyeriErr = new Map();
  filtered.filter(r=>r.status==="ERROR").forEach(r=>{
    const k = r.isyeri || "UNKNOWN";
    byIsyeriErr.set(k, (byIsyeriErr.get(k)||0)+1);
  });
  const topErrorIsyeri = [...byIsyeriErr.entries()]
    .sort((a,b)=> b[1]-a[1])
    .slice(0,10);

  // Success isyeri pie chart (top 10 başarılı)
  const byIsyeriSuccess = new Map();
  filtered.filter(r=>r.status==="COMPLETED").forEach(r=>{
    const k = r.isyeri || "UNKNOWN";
    byIsyeriSuccess.set(k, (byIsyeriSuccess.get(k)||0)+1);
  });
  const topSuccessIsyeri = [...byIsyeriSuccess.entries()]
    .sort((a,b)=> b[1]-a[1])
    .slice(0,10);

  // Color palettes
  const errorColors = [
    'rgba(255, 90, 122, 0.8)',
    'rgba(255, 120, 145, 0.8)',
    'rgba(255, 150, 170, 0.8)',
    'rgba(255, 180, 195, 0.8)',
    'rgba(255, 100, 130, 0.7)',
    'rgba(248, 113, 113, 0.7)',
    'rgba(252, 165, 165, 0.7)',
    'rgba(254, 202, 202, 0.7)',
    'rgba(255, 130, 155, 0.6)',
    'rgba(255, 160, 180, 0.6)'
  ];

  const successColors = [
    'rgba(96, 165, 250, 0.8)',
    'rgba(110, 175, 252, 0.8)',
    'rgba(125, 185, 254, 0.8)',
    'rgba(140, 195, 255, 0.8)',
    'rgba(100, 170, 251, 0.7)',
    'rgba(59, 130, 246, 0.7)',
    'rgba(147, 197, 253, 0.7)',
    'rgba(191, 219, 254, 0.7)',
    'rgba(120, 180, 252, 0.6)',
    'rgba(135, 190, 253, 0.6)'
  ];

  // Error pie
  const errCtx = el("errorIsyeriPie");
  if(errCtx){
    if(errorIsyeriPieInstance) errorIsyeriPieInstance.destroy();
    errorIsyeriPieInstance = new Chart(errCtx, {
      type: 'doughnut',
      data: {
        labels: topErrorIsyeri.map(([name,])=>name),
        datasets: [{
          data: topErrorIsyeri.map(([,count])=>count),
          backgroundColor: errorColors.slice(0, topErrorIsyeri.length),
          borderWidth: 2,
          borderColor: '#fff',
          hoverBorderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 11 },
              color: '#5b6b86',
              padding: 8,
              boxWidth: 12,
              boxHeight: 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context){
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a,b)=>a+b,0);
                const percentage = ((value/total)*100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });
  }

  // Success pie
  const succCtx = el("successIsyeriPie");
  if(succCtx){
    if(successIsyeriPieInstance) successIsyeriPieInstance.destroy();
    successIsyeriPieInstance = new Chart(succCtx, {
      type: 'doughnut',
      data: {
        labels: topSuccessIsyeri.map(([name,])=>name),
        datasets: [{
          data: topSuccessIsyeri.map(([,count])=>count),
          backgroundColor: successColors.slice(0, topSuccessIsyeri.length),
          borderWidth: 2,
          borderColor: '#fff',
          hoverBorderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 11 },
              color: '#5b6b86',
              padding: 8,
              boxWidth: 12,
              boxHeight: 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context){
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a,b)=>a+b,0);
                const percentage = ((value/total)*100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });
  }
}

function renderWidgets(){
  // 1) Günlük Trend → SVG line chart
  renderTrendChart();

  // 2) İşlem Yoğunluğu (Saatlik) → Chart.js line chart
  renderHourlyChart();

  // 2.5) Personel Dağılımı (Bubble Grid)
  renderPersonnelDistribution();

  // 2.7) Tarihlere Göre Hastane Giriş Değişimi
  renderHospitalTimeChart();

  // 3) Yoğun Hata Nedenleri – group by description after colon, max 10
  const errLabelCount = new Map();
  filtered.filter(r=>r.status==="ERROR").forEach(r=>{
    const label = classifyErrorLabel(r);
    errLabelCount.set(label, (errLabelCount.get(label)||0)+1);
  });
  const errItems = [...errLabelCount.entries()]
    .sort((a,b)=> b[1]-a[1])
    .slice(0,10)
    .map(([k,v])=> ({ name:k, value:v }));
  renderBars("wErrorTypes", errItems);

  // 4) İşyeri Pie Charts (Error + Success top 10)
  renderIsyeriPieCharts();
}

function renderAll(){
  renderKPIs();
  renderWidgets();
}

function buildFilterLists(){
  // Get unique dates and sort
  const dates = uniq(raw.map(r=>r.date_key)).sort((a,b)=>a.localeCompare(b));
  const isyerleri = uniq(raw.map(r=>r.isyeri)).sort((a,b)=>a.localeCompare(b, "tr"));
  const deps = uniq(raw.map(r=>r.departman_clean)).sort((a,b)=>a.localeCompare(b, "tr"));

  // Initialize Flatpickr date range picker
  if(dates.length > 0){
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    
    flatpickr("#fDateRange", {
      mode: "range",
      dateFormat: "Y-m-d",
      minDate: minDate,
      maxDate: maxDate,
      locale: {
        firstDayOfWeek: 1,
        rangeSeparator: " - "
      },
      onChange: function(selectedDates, dateStr, instance){
        if(selectedDates.length === 2){
          // Format dates as YYYY-MM-DD
          const start = selectedDates[0].toISOString().split('T')[0];
          const end = selectedDates[1].toISOString().split('T')[0];
          window.selectedDateRange = [start, end];
        } else {
          window.selectedDateRange = null;
        }
        applyFilters();
      }
    });
  }

  setSelectOptions(el("fIsyeri"), isyerleri, "Hepsi");
  setSelectOptions(el("fDepartman"), deps, "Hepsi");
}

function resetFilters(){
  // Clear Flatpickr
  const fp = document.querySelector("#fDateRange")._flatpickr;
  if(fp) fp.clear();
  window.selectedDateRange = null;
  
  el("fIsyeri").value = "";
  el("fDepartman").value = "";
  el("fStatus").value = "";
  el("fSearch").value = "";
  applyFilters();
}

function downloadCsv(filename, rows){
  if(!rows.length){
    alert("CSV için veri yok.");
    return;
  }
  // header union
  const headers = Object.keys(rows.reduce((acc,r)=> (Object.keys(r).forEach(k=>acc[k]=1), acc), {}));
  const esc = (v) => {
    const s = (v === null || v === undefined) ? "" : String(v);
    const needs = /[",\n\r]/.test(s);
    const out = s.replace(/"/g,'""');
    return needs ? `"${out}"` : out;
  };
  const csv = [
    headers.join(","),
    ...rows.map(r=> headers.map(h=>esc(r[h])).join(","))
  ].join("\n");

  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function load(){
  try{
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if(!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    if(!Array.isArray(data)) throw new Error("data.json array olmalı: [...]");

    // Clean data: add departman_clean and pozisyon_clean fields
    raw = data.map(record => ({
      ...record,
      departman_clean: cleanDepartman(record.departman),
      pozisyon_clean: cleanPozisyon(record.pozisyon)
    }));
    
    filtered = [...raw];

    buildFilterLists();
    renderAll();

    el("dataInfo").textContent = `Kayıt: ${fmtInt(raw.length)}`;
    el("lastUpdated").textContent = `Güncelleme: ${new Date().toLocaleString("tr-TR")}`;

  }catch(err){
    console.error(err);
    el("dataInfo").textContent = "Veri: HATA";
    el("lastUpdated").textContent = err.message || "Bilinmeyen hata";
    alert("data.json okunamadı. Console'u kontrol et.");
  }
}

function wire(){
  ["fIsyeri","fDepartman","fStatus"].forEach(id=>{
    el(id).addEventListener("change", applyFilters);
  });
  el("fSearch").addEventListener("input", () => {
    // basit debounce
    clearTimeout(window.__t);
    window.__t = setTimeout(applyFilters, 200);
  });

  el("btnReset").addEventListener("click", resetFilters);
  el("btnExportCsv").addEventListener("click", ()=>{
    const name = `sgk_dashboard_${new Date().toISOString().slice(0,10)}.csv`;
    downloadCsv(name, filtered);
  });

  // Trend range pills
  el("trendRangeGroup").addEventListener("click", (e)=>{
    const pill = e.target.closest(".pill");
    if(!pill) return;
    el("trendRangeGroup").querySelectorAll(".pill").forEach(p=>p.classList.remove("active"));
    pill.classList.add("active");
    trendRangeDays = Number(pill.dataset.range);
    renderTrendChart();
  });

  // re-draw SVG on window resize
  let _resT;
  window.addEventListener("resize", ()=>{
    clearTimeout(_resT);
    _resT = setTimeout(renderTrendChart, 140);
  });
}

wire();
load();
// ── Hospital Chart - SIMPLE ANIMATION (without then callback) ──
var hospitalChart, hospitalTimer;
var hospitalStartDate, hospitalEndDate;
var hospitalStopped = true;
var hospitalCurrentDate;

function renderHospitalTimeChart() {
  if (hospitalTimer) {
    clearInterval(hospitalTimer);
    hospitalTimer = null;
  }

  const dateHospitalMap = new Map();
  
  filtered.forEach(r => {
    const date = r.date_key || "UNKNOWN";
    const hospital = r.isyeri || "UNKNOWN";
    
    if (!dateHospitalMap.has(date)) {
      dateHospitalMap.set(date, new Map());
    }
    
    const hospitalMap = dateHospitalMap.get(date);
    hospitalMap.set(hospital, (hospitalMap.get(hospital) || 0) + 1);
  });

  const sortedDates = [...dateHospitalMap.keys()].sort((a, b) => a.localeCompare(b));
  
  if (sortedDates.length === 0) {
    const container = el('hospitalTimeChart');
    if (container) {
      container.innerHTML = '<div class="hint" style="text-align:center; padding:40px;">Veri yok</div>';
    }
    return;
  }

  const hospitalCumulativeMap = new Map();
  const allHospitals = new Set();
  
  dateHospitalMap.forEach(hospitalMap => {
    hospitalMap.forEach((count, hospital) => {
      allHospitals.add(hospital);
    });
  });

  const data = [];
  sortedDates.forEach(date => {
    const obj = { Date: date };
    const hospitalMap = dateHospitalMap.get(date);
    
    allHospitals.forEach(hospital => {
      const currentCount = hospitalMap.get(hospital) || 0;
      const prevTotal = hospitalCumulativeMap.get(hospital) || 0;
      const newTotal = prevTotal + currentCount;
      hospitalCumulativeMap.set(hospital, newTotal);
      obj[hospital] = newTotal;
    });
    
    data.push(obj);
  });

  hospitalStartDate = sortedDates[0];
  hospitalEndDate = sortedDates[sortedDates.length - 1];
  hospitalCurrentDate = hospitalStartDate;

  console.log('Creating chart with', sortedDates.length, 'dates and', allHospitals.size, 'hospitals');

  // Create chart
  hospitalChart = JSC.chart('hospitalTimeChart', {
    type: 'horizontal column solid',
    animation_duration: 300,
    margin_right: 30,
    yAxis: {
      scale_range: { padding: 0.1, min: 0 },
      overflow: 'hidden',
      orientation: 'opposite'
    },
    title: {
      label: {
        margin_bottom: 40,
        text: 'Tarihlere Göre Hastane Giriş Değişimi',
        style_fontSize: 18
      }
    },
    palette: ['#3b82f6'],
    legend: { visible: false },
    defaultPoint: { label_text: '%yValue' },
    defaultSeries_mouseTracking_enabled: false,
    annotations: [{
      id: 'date',
      margin: 10,
      label: {
        text: hospitalStartDate,
        style: { fontSize: 24, fontWeight: 'bold' }
      },
      position: 'inside bottom right'
    }],
    series: getSeriesForDate(data, hospitalCurrentDate),
    toolbar: {
      defaultItem: {
        position: 'inside top',
        offset: '0,-65',
        boxVisible: false,
        margin: 6
      },
      items: {
        slider: {
          type: 'range',
          width: 300,
          debounce: 20,
          value: new Date(hospitalStartDate).getTime(),
          min: new Date(hospitalStartDate).getTime(),
          max: new Date(hospitalEndDate).getTime(),
          events_change: function(val) {
            var dateObj = new Date(val);
            var dateStr = new Date(
              dateObj.getFullYear(),
              dateObj.getMonth(),
              dateObj.getDate()
            ).toISOString().split('T')[0];
            
            var closestDate = sortedDates.reduce(function(prev, curr) {
              return Math.abs(new Date(curr) - new Date(dateStr)) < 
                     Math.abs(new Date(prev) - new Date(dateStr)) ? curr : prev;
            });
            
            hospitalCurrentDate = closestDate;
            updateChart(data, sortedDates);
            hospitalStopped = true;
            updatePlayButton();
          }
        },
        Pause: {
          type: 'option',
          value: true,
          width: 50,
          margin: [6, 6, 6, 16],
          icon_name: 'system/default/play',
          label_text: 'Play',
          events_change: function(val) {
            hospitalStopped = val;
            if (!val) {
              startAnimation(data, sortedDates);
            } else {
              stopAnimation();
            }
          }
        }
      }
    }
  });

  // Auto-start after 500ms
  setTimeout(function() {
    console.log('Auto-starting animation...');
    hospitalStopped = false;
    updatePlayButton();
    startAnimation(data, sortedDates);
  }, 500);

  function getSeriesForDate(data, currentDate) {
    var hospitals = [];
    for (var h in data[0]) {
      if (h !== 'Date') hospitals.push(h);
    }
    
    var currentData = data.find(function(d) { return d.Date === currentDate; });
    if (!currentData) return [{ points: [] }];
    
    var points = [];
    hospitals.forEach(function(h) {
      var val = currentData[h];
      if (val > 0) {
        points.push({ x: h, y: val, id: h });
      }
    });
    
    points.sort(function(a, b) { return b.y - a.y; });
    return [{ points: points.slice(0, 10) }];
  }

  function updateChart(data, sortedDates) {
    hospitalChart.annotations('date').options({ label_text: hospitalCurrentDate });
    hospitalChart.uiItems('slider').options({ 
      value: new Date(hospitalCurrentDate).getTime() 
    });
    hospitalChart.series(0).options(getSeriesForDate(data, hospitalCurrentDate)[0]);
  }

  function updatePlayButton() {
    if (hospitalChart && hospitalChart.uiItems) {
      hospitalChart.uiItems('Pause').options({
        value: hospitalStopped,
        label_text: hospitalStopped ? 'Play' : 'Pause',
        icon_name: hospitalStopped ? 'system/default/play' : 'system/default/pause'
      });
    }
  }

  function startAnimation(data, sortedDates) {
    console.log('Starting animation loop...');
    
    function animateStep() {
      if (hospitalStopped) {
        console.log('Animation stopped');
        return;
      }
      
      var currentIndex = sortedDates.indexOf(hospitalCurrentDate);
      
      if (currentIndex < sortedDates.length - 1) {
        hospitalCurrentDate = sortedDates[currentIndex + 1];
        updateChart(data, sortedDates);
        
        hospitalTimer = setTimeout(animateStep, 250);
      } else {
        console.log('Animation complete - reached end');
        hospitalCurrentDate = hospitalStartDate;
        hospitalStopped = true;
        updatePlayButton();
        updateChart(data, sortedDates);
      }
    }
    
    animateStep();
  }

  function stopAnimation() {
    console.log('Stopping animation');
    if (hospitalTimer) {
      clearTimeout(hospitalTimer);
      hospitalTimer = null;
    }
  }
}
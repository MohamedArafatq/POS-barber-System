let services = JSON.parse(localStorage.getItem("services")) || [];
let products = JSON.parse(localStorage.getItem("products")) || [];
let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let total = 0;

function getInvoices() {
  return JSON.parse(localStorage.getItem("invoices")) || [];
}

const DEFAULT_SHIFT_RESET_TIME = "04:00";
const SHIFT_RESET_TIME_KEY = "shiftResetTime";
const MANUAL_RESET_KEY = "lastManualResetTime";
const AUTO_RESET_KEY = "lastAutoResetTime";
const SHIFT_WATCHER_INTERVAL_MS = 15000;

function getResetTime() {
  const stored = localStorage.getItem(SHIFT_RESET_TIME_KEY);
  if (!stored || !/^\d{1,2}:\d{2}$/.test(stored)) return DEFAULT_SHIFT_RESET_TIME;
  const [hour, minute] = stored.split(":").map(Number);
  if (hour > 23 || minute > 59) return DEFAULT_SHIFT_RESET_TIME;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/* =======================
   SAFE INIT (NO CRASH)
======================= */
document.addEventListener("DOMContentLoaded", () => {
  try {
    setDate();
    startShiftResetWatcher();

    if (document.getElementById("todayTotal")) loadDashboard();
    if (document.getElementById("servicesList")) loadItems();
    if (document.getElementById("servicesBox")) loadSettings();
    if (document.getElementById("invoicesBox")) loadHistory();
    if (document.getElementById("today")) loadReports();
    if (document.getElementById("resetTimeInput")) loadResetTimeSetting();
    if (document.getElementById("daysGridLayout")) loadPreviousDays();
    if (document.getElementById("expensesLogBox")) loadExpensesLog();

    runIntroOnce();
  } catch (err) {
    console.log("ERROR:", err);
  }
});

/* =======================
   DATE & NAV
======================= */
function setDate() {
  const el = document.getElementById("date");
  if (!el) return;
  // 💡 تم إجبار المحرك على طباعة التاريخ باللغة العربية الرسمية (ar-EG) في كل الشاشات أوتوماتيك
  el.innerText = new Date().toLocaleDateString("ar-EG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}


// دالة التنقل بين الصفحات
function goTo(page) {
  if (page) window.location.href = page;
}

/* =======================
   ITEMS & TOTAL
======================= */
function loadItems() {
  const sList = document.getElementById("servicesList");
  const pList = document.getElementById("productsList");
  if (!sList || !pList) return;
  sList.innerHTML = ""; pList.innerHTML = "";

  services.forEach(s => {
    sList.innerHTML += `<div class="item"><span>${s.name} - ${s.price}</span><input type="checkbox" onchange="updateTotal()"></div>`;
  });
  products.forEach(p => {
    pList.innerHTML += `<div class="item"><span>${p.name} - ${p.price}</span><input type="checkbox" onchange="updateTotal()"></div>`;
  });
}

function updateTotal() {
  total = 0;
  document.querySelectorAll(".item").forEach(item => {
    const cb = item.querySelector("input");
    if (!cb || !cb.checked) return;
    const text = item.querySelector("span")?.innerText || "";
    const parts = text.split("-");
    if (parts && parts.length > 1) {
      const priceText = parts[1].trim();
      const cleanPrice = Number(priceText.replace(/[^\d]/g, ""));
      if (!isNaN(cleanPrice)) total += cleanPrice;
    }
  });

  const customInput = document.getElementById("customPrice")?.value;
  const customPrice = Number(customInput);
  if (!isNaN(customPrice) && customPrice > 0) total += customPrice;

  setText("total", total);
}

/* =======================
   SAVE INVOICE (يقرأ عدد الزبائن الفعلي المسجل بالخانة)
======================= */
function saveInvoice() {
  let name = document.getElementById("customerName")?.value;
  const phone = document.getElementById("customerPhone")?.value;
  const barber = document.getElementById("barberName")?.value || "عام";
  const payment = document.getElementById("paymentMethod")?.value || "كاش";
  
  // قراءة الرقم المكتوب جوه خانة عدد الزبائن المخصصة في الفاتورة (ولو فاضية نعتبرها زبون 1)
  const cCountInput = document.getElementById("customerCountInput")?.value;
  const countValue = Number(cCountInput) || 1;

  if (!name || !name.trim()) name = "زبون عابر";

  let selectedItems = [];
  document.querySelectorAll(".item input").forEach(cb => {
    if (cb.checked) selectedItems.push(cb.parentElement.querySelector("span")?.innerText);
  });

  const customInput = document.getElementById("customPrice")?.value;
  if (customInput && Number(customInput) > 0) selectedItems.push(`مبلغ إضافي يدوي: ${customInput} جنيه`);

  const invoice = { name, phone, barber, payment, items: selectedItems, total, customerCount: countValue, date: new Date().toISOString() };
  const old = getInvoices(); old.push(invoice);
  localStorage.setItem("invoices", JSON.stringify(old));

  alert("تم حفظ الفاتورة بنجاح ✔");
  window.location.reload();
    // 💡 إجبار السجل ولوحة التحكم على قراءة وحقن كروت الفواتير الجديدة طيران في نفس اللحظة
  if (typeof loadHistory === "function") loadHistory();
  if (typeof loadDashboard === "function") loadDashboard();

}

/* =======================
   SHIFT LOGIC
======================= */
/* ==========================================================================
   ⏰ SHIFT LOGIC (سيستم الوردية المطور لتثبيت فواتير 17 وتطير فواتير 16)
   ========================================================================== */
function getShiftDateString(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date)) return "";

  // جلب وقت تصفير المحل المعتمد (الساعة 4 الفجر افتراضياً)
  const [rHour, rMinute] = getResetTime().split(":").map(Number);

  const offsetMS = (rHour * 60 + rMinute) * 60 * 1000;
  const shiftDate = new Date(date.getTime() - offsetMS);

  // إرجاع التاريخ بصيغة أرقام صافية (YYYY-MM-DD) عشان يطابق الأرشيف بنجاح وبدون نصوص لخبطة
  const year = shiftDate.getFullYear();
  const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
  const day = String(shiftDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// آخر ميعاد تصفير تلقائي عدى (النهاردة الساعة كذا أو امبارح لو الميعاد لسه ماجاش)
function getScheduledShiftStart(now = new Date()) {
  const [rHour, rMinute] = getResetTime().split(":").map(Number);
  const start = new Date(now);
  start.setHours(rHour, rMinute, 0, 0);
  if (start > now) start.setDate(start.getDate() - 1);
  return start;
}

// ميعاد التصفير التلقائي الجاي
function getNextScheduledShiftReset(now = new Date()) {
  const next = new Date(getScheduledShiftStart(now));
  next.setDate(next.getDate() + 1);
  return next;
}

// بداية الوردية الحالية = الأحدث بين التصفير التلقائي والتصفير اليدوي
function getCurrentShiftStart(now = new Date()) {
  let start = getScheduledShiftStart(now);

  [MANUAL_RESET_KEY, AUTO_RESET_KEY].forEach(key => {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const storedDate = new Date(stored);
    if (!isNaN(storedDate) && storedDate > start && storedDate <= now) start = storedDate;
  });

  return start;
}

function isInvoiceInCurrentShift(dateInput) {
  if (!dateInput) return false;
  const invDate = new Date(dateInput);
  if (isNaN(invDate)) return false;

  // الفاتورة تخص الوردية المفتوحة لو اتعملت بعد آخر تصفير (يدوي كان أو تلقائي)
  return invDate >= getCurrentShiftStart();
}

/* ==========================================================================
   ⏰ DUAL SHIFT RESET (تصفير يدوي بالزرار + تصفير تلقائي في ميعاد محدد يومياً)
   ========================================================================== */
let observedShiftStart = null;
let shiftWatcherId = null;

// تصفير عدادات الوردية والحالات المؤقتة في الشاشات بدون المساس بالسجلات القديمة
function clearActiveShiftState() {
  localStorage.removeItem("filterDayInvoices");

  document.querySelectorAll(".item input[type='checkbox']").forEach(cb => { cb.checked = false; });
  const customPrice = document.getElementById("customPrice");
  if (customPrice) customPrice.value = "";
  total = 0;
  setText("total", 0);

  refreshShiftViews();
}

function refreshShiftViews() {
  if (document.getElementById("todayTotal")) loadDashboard();
  if (document.getElementById("invoicesBox")) loadHistory();
  if (document.getElementById("expensesLogBox")) loadExpensesLog();
  if (document.getElementById("today")) loadReports();
  if (document.getElementById("daysGridLayout")) loadPreviousDays();
  if (document.getElementById("privacyBtn")) applyPrivacyStyle();
  if (document.getElementById("nextAutoResetInfo")) loadResetTimeSetting();
}

// نقطة التصفير الموحدة: اليدوي والتلقائي بيشتغلوا بنفس المنطق بالظبط
function performShiftReset(mode) {
  const now = new Date();
  const stamp = mode === "manual" ? now : getScheduledShiftStart(now);

  localStorage.setItem(mode === "manual" ? MANUAL_RESET_KEY : AUTO_RESET_KEY, stamp.toISOString());
  observedShiftStart = getCurrentShiftStart().getTime();
  clearActiveShiftState();
}

// الحارس الخلفي: بيقارن بداية الوردية كل شوية وينفذ التصفير أول ما الميعاد يعدي
function checkAutomaticShiftReset() {
  const currentStart = getCurrentShiftStart().getTime();
  if (observedShiftStart === null) {
    observedShiftStart = currentStart;
    return;
  }
  if (currentStart === observedShiftStart) return;

  observedShiftStart = currentStart;
  performShiftReset("auto");

  if (typeof showPremiumAlert === "function") {
    showPremiumAlert("تم تصفير الوردية تلقائياً ⏰", `بدأت وردية جديدة في ميعاد ${getResetTime()} وكل السجلات القديمة محفوظة في سجل الأيام.`);
  }
}

function startShiftResetWatcher() {
  observedShiftStart = getCurrentShiftStart().getTime();
  if (shiftWatcherId) clearInterval(shiftWatcherId);
  shiftWatcherId = setInterval(checkAutomaticShiftReset, SHIFT_WATCHER_INTERVAL_MS);
}

// تصدير وتأمين الدوال للويندوز والإلكترون
window.getShiftDateString = getShiftDateString;
window.isInvoiceInCurrentShift = isInvoiceInCurrentShift;
window.getCurrentShiftStart = getCurrentShiftStart;
window.getNextScheduledShiftReset = getNextScheduledShiftReset;



function loadExpensesLog() {
  const box = document.getElementById("expensesLogBox");
  if (!box) return;

  box.innerHTML = "";
  let sum = 0;

  expenses.forEach((exp, i) => {
    if (isInvoiceInCurrentShift(exp.date)) {
      sum += exp.amount;
      const expTime = exp.date ? new Date(exp.date).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' }) : "";
      
      box.innerHTML += `
        <div class="box-item" style="border-color: rgba(239, 68, 68, 0.25); display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;">
          <span>⏰ ${expTime} - <strong>${exp.name}</strong></span>
          <span style="color: #f87171; font-weight: 600;">${exp.amount} جنيه</span>
          <button onclick="deleteQuickExpense(${i})" style="background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.4); border-radius: 5px; padding: 4px 8px; cursor: pointer;">X</button>
        </div>
      `;
    }
  });

  setText("todayExpensesSum", sum);
}

function deleteQuickExpense(i) {
  if (confirm("❓ هل أنت متأكد من حذف هذا المصروف من حسابات اليوم؟")) {
    expenses.splice(i, 1);
    localStorage.setItem("expenses", JSON.stringify(expenses));
    loadExpensesLog();
  }
}

/* =======================
   DAYS ARCHIVE SYSTEM
======================= */
const expandedMonths = new Set();

// تجميع كل الفواتير المحفوظة على مستوى الورديات (اليوم الواحد)
function buildDayStats() {
  const stats = {};

  getInvoices().forEach(inv => {
    const dateKey = getShiftDateString(inv.date);
    if (!dateKey) return;
    if (!stats[dateKey]) stats[dateKey] = { revenue: 0, invoices: 0, customers: 0 };

    let cCount = Number(inv.customerCount);
    if (isNaN(cCount) || cCount <= 0) cCount = 1;

    stats[dateKey].revenue += Number(inv.total) || 0;
    stats[dateKey].invoices += 1;
    stats[dateKey].customers += cCount;
  });

  return stats;
}

function getMonthKey(dateKey) {
  return (dateKey || "").slice(0, 7);
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  return label;
}

// تجميع أرقام الشهر كله (الدخل، متوسط الأسبوع، الفواتير، الزبائن)
function buildMonthSummary(monthKey, dayKeys, dayStats) {
  const summary = { revenue: 0, invoices: 0, customers: 0, days: dayKeys.length, weeklyAverage: 0 };

  dayKeys.forEach(dateKey => {
    const day = dayStats[dateKey];
    summary.revenue += day.revenue;
    summary.invoices += day.invoices;
    summary.customers += day.customers;
  });

  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeksInMonth = daysInMonth / 7;
  summary.weeklyAverage = Math.round(summary.revenue / weeksInMonth);

  return summary;
}

function buildDayCard(dateKey, day) {
  const card = document.createElement("div");
  card.className = "invoice-item day-archive-card";
  card.style.cursor = "pointer";
  card.style.flexDirection = "column";
  card.style.alignItems = "stretch";
  card.onclick = () => showDayDetails(dateKey);

  card.innerHTML = `
    <h3 style="max-width: 100%;">📅 وردية يوم: ${dateKey}</h3>
    <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">🧾 ${day.invoices} فاتورة • 👥 ${day.customers} زبون</p>
    <p style="margin-top: auto; font-size: 20px; font-weight: 700; color: #38bdf8; text-align: left;">
      ${day.revenue} جنيه
    </p>
  `;
  return card;
}

function buildMonthArchiveCard(monthKey, summary) {
  const card = document.createElement("div");
  card.className = "invoice-item month-archive-card";
  card.dataset.month = monthKey;
  card.onclick = () => toggleMonthArchive(monthKey);

  card.innerHTML = `
    <h3 style="max-width: 100%;">🗄️ أرشيف شهر: ${getMonthLabel(monthKey)}</h3>
    <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">📅 ${summary.days} وردية مقفولة • 🧾 ${summary.invoices} فاتورة</p>
    <p style="margin-top: auto; font-size: 20px; font-weight: 700; color: #a78bfa; text-align: left;">
      ${summary.revenue} جنيه
      <span class="month-archive-arrow" style="float: right; font-size: 16px; color: #60a5fa;">▼</span>
    </p>
  `;
  return card;
}

function buildMonthSummaryPanel(summary) {
  return `
    <div class="invoice-section" style="margin-bottom: 18px; background: rgba(96, 165, 250, 0.06); border-color: rgba(96, 165, 250, 0.2);">
      <h2 style="font-size: 18px;">📈 ملخص أداء الشهر بالكامل</h2>
      <div class="reports-grid-layout">
        <div class="reports-card card-today">
          <h3>إجمالي دخل الشهر</h3>
          <p style="color: #38bdf8;">${summary.revenue} جنيه</p>
        </div>
        <div class="reports-card card-week">
          <h3>متوسط الدخل الأسبوعي</h3>
          <p style="color: #34d399;">${summary.weeklyAverage} جنيه</p>
        </div>
        <div class="reports-card card-week">
          <h3>عدد الفواتير</h3>
          <p style="color: #f59e0b;">${summary.invoices}</p>
        </div>
        <div class="reports-card card-week">
          <h3>عدد الزبائن</h3>
          <p style="color: #a78bfa;">${summary.customers}</p>
        </div>
      </div>
    </div>
  `;
}

function buildMonthArchivePanel(monthKey, dayKeys, dayStats, summary) {
  const panel = document.createElement("div");
  panel.className = "month-archive-panel";
  panel.id = `monthPanel-${monthKey}`;

  const inner = document.createElement("div");
  inner.className = "month-archive-inner";
  inner.innerHTML = buildMonthSummaryPanel(summary);

  const daysGrid = document.createElement("div");
  daysGrid.className = "invoices-grid-layout";
  dayKeys.forEach(dateKey => daysGrid.appendChild(buildDayCard(dateKey, dayStats[dateKey])));
  inner.appendChild(daysGrid);

  panel.appendChild(inner);
  return panel;
}

// فتح وقفل كارت الشهر بسلاسة مع إظهار أيامه وملخصه جوه الشبكة
function toggleMonthArchive(monthKey) {
  const panel = document.getElementById(`monthPanel-${monthKey}`);
  const card = document.querySelector(`.month-archive-card[data-month="${monthKey}"]`);
  if (!panel) return;

  if (expandedMonths.has(monthKey)) {
    expandedMonths.delete(monthKey);
    panel.style.maxHeight = `${panel.scrollHeight}px`;
    requestAnimationFrame(() => {
      panel.classList.remove("open");
      panel.style.maxHeight = "0px";
    });
  } else {
    expandedMonths.add(monthKey);
    panel.classList.add("open");
    panel.style.maxHeight = `${panel.scrollHeight}px`;
  }

  if (card) card.classList.toggle("open", expandedMonths.has(monthKey));
}

// فك قفل الارتفاع بعد انتهاء الحركة عشان الكروت متتقصش لو الشاشة اتغيرت
document.addEventListener("transitionend", e => {
  const panel = e.target;
  if (!panel.classList || !panel.classList.contains("month-archive-panel")) return;
  if (panel.classList.contains("open")) panel.style.maxHeight = "none";
});

function loadPreviousDays() {
  const grid = document.getElementById("daysGridLayout");
  if (!grid) return;

  grid.innerHTML = "";

  const dayStats = buildDayStats();
  const dayKeys = Object.keys(dayStats).sort().reverse();

  if (!dayKeys.length) {
    grid.innerHTML = `<div class="invoice-section" style="grid-column: 1 / -1; text-align: center; color: #94a3b8;">لا توجد ورديات محفوظة في الأرشيف حتى الآن.</div>`;
    return;
  }

  // تقسيم الأيام على الشهور، والشهر الحالي بيفضل مفرود يوم بيوم
  const months = {};
  dayKeys.forEach(dateKey => {
    const monthKey = getMonthKey(dateKey);
    if (!months[monthKey]) months[monthKey] = [];
    months[monthKey].push(dateKey);
  });

  const currentMonthKey = getMonthKey(getShiftDateString(new Date().toISOString()));

  Object.keys(months).sort().reverse().forEach(monthKey => {
    const monthDays = months[monthKey];

    if (monthKey === currentMonthKey) {
      monthDays.forEach(dateKey => grid.appendChild(buildDayCard(dateKey, dayStats[dateKey])));
      return;
    }

    // 💡 الشهر اللي خلص بيتلم كله في كارت واحد بيتفتح بالضغط عليه
    const summary = buildMonthSummary(monthKey, monthDays, dayStats);
    grid.appendChild(buildMonthArchiveCard(monthKey, summary));

    const panel = buildMonthArchivePanel(monthKey, monthDays, dayStats, summary);
    grid.appendChild(panel);

    if (expandedMonths.has(monthKey)) {
      panel.classList.add("open");
      panel.style.maxHeight = "none";
      const card = grid.querySelector(`.month-archive-card[data-month="${monthKey}"]`);
      if (card) card.classList.add("open");
    }
  });
}

function showDayDetails(dateKey) {
  const section = document.getElementById("dayDetailsSection");
  if (!section) return;

  const invoices = getInvoices();
  let total = 0, cash = 0, electronic = 0;
  let mahmoud = 0, mohamed = 0, arafa = 0;
  let dayExp = 0;

  invoices.forEach(inv => {
    if (getShiftDateString(inv.date) === dateKey) {
      total += inv.total;
      if (inv.payment === "الكتروني") electronic += inv.total;
      else cash += inv.total;

      if (inv.barber === "محمود") mahmoud += inv.total;
      else if (inv.barber === "محمد") mohamed += inv.total;
      else if (inv.barber === "عرفه") arafa += inv.total;
    }
  });

  expenses.forEach(exp => {
    if (getShiftDateString(exp.date) === dateKey) {
      dayExp += exp.amount;
    }
  });

  const btn = document.getElementById("viewDayInvoicesBtn");
  if (btn) {
    btn.onclick = () => {
      localStorage.setItem("filterDayInvoices", dateKey);
      window.location.href = "history.html";
    };
  }

  setText("detailsTitle", `📊 تفاصيل وردية يوم: ${dateKey}`);
  setText("dTotal", total + " جنيه");
  setText("dExpenses", dayExp + " جنيه");
  setText("dProfit", (total - dayExp) + " جنيه");
  setText("dCash", cash + " جنيه");
  setText("dElectronic", electronic + " جنيه");
  setText("dMahmoud", mahmoud + " جنيه");
  setText("dMohamed", mohamed + " جنيه");
  setText("dArafa", arafa + " جنيه");

  // 💡 حقن سجل فواتير نفس اليوم بالتصميم الكلاسيكي أسفل قسم التفاصيل
  renderDayInvoicesLog(dateKey);

  // 💡 السطر السحري والقاضي: إخفاء شبكة الأيام العلوية والكارت الترحيبي تماماً لتنظيف الشاشة
  toggleDaysArchiveView(false);

  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth" });
}

// إظهار أو إخفاء شبكة الأيام مع الكارت الترحيبي بتاعها مرة واحدة
function toggleDaysArchiveView(visible) {
  const daysGrid = document.getElementById("daysGridLayout");
  if (daysGrid) daysGrid.style.display = visible ? "grid" : "none";

  const introCard = daysGrid ? daysGrid.previousElementSibling : null;
  if (introCard && introCard.classList.contains("invoice-section")) {
    introCard.style.display = visible ? "block" : "none";
  }
}

// سجل فواتير الوردية القديمة بنفس شكل صفحة السجل الأصلي بالظبط
function renderDayInvoicesLog(dateKey) {
  const box = document.getElementById("dayInvoicesLogBox");
  if (!box) return;

  box.innerHTML = "";
  const dayInvoices = getInvoices().filter(inv => getShiftDateString(inv.date) === dateKey);

  const counterEl = document.getElementById("dayInvoicesCount");
  if (counterEl) counterEl.innerText = dayInvoices.length;

  if (!dayInvoices.length) {
    box.innerHTML = `<div class="invoice-section" style="grid-column: 1 / -1; text-align: center; color: #94a3b8;">لا توجد فواتير مسجلة في هذه الوردية.</div>`;
    return;
  }

  dayInvoices.forEach(inv => {
    const div = document.createElement("div");
    div.className = "invoice-item";

    // نفس التنسيق الكلاسيكي المستخدم في سجل الفواتير عشان الشكل ميختلفش
    div.setAttribute("style", "background: rgba(30, 41, 59, 0.45) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border: 1px solid rgba(255, 255, 255, 0.08) !important; border-radius: 16px !important; padding: 20px !important; position: relative !important; display: flex !important; flex-direction: column !important; gap: 8px !important; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important; width: 100% !important; box-sizing: border-box !important; min-height: auto !important; height: auto !important; text-align: right !important; direction: rtl !important;");

    const invTime = inv.date ? new Date(inv.date).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' }) : "";
    const payText = inv.payment === "الكتروني" ? "📱 تحويل" : "💵 كاش";
    const currentInvCount = inv.customerCount || 1;

    div.innerHTML = `
      <h3 style="margin: 0 0 10px 0 !important; font-size: 19px !important; color: #ffffff !important; font-weight: 600 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important; padding-bottom: 6px !important; width: 85% !important; display: block !important;">${inv.name}</h3>
      <p style="margin: 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">👥 عدد زبائن الفاتورة: <strong style="color: #38bdf8 !important;">${currentInvCount}</strong></p>
      <p style="margin: 4px 0 0 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">💈 الحلاق: <strong style="color: #60a5fa !important;">${inv.barber || "عام"}</strong></p>
      <p style="margin: 4px 0 0 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">💳 طريقة الدفع: <strong style="color: #f59e0b !important;">${payText}</strong></p>
      <p style="margin: 4px 0 0 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">⏰ وقت التحرير: <strong>${invTime}</strong></p>
      <p style="margin-top: 8px !important; font-size: 22px !important; font-weight: 700 !important; color: #34d399 !important; border-top: 1px solid rgba(255, 255, 255, 0.05) !important; padding-top: 8px !important; width: 100% !important; display: block !important;">${inv.total} <span style="font-size: 14px !important; font-weight: 500 !important; color: #a7f3d0 !important;">جنيه</span></p>
    `;
    box.appendChild(div);
  });
}


/* =======================
   DASHBOARD & SETTINGS
======================= */
/* ==========================================================================
   📊 3. CALCULATIONS & DASHBOARD (الحسابات المصلحة لخصم المصاريف أوتوماتيك)
   ========================================================================== */
function calculateStats() {
  const invoices = getInvoices();
  // تأمين جلب قائمة المصاريف لمنع القفش
  const expenses = JSON.parse(localStorage.getItem("expenses")) || []; 
  let today = 0, week = 0, month = 0, count = 0, tCustomers = 0;
  let totalExpensesToday = 0; 
  const now = new Date();

  // 1. حساب إجمالي فواتير الزبائن الحالية والقديمة
  invoices.forEach(inv => {
    const d = new Date(inv.date);
    if (isNaN(d)) return;

    if (isInvoiceInCurrentShift(inv.date)) {
      today += inv.total;
      count++;
      let cCount = Number(inv.customerCount);
      if (isNaN(cCount) || cCount <= 0) cCount = 1;
      tCustomers += cCount;
    }
    const diff = (now - d) / 86400000;
    if (diff <= 7) week += inv.total;
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month += inv.total;
  });

  // 2. حساب مصاريف الوردية الحالية بالملي
  expenses.forEach(exp => {
    if (isInvoiceInCurrentShift(exp.date)) {
      totalExpensesToday += Number(exp.amount) || 0;
    }
  });

  // 3. الحسبة السحرية: طرح إجمالي المصاريف من دخل اليوم لتصفية فلوس الدرج الحقيقية بره أوتوماتيك
  today = today - totalExpensesToday;

  return { today, week, month, count, tCustomers };
}


/* ==========================================================================
   💸 دالة حفظ المصاريف اليومية المصلحة والمؤمنة بالملي بطلبك
   ========================================================================== */
/* ==========================================================================
   💸 دالة حفظ المصاريف اليومية المزودة بالـ Reload التلقائي للحماية
   ========================================================================== */
/* ==========================================================================
   💸 دالة حفظ المصاريف اليومية المزودة بالـ Reload التلقائي للحماية
   ========================================================================== */
function saveQuickExpense() {
  const nameInput = document.getElementById("quickExpName");
  const amountInput = document.getElementById("quickExpAmount");
  
  if (!nameInput || !amountInput) return;
  
  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  
  if (!name || isNaN(amount) || amount <= 0) {
    alert("الرجاء إدخال بيان مصروف صحيح ومبلغ أكبر من الصفر!");
    return;
  }
  
  // جلب وحفظ المصروف الجديد بالتاريخ والوقت الفعلي للوردية
  const expenses = JSON.parse(localStorage.getItem("expenses")) || [];
  expenses.push({
    name: name,
    amount: amount,
    date: new Date().toISOString()
  });
  
  localStorage.setItem("expenses", JSON.stringify(expenses));
  
  // تصفير خانات الإدخال فوراً بعد الحفظ
  nameInput.value = "";
  amountInput.value = "";
  
  alert("تم تسجيل خصم المصروف من الدرج بنجاح! 💸");

  // 💡 السطر السحري الخارق: عمل إعادة تحميل فورية للصفحة لمنع الضغط المكرر وحماية الدرج
  window.location.reload();
}

// تصدير الدالة للزرار في الـ HTML
window.saveQuickExpense = saveQuickExpense;




function loadDashboard() {
  const s = calculateStats();
  setText("todayTotal", s.today + " جنيه");
  
  // 💡 كارت عدد الزبائن هيعرض الآن المجموع الفعلي المظبوط (2 زبائن) أوتوماتيك
  setText("todayCount", s.tCustomers);
  
  // كارت عدد الفواتير يعرض فواتير اليوم ويصفر مع الوردية
  setText("invoiceCount", s.count); 
}

function saveResetTime() {
  const input = document.getElementById("resetTimeInput");
  if (!input || !input.value) return alert("⚠️ أرجوك اختار ميعاد التصفير التلقائي الأول");

  localStorage.setItem(SHIFT_RESET_TIME_KEY, input.value);
  observedShiftStart = getCurrentShiftStart().getTime();
  alert("تم حفظ توقيت تصفير الوردية التلقائي بنجاح ⏰");
  window.location.reload();
}

function loadResetTimeSetting() {
  const input = document.getElementById("resetTimeInput");
  if (input) input.value = getResetTime();

  const info = document.getElementById("nextAutoResetInfo");
  if (info) {
    const next = getNextScheduledShiftReset();
    info.innerText = `🔄 التصفير التلقائي الجاي: ${next.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })} الساعة ${getResetTime()}`;
  }
}

function addService() {
  const n = document.getElementById("serviceName")?.value; 
  const p = document.getElementById("servicePrice")?.value;
  if (!n.trim()) return alert("⚠️ اكتب اسم الخدمة");
  const priceNum = Number(p); 
  if (!p || isNaN(priceNum) || priceNum < 0) return alert("⚠️ أرجوك أدخل السعر كأرقام فقط وبشكل صحيح");
  
  services.push({ name: n, price: priceNum }); 
  localStorage.setItem("services", JSON.stringify(services));
  alert("تم إضافة الخدمة بنجاح ✔"); 
  window.location.reload();
}

function addProduct() {
  const n = document.getElementById("productName")?.value; 
  const p = document.getElementById("productPrice")?.value;
  if (!n.trim()) return alert("⚠️ اكتب اسم المنتج");
  const priceNum = Number(p); 
  if (!p || isNaN(priceNum) || priceNum < 0) return alert("⚠️ أرجوك أدخل السعر كأرقام فقط وبشكل صحيح");
  
  products.push({ name: n, price: priceNum }); 
  localStorage.setItem("products", JSON.stringify(products));
  alert("تم إضافة المنتج بنجاح ✔"); 
  window.location.reload();
}

function loadSettings() {
  const sBox = document.getElementById("servicesBox"); 
  const pBox = document.getElementById("productsBox");
  if (!sBox || !pBox) return; 
  sBox.innerHTML = ""; 
  pBox.innerHTML = "";
  
  services.forEach((s, i) => { 
    sBox.innerHTML += `<div class="box-item"><span>${s.name} - ${s.price}</span><button onclick="deleteService(${i})">X</button></div>`; 
  });
  products.forEach((p, i) => { 
    pBox.innerHTML += `<div class="box-item"><span>${p.name} - ${p.price}</span><button onclick="deleteProduct(${i})">X</button></div>`; 
  });
}

function deleteService(i) {
  if (confirm("❓ هل أنت متأكد من حذف هذه الخدمة نهائياً؟")) { 
    services.splice(i, 1); 
    localStorage.setItem("services", JSON.stringify(services)); 
    loadSettings(); 
  }
}

function deleteProduct(i) {
  if (confirm("❓ هل أنت متأكد من حذف هذا المنتج نهائياً؟")) { 
    products.splice(i, 1); 
    localStorage.setItem("products", JSON.stringify(products)); 
    loadSettings(); 
  }
}

/* =======================
   HISTORY & REPORTS
======================= */
/* ==========================================================================
   📜 دالة السجل المصلحة (إظهار فواتير اليوم 17 فوراً وإخفاء فواتير يوم 16)
   ========================================================================== */
/* ==========================================================================
   📜 6. HISTORY SYSTEM (تصفير السجل التلقائي مع بقاء الفواتير في سجل الأيام للأبد)
   ========================================================================== */
function loadHistory() {
  const box = document.getElementById("invoicesBox"); 
  if (!box) return; // سطر الأمان لمنع التداخل في الصفحات الأخرى
  
  const invoices = getInvoices(); 
  box.innerHTML = "";

  // متغيّرات حساب عدد فواتير الكاش والتحويل تلقائياً فوق السجل
  let cashCount = 0;
  let elecCount = 0;

  const filterDay = localStorage.getItem("filterDayInvoices");
  const titleEl = document.querySelector(".history-container h1");
  if (filterDay && titleEl) {
    titleEl.innerText = `📜 سجل فواتير وردية يوم: ${filterDay}`;
  } else if (titleEl) {
    titleEl.innerText = `📜 سجل فواتير الوردية الحالية (المفتوحة)`;
  }

  invoices.forEach((inv, i) => {
    // 💡 الفلتر الذكي الحاسم:
    // 1. لو جاي من صفحة سجل الأيام وضغطت على يوم قديم (filterDay)، هيعرض فواتير اليوم ده بس من الأرشيف.
    // 2. لو فتحت سجل الفواتير العادي، هيشغل فحص الوردية ويخفي فواتير امبارح فوراً بمجرد ما ميعاد التصفير ييجي!
    if (filterDay) {
      const invShiftDayStr = getShiftDateString(inv.date);
      if (invShiftDayStr !== filterDay) return;
    } else {
      if (!isInvoiceInCurrentShift(inv.date)) return; // السطر السحري لتصفير السجل بره تلقائياً
    }

    // العداد التلقائي لفرز الكاش والتحويل للوردية الحالية بس فوق السجل
    if (inv.payment === "الكتروني") {
      elecCount++;
    } else {
      cashCount++;
    }

    const div = document.createElement("div"); 
    div.className = "invoice-item";
    
    // التنسيق الكلاسيكي الأصلي القديم بتاعك ثابت ومستقر 100% بدون أي تداخل كلام
    div.setAttribute("style", "background: rgba(30, 41, 59, 0.45) !important; backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important; border: 1px solid rgba(255, 255, 255, 0.08) !important; border-radius: 16px !important; padding: 20px !important; position: relative !important; display: flex !important; flex-direction: column !important; gap: 8px !important; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important; width: 100% !important; box-sizing: border-box !important; min-height: auto !important; height: auto !important; text-align: right !important; direction: rtl !important;");
    
    const invDate = inv.date ? new Date(inv.date).toLocaleDateString("ar-EG") : "";
    const payText = inv.payment === "الكتروني" ? "📱 تحويل" : "💵 كاش";
    const currentInvCount = inv.customerCount || 1;

    div.innerHTML = `
      <button onclick="deleteInvoice(${i})" style="position: absolute !important; top: 15px !important; left: 15px !important; background: rgba(239, 68, 68, 0.1) !important; border: 1px solid rgba(239, 68, 68, 0.2) !important; color: #ef4444 !important; width: 28px !important; height: 28px !important; border-radius: 8px !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; z-index: 100 !important; margin: 0 !important; padding: 0 !important; font-weight: bold !important;">✖</button>
      <h3 style="margin: 0 0 10px 0 !important; font-size: 19px !important; color: #ffffff !important; font-weight: 600 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important; padding-bottom: 6px !important; width: 85% !important; display: block !important;">${inv.name}</h3>
      <p style="margin: 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">👥 عدد زبائن الفاتورة: <strong style="color: #38bdf8 !important;">${currentInvCount}</strong></p>
      <p style="margin: 4px 0 0 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">💈 الحلاق: <strong style="color: #60a5fa !important;">${inv.barber || "عام"}</strong></p>
      <p style="margin: 4px 0 0 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">💳 طريقة الدفع: <strong style="color: #f59e0b !important;">${payText}</strong></p>
      <p style="margin: 4px 0 0 0 !important; padding: 0 !important; font-size: 14px !important; color: #94a3b8 !important; display: block !important;">📅 التحرير: <strong>${invDate}</strong></p>
      <p style="margin-top: 8px !important; font-size: 22px !important; font-weight: 700 !important; color: #34d399 !important; border-top: 1px solid rgba(255, 255, 255, 0.05) !important; padding-top: 8px !important; width: 100% !important; display: block !important;">${inv.total} <span style="font-size: 14px !important; font-weight: 500 !important; color: #a7f3d0 !important;">جنيه</span></p>
    `;
    box.appendChild(div);
  });

  // تحديث خانات فواتير الكاش والتحويل العلوية أوتوماتيك
  const cashEl = document.getElementById("historyCashCount");
  const elecEl = document.getElementById("historyElecCount");
  if (cashEl) cashEl.innerText = cashCount;
  if (elecEl) elecEl.innerText = elecCount;
  
  if (filterDay) localStorage.removeItem("filterDayInvoices");
}

// تصدير وتأمين الدالة للويندوز
window.loadHistory = loadHistory;




// تصدير الدالة المحدثة للويندوز والإلكترون
window.loadHistory = loadHistory;


function deleteInvoice(i) {
  if (confirm("⚠️ تنبيه: هل أنت متأكد من حذف هذه الفاتورة تماماً من الحسابات؟")) { 
    const invoices = getInvoices(); 
    invoices.splice(i, 1); 
    localStorage.setItem("invoices", JSON.stringify(invoices)); 
    loadHistory(); 
  }
}

function loadReports() {
  const invoices = getInvoices(); 
  const now = new Date();
  let today = 0, week = 0, month = 0, all = 0;
  let mahmoudTotal = 0, mohamedTotal = 0, arafaTotal = 0, cashToday = 0, electronicToday = 0;
  let todayExp = 0;
  
  invoices.forEach(inv => {
    const d = new Date(inv.date); 
    if (isNaN(d)) return;
    all += inv.total;
    
    if (isInvoiceInCurrentShift(inv.date)) {
      today += inv.total;
      if (inv.payment === "الكتروني") electronicToday += inv.total; else cashToday += inv.total;
      if (inv.barber === "محمود") mahmoudTotal += inv.total;
      else if (inv.barber === "محمد") mohamedTotal += inv.total;
      else if (inv.barber === "عرفه") arafaTotal += inv.total;
    }
    if ((now - d) / 86400000 <= 7) week += inv.total;
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) month += inv.total;
  });
  
  expenses.forEach(exp => {
    if (isInvoiceInCurrentShift(exp.date)) todayExp += exp.amount;
  });
  
  setText("today", today + " جنيه");
  setText("expensesTotal", todayExp + " جنيه");
  setText("profitTotal", (today - todayExp) + " جنيه");
  setText("week", week + " جنيه");
  setText("month", month + " جنيه");
  setText("all", all + " جنيه");
  setText("cashTotal", cashToday + " جنيه");
  setText("electronicTotal", electronicToday + " جنيه");
  setText("barberMahmoud", mahmoudTotal + " جنيه");
  setText("barberMohamed", mohamedTotal + " جنيه");
  setText("barberArafa", arafaTotal + " جنيه");
}

/* =======================
   UTIL & INTRO
======================= */
function setText(id, val) { 
  const el = document.getElementById(id); 
  if (el) el.innerText = val; 
}

function runIntroOnce() {
  const intro = document.getElementById("intro"); 
  if (!intro) return;
  if (sessionStorage.getItem("introShown")) { 
    intro.remove(); 
    return; 
  }
  sessionStorage.setItem("introShown", "true");
  setTimeout(() => { 
    intro.classList.add("hide"); 
    setTimeout(() => intro.remove(), 800); 
  }, 2000);
}

/* =======================
   EXPORT TO WINDOW
======================= */
window.updateTotal = updateTotal; 
window.saveInvoice = saveInvoice; 
window.addService = addService; 
window.addProduct = addProduct;
window.deleteService = deleteService; 
window.deleteProduct = deleteProduct; 
window.deleteInvoice = deleteInvoice; 
window.goTo = goTo;
window.saveResetTime = saveResetTime; 
window.loadPreviousDays = loadPreviousDays; 
window.saveQuickExpense = saveQuickExpense; 
window.loadExpensesLog = loadExpensesLog; 
window.deleteQuickExpense = deleteQuickExpense;

/* ==========================================================================
   💡 دالة التحكم الذكي في سهم الرجوع لصفحة سجل الأيام
   ========================================================================== */
function handleBackAction() {
  const detailsSection = document.getElementById("dayDetailsSection");

  // لو قسم تفاصيل اليوم مفتوح وظاهر قدام عينك
  if (detailsSection && detailsSection.style.display === "block") {
    detailsSection.style.display = "none"; // إخفاء التفاصيل فوراً
    toggleDaysArchiveView(true); // إعادة إظهار كروت الأيام والشهور كاملة ونظيفة
    window.scrollTo({ top: 0, behavior: "smooth" }); // رفع الشاشة لفوق بسلاسة
  } 
  // لو أنت أصلاً واقف في سجل الأيام بره ومفيش تفاصيل مفتوحة
  else {
    window.location.href = "index.html"; // اخرج فوراً وطير على الداشبورد الرئيسية!
  }
}

// تصدير الدالة للويندوز عشان الإلكترون يلقطها
window.handleBackAction = handleBackAction;
/* ==========================================================================
   🎯 سيستم حقن الدائرة المتوهجة التلقائي والمضمون للقسم النشط
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // جلب اسم الصفحة الحالية بدقة (مثال: settings.html)
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  
  document.querySelectorAll(".sidebar button").forEach(btn => {
    const clickAttr = btn.getAttribute("onclick") || "";
    
    // فحص دقيق: لو أمر الزرار بيحتوي على اسم الصفحة الحالية بالظبط
    if (clickAttr.includes(`'${currentPage}'`) || clickAttr.includes(`"${currentPage}"`)) {
      btn.classList.add("active-page-glow");
    }
  });
});
/* ==========================================================================
   🔒 سيستم الخصوصية وأمان الأرباح الذكي (Privacy Mode) للداشبورد
   ========================================================================== */
let isHiddenMode = localStorage.getItem("privacyMode") === "true";

function togglePrivacyMode() {
  isHiddenMode = !isHiddenMode;
  localStorage.setItem("privacyMode", isHiddenMode);
  applyPrivacyStyle();
}

function applyPrivacyStyle() {
  const privacyBtn = document.getElementById("privacyBtn");
  const todayTotalEl = document.getElementById("todayTotal");
  const invoiceCountEl = document.getElementById("invoiceCount");
  const todayCountEl = document.getElementById("todayCount");

  // جلب القيم الحقيقية المحسوبة حالياً من دالة الحسابات الأصلية بتاعتك
  const stats = calculateStats();

  if (isHiddenMode) {
    // 💡 لو وضع الإخفاء شغال: تحويل الأرقام لشُرط فخمة لحماية الخصوصية
    if (todayTotalEl) todayTotalEl.innerText = "•••• جنيه";
    if (invoiceCountEl) invoiceCountEl.innerText = "••";
    if (todayCountEl) todayCountEl.innerText = "••";
    
    if (privacyBtn) privacyBtn.innerHTML = "👁️‍🗨️ إخفاء الأرقام";
  } else {
    // 💡 لو وضع الإظهار شغال: إعادة الحسابات والأرقام الأصلية فوراً من الدالة بتاعتك
    if (todayTotalEl) todayTotalEl.innerText = stats.today + " جنيه";
    if (invoiceCountEl) invoiceCountEl.innerText = stats.count;
    if (todayCountEl) todayCountEl.innerText = stats.tCustomers;
    
    if (privacyBtn) privacyBtn.innerHTML = "👁️ إظهار الأرقام";
  }
}

// تشغيل الفحص أوتوماتيك أول ما لوحة التحكم تفتح عشان يفتكر الحالة القديمة
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (document.getElementById("privacyBtn")) {
      applyPrivacyStyle();
    }
  }, 150); // تأخير بسيط لضمان تحميل الداتا الأصلية أولاً
});

// تصدير الدوال للويندوز عشان الإلكترون يلقطهم من زرار الـ HTML
window.togglePrivacyMode = togglePrivacyMode;
window.applyPrivacyStyle = applyPrivacyStyle;

/* ==========================================================================
   💎 دالة تشغيل التنبيه الزجاجي الفخم تلقائياً وبدون مكاتب خارجية
   ========================================================================== */
function showPremiumAlert(title, text) {
  const overlay = document.createElement("div");
  overlay.className = "custom-alert-overlay";

  overlay.innerHTML = `
    <div class="custom-alert-box">
      <div style="font-size: 50px; margin-bottom: 12px;">🎉</div>
      <h2>${title}</h2>
      <p>${text}</p>
      <button class="custom-alert-btn" onclick="this.closest('.custom-alert-overlay').remove()">👍 تسلم يا بطل</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // إغلاق التنبيه تلقائياً بعد ثانيتين لإنجاز الوقت
  setTimeout(() => {
    if (overlay) overlay.remove();
  }, 2000);
}

window.showPremiumAlert = showPremiumAlert;

/* ==========================================================================
   🔒 سيستم قفل وتصفير الوردية اليدوي الآمن والمثبت بدقة في الإعدادات بطلبك
   ========================================================================== */
/* ==========================================================================
   🔒 سيستم قفل وتصفير الوردية اليدوي الآمن مع رسالة تأكيد الحماية
   ========================================================================== */
function triggerManualShiftReset() {
  // 💡 رسالة الحماية الذكية: لو دوست إلغاء يقفل ويرجع للشغل فوراً وميلمسش الفلوس
  if (!confirm("🚨 تنبيه حاسم: هل أنت متأكد من قفل الوردية الحالية وتصفير جميع العدادات لبدء وردية جديدة؟")) {
    return; // إيقاف العملية فوراً بأمان كامل
  }

  // لو داس "موافق" (Ok) يتم التصفير الفعلي للوردية بالملي وحفظ التاريخ في جهازك
  performShiftReset("manual");

  alert("🎉 تم قفل الوردية السابقة وتصفير العدادات بنجاح! بدأ عد الوردية الجديدة الحين طيران. 🚀");
  window.location.reload();
}

// تصدير وإتاحة الدوال الجديدة للإلكترون
window.triggerManualShiftReset = triggerManualShiftReset;
window.performShiftReset = performShiftReset;
window.toggleMonthArchive = toggleMonthArchive;
window.showDayDetails = showDayDetails;

/* ══════════════════════════════════════════════
   Финансы — app.js
   ══════════════════════════════════════════════ */

// ── Storage helpers ──────────────────────────
const DB = {
  get(k, def) {
    try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; }
  },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

// ── State ────────────────────────────────────
let state = {
  income:   DB.get('fin_income', []),
  expenses: DB.get('fin_expenses', []),
  goals:    DB.get('fin_goals', []),
  settings: DB.get('fin_settings', {
    currency: '₽',
    theme: 'light',
    weekStart: 'mon',
    incomeCats:  ['Зарплата', 'Фриланс', 'Инвестиции', 'Подарок', 'Прочее'],
    expenseCats: ['Продукты', 'Транспорт', 'ЖКХ', 'Здоровье', 'Развлечения', 'Кафе', 'Одежда', 'Прочее']
  })
};

let dashChartInst = null;

// ── Util ─────────────────────────────────────
const fmt = (n) => {
  const s = state.settings;
  return Number(n).toLocaleString('ru-RU') + ' ' + (s.currency || '₽');
};
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const monthLabel = (d) => new Date(d + '-01').toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
const parseDate = (s) => new Date(s);

function monthsInData() {
  const all = [...state.income, ...state.expenses].map(t => t.date.slice(0, 7));
  const set = [...new Set(all)].sort().reverse();
  if (!set.length) {
    const now = today().slice(0, 7);
    return [now];
  }
  return set;
}

// ── Save ─────────────────────────────────────
function save() {
  DB.set('fin_income', state.income);
  DB.set('fin_expenses', state.expenses);
  DB.set('fin_goals', state.goals);
  DB.set('fin_settings', state.settings);
}

// ── Tab navigation ───────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  localStorage.setItem('fin_active_tab', name);
  refreshTab(name);
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Refresh dispatcher ────────────────────────
function refreshAll() {
  updateSidebar();
  const active = document.querySelector('.tab.active');
  if (active) refreshTab(active.id.replace('tab-', ''));
}

function refreshTab(name) {
  if (name === 'dashboard') renderDashboard();
  if (name === 'income')    renderIncome();
  if (name === 'expenses')  renderExpenses();
  if (name === 'goals')     renderGoals();
  if (name === 'settings')  renderSettings();
}

// ── Sidebar balance ───────────────────────────
function updateSidebar() {
  const inc = state.income.reduce((s, t) => s + Number(t.amount), 0);
  const exp = state.expenses.reduce((s, t) => s + Number(t.amount), 0);
  const bal = inc - exp;
  document.getElementById('sidebarBalance').textContent = fmt(bal);
  document.getElementById('sidebarBalance').style.color =
    bal >= 0 ? 'var(--green)' : 'var(--red)';
}

// ═══════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const now = today().slice(0, 7);

  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const monthInc = state.income.filter(t => t.date.slice(0,7) === now)
    .reduce((s,t) => s + Number(t.amount), 0);
  const monthExp = state.expenses.filter(t => t.date.slice(0,7) === now)
    .reduce((s,t) => s + Number(t.amount), 0);

  document.getElementById('dashIncome').textContent  = fmt(monthInc);
  document.getElementById('dashExpense').textContent = fmt(monthExp);
  document.getElementById('dashBalance').textContent = fmt(monthInc - monthExp);
  document.getElementById('dashGoals').textContent   = state.goals.length;

  // Recent transactions (last 8)
  const all = [
    ...state.income.map(t => ({ ...t, type: 'income' })),
    ...state.expenses.map(t => ({ ...t, type: 'expense' }))
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 8);

  const container = document.getElementById('recentTransactions');
  if (!all.length) {
    container.innerHTML = '<div style="color:var(--text2);text-align:center;padding:24px">Нет операций</div>';
  } else {
    container.innerHTML = all.map(t => `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon ${t.type}">${t.type === 'income' ? '💰' : '💸'}</div>
          <div>
            <div class="tx-desc">${t.desc || t.category}</div>
            <div class="tx-date">${formatDate(t.date)} · ${t.category}</div>
          </div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
      </div>`).join('');
  }

}

const PALETTE = [
  '#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6',
  '#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4'
];

function formatDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function pluralWeeks(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'неделя';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'недели';
  return 'недель';
}

function pluralDays(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

function pluralMonths(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'месяц';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'месяца';
  return 'месяцев';
}

// ═══════════════════════════════════════════════
// INCOME
// ═══════════════════════════════════════════════
function renderIncome() {
  populateMonthFilter('incomeMonthFilter');
  populateCatFilter('incomeCatFilter', state.settings.incomeCats);

  const month = document.getElementById('incomeMonthFilter').value;
  const cat   = document.getElementById('incomeCatFilter').value;

  let rows = state.income.filter(t => (!month || t.date.slice(0,7) === month) && (!cat || t.category === cat));
  rows = rows.slice().sort((a,b) => b.date.localeCompare(a.date));

  const total = rows.reduce((s,t) => s + Number(t.amount), 0);
  document.getElementById('incomeTotalLabel').textContent = fmt(total);

  const tbody = document.getElementById('incomeTableBody');
  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td><span class="cat-badge">${t.category}</span>${t.repeat && t.repeat !== 'none' ? ' <span style="font-size:10px;color:var(--text2)">🔁</span>' : ''}</td>
      <td style="color:var(--green);font-weight:600">+${fmt(t.amount)}</td>
      <td><button class="btn-icon" onclick="deleteTransaction('income','${t.id}')">🗑</button></td>
    </tr>`).join('');

  document.getElementById('incomeEmpty').style.display = rows.length ? 'none' : 'block';
}

function populateMonthFilter(id) {
  const sel = document.getElementById(id);
  const cur = sel.value;
  const months = monthsInData();
  sel.innerHTML = '<option value="">Все месяцы</option>' +
    months.map(m => `<option value="${m}" ${m===cur?'selected':''}>${monthLabel(m)}</option>`).join('');
  if (!sel.value && cur) sel.value = cur;
}

function populateCatFilter(id, cats) {
  const sel = document.getElementById(id);
  const cur = sel.value;
  sel.innerHTML = '<option value="">Все категории</option>' +
    cats.map(c => `<option value="${c}" ${c===cur?'selected':''}>${c}</option>`).join('');
}

// ═══════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════
function renderExpenses() {
  populateMonthFilter('expenseMonthFilter');
  populateCatFilter('expenseCatFilter', state.settings.expenseCats);

  const month = document.getElementById('expenseMonthFilter').value;
  const cat   = document.getElementById('expenseCatFilter').value;

  let rows = state.expenses.filter(t => (!month || t.date.slice(0,7) === month) && (!cat || t.category === cat));
  rows = rows.slice().sort((a,b) => b.date.localeCompare(a.date));

  const total = rows.reduce((s,t) => s + Number(t.amount), 0);
  document.getElementById('expenseTotalLabel').textContent = fmt(total);

  const tbody = document.getElementById('expenseTableBody');
  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td><span class="cat-badge">${t.category}</span>${t.repeat && t.repeat !== 'none' ? ' <span style="font-size:10px;color:var(--text2)">🔁</span>' : ''}</td>
      <td style="color:var(--red);font-weight:600">-${fmt(t.amount)}</td>
      <td><button class="btn-icon" onclick="deleteTransaction('expenses','${t.id}')">🗑</button></td>
    </tr>`).join('');

  document.getElementById('expenseEmpty').style.display = rows.length ? 'none' : 'block';
}

// ── Delete transaction ────────────────────────
window.deleteTransaction = function(type, id) {
  if (!confirm('Удалить запись?')) return;
  state[type] = state[type].filter(t => t.id !== id);
  save();
  refreshAll();
};

// ═══════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════
function renderGoals() {
  const grid = document.getElementById('goalsGrid');
  const empty = document.getElementById('goalsEmpty');

  if (!state.goals.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = state.goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const done = pct >= 100;
    const daysLeft = g.date ? Math.ceil((new Date(g.date) - new Date()) / 86400000) : null;

    // Savings calculation by frequency
    let weeklyBlock = '';
    if (!done && g.date && daysLeft > 0) {
      const remaining = g.target - g.current;
      const freq = g.frequency || 'weekly';
      const FREQ_CONFIG = {
        daily:   { divisor: daysLeft,      label: 'в день',   periodLabel: `ещё ${daysLeft} ${pluralDays(daysLeft)}` },
        weekly:  { divisor: daysLeft / 7,  label: 'в неделю', periodLabel: `ещё ${Math.ceil(daysLeft/7)} ${pluralWeeks(Math.ceil(daysLeft/7))}` },
        monthly: { divisor: daysLeft / 30, label: 'в месяц',  periodLabel: `ещё ${Math.ceil(daysLeft/30)} ${pluralMonths(Math.ceil(daysLeft/30))}` },
      };
      const cfg = FREQ_CONFIG[freq];
      const perPeriod = Math.ceil(remaining / cfg.divisor);
      weeklyBlock = `
        <div class="weekly-save-box">
          <div class="weekly-save-label">Нужно откладывать ${cfg.label}</div>
          <div class="weekly-save-amount" style="color:${g.color}">${fmt(perPeriod)}</div>
          <div class="weekly-save-sub">${cfg.periodLabel} · осталось ${fmt(remaining)}</div>
        </div>`;
    } else if (!done && g.date && daysLeft <= 0) {
      weeklyBlock = `<div class="weekly-save-box weekly-overdue">⚠️ Срок достижения цели истёк</div>`;
    }

    // Reward block
    let rewardBlock = '';
    if (g.rewardText || g.rewardPhoto) {
      rewardBlock = `
        <div class="reward-block ${done ? 'reward-achieved' : ''}">
          <div class="reward-block-title">${done ? '🎉 Ваша награда!' : '🎁 Награда за цель'}</div>
          ${g.rewardPhoto ? `<img src="${g.rewardPhoto}" alt="награда" class="reward-photo" />` : ''}
          ${g.rewardText ? `<div class="reward-text">${g.rewardText}</div>` : ''}
        </div>`;
    }

    return `
      <div class="goal-card">
        <div class="goal-header">
          <div>
            <div class="goal-name">${g.name}</div>
            ${g.date ? `<div class="goal-date">до ${new Date(g.date).toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'})}</div>` : ''}
          </div>
          <div class="goal-actions">
            <button class="btn-icon" onclick="editGoal('${g.id}')" title="Редактировать">✏️</button>
            <button class="btn-icon" onclick="deleteGoal('${g.id}')" title="Удалить">🗑</button>
          </div>
        </div>
        <div style="margin-bottom:6px">
          <span class="goal-current-val" style="color:${g.color}">${fmt(g.current)}</span>
          <span class="goal-target-val"> / ${fmt(g.target)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background:${g.color}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="goal-pct">${pct}% выполнено</span>
        </div>
        ${weeklyBlock}
        ${done ? '<div class="goal-done-badge">✅ Цель достигнута!</div>' : ''}
        ${rewardBlock}
        <div class="goal-btn-row">
          ${!done ? `<button class="btn-deposit" onclick="openDeposit('${g.id}','add')">+ Пополнить</button>` : ''}
          ${!done ? `<button class="btn-deposit btn-withdraw" onclick="openDeposit('${g.id}','sub')">− Снять</button>` : ''}
          <button class="btn-deposit btn-history" onclick="openGoalHistory('${g.id}')">📋 История</button>
        </div>
      </div>`;
  }).join('');
}

window.openGoalHistory = function(id) {
  const g = state.goals.find(g => g.id === id);
  if (!g) return;
  document.getElementById('goalHistoryTitle').textContent = 'История: ' + g.name;
  const history = (g.history || []).slice().reverse();
  const body = document.getElementById('goalHistoryBody');
  if (!history.length) {
    body.innerHTML = '<div class="history-empty">Операций пока нет</div>';
  } else {
    body.innerHTML = history.map(h => `
      <div class="history-item">
        <div class="history-icon ${h.type}">${h.type === 'add' ? '💰' : '💸'}</div>
        <div class="history-info">
          <div class="history-label">${h.type === 'add' ? 'Пополнение' : 'Снятие'}</div>
          <div class="history-date">${new Date(h.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div class="history-amount ${h.type}">${h.type === 'add' ? '+' : '−'}${fmt(h.amount)}</div>
      </div>`).join('');
  }
  openModal('goalHistoryModal');
};

window.deleteGoal = function(id) {
  if (!confirm('Удалить цель?')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  save(); renderGoals();
};

let depositGoalId = null;
let depositMode = 'add';

window.openDeposit = function(id, mode = 'add') {
  depositGoalId = id;
  depositMode = mode;
  const g = state.goals.find(g => g.id === id);
  document.getElementById('goalDepositTitle').textContent =
    mode === 'add' ? '+ Пополнить: ' + g.name : '− Снять: ' + g.name;
  document.getElementById('goalDepositAmount').value = '';
  document.getElementById('goalDepositAmount').placeholder =
    mode === 'add' ? 'Сумма пополнения' : 'Сумма снятия';
  document.querySelector('#goalDepositModal .modal-body label').textContent =
    mode === 'add' ? 'Сумма пополнения' : 'Сумма снятия';
  document.getElementById('saveGoalDeposit').textContent =
    mode === 'add' ? 'Пополнить' : 'Снять';
  document.getElementById('saveGoalDeposit').className =
    mode === 'add' ? 'btn-primary' : 'btn-danger';
  openModal('goalDepositModal');
};

document.getElementById('saveGoalDeposit').addEventListener('click', () => {
  const amt = Number(document.getElementById('goalDepositAmount').value);
  if (!amt || amt <= 0) return alert('Введите сумму');
  const g = state.goals.find(g => g.id === depositGoalId);
  if (!g) return;
  if (!g.history) g.history = [];
  if (depositMode === 'add') {
    g.current = Math.min(g.target, g.current + amt);
    g.history.push({ date: today(), type: 'add', amount: amt });
  } else {
    if (amt > g.current) return alert(`Нельзя снять больше накопленного (${fmt(g.current)})`);
    g.current = g.current - amt;
    g.history.push({ date: today(), type: 'sub', amount: amt });
  }
  save(); closeModal('goalDepositModal'); renderGoals();
});

// ═══════════════════════════════════════════════
// DASH CHART MODAL
// ═══════════════════════════════════════════════
const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

window.openDashModal = function(type) {
  const titles = {
    income:  'Структура доходов',
    expense: 'Структура расходов',
    balance: 'Доходы и расходы по месяцам'
  };
  document.getElementById('dashChartTitle').textContent = titles[type];
  openModal('dashChartModal');

  if (dashChartInst) { dashChartInst.destroy(); dashChartInst = null; }

  const canvas = document.getElementById('dashChartCanvas');
  const curMonth = today().slice(0, 7);
  const curYear  = today().slice(0, 4);

  if (type === 'income') {
    const catMap = {};
    state.income.filter(t => t.date.slice(0,7) === curMonth)
      .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount); });
    if (!Object.keys(catMap).length) {
      canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2)">Нет доходов в этом месяце</div>';
      return;
    }
    dashChartInst = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catMap),
        datasets: [{ data: Object.values(catMap), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } }, cutout: '55%' }
    });
  } else if (type === 'expense') {
    const catMap = {};
    state.expenses.filter(t => t.date.slice(0,7) === curMonth)
      .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount); });
    if (!Object.keys(catMap).length) {
      canvas.parentElement.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2)">Нет расходов в этом месяце</div>';
      return;
    }
    dashChartInst = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catMap),
        datasets: [{ data: Object.values(catMap), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } }, cutout: '55%' }
    });
  } else {
    const incData = Array(12).fill(0);
    const expData = Array(12).fill(0);
    state.income.filter(t => t.date.slice(0,4) === curYear)
      .forEach(t => { incData[parseInt(t.date.slice(5,7)) - 1] += Number(t.amount); });
    state.expenses.filter(t => t.date.slice(0,4) === curYear)
      .forEach(t => { expData[parseInt(t.date.slice(5,7)) - 1] += Number(t.amount); });
    dashChartInst = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [
          { label: 'Доходы', data: incData, backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 4 },
          { label: 'Расходы', data: expData, backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 10 } } } }
      }
    });
  }
};

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════
function renderSettings() {
  const s = state.settings;
  document.getElementById('setCurrency').value  = s.currency || '₽';
  document.getElementById('setTheme').value     = s.theme || 'light';
  document.getElementById('setWeekStart').value = s.weekStart || 'mon';

  renderCatList('incomeCatList',  s.incomeCats,  'income');
  renderCatList('expenseCatList', s.expenseCats, 'expense');
}

function renderCatList(containerId, cats, type) {
  document.getElementById(containerId).innerHTML = cats.map((c, i) => `
    <div class="cat-item">
      <span>${c}</span>
      <button class="btn-icon" onclick="deleteCat('${type}',${i})">✕</button>
    </div>`).join('');
}

window.deleteCat = function(type, idx) {
  const key = type === 'income' ? 'incomeCats' : 'expenseCats';
  state.settings[key].splice(idx, 1);
  save(); renderSettings();
};

['setCurrency','setTheme','setWeekStart'].forEach(id => {
  document.getElementById(id).addEventListener('change', function() {
    const key = this.id.replace('set','').charAt(0).toLowerCase() + this.id.replace('set','').slice(1);
    const map = { Currency: 'currency', Theme: 'theme', WeekStart: 'weekStart' };
    const field = map[this.id.replace('set','')];
    state.settings[field] = this.value;
    if (field === 'theme') applyTheme(this.value);
    save();
  });
});

function applyTheme(t) {
  document.body.classList.toggle('dark', t === 'dark');
}

document.getElementById('addIncomeCat').addEventListener('click', () => {
  const val = document.getElementById('newIncomeCat').value.trim();
  if (!val) return;
  state.settings.incomeCats.push(val);
  document.getElementById('newIncomeCat').value = '';
  save(); renderSettings();
});

document.getElementById('addExpenseCat').addEventListener('click', () => {
  const val = document.getElementById('newExpenseCat').value.trim();
  if (!val) return;
  state.settings.expenseCats.push(val);
  document.getElementById('newExpenseCat').value = '';
  save(); renderSettings();
});

// Export / Import
document.getElementById('exportData').addEventListener('click', () => {
  const data = { income: state.income, expenses: state.expenses, goals: state.goals, settings: state.settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'finansy_backup_' + today() + '.json';
  a.click();
});

document.getElementById('importDataBtn').addEventListener('click', () => {
  document.getElementById('importFileInput').click();
});

document.getElementById('importFileInput').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.income)   state.income   = data.income;
      if (data.expenses) state.expenses = data.expenses;
      if (data.goals)    state.goals    = data.goals;
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      save(); refreshAll(); alert('Данные импортированы успешно!');
    } catch { alert('Ошибка чтения файла'); }
  };
  reader.readAsText(file);
  this.value = '';
});

document.getElementById('clearData').addEventListener('click', () => {
  if (!confirm('Вы уверены? Все данные будут удалены безвозвратно.')) return;
  state.income = []; state.expenses = []; state.goals = [];
  save(); refreshAll(); alert('Все данные удалены.');
});

// ═══════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); });
});

// ── Income Modal ──────────────────────────────
document.getElementById('openIncomeModal').addEventListener('click', () => {
  document.getElementById('incomeDate').value   = today();
  document.getElementById('incomeDesc').value   = '';
  document.getElementById('incomeAmount').value = '';
  document.getElementById('incomeRepeat').value = 'none';
  populateCatSelect('incomeCat', state.settings.incomeCats);
  openModal('incomeModal');
});

document.getElementById('saveIncome').addEventListener('click', () => {
  const date   = document.getElementById('incomeDate').value;
  const desc   = document.getElementById('incomeDesc').value.trim();
  const cat    = document.getElementById('incomeCat').value;
  const amount = Number(document.getElementById('incomeAmount').value);
  const repeat = document.getElementById('incomeRepeat').value;
  if (!date || !amount || amount <= 0) return alert('Заполните дату и сумму');
  state.income.push({ id: uid(), date, desc, category: cat, amount, repeat });
  save(); closeModal('incomeModal'); refreshAll();
});

// ── Expense Modal ─────────────────────────────
document.getElementById('openExpenseModal').addEventListener('click', () => {
  document.getElementById('expenseDate').value   = today();
  document.getElementById('expenseDesc').value   = '';
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseRepeat').value = 'none';
  populateCatSelect('expenseCat', state.settings.expenseCats);
  openModal('expenseModal');
});

document.getElementById('saveExpense').addEventListener('click', () => {
  const date   = document.getElementById('expenseDate').value;
  const desc   = document.getElementById('expenseDesc').value.trim();
  const cat    = document.getElementById('expenseCat').value;
  const amount = Number(document.getElementById('expenseAmount').value);
  const repeat = document.getElementById('expenseRepeat').value;
  if (!date || !amount || amount <= 0) return alert('Заполните дату и сумму');
  state.expenses.push({ id: uid(), date, desc, category: cat, amount, repeat });
  save(); closeModal('expenseModal'); refreshAll();
});

// ── Goal Modal ────────────────────────────────
let editingGoalId = null;

document.getElementById('openGoalModal').addEventListener('click', () => {
  editingGoalId = null;
  document.querySelector('#goalModal .modal-header h2').textContent = 'Добавить цель';
  document.getElementById('goalName').value            = '';
  document.getElementById('goalTarget').value          = '';
  document.getElementById('goalCurrent').value         = '0';
  document.getElementById('goalDate').value            = '';
  document.getElementById('goalFrequency').value       = 'weekly';
  document.getElementById('goalColor').value           = '#6366f1';
  document.getElementById('goalRewardText').value      = '';
  document.getElementById('goalRewardPhotoData').value = '';
  resetPhotoPreview();
  openModal('goalModal');
});

window.editGoal = function(id) {
  const g = state.goals.find(g => g.id === id);
  if (!g) return;
  editingGoalId = id;
  document.querySelector('#goalModal .modal-header h2').textContent = 'Редактировать цель';
  document.getElementById('goalName').value            = g.name;
  document.getElementById('goalTarget').value          = g.target;
  document.getElementById('goalCurrent').value         = g.current;
  document.getElementById('goalDate').value            = g.date || '';
  document.getElementById('goalFrequency').value       = g.frequency || 'weekly';
  document.getElementById('goalColor').value           = g.color || '#6366f1';
  document.getElementById('goalRewardText').value      = g.rewardText || '';
  document.getElementById('goalRewardPhotoData').value = g.rewardPhoto || '';
  if (g.rewardPhoto) setPhotoPreview(g.rewardPhoto);
  else resetPhotoPreview();
  openModal('goalModal');
};

document.getElementById('goalRewardPhoto').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('goalRewardPhotoData').value = e.target.result;
    setPhotoPreview(e.target.result);
  };
  reader.readAsDataURL(file);
});

function resetPhotoPreview() {
  document.getElementById('goalPhotoPreview').innerHTML =
    '<span class="photo-upload-icon">📷</span><span>Нажмите, чтобы прикрепить фото</span>';
  document.getElementById('goalPhotoPreview').className = 'photo-preview-empty';
  document.getElementById('goalRewardPhoto').value = '';
}

function setPhotoPreview(src) {
  const el = document.getElementById('goalPhotoPreview');
  el.innerHTML = `<img src="${src}" alt="награда" style="max-width:100%;max-height:160px;border-radius:8px;object-fit:cover" /><button type="button" class="photo-remove-btn" onclick="event.stopPropagation();document.getElementById('goalRewardPhotoData').value='';resetPhotoPreview()">✕ Убрать</button>`;
  el.className = 'photo-preview-filled';
}

document.getElementById('saveGoal').addEventListener('click', () => {
  const name        = document.getElementById('goalName').value.trim();
  const target      = Number(document.getElementById('goalTarget').value);
  const current     = Number(document.getElementById('goalCurrent').value) || 0;
  const date        = document.getElementById('goalDate').value;
  const color       = document.getElementById('goalColor').value;
  const frequency   = document.getElementById('goalFrequency').value;
  const rewardText  = document.getElementById('goalRewardText').value.trim();
  const rewardPhoto = document.getElementById('goalRewardPhotoData').value;
  if (!name || !target || target <= 0) return alert('Введите название и целевую сумму');
  if (editingGoalId) {
    const idx = state.goals.findIndex(g => g.id === editingGoalId);
    if (idx !== -1) state.goals[idx] = { ...state.goals[idx], name, target, current, date, color, frequency, rewardText, rewardPhoto };
  } else {
    state.goals.push({ id: uid(), name, target, current, date, color, frequency, rewardText, rewardPhoto });
  }
  editingGoalId = null;
  save(); closeModal('goalModal'); renderGoals();
});

function populateCatSelect(id, cats) {
  document.getElementById(id).innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ── Filters live update ───────────────────────
['incomeMonthFilter','incomeCatFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderIncome);
});
['expenseMonthFilter','expenseCatFilter'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderExpenses);
});

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
applyTheme(state.settings.theme);
const savedTab = localStorage.getItem('fin_active_tab') || 'dashboard';
switchTab(savedTab);
updateSidebar();

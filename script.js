// ===== FIREBASE SETUP =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyApoLQZM7GYgW4TjLRUgBm-HrR5VkP4r3c",
    authDomain: "finance-tracker-jj.firebaseapp.com",
    projectId: "finance-tracker-jj",
    storageBucket: "finance-tracker-jj.firebasestorage.app",
    messagingSenderId: "361231688691",
    appId: "1:361231688691:web:21aeb457acf7bfcdc0a886",
    measurementId: "G-HGEK0XQJ6G"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

let currentUser = null;

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        await loadFromFirestore();
    } else {
        currentUser = null;
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
});

async function doLogin() {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    errEl.textContent = '';
    if (!email || !password) {
        errEl.textContent = 'Email နှင့် Password ထည့်ပါ။';
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
        errEl.textContent = 'Login မအောင်မြင်ပါ။ Email/Password စစ်ဆေးပါ။';
    }
}

async function doLogout() {
    await signOut(auth);
}

// ===== FIRESTORE LOAD =====
async function loadFromFirestore() {
    try {
        const ref  = doc(firestore, 'users', currentUser.uid, 'data', 'main');
        const snap = await getDoc(ref);
        if (snap.exists()) {
            db = normalizeDbShape(snap.data());
        } else {
            db = JSON.parse(JSON.stringify(DEFAULT_DB));
        }
    } catch (e) {
        console.error('Firestore load error:', e);
        db = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
    db = normalizeDbShape(db);
    renderAssets();
    renderProfit();
    renderOperations();
    renderHistory();
    setupAutoSave();
    updateUndoRedoButtons();
    updateProfitEntryCategories();
    updateOpsEntryCategories();
    updateAssetEntryCategories();
}

window.addEventListener('DOMContentLoaded', () => {
    // Auth state listener handles init — nothing needed here
});

// ===== CATEGORY DEFINITIONS =====
// OUT categories
const CATEGORIES = ['House','Dining','Health','Family','Grocery','Personal','Social','UAT'];
const CATEGORY_COLORS = {
    'House':    '#3498db', // Blue
    'Dining':   '#e67e22', // Orange
    'Health':   '#ff5722', // Deep Orange (Different from Social)
    'Family':   '#9b59b6', // Purple
    'Grocery':  '#e74c3c', // Red
    'Personal': '#e91e8c', // Pink
    'Social':   '#fbc02d', // Yellow/Gold (Different from Health)
    'UAT':      '#1abc9c'  // Teal
};
const CATEGORY_ICONS = {
    'House':    '🏠',
    'Dining':   '🍽️',
    'Health':   '❤️',
    'Family':   '👨‍👩‍👧',
    'Grocery':  '🛒',
    'Personal': '🧍',
    'Social':   '🤝',
    'UAT':      '🧑‍💻'
};
// IN categories (Income / Win / Lose)
const IN_CATEGORIES = ['Income','Win','Lose'];
const IN_CATEGORY_COLORS = {
    'Income': '#00c853',
    'Win':    '#ffd600',
    'Lose':   '#ff1744'
};
const IN_CATEGORY_ICONS = {
    'Income': '💰',
    'Win':    '🏆',
    'Lose':   '📉'
};

// ===== ASSET / LIABILITY CATEGORY DEFINITIONS =====
const ASSET_CATEGORIES = ['KBZ Banking','Kpay','AYA Banking','AYA Pay','CB Banking Old','CB Banking (S)','Yoma','Wave','Other'];
const ASSET_CATEGORY_COLORS = {
    'KBZ Banking':    '#2962ff', // Vivid Blue
    'Kpay':           '#ff6d00', // Vivid Orange
    'AYA Banking':    '#d50000', // Vivid Red
    'AYA Pay':        '#ff5252', // Soft Red
    'CB Banking Old': '#00c853', // Vivid Green
    'CB Banking (S)': '#64dd17', // Light Green
    'Yoma':           '#ffffff', // White
    'Wave':           '#ffd600', // Vivid Yellow
    'Other':          '#9e9e9e'  // Grey
};
const ASSET_CATEGORY_ICONS = {
    'KBZ Banking':    '🏦',
    'Kpay':           '📱',
    'AYA Banking':    '🏛️',
    'AYA Pay':        '💳',
    'CB Banking Old': '🏧',
    'CB Banking (S)': '⭐',
    'Yoma':           '🌿',
    'Wave':           '🌊',
    'Other':          '📦'
};

const LIABILITY_CATEGORIES = ['Donate','A.Conni','Family','My Wife','Other'];
const LIABILITY_CATEGORY_COLORS = {
    'Donate':  '#ab47bc',
    'A.Conni': '#00acc1',
    'Family':  '#3f51b5',
    'My Wife': '#4caf50', // Green (Eye-soothing, not Red/Pink)
    'Other':   '#546e7a'
};
const LIABILITY_CATEGORY_ICONS = {
    'Donate':  '🎁',
    'A.Conni': '🧑',
    'Family':  '👨‍👩‍👧',
    'My Wife': '💑',
    'Other':   '📦'
};

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function buildCategoryOptions(selected) {
    let opts = '<option value="">-- Category --</option>';
    CATEGORIES.forEach(c => {
        const icon = CATEGORY_ICONS[c] || '';
        const sel = c === selected ? 'selected' : '';
        opts += `<option value="${c}" ${sel}>${icon} ${c}</option>`;
    });
    return opts;
}

function buildInCategoryOptions(selected) {
    let opts = '<option value="">-- Category --</option>';
    IN_CATEGORIES.forEach(c => {
        const icon = IN_CATEGORY_ICONS[c] || '';
        const sel = c === selected ? 'selected' : '';
        opts += `<option value="${c}" ${sel}>${icon} ${c}</option>`;
    });
    return opts;
}

function buildAssetCategoryOptions(selected) {
    let opts = '<option value="">-- Category --</option>';
    ASSET_CATEGORIES.forEach(c => {
        const icon = ASSET_CATEGORY_ICONS[c] || '';
        const sel = c === selected ? 'selected' : '';
        opts += `<option value="${c}" ${sel}>${icon} ${c}</option>`;
    });
    return opts;
}

function buildLiabilityCategoryOptions(selected) {
    let opts = '<option value="">-- Category --</option>';
    LIABILITY_CATEGORIES.forEach(c => {
        const icon = LIABILITY_CATEGORY_ICONS[c] || '';
        const sel = c === selected ? 'selected' : '';
        opts += `<option value="${c}" ${sel}>${icon} ${c}</option>`;
    });
    return opts;
}

// ===== ADD ENTRY FUNCTIONS =====
function updateProfitEntryCategories() {
    const type = document.getElementById('profit-entry-type').value;
    const catSel = document.getElementById('profit-entry-cat');
    if (type === 'income') {
        catSel.innerHTML = buildInCategoryOptions('');
    } else {
        catSel.innerHTML = buildCategoryOptions('');
    }
}

function updateOpsEntryCategories() {
    const type = document.getElementById('ops-entry-type').value;
    const catSel = document.getElementById('ops-entry-cat');
    if (type === 'income') {
        catSel.innerHTML = buildInCategoryOptions('');
    } else {
        catSel.innerHTML = buildCategoryOptions('');
    }
}

function handleAddEntryKey(event, section) {
    if (event.key === 'Tab') {
        // Let default tab work between fields
        return;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        submitAddEntry(section);
    }
}

function submitAddEntry(section) {
    const prefix = section === 'profit' ? 'profit' : 'ops';
    const type = document.getElementById(prefix + '-entry-type').value;
    const cat = document.getElementById(prefix + '-entry-cat').value;
    const reasonEl = document.getElementById(prefix + '-entry-reason');
    const amountEl = document.getElementById(prefix + '-entry-amount');
    const reason = reasonEl.value.trim();
    const amount = parseFloat(amountEl.value);

    if (!cat || !reason || !amount || isNaN(amount)) {
        // Flash red border on empty fields
        if (!cat) document.getElementById(prefix + '-entry-cat').style.borderColor = '#ff4444';
        if (!reason) { reasonEl.style.borderColor = '#ff4444'; reasonEl.focus(); return; }
        if (!amount) { amountEl.style.borderColor = '#ff4444'; amountEl.focus(); return; }
        return;
    }

    // Reset borders
    [prefix+'-entry-cat', prefix+'-entry-reason', prefix+'-entry-amount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.borderColor = '';
    });

    pushUndo();
    const ts = getCurrentTimestamp();

    if (section === 'profit') {
        if (type === 'income') {
            db.profit.income.push({ desc: reason, amount: String(amount), timestamp: ts, category: cat });
        } else {
            db.profit.expense.push({ reason: reason, amount: String(amount), timestamp: ts, category: cat });
        }
        renderProfit();
        updateProfitTotals();
    } else {
        if (type === 'income') {
            db.operations.income.push({ desc: reason, amount: String(amount), timestamp: ts, category: cat });
        } else {
            db.operations.expense.push({ reason: reason, amount: String(amount), timestamp: ts, category: cat });
        }
        renderOperations();
        updateOpsTotals();
    }

    saveAllData();
    reasonEl.value = '';
    amountEl.value = '';
    reasonEl.focus();
}

// ===== EXPENSE DASHBOARD FUNCTIONS =====
function showExpenseDashboard(sourceType) {
    const expItems = sourceType === 'profit'
        ? db.profit.expense.filter(i => parseFloat(i.amount) > 0)
        : db.operations.expense.filter(i => parseFloat(i.amount) > 0);

    const incomeTotal = sourceType === 'profit'
        ? db.profit.income.reduce((s,i) => s + (parseFloat(i.amount)||0), 0)
        : db.operations.income.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
    const expenseTotal = expItems.reduce((s,i) => s + (parseFloat(i.amount)||0), 0);
    const netTotal = incomeTotal - expenseTotal;

    const label = sourceType === 'profit' ? 'Profit - Expense Summary' : 'Operations - Out Summary';
    const netLabel = sourceType === 'profit' ? 'Net Profit' : 'Net Operation';
    document.getElementById('expDashTitle').textContent = '📊 ' + label;
    document.getElementById('expDashIncome').textContent = incomeTotal.toLocaleString();
    document.getElementById('expDashExpense').textContent = expenseTotal.toLocaleString();
    document.getElementById('expDashCanvasTotal').textContent = expenseTotal.toLocaleString();
    document.getElementById('expDashNetLabel').textContent = netLabel;
    const netEl = document.getElementById('expDashNet');
    netEl.textContent = netTotal.toLocaleString();
    netEl.className = 'exp-dash-total-value ' + (netTotal >= 0 ? 'positive' : 'negative');

    // Aggregate by category
    const catTotals = {};
    expItems.forEach(item => {
        const cat = item.category || 'Uncategorized';
        catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(item.amount) || 0);
    });

    const noData = expenseTotal === 0;
    document.getElementById('expDashNoData').style.display = noData ? 'block' : 'none';
    document.getElementById('expDashChartSection').style.display = noData ? 'none' : 'block';

    if (!noData) {
        drawDonutChart(catTotals, expenseTotal);
        buildDashLegend(catTotals, expenseTotal);
    }

    document.getElementById('expDashboardOverlay').classList.add('show');
}

function drawDonutChart(catTotals, total) {
    const canvas = document.getElementById('expDashCanvas');
    const ctx = canvas.getContext('2d');
    const isMobile = window.innerWidth <= 600;
    const size = isMobile ? 260 : 320;
    canvas.width = size;
    canvas.height = size;
    const cx = size/2, cy = size/2;
    const outerR = isMobile ? 120 : 148;
    const innerR = isMobile ? 76 : 95;
    ctx.clearRect(0, 0, size, size);

    const entries = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
    let startAngle = -Math.PI / 2;

    // Draw slices
    entries.forEach(([cat, val]) => {
        const slice = (val / total) * 2 * Math.PI;
        const color = CATEGORY_COLORS[cat] || '#888';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        startAngle += slice;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Gap lines
    startAngle = -Math.PI / 2;
    entries.forEach(([, val]) => {
        const slice = (val / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
        ctx.lineTo(cx + outerR * Math.cos(startAngle), cy + outerR * Math.sin(startAngle));
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        startAngle += slice;
    });

    // Percentage labels inside slices
    startAngle = -Math.PI / 2;
    entries.forEach(([cat, val]) => {
        const slice = (val / total) * 2 * Math.PI;
        const pct = Math.round(val / total * 100);
        if (pct >= 4) {
            const midAngle = startAngle + slice / 2;
            const labelR = (outerR + innerR) / 2;
            const lx = cx + labelR * Math.cos(midAngle);
            const ly = cy + labelR * Math.sin(midAngle);
            const color = CATEGORY_COLORS[cat] || '#888';
            const lightColors = ['#f1c40f','#d4ac0d','#c0a060'];
            const isLight = lightColors.includes(color);
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 5;
            ctx.fillStyle = isLight ? '#111' : '#ffffff';
            ctx.fillText(pct + '%', lx, ly);
            ctx.shadowBlur = 0;
        }
        startAngle += slice;
    });
}

function buildDashLegend(catTotals, total) {
    const legendEl = document.getElementById('expDashLegend');
    const entries = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
    legendEl.innerHTML = entries.map(([cat, val]) => {
        const pct = total > 0 ? Math.round(val / total * 100) : 0;
        const color = CATEGORY_COLORS[cat] || IN_CATEGORY_COLORS[cat] || '#888';
        const icon = CATEGORY_ICONS[cat] || IN_CATEGORY_ICONS[cat] || '';
        return `<div class="exp-dash-legend-item">
            <div class="exp-dash-legend-dot" style="background:${color}"></div>
            <div class="exp-dash-legend-name">${icon} ${cat}</div>
            <div style="flex:1;margin:0 8px;">
                <div style="height:6px;border-radius:3px;background:#222;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.4s;"></div>
                </div>
            </div>
            <div class="exp-dash-legend-pct">${pct}%</div>
            <div class="exp-dash-legend-amt">${val.toLocaleString()}</div>
        </div>`;
    }).join('');
}

function closeExpenseDashboard(e) {
    if (e.target === document.getElementById('expDashboardOverlay')) {
        document.getElementById('expDashboardOverlay').classList.remove('show');
    }
}

// ===== DATA STRUCTURE =====
let lastAssetNet = 0;
let lastProfitNet = 0;
let lastOpsNet = 0;
let currentHistoryType = 'profit';

// Undo/Redo History
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 20;

// ===== DEFAULT EMPTY DATA STRUCTURE =====
const DEFAULT_DB = {
    assets:     { income: [], expense: [] },
    profit:     { income: [], expense: [] },
    operations: { income: [], expense: [] },
    history:    { profit: {}, operations: {} }
};

let db = JSON.parse(JSON.stringify(DEFAULT_DB));

let pendingAction = null;


function normalizeDbShape(input) {
    const safeInput = (input && typeof input === 'object') ? input : {};
    const safeAssets = (safeInput.assets && typeof safeInput.assets === 'object') ? safeInput.assets : {};
    const safeProfit = (safeInput.profit && typeof safeInput.profit === 'object') ? safeInput.profit : {};
    const safeOps = (safeInput.operations && typeof safeInput.operations === 'object') ? safeInput.operations : {};

    const rawHistory = (safeInput.history && typeof safeInput.history === 'object' && !Array.isArray(safeInput.history))
        ? safeInput.history
        : {};
    const hasSplitHistory = rawHistory.profit || rawHistory.operations;
    const normalizedHistory = hasSplitHistory
        ? {
            profit: (rawHistory.profit && typeof rawHistory.profit === 'object' && !Array.isArray(rawHistory.profit)) ? rawHistory.profit : {},
            operations: (rawHistory.operations && typeof rawHistory.operations === 'object' && !Array.isArray(rawHistory.operations)) ? rawHistory.operations : {}
        }
        : {
            profit: rawHistory,
            operations: {}
        };

    return {
        assets: {
            income: Array.isArray(safeAssets.income) ? safeAssets.income : [{name: '', amount: '', timestamp: ''}],
            expense: Array.isArray(safeAssets.expense) ? safeAssets.expense : [{name: '', amount: '', timestamp: ''}]
        },
        profit: {
            income: Array.isArray(safeProfit.income) ? safeProfit.income : [{desc: '', amount: '', timestamp: ''}],
            expense: Array.isArray(safeProfit.expense) ? safeProfit.expense : [{reason: '', amount: '', timestamp: ''}]
        },
        operations: {
            income: Array.isArray(safeOps.income) ? safeOps.income : [{desc: '', amount: '', timestamp: ''}],
            expense: Array.isArray(safeOps.expense) ? safeOps.expense : [{reason: '', amount: '', timestamp: ''}]
        },
        history: normalizedHistory
    };
}

// ===== CATEGORY CARDS FUNCTIONS =====
function renderCatCards(sourceType) {
    // OUT cards
    const containerId = sourceType === 'profit' ? 'profit-cat-cards' : 'ops-cat-cards';
    const container = document.getElementById(containerId);
    if (!container) return;

    const expItems = sourceType === 'profit'
        ? db.profit.expense
        : db.operations.expense;

    const expenseTotal = expItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

    const catTotals = {};
    CATEGORIES.forEach(c => { catTotals[c] = 0; });
    expItems.forEach(item => {
        const cat = item.category;
        if (cat && catTotals.hasOwnProperty(cat)) {
            catTotals[cat] += parseFloat(item.amount) || 0;
        }
    });

    container.innerHTML = '';
    const sortedCats = [...CATEGORIES].sort((a, b) => (catTotals[b] || 0) - (catTotals[a] || 0));
    sortedCats.forEach(cat => {
        const amt = catTotals[cat] || 0;
        const pct = expenseTotal > 0 ? Math.round(amt / expenseTotal * 100) : 0;
        const color = CATEGORY_COLORS[cat] || '#888';
        const icon = CATEGORY_ICONS[cat] || '';
        const card = document.createElement('div');
        card.className = 'cat-card' + (amt === 0 ? ' cat-card-zero' : '');
        card.style.borderColor = color;
        card.style.borderTopWidth = '4px';
        card.style.background = `linear-gradient(135deg, #151515 60%, ${hexToRgba(color, 0.12)})`;
        card.onclick = () => showCatDetail(cat, sourceType, 'expense');
        card.innerHTML = `
            <div class="cat-card-icon">${icon}</div>
            <div class="cat-card-name">${cat}</div>
            <div class="cat-card-amount" style="color:${color}">${amt > 0 ? amt.toLocaleString() : '–'}</div>
            <div class="cat-card-pct">${amt > 0 ? pct + '%' : '–'}</div>
        `;
        container.appendChild(card);
    });

    // IN cards
    renderInCatCards(sourceType);
}

function renderInCatCards(sourceType) {
    const containerId = sourceType === 'profit' ? 'profit-in-cat-cards' : 'ops-in-cat-cards';
    const container = document.getElementById(containerId);
    if (!container) return;

    const incItems = sourceType === 'profit'
        ? db.profit.income
        : db.operations.income;

    const incomeTotal = incItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

    const catTotals = {};
    IN_CATEGORIES.forEach(c => { catTotals[c] = 0; });
    incItems.forEach(item => {
        const cat = item.category;
        if (cat && catTotals.hasOwnProperty(cat)) {
            catTotals[cat] += parseFloat(item.amount) || 0;
        }
    });

    container.innerHTML = '';
    IN_CATEGORIES.forEach(cat => {
        const amt = catTotals[cat] || 0;
        const pct = incomeTotal > 0 ? Math.round(amt / incomeTotal * 100) : 0;
        const color = IN_CATEGORY_COLORS[cat] || '#888';
        const icon = IN_CATEGORY_ICONS[cat] || '';
        const card = document.createElement('div');
        card.className = 'cat-card-in' + (amt === 0 ? ' cat-card-zero' : '');
        card.style.borderColor = color;
        card.style.borderTopWidth = '4px';
        card.style.background = `linear-gradient(135deg, #0d1a0d 60%, ${hexToRgba(color, 0.1)})`;
        card.onclick = () => showCatDetail(cat, sourceType, 'income');
        card.innerHTML = `
            <div class="cat-card-icon">${icon}</div>
            <div class="cat-card-name" style="color:#fff">${cat}</div>
            <div class="cat-card-amount" style="color:${color}">${amt > 0 ? amt.toLocaleString() : '–'}</div>
            <div class="cat-card-pct" style="color:#fff">${amt > 0 ? pct + '%' : '–'}</div>
        `;
        container.appendChild(card);
    });
}

function showCatDetail(cat, sourceType, entryType) {
    const isIncome = entryType === 'income';
    let dataArr;
    if (isIncome) {
        dataArr = sourceType === 'profit' ? db.profit.income : db.operations.income;
    } else {
        dataArr = sourceType === 'profit' ? db.profit.expense : db.operations.expense;
    }

    const color = isIncome ? (IN_CATEGORY_COLORS[cat] || '#66dd88') : (CATEGORY_COLORS[cat] || '#888');
    const icon = isIncome ? (IN_CATEGORY_ICONS[cat] || '') : (CATEGORY_ICONS[cat] || '');

    // Store context on overlay for re-render
    const overlay = document.getElementById('catDetailOverlay');
    overlay._catCtx = { cat, sourceType, entryType };

    function renderPopup() {
        let arr;
        if (isIncome) {
            arr = sourceType === 'profit' ? db.profit.income : db.operations.income;
        } else {
            arr = sourceType === 'profit' ? db.profit.expense : db.operations.expense;
        }
        const items = arr.map((item, idx) => ({ item, idx })).filter(({ item }) => item.category === cat && parseFloat(item.amount) > 0);
        const total = items.reduce((s, { item }) => s + (parseFloat(item.amount) || 0), 0);

        document.getElementById('catPopupTitle').textContent = icon + ' ' + cat;
        document.getElementById('catPopupTitle').style.color = color;
        document.getElementById('catPopupTotal').textContent = total.toLocaleString();
        document.getElementById('catPopupTotal').style.color = color;

        const tbody = document.getElementById('catPopupBody');
        const emptyEl = document.getElementById('catPopupEmpty');

        if (items.length === 0) {
            tbody.innerHTML = '';
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';

        const allCats = isIncome ? IN_CATEGORIES : CATEGORIES;

        tbody.innerHTML = items.map(({ item, idx }, i) => {
            const reason = item.reason || item.desc || '–';
            const amt = parseFloat(item.amount) || 0;
            const amtStr = amt.toLocaleString();
            const dateStr = formatTimestamp(item.timestamp);
            return `<tr id="popup-row-${idx}">
                <td class="td-num">${i + 1}</td>
                <td class="td-reason" id="popup-reason-cell-${idx}">${reason}</td>
                <td class="td-date">${dateStr}</td>
                <td class="td-amount" id="popup-amount-cell-${idx}" style="color:#ffffff;white-space:nowrap">${amtStr}</td>
                <td class="td-action-inline">
                    <button class="btn-popup-edit" title="Edit" onclick="profitOpsPopupEdit(${idx},'${sourceType}','${entryType}','${cat}')">✏️</button>
                    <button class="btn-popup-delete" title="Delete" onclick="popupDeleteEntry(${idx},'${sourceType}','${entryType}')">🗑</button>
                    <button class="btn-popup-cat" title="Change category" onclick="popupShowCatChange(${idx},'${sourceType}','${entryType}','${cat}')">🔀</button>
                </td>
            </tr>`;
        }).join('');
    }

    overlay._renderPopup = renderPopup;
    renderPopup();
    overlay.classList.add('show');
}

function popupDeleteEntry(globalIdx, sourceType, entryType) {
    const isIncome = entryType === 'income';
    let arr;
    if (isIncome) {
        arr = sourceType === 'profit' ? db.profit.income : db.operations.income;
    } else {
        arr = sourceType === 'profit' ? db.profit.expense : db.operations.expense;
    }
    pushUndo();
    arr.splice(globalIdx, 1);
    saveAllData();
    if (sourceType === 'profit') { renderProfit(); updateProfitTotals(); }
    else { renderOperations(); updateOpsTotals(); }
    // Re-render popup
    const overlay = document.getElementById('catDetailOverlay');
    if (overlay._renderPopup) overlay._renderPopup();
}

function popupShowCatChange(globalIdx, sourceType, entryType, currentCat) {
    const isIncome = entryType === 'income';
    const allCats = isIncome ? IN_CATEGORIES : CATEGORIES;
    const cell = document.getElementById(`popup-reason-cell-${globalIdx}`);
    if (!cell) return;
    const currentText = cell.textContent;
    const opts = allCats.map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${c}</option>`).join('');
    cell.innerHTML = `<select class="cat-popup-inline-select" onchange="popupApplyCatChange(this,${globalIdx},'${sourceType}','${entryType}')" onblur="popupCancelCatChange(this,'${currentText}',${globalIdx})">${opts}</select>`;
    cell.querySelector('select').focus();
}

function popupApplyCatChange(sel, globalIdx, sourceType, entryType) {
    const newCat = sel.value;
    const isIncome = entryType === 'income';
    let arr;
    if (isIncome) {
        arr = sourceType === 'profit' ? db.profit.income : db.operations.income;
    } else {
        arr = sourceType === 'profit' ? db.profit.expense : db.operations.expense;
    }
    pushUndo();
    arr[globalIdx].category = newCat;
    saveAllData();
    if (sourceType === 'profit') { renderProfit(); updateProfitTotals(); }
    else { renderOperations(); updateOpsTotals(); }
    // Close popup and reopen with new cat context
    const overlay = document.getElementById('catDetailOverlay');
    overlay.classList.remove('show');
    setTimeout(() => showCatDetail(newCat, sourceType, entryType), 50);
}

function popupCancelCatChange(sel, originalText, globalIdx) {
    const cell = document.getElementById(`popup-reason-cell-${globalIdx}`);
    if (cell && cell.querySelector('select')) cell.textContent = originalText;
}

function profitOpsPopupEdit(globalIdx, sourceType, entryType, cat) {
    const isIncome = entryType === 'income';
    let arr;
    if (isIncome) {
        arr = sourceType === 'profit' ? db.profit.income : db.operations.income;
    } else {
        arr = sourceType === 'profit' ? db.profit.expense : db.operations.expense;
    }
    const item = arr[globalIdx];
    const nameCell = document.getElementById(`popup-reason-cell-${globalIdx}`);
    const amtCell = document.getElementById(`popup-amount-cell-${globalIdx}`);
    if (!nameCell || !amtCell || !item) return;

    const currentReason = item.reason || item.desc || '';
    const currentAmt = item.amount || '';
    const color = isIncome ? (IN_CATEGORY_COLORS[cat] || '#66dd88') : (CATEGORY_COLORS[cat] || '#888');

    nameCell.innerHTML = `<input class="popup-edit-input" type="text" value="${currentReason}" id="edit-reason-${globalIdx}" style="text-align:left">`;
    amtCell.innerHTML = `<input class="popup-edit-amount" type="number" value="${currentAmt}" id="edit-amt-${globalIdx}" style="text-align:right;color:#ffd700">`;

    const actionCell = nameCell.closest('tr').querySelector('.td-action-inline');
    actionCell.innerHTML = `
        <button class="btn-popup-save" onclick="profitOpsPopupSaveEdit(${globalIdx},'${sourceType}','${entryType}')">💾</button>
        <button class="btn-popup-cat" onclick="profitOpsPopupCancelEdit('${sourceType}','${entryType}','${cat}')">✕</button>
    `;
    document.getElementById(`edit-reason-${globalIdx}`).focus();
}

function profitOpsPopupSaveEdit(globalIdx, sourceType, entryType) {
    const isIncome = entryType === 'income';
    let arr;
    if (isIncome) {
        arr = sourceType === 'profit' ? db.profit.income : db.operations.income;
    } else {
        arr = sourceType === 'profit' ? db.profit.expense : db.operations.expense;
    }
    const item = arr[globalIdx];
    const reasonEl = document.getElementById(`edit-reason-${globalIdx}`);
    const amtEl = document.getElementById(`edit-amt-${globalIdx}`);
    if (!reasonEl || !amtEl || !item) return;
    const newReason = reasonEl.value.trim();
    const newAmt = parseFloat(amtEl.value);
    if (!newReason || isNaN(newAmt)) return;
    
    const oldAmt = parseFloat(item.amount) || 0;
    pushUndo();
    if (isIncome) item.desc = newReason;
    else item.reason = newReason;
    
    // Only update timestamp if amount changed
    if (newAmt !== oldAmt) {
        item.amount = String(newAmt);
        item.timestamp = getCurrentTimestamp();
    } else {
        item.amount = String(newAmt);
    }
    
    saveAllData();
    if (sourceType === 'profit') { renderProfit(); updateProfitTotals(); }
    else { renderOperations(); updateOpsTotals(); }
    const overlay = document.getElementById('catDetailOverlay');
    if (overlay._renderPopup) overlay._renderPopup();
}

function profitOpsPopupCancelEdit(sourceType, entryType, cat) {
    const overlay = document.getElementById('catDetailOverlay');
    if (overlay._renderPopup) overlay._renderPopup();
}

function closeCatPopup(e) {
    if (e.target === document.getElementById('catDetailOverlay')) {
        document.getElementById('catDetailOverlay').classList.remove('show');
    }
}

// ===== INITIALIZATION (handled by loadFromFirestore) =====
function init() {
    // Data loading is handled by onAuthStateChanged -> loadFromFirestore()
    // This function kept for compatibility only
    if (!currentUser) return;

    db = normalizeDbShape(db);

    // Migrate asset category renames
    const assetCatRemap = { 'CB Banking Special': 'CB Banking (S)' };
    db.assets.income.forEach(item => { if (assetCatRemap[item.category]) item.category = assetCatRemap[item.category]; });
    db.assets.expense.forEach(item => { if (assetCatRemap[item.category]) item.category = assetCatRemap[item.category]; });

    // Migrate existing expense rows — remap old/unknown categories
    const expCatRemap = { 
        'Dress': 'House', 
        'My Son': 'Grocery', 
        'Electric': 'House', 
        'Phone': 'Personal', 
        'Restaurant': 'Dining'
    };
    function migrateExpCat(item) {
        if (!('category' in item) || !item.category) { item.category = ''; return; }
        if (expCatRemap[item.category]) item.category = expCatRemap[item.category];
    }
    db.profit.expense.forEach(migrateExpCat);
    db.operations.expense.forEach(migrateExpCat);
    // Migrate income rows — assign category from desc content
    function migrateIncCat(item) {
        if (!('category' in item) || !item.category) {
            const d = (item.desc || '').toLowerCase();
            if (d.includes('win')) item.category = 'Win';
            else if (d.includes('lose')) item.category = 'Lose';
            else item.category = 'Income';
        }
    }
    db.profit.income.forEach(migrateIncCat);
    db.operations.income.forEach(migrateIncCat);
    // Migrate asset rows — ensure category field exists
    db.assets.income.forEach(item => { if (!('category' in item)) item.category = ''; });
    db.assets.expense.forEach(item => { if (!('category' in item)) item.category = ''; });

    // Initialize last known net values
    const assetInc = db.assets.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const assetExp = db.assets.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    lastAssetNet = assetInc - assetExp;

    const profitInc = db.profit.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const profitExp = db.profit.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    lastProfitNet = profitInc - profitExp;

    const opsInc = db.operations.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const opsExp = db.operations.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    lastOpsNet = opsInc - opsExp;

    renderAssets();
    renderProfit();
    renderOperations();
    renderHistory();
    setupAutoSave();
    updateUndoRedoButtons();
    // Init add-entry dropdowns
    updateProfitEntryCategories();
    updateOpsEntryCategories();
    updateAssetEntryCategories();
}

function setupAutoSave() {
    // LocalStorage saves are synchronous — no special beforeunload needed
}

function saveAllData(options = {}) {
    // Save to Firestore (debounced 800ms)
    if (!currentUser) return;
    clearTimeout(saveAllData._timer);
    saveAllData._timer = setTimeout(async () => {
        try {
            const ref = doc(firestore, 'users', currentUser.uid, 'data', 'main');
            await setDoc(ref, JSON.parse(JSON.stringify(db)));
        } catch (e) {
            console.error('Firestore save error:', e);
        }
    }, 800);
}

function pushUndo() {
    undoStack.push(JSON.stringify(db));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = []; // Clear redo when new action is taken
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(db));
    db = JSON.parse(undoStack.pop());
    refreshUI();
    saveAllData();
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(db));
    db = JSON.parse(redoStack.pop());
    refreshUI();
    saveAllData();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const assetUndoBtn = document.getElementById('assetUndoBtn');
    const assetRedoBtn = document.getElementById('assetRedoBtn');
    const profitUndoBtn = document.getElementById('profitUndoBtn');
    const profitRedoBtn = document.getElementById('profitRedoBtn');
    const opsUndoBtn = document.getElementById('opsUndoBtn');
    const opsRedoBtn = document.getElementById('opsRedoBtn');

    if (assetUndoBtn) assetUndoBtn.disabled = undoStack.length === 0;
    if (assetRedoBtn) assetRedoBtn.disabled = redoStack.length === 0;
    if (profitUndoBtn) profitUndoBtn.disabled = undoStack.length === 0;
    if (profitRedoBtn) profitRedoBtn.disabled = redoStack.length === 0;
    if (opsUndoBtn) opsUndoBtn.disabled = undoStack.length === 0;
    if (opsRedoBtn) opsRedoBtn.disabled = redoStack.length === 0;
}

function refreshUI() {
    renderAssets();
    renderProfit();
    renderOperations();
    renderHistory();
}

// Global Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    const isPrimaryModifier = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (isPrimaryModifier && !e.shiftKey && key === 'z') {
        e.preventDefault();
        undo();
    }
    if (isPrimaryModifier && (key === 'y' || (e.shiftKey && key === 'z'))) {
        e.preventDefault();
        redo();
    }
});

// ===== PAGE NAVIGATION =====
function showPage(pageId, btnElement) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    } else if (event && event.target && event.target.classList.contains('nav-btn')) {
        event.target.classList.add('active');
    }
}

// ===== TIMESTAMP FUNCTIONS =====
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function formatMonthDisplay(monthKey) {
    const [year, month] = monthKey.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const [datePart] = timestamp.split(' ');
    const [y, m, d] = datePart.split('-');
    return `${d}.${m}.${y}`;
}

// ===== ASSETS FUNCTIONS =====
function renderAssets() {
    updateAssetTotals();
    renderAssetCatCards();
    renderLiabilityCatCards();
}

function renderAssetTable(type) {
    // legacy stub — no longer used
}

function updateAsset(type, idx, field, value) {
    const currentValue = String(db.assets[type][idx][field] ?? '');
    const nextValue = String(value ?? '');
    if (currentValue === nextValue) return;
    pushUndo();
    db.assets[type][idx][field] = value;
    if (field === 'amount' && value) {
        db.assets[type][idx].timestamp = getCurrentTimestamp();
    }
    saveAllData();
    updateAssetTotals();
}

function addSingleAssetRow(type) {
    pushUndo();
    db.assets[type].push({name: '', amount: '', timestamp: '', category: ''});
    renderAssets();
    focusNewRow(type + '-table');
}

function removeAssetRow(type, idx) {
    pushUndo();
    db.assets[type].splice(idx, 1);
    if (db.assets[type].length === 0) {
        db.assets[type] = [{name: '', amount: '', timestamp: '', category: ''}];
    }
    renderAssets();
    saveAllData();
}

function updateAssetTotals() {
    const incomeTotal = db.assets.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const expenseTotal = db.assets.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netBalance = incomeTotal - expenseTotal;

    document.getElementById('asset-income-total').textContent = incomeTotal.toLocaleString();
    document.getElementById('asset-expense-total').textContent = expenseTotal.toLocaleString();
    document.getElementById('asset-net-balance').textContent = netBalance.toLocaleString();
    
    // Dynamic color for Net Balance based on positive/negative value
    const netBalanceEl = document.getElementById('asset-net-balance');
    if (netBalance < 0) {
        netBalanceEl.className = 'summary-card-value negative';
    } else if (netBalance > 0) {
        netBalanceEl.className = 'summary-card-value positive';
    } else {
        netBalanceEl.className = 'summary-card-value';
    }
    
    // Update Total Row amounts
    const incomeTotalCell = document.getElementById('total-income-amount');
    const expenseTotalCell = document.getElementById('total-expense-amount');
    if (incomeTotalCell) incomeTotalCell.textContent = incomeTotal.toLocaleString();
    if (expenseTotalCell) expenseTotalCell.textContent = expenseTotal.toLocaleString();

    // Balance Change Indicator
    const balanceChangeDiv = document.getElementById('asset-balance-change');
    if (netBalance !== lastAssetNet) {
        const change = netBalance - lastAssetNet;
        const isUp = change > 0;
        balanceChangeDiv.className = `balance-change show ${isUp ? 'up' : 'down'}`;
        balanceChangeDiv.innerHTML = `${isUp ? '📈' : '📉'} ${isUp ? '+' : ''}${change.toLocaleString()} <button class="btn-dismiss-change" onclick="dismissBalanceChange('asset-balance-change', ${netBalance}, 'asset')">✕</button>`;
    } else {
        balanceChangeDiv.classList.remove('show');
    }
}


// ===== ASSET CATEGORY CARD FUNCTIONS =====
function renderAssetCatCards() {
    const container = document.getElementById('asset-cat-cards');
    if (!container) return;
    const items = db.assets.income;
    const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const catTotals = {};
    ASSET_CATEGORIES.forEach(c => { catTotals[c] = 0; });
    items.forEach(item => {
        const cat = item.category;
        if (cat && catTotals.hasOwnProperty(cat)) {
            catTotals[cat] += parseFloat(item.amount) || 0;
        }
    });
    container.innerHTML = '';
    // For Assets, use defined order instead of amount sorting
    const sorted = [...ASSET_CATEGORIES]; 
    sorted.forEach(cat => {
        const amt = catTotals[cat] || 0;
        const pct = total > 0 ? Math.round(amt / total * 100) : 0;
        const color = ASSET_CATEGORY_COLORS[cat] || '#888';
        const icon = ASSET_CATEGORY_ICONS[cat] || '';
        const card = document.createElement('div');
        card.className = 'cat-card-in' + (amt === 0 ? ' cat-card-zero' : '');
        card.style.borderColor = color;
        card.style.borderTopWidth = '4px';
        card.style.background = `linear-gradient(135deg, #0d1520 60%, ${hexToRgba(color, 0.12)})`;
        card.style.cursor = 'pointer';
        card.onclick = () => showAssetCatDetail(cat, 'income');
        card.innerHTML = `
            <div class="cat-card-icon">${icon}</div>
            <div class="cat-card-name" style="color:#fff">${cat}</div>
            <div class="cat-card-amount" style="color:${color}">${amt > 0 ? amt.toLocaleString() : '\u2013'}</div>
            <div class="cat-card-pct" style="color:#fff">${amt > 0 ? pct + '%' : '\u2013'}</div>
        `;
        container.appendChild(card);
    });
}

function renderLiabilityCatCards() {
    const container = document.getElementById('liability-cat-cards');
    if (!container) return;
    const items = db.assets.expense;
    const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const catTotals = {};
    LIABILITY_CATEGORIES.forEach(c => { catTotals[c] = 0; });
    items.forEach(item => {
        const cat = item.category;
        if (cat && catTotals.hasOwnProperty(cat)) {
            catTotals[cat] += parseFloat(item.amount) || 0;
        }
    });
    container.innerHTML = '';
    const sorted = [...LIABILITY_CATEGORIES].sort((a, b) => (catTotals[b] || 0) - (catTotals[a] || 0));
    sorted.forEach(cat => {
        const amt = catTotals[cat] || 0;
        const pct = total > 0 ? Math.round(amt / total * 100) : 0;
        const color = LIABILITY_CATEGORY_COLORS[cat] || '#888';
        const icon = LIABILITY_CATEGORY_ICONS[cat] || '';
        const card = document.createElement('div');
        card.className = 'cat-card' + (amt === 0 ? ' cat-card-zero' : '');
        card.style.borderColor = color;
        card.style.borderTopWidth = '4px';
        card.style.background = `linear-gradient(135deg, #1a0d0d 60%, ${hexToRgba(color, 0.12)})`;
        card.style.cursor = 'pointer';
        card.onclick = () => showAssetCatDetail(cat, 'expense');
        card.innerHTML = `
            <div class="cat-card-icon">${icon}</div>
            <div class="cat-card-name">${cat}</div>
            <div class="cat-card-amount" style="color:${color}">${amt > 0 ? amt.toLocaleString() : '\u2013'}</div>
            <div class="cat-card-pct">${amt > 0 ? pct + '%' : '\u2013'}</div>
        `;
        container.appendChild(card);
    });
}


// ===== ASSET ADD ENTRY =====
function updateAssetEntryCategories() {
    const type = document.getElementById('asset-entry-type').value;
    const catSel = document.getElementById('asset-entry-cat');
    if (type === 'income') {
        catSel.innerHTML = buildAssetCategoryOptions('');
    } else {
        catSel.innerHTML = buildLiabilityCategoryOptions('');
    }
}

function handleAssetAddEntryKey(event) {
    if (event.key === 'Enter') { event.preventDefault(); submitAssetEntry(); }
}

function submitAssetEntry() {
    const type = document.getElementById('asset-entry-type').value;
    const cat = document.getElementById('asset-entry-cat').value;
    const nameEl = document.getElementById('asset-entry-name');
    const amountEl = document.getElementById('asset-entry-amount-input');
    const name = nameEl.value.trim();
    const amount = parseFloat(amountEl.value);
    if (!cat || !name || !amount || isNaN(amount)) {
        if (!cat) document.getElementById('asset-entry-cat').style.borderColor = '#ff4444';
        if (!name) { nameEl.style.borderColor = '#ff4444'; nameEl.focus(); return; }
        if (!amount) { amountEl.style.borderColor = '#ff4444'; amountEl.focus(); return; }
        return;
    }
    ['asset-entry-cat','asset-entry-name','asset-entry-amount-input'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.borderColor = '';
    });
    pushUndo();
    const ts = getCurrentTimestamp();
    db.assets[type].push({ name, amount: String(amount), timestamp: ts, category: cat });
    saveAllData();
    updateAssetTotals();
    renderAssetCatCards();
    renderLiabilityCatCards();
    nameEl.value = ''; amountEl.value = '';
    // Focus back to type select for next entry
    document.getElementById('asset-entry-type').focus();
}

function showAssetCatDetail(cat, type) {
    const isIncome = type === 'income';
    const items = db.assets[type];
    const color = isIncome ? (ASSET_CATEGORY_COLORS[cat] || '#888') : (LIABILITY_CATEGORY_COLORS[cat] || '#888');
    const icon = isIncome ? (ASSET_CATEGORY_ICONS[cat] || '') : (LIABILITY_CATEGORY_ICONS[cat] || '');

    const overlay = document.getElementById('catDetailOverlay');
    overlay._catCtx = { cat, sourceType: 'asset_' + type, entryType: type };

    function renderPopup() {
        const arr = db.assets[type];
        const filtered = arr.map((item, idx) => ({ item, idx })).filter(({ item }) => item.category === cat && parseFloat(item.amount) > 0);
        const total = filtered.reduce((s, { item }) => s + (parseFloat(item.amount) || 0), 0);

        document.getElementById('catPopupTitle').textContent = icon + ' ' + cat;
        document.getElementById('catPopupTitle').style.color = color;
        document.getElementById('catPopupTotal').textContent = total.toLocaleString();
        document.getElementById('catPopupTotal').style.color = color;

        const tbody = document.getElementById('catPopupBody');
        const emptyEl = document.getElementById('catPopupEmpty');
        if (filtered.length === 0) { tbody.innerHTML = ''; emptyEl.style.display = 'block'; return; }
        emptyEl.style.display = 'none';

        const allCats = isIncome ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
        tbody.innerHTML = filtered.map(({ item, idx }, i) => {
            const label = item.name || '–';
            const amt = parseFloat(item.amount) || 0;
            const dateStr = formatTimestamp(item.timestamp);
            return `<tr id="popup-row-${idx}">
                <td class="td-num">${i + 1}</td>
                <td class="td-reason" id="popup-reason-cell-${idx}">${label}</td>
                <td class="td-date">${dateStr}</td>
                <td class="td-amount" id="popup-amount-cell-${idx}" style="color:#ffffff;white-space:nowrap">${amt.toLocaleString()}</td>
                <td class="td-action-inline">
                    <button class="btn-popup-edit" title="Edit" onclick="assetPopupEdit(${idx},'${type}','${cat}')">✏️</button>
                    <button class="btn-popup-delete" title="Delete" onclick="assetPopupDelete(${idx},'${type}')">🗑</button>
                    <button class="btn-popup-cat" title="Change category" onclick="assetPopupCatChange(${idx},'${type}','${cat}')">🔀</button>
                </td>
            </tr>`;
        }).join('');
    }
    overlay._renderPopup = renderPopup;
    renderPopup();
    overlay.classList.add('show');
}

function assetPopupEdit(idx, type, cat) {
    const item = db.assets[type][idx];
    const nameCell = document.getElementById(`popup-reason-cell-${idx}`);
    const amtCell = document.getElementById(`popup-amount-cell-${idx}`);
    if (!nameCell || !amtCell) return;

    const currentName = item.name || '';
    const currentAmt = item.amount || '';
    const color = type === 'income' ? (ASSET_CATEGORY_COLORS[cat] || '#888') : (LIABILITY_CATEGORY_COLORS[cat] || '#888');

    nameCell.innerHTML = `<input class="popup-edit-input" type="text" value="${currentName}" id="edit-name-${idx}" style="text-align:left">`;
    amtCell.innerHTML = `<input class="popup-edit-amount" type="number" value="${currentAmt}" id="edit-amt-${idx}" style="text-align:right;color:#ffd700">`;

    // Replace action buttons with Save/Cancel
    const actionCell = nameCell.closest('tr').querySelector('.td-action-inline');
    actionCell.innerHTML = `
        <button class="btn-popup-save" onclick="assetPopupSaveEdit(${idx},'${type}','${cat}')">💾</button>
        <button class="btn-popup-cat" onclick="assetPopupCancelEdit(${idx},'${type}','${cat}')">✕</button>
    `;
    document.getElementById(`edit-name-${idx}`).focus();
}

function assetPopupSaveEdit(idx, type, cat) {
    const nameEl = document.getElementById(`edit-name-${idx}`);
    const amtEl = document.getElementById(`edit-amt-${idx}`);
    if (!nameEl || !amtEl) return;
    const newName = nameEl.value.trim();
    const newAmt = parseFloat(amtEl.value);
    if (!newName || isNaN(newAmt)) return;
    
    const item = db.assets[type][idx];
    const oldAmt = parseFloat(item.amount) || 0;
    pushUndo();
    item.name = newName;
    
    // Only update timestamp if amount changed
    if (newAmt !== oldAmt) {
        item.amount = String(newAmt);
        item.timestamp = getCurrentTimestamp();
    } else {
        item.amount = String(newAmt);
    }
    
    saveAllData();
    renderAssets();
    const overlay = document.getElementById('catDetailOverlay');
    if (overlay._renderPopup) overlay._renderPopup();
}

function assetPopupCancelEdit(idx, type, cat) {
    const overlay = document.getElementById('catDetailOverlay');
    if (overlay._renderPopup) overlay._renderPopup();
}

function assetPopupDelete(idx, type) {
    pushUndo();
    db.assets[type].splice(idx, 1);
    if (db.assets[type].length === 0) db.assets[type] = [{ name: '', amount: '', timestamp: '', category: '' }];
    saveAllData();
    renderAssets();
    const overlay = document.getElementById('catDetailOverlay');
    if (overlay._renderPopup) overlay._renderPopup();
}

function assetPopupCatChange(idx, type, currentCat) {
    const allCats = type === 'income' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
    const cell = document.getElementById(`popup-reason-cell-${idx}`);
    if (!cell) return;
    const currentText = cell.textContent;
    const opts = allCats.map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${c}</option>`).join('');
    cell.innerHTML = `<select class="cat-popup-inline-select" onchange="assetPopupApplyCat(this,${idx},'${type}')" onblur="if(this.parentElement)this.parentElement.textContent='${currentText}'">${opts}</select>`;
    cell.querySelector('select').focus();
}

function assetPopupApplyCat(sel, idx, type) {
    const newCat = sel.value;
    pushUndo();
    db.assets[type][idx].category = newCat;
    saveAllData();
    renderAssets();
    const overlay = document.getElementById('catDetailOverlay');
    overlay.classList.remove('show');
    setTimeout(() => showAssetCatDetail(newCat, type), 50);
}
// ===== PROFIT FUNCTIONS =====
function renderProfit() {
    renderCatCards('profit');
    updateProfitTotals();
}

function renderProfitTable(type) {
    const tableId = 'profit-' + type + '-table';
    const tbody = document.getElementById(tableId);
    tbody.innerHTML = '';

    const fieldName = type === 'income' ? 'desc' : 'reason';

    db.profit[type].forEach((item, idx) => {
        const tr = document.createElement('tr');
        const amountCellClass = item.timestamp ? 'amount-cell has-timestamp' : 'amount-cell';
        const amountCellAttr = item.timestamp ? `class="${amountCellClass}" data-timestamp="${formatTimestamp(item.timestamp)}"` : `class="${amountCellClass}"`;

        if (type === 'expense') {
            const cat = item.category || '';
            const catColor = CATEGORY_COLORS[cat] || '#888';
            tr.innerHTML = `
                <td><select class="cat-select" tabindex="2" style="border-left: 3px solid ${catColor}; background-color: ${hexToRgba(catColor||'#888888', 0.25)}" onchange="this.style.borderLeft='3px solid '+(CATEGORY_COLORS[this.value]||'#888'); this.style.backgroundColor=hexToRgba(CATEGORY_COLORS[this.value]||'#888888',0.25); updateProfit('expense', ${idx}, 'category', this.value)">${buildCategoryOptions(cat)}</select></td>
                <td><input type="text" tabindex="3" value="${item[fieldName]}" placeholder="Reason" oninput="updateProfit('expense', ${idx}, 'reason', this.value)" onkeydown="handleTableKeydown(event, 'profit', 'expense', ${idx})"></td>
                <td ${amountCellAttr}><input type="number" tabindex="1" value="${item.amount}" placeholder="0" oninput="updateProfit('expense', ${idx}, 'amount', this.value);" onkeydown="handleTableKeydown(event, 'profit', 'expense', ${idx})"></td>
                <td><button class="btn-delete" onclick="removeProfitRow('expense', ${idx})">❌</button></td>
            `;
        } else {
            tr.innerHTML = `
                <td><input type="text" tabindex="2" value="${item[fieldName]}" placeholder="Description" oninput="updateProfit('income', ${idx}, 'desc', this.value)" onkeydown="handleTableKeydown(event, 'profit', 'income', ${idx})"></td>
                <td ${amountCellAttr}><input type="number" tabindex="1" value="${item.amount}" placeholder="0" oninput="updateProfit('income', ${idx}, 'amount', this.value);" onkeydown="handleTableKeydown(event, 'profit', 'income', ${idx})"></td>
                <td><button class="btn-delete" onclick="removeProfitRow('income', ${idx})">❌</button></td>
            `;
        }
        tbody.appendChild(tr);
    });

    // Total Row
    const total = db.profit[type].reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row' + (type === 'expense' ? ' expense' : '');
    totalRow.id = 'profit-total-' + type + '-row';
    const totalCols = type === 'expense' ? `<td></td><td style="text-align:center;font-weight:700;">TOTAL</td><td id="profit-total-expense-amount" style="text-align:right;font-weight:700;">${total.toLocaleString()}</td><td></td>` : `<td>TOTAL</td><td id="profit-total-income-amount">${total.toLocaleString()}</td><td></td>`;
    totalRow.innerHTML = totalCols;
    tbody.appendChild(totalRow);
}

function updateProfit(type, idx, field, value) {
    const currentValue = String(db.profit[type][idx][field] ?? '');
    const nextValue = String(value ?? '');
    if (currentValue === nextValue) return;
    pushUndo();
    db.profit[type][idx][field] = value;
    if (field === 'amount' && value) {
        db.profit[type][idx].timestamp = getCurrentTimestamp();
    }
    saveAllData();
    updateProfitTotals();
}

function addSingleProfitRow(type) {
    pushUndo();
    const fieldName = type === 'income' ? 'desc' : 'reason';
    const newRow = type === 'expense' ? {[fieldName]: '', amount: '', timestamp: '', category: ''} : {[fieldName]: '', amount: '', timestamp: ''};
    db.profit[type].push(newRow);
    renderProfit();
    focusNewRow('profit-' + type + '-table');
}

function removeProfitRow(type, idx) {
    pushUndo();
    db.profit[type].splice(idx, 1);
    const fieldName = type === 'income' ? 'desc' : 'reason';
    if (db.profit[type].length === 0) {
        db.profit[type] = [{[fieldName]: '', amount: '', timestamp: ''}];
    }
    renderProfit();
    saveAllData();
}

function updateProfitTotals() {
    const incomeTotal = db.profit.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const expenseTotal = db.profit.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netProfit = incomeTotal - expenseTotal;

    document.getElementById('profit-income-total').textContent = incomeTotal.toLocaleString();
    document.getElementById('profit-expense-total').textContent = expenseTotal.toLocaleString();
    document.getElementById('profit-net-total').textContent = netProfit.toLocaleString();
    
    // Dynamic color for Net Profit based on positive/negative value
    const netProfitEl = document.getElementById('profit-net-total');
    if (netProfit < 0) {
        netProfitEl.className = 'summary-card-value negative';
    } else if (netProfit > 0) {
        netProfitEl.className = 'summary-card-value positive';
    } else {
        netProfitEl.className = 'summary-card-value';
    }

    // Balance Change Indicator
    const balanceChangeDiv = document.getElementById('profit-balance-change');
    if (netProfit !== lastProfitNet) {
        const change = netProfit - lastProfitNet;
        const isUp = change > 0;
        balanceChangeDiv.className = `balance-change show ${isUp ? 'up' : 'down'}`;
        balanceChangeDiv.innerHTML = `${isUp ? '📈' : '📉'} ${isUp ? '+' : ''}${change.toLocaleString()} <button class="btn-dismiss-change" onclick="dismissBalanceChange('profit-balance-change', ${netProfit}, 'profit')">✕</button>`;
    } else {
        balanceChangeDiv.classList.remove('show');
    }
}

// ===== OPERATIONS FUNCTIONS =====
function renderOperations() {
    renderCatCards('operations');
    updateOpsTotals();
}

function renderOpsTable(type) {
    const tableId = 'ops-' + type + '-table';
    const tbody = document.getElementById(tableId);
    tbody.innerHTML = '';

    const fieldName = type === 'income' ? 'desc' : 'reason';

    db.operations[type].forEach((item, idx) => {
        const tr = document.createElement('tr');
        const amountCellClass = item.timestamp ? 'amount-cell has-timestamp' : 'amount-cell';
        const amountCellAttr = item.timestamp ? `class="${amountCellClass}" data-timestamp="${formatTimestamp(item.timestamp)}"` : `class="${amountCellClass}"`;

        if (type === 'expense') {
            const cat = item.category || '';
            const catColor = CATEGORY_COLORS[cat] || '#888';
            tr.innerHTML = `
                <td><select class="cat-select" tabindex="2" style="border-left: 3px solid ${catColor}; background-color: ${hexToRgba(catColor||'#888888', 0.25)}" onchange="this.style.borderLeft='3px solid '+(CATEGORY_COLORS[this.value]||'#888'); this.style.backgroundColor=hexToRgba(CATEGORY_COLORS[this.value]||'#888888',0.25); updateOps('expense', ${idx}, 'category', this.value)">${buildCategoryOptions(cat)}</select></td>
                <td><input type="text" tabindex="3" value="${item[fieldName]}" placeholder="Reason" oninput="updateOps('expense', ${idx}, 'reason', this.value)" onkeydown="handleTableKeydown(event, 'operations', 'expense', ${idx})"></td>
                <td ${amountCellAttr}><input type="number" tabindex="1" value="${item.amount}" placeholder="0" oninput="updateOps('expense', ${idx}, 'amount', this.value);" onkeydown="handleTableKeydown(event, 'operations', 'expense', ${idx})"></td>
                <td><button class="btn-delete" onclick="removeOpsRow('expense', ${idx})">❌</button></td>
            `;
        } else {
            tr.innerHTML = `
                <td><input type="text" tabindex="2" value="${item[fieldName]}" placeholder="Description" oninput="updateOps('income', ${idx}, 'desc', this.value)" onkeydown="handleTableKeydown(event, 'operations', 'income', ${idx})"></td>
                <td ${amountCellAttr}><input type="number" tabindex="1" value="${item.amount}" placeholder="0" oninput="updateOps('income', ${idx}, 'amount', this.value);" onkeydown="handleTableKeydown(event, 'operations', 'income', ${idx})"></td>
                <td><button class="btn-delete" onclick="removeOpsRow('income', ${idx})">❌</button></td>
            `;
        }
        tbody.appendChild(tr);
    });

    const total = db.operations[type].reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row' + (type === 'expense' ? ' expense' : '');
    totalRow.id = 'ops-total-' + type + '-row';
    const totalCols = type === 'expense' ? `<td></td><td style="text-align:center;font-weight:700;">TOTAL</td><td id="ops-total-expense-amount" style="text-align:right;font-weight:700;">${total.toLocaleString()}</td><td></td>` : `<td>TOTAL</td><td id="ops-total-income-amount">${total.toLocaleString()}</td><td></td>`;
    totalRow.innerHTML = totalCols;
    tbody.appendChild(totalRow);
}

function updateOps(type, idx, field, value) {
    const currentValue = String(db.operations[type][idx][field] ?? '');
    const nextValue = String(value ?? '');
    if (currentValue === nextValue) return;
    pushUndo();
    db.operations[type][idx][field] = value;
    if (field === 'amount' && value) {
        db.operations[type][idx].timestamp = getCurrentTimestamp();
    }
    saveAllData();
    updateOpsTotals();
}

function addSingleOpsRow(type) {
    pushUndo();
    const fieldName = type === 'income' ? 'desc' : 'reason';
    const newRow = type === 'expense' ? {[fieldName]: '', amount: '', timestamp: '', category: ''} : {[fieldName]: '', amount: '', timestamp: ''};
    db.operations[type].push(newRow);
    renderOperations();
    focusNewRow('ops-' + type + '-table');
}

function removeOpsRow(type, idx) {
    pushUndo();
    db.operations[type].splice(idx, 1);
    const fieldName = type === 'income' ? 'desc' : 'reason';
    if (db.operations[type].length === 0) {
        db.operations[type] = [{[fieldName]: '', amount: '', timestamp: ''}];
    }
    renderOperations();
    saveAllData();
}

function updateOpsTotals() {
    const incomeTotal = db.operations.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const expenseTotal = db.operations.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netTotal = incomeTotal - expenseTotal;

    document.getElementById('ops-income-total').textContent = incomeTotal.toLocaleString();
    document.getElementById('ops-expense-total').textContent = expenseTotal.toLocaleString();
    document.getElementById('ops-net-total').textContent = netTotal.toLocaleString();
    
    // Dynamic color for Net Operations based on positive/negative value
    const netOpsEl = document.getElementById('ops-net-total');
    if (netTotal < 0) {
        netOpsEl.className = 'summary-card-value negative';
    } else if (netTotal > 0) {
        netOpsEl.className = 'summary-card-value positive';
    } else {
        netOpsEl.className = 'summary-card-value';
    }

    const balanceChangeDiv = document.getElementById('ops-balance-change');
    if (netTotal !== lastOpsNet) {
        const change = netTotal - lastOpsNet;
        const isUp = change > 0;
        balanceChangeDiv.className = `balance-change show ${isUp ? 'up' : 'down'}`;
        balanceChangeDiv.innerHTML = `${isUp ? '📈' : '📉'} ${isUp ? '+' : ''}${change.toLocaleString()} <button class="btn-dismiss-change" onclick="dismissBalanceChange('ops-balance-change', ${netTotal}, 'operations')">✕</button>`;
    } else {
        balanceChangeDiv.classList.remove('show');
    }
}

function dismissBalanceChange(elementId, currentNet, type) {
    document.getElementById(elementId).classList.remove('show');
    if (type === 'asset') {
        lastAssetNet = currentNet;
    } else if (type === 'operations') {
        lastOpsNet = currentNet;
    } else {
        lastProfitNet = currentNet;
    }
}

// ===== KEYBOARD NAVIGATION =====
function handleTableKeydown(event, section, type, idx) {
    const key = event.key;
    const row = event.target.closest('tr');
    const table = row.closest('table').querySelector('tbody');
    const rows = Array.from(table.querySelectorAll('tr:not(.total-row)'));
    const rowIdx = rows.indexOf(row);
    const inputs = row.querySelectorAll('input');
    const colIdx = Array.from(inputs).indexOf(event.target);
    const isAmountField = event.target.type === 'number';

    if (key === 'Enter') {
        event.preventDefault();
        if (rowIdx === rows.length - 1) {
            // Last row - add new row
            if (section === 'asset') {
                addSingleAssetRow(type);
            } else if (section === 'operations') {
                addSingleOpsRow(type);
            } else {
                addSingleProfitRow(type);
            }
            // After adding new row, focusNewRow will be called which now focuses the Amount field.
        } else {
            // Move to next row
            const nextRow = rows[rowIdx + 1];
            const nextInput = nextRow.querySelectorAll('input')[colIdx];
            if (nextInput) nextInput.focus();
        }
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        // Disable default up/down for number inputs to prevent value change
        if (isAmountField && (key === 'ArrowUp' || key === 'ArrowDown')) {
            event.preventDefault();
        }

        let nextRow, nextColIdx = colIdx;

        if (key === 'ArrowUp' && rowIdx > 0) {
            nextRow = rows[rowIdx - 1];
        } else if (key === 'ArrowDown' && rowIdx < rows.length - 1) {
            nextRow = rows[rowIdx + 1];
        } else if (key === 'ArrowLeft' && colIdx > 0) {
            // Move to previous column
            const prevInput = inputs[colIdx - 1];
            if (prevInput) {
                event.preventDefault();
                prevInput.focus();
            }
            return;
        } else if (key === 'ArrowRight' && colIdx < inputs.length - 1) {
            // Move to next column
            const nextInput = inputs[colIdx + 1];
            if (nextInput) {
                event.preventDefault();
                nextInput.focus();
            }
            return;
        }

        if (nextRow) {
            event.preventDefault();
            const nextInput = nextRow.querySelectorAll('input')[colIdx];
            if (nextInput) nextInput.focus();
        }
    }
}

function focusNewRow(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tr:not(.total-row)');
    if(rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        // For expense rows, the first interactive element is the select. 
        // But the user wants to focus the In/Out (Amount or Reason?) after Enter.
        // User says: "In (+) / Out (-) အကွက်ဆီ Cursor ကို တန်းရောက်အောင် ပြင်ပေးပါ။ Tab တချက် နှိပ်လိုက်ရင် Category ကို ရွေ့ပါမယ်။ နောက်တချက်ကို Reason ပါ။"
        // This implies the focus should start at Amount, then Tab to Category, then Tab to Reason.
        
        // Let's adjust the tabIndex to achieve this order: Amount (1) -> Category (2) -> Reason (3)
        // However, focusNewRow is called after Enter. We should focus the Amount field of the new row.
        const amountInput = lastRow.querySelector('input[type="number"]');
        if(amountInput) {
            amountInput.focus();
        } else {
            const firstInput = lastRow.querySelector('input[type="text"]');
            if(firstInput) firstInput.focus();
        }
    }
}

// ===== CLEAR DATA FUNCTIONS =====
function clearAssetData() {
    db.assets.income = [{name: '', amount: '', timestamp: '', category: ''}];
    db.assets.expense = [{name: '', amount: '', timestamp: '', category: ''}];
    renderAssets();
    saveAllData();
}

function clearProfitData() {
    db.profit.income = [{desc: '', amount: '', timestamp: ''}];
    db.profit.expense = [{reason: '', amount: '', timestamp: ''}];
    renderProfit();
    saveAllData();
}

function clearOpsData() {
    db.operations.income = [{desc: '', amount: '', timestamp: ''}];
    db.operations.expense = [{reason: '', amount: '', timestamp: ''}];
    renderOperations();
    saveAllData();
}

// ===== HISTORY FUNCTIONS =====
function saveMonthlyHistory() {
    const incomeTotal = db.profit.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const expenseTotal = db.profit.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netProfit = incomeTotal - expenseTotal;

    const monthKey = getMonthKey();
    db.history.profit[monthKey] = {
        income: incomeTotal,
        expense: expenseTotal,
        profit: netProfit,
        details: {
            income: JSON.parse(JSON.stringify(db.profit.income.filter(i => i.amount))),
            expense: JSON.parse(JSON.stringify(db.profit.expense.filter(i => i.amount)))
        }
    };

    saveAllData();
    renderHistory();
    alert('✅ Monthly summary and details saved successfully!');
}

function saveOpsMonthlyHistory() {
    const incomeTotal = db.operations.income.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const expenseTotal = db.operations.expense.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netTotal = incomeTotal - expenseTotal;

    const monthKey = getMonthKey();
    db.history.operations[monthKey] = {
        income: incomeTotal,
        expense: expenseTotal,
        profit: netTotal,
        details: {
            income: JSON.parse(JSON.stringify(db.operations.income.filter(i => i.amount))),
            expense: JSON.parse(JSON.stringify(db.operations.expense.filter(i => i.amount)))
        }
    };

    saveAllData();
    renderHistory();
    alert('✅ Operations monthly summary and details saved successfully!');
}

function setHistoryType(type) {
    currentHistoryType = type;
    document.getElementById('historyProfitBtn').classList.toggle('active', type === 'profit');
    document.getElementById('historyOpsBtn').classList.toggle('active', type === 'operations');
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const activeHistory = db.history[currentHistoryType] || {};

    if (activeHistory.hasOwnProperty('undefined') || activeHistory.hasOwnProperty('null')) {
        delete activeHistory['undefined'];
        delete activeHistory['null'];
        saveAllData();
    }

    const sortedMonths = Object.keys(activeHistory)
        .filter(key => key !== 'undefined' && key !== 'null' && key !== '')
        .filter(key => activeHistory[key] && typeof activeHistory[key] === 'object')
        .sort()
        .reverse()
        .slice(0, 5);
    
    if(sortedMonths.length === 0) {
        historyList.innerHTML = `<div class="empty-history">No ${currentHistoryType === 'profit' ? 'profit' : 'operations'} history records yet. Save your monthly summary to see it here.</div>`;
        return;
    }

    historyList.innerHTML = '';
    sortedMonths.forEach((monthKey) => {
        const entry = activeHistory[monthKey];
        const isProfit = entry.profit >= 0;
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item' + (isProfit ? '' : ' expense');
        
        // Special display for invalid keys
        const displayDate = (monthKey === 'undefined' || monthKey === 'null' || !monthKey) ? '⚠️ Invalid Entry' : `📅 ${formatMonthDisplay(monthKey)}`;
        
        historyItem.innerHTML = `
            <button class="btn-delete-history" onclick="deleteHistoryItem('${monthKey}', '${currentHistoryType}')">🗑️ Delete</button>
            <div class="history-date">${displayDate}</div>
            <div class="history-data">
                <div class="history-data-item">
                    <div class="history-data-label">Income</div>
                    <div class="history-data-value positive">${(entry.income || 0).toLocaleString()}</div>
                </div>
                <div class="history-data-item">
                    <div class="history-data-label">Expenses</div>
                    <div class="history-data-value negative">${(entry.expense || 0).toLocaleString()}</div>
                </div>
                <div class="history-data-item">
                    <div class="history-data-label">Net Profit</div>
                    <div class="history-data-value ${isProfit ? 'positive' : 'negative'}">${(entry.profit || 0).toLocaleString()}</div>
                </div>
            </div>
            ${entry.details ? `<button class="history-details-btn" onclick="showHistoryDetails('${monthKey}', '${currentHistoryType}')">📄 Show Details</button>` : ''}
        `;
        historyList.appendChild(historyItem);
    });
}

function deleteHistoryItem(monthKey, sectionType = 'profit') {
    if (confirm(`Are you sure you want to delete the history for ${monthKey === 'undefined' ? 'this invalid entry' : monthKey}?`)) {
        if (!db.history[sectionType]) {
            db.history[sectionType] = {};
        }
        delete db.history[sectionType][monthKey];
        saveAllData();
        renderHistory();
    }
}

function showHistoryDetails(monthKey, sectionType = 'profit') {
    const sourceHistory = db.history[sectionType] || {};
    const entry = sourceHistory[monthKey];
    if (!entry || !entry.details) return;

    const titlePrefix = sectionType === 'operations' ? 'Operations' : 'Profit';
    const netLabel = sectionType === 'operations' ? 'Net Operation' : 'Net Profit';
    const label = `📊 ${titlePrefix} - ${formatMonthDisplay(monthKey)}`;
    document.getElementById('expDashTitle').textContent = label;

    const incomeTotal = entry.income || 0;
    const expenseTotal = entry.expense || 0;
    const netTotal = incomeTotal - expenseTotal;
    document.getElementById('expDashIncome').textContent = incomeTotal.toLocaleString();
    document.getElementById('expDashExpense').textContent = expenseTotal.toLocaleString();
    document.getElementById('expDashCanvasTotal').textContent = expenseTotal.toLocaleString();
    document.getElementById('expDashNetLabel').textContent = netLabel;
    const netEl = document.getElementById('expDashNet');
    netEl.textContent = netTotal.toLocaleString();
    netEl.className = 'exp-dash-total-value ' + (netTotal >= 0 ? 'positive' : 'negative');

    // Aggregate expense by category from saved details
    const catTotals = {};
    (entry.details.expense || []).forEach(item => {
        if (parseFloat(item.amount) > 0) {
            const cat = item.category || 'Uncategorized';
            catTotals[cat] = (catTotals[cat] || 0) + (parseFloat(item.amount) || 0);
        }
    });

    const noData = expenseTotal === 0 || Object.keys(catTotals).length === 0;
    document.getElementById('expDashNoData').style.display = noData ? 'block' : 'none';
    document.getElementById('expDashChartSection').style.display = noData ? 'none' : 'block';

    if (!noData) {
        drawDonutChart(catTotals, expenseTotal);
        buildDashLegend(catTotals, expenseTotal);
    }

    document.getElementById('expDashboardOverlay').classList.add('show');
}

function closeHistoryDetails() {
    document.getElementById('historyDetailsModal').style.display = 'none';
}

// ===== MODAL FUNCTIONS =====
function showModal(title, message, action) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    pendingAction = action;
    document.getElementById('confirmModal').classList.add('show');
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('show');
    pendingAction = null;
}

function executeConfirmedAction() {
    if(pendingAction === 'clearProfitData') {
        clearProfitData();
    } else if(pendingAction === 'clearOpsData') {
        clearOpsData();
    } else if(pendingAction === 'clearAssetData') {
        clearAssetData();
    }
    closeModal();
}

// ===== BACKUP & RESTORE FUNCTIONS =====
function exportData() {
    const dataToExport = {
        version: '2.1',
        exportDate: new Date().toISOString(),
        data: db
    };
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-tracker-backup-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData() {
    document.getElementById('fileInput').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            let rawData = null;

            if(importedData.data) {
                // Wrapped format: { version, exportDate, data: {...} }
                rawData = importedData.data;
            } else if(importedData.assets || importedData.profit || importedData.operations) {
                // Raw format: { assets, profit, operations, history }
                rawData = importedData;
            }

            if(rawData) {
                db = normalizeDbShape(rawData);
                // Run same migration as init
                const expCatRemap = { 
                    'Dress': 'House', 
                    'My Son': 'Grocery', 
                    'Electric': 'House', 
                    'Phone': 'Personal', 
                    'Restaurant': 'Dining'
                };
                function migrateExpCat(item) { if (!('category' in item) || !item.category) { item.category = ''; return; } if (expCatRemap[item.category]) item.category = expCatRemap[item.category]; }
                db.profit.expense.forEach(migrateExpCat);
                db.operations.expense.forEach(migrateExpCat);
                function migrateIncCat(item) { if (!('category' in item) || !item.category) { const d = (item.desc || '').toLowerCase(); if (d.includes('win')) item.category = 'Win'; else if (d.includes('lose')) item.category = 'Lose'; else item.category = 'Income'; } }
                db.profit.income.forEach(migrateIncCat);
                db.operations.income.forEach(migrateIncCat);
                db.assets.income.forEach(item => { if (!('category' in item)) item.category = ''; if (item.category === 'CB Banking Special') item.category = 'CB Banking (S)'; });
                db.assets.expense.forEach(item => { if (!('category' in item)) item.category = ''; if (item.category === 'CB Banking Special') item.category = 'CB Banking (S)'; });
                saveAllData();
                renderAssets();
                renderProfit();
                renderOperations();
                renderHistory();
                alert('✅ Data imported successfully!');
            } else {
                alert('❌ Invalid file format. Please use a valid backup file.');
            }
        } catch(error) {
            alert('❌ Error reading file: ' + error.message);
        }
    };
    reader.readAsText(file);
    document.getElementById('fileInput').value = '';
}

// ===== CLOSE MODAL ON OUTSIDE CLICK =====
window.onclick = function(event) {
    const modal = document.getElementById('confirmModal');
    if(event.target === modal) {
        closeModal();
    }
}

// init() called by auth.onAuthStateChanged

const SUPABASE_URL = 'https://cgmpuiezzomavdygfjzx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kNIcsfpgwrV3vw4BPyk2DA_OHLS6j8Q';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CATEGORIES = [
  { name: 'Alimentação', icon: '🛒', color: '#1267ff', keywords: ['mercado','supermercado','feira','almoço','almoco','jantar','lanche','comida','pizza','restaurante','açaí','acai','padaria','carne','fruta','verdura'] },
  { name: 'Transporte', icon: '⛽', color: '#16a34a', keywords: ['gasolina','combustível','combustivel','posto','uber','ônibus','onibus','moto','carro','taxi','transporte'] },
  { name: 'Moradia', icon: '🏠', color: '#f5b700', keywords: ['aluguel','energia','luz','água','agua','internet','wifi','gás','gas','condominio','casa','moradia'] },
  { name: 'Saúde', icon: '💊', color: '#7c3aed', keywords: ['remédio','remedio','farmácia','farmacia','consulta','médico','medico','exame','dentista','saúde','saude'] },
  { name: 'Educação', icon: '🎓', color: '#ef7d22', keywords: ['escola','faculdade','curso','livro','material','mensalidade','educação','educacao'] },
  { name: 'Lazer', icon: '🎮', color: '#ef4444', keywords: ['cinema','jogo','lazer','festa','bar','sorvete','passeio','netflix','streaming'] },
  { name: 'Roupas/Beleza', icon: '👕', color: '#06b6d4', keywords: ['roupa','camisa','calça','calcado','sapato','cabelo','beleza','perfume','cosmético','cosmetico'] },
  { name: 'Outros', icon: '📦', color: '#98a2b3', keywords: [] }
];

const defaultLimits = {
  'Alimentação': 800,
  'Transporte': 400,
  'Moradia': 700,
  'Saúde': 300,
  'Educação': 900,
  'Lazer': 200,
  'Roupas/Beleza': 200,
  'Outros': 250
};

let expenses = [];
let limits = { ...defaultLimits };
let currentTab = 'lancar';
let currentUser = load('cg_user', null);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function mapExpense(row) {
  return {
    id: row.id,
    description: row.descricao,
    value: Number(row.valor),
    category: row.categoria,
    date: row.data
  };
}
function money(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthISO(date = new Date()) { return date.toISOString().slice(0, 7); }
function normalizeText(text) { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

async function init() {
  $('#expenseDate').value = todayISO();
  $('#filterMonth').value = monthISO();
  fillCategorySelects();
  setupEvents();
  renderLimitsForm();
  await checkLogin();
}

function setupEvents() {
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#registerForm').addEventListener('submit', handleRegister);
  $('#showRegisterBtn').addEventListener('click', () => toggleAuthMode('register'));
  $('#showLoginBtn').addEventListener('click', () => toggleAuthMode('login'));
  $('#profileForm').addEventListener('submit', updateProfile);
  $('#logoutBtn').addEventListener('click', logout);
  $('#expenseText').addEventListener('input', handleExpenseTextInput);
  $('#expenseForm').addEventListener('submit', addExpense);
  $('#filterMonth').addEventListener('change', renderAll);
  $('#dashboardCategoryFilter').addEventListener('change', renderAll);
  $('#listCategoryFilter').addEventListener('change', renderExpensesList);
  $('#searchExpense').addEventListener('input', renderExpensesList);
  $('#exportBtn').addEventListener('click', exportCSV);
  $('#sampleBtn').addEventListener('click', loadSampleData);
  $('#clearBtn').addEventListener('click', clearData);
  $('#themeToggle').addEventListener('click', () => document.body.classList.toggle('dark'));
  $('#mobileTabSelect').addEventListener('change', (e) => openTab(e.target.value));
  $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => openTab(btn.dataset.tab)));
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-open-tab]');
    if (target) openTab(target.dataset.openTab);
  });
}

function toggleAuthMode(mode) {
  const showRegister = mode === 'register';
  $('#loginForm').classList.toggle('hidden', showRegister);
  $('#registerForm').classList.toggle('hidden', !showRegister);
}

async function handleLogin(e) {
  e.preventDefault();
  const user = $('#loginUser').value.trim();
  const pass = $('#loginPass').value.trim();

  const { data, error } = await db
    .from('usuarios')
    .select('id, nome, usuario')
    .eq('usuario', user)
    .eq('senha', pass)
    .single();

  if (error || !data) {
    alert('Usuário ou senha incorretos.');
    return;
  }

  currentUser = data;
  save('cg_user', currentUser);
  await checkLogin();
}

async function handleRegister(e) {
  e.preventDefault();
  const nome = $('#registerName').value.trim();
  const usuario = $('#registerUser').value.trim();
  const senha = $('#registerPass').value.trim();
  const confirmar = $('#registerPassConfirm').value.trim();

  if (!nome || !usuario || !senha) return alert('Preencha todos os campos do cadastro.');
  if (senha.length < 4) return alert('A senha deve ter pelo menos 4 caracteres.');
  if (senha !== confirmar) return alert('As senhas não conferem.');

  const { data, error } = await db
    .from('usuarios')
    .insert({ nome, usuario, senha })
    .select('id, nome, usuario')
    .single();

  if (error) {
    console.error(error);
    const duplicate = String(error.message || '').toLowerCase().includes('duplicate') || error.code === '23505';
    alert(duplicate ? 'Esse usuário já existe. Escolha outro usuário.' : 'Não foi possível criar o cadastro.');
    return;
  }

  currentUser = data;
  save('cg_user', currentUser);
  $('#registerForm').reset();
  toggleAuthMode('login');
  await checkLogin();
  alert('Cadastro criado com sucesso!');
}
function logout() {
  localStorage.removeItem('cg_user');
  currentUser = null;
  expenses = [];
  limits = { ...defaultLimits };
  checkLogin();
}
async function checkLogin() {
  const logged = !!currentUser?.id;
  $('#loginScreen').classList.toggle('hidden', logged);
  $('#appScreen').classList.toggle('hidden', !logged);

  if (logged) {
    updateCurrentUserUI();
    fillProfileForm();
    await loadUserData();
    openTab(currentTab);
  }
}

function updateCurrentUserUI() {
  const initials = (currentUser?.nome || currentUser?.usuario || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
  $('.avatar').textContent = initials || 'U';
}

function fillProfileForm() {
  $('#profileName').value = currentUser?.nome || '';
  $('#profileUser').value = currentUser?.usuario || '';
  $('#profilePass').value = '';
  $('#profilePassConfirm').value = '';
}

async function updateProfile(e) {
  e.preventDefault();
  if (!currentUser?.id) return;

  const nome = $('#profileName').value.trim();
  const usuario = $('#profileUser').value.trim();
  const senha = $('#profilePass').value.trim();
  const confirmar = $('#profilePassConfirm').value.trim();

  if (!nome || !usuario) return alert('Nome e usuário são obrigatórios.');
  if ((senha || confirmar) && senha !== confirmar) return alert('As senhas não conferem.');
  if (senha && senha.length < 4) return alert('A nova senha deve ter pelo menos 4 caracteres.');

  const payload = { nome, usuario };
  if (senha) payload.senha = senha;

  const { data, error } = await db
    .from('usuarios')
    .update(payload)
    .eq('id', currentUser.id)
    .select('id, nome, usuario')
    .single();

  if (error) {
    console.error(error);
    const duplicate = String(error.message || '').toLowerCase().includes('duplicate') || error.code === '23505';
    alert(duplicate ? 'Esse usuário já existe. Escolha outro usuário.' : 'Não foi possível alterar o login.');
    return;
  }

  currentUser = data;
  save('cg_user', currentUser);
  fillProfileForm();
  updateCurrentUserUI();
  alert('Dados de acesso alterados com sucesso!');
}
async function loadUserData() {
  await loadExpensesFromDB();
  await loadLimitsFromDB();
  renderAll();
}
async function loadExpensesFromDB() {
  const { data, error } = await db
    .from('gastos')
    .select('*')
    .eq('usuario_id', currentUser.id)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false });

  if (error) {
    console.error(error);
    alert('Não foi possível carregar os gastos do banco.');
    expenses = [];
    return;
  }

  expenses = (data || []).map(mapExpense);
}
async function loadLimitsFromDB() {
  const { data, error } = await db
    .from('limites')
    .select('*')
    .eq('usuario_id', currentUser.id);

  limits = { ...defaultLimits };

  if (error) {
    console.error(error);
    return;
  }

  (data || []).forEach(row => {
    limits[row.categoria] = Number(row.valor_limite);
  });
}

function fillCategorySelects() {
  const options = CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  $('#expenseCategory').innerHTML = options;
  $('#dashboardCategoryFilter').innerHTML = `<option value="Todas">Todas as categorias</option>${options}`;
  $('#listCategoryFilter').innerHTML = `<option value="Todas">Todas as categorias</option>${options}`;
}

function openTab(tab) {
  currentTab = tab;
  $$('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  $$('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
  $('#mobileTabSelect').value = tab;
  if (tab === 'dashboard') renderDashboard();
}

function handleExpenseTextInput() {
  autoDetectCategory();
  autoFillExpenseValue();
}
function autoDetectCategory() {
  const text = normalizeText($('#expenseText').value);
  const found = detectCategory(text);
  $('#expenseCategory').value = found.name;
}
function autoFillExpenseValue() {
  const extracted = extractValue($('#expenseText').value);
  const valueInput = $('#expenseValue');
  if (extracted > 0) valueInput.value = extracted.toFixed(2);
}
function detectCategory(text) {
  const normalized = normalizeText(text);
  return CATEGORIES.find(cat => cat.keywords.some(k => normalized.includes(normalizeText(k)))) || CATEGORIES.find(c => c.name === 'Outros');
}
function extractValue(text) {
  const match = text.replace(',', '.').match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : 0;
}
function cleanDescription(text) {
  return text.replace(/\d+[,.]?\d*/g, '').trim() || 'Gasto sem descrição';
}

async function addExpense(e) {
  e.preventDefault();
  if (!currentUser?.id) return alert('Faça login para salvar o gasto.');

  const text = $('#expenseText').value.trim();
  const typedValue = parseFloat(String($('#expenseValue').value || '').replace(',', '.'));
  const extractedValue = extractValue(text);
  const value = typedValue > 0 ? typedValue : extractedValue;
  if (!text) {
    alert('Digite o nome do gasto. Exemplo: tapioca');
    $('#expenseText').focus();
    return;
  }
  if (!value || value <= 0) {
    alert('Informe o valor do gasto no campo Valor. Exemplo: 25,00');
    $('#expenseValue').focus();
    return;
  }

  const category = $('#expenseCategory').value || detectCategory(text).name;
  const newExpense = {
    usuario_id: currentUser.id,
    descricao: capitalize(cleanDescription(text)),
    valor: value,
    categoria: category,
    data: $('#expenseDate').value || todayISO()
  };

  const { data, error } = await db
    .from('gastos')
    .insert(newExpense)
    .select('*')
    .single();

  if (error) {
    console.error(error);
    alert('Não foi possível salvar no banco de dados.');
    return;
  }

  expenses.unshift(mapExpense(data));
  $('#expenseForm').reset();
  $('#expenseDate').value = todayISO();
  $('#expenseValue').value = '';
  $('#expenseCategory').value = detectCategory('').name;
  renderAll();
  showQuickAlert(category);
  alert('Gasto salvo com sucesso!');
}
function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

function getSelectedMonthExpenses() {
  const month = $('#filterMonth').value || monthISO();
  const category = $('#dashboardCategoryFilter').value || 'Todas';
  return expenses.filter(e => e.date.startsWith(month) && (category === 'Todas' || e.category === category));
}
function getMonthExpenses(month) { return expenses.filter(e => e.date.startsWith(month)); }
function sum(list) { return list.reduce((acc, e) => acc + Number(e.value), 0); }
function groupByCategory(list) {
  return CATEGORIES.map(cat => ({ ...cat, total: sum(list.filter(e => e.category === cat.name)) })).filter(c => c.total > 0);
}
function renderAll() {
  renderDashboard();
  renderExpensesList();
  renderAlerts();
  renderLimitsForm();
}

function renderDashboard() {
  const list = getSelectedMonthExpenses();
  const month = $('#filterMonth').value || monthISO();
  const total = sum(list);
  const count = list.length;
  const grouped = groupByCategory(list);
  const top = grouped.sort((a,b) => b.total - a.total)[0];
  const previousMonthDate = new Date(`${month}-02T00:00:00`);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = monthISO(previousMonthDate);
  const previousTotal = sum(getMonthExpenses(previousMonth));
  const diff = previousTotal ? ((total - previousTotal) / previousTotal) * 100 : 0;

  $('#statTotal').textContent = money(total);
  $('#statCount').textContent = count;
  $('#statAverage').textContent = money(count ? total / count : 0);
  $('#statTopCategory').textContent = top ? top.name : '-';
  $('#statTopCategoryValue').textContent = top ? `${money(top.total)} (${((top.total / total) * 100).toFixed(1).replace('.', ',')}%)` : money(0);
  $('#chartMonthLabel').textContent = formatMonth(month);

  if (!previousTotal) {
    $('#statCompare').textContent = 'Sem comparação';
    $('#statCompare').className = '';
  } else {
    $('#statCompare').textContent = `${Math.abs(diff).toFixed(1).replace('.', ',')}% ${diff <= 0 ? 'abaixo' : 'acima'} do mês passado`;
    $('#statCompare').className = diff <= 0 ? 'positive' : 'negative';
  }

  drawLineChart(list, month);
  drawDonut(groupByCategory(list), total);
  renderRecentExpenses(list.slice(0, 4));
  renderDashboardAlerts();
}

function formatMonth(month) {
  const [year, m] = month.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${names[Number(m)-1]} de ${year}`;
}

function drawLineChart(list, month) {
  const canvas = $('#lineCanvas');
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = 260 * ratio;
  ctx.scale(ratio, ratio);
  const w = rect.width, h = 260;
  ctx.clearRect(0,0,w,h);
  const pad = { left: 70, right: 20, top: 25, bottom: 40 };
  const daysInMonth = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate();
  const totals = Array(daysInMonth).fill(0);
  list.forEach(e => { totals[Number(e.date.slice(8,10))-1] += Number(e.value); });
  let cumulative = 0;
  const cumulativeTotals = totals.map(v => cumulative += v);
  const max = Math.max(...cumulativeTotals, 100);
  const niceMax = Math.ceil(max / 500) * 500;

  ctx.strokeStyle = '#d8e2ef';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#667085';
  ctx.font = '12px Inter, Arial';
  for (let i=0; i<=5; i++) {
    const y = pad.top + (h-pad.top-pad.bottom) * i / 5;
    const value = niceMax - niceMax * i / 5;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w-pad.right, y); ctx.stroke();
    ctx.fillText(money(value).replace(',00',''), 8, y+4);
  }
  const xForDay = d => pad.left + (w-pad.left-pad.right) * (d-1) / Math.max(daysInMonth-1,1);
  const yForValue = v => pad.top + (h-pad.top-pad.bottom) * (1 - v / niceMax);

  const points = cumulativeTotals.map((v,i) => [xForDay(i+1), yForValue(v)]);
  ctx.beginPath();
  ctx.moveTo(points[0][0], h-pad.bottom);
  points.forEach(([x,y]) => ctx.lineTo(x,y));
  ctx.lineTo(points[points.length-1][0], h-pad.bottom);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, h-pad.bottom);
  grad.addColorStop(0, 'rgba(18,103,255,.22)');
  grad.addColorStop(1, 'rgba(18,103,255,.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.strokeStyle = '#1267ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#1267ff';
  points.forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });

  [1,5,10,15,20,25,daysInMonth].forEach(day => {
    ctx.fillStyle = '#667085';
    ctx.fillText(`${day} ${formatMonth(month).slice(0,3)}`, xForDay(day)-14, h-12);
  });
}

function drawDonut(grouped, total) {
  const canvas = $('#donutCanvas');
  const ctx = canvas.getContext('2d');
  const size = 240;
  canvas.width = size; canvas.height = size;
  ctx.clearRect(0,0,size,size);
  const cx = size/2, cy = size/2, radius = 92;
  let start = -Math.PI / 2;
  if (!total) {
    ctx.strokeStyle = '#e8eef8'; ctx.lineWidth = 34; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();
  } else {
    grouped.forEach(g => {
      const angle = (g.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 34;
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.stroke();
      start += angle;
    });
  }
  ctx.fillStyle = '#101828';
  ctx.font = '800 20px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(money(total), cx, cy - 4);
  ctx.fillStyle = '#667085';
  ctx.font = '14px Inter, Arial';
  ctx.fillText('Total', cx, cy + 22);

  $('#categoryLegend').innerHTML = grouped.length ? grouped.map(g => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${g.color}"></span>
      <span>${g.name}</span>
      <strong>${money(g.total)}</strong>
      <span>${((g.total / total) * 100).toFixed(1).replace('.', ',')}%</span>
    </div>
  `).join('') : '<p class="empty-state">Nenhum gasto no mês.</p>';
}

function renderRecentExpenses(list) { $('#recentExpenses').innerHTML = renderExpenseRows(list, true); }
function renderExpensesList() {
  const search = normalizeText($('#searchExpense').value || '');
  const category = $('#listCategoryFilter').value || 'Todas';
  let list = expenses.filter(e => (category === 'Todas' || e.category === category));
  if (search) list = list.filter(e => normalizeText(e.description).includes(search) || normalizeText(e.category).includes(search));
  $('#allExpenses').innerHTML = renderExpenseRows(list, false);
  $$('.delete-expense').forEach(btn => btn.addEventListener('click', () => deleteExpense(btn.dataset.id)));
}
function renderExpenseRows(list, compact) {
  if (!list.length) return '<p class="empty-state">Nenhum gasto encontrado.</p>';
  return list.map(e => {
    const cat = CATEGORIES.find(c => c.name === e.category) || CATEGORIES.at(-1);
    return `<div class="expense-row">
      <div class="category-icon" style="background:${cat.color}1a">${cat.icon}</div>
      <div class="expense-main"><strong>${e.description}</strong><span>${e.category}</span></div>
      <div class="expense-date">${formatDate(e.date)}</div>
      <div class="expense-value">${money(e.value)}</div>
      ${compact ? '' : `<button class="delete-expense" data-id="${e.id}" title="Excluir">×</button>`}
    </div>`;
  }).join('');
}
async function deleteExpense(id) {
  if (!currentUser?.id) return;

  const { error } = await db
    .from('gastos')
    .delete()
    .eq('id', id)
    .eq('usuario_id', currentUser.id);

  if (error) {
    console.error(error);
    alert('Não foi possível excluir o gasto.');
    return;
  }

  expenses = expenses.filter(e => e.id !== id);
  renderAll();
}
function formatDate(date) { return date.split('-').reverse().join('/'); }

function renderLimitsForm() {
  $('#limitsForm').innerHTML = CATEGORIES.map(cat => `
    <div class="limit-item">
      <label>${cat.icon} ${cat.name}
        <input type="number" min="0" step="10" value="${limits[cat.name] ?? 0}" data-limit-cat="${cat.name}">
      </label>
    </div>
  `).join('');

  $$('[data-limit-cat]').forEach(input => input.addEventListener('change', async () => {
    limits[input.dataset.limitCat] = Number(input.value || 0);
    await saveLimitToDB(input.dataset.limitCat, limits[input.dataset.limitCat]);
    renderAlerts();
    renderDashboardAlerts();
  }));
}
async function saveLimitToDB(category, value) {
  if (!currentUser?.id) return;

  const { error } = await db
    .from('limites')
    .upsert({
      usuario_id: currentUser.id,
      categoria: category,
      valor_limite: Number(value || 0)
    }, { onConflict: 'usuario_id,categoria' });

  if (error) {
    console.error(error);
    alert('Não foi possível salvar o limite no banco.');
  }
}
function getAlerts() {
  const month = $('#filterMonth').value || monthISO();
  const monthList = getMonthExpenses(month);
  return CATEGORIES.map(cat => {
    const spent = sum(monthList.filter(e => e.category === cat.name));
    const limit = Number(limits[cat.name] || 0);
    const percent = limit ? (spent / limit) * 100 : 0;
    return { ...cat, spent, limit, percent };
  }).filter(a => a.limit > 0 && a.percent >= 80).sort((a,b) => b.percent - a.percent);
}
function renderAlertItems(alerts) {
  if (!alerts.length) return '<p class="empty-state">Nenhum alerta no mês. Você está dentro dos limites cadastrados.</p>';
  return alerts.map(a => `<div class="alert-item ${a.percent >= 100 ? 'danger' : ''}">
    <div class="alert-icon">⚠</div>
    <div><strong>${a.name}</strong><span>${money(a.spent)} de ${money(a.limit)}</span></div>
    <div class="badge">${Math.round(a.percent)}% do limite</div>
  </div>`).join('');
}
function renderAlerts() { $('#allAlerts').innerHTML = renderAlertItems(getAlerts()); }
function renderDashboardAlerts() { $('#dashboardAlerts').innerHTML = renderAlertItems(getAlerts().slice(0,2)); }
function showQuickAlert(category) {
  const alertData = getAlerts().find(a => a.name === category);
  if (!alertData) { $('#quickAlertArea').innerHTML = ''; return; }
  $('#quickAlertArea').innerHTML = renderAlertItems([alertData]);
  setTimeout(() => { $('#quickAlertArea').innerHTML = ''; }, 7000);
}

function exportCSV() {
  const header = ['Data','Descrição','Categoria','Valor'];
  const rows = expenses.map(e => [e.date, e.description, e.category, String(e.value).replace('.', ',')]);
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'controle-de-gastos.csv'; a.click();
  URL.revokeObjectURL(url);
}
async function loadSampleData() {
  if (!currentUser?.id) return alert('Faça login para carregar dados de exemplo.');

  const month = monthISO();
  const sample = [
    { descricao:'Gasolina', valor:120, categoria:'Transporte', data:`${month}-03` },
    { descricao:'Mercado', valor:240.50, categoria:'Alimentação', data:`${month}-04` },
    { descricao:'Internet', valor:99.90, categoria:'Moradia', data:`${month}-05` },
    { descricao:'Remédio', valor:45.90, categoria:'Saúde', data:`${month}-07` },
    { descricao:'Escola dos filhos', valor:840, categoria:'Educação', data:`${month}-08` },
    { descricao:'Almoço', valor:35, categoria:'Alimentação', data:`${month}-10` },
    { descricao:'Feira do mês', valor:380, categoria:'Alimentação', data:`${month}-12` },
    { descricao:'Uber', valor:28, categoria:'Transporte', data:`${month}-14` },
    { descricao:'Lanche', valor:32, categoria:'Alimentação', data:`${month}-17` },
    { descricao:'Cinema', valor:70, categoria:'Lazer', data:`${month}-18` },
    { descricao:'Energia', valor:250, categoria:'Moradia', data:`${month}-20` },
    { descricao:'Gasolina', valor:160, categoria:'Transporte', data:`${month}-22` }
  ].map(item => ({ ...item, usuario_id: currentUser.id }));

  const { data, error } = await db
    .from('gastos')
    .insert(sample)
    .select('*');

  if (error) {
    console.error(error);
    alert('Não foi possível carregar os dados de exemplo.');
    return;
  }

  expenses = [...(data || []).map(mapExpense), ...expenses];
  renderAll();
}
async function clearData() {
  if (!currentUser?.id) return;
  if (!confirm('Tem certeza que deseja apagar todos os gastos?')) return;

  const { error } = await db
    .from('gastos')
    .delete()
    .eq('usuario_id', currentUser.id);

  if (error) {
    console.error(error);
    alert('Não foi possível limpar os gastos.');
    return;
  }

  expenses = [];
  renderAll();
}

init();

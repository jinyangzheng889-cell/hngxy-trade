/* ========== 河南工学院校园二手交易平台 - 通用交互逻辑（v2 安全版） ========== */

// ---------- XSS 防护 ----------
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- 加密工具 ----------
const ENC_KEY = 'hngxy_trade_2026@secure';
const PW_SALT = 'hngxy_pw_salt_v2';

function encryptData(plain) {
  let r = '';
  for (let i = 0; i < plain.length; i++) {
    r += String.fromCharCode(plain.charCodeAt(i) ^ ENC_KEY.charCodeAt(i % ENC_KEY.length));
  }
  return btoa(r);
}

function decryptData(cipher) {
  try {
    const d = atob(cipher);
    let r = '';
    for (let i = 0; i < d.length; i++) {
      r += String.fromCharCode(d.charCodeAt(i) ^ ENC_KEY.charCodeAt(i % ENC_KEY.length));
    }
    return r;
  } catch(e) { return ''; }
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw + PW_SALT);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ---------- 数据存储 ----------
const STORAGE_KEY = 'hngxy_trade_v2';

function getDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const init = {
    users: [],
    currentUser: null,
    products: [],
    messages: {},
    comments: {},
    favorites: {},
    orders: [],
    refunds: []
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
  return init;
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ---------- 用户认证 ----------
async function registerUser(username, phone, password) {
  const db = getDB();
  if (db.users.find(u => u.username === username)) return { ok: false, msg: '用户名已存在' };
  if (db.users.find(u => u.phoneEnc && decryptData(u.phoneEnc) === phone)) return { ok: false, msg: '该手机号已注册' };
  const pwHash = await hashPassword(password);
  const user = {
    id: 'u_' + Date.now(),
    username,
    phoneEnc: encryptData(phone),
    pwHash,
    role: 'user',
    banned: false,
    avatar: '',
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  saveDB(db);
  return { ok: true };
}

async function loginUser(username, password) {
  const db = getDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return { ok: false, msg: '账号或密码错误' };
  if (user.banned) return { ok: false, msg: '该账号已被封禁，请联系管理员' };
  const pwHash = await hashPassword(password);
  if (user.pwHash !== pwHash) return { ok: false, msg: '账号或密码错误' };
  db.currentUser = { id: user.id, username: user.username, phone: decryptData(user.phoneEnc), role: user.role, avatar: user.avatar };
  saveDB(db);
  return { ok: true, user: db.currentUser };
}

function quickLogin(provider) {
  const db = getDB();
  const user = {
    id: provider + '_' + Date.now(),
    username: provider + '用户' + Math.floor(Math.random() * 9000 + 1000),
    phoneEnc: '',
    pwHash: '',
    role: 'user',
    banned: false,
    avatar: '',
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  db.currentUser = { id: user.id, username: user.username, phone: '', role: 'user', avatar: '' };
  saveDB(db);
  return { ok: true, user: db.currentUser };
}

function logoutUser() {
  const db = getDB();
  db.currentUser = null;
  saveDB(db);
}

function getCurrentUser() {
  return getDB().currentUser;
}

function isLoggedIn() {
  return !!getDB().currentUser;
}

function isAdmin() {
  const u = getCurrentUser();
  return u && u.role === 'admin';
}

function requireLogin() {
  if (!isLoggedIn()) { showLoginModal(); return false; }
  if (getCurrentUser().banned) { showToast('账号已被封禁', 'error'); return false; }
  return true;
}

// ---------- 管理员功能 ----------
function getAllUsers() {
  return getDB().users.map(u => ({ ...u, phone: decryptData(u.phoneEnc), phoneEnc: undefined, pwHash: undefined }));
}

function adminBanUser(userId) {
  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return false;
  if (user.role === 'admin') return false;
  user.banned = !user.banned;
  saveDB(db);
  return true;
}

function adminDeleteProduct(productId) {
  const db = getDB();
  db.products = db.products.filter(p => p.id !== productId);
  saveDB(db);
}

function adminGetAllOrders() {
  return getDB().orders || [];
}

function adminRefundOrder(orderId) {
  const db = getDB();
  const order = db.orders.find(o => o.id === orderId);
  if (!order || order.status === 'completed') return false;
  db.refunds.push({
    id: 'r_' + Date.now(),
    orderId: order.id,
    productName: order.productName,
    buyerName: order.buyerName,
    sellerName: order.sellerName,
    price: order.price,
    resolvedAt: new Date().toISOString()
  });
  order.status = 'cancelled';
  const product = db.products.find(p => p.id === order.productId);
  if (product) product.status = 'active';
  saveDB(db);
  return true;
}

function getRefunds() {
  return getDB().refunds || [];
}

// ---------- 商品管理 ----------
function addProduct(data) {
  const db = getDB();
  const product = {
    id: 'p_' + Date.now(),
    ...data,
    sellerId: db.currentUser.id,
    sellerName: db.currentUser.username,
    createdAt: new Date().toISOString(),
    images: data.images || [],
    status: 'active'
  };
  db.products.unshift(product);
  saveDB(db);
  return product;
}

function getProducts(filter = {}) {
  let list = getDB().products.filter(p => p.status === 'active');
  if (filter.category && filter.category !== 'all') list = list.filter(p => p.category === filter.category);
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(kw) || p.desc.toLowerCase().includes(kw));
  }
  if (filter.sellerId) list = list.filter(p => p.sellerId === filter.sellerId);
  return list;
}

function getProductById(id) {
  return getDB().products.find(p => p.id === id);
}

function deleteProduct(id) {
  const db = getDB();
  const product = db.products.find(p => p.id === id);
  if (!product) return false;
  if (product.sellerId !== db.currentUser.id) return false;
  db.products = db.products.filter(p => p.id !== id);
  saveDB(db);
  return true;
}

// ---------- 担保交易 ----------
const ORDER_STATUS = {
  paid:      { label:'已付款·资金托管', icon:'🔒', color:'text-yellow-600', bg:'bg-yellow-50' },
  shipped:   { label:'卖家已发货',     icon:'📦', color:'text-blue-600',   bg:'bg-blue-50' },
  completed: { label:'交易完成',       icon:'✅', color:'text-green-600',  bg:'bg-green-50' },
  cancelled: { label:'已取消',         icon:'❌', color:'text-gray-400',   bg:'bg-gray-50' },
};

function createOrder(productId) {
  const db = getDB();
  const product = db.products.find(p => p.id === productId);
  if (!product) return { ok: false, msg: '商品不存在' };
  if (product.sellerId === db.currentUser.id) return { ok: false, msg: '不能购买自己的商品' };
  const exists = db.orders.find(o => o.productId === productId && o.buyerId === db.currentUser.id && o.status !== 'cancelled');
  if (exists) return { ok: false, msg: '你已对该商品下单' };
  const order = {
    id:'o_'+Date.now(), productId:product.id, productName:product.name, price:product.price,
    buyerId:db.currentUser.id, buyerName:db.currentUser.username,
    sellerId:product.sellerId, sellerName:product.sellerName,
    status:'paid', createdAt:new Date().toISOString()
  };
  db.orders.unshift(order);
  product.status = 'locked';
  saveDB(db);
  return { ok: true, order };
}

function getBuyOrders() {
  const db = getDB();
  if (!db.currentUser) return [];
  return (db.orders||[]).filter(o => o.buyerId === db.currentUser.id);
}

function getSellOrders() {
  const db = getDB();
  if (!db.currentUser) return [];
  return (db.orders||[]).filter(o => o.sellerId === db.currentUser.id);
}

function updateOrderStatus(orderId, status) {
  const db = getDB();
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return false;
  const user = db.currentUser;
  // 权限隔离：买家只能收货/取消，卖家只能发货
  if (status === 'shipped' && order.sellerId !== user.id) return false;
  if ((status === 'completed' || status === 'cancelled') && order.buyerId !== user.id) return false;
  if (status === 'shipped' && order.status !== 'paid') return false;
  if (status === 'completed' && order.status !== 'shipped') return false;
  if (status === 'cancelled' && order.status !== 'paid') return false;
  order.status = status;
  if (status === 'cancelled') {
    const product = db.products.find(p => p.id === order.productId);
    if (product) product.status = 'active';
  }
  saveDB(db);
  return true;
}

// ---------- 收藏 ----------
function toggleFav(productId) {
  const db = getDB();
  if (!db.currentUser) return false;
  if (!db.favorites[db.currentUser.id]) db.favorites[db.currentUser.id] = [];
  const idx = db.favorites[db.currentUser.id].indexOf(productId);
  if (idx > -1) { db.favorites[db.currentUser.id].splice(idx,1); saveDB(db); return false; }
  else { db.favorites[db.currentUser.id].push(productId); saveDB(db); return true; }
}

function isFaved(productId) {
  const db = getDB();
  return db.currentUser && (db.favorites[db.currentUser.id]||[]).includes(productId);
}

function getMyFavorites() {
  const db = getDB();
  if (!db.currentUser) return [];
  const ids = db.favorites[db.currentUser.id] || [];
  return db.products.filter(p => ids.includes(p.id) && p.status === 'active');
}

// ---------- 留言 ----------
function addComment(productId, text) {
  const db = getDB();
  if (!db.currentUser) return [];
  if (!db.comments[productId]) db.comments[productId] = [];
  db.comments[productId].push({
    id:'c_'+Date.now(), userId:db.currentUser.id, username:db.currentUser.username,
    text, createdAt:new Date().toISOString()
  });
  saveDB(db);
  return db.comments[productId];
}

function getComments(productId) {
  return (getDB().comments||{})[productId] || [];
}

function adminDeleteComment(productId, commentId) {
  const db = getDB();
  if (!db.comments[productId]) return;
  db.comments[productId] = db.comments[productId].filter(c => c.id !== commentId);
  saveDB(db);
}

// ---------- 私聊 ----------
function getOrCreateChat(productId, sellerId) {
  const db = getDB();
  if (!db.currentUser) return [];
  const key = [db.currentUser.id, sellerId, productId].sort().join('_');
  if (!db.messages[key]) db.messages[key] = [];
  return db.messages[key];
}

function sendMessage(productId, sellerId, text) {
  const db = getDB();
  if (!db.currentUser) return [];
  const key = [db.currentUser.id, sellerId, productId].sort().join('_');
  if (!db.messages[key]) db.messages[key] = [];
  db.messages[key].push({
    id:'m_'+Date.now(), from:db.currentUser.id, fromName:db.currentUser.username,
    text, createdAt:new Date().toISOString()
  });
  saveDB(db);
  return db.messages[key];
}

// ---------- UI: 登录弹窗 ----------
function showLoginModal(msg) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  overlay.id = 'login-modal-overlay';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in">
      <div class="text-center mb-6">
        <img src="images/emblem.jpg" alt="校徽" class="w-14 h-14 rounded-xl object-cover mx-auto mb-3">
        <h3 class="text-xl font-bold text-gray-800">${msg || '请先登录'}</h3>
        <p class="text-gray-500 text-sm mt-1">注册后即可使用完整功能</p>
      </div>
      <div class="space-y-3">
        <a href="login.html" class="block w-full py-3 bg-blue-600 text-white text-center rounded-xl font-medium hover:bg-blue-700 transition">前往登录</a>
        <a href="register.html" class="block w-full py-3 bg-gray-100 text-gray-700 text-center rounded-xl font-medium hover:bg-gray-200 transition">创建账号</a>
        <button onclick="document.getElementById('login-modal-overlay').remove()" class="block w-full py-2 text-gray-400 text-sm text-center hover:text-gray-600 transition">稍后再说</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// ---------- UI: Toast ----------
function showToast(msg, type) {
  type = type || 'success';
  var bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  var t = document.createElement('div');
  t.className = 'fixed top-6 left-1/2 -translate-x-1/2 ' + bg + ' text-white px-6 py-3 rounded-xl shadow-lg z-50 text-sm font-medium animate-fade-in';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(function(){ t.remove(); },300); },2000);
}

// ---------- UI: 导航栏 ----------
function renderNav(activePage) {
  var els = document.querySelectorAll('[data-nav]');
  if (!els.length) return;
  var user = getCurrentUser();
  var nav = '<nav class="bg-white shadow-sm sticky top-0 z-40"><div class="max-w-7xl mx-auto px-4 sm:px-6"><div class="flex items-center justify-between h-16">' +
    '<a href="index.html" class="flex items-center gap-2 flex-shrink-0"><img src="images/emblem.jpg" alt="校徽" class="w-9 h-9 rounded-lg object-cover"><span class="font-bold text-gray-800 text-sm sm:text-base hidden sm:block">河南工学院校园二手交易平台</span><span class="font-bold text-gray-800 text-sm sm:hidden">二手交易</span></a>' +
    '<div class="flex items-center gap-1 sm:gap-3 text-sm">' +
    '<a href="index.html" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition'+(activePage==='index'?' text-blue-600 bg-blue-50':'')+'">首页</a>' +
    '<a href="publish.html" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition'+(activePage==='publish'?' text-blue-600 bg-blue-50':'')+'">发布</a>' +
    (user ?
      '<a href="profile.html" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition'+(activePage==='profile'?' text-blue-600 bg-blue-50':'')+'"><span class="hidden sm:inline">个人中心</span><span class="sm:hidden">我的</span></a>' +
      (user.role==='admin' ? '<a href="admin.html" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition text-red-500 font-medium">管理</a>' : '') +
      '<span class="text-gray-400 hidden sm:inline">|</span><span class="text-xs sm:text-sm text-gray-600 hidden sm:inline">'+user.username+'</span>' +
      '<button onclick="doLogout()" class="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1">退出</button>'
    :
      '<a href="login.html" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">登录</a>' +
      '<a href="register.html" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition hidden sm:inline-block">注册</a>'
    ) +
    '</div></div></div></nav>';
  els.forEach(function(el){ el.innerHTML = nav; });
}

function doLogout() {
  logoutUser();
  showToast('已退出登录');
  setTimeout(function(){ window.location.href = 'index.html'; },500);
}

// ---------- UI: 页脚 ----------
function renderFooter() {
  var els = document.querySelectorAll('[data-footer]');
  els.forEach(function(el){
    el.innerHTML = '<footer class="bg-gray-800 text-gray-400 py-8 mt-12"><div class="max-w-7xl mx-auto px-4 text-center text-sm"><p class="mb-1">河南工学院校园二手交易平台</p><p>Copyright &copy; 2026 版权所有 · 担保交易保障</p></div></footer>';
  });
}

// ---------- 种子数据 ----------
function initSeedData() {
  var db = getDB();
  if (db.products.length === 0) {
    db.products = [
      { id:'p_seed1',name:'二手笔记本电脑',price:1500,category:'digital',condition:'8成新',desc:'联想ThinkPad，i5处理器，8G内存，256G固态，电池续航约3小时，适合学习编程和日常使用。',images:[],sellerId:'system',sellerName:'小李同学',createdAt:new Date(Date.now()-86400000*2).toISOString(),status:'active'},
      { id:'p_seed2',name:'高等数学（第七版）上册',price:15,category:'book',condition:'9成新',desc:'只用了一学期，几乎全新，没有笔记划痕，附赠课后习题答案。',images:[],sellerId:'system',sellerName:'老王',createdAt:new Date(Date.now()-86400000*5).toISOString(),status:'active'},
      { id:'p_seed3',name:'美利达山地自行车',price:450,category:'sports',condition:'7成新',desc:'26寸山地车，变速正常，刹车灵敏，适合校园通勤，送一把车锁。',images:[],sellerId:'system',sellerName:'骑行爱好者',createdAt:new Date(Date.now()-86400000*3).toISOString(),status:'active'},
      { id:'p_seed4',name:'宿舍用迷你小风扇',price:25,category:'life',condition:'9成新',desc:'USB接口，三档风速，静音设计，夏天宿舍必备。',images:[],sellerId:'system',sellerName:'小张',createdAt:new Date(Date.now()-86400000*1).toISOString(),status:'active'},
      { id:'p_seed5',name:'机械键盘 Cherry轴',price:200,category:'digital',condition:'8成新',desc:'IKBC C87，Cherry红轴，PBT键帽，手感极佳，送拔键器。',images:[],sellerId:'system',sellerName:'码农小王',createdAt:new Date(Date.now()-86400000*7).toISOString(),status:'active'},
      { id:'p_seed6',name:'大学英语四级词汇书',price:10,category:'book',condition:'7成新',desc:'新东方四级词汇词根+联想记忆法，有少量笔记，不影响使用。',images:[],sellerId:'system',sellerName:'英语达人',createdAt:new Date(Date.now()-86400000*4).toISOString(),status:'active'},
      { id:'p_seed7',name:'冬季棉服外套',price:60,category:'clothes',condition:'8成新',desc:'男生L码，穿过一季，洗干净了，保暖效果不错。',images:[],sellerId:'system',sellerName:'阿杰',createdAt:new Date(Date.now()-86400000*6).toISOString(),status:'active'},
      { id:'p_seed8',name:'瑜伽垫 加厚10mm',price:30,category:'sports',condition:'9成新',desc:'买来只用了几次，加厚防滑，送收纳绑带。',images:[],sellerId:'system',sellerName:'爱运动的女孩',createdAt:new Date(Date.now()-86400000*2).toISOString(),status:'active'}
    ];
    saveDB(db);
  }
}

// 创建管理员种子账号（SHA-256 哈希通过浏览器运行时计算，这里用占位符，首次加载时自动修复）
async function ensureAdmin() {
  var db = getDB();
  if (!db.users.find(function(u){ return u.username === 'admin'; })) {
    var adminHash = await hashPassword('admin123');
    db.users.push({
      id:'u_admin', username:'admin', phoneEnc:encryptData('13800000000'), pwHash:adminHash,
      role:'admin', banned:false, avatar:'', createdAt:new Date().toISOString()
    });
    saveDB(db);
  }
}

// ---------- 页面初始化 ----------
document.addEventListener('DOMContentLoaded', function(){
  initSeedData();
  ensureAdmin();
  var page = document.body.dataset.page || '';
  renderNav(page);
  renderFooter();
});

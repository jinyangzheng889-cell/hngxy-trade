/* ========== 河南工学院校园二手交易平台 - API 桥接层 ========== */

// ---------- XSS ----------
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ---------- 用户认证（桥接 API）----------
async function registerUser(username, phone, password, smsCode) {
  try { var r = await apiRegister(username, phone, password, smsCode); return r; }
  catch(e) { return { ok: false, msg: e.message }; }
}

async function loginUser(phone, password) {
  try { var r = await apiLogin(phone, password); return r; }
  catch(e) { return { ok: false, msg: e.message }; }
}

function logoutUser() {
  localStorage.removeItem('hngxy_token');
  localStorage.removeItem('hngxy_user');
}

function getCurrentUser() {
  var raw = localStorage.getItem('hngxy_user');
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() { return !!getCurrentUser(); }
function isAdmin() { var u = getCurrentUser(); return u && u.role === 'admin'; }

function requireLogin() {
  if (!isLoggedIn()) { showLoginModal(); return false; }
  return true;
}

// ---------- 商品（桥接 API）----------
async function addProduct(data) {
  try { var r = await apiCreateProduct(data); return r; }
  catch(e) { return { ok: false, msg: e.message }; }
}

async function getProducts(filter) {
  try { var r = await apiGetProducts(filter); return r.products; }
  catch(e) { return []; }
}

async function getProductById(id) {
  try { var r = await apiGetProduct(id); return r.product; }
  catch(e) { return null; }
}

async function deleteProduct(id) {
  try { await apiDeleteProduct(id); return true; }
  catch(e) { return false; }
}

// ---------- 订单（桥接 API）----------
const ORDER_STATUS = {
  paid:{label:'已付款·资金托管',icon:'🔒',color:'text-yellow-600',bg:'bg-yellow-50'},
  shipped:{label:'卖家已发货',icon:'📦',color:'text-blue-600',bg:'bg-blue-50'},
  completed:{label:'交易完成',icon:'✅',color:'text-green-600',bg:'bg-green-50'},
  cancelled:{label:'已取消',icon:'❌',color:'text-gray-400',bg:'bg-gray-50'}
};

async function createOrder(productId) {
  try { return await apiCreateOrder(productId); }
  catch(e) { return { ok: false, msg: e.message }; }
}

async function getBuyOrders() {
  try { var r = await apiGetBuyOrders(); return r.orders; }
  catch(e) { return []; }
}

async function getSellOrders() {
  try { var r = await apiGetSellOrders(); return r.orders; }
  catch(e) { return []; }
}

async function updateOrderStatus(orderId, status) {
  try { await apiUpdateOrderStatus(orderId, status); return true; }
  catch(e) { return false; }
}

// ---------- 收藏（桥接 API）----------
async function toggleFav(productId) {
  try { var r = await apiToggleFav(productId); return r.faved; }
  catch(e) { return false; }
}

async function isFaved(productId) {
  try { var r = await apiCheckFav(productId); return r.faved; }
  catch(e) { return false; }
}

async function getMyFavorites() {
  try { var r = await apiGetFavorites(); return r.favorites; }
  catch(e) { return []; }
}

// ---------- 留言（桥接 API）----------
async function addComment(productId, text) {
  try { var r = await apiAddComment(productId, text); return [r.comment]; }
  catch(e) { return []; }
}

async function getComments(productId) {
  try { var r = await apiGetComments(productId); return r.comments; }
  catch(e) { return []; }
}

// ---------- 私聊（桥接 API）----------
async function getOrCreateChat(productId, sellerId) {
  try { var r = await apiGetMessages(productId, sellerId); return r.messages; }
  catch(e) { return []; }
}

async function sendMessage(productId, sellerId, text) {
  try { var r = await apiSendMessage(productId, sellerId, text); return await apiGetMessages(productId, sellerId).then(function(r2){ return r2.messages; }); }
  catch(e) { return []; }
}

// ---------- 管理员（桥接 API）----------
async function getAllUsers() {
  try { var r = await apiAdminGetUsers(); return r.users; }
  catch(e) { return []; }
}

async function adminBanUser(userId) {
  try { await apiAdminBanUser(userId); return true; }
  catch(e) { return false; }
}

async function adminDeleteProduct(productId) {
  try { await apiAdminDeleteProduct(productId); }
  catch(e) {}
}

async function adminGetAllOrders() {
  try { var r = await apiAdminGetAllOrders(); return r.orders; }
  catch(e) { return []; }
}

async function adminRefundOrder(orderId) {
  try { await apiAdminRefundOrder(orderId); return true; }
  catch(e) { return false; }
}

function getRefunds() { return []; } // TODO

// ---------- UI: 登录弹窗 ----------
function showLoginModal(msg) {
  var ov = document.createElement('div');
  ov.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  ov.id = 'login-modal-overlay';
  ov.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in"><div class="text-center mb-6"><img src="images/emblem.jpg" alt="校徽" class="w-14 h-14 rounded-xl object-cover mx-auto mb-3"><h3 class="text-xl font-bold text-gray-800">'+(msg||'请先登录')+'</h3><p class="text-gray-500 text-sm mt-1">注册后即可使用完整功能</p></div><div class="space-y-3"><a href="login.html" class="block w-full py-3 bg-blue-600 text-white text-center rounded-xl font-medium hover:bg-blue-700 transition">前往登录</a><a href="register.html" class="block w-full py-3 bg-gray-100 text-gray-700 text-center rounded-xl font-medium hover:bg-gray-200 transition">创建账号</a><button onclick="document.getElementById(\'login-modal-overlay\').remove()" class="block w-full py-2 text-gray-400 text-sm text-center hover:text-gray-600 transition">稍后再说</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
}

// ---------- UI: Toast ----------
function showToast(msg, type) {
  type = type || 'success';
  var bg = type==='success'?'bg-green-500':type==='error'?'bg-red-500':'bg-blue-500';
  var t = document.createElement('div');
  t.className = 'fixed top-6 left-1/2 -translate-x-1/2 '+bg+' text-white px-6 py-3 rounded-xl shadow-lg z-50 text-sm font-medium animate-fade-in';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(function(){ t.remove(); },300); },2000);
}

// ---------- UI: 导航栏 ----------
function renderNav(activePage) {
  var els = document.querySelectorAll('[data-nav]');
  if (!els.length) return;
  var user = getCurrentUser();
  var links = [
    ['index.html','首页','index'],
    ['publish.html','发布','publish']
  ];
  var nav = '<nav class="bg-white shadow-sm sticky top-0 z-40"><div class="max-w-7xl mx-auto px-4 sm:px-6"><div class="flex items-center justify-between h-16"><a href="index.html" class="flex items-center gap-2 flex-shrink-0"><img src="images/emblem.jpg" alt="校徽" class="w-9 h-9 rounded-lg object-cover"><span class="font-bold text-gray-800 text-sm sm:text-base hidden sm:block">河南工学院校园二手交易平台</span><span class="font-bold text-gray-800 text-sm sm:hidden">二手交易</span></a><div class="flex items-center gap-1 sm:gap-3 text-sm">';
  links.forEach(function(l){
    nav += '<a href="'+l[0]+'" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition'+(activePage===l[2]?' text-blue-600 bg-blue-50':'')+'">'+l[1]+'</a>';
  });
  if (user) {
    nav += '<a href="profile.html" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition'+(activePage==='profile'?' text-blue-600 bg-blue-50':'')+'"><span class="hidden sm:inline">个人中心</span><span class="sm:hidden">我的</span></a>';
    if (user.role==='admin') nav += '<a href="admin.html" class="nav-link px-2 sm:px-3 py-2 rounded-lg transition text-red-500 font-medium">管理</a>';
    nav += '<span class="text-gray-400 hidden sm:inline">|</span><span class="text-xs sm:text-sm text-gray-600 hidden sm:inline">'+escHtml(user.username)+'</span><button onclick="doLogout()" class="text-xs text-gray-400 hover:text-red-500 transition px-2 py-1">退出</button>';
  } else {
    nav += '<a href="login.html" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">登录</a><a href="register.html" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition hidden sm:inline-block">注册</a>';
  }
  nav += '</div></div></div></nav>';
  els.forEach(function(el){ el.innerHTML = nav; });
}

function doLogout() {
  logoutUser();
  showToast('已退出登录');
  setTimeout(function(){ window.location.href='index.html'; },500);
}

// ---------- UI: 页脚 ----------
function renderFooter() {
  var els = document.querySelectorAll('[data-footer]');
  els.forEach(function(el){
    el.innerHTML = '<footer class="bg-gray-800 text-gray-400 py-8 mt-12"><div class="max-w-7xl mx-auto px-4 text-center text-sm"><p class="mb-1">河南工学院校园二手交易平台</p><p>Copyright &copy; 2026 版权所有 · 担保交易保障</p></div></footer>';
  });
}

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', function(){
  var page = document.body.dataset.page || '';
  renderNav(page);
  renderFooter();
});

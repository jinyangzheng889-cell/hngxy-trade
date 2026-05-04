/* ========== API 客户端 ========== */
const API = '/api';

function api(path, opts) {
  opts = opts || {};
  var headers = opts.headers || {};
  var token = localStorage.getItem('hngxy_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  return fetch(API + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function(r) {
    return r.json().then(function(data) {
      if (!r.ok) throw new Error(data.error || '请求失败');
      return data;
    });
  });
}

// ---------- 认证 ----------
function apiSendSMS(phone) { return api('/send-sms', { method: 'POST', body: { phone: phone } }); }
function apiRegister(username, phone, password, smsCode) { return api('/register', { method: 'POST', body: { username: username, phone: phone, password: password, smsCode: smsCode } }); }
function apiLogin(phone, password) {
  return api('/login', { method: 'POST', body: { phone: phone, password: password } }).then(function(data) {
    localStorage.setItem('hngxy_token', data.token);
    localStorage.setItem('hngxy_user', JSON.stringify(data.user));
    return data;
  });
}
function apiGetMe() { return api('/me'); }

// ---------- 商品 ----------
function apiGetProducts(params) {
  var qs = [];
  if (params) {
    for (var k in params) { if (params[k]) qs.push(k + '=' + encodeURIComponent(params[k])); }
  }
  return api('/products' + (qs.length ? '?' + qs.join('&') : ''));
}
function apiGetProduct(id) { return api('/products/' + id); }
function apiCreateProduct(formData) { return api('/products', { method: 'POST', body: formData }); }
function apiDeleteProduct(id) { return api('/products/' + id, { method: 'DELETE' }); }

// ---------- 订单 ----------
function apiCreateOrder(productId) { return api('/orders', { method: 'POST', body: { productId: productId } }); }
function apiGetBuyOrders() { return api('/orders/buy'); }
function apiGetSellOrders() { return api('/orders/sell'); }
function apiUpdateOrderStatus(id, status) { return api('/orders/' + id + '/status', { method: 'PUT', body: { status: status } }); }

// ---------- 留言 ----------
function apiGetComments(productId) { return api('/comments/' + productId); }
function apiAddComment(productId, text) { return api('/comments/' + productId, { method: 'POST', body: { text: text } }); }

// ---------- 收藏 ----------
function apiGetFavorites() { return api('/favorites'); }
function apiToggleFav(productId) { return api('/favorites/' + productId, { method: 'POST' }); }
function apiCheckFav(productId) { return api('/favorites/' + productId + '/check'); }

// ---------- 私聊 ----------
function apiGetMessages(productId, sellerId) { return api('/messages/' + productId + '/' + sellerId); }
function apiSendMessage(productId, sellerId, text) { return api('/messages', { method: 'POST', body: { productId: productId, sellerId: sellerId, text: text } }); }

// ---------- 管理员 ----------
function apiAdminGetUsers() { return api('/admin/users'); }
function apiAdminBanUser(id) { return api('/admin/users/' + id + '/ban', { method: 'PUT' }); }
function apiAdminDeleteProduct(id) { return api('/admin/products/' + id, { method: 'DELETE' }); }
function apiAdminGetAllOrders() { return api('/orders/admin/all'); }
function apiAdminRefundOrder(id) { return api('/orders/admin/refund/' + id, { method: 'POST' }); }

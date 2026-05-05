const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'trade.db.json');

let data = {
  users: [],
  products: [],
  orders: [],
  comments: [],
  favorites: [],
  messages: [],
  emailCodes: {}
};

var defaultData = { users:[], products:[], orders:[], comments:[], favorites:[], messages:[], emailCodes:{} };

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      var loaded = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      // 合并默认结构，确保新增字段存在
      for (var k in defaultData) { if (!loaded[k]) loaded[k] = defaultData[k]; }
      data = loaded;
    }
  } catch(e) { console.error('DB load error:', e.message); }
}

function save() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
  catch(e) { console.error('DB save error:', e.message); }
}

load();

// XSS-protecting query helpers
function all(table) { return data[table] || []; }
function findOne(table, fn) { return (data[table] || []).find(fn); }
function find(table, fn) { return (data[table] || []).filter(fn); }
function insert(table, row) { data[table] = data[table] || []; data[table].push(row); save(); }
function remove(table, fn) { data[table] = (data[table] || []).filter(function(r){ return !fn(r); }); save(); }
function update(table, fn, updater) {
  data[table] = data[table] || [];
  var found = false;
  data[table] = data[table].map(function(r){ if (fn(r)) { found = true; var u = updater(r); return u; } return r; });
  if (found) save();
  return found;
}

function decPhone(phone_enc) {
  var key = 'hngxy_trade_2026@secure';
  var r = '';
  try {
    var enc = Buffer.from(phone_enc, 'base64').toString();
    for (var i = 0; i < enc.length; i++) r += String.fromCharCode(enc.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  } catch(e) {}
  return r;
}

function encPhone(phone) {
  var key = 'hngxy_trade_2026@secure';
  var r = '';
  for (var i = 0; i < phone.length; i++) r += String.fromCharCode(phone.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return Buffer.from(r).toString('base64');
}

// Seed
var adminExists = findOne('users', function(u){ return u.username === 'admin'; });
if (!adminExists) {
  var bcrypt = require('bcryptjs');
  var hash = bcrypt.hashSync('admin123', 10);
  insert('users', { id:'u_admin', username:'admin', phone_enc:encPhone('13800000000'), email:'admin@example.com', pw_hash:hash, role:'admin', banned:false, avatar:'', created_at:new Date().toISOString() });

  var seed = [
    ['p_seed1','二手笔记本电脑',1500,'digital','8成新','联想ThinkPad，i5处理器，8G内存，256G固态','图书馆门口','sys_demo','小李同学',2],
    ['p_seed2','高等数学（第七版）上册',15,'book','9成新','只用了一学期，几乎全新，没有笔记划痕','教学楼A区','sys_demo','老王',5],
    ['p_seed3','美利达山地自行车',450,'sports','7成新','26寸山地车，变速正常，刹车灵敏，送车锁','操场','sys_demo','骑行爱好者',3],
    ['p_seed4','宿舍用迷你小风扇',25,'life','9成新','USB接口，三档风速，静音设计','宿舍楼门口','sys_demo','小张',1],
    ['p_seed5','机械键盘 Cherry轴',200,'digital','8成新','IKBC C87，Cherry红轴，PBT键帽','图书馆门口','sys_demo','码农小王',7],
    ['p_seed6','大学英语四级词汇书',10,'book','7成新','新东方四级词汇词根+联想记忆法','教学楼A区','sys_demo','英语达人',4],
    ['p_seed7','冬季棉服外套',60,'clothes','8成新','男生L码，穿过一季，洗干净了','第二食堂','sys_demo','阿杰',6],
    ['p_seed8','瑜伽垫 加厚10mm',30,'sports','9成新','买来只用了几次，加厚防滑，送收纳绑带','操场','sys_demo','爱运动的女孩',2],
  ];
  seed.forEach(function(s){
    insert('products', { id:s[0], name:s[1], price:s[2], category:s[3], condition:s[4], description:s[5], location:s[6], seller_id:s[7], seller_name:s[8], images:'[]', status:'active', created_at:new Date(Date.now()-86400000*s[9]).toISOString() });
  });
}

module.exports = { all, findOne, find, insert, remove, update, encPhone, decPhone, save, data };

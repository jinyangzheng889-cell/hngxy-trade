const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const router = express.Router();

// 发送短信验证码
router.post('/send-sms', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.data.smsCodes[phone] = { code, expires: Date.now() + 300000 };
  db.save();
  console.log(`\n📱 [模拟短信] 手机号 ${phone} 验证码：${code}（5分钟有效）\n`);
  res.json({ ok: true, msg: '验证码已发送（控制台查看）' });
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, phone, password, smsCode } = req.body;
    if (!username || !phone || !password) return res.status(400).json({ error: '请填写完整信息' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });

    const record = db.data.smsCodes[phone];
    if (!record || record.code !== smsCode || record.expires < Date.now()) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
    delete db.data.smsCodes[phone];

    if (db.findOne('users', u => u.username === username)) return res.status(400).json({ error: '用户名已存在' });

    const hash = await bcrypt.hash(password, 10);
    const id = 'u_' + Date.now();
    db.insert('users', { id, username, phone_enc: db.encPhone(phone), pw_hash: hash, role:'user', banned:false, avatar:'', created_at: new Date().toISOString() });
    res.json({ ok: true, msg: '注册成功' });
  } catch (e) { console.error(e); res.status(500).json({ error: '服务器错误' }); }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: '请填写手机号和密码' });
    const user = db.findOne('users', u => db.decPhone(u.phone_enc) === phone);
    if (!user) return res.status(400).json({ error: '手机号或密码错误' });
    if (user.banned) return res.status(403).json({ error: '该账号已被封禁' });
    const valid = await bcrypt.compare(password, user.pw_hash);
    if (!valid) return res.status(400).json({ error: '手机号或密码错误' });
    res.json({ ok: true, token: signToken(user), user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) { console.error(e); res.status(500).json({ error: '服务器错误' }); }
});

// 当前用户
router.get('/me', authRequired, (req, res) => {
  const user = db.findOne('users', u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: { id: user.id, username: user.username, role: user.role, banned: user.banned } });
});

module.exports = router;

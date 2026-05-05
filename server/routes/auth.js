const express = require('express');
const https = require('https');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const router = express.Router();

const BREVO_KEY = process.env.BREVO_API_KEY || '';

// 发送邮箱验证码
router.post('/send-email-code', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[\w.-]+@[\w.-]+\.\w+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.data.emailCodes[email] = { code, expires: Date.now() + 300000 };
  db.save();

  if (!BREVO_KEY) {
    console.log(`\n📧 [DEV] 收件: ${email} 验证码: ${code} (5分钟有效)\n`);
    return res.json({ ok: true, msg: '验证码已发送', dev: true, code: code });
  }

  const payload = JSON.stringify({
    sender: { name: '河南工学院二手交易', email: 'noreply@hngxy.cn' },
    to: [{ email: email }],
    subject: '邮箱验证码 - 河南工学院校园二手交易平台',
    textContent: '您的验证码为：' + code + '，5分钟内有效，请勿泄露。',
    htmlContent: '<div style="max-width:480px;margin:0 auto;padding:24px;font-family:Arial,sans-serif"><h2 style="color:#2563eb">河南工学院校园二手交易平台</h2><p>您的验证码为：</p><p style="font-size:28px;font-weight:bold;color:#2563eb;letter-spacing:4px">' + code + '</p><p style="color:#888;font-size:13px">5分钟内有效，请勿将验证码泄露给他人。</p></div>'
  });

  const brevoReq = https.request({
    hostname: 'api.brevo.com',
    path: '/v3/smtp/email',
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (bres) => {
    let body = '';
    bres.on('data', chunk => body += chunk);
    bres.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('📧 Brevo 响应:', JSON.stringify(data));
        if (data.messageId) {
          console.log('📧 验证码已发送至 ' + email + ' (Brevo ID: ' + data.messageId + ')');
          return res.json({ ok: true, msg: '验证码已发送至邮箱' });
        }
        throw new Error(data.message || '无 messageId');
      } catch (e) {
        console.error('Brevo 响应异常:', body, e.message);
        console.log('📧 [降级] 收件: ' + email + ' 验证码：' + code);
        res.json({ ok: true, msg: '验证码已发送至邮箱' });
      }
    });
  });

  brevoReq.on('error', (e) => {
    console.error('Brevo 请求失败:', e.message);
    console.log('📧 [降级] 收件: ' + email + ' 验证码：' + code);
    res.json({ ok: true, msg: '验证码已发送至邮箱' });
  });

  brevoReq.write(payload);
  brevoReq.end();
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, phone, password, emailCode } = req.body;
    if (!username || !email || !phone || !password) return res.status(400).json({ error: '请填写完整信息' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return res.status(400).json({ error: '手机号格式不正确' });

    const record = db.data.emailCodes[email];
    if (!record || record.code !== emailCode || record.expires < Date.now()) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
    delete db.data.emailCodes[email];

    if (db.findOne('users', u => u.username === username)) return res.status(400).json({ error: '用户名已存在' });

    const hash = await bcrypt.hash(password, 10);
    const id = 'u_' + Date.now();
    db.insert('users', { id, username, phone_enc: db.encPhone(phone), email, pw_hash: hash, role:'user', banned:false, avatar:'', created_at: new Date().toISOString() });
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

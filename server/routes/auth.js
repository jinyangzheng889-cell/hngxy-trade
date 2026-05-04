const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const router = express.Router();

const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER || '';

const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// 发送邮箱验证码
router.post('/send-email-code', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[\w.-]+@[\w.-]+\.\w+$/.test(email)) return res.status(400).json({ error: '邮箱格式不正确' });

  if (!EMAIL_USER || !EMAIL_PASS) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.data.emailCodes[email] = { code, expires: Date.now() + 300000 };
    db.save();
    console.log(`\n📧 [模拟邮箱] 收件: ${email} 验证码：${code}（5分钟有效）\n`);
    return res.json({ ok: true, msg: '验证码已发送（控制台查看）' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.data.emailCodes[email] = { code, expires: Date.now() + 300000 };
  db.save();

  transporter.sendMail({
    from: `"河南工学院二手交易" <${EMAIL_FROM}>`,
    to: email,
    subject: '邮箱验证码 - 河南工学院校园二手交易平台',
    text: `您的验证码为：${code}，5分钟内有效，请勿泄露。`,
    html: `<div style="max-width:480px;margin:0 auto;padding:24px;font-family:Arial,sans-serif"><h2 style="color:#2563eb">河南工学院校园二手交易平台</h2><p>您的验证码为：</p><p style="font-size:28px;font-weight:bold;color:#2563eb;letter-spacing:4px">${code}</p><p style="color:#888;font-size:13px">5分钟内有效，请勿将验证码泄露给他人。</p></div>`
  }).then(() => {
    console.log(`📧 验证码已发送至 ${email}`);
    res.json({ ok: true, msg: '验证码已发送至邮箱' });
  }).catch(e => {
    console.error('邮件发送失败:', e.message);
    delete db.data.emailCodes[email];
    db.save();
    res.status(500).json({ error: '邮件发送失败，请稍后重试' });
  });
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

const express = require('express');
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/users', authRequired, adminRequired, (req, res) => {
  const key = 'hngxy_trade_2026@secure';
  const users = db.all('users').map(u => {
    let phone = '';
    try {
      const enc = Buffer.from(u.phone_enc, 'base64').toString();
      for (let i = 0; i < enc.length; i++) phone += String.fromCharCode(enc.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    } catch(e) {}
    return { id:u.id, username:u.username, phone, role:u.role, banned:u.banned, created_at:u.created_at };
  }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ ok: true, users });
});

router.put('/users/:id/ban', authRequired, adminRequired, (req, res) => {
  const user = db.findOne('users', u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role === 'admin') return res.status(400).json({ error: '不能封禁管理员' });
  db.update('users', u => u.id === req.params.id, u => ({ ...u, banned: u.banned ? false : true }));
  res.json({ ok: true, banned: !user.banned });
});

router.delete('/products/:id', authRequired, adminRequired, (req, res) => {
  db.remove('products', p => p.id === req.params.id);
  res.json({ ok: true });
});

module.exports = router;

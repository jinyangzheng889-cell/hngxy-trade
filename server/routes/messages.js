const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/:productId/:sellerId', authRequired, (req, res) => {
  const chatKey = [req.user.id, req.params.sellerId, req.params.productId].sort().join('_');
  res.json({ ok: true, messages: db.find('messages', m => m.chat_key === chatKey).sort((a,b) => new Date(a.created_at) - new Date(b.created_at)) });
});

router.post('/', authRequired, (req, res) => {
  const { productId, sellerId, text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '请输入消息' });
  const chatKey = [req.user.id, sellerId, productId].sort().join('_');
  const msg = { id:'m_'+Date.now(), chat_key:chatKey, from_id:req.user.id, from_name:req.user.username, text:text.trim(), created_at:new Date().toISOString() };
  db.insert('messages', msg);
  res.json({ ok: true, message: msg });
});

module.exports = router;

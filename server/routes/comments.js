const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/:productId', (req, res) => {
  res.json({ ok: true, comments: db.find('comments', c => c.product_id === req.params.productId).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.post('/:productId', authRequired, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '请输入留言内容' });
  const comment = { id:'c_'+Date.now(), product_id:req.params.productId, user_id:req.user.id, username:req.user.username, text:text.trim(), created_at:new Date().toISOString() };
  db.insert('comments', comment);
  res.json({ ok: true, comment });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.post('/', authRequired, (req, res) => {
  const { productId } = req.body;
  const p = db.findOne('products', p => p.id === productId);
  if (!p) return res.status(404).json({ error: '商品不存在' });
  if (p.seller_id === req.user.id) return res.status(400).json({ error: '不能购买自己的商品' });
  if (p.status !== 'active') return res.status(400).json({ error: '商品已下架或交易中' });
  if (db.findOne('orders', o => o.product_id === productId && o.buyer_id === req.user.id && o.status !== 'cancelled')) return res.status(400).json({ error: '你已对该商品下单' });

  const id = 'o_' + Date.now();
  db.update('products', p => p.id === productId, p => ({ ...p, status:'locked' }));
  db.insert('orders', { id, product_id:p.id, product_name:p.name, price:p.price, buyer_id:req.user.id, buyer_name:req.user.username, seller_id:p.seller_id, seller_name:p.seller_name, status:'paid', created_at:new Date().toISOString() });
  res.json({ ok: true, orderId: id });
});

router.get('/buy', authRequired, (req, res) => {
  res.json({ ok: true, orders: db.find('orders', o => o.buyer_id === req.user.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.get('/sell', authRequired, (req, res) => {
  res.json({ ok: true, orders: db.find('orders', o => o.seller_id === req.user.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.put('/:id/status', authRequired, (req, res) => {
  const order = db.findOne('orders', o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  const { status } = req.body;
  if (status === 'shipped' && order.seller_id !== req.user.id) return res.status(403).json({ error: '只有卖家可以发货' });
  if ((status === 'completed' || status === 'cancelled') && order.buyer_id !== req.user.id) return res.status(403).json({ error: '只有买家可以操作' });
  const valid = { paid:['shipped','cancelled'], shipped:['completed'] };
  if (!valid[order.status] || !valid[order.status].includes(status)) return res.status(400).json({ error: '无效的状态变更' });
  db.update('orders', o => o.id === req.params.id, o => ({ ...o, status }));
  if (status === 'cancelled') db.update('products', p => p.id === order.product_id, p => ({ ...p, status:'active' }));
  res.json({ ok: true });
});

router.get('/admin/all', authRequired, adminRequired, (req, res) => {
  res.json({ ok: true, orders: db.all('orders').sort((a,b) => new Date(b.created_at) - new Date(a.created_at)) });
});

router.post('/admin/refund/:id', authRequired, adminRequired, (req, res) => {
  const order = db.findOne('orders', o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status === 'completed') return res.status(400).json({ error: '已完成订单无法退款' });
  db.update('orders', o => o.id === req.params.id, o => ({ ...o, status:'cancelled' }));
  db.update('products', p => p.id === order.product_id, p => ({ ...p, status:'active' }));
  res.json({ ok: true, msg: '退款已处理' });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const favIds = db.find('favorites', f => f.user_id === req.user.id).map(f => f.product_id);
  const products = db.find('products', p => favIds.includes(p.id) && p.status === 'active').map(p => ({ ...p, images: JSON.parse(p.images || '[]') }));
  res.json({ ok: true, favorites: products });
});

router.post('/:productId', authRequired, (req, res) => {
  const existing = db.findOne('favorites', f => f.user_id === req.user.id && f.product_id === req.params.productId);
  if (existing) {
    db.remove('favorites', f => f.user_id === req.user.id && f.product_id === req.params.productId);
    res.json({ ok: true, faved: false });
  } else {
    db.insert('favorites', { user_id: req.user.id, product_id: req.params.productId });
    res.json({ ok: true, faved: true });
  }
});

router.get('/:productId/check', authRequired, (req, res) => {
  const r = db.findOne('favorites', f => f.user_id === req.user.id && f.product_id === req.params.productId);
  res.json({ ok: true, faved: !!r });
});

module.exports = router;

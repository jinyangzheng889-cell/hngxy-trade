const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => cb(null, 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2,8) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

router.get('/', (req, res) => {
  let list = db.find('products', p => p.status === 'active');
  if (req.query.category && req.query.category !== 'all') list = list.filter(p => p.category === req.query.category);
  if (req.query.keyword) { const kw = req.query.keyword.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(kw) || p.description.toLowerCase().includes(kw)); }
  if (req.query.sellerId) list = list.filter(p => p.seller_id === req.query.sellerId);
  if (req.query.priceMin) list = list.filter(p => p.price >= Number(req.query.priceMin));
  if (req.query.priceMax) list = list.filter(p => p.price <= Number(req.query.priceMax));
  if (req.query.condition && req.query.condition !== 'all') list = list.filter(p => p.condition === req.query.condition);
  if (req.query.sort === 'price_asc') list.sort((a,b) => a.price - b.price);
  else if (req.query.sort === 'price_desc') list.sort((a,b) => b.price - a.price);
  else list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  list = list.map(p => ({ ...p, images: JSON.parse(p.images || '[]') }));
  res.json({ ok: true, products: list });
});

router.get('/:id', (req, res) => {
  const p = db.findOne('products', p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: '商品不存在' });
  res.json({ ok: true, product: { ...p, images: JSON.parse(p.images || '[]') } });
});

router.post('/', authRequired, upload.array('images', 6), (req, res) => {
  const { name, price, category, condition, description } = req.body;
  if (!name || !price || !category || !condition || !description) return res.status(400).json({ error: '请填写完整信息' });
  if (isNaN(price) || Number(price) <= 0) return res.status(400).json({ error: '价格无效' });
  if (!req.files || req.files.length < 3) return res.status(400).json({ error: '请至少上传3张图片' });
  const id = 'p_' + Date.now();
  const images = req.files.map(f => '/uploads/' + f.filename);
  db.insert('products', { id, name, price:Number(price), category, condition, description, seller_id:req.user.id, seller_name:req.user.username, images:JSON.stringify(images), status:'active', created_at:new Date().toISOString() });
  res.json({ ok: true, productId: id });
});

router.delete('/:id', authRequired, (req, res) => {
  const p = db.findOne('products', p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: '商品不存在' });
  if (p.seller_id !== req.user.id) return res.status(403).json({ error: '只能删除自己的商品' });
  db.remove('products', p => p.id === req.params.id);
  res.json({ ok: true });
});

module.exports = router;

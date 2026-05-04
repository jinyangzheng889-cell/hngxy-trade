const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..')));

// 路由
app.use('/api', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`\n🚀 河南工学院校园二手交易平台 服务端已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   管理员: admin / admin123\n`);
});

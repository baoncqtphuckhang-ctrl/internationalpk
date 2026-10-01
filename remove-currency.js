const fs = require('fs');
const file = 'd:/0. WORKING/CODE WEB/01. INTERNATIONAL PK/internationalpk/components/MaterialCatalog.jsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /<CurrencyInput[\s\S]*?placeholder="Đơn giá"[\s\S]*?\/>/,
  '{/* Đơn giá đã được gỡ bỏ theo yêu cầu */}'
);

fs.writeFileSync(file, c);
console.log('done removing CurrencyInput');

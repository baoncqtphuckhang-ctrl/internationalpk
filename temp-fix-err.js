const fs = require('fs');
const file = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /catch\s*\(\s*err\s*\)\s*\{\s*console\.error\(\s*err\s*\);/g;
const replacement = `catch (err) {
            console.warn("Lỗi lưu đơn hàng (Bỏ qua overlay của Next.js):", err.message || err);`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed console.error with regex in MaterialOrder.jsx");
} else {
    console.log("Still could not find match with regex.");
}

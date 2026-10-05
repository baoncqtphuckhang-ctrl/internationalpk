const fs = require('fs');
const file = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(file, 'utf8');

// Strip all variants of my broken wrappers
content = content.replace(/\{\!asModal && \(\s*<React\.Fragment>\s*/g, '');
content = content.replace(/\{\!asModal && \(\s*/g, '');
content = content.replace(/<\/React\.Fragment>\s*\)\}\s*/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log("Cleaned up ALL broken asModal wrappers");

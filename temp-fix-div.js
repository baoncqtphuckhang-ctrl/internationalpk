const fs = require('fs');
const file = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = 'return (\n        <div className="w-full animate-in fade-in duration-500 pb-16">';
const replacement = 'return (\n        <div className={`w-full animate-in fade-in duration-500 ${asModal ? \'bg-transparent pb-0\' : \'pb-16\'}`}>';

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed main div className for asModal");

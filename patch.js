
const fs = require('fs');
const file = 'd:/0. WORKING/CODE WEB/01. INTERNATIONAL PK/internationalpk/components/Trash.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const pruneExpiredTrash = \(items\) => \{[\s\S]*?\};\r?\n/, 
    'const pruneExpiredTrash = (items) => { return items || []; };\n'
);

content = content.replace(
    /const getDaysRemaining = \(deletedAt\) => \{[\s\S]*?\};\r?\n/, 
    'const getDaysRemaining = (deletedAt) => { return \'Vinh vi?n\'; };\n'
);

content = content.replace(
    /\/\/ Auto-delete after the configured retention window\.[\s\S]*?fetchedData = fetchedData\.filter\(item => new Date\(item\.deleted_at\) >= cutoffDate\);\r?\n\s*\}/,
    '// Ðã b? tính nang t? d?ng xóa'
);

content = content.replace(
    /<span className=\{\inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-xs font-black border \$\{[\s\S]*?\}\\}>\r?\n\s*\{daysRemaining\} ngày\r?\n\s*<\/span>/,
    '<span className={inline-flex min-w-20 justify-center rounded-full px-3 py-1 text-xs font-black border bg-emerald-50 text-emerald-700 border-emerald-100}>{daysRemaining}</span>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched');


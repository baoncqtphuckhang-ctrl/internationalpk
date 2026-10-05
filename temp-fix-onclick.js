const fs = require('fs');
const file = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace onClick={() => if (onCloseModal) onCloseModal(); else setView('list')}
// with onClick={() => { if (onCloseModal) onCloseModal(); else setView('list'); }}
content = content.replace(/onClick=\{\(\) => if \(onCloseModal\) onCloseModal\(\); else setView\('list'\)\}/g, "onClick={() => { if (onCloseModal) onCloseModal(); else setView('list'); }}");

// Check if there's the other broken one:
// onClick={() => { if (onCloseModal) onCloseModal(); else setView('list'); setSelectedOrder(null); setShowNonEmptyOnly(false); }}
// When I replaced setView('list') it became:
// onClick={() => { if (onCloseModal) onCloseModal(); else setView('list'); setSelectedOrder(null); setShowNonEmptyOnly(false); }}
// Wait! If it was already wrapped in {}, then it's valid:
// onClick={() => { if (onCloseModal) onCloseModal(); else setView('list'); setSelectedOrder(null); ...
// Yes, that one is valid!

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed onClick syntax error");

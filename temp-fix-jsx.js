const fs = require('fs');
const file = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(file, 'utf8');

// The error is because I inserted {!asModal && ( but JSX requires a single parent.
// And I did it twice.
// Let's just undo what I did and do it properly.

// Let's restore the original state first by removing the added lines.
content = content.replace(/{ \/\* HEADER AREA \*\/ }\s*\{\!asModal && \(/g, '{/* HEADER AREA */}');
content = content.replace(/\)\}\s*\{\/\* TABLE VIEW \*\/ \}\s*\{\!asModal && \(/g, '{/* TABLE VIEW */}');
content = content.replace(/\)\}\s*\{\/\* ORDER FORM \*\/ \}/g, '{/* ORDER FORM */}');

// Now, correctly wrap them using <React.Fragment> if needed, or simply let asModal determine the initial view state, and we can just return early if we want, but hooks prevent that.
// The easiest fix is just wrap in Fragment:
content = content.replace('{/* HEADER AREA */}', '{/* HEADER AREA */}\n            {!asModal && ( <React.Fragment>');
content = content.replace('{/* TABLE VIEW */}', '</React.Fragment> )}\n\n            {/* TABLE VIEW */}\n            {!asModal && ( <React.Fragment>');
content = content.replace('{/* ORDER FORM */}', '</React.Fragment> )}\n\n            {/* ORDER FORM */}');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed JSX syntax in MaterialOrder.jsx");

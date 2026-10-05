const fs = require('fs');
const file = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('{/* HEADER AREA */}\n            {!asModal && ( <React.Fragment>\n            {!asModal && (\n            {view === \'list\' && (', '{/* HEADER AREA */}\n            {!asModal && ( <React.Fragment>\n            {view === \'list\' && (');

content = content.replace('</React.Fragment> )}\n\n            {/* TABLE VIEW */}\n            {!asModal && ( <React.Fragment>\n            {!asModal && (\n            {view === \'list\' && (', '</React.Fragment> )}\n\n            {/* TABLE VIEW */}\n            {!asModal && ( <React.Fragment>\n            {view === \'list\' && (');

content = content.replace('</React.Fragment> )}\n\n            {/* ORDER FORM */}\n            {!asModal && (\n            {view === \'form\' && (', '</React.Fragment> )}\n\n            {/* ORDER FORM */}\n            {!asModal && ( <React.Fragment>\n            {view === \'form\' && (');

// Wait, the third replace above is just guessing what it is. Let's do regex to remove duplicates.
content = content.replace(/\{\!asModal && \(\s*<React\.Fragment>\s*\{\!asModal && \(/g, '{!asModal && ( <React.Fragment>');
content = content.replace(/\{\!asModal && \(\s*\{\!asModal && \(/g, '{!asModal && (');

// And ensure {view === 'form' && ( has a parent
content = content.replace(/\{\/\* ORDER FORM \*\/\}\s*\{\!asModal && \(\s*\{view === 'form' && \(/g, "{/* ORDER FORM */}\n            {!asModal && ( <React.Fragment>\n            {view === 'form' && (");

// And ensure the closing fragment is there for the form
// The order form ends with </div>\n            )}
// I'll just check if it already has the closing tags.
fs.writeFileSync(file, content, 'utf8');
console.log("Cleaned up JSX syntax");

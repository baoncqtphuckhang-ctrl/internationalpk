const fs = require('fs');
const content = fs.readFileSync('app/globals.css', 'utf8');
const cleanContent = content.substring(0, content.lastIndexOf('}'));
const newCss = `
/* Hide arrows for number inputs globally */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
`;
fs.writeFileSync('app/globals.css', cleanContent + '}\n' + newCss, 'utf8');
console.log('Fixed CSS');

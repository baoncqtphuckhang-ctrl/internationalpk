const fs = require('fs');
const filePath = 'components/MaterialOrder.jsx';
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the line that says "            )} // END OF DETAIL VIEW" or just look at lines 1899-1904
for (let i = 1890; i < 1910; i++) {
    if (lines[i] && lines[i].includes('</div>') && lines[i+1] && lines[i+1].includes(')}')) {
        // if there's three </div>s, we remove one
        if (lines[i-1] && lines[i-1].includes('</div>') && lines[i-2] && lines[i-2].includes('</div>')) {
            console.log("Found 3 divs, removing one at index " + i);
            lines.splice(i, 1);
            break;
        }
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log("Done");

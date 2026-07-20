const fs = require('fs');
const path = require('path');

const levelDbDirs = [
    'C:/Users/LENOVO/AppData/Local/Microsoft/Edge/User Data/Default/Local Storage/leveldb',
    'C:/Users/LENOVO/AppData/Local/Google/Chrome/User Data/Default/Local Storage/leveldb'
];
const outputPath = path.join(__dirname, 'recovered_expected_invoices_from_edge.json');
const keyPatterns = [
    Buffer.from('[{"id"', 'utf16le'),
    Buffer.from('[{"projectName"', 'utf16le'),
    Buffer.from('[{"id"', 'utf8'),
    Buffer.from('[{"projectName"', 'utf8')
];

function extractUtf16JsonArray(buffer, start) {
    let decoded = '';
    for (let i = start; i + 1 < buffer.length; i += 2) {
        const code = buffer.readUInt16LE(i);
        if (code === 0) continue;
        decoded += String.fromCharCode(code);
        if (decoded.length > 2_000_000) break;
    }

    const firstArray = decoded.indexOf('[{');
    if (firstArray < 0) return null;

    const text = decoded.slice(firstArray);
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }

        if (char === '"') inString = true;
        else if (char === '[' || char === '{') depth++;
        else if (char === ']' || char === '}') {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(0, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }

    return null;
}

function extractUtf8JsonArray(buffer, start) {
    const decoded = buffer.toString('utf8', start, Math.min(buffer.length, start + 2_000_000));
    const firstArray = decoded.indexOf('[{');
    if (firstArray < 0) return null;
    const text = decoded.slice(firstArray);
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }

        if (char === '"') inString = true;
        else if (char === '[' || char === '{') depth++;
        else if (char === ']' || char === '}') {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(0, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }

    return null;
}

const files = levelDbDirs.flatMap(levelDbDir => {
    if (!fs.existsSync(levelDbDir)) return [];
    return fs
        .readdirSync(levelDbDir)
        .filter(name => /\.(ldb|log)$/i.test(name))
        .map(name => path.join(levelDbDir, name));
});

const results = [];

for (const file of files) {
    const buffer = fs.readFileSync(file);
    for (const keyPattern of keyPatterns) {
        let index = -1;
        while ((index = buffer.indexOf(keyPattern, index + 1)) !== -1) {
            const rows = keyPattern.length > 10
                ? extractUtf16JsonArray(buffer, index)
                : extractUtf8JsonArray(buffer, index);
            if (!rows) continue;
            results.push({
                file,
                index,
                rows
            });
        }
    }
}

const summaries = results
    .map(result => ({
        file: path.basename(result.file),
        index: result.index,
        count: result.rows.length,
        team: result.rows.filter(row => row.teamName || Number(row.teamValue || 0)).length,
        nonzero: result.rows.filter(row => Number(row.teamValue || 0) > 0).length,
        periods: [...new Set(result.rows.map(row => row.payment_period || row.phase || '').filter(Boolean))].slice(0, 12)
    }))
    .sort((a, b) => b.team - a.team || b.count - a.count);

console.log(JSON.stringify(summaries.slice(0, 30), null, 2));

const best = results
    .slice()
    .sort((a, b) => {
        const bTeam = b.rows.filter(row => row.teamName || Number(row.teamValue || 0)).length;
        const aTeam = a.rows.filter(row => row.teamName || Number(row.teamValue || 0)).length;
        return bTeam - aTeam || b.rows.length - a.rows.length;
    })[0];

if (best) {
    fs.writeFileSync(outputPath, JSON.stringify(best.rows, null, 2), 'utf8');
    console.log(`WROTE ${outputPath}`);
}

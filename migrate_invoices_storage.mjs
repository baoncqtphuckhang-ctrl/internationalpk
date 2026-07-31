import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

const ENV_FILE = '.env.migration.local';
const BUCKET = 'invoices';
const APPLY = process.argv.includes('--apply');
const REWRITE_REFERENCES = process.argv.includes('--rewrite-references');

function readEnvFile(fileName) {
    if (!existsSync(fileName)) {
        throw new Error(`Không tìm thấy ${fileName}. Hãy tạo file theo hướng dẫn trước khi chạy.`);
    }

    return Object.fromEntries(
        readFileSync(fileName, 'utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && line.includes('='))
            .map((line) => {
                const index = line.indexOf('=');
                return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
            })
    );
}

const env = readEnvFile(ENV_FILE);
const requiredKeys = [
    'OLD_SUPABASE_URL',
    'OLD_SUPABASE_SERVICE_ROLE_KEY',
    'NEW_SUPABASE_URL',
    'NEW_SUPABASE_SERVICE_ROLE_KEY'
];

for (const key of requiredKeys) {
    if (!env[key]) throw new Error(`Thiếu ${key} trong ${ENV_FILE}.`);
}

const oldClient = createClient(env.OLD_SUPABASE_URL, env.OLD_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});
const newClient = createClient(env.NEW_SUPABASE_URL, env.NEW_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function listFiles(prefix = '') {
    const files = [];
    let offset = 0;

    while (true) {
        const { data, error } = await oldClient.storage.from(BUCKET).list(prefix, {
            limit: 1000,
            offset,
            sortBy: { column: 'name', order: 'asc' }
        });
        if (error) throw new Error(`Không thể đọc ${prefix || 'bucket gốc'}: ${error.message}`);
        if (!data?.length) break;

        for (const item of data) {
            const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.id) files.push({ path: itemPath, metadata: item.metadata || {} });
            else files.push(...await listFiles(itemPath));
        }

        if (data.length < 1000) break;
        offset += data.length;
    }

    return files;
}

function getPublicUrl(path) {
    return `${env.NEW_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function replaceOldUrl(value) {
    if (typeof value !== 'string') return value;
    const oldPrefix = `${env.OLD_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;
    if (!value.startsWith(oldPrefix)) return value;

    const encodedPath = value.slice(oldPrefix.length).split(/[?#]/, 1)[0];
    const path = encodedPath.split('/').map(decodeURIComponent).join('/');
    return getPublicUrl(path);
}

function replacePdfReferences(value) {
    if (Array.isArray(value)) return value.map(replacePdfReferences);
    if (!value || typeof value !== 'object') return replaceOldUrl(value);

    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        const nextValue = /(?:pdf_url|invoice_pdf|hstt_pdf|project_pdf|team_pdf)/i.test(key)
            ? replaceOldUrl(item)
            : replacePdfReferences(item);
        return [key, nextValue];
    }));
}

function hasChanges(before, after) {
    return JSON.stringify(before) !== JSON.stringify(after);
}

async function getAllRows(table, fields) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await newClient.from(table).select(fields).range(from, from + 999);
        if (error) throw new Error(`Không thể đọc bảng ${table}: ${error.message}`);
        rows.push(...(data || []));
        if (!data || data.length < 1000) return rows;
    }
}

async function rewriteReferences() {
    let updated = 0;

    const expectedInvoices = await getAllRows('expected_invoices', 'id, team_pdf_url, project_pdf_url');
    for (const row of expectedInvoices) {
        const update = {
            team_pdf_url: replaceOldUrl(row.team_pdf_url),
            project_pdf_url: replaceOldUrl(row.project_pdf_url)
        };
        if (!hasChanges({ team_pdf_url: row.team_pdf_url, project_pdf_url: row.project_pdf_url }, update)) continue;
        const { error } = await newClient.from('expected_invoices').update(update).eq('id', row.id);
        if (error) throw new Error(`Không cập nhật expected_invoices/${row.id}: ${error.message}`);
        updated += 1;
    }

    const materialOrders = await getAllRows('material_orders', 'id, invoice_pdf_url, invoices');
    for (const row of materialOrders) {
        const update = {
            invoice_pdf_url: replaceOldUrl(row.invoice_pdf_url),
            invoices: replacePdfReferences(row.invoices)
        };
        if (!hasChanges({ invoice_pdf_url: row.invoice_pdf_url, invoices: row.invoices }, update)) continue;
        const { error } = await newClient.from('material_orders').update(update).eq('id', row.id);
        if (error) throw new Error(`Không cập nhật material_orders/${row.id}: ${error.message}`);
        updated += 1;
    }

    const incomes = await getAllRows('incomes', 'id, note');
    for (const row of incomes) {
        if (!row.note) continue;
        try {
            const note = JSON.parse(row.note);
            const updatedNote = replacePdfReferences(note);
            if (!hasChanges(note, updatedNote)) continue;
            const { error } = await newClient.from('incomes').update({ note: JSON.stringify(updatedNote) }).eq('id', row.id);
            if (error) throw new Error(`Không cập nhật incomes/${row.id}: ${error.message}`);
            updated += 1;
        } catch (error) {
            if (error.message?.startsWith('Không cập nhật')) throw error;
        }
    }

    return updated;
}

async function main() {
    const { data: newBucket, error: bucketError } = await newClient.storage.getBucket(BUCKET);
    if (bucketError || !newBucket) {
        throw new Error(`Supabase mới chưa có bucket '${BUCKET}'. Hãy tạo bucket này trước.`);
    }

    console.log(`Đang quét bucket '${BUCKET}' ở Supabase cũ...`);
    const files = await listFiles();
    const totalBytes = files.reduce((sum, file) => sum + (Number(file.metadata.size) || 0), 0);
    console.log(`Tìm thấy ${files.length} file (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`);

    if (!APPLY) {
        console.log('Chế độ kiểm tra: chưa copy hoặc thay đổi dữ liệu.');
        console.log('Chạy lại với --apply để copy file. Thêm --rewrite-references để đổi các URL Supabase cũ.');
        return;
    }

    let copied = 0;
    for (const [index, file] of files.entries()) {
        const { data, error: downloadError } = await oldClient.storage.from(BUCKET).download(file.path);
        if (downloadError) throw new Error(`Không tải được ${file.path}: ${downloadError.message}`);

        const { error: uploadError } = await newClient.storage.from(BUCKET).upload(file.path, data, {
            upsert: true,
            contentType: file.metadata.mimetype || undefined,
            cacheControl: '3600'
        });
        if (uploadError) throw new Error(`Không đưa được ${file.path} sang Supabase mới: ${uploadError.message}`);

        copied += 1;
        console.log(`[${index + 1}/${files.length}] ${file.path}`);
    }

    console.log(`Đã copy ${copied}/${files.length} file.`);
    if (REWRITE_REFERENCES) {
        const updated = await rewriteReferences();
        console.log(`Đã cập nhật ${updated} bản ghi chứa URL cũ.`);
    }
}

main().catch((error) => {
    console.error(`Migration thất bại: ${error.message || error}`);
    process.exitCode = 1;
});

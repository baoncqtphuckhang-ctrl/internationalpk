import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials are missing. Please check your .env.local file.');
}

const client = createClient(supabaseUrl, supabaseAnonKey);

const originalFrom = client.from.bind(client);

client.from = (table) => {
    const query = originalFrom(table);

    const originalInsert = query.insert.bind(query);
    const originalUpdate = query.update.bind(query);
    const originalDelete = query.delete.bind(query);

    const checkIntern = () => {
        if (typeof window !== 'undefined' && window.isIntern) {
            if (window.showToast) {
                window.showToast('Tài khoản thực tập sinh chỉ được xem, không được thao tác!', 'error');
            }
            throw new Error('Tài khoản thực tập sinh chỉ được xem, không được thao tác!');
        }
    };

    query.insert = (...args) => {
        checkIntern();
        return originalInsert(...args);
    };

    query.update = (...args) => {
        checkIntern();
        return originalUpdate(...args);
    };

    query.delete = (...args) => {
        checkIntern();
        return originalDelete(...args);
    };

    return query;
};

export const supabase = client;

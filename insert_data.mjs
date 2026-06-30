import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
    }
});

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const projectData = {
    versions: [
        {
            id: "1719716000000",
            name: "Đơn giá lần 1",
            date: "2026-01-01",
            categories: [
                {
                    name: "Hệ nội thất",
                    items: [
                        { stt: 1, name: "Dulux Professional Bột Trét Tường Nội Thất A500", colorCode: "", unit: "Bao", price: 188000 },
                        { stt: 2, name: "Dulux Professional Sơn Lót Nội Thất A300", colorCode: "", unit: "Thùng/18L", price: 522000 },
                        { stt: 3, name: "Dulux Professional Sơn Nội Thất A500", colorCode: "30GY 88/01", unit: "Thùng/18L", price: 522000 },
                        { stt: 4, name: "Dulux Professional Sơn Nội Thất A500", colorCode: "30GY 88/02", unit: "Thùng/18L", price: 522000 }
                    ]
                },
                {
                    name: "Hệ ngoại thất",
                    items: [
                        { stt: 1, name: "Dulux Professional Bột Trét Tường Ngoại Thất E700", colorCode: "", unit: "Bao", price: 220000 },
                        { stt: 2, name: "Dulux Professional Sơn Lót Ngoại Thất Weathershield E1000", colorCode: "", unit: "Thùng/18L", price: 1026000 },
                        { stt: 3, name: "Dulux Professional Weathershield E1000 Mờ", colorCode: "62GG 31/016", unit: "Thùng/18L", price: 1748000 },
                        { stt: 4, name: "Dulux Professional Weathershield Creation Acrytex", colorCode: "", unit: "Thùng/18L", price: 646100 }
                    ]
                }
            ]
        },
        {
            id: "1719717000000",
            name: "Đơn giá lần 2",
            date: "2026-03-04",
            categories: [
                {
                    name: "Hệ nội thất",
                    items: [
                        { stt: 1, name: "Dulux Professional Bột Trét Tường Nội Thất A500", colorCode: "", unit: "Bao", price: 188000 }
                    ]
                }
            ]
        }
    ],
    activeVersionId: "1719717000000"
};

async function insert() {
    const res = await fetch(`${url}/rest/v1/material_templates`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
            project_name: "THE ASPIRA (CHUNG CƯ TÂN BÌNH)",
            data: projectData
        })
    });
    if (res.ok) console.log("Successfully inserted THE ASPIRA data into Supabase!");
    else console.error("Error inserting:", await res.text());
}

insert();

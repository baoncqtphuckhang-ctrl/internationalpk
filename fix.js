const fs = require('fs');
let c = fs.readFileSync('components/MaterialOrder.jsx', 'utf8');

c = c.replace(
    /<\/select>\s*<p className="text-xs text-slate-500 mt-2 italic">Lưu ý: Bạn đang định nghĩa danh sách vật tư mặc định sẽ hiện ra mỗi khi lập Đơn đặt hàng mới cho công trình này\.<\/p>\s*<div className="mb-6 flex flex-col md:flex-row items-start md:items-end gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">/g,
    `</select>
<p className="text-xs text-slate-500 mt-2 italic">Lưu ý: Bạn đang định nghĩa danh sách vật tư mặc định sẽ hiện ra mỗi khi lập Đơn đặt hàng mới cho công trình này.</p>
</div>
<div className="mb-6 flex flex-col md:flex-row items-start md:items-end gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">`
);

fs.writeFileSync('components/MaterialOrder.jsx', c);
console.log("Done");

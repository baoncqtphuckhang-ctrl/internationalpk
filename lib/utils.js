/**
 * Các hàm tiện ích dùng chung cho hệ thống MISA Pro
 */

export const EXPENSE_CATEGORIES = [
    { code: '621', name: 'Vật tư chính' }, { code: '622', name: 'Chi nhân công' },
    { code: '623', name: 'Vật tư phụ' }, { code: '6412', name: 'Vận chuyển' },
    { code: '6413', name: 'Hồ sơ CN' }, { code: '6415', name: 'Chi phí tiếp khách' },
    { code: '6417.1', name: 'Bồi dưỡng' }, { code: '6417.2', name: 'Hỗ trợ' },
    { code: '6418', name: 'CP Bảo hiểm TN' }, { code: '6421', name: 'Phí chuyển tiền' },
    { code: '6427', name: 'Lương kĩ thuật' }, { code: '6428', name: 'Chi phí khác' },
    { code: '811', name: 'Xử lý hợp thức' }, { code: '6417.3', name: 'Chi phí gửi' },
];

// Đọc số tiền bằng chữ (Tiếng Việt)
export function docSoTiengViet(so) {
    const tien = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
    const words = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

    if (so === 0) return 'Không đồng';
    if (!so) return '';
    
    const readBlock = (n, full) => {
        let res = ""; 
        let tram = Math.floor(n / 100); 
        let chuc = Math.floor((n % 100) / 10); 
        let donvi = n % 10;
        
        if (full || tram > 0) res += words[tram] + " trăm ";
        if (chuc > 1) { 
            res += words[chuc] + " mươi "; 
            if (donvi === 1) res += "mốt "; 
            else if (donvi === 4) res += "tư "; 
            else if (donvi === 5) res += "lăm "; 
            else if (donvi !== 0) res += words[donvi] + " "; 
        }
        else if (chuc === 1) { 
            res += "mười "; 
            if (donvi === 5) res += "lăm "; 
            else if (donvi !== 0) res += words[donvi] + " "; 
        }
        else { 
            if (donvi > 0) { 
                if (full || tram > 0) res += "lẻ "; 
                res += words[donvi] + " "; 
            } 
        }
        return res;
    };

    let str = ""; 
    let block = 0; 
    let temp = so;
    while (temp > 0) {
        let n = temp % 1000; 
        temp = Math.floor(temp / 1000);
        if (n > 0) { 
            let blockStr = readBlock(n, temp > 0); 
            str = blockStr + tien[block] + " " + str; 
        }
        block++;
    }
    str = str.trim().replace(/\s+/g, ' ');
    return str.charAt(0).toUpperCase() + str.slice(1) + " đồng chẵn.";
}

// Định dạng tiền tệ VNĐ (chỉ hiện số)
export const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(amount);
};

// Định dạng ngày tháng VN
export const formatDateVN = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN');
};

// Chuyển đổi số kiểu Việt Nam (chỉ lấy số nguyên cho VNĐ)
export const parseVietnameseNumber = (str) => {
    if (!str) return 0;
    const cleaned = str.toString().replace(/[^0-9]/g, '');
    return parseInt(cleaned, 10) || 0;
};

// Chuyển đổi ngày kiểu VN (DD/MM/YYYY) sang chuẩn ISO (YYYY-MM-DD)
export const parseDateVN = (dateStr) => {
    if (!dateStr) return null;
    const s = dateStr.toString().trim().replace(/[-]/g, '/');
    if (s.match(/^\d{4}\/\d{2}\/\d{2}$/)) return s.replace(/\//g, '-');
    const parts = s.split('/');
    if (parts.length === 3) {
        let day = parts[0].padStart(2, '0');
        let month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        if (year.length === 4) return `${year}-${month}-${day}`;
    }
    return null;
};

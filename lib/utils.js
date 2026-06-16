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

export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || amount === '') return '0';
    if (amount === '-') return '-';
    const parts = amount.toString().split('.');
    let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (parts.length > 1) {
        return intPart + ',' + parts[1];
    }
    return intPart;
};

// Định dạng ngày tháng VN
export const formatDateVN = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN');
};

// Chuyển đổi số kiểu Việt Nam (hỗ trợ số nguyên và số thập phân)
export const parseVietnameseNumber = (str) => {
    if (str === null || str === undefined || str === '') return '';
    const s = str.toString();
    
    let cleaned = s.replace(/[^0-9.,-]/g, '');
    if (!cleaned) return '';
    
    const commaCount = (cleaned.match(/,/g) || []).length;

    if (commaCount > 1) {
        cleaned = cleaned.replace(/,/g, '');
    } else if (commaCount === 1) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        cleaned = cleaned.replace(/\./g, '');
    }

    if (cleaned.endsWith('.')) return cleaned;
    if (cleaned.match(/\.\d*0$/)) return cleaned;
    if (cleaned === '-') return '-';

    const val = parseFloat(cleaned);
    return isNaN(val) ? '' : val;
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

// Hàm tính toán tự động ngày lễ Việt Nam (Dương lịch & Âm lịch quy đổi)
export const getVietnameseHolidays = (year, month) => {
    const solarHolidays = [];
    if (month === 1) solarHolidays.push(1); // Tết Dương lịch
    if (month === 4) solarHolidays.push(30); // Giải phóng miền Nam
    if (month === 5) solarHolidays.push(1); // Quốc tế lao động
    if (month === 9) solarHolidays.push(2); // Quốc khánh
    
    // Giỗ Tổ, Tết Âm quy ra Dương cho 2024-2030
    const lunarToSolar = {
        2024: { '04-18': [10, 3], '02-08': 'Tet', '02-09': 'Tet', '02-10': 'Tet', '02-11': 'Tet', '02-12': 'Tet', '02-13': 'Tet', '02-14': 'Tet' },
        2025: { '04-07': [10, 3], '01-28': 'Tet', '01-29': 'Tet', '01-30': 'Tet', '01-31': 'Tet', '02-01': 'Tet', '02-02': 'Tet', '02-03': 'Tet' },
        2026: { '04-26': [10, 3], '02-16': 'Tet', '02-17': 'Tet', '02-18': 'Tet', '02-19': 'Tet', '02-20': 'Tet', '02-21': 'Tet', '02-22': 'Tet' },
        2027: { '04-16': [10, 3], '02-05': 'Tet', '02-06': 'Tet', '02-07': 'Tet', '02-08': 'Tet', '02-09': 'Tet', '02-10': 'Tet', '02-11': 'Tet' },
        2028: { '04-04': [10, 3], '01-25': 'Tet', '01-26': 'Tet', '01-27': 'Tet', '01-28': 'Tet', '01-29': 'Tet', '01-30': 'Tet', '01-31': 'Tet' },
        2029: { '04-23': [10, 3], '02-12': 'Tet', '02-13': 'Tet', '02-14': 'Tet', '02-15': 'Tet', '02-16': 'Tet', '02-17': 'Tet', '02-18': 'Tet' },
        2030: { '04-12': [10, 3], '02-01': 'Tet', '02-02': 'Tet', '02-03': 'Tet', '02-04': 'Tet', '02-05': 'Tet', '02-06': 'Tet', '02-07': 'Tet' }
    };
    
    const yearHolidays = lunarToSolar[year] || {};
    Object.keys(yearHolidays).forEach(dateStr => {
        const [m, d] = dateStr.split('-').map(Number);
        if (m === month) {
            solarHolidays.push(d);
        }
    });

    return solarHolidays;
};


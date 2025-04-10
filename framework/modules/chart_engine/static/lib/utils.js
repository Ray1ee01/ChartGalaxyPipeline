// 解析日期
const parseDate = d => {
    if (d instanceof Date) return d;
    if (typeof d === 'number') return new Date(d, 0, 1);
    if (typeof d === 'string') {
        const parts = d.split('-');
        
        // YYYY-MM-DD 格式
        if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            return new Date(year, month, day);
        }
        
        // YYYY-MM 格式
        if (parts.length === 2) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            return new Date(year, month, 1);
        }
        
        // YYYY 格式
        if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
            const year = parseInt(parts[0]);
            return new Date(year, 0, 1);
        }
    }
    return new Date();
};
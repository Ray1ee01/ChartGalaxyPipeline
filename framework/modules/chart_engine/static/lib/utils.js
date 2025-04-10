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

// 创建智能日期比例尺和刻度
const createXAxisScaleAndTicks = (data, xField, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
    // 解析所有日期
    const dates = data.map(d => parseDate(d[xField]));
    const xExtent = d3.extent(dates);
    const xRange = xExtent[1] - xExtent[0];
    const xPadding = xRange * padding;
    
    // 创建比例尺
    const xScale = d3.scaleTime()
        .domain([
            new Date(xExtent[0].getTime() - xPadding),
            new Date(xExtent[1].getTime() + xPadding)
        ])
        .range([rangeStart, rangeEnd]);
    
    // 计算日期跨度（毫秒）
    const timeSpan = xExtent[1] - xExtent[0];
    const daySpan = timeSpan / (1000 * 60 * 60 * 24);
    const monthSpan = daySpan / 30;
    const yearSpan = daySpan / 365;
    
    // 根据跨度选择合适的时间间隔
    let timeInterval;
    let formatFunction;
    
    if (yearSpan > 30) {
        // 超过30年，每10年一个刻度
        timeInterval = d3.timeYear.every(10);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 10) {
        // 超过10年，每5年一个刻度
        timeInterval = d3.timeYear.every(5);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 2) {
        // 2-10年，每年一个刻度
        timeInterval = d3.timeYear.every(1);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 1) {
        // 1-2年，每季度一个刻度
        timeInterval = d3.timeMonth.every(3);
        formatFunction = d => {
            const month = d.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            return `${d.getFullYear().toString().slice(-2)}Q${quarter}`;
        };
    } else if (monthSpan > 6) {
        // 6个月-1年，每月一个刻度
        timeInterval = d3.timeMonth.every(1);
        formatFunction = d => d3.timeFormat("%b %Y")(d);
    } else if (monthSpan > 2) {
        // 2-6个月，每周一个刻度
        timeInterval = d3.timeWeek.every(1);
        formatFunction = d => d3.timeFormat("%d %b")(d);
    } else {
        // 少于2个月，每天一个刻度或每几天一个刻度
        const dayInterval = Math.max(1, Math.ceil(daySpan / 10));
        timeInterval = d3.timeDay.every(dayInterval);
        formatFunction = d => d3.timeFormat("%d %b")(d);
    }
    
    // 生成刻度
    const xTicks = xScale.ticks(timeInterval);
    
    // 确保包含最后一个日期
    if (xTicks.length > 0 && xTicks[xTicks.length - 1] < xExtent[1]) {
        xTicks.push(xExtent[1]);
    }
    
    return {
        xScale: xScale,
        xTicks: xTicks,
        xFormat: formatFunction,
        timeSpan: {
            days: daySpan,
            months: monthSpan,
            years: yearSpan
        }
    };
};

/**
 * 根据数据点数量计算需要显示标签的点的索引
 * @param {number} n - 数据点总数
 * @returns {number[]} - 需要显示标签的点的索引数组
 */
const sampleLabels = (n) => {
    // 少于10个点时显示所有标签
    if (n <= 10) {
        return Array.from({length: n}, (_, i) => i);
    }
    
    // 超过10个点时每隔 n/10 个点显示一个标签
    const step = Math.ceil(n / 10);
    const result = [];
    
    // 从0开始,每隔step个点取一个索引
    for (let i = 0; i < n; i += step) {
        result.push(i);
    }
    
    // 确保包含最后一个点
    if (result[result.length - 1] !== n - 1) {
        result.push(n - 1);
    }
    
    return result;
};

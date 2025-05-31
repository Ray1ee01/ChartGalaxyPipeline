/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Area Charts",
    "chart_name": "small_multiple_area_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 400,
    "min_width": 800,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "trend"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // ---------- 辅助函数 ----------
    // 简化版本解析日期
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1);
        if (typeof d === 'string') {
            const [y, m, day] = d.split('-');
            if (day) return new Date(+y, +m - 1, +day);
            if (m) return new Date(+y, +m - 1, 1);
            if (/^\d{4}$/.test(y)) return new Date(+y, 0, 1);
        }
        return new Date();
    };

    const createXAxisScaleAndTicks = (data, xField, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
        const dates = data.map(d => parseDate(d[xField]));
        const [minD, maxD] = d3.extent(dates);
        const span = +maxD - +minD;
        const yearSpan = span / (365 * 24 * 60 * 60 * 1000);
        const pad = span * padding;

        // 检查年份跨度，如果少于2年就不画图
        if (yearSpan < 1.5) {
            return null;
        }
        
        const xScale = d3.scaleTime()
            .domain([new Date(+minD - pad), new Date(+maxD + pad)])
            .range([rangeStart, rangeEnd]);
        
        // 只考虑年份间隔，但分支要全面
        let interval, format = d => d3.timeFormat("%Y")(d);
        if (yearSpan > 25) interval = d3.timeYear.every(10);
        else if (yearSpan > 20) interval = d3.timeYear.every(5);
        else if (yearSpan > 15) interval = d3.timeYear.every(4);
        else if (yearSpan > 10) interval = d3.timeYear.every(3);
        else if (yearSpan > 5) interval = d3.timeYear.every(2);
        else if (yearSpan > 2) interval = d3.timeYear.every(1);
        else interval = d3.timeYear.every(1);

        let xTicks = xScale.ticks(interval);
        
        // 确保包含最后一个数据点，但不影响中间的刻度
        if (xTicks.length && xTicks[xTicks.length - 1] < maxD) {
            const last = xTicks[xTicks.length - 1];
            const lx = xScale(last), mx = xScale(maxD);
            // 如果最后一个数据点距离最后一个刻度足够远，就添加它
            if (Math.abs(mx - lx) >= 50) {
                xTicks.push(maxD);
            }// 如果距离太近，不替换，保持原有刻度完整性
        }
        
        // 确保刻度按时间排序
        xTicks.sort((a, b) => a - b);

        return { xScale, xTicks, xFormat: format, timeSpan: { years: yearSpan } };
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // 过滤非时间数据
    const temporalFilter = (data, field) => {
        return data.filter(d => {
            try { parseDate(d[field]); return true; } catch { return false; }
        });
    };

    // 计算文本宽度
    const getTextWidth = (text, fontSize) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize}px Arial`;
        const width = context.measureText(text).width;
        canvas.remove();
        return width;
    };

    // ---------- 主要代码 ----------
    const jsonData = data;
    let chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;

    chartData = temporalFilter(chartData, xField);
    if (chartData.length === 0) {
        console.log("chartData is empty");
        return;
    }
    
    // 获取所有组
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    // 计算全局Y轴范围，确保所有子图使用相同的刻度
    const globalYMax = d3.max(chartData, d => d[yField]);
    const globalYDomain = [0, globalYMax * 1.2];
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 80, left: 40 };
    
    // 计算子图布局 - 增加间距
    const rows = Math.ceil(groups.length / 2);
    const cols = Math.min(groups.length, 2);
    
    const plotGap = 20; // 子图之间的间距
    const subplotWidth = (width - margin.left - margin.right - plotGap * (cols - 1)) / cols;
    const subplotHeight = (height - margin.top - margin.bottom - plotGap * (rows - 1)) / rows;
    const subplotMargin = { top: 50, right: 25, bottom: 40, left: 25 };
    const innerWidth = subplotWidth - subplotMargin.left - subplotMargin.right;
    const innerHeight = subplotHeight - subplotMargin.top - subplotMargin.bottom;

    // 创建全局Y轴比例尺
    const globalYScale = d3.scaleLinear()
        .domain(globalYDomain)
        .range([innerHeight, 0]);

    // 计算统一的Y轴刻度
    const globalYTicks = globalYScale.ticks(4);
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const defs = svg.append("defs");
    
    // 为每个组创建子图
    groups.forEach((group, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        const subplotX = margin.left + col * (subplotWidth + plotGap);
        const subplotY = margin.top + row * (subplotHeight + plotGap);
        
        const subplot = svg.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);
        
        const g = subplot.append("g")
            .attr("transform", `translate(${subplotMargin.left}, ${subplotMargin.top})`);
        
        // 获取当前组的数据并排序
        let groupData = chartData.filter(d => d[groupField] === group);
        groupData.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        
        // 创建x轴比例尺，检查年份数量
        const axisResult = createXAxisScaleAndTicks(groupData, xField, 0, innerWidth);
        if (!axisResult) {
            // 如果年份少于2个，跳过此子图
            return;
        }
        const { xScale, xTicks, xFormat } = axisResult;
        
        // 使用全局Y轴比例尺，确保所有子图刻度一致
        const yScale = globalYScale;
        const yTicks = globalYTicks;
        
        // 获取组颜色
        const groupColor = colors.field && colors.field[group] 
            ? colors.field[group] 
            : d3.schemeCategory10[i % 10];
        
        // 创建渐变
        const gradientId = `area-gradient-${i}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", groupColor)
            .attr("stop-opacity", 0.7);
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", groupColor)
            .attr("stop-opacity", 0.0);
        
        // 添加坐标轴线
        // X轴线（底部）
        g.append("line")
            .attr("x1", 0)
            .attr("y1", innerHeight)
            .attr("x2", innerWidth)
            .attr("y2", innerHeight)
            .attr("stroke", "#666666")
            .attr("stroke-width", 1)
            .attr("class", "axis");
        
        // 添加网格线 - 使用深灰色
        yTicks.forEach(tick => {
            if (tick !== 0) {
                g.append("line")
                    .attr("x1", 0)
                    .attr("y1", yScale(tick))
                    .attr("x2", innerWidth)
                    .attr("y2", yScale(tick))
                    .attr("stroke", "#888888")
                    .attr("stroke-width", 0.5)
                    .attr("class", "gridline");
            }
        });

        // 添加X轴刻度小竖线
        xTicks.forEach(tick => {
            const tickX = xScale(tick);
            g.append("line")
                .attr("x1", tickX)
                .attr("y1", innerHeight)
                .attr("x2", tickX)
                .attr("y2", innerHeight - 5)
                .attr("stroke", "#666666")
                .attr("stroke-width", 1)
                .attr("class", "axis");
        });

        // 创建面积生成器
        const area = d3.area()
            .x(d => xScale(parseDate(d[xField])))
            .y0(innerHeight)
            .y1(d => yScale(d[yField]))
            .curve(d3.curveLinear);
        
        // 绘制面积
        g.append("path")
            .datum(groupData)
            .attr("fill", `url(#${gradientId})`)
            .attr("class", "mark")
            .attr("d", area);
        
        // 绘制线条
        const line = d3.line()
            .x(d => xScale(parseDate(d[xField])))
            .y(d => yScale(d[yField]))
            .curve(d3.curveLinear);
        
        g.append("path")
            .datum(groupData)
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", 3)
            .attr("class", "mark")
            .attr("d", line);
        
        // 添加标题（居中）
        subplot.append("text")
            .attr("x", subplotWidth / 2)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-family", typography.label.font_family)
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("fill", colors.text_color || "#333333")
            .text(group);
        
        // 添加x轴刻度年份标签
        xTicks.forEach(tick => {
            const tickX = xScale(tick);
            
            // 添加年份标签
            g.append("text")
                .attr("x", tickX)
                .attr("y", innerHeight + 20)
                .attr("text-anchor", "middle")
                .attr("class", "label")
                .style("font-family", typography.label.font_family)
                .style("font-size", "12px")
                .style("fill", colors.text_color || "#333333")
                .text(xFormat(tick));
        });
        
        // 添加y轴刻度标签（右侧）
        yTicks.forEach(tick => {
            if (tick !== 0) {
                g.append("text")
                    .attr("x", innerWidth + 8)
                    .attr("y", yScale(tick))
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "middle")
                    .attr("class", "value")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", "11px")
                    .style("fill", colors.text_color || "#333333")
                    .text(formatValue(tick));
            }
        });
    });
    
    return svg.node();
} 
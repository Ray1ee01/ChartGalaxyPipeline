/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiple Step Line Graph",
    "chart_name": "small_multiple_step_line_graph_icons_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // ---------- 辅助函数 ----------
    // 解析日期
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1);
        if (typeof d === 'string') {
            const parts = d.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            if (parts.length === 2) {
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            }
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
                return new Date(parseInt(parts[0]), 0, 1);
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
        
        if (yearSpan > 35) {
            // 超过35年，每10年一个刻度
            timeInterval = d3.timeYear.every(10);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 15) {
            // 超过15年，每5年一个刻度
            timeInterval = d3.timeYear.every(5);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 7) {
            // 超过7年，每2年一个刻度  
            timeInterval = d3.timeYear.every(2);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 2) {
            // 2-7年，每年一个刻度
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
            formatFunction = d => d3.timeFormat("%m %Y")(d);
        } else if (monthSpan > 2) {
            // 2-6个月，每周一个刻度
            timeInterval = d3.timeWeek.every(1);
            formatFunction = d => d3.timeFormat("%d %m")(d);
        } else {
            // 少于2个月，每天一个刻度或每几天一个刻度
            const dayInterval = Math.max(1, Math.ceil(daySpan / 10));
            timeInterval = d3.timeDay.every(dayInterval);
            formatFunction = d => d3.timeFormat("%d %m")(d);
        }
        
        // 生成刻度
        const xTicks = xScale.ticks(timeInterval);
        
        // 确保包含最后一个日期，但避免刻度重叠
        if (xTicks.length > 0 && xTicks[xTicks.length - 1] < xExtent[1]) {
            const lastTick = xTicks[xTicks.length - 1];
            const lastDataDate = xExtent[1];
            
            // 计算像素距离
            const lastTickX = xScale(lastTick);
            const lastDataX = xScale(lastDataDate);
            const minPixelDistance = 60; // 最小60像素距离
            
            if (Math.abs(lastDataX - lastTickX) >= minPixelDistance) {
                // 距离足够，添加新刻度
                xTicks.push(lastDataDate);
            } else {
                // 距离太近，替换最后一个刻度
                xTicks[xTicks.length - 1] = lastDataDate;
            }
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

    // ---------- 主要代码 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    
    // 计算子图布局
    const rows = Math.ceil(groups.length / 2);
    const cols = Math.min(groups.length, 2);
    
    const subplotWidth = (width - margin.left - margin.right) / cols;
    const subplotHeight = (height - margin.top - margin.bottom) / rows;
    const subplotMargin = { top: 60, right: 20, bottom: 40, left: 50 };
    const innerWidth = subplotWidth - subplotMargin.left - subplotMargin.right;
    const innerHeight = subplotHeight - subplotMargin.top - subplotMargin.bottom;
    
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
    
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // 为每个组创建子图
    groups.forEach((group, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        const subplotX = margin.left + col * subplotWidth;
        const subplotY = margin.top + row * subplotHeight;
        
        const subplot = svg.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);
        
        const g = subplot.append("g")
            .attr("transform", `translate(${subplotMargin.left}, ${subplotMargin.top})`);
        
        // 获取当前组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 创建y轴比例尺
        const groupYMin = Math.min(0, d3.min(groupData, d => d[yField]) * 1.4);
        const groupYMax = d3.max(groupData, d => d[yField]) * 1.1;
        
        const yScale = d3.scaleLinear()
            .domain([groupYMin, groupYMax])
            .range([innerHeight, 0]);
        
        // 添加网格线
        const yTicks = yScale.ticks(4);
        yTicks.forEach(tick => {
            g.append("line")
                .attr("x1", 0).attr("y1", yScale(tick))
                .attr("x2", innerWidth).attr("y2", yScale(tick))
                .attr("stroke", "#333").attr("stroke-width", 0.5)
                .attr("class", "gridline");
        });
        
        xTicks.forEach(tick => {
            g.append("line")
                .attr("x1", xScale(tick)).attr("y1", 0)
                .attr("x2", xScale(tick)).attr("y2", innerHeight)
                .attr("stroke", "#333").attr("stroke-width", 0.5)
                .attr("class", "gridline");
        });
        
        // 添加X轴线条（在0刻度处）
        g.append("line")
            .attr("x1", 0).attr("y1", yScale(0))
            .attr("x2", innerWidth).attr("y2", yScale(0))
            .attr("stroke", "#999999").attr("stroke-width", 1)
            .attr("class", "axis");

        // 添加Y轴线
        const xPos = col === cols - 1 ? innerWidth : 0;
        g.append("line")
            .attr("x1", xPos).attr("y1", 0)
            .attr("x2", xPos).attr("y2", innerHeight)
            .attr("stroke", "#999999").attr("stroke-width", 1)
            .attr("class", "axis");
        
        // 添加标题
        subplot.append("text")
            .attr("x", subplotMargin.left + 40)
            .attr("y", 32)
            .attr("text-anchor", "start")
            .attr("class", "label")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", colors.text_color || "#000000")
            .text(group);
        
        // 添加组图片（如果有）
        if (images.field && images.field[group]) {
            const maskId = `circle-mask-${i}`;
            
            defs.append("mask")
                .attr("id", maskId)
                .append("circle")
                .attr("cx", 18).attr("cy", 18).attr("r", 19.5)
                .attr("fill", "#000000");
            
            const imgData = images.field[group];
            
            const imgGroup = subplot.append("g")
                .attr("transform", `translate(${subplotMargin.left}, 7)`);
            
            imgGroup.append("circle")
                .attr("cx", 18).attr("cy", 18).attr("r", 19.5)
                .attr("fill", "none").attr("stroke", "#000000").attr("stroke-width", 1)
                .attr("class", "image");
            
            imgGroup.append("image")
                .attr("x", 0).attr("y", 0).attr("width", 36).attr("height", 36)
                .attr("mask", `url(#${maskId})`)
                .attr("xlink:href", imgData)
                .attr("class", "image");
        }
    
        // 添加y轴刻度
        yTicks.forEach(tick => {
            const isRightSide = col === cols - 1;
            const xPos = isRightSide ? innerWidth + 10 : -10;
            const anchor = isRightSide ? "start" : "end";
            
            g.append("text")
                .attr("x", xPos).attr("y", yScale(tick))
                .attr("text-anchor", anchor).attr("dominant-baseline", "middle")
                .attr("class", "value")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", colors.text_color || "#000000")
                .text(tick);
        });
        
        // 添加x轴刻度
        xTicks.forEach(tick => {
            g.append("text")
                .attr("x", xScale(tick)).attr("y", innerHeight + 25)
                .attr("text-anchor", "middle")
                .attr("class", "label")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", colors.text_color || "#000000")
                .text(xFormat(tick));
        });
        
        // 创建阶梯线生成器
        const line = d3.line()
            .x(d => xScale(parseDate(d[xField])))
            .y(d => yScale(d[yField]))
            .curve(d3.curveStepAfter);
        
        // 绘制阶梯线
        g.append("path")
            .datum(groupData)
            .attr("fill", "none")
            .attr("stroke", colors.field[group])
            .attr("stroke-width", 2.5)
            .attr("class", "mark")
            .attr("d", line);
        
        // 添加最终数值标签
        if (groupData.length > 0) {
            const lastPoint = groupData[groupData.length - 1];
            const secondLastPoint = groupData[groupData.length - 2];
            
            const isGoingDown = lastPoint[yField] < secondLastPoint[yField];
            const labelOffset = isGoingDown ? 20 : -10;
            const labelXOffset = col === cols - 1 ? -17 : 0;
            
            g.append("text")
                .attr("x", xScale(parseDate(lastPoint[xField])) + labelXOffset)
                .attr("y", yScale(lastPoint[yField]) + labelOffset)
                .attr("text-anchor", "middle")
                .attr("class", "value")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", colors.text_color || "#000000")
                .text(lastPoint[yField].toFixed(1));
        }
    });
    
    return svg.node();
} 
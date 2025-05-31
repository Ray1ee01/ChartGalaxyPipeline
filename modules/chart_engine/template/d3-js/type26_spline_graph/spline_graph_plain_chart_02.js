/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Spline Graph",
    "chart_name": "spline_graph_plain_chart_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// 分组spline_graph_plain_chart_02
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

    // 创建时间比例尺和刻度
    const createXAxisScaleAndTicks = (data, xField, rangeStart, rangeEnd) => {
        const dates = data.map(d => parseDate(d[xField]));
        const xExtent = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xExtent).range([rangeStart, rangeEnd]);
        
        const timeSpan = xExtent[1] - xExtent[0];
        const yearSpan = timeSpan / (1000 * 60 * 60 * 24 * 365);
        
        let timeInterval, formatFunction;
        if (yearSpan > 35) {
            timeInterval = d3.timeYear.every(10);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 15) {
            timeInterval = d3.timeYear.every(5);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 7) {
            timeInterval = d3.timeYear.every(2);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 2) {
            timeInterval = d3.timeYear.every(1);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 1) {
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => {
                const month = d.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                return `${d.getFullYear().toString().slice(-2)}Q${quarter}`;
            };
        }
        
        const xTicks = xScale.ticks(timeInterval);
        return { xScale, xTicks, xFormat: formatFunction };
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
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("style", "max-width: 100%; height: auto;");
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    const defs = svg.append("defs");

    // 网格背景渐变
    const gridGradient = defs.append("linearGradient")
        .attr("class", "background")
        .attr("id", "grid-background-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
        
    gridGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#1e90ff")
        .attr("stop-opacity", 0);
        
    gridGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1e90ff")
        .attr("stop-opacity", 0.15);

    // 网格背景
    g.append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "url(#grid-background-gradient)")
        .attr("class", "background");

    // 创建比例尺
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(chartData, d => d[yField]) * 1.1),
            d3.max(chartData, d => d[yField]) * 1.1
        ])
        .range([innerHeight, 0]);
    
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
    };
    
    // 添加网格线
    const yTicks = yScale.ticks(5);
    const gridExtension = 5;

    // 水平网格线
    g.selectAll("line.gridline-y")
        .data(yTicks)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", -gridExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 1)
        .attr("opacity", 0.15);

    // 垂直网格线
    g.selectAll("line.gridline-x")
        .data(xTicks.filter((d, i) => i > 0 && i < xTicks.length - 1))
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + 10)
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 1)
        .attr("opacity", 0.15);
    
    // 创建曲线生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX);

    // 计算标签位置（防重叠）
    let labelPositions = [];
    groups.sort((a, b) => {
        const aData = chartData.filter(d => d[groupField] === a);
        const bData = chartData.filter(d => d[groupField] === b);
        return d3.descending(aData[aData.length - 1][yField], bData[bData.length - 1][yField]);
    });
    
    groups.forEach((group, i) => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const lastPoint = groupData[groupData.length - 1];
        const circleY = yScale(lastPoint[yField]);
        let labelY = circleY;
        
        // 防重叠逻辑
        labelPositions.forEach(pos => {
            if (Math.abs(labelY - pos) < 30) {
                labelY = pos + 30;
            }
        });
        labelPositions.push(labelY);
        
        // 创建标签组
        const labelGroup = g.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${innerWidth + 20}, ${labelY})`);
        
        const valueText = `${Math.round(lastPoint[yField])}`;
        const textWidth = getTextWidth(valueText, typography.label.font_size) + 10;
        
        // 标签背景
        labelGroup.append("rect")
            .attr("x", 0).attr("y", -10)
            .attr("width", textWidth * 1.1)
            .attr("height", 20)
            .attr("fill", getColor(group))
            .attr("class", "mark");
        
        // 指向三角形
        const relativeCircleY = circleY - labelY;
        const trianglePath = `M -12,${relativeCircleY} L 0,-10 L 0,10 Z`;
        
        labelGroup.append("path")
            .attr("d", trianglePath)
            .attr("fill", getColor(group))
            .attr("class", "mark");
        
        // 数值文本
        labelGroup.append("text")
            .attr("x", textWidth/2).attr("y", 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("class", "value")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#ffffff")
            .text(valueText);
        
        // 组名文本
        labelGroup.append("text")
            .attr("x", textWidth + 10).attr("y", 2)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .attr("class", "label")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .style("fill", getColor(group))
            .text(group);
    });
    
    // 绘制线条
    groups.forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        g.append("path")
            .datum(groupData)
            .attr("class", "mark")
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 2)
            .attr("d", line);
    });
    
    // X轴标签
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + 25)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#333333")
            .text(xFormat(tick));
    });
    
    // Y轴标签
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -gridExtension - 5)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("class", "value")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#333333")
            .text(tick);
    });

    // Y轴字段标签
    const maxYTick = yTicks[yTicks.length - 1];
    const maxYPos = yScale(maxYTick);
    
    const labelGroup = g.append("g")
        .attr("transform", `translate(${-margin.left + 35}, ${maxYPos - 40})`);

    const labelText = yField;
    const labelPadding = 20;
    const textWidth = getTextWidth(labelText, typography.label.font_size);
    const labelWidth = textWidth + 2 * labelPadding;
    const labelHeight = 20;
    const triangleHeight = 6;

    const labelPath = `
        M 0,0 
        H ${labelWidth} 
        V ${labelHeight} 
        H ${labelWidth/2 + triangleHeight} 
        L ${labelWidth/2},${labelHeight + triangleHeight} 
        L ${labelWidth/2 - triangleHeight},${labelHeight} 
        H 0 
        Z
    `;

    labelGroup.append("path")
        .attr("d", labelPath)
        .attr("fill", "transparent")
        .attr("stroke", "#333333")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5)
        .attr("class", "other");

    labelGroup.append("text")
        .attr("x", labelWidth/2)
        .attr("y", labelHeight/2 + 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("class", "text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", "#333333")
        .text(labelText);
    
    return svg.node();
} 
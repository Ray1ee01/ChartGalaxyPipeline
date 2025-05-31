/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Grouped Scatterplot",
    "chart_name": "grouped_scatterplot_plain_chart_01",
    "required_fields": ["x", "y", "y2", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "hierarchy": ["group"],
    "supported_effects": [],
    "min_height": 750,
    "min_width": 750,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 计算文本宽度
    const getTextWidth = (text, fontFamily, fontSize, fontWeight = "normal") => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        const width = context.measureText(text).width;
        canvas.remove();
        return width;
    };

    // 寻找最优标签位置
    const findOptimalPosition = (d, allPoints, currentPositions = {}) => {
        const positions = [
            { x: 15, y: 3, anchor: "start", priority: 1 },
            { x: 0, y: -15, anchor: "middle", priority: 2 },
            { x: -15, y: 3, anchor: "end", priority: 3 },
            { x: 0, y: 20, anchor: "middle", priority: 4 },
            { x: 15, y: -15, anchor: "start", priority: 5 },
            { x: -15, y: -15, anchor: "end", priority: 6 },
            { x: -15, y: 20, anchor: "end", priority: 7 },
            { x: 15, y: 20, anchor: "start", priority: 8 }
        ];

        const pointX = xScale(d[yField]), pointY = yScale(d[y2Field]);
        if (currentPositions[d[xField]]) return currentPositions[d[xField]];

        const tempText = g.append("text").style("font-family", typography.label.font_family).style("font-size", "10px").text(d[xField]);
        const textBBox = tempText.node().getBBox();
        tempText.remove();
        const labelWidth = textBBox.width, labelHeight = textBBox.height;

        for (const pos of positions) {
            let hasOverlap = false, labelX1, labelY1, labelX2, labelY2;

            // 计算标签位置
            if (pos.priority === 1) { labelX1 = pointX + 15; labelY1 = pointY - labelHeight / 2; }
            else if (pos.priority === 2) { labelX1 = pointX - labelWidth / 2; labelY1 = pointY - 15 - labelHeight; }
            else if (pos.priority === 3) { labelX1 = pointX - 15 - labelWidth; labelY1 = pointY - labelHeight / 2; }
            else if (pos.priority === 4) { labelX1 = pointX - labelWidth / 2; labelY1 = pointY + 15; }
            else if (pos.priority === 5) { labelX1 = pointX + 12; labelY1 = pointY - 12 - labelHeight; }
            else if (pos.priority === 6) { labelX1 = pointX - 12 - labelWidth; labelY1 = pointY - 12 - labelHeight; }
            else if (pos.priority === 7) { labelX1 = pointX - 12 - labelWidth; labelY1 = pointY + 12; }
            else { labelX1 = pointX + 12; labelY1 = pointY + 12; }

            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            // 检查边界溢出
            if (labelX1 < 0 || labelX2 > chartWidth || labelY1 < 0 || labelY2 > chartHeight) continue;

            // 检查与其他点的重叠
            for (const p of allPoints) {
                if (p === d) continue;
                const pX = xScale(p[yField]), pY = yScale(p[y2Field]);
                const dx = labelX1 + labelWidth/2 - pX, dy = labelY1 + labelHeight/2 - pY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < circleRadius + Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight) / 2) {
                    hasOverlap = true; break;
                }

                const pPos = currentPositions[p[xField]];
                if (pPos) {
                    const tempText = g.append("text").style("font-family", typography.label.font_family).style("font-size", "10px").text(p[xField]);
                    const otherBBox = tempText.node().getBBox();
                    tempText.remove();

                    let otherX1, otherY1;
                    if (pPos.anchor === "start") { otherX1 = pX + pPos.x; otherY1 = pY + pPos.y - otherBBox.height/2; }
                    else if (pPos.anchor === "middle") { otherX1 = pX + pPos.x - otherBBox.width/2; otherY1 = pY + pPos.y; }
                    else { otherX1 = pX + pPos.x - otherBBox.width; otherY1 = pY + pPos.y - otherBBox.height/2; }
                    
                    const otherX2 = otherX1 + otherBBox.width, otherY2 = otherY1 + otherBBox.height;
                    if (labelX1 < otherX2 && labelX2 > otherX1 && labelY1 < otherY2 && labelY2 > otherY1) {
                        hasOverlap = true; break;
                    }
                }
            }
            if (!hasOverlap) return { ...pos, canShow: true };
        }
        return { ...positions[0], canShow: false };
    };

    // 数据提取
    const jsonData = data, chartData = jsonData.data.data, variables = jsonData.variables;
    const typography = jsonData.typography, dataColumns = jsonData.data.columns || [], colors = jsonData.colors;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name, yField = dataColumns[1].name, y2Field = dataColumns[2].name;
    const groupField = dataColumns.find(col => col.role === "group").name;

    // 设置尺寸和边距
    const width = variables.width, height = variables.height;
    const margin = { top: 25, right: 25, bottom: 50, left: 50 };
    
    // 创建SVG
    const svg = d3.select(containerSelector).append("svg")
        .attr("width", width).attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg").attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right, chartHeight = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建比例尺
    const xExtent = d3.extent(chartData, d => d[yField]), yExtent = d3.extent(chartData, d => d[y2Field]);
    
    // 检查数据分布特征
    const hasNegativeOrZeroValues = (data, field) => data.some(d => d[field] <= 0);
    const isDistributionUneven = (data, field) => {
        const values = data.map(d => d[field]), extent = d3.extent(values), range = extent[1] - extent[0];
        const median = d3.median(values), q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75), iqr = q3 - q1;
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    };
    
    // X轴比例尺
    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yField);
    const xIsUneven = isDistributionUneven(chartData, yField);
    const xScale = (!xHasNegativeOrZero && xIsUneven) 
        ? d3.scaleLog().domain([Math.max(xExtent[0] * 0.9, 0.1), xExtent[1] * 1.1]).range([0, chartWidth])
        : d3.scaleLinear().domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]).range([0, chartWidth]);
            
    // Y轴比例尺
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2Field);
    const yIsUneven = isDistributionUneven(chartData, y2Field);
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog().domain([Math.max(yExtent[0] * 0.9, 0.1), yExtent[1] * 1.1]).range([chartHeight, 0])
        : d3.scaleLinear().domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]).range([chartHeight, 0]);
    
    // 创建坐标轴
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    
    // 添加X轴
    const xAxisGroup = g.append("g").attr("class", "axis").attr("transform", `translate(0, ${chartHeight})`).call(xAxis);
    xAxisGroup.selectAll("path").style("stroke", colors.text_color).style("stroke-width", 1).style("opacity", 0.5);
    xAxisGroup.selectAll("text").attr("class", "value").style("color", colors.text_color);
        
    // 添加Y轴
    const yAxisGroup = g.append("g").attr("class", "axis").call(yAxis);
    yAxisGroup.selectAll("path").style("stroke", colors.text_color).style("stroke-width", 1).style("opacity", 0.5);
    yAxisGroup.selectAll("text").attr("class", "value").style("color", colors.text_color);
    
    // 添加轴标题
    g.append("text").attr("class", "text").attr("x", chartWidth).attr("y", chartHeight + margin.bottom / 2 + 15)
        .attr("text-anchor", "end").attr("font-size", 13).text(yField);
    g.append("text").attr("class", "text").attr("transform", "rotate(-90)").attr("x", -margin.top)
        .attr("y", -margin.left / 2 - 10).attr("text-anchor", "end").attr("font-size", 13).text(y2Field);
    
    // 确定圆圈大小 - 智能半径计算
    const numPoints = chartData.length;
    let circleRadius = numPoints <= 10 ? 18 - numPoints * 0.7 : 12 - (numPoints - 10) * 0.4;
    circleRadius = Math.max(1.5, Math.min(18, circleRadius));
    
    // 添加数据点
    const points = g.selectAll(".data-point").data(chartData).enter().append("g")
        .attr("class", "data-point").attr("transform", d => `translate(${xScale(d[yField])}, ${yScale(d[y2Field])})`);
    
    // 添加数据点圆圈
    points.append("circle").attr("class", "mark").attr("r", circleRadius)
        .attr("fill", d => colors.field[d[groupField]]).style("opacity", 0.75);
    
    // 计算所有标签的最优位置
    let labelPositions = {};
    chartData.forEach(d => { labelPositions[d[xField]] = findOptimalPosition(d, chartData, labelPositions); });
    
    // 添加优化位置的标签
    points.append("text").attr("class", "label")
        .attr("x", d => labelPositions[d[xField]].x).attr("y", d => labelPositions[d[xField]].y)
        .attr("text-anchor", d => labelPositions[d[xField]].anchor)
        .style("font-family", typography.label.font_family).style("font-size", 10)
        .style("font-weight", typography.label.font_weight)
        .style("opacity", d => labelPositions[d[xField]].canShow ? 1 : 0).text(d => d[xField]);
    
    // 添加图例
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const legendFontSize = parseFloat(typography.label.font_size) || 12;
    const legendFontFamily = typography.label.font_family || "Arial";
    const legendFontWeight = typography.label.font_weight || "normal";
    const legendSpacing = 15, maxWidth = chartWidth;
    
    // 计算图例布局
    let lines = [], currentLine = [], currentWidth = 0;
    groups.forEach(name => {
        const textW = getTextWidth(name, legendFontFamily, `${legendFontSize}px`, legendFontWeight);
        const itemW = circleRadius * 2 + 4 + textW;
        
        if (currentWidth + itemW + legendSpacing > maxWidth && currentLine.length) {
            lines.push(currentLine); currentLine = []; currentWidth = 0;
        }
        currentLine.push({ name, width: itemW });
        currentWidth += itemW + (currentLine.length > 1 ? legendSpacing : 0);
    });
    if (currentLine.length) lines.push(currentLine);
    
    // 渲染图例
    const legendG = svg.append("g").attr("class", "other");
    const legendHeight = lines.length * (legendFontSize + 10);
    
    lines.forEach((line, lineIdx) => {
        const lineWidth = line.reduce((sum, item, idx) => sum + item.width + (idx > 0 ? legendSpacing : 0), 0);
        const startX = margin.left + (chartWidth - lineWidth) / 2;
        const y = 15 + lineIdx * (legendFontSize + 5);
        
        let currentX = startX;
        line.forEach(item => {
            const itemG = legendG.append("g").attr("transform", `translate(${currentX}, ${y})`);
            itemG.append("circle").attr("class", "mark").attr("cx", circleRadius).attr("cy", 0)
                .attr("r", circleRadius).attr("fill", colors.field[item.name] || colors.other.primary).style("opacity", 0.75);
            itemG.append("text").attr("class", "label").attr("x", circleRadius * 2 + 4).attr("y", 0)
                .attr("dominant-baseline", "middle").style("font-family", legendFontFamily)
                .style("font-size", `${legendFontSize}px`).style("font-weight", legendFontWeight)
                .style("fill", colors.text_color).text(item.name);
            currentX += item.width + legendSpacing;
        });
    });
    
    // 调整margin.top为图例留出空间
    margin.top = Math.max(25, legendHeight + 25);
    // 重新设置图表组的位置
    g.attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    return svg.node();
}
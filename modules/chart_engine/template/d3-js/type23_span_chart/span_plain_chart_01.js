/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Span Chart",
    "chart_name": "span_plain_chart_01",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 使用D3.js实现水平span图表
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 800;
    const height = variables.height || 600;
    const margin = { top: 90, right: 80, bottom: 60, left: 120 };
    
    // ---------- 3. 提取字段信息 ----------
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;
    
    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }
    
    // ---------- 4. 数据处理 ----------
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 验证数据完整性：检查每个维度是否都有两个group的数据
    const isDataComplete = dimensions.every(dimension => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        const dimensionGroups = [...new Set(dimensionData.map(d => d[groupField]))];
        return dimensionGroups.length === groups.length;
    });
    // 如果数据不完整，停止绘制并返回空节点
    if (!isDataComplete) {
        console.warn('数据不完整：某些维度缺少group数据，无法绘制span图表');
        return null;
    }
    
    // ---------- 5. 计算内部绘图区域 ----------
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;");

    const defs = svg.append("defs");

    // 创建背景渐变
    const bgGradient = defs.append("linearGradient")
        .attr("id", "background-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "100%");
    
    bgGradient.append("stop").attr("offset", "0%").attr("stop-color", "#4a0032");
    bgGradient.append("stop").attr("offset", "100%").attr("stop-color", "#1c3b6e");

    // 添加背景
    svg.append("rect")
        .attr("width", width).attr("height", height)
        .attr("class", "background")
        .attr("fill", "url(#background-gradient)");
    
    // ---------- 7. 创建比例尺 ----------
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2);

    const minValue = d3.min(chartData, d => +d[valueField]);
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const xScale = d3.scaleLinear()
        .domain([Math.min(minValue, 0) * 1.15, maxValue * 1.1])
        .range([0, innerWidth]);
    
    // 颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) return colors.field[group];
            return i === 0 ? "#1d3c6f" : "#6fa0d8";
        }));
    
    // ---------- 8. 创建图例 ----------
    // 计算图例项实际宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0).attr("height", 0)
        .style("visibility", "hidden");
    
    const legendItemWidths = [];
    let totalLegendWidth = 0;
    
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        const itemWidth = 15 + 5 + textWidth + 15; // 圆圈 + 间距 + 文本 + 右边距
        legendItemWidths.push(itemWidth);
        totalLegendWidth += itemWidth;
        
        tempText.remove();
    });
    
    tempSvg.remove();
    
    const legend = svg.append("g")
        .attr("class", "other")
        .attr("transform", `translate(${(width - totalLegendWidth) / 2}, ${margin.top - 25})`);
    
    let legendOffset = 0;
    groups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${legendOffset}, 0)`);
        
        legendItem.append("circle")
            .attr("cx", 7.5).attr("cy", 7.5).attr("r", 7.5)
            .attr("class", "mark")
            .attr("fill", colorScale(group))
            .attr("stroke", "white").attr("stroke-width", 1.2);
        
        legendItem.append("text")
            .attr("x", 20).attr("y", 7.5).attr("dy", "0.35em")
            .attr("class", "label")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#ffffff")
            .text(group);
        
        legendOffset += legendItemWidths[i];
    });
    
    // ---------- 9. 创建主图表组 ----------
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 添加网格线 ----------
    const xTicks = xScale.ticks(8);
    
    g.selectAll(".gridline")
        .data(xTicks)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d)).attr("y1", 0)
        .attr("x2", d => xScale(d)).attr("y2", innerHeight)
        .attr("stroke", "rgba(255, 255, 255, 0.15)")
        .attr("stroke-width", 1);
    
    // 添加X轴刻度值
    g.selectAll(".value")
        .data(xTicks)
        .enter().append("text")
        .attr("class", "value")
        .attr("x", d => xScale(d))
        .attr("y", innerHeight + 20)
        .attr("text-anchor", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("fill", "white")
        .text(d => formatValue(d));
    
    // ---------- 11. 绘制条形和标记 ----------
    dimensions.forEach(dimension => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        
        if (dimensionData.length > 0) {
            const barHeight = yScale.bandwidth();
            const labelY = yScale(dimension) + barHeight / 2;
            
            // 添加维度标签
            g.append("text")
                .attr("x", -5).attr("y", labelY).attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .attr("class", "label")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("fill", "#ffffff")
                .text(dimension);
            
            // 处理数据点
            const pointData = groups.map(group => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                if (dataPoint) {
                    return {
                        group: group,
                        value: parseFloat(dataPoint[valueField]),
                        x: xScale(parseFloat(dataPoint[valueField])),
                        y: yScale(dimension)
                    };
                }
                return null;
            }).filter(d => d !== null);
            
            pointData.sort((a, b) => a.value - b.value);
            
            // 绘制条形和数据点
            if (pointData.length >= 2) {
                const startPoint = pointData[0];
                const endPoint = pointData[1];
                
                // 绘制条形
                g.append("rect")
                    .attr("x", startPoint.x)
                    .attr("y", startPoint.y + barHeight * 0.25)
                    .attr("width", endPoint.x - startPoint.x)
                    .attr("height", barHeight * 0.5)
                    .attr("class", "mark")
                    .attr("fill", colors.primary || "#6fa0d8");
                
                // 添加数据点圆圈
                pointData.forEach(point => {
                    g.append("circle")
                        .attr("cx", point.x)
                        .attr("cy", point.y + barHeight / 2)
                        .attr("r", 6)
                        .attr("class", "mark")
                        .attr("fill", colorScale(point.group))
                        .attr("stroke", "white")
                        .attr("stroke-width", 2);
                });
                
                // 左边数值标签
                g.append("text")
                    .attr("x", startPoint.x - 8)
                    .attr("y", startPoint.y + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .attr("class", "value")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(16, Math.max(barHeight * 0.4, 12))}px`)
                    .style("font-weight", "bold")
                    .style("fill", colors.text_color || "#ffffff")
                    .text(formatValue(startPoint.value));
                
                // 右边数值标签
                g.append("text")
                    .attr("x", endPoint.x + 8)
                    .attr("y", endPoint.y + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .attr("class", "value")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(16, Math.max(barHeight * 0.4, 12))}px`)
                    .style("font-weight", "bold")
                    .style("fill", colors.text_color || "#ffffff")
                    .text(formatValue(endPoint.value));
            }
        }
    });
    
    return svg.node();
}
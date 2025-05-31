/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_plain_chart_02",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平分组条形图实现 - 使用D3.js   
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const dataColumns = jsonData.data.columns || [];
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,
        right: 30,
        bottom: 60,
        left: 60
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    let groupUnit = "";
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    if (dataColumns.find(col => col.role === "group").unit !== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit; 
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // ---------- 5. 计算标签宽度 ----------
    
    // 创建临时SVG来测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算最大维度标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
        
        tempText.remove();
    });
    
    // 计算最大数值标签宽度
    let maxValueWidth = 0;
    chartData.forEach(d => {
        const formattedValue = valueUnit ? 
            `${d[valueField]}${valueUnit}` : 
            `${d[valueField]}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", typography.annotation.font_weight)
            .text(formattedValue);
        
        const textWidth = tempText.node().getBBox().width;
        maxValueWidth = Math.max(maxValueWidth, textWidth);
        
        tempText.remove();
    });
    
    // 计算图例项宽度
    const legendItemWidths = [];
    let totalLegendWidth = 0;
    const legendPadding = 10;
    
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        const legendItemWidth = 15 + 5 + textWidth + legendPadding;
        
        legendItemWidths.push(legendItemWidth);
        totalLegendWidth += legendItemWidth;
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 根据标签宽度调整边距
    margin.left = Math.max(margin.left, maxLabelWidth + 20);
    margin.right = Math.max(margin.right, maxValueWidth + 20);
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 添加defs用于视觉效果
    const defs = svg.append("defs");
    
    // 添加阴影滤镜（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        groups.forEach((group, i) => {
            const groupColor = colors.field && colors.field[group] ? 
                             colors.field[group] : 
                             d3.schemeCategory10[i % 10];
            
            const gradient = defs.append("linearGradient")
                .attr("id", `bar-gradient-${i}`)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(groupColor).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(groupColor).darker(0.3));
        });
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    const barPadding = variables.has_spacing ? 0.3 : 0.1;
    
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField])])
        .range([0, innerWidth]);
    
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            return d3.schemeCategory10[i % 10];
        }));
    
    // ---------- 8. 创建图例 ----------
    
    const legend = svg.append("g")
        .attr("class", "other")
        .attr("transform", `translate(${width / 2}, ${margin.top / 2})`);
    
    let legendOffset = 0;
    groups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${legendOffset}, 0)`);
        
        legendItem.append("rect")
            .attr("class", "mark")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", colorScale(group))
            .attr("rx", variables.has_rounded_corners ? 2 : 0)
            .attr("ry", variables.has_rounded_corners ? 2 : 0);
        
        legendItem.append("text")
            .attr("class", "label")
            .attr("x", 20)
            .attr("y", 7.5)
            .attr("dy", "0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(group);
        
        legendOffset += legendItemWidths[i];
    });
    
    legend.attr("transform", `translate(${(width - totalLegendWidth) / 2}, ${margin.top / 2})`);
    
    // ---------- 9. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 10. 获取描边颜色的辅助函数 ----------
    
    const getStrokeColor = (color) => {
        if (colors.stroke_color) return colors.stroke_color;
        return d3.rgb(color).darker(0.5);
    };
    
    // ---------- 11. 为每个维度绘制分组条形 ----------
    
    dimensions.forEach(dimension => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        
        if (dimensionData.length > 0) {
            const barHeight = yScale.bandwidth();
            const labelY = yScale(dimension) + barHeight / 2;
            
            // 添加维度标签
            g.append("text")
                .attr("class", "label")
                .attr("x", -10)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .text(dimension);
            
            const groupBarHeight = barHeight / groups.length;
            
            groups.forEach((group, groupIndex) => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                
                if (dataPoint) {
                    const value = parseFloat(dataPoint[valueField]);
                    const barWidth = xScale(value);
                    const groupY = yScale(dimension) + (groupIndex * groupBarHeight);
                    
                    // 绘制条形
                    g.append("rect")
                        .attr("class", "mark")
                        .attr("x", 0)
                        .attr("y", groupY)
                        .attr("width", barWidth)
                        .attr("height", groupBarHeight)
                        .attr("fill", variables.has_gradient ? 
                              `url(#bar-gradient-${groupIndex})` : 
                              colorScale(group))
                        .attr("rx", groupBarHeight / 2)
                        .attr("ry", groupBarHeight / 2)
                        .style("stroke", variables.has_stroke ? 
                               getStrokeColor(colorScale(group)) : "none")
                        .style("stroke-width", variables.has_stroke ? 1 : 0)
                        .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                        .on("mouseover", function() {
                            d3.select(this).attr("opacity", 0.8);
                        })
                        .on("mouseout", function() {
                            d3.select(this).attr("opacity", 1);
                        });
                    
                    // 添加数值标签
                    const formattedValue = valueUnit ? 
                        `${formatValue(value)}${valueUnit}` : 
                        `${formatValue(value)}`;
                    
                    g.append("text")
                        .attr("class", "value")
                        .attr("x", barWidth + 5)
                        .attr("y", groupY + groupBarHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${Math.max(groupBarHeight * 0.6, parseFloat(typography.annotation.font_size))}px`)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("fill", colors.text_color)
                        .text(formattedValue);
                }
            });
        }
    });
    
    return svg.node();
}
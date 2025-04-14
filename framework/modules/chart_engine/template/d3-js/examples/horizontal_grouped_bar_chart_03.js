/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Grouped Bar Chart",
    "chart_name": "horizontal_grouped_bar_chart_03",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data                // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const images = jsonData.images || { field: {}, other: {} };  // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    
    // 设置视觉效果变量的默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 为标题和副标题预留空间，即使不显示它们
    const titleHeight = 70;  // 为标题预留至少70的高度
    
    // 分析图表区域底部边距
    const bottomMargin = 50;
    
    // 初始设置边距
    const margin = { 
        top: titleHeight,     // 顶部留出标题空间
        right: 80,            // 右侧足够显示数值
        bottom: bottomMargin, // 底部边距
        left: 150             // 左侧暂时设为最小值，稍后会根据标签长度调整
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    let dimensionField = '', valueField = '', groupField = '';
    
    try {
        dimensionField = dataColumns.find(col => col.role === "x").name;
        valueField = dataColumns.find(col => col.role === "y").name;
        groupField = dataColumns.find(col => col.role === "group").name;
    } catch (error) {
        console.error("数据列定义有误", error);
        // 使用默认值防止出错
        dimensionField = dimensionField || "country";
        valueField = valueField || "value";
        groupField = groupField || "group";
    }
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; 
    let groupUnit = "";
    
    try {
        if (dataColumns.find(col => col.role === "x") && 
            dataColumns.find(col => col.role === "x").unit !== "none") {
            dimensionUnit = dataColumns.find(col => col.role === "x").unit;
        }
        
        if (dataColumns.find(col => col.role === "y") && 
            dataColumns.find(col => col.role === "y").unit !== "none") {
            valueUnit = dataColumns.find(col => col.role === "y").unit;
        }
        
        if (dataColumns.find(col => col.role === "group") && 
            dataColumns.find(col => col.role === "group").unit !== "none") {
            groupUnit = dataColumns.find(col => col.role === "group").unit; 
        }
    } catch (error) {
        console.error("获取单位时出错", error);
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取维度（如Gen Z, Millennials等）和分组（如$50 or more, $1-49, Nothing）
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // ---------- 5. 计算标签和图标空间 ----------
    
    // 创建临时SVG用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");
    
    // 计算维度标签最大宽度
    let maxDimensionWidth = 0;
    dimensions.forEach(dimension => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .text(dimension);
        
        const textWidth = tempText.node().getBBox().width;
        maxDimensionWidth = Math.max(maxDimensionWidth, textWidth);
        
        tempText.remove();
    });
    
    // 计算分组标签最大宽度
    let maxGroupWidth = 0;
    groups.forEach(group => {
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", "bold")
            .text(group);
        
        const textWidth = tempText.node().getBBox().width;
        maxGroupWidth = Math.max(maxGroupWidth, textWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // === 修改点：结合维度标签和组标签最大宽度，重新计算margin.left ===
    const maxLabelWidth = Math.max(maxDimensionWidth, maxGroupWidth);
    const dimensionLabelWidth = maxLabelWidth + 20; // 预留额外空间
    margin.left = Math.max(margin.left, dimensionLabelWidth + 20);
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算每组需要的垂直空间
    const groupHeight = innerHeight / groups.length;
    const groupPadding = innerHeight * (variables.has_spacing ? 0.08 : 0.06);  // 组间距
    
    // 每个维度的条形高度
    const barHeight = (groupHeight - groupPadding) / dimensions.length;
    const actualBarHeight = variables.has_spacing ? barHeight * 0.65 : barHeight * 0.75;   // 实际条形高度
    

    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建defs用于滤镜和渐变
    const defs = svg.append("defs");
    
    // ---------- 6.1 创建视觉效果 ----------
    
    // 添加阴影滤镜（如果启用）
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        // 添加阴影效果组件
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 4);
        
        filter.append("feOffset")
            .attr("dx", 4)
            .attr("dy", 4)
            .attr("result", "offsetblur");
        
        // 创建合并效果
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 添加渐变（如果启用）
    if (variables.has_gradient) {
        groups.forEach(group => {
            const gradientId = `gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getGroupColor(group);
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(1.2));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.7));
        });
    }
    
    // ---------- 7. 创建比例尺 ----------
    
    // 计算最大值用于X轴比例尺
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    // 值的X比例尺
    const xScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1]) // 添加10%边距
        .range([0, innerWidth]);
    
    // ---------- 8. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 辅助函数 ----------
    
    // 获取组颜色
    function getGroupColor(group) {
        // 优先使用指定颜色
        if (colors.field && colors.field[group]) {
            return colors.field[group];
        }
        
        // 如果有可用颜色数组，按索引使用
        if (colors.available_colors && colors.available_colors.length > 0) {
            const groupIndex = groups.indexOf(group);
            return colors.available_colors[groupIndex % colors.available_colors.length];
        }
        
        // 默认颜色方案
        // const defaultColors = {
        //     "$50 or more": "#ff725c", // 红色
        //     "$1-49": "#4269d0",      // 蓝色
        //     "Nothing": "#3ca951"     // 绿色
        // };
        // 默认颜色方案（修改部分）
        const defaultColors = d3.schemeTableau10; // 使用D3内置的10色方案
        const groupIndex = groups.indexOf(group);
        return defaultColors[groupIndex % defaultColors.length] || colors.other.primary || "#999";

        // return defaultColors[group] || colors.other.primary || "#999";
    }
    
    // 获取描边颜色
    const getStrokeColor = () => {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length > 0) return colors.available_colors[0];
        return "#333333"; // 默认颜色
    };
    
    
    
    // ---------- 10. 绘制图表 ----------
    // 为每个组创建一个分组
    groups.forEach((group, groupIndex) => {
        // 计算该组的垂直位置
        const groupStartY = groupIndex * (groupHeight);
        
        // Create a group element for the label and its background
        const groupLabelGroup = g.append("g")
            .attr("transform", `translate(0, ${groupStartY - 10})`);
        
        // Create a temporary hidden text to measure dimensions
        const tempText = groupLabelGroup.append("text")
            .style("visibility", "hidden")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(group);
        
        // Get the text dimensions
        const textWidth = tempText.node().getBBox().width;
        const textHeight = tempText.node().getBBox().height;
        tempText.remove(); // Remove the temporary text
        
        // Add padding for the rectangle
        const rectPadding = { x: 4, y: 2 };
        const shadowOffset = { x: 3, y: 3 }; // Shadow offset
        
        // Create rectangle dimensions
        const rectX = -margin.left;
        const rectY = -textHeight/2 - rectPadding.y;
        const rectWidth = textWidth + rectPadding.x * 2 ;
        const rectHeight = textHeight + rectPadding.y * 2;
        const cornerRadius = rectPadding.y*2;

        // Create a path for a rectangle with rounded right corners
        const createRoundedRectPath = (x, y, width, height, radius) => {
            return [
                `M ${x} ${y}`,                                        // Start at top-left
                `H ${x + width - radius}`,                           // Line to top-right minus corner radius
                `Q ${x + width} ${y} ${x + width} ${y + radius}`,    // Top-right corner
                `V ${y + height - radius}`,                          // Line to bottom-right minus corner radius
                `Q ${x + width} ${y + height} ${x + width - radius} ${y + height}`,  // Bottom-right corner
                `H ${x}`,                                            // Line to bottom-left
                `V ${y}`,                                            // Line to top-left
                'Z'                                                  // Close path
            ].join(' ');
        };

        // Create the shadow rectangle
        const shadowPath = createRoundedRectPath(
            rectX + shadowOffset.x, 
            rectY + shadowOffset.y, 
            rectWidth, 
            rectHeight, 
            cornerRadius
        );
        
        groupLabelGroup.append("path")
            .attr("d", shadowPath)
            .attr("fill", "#cccccc"); // Gray shadow color
        
        // Create the main white rectangle
        const mainPath = createRoundedRectPath(rectX, rectY, rectWidth, rectHeight, cornerRadius);
        
        groupLabelGroup.append("path")
            .attr("d", mainPath)
            .attr("fill", "#ffffff"); // White background color
        
        // Add the label text LAST so it's on top
        groupLabelGroup.append("text")
            .attr("x", -margin.left + 10)     // Position text 10px from left margin
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")     // Left-align text
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", "#000000")         // Black text color
            .text(group);
        
        // 筛选该组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        // 为每个维度绘制条形
        dimensions.forEach((dimension, dimIndex) => {
            // 查找数据点
            const dataPoint = groupData.find(d => d[dimensionField] === dimension);
            
            if (dataPoint) {
                // 条形的垂直位置
                const barY = groupStartY + dimIndex * barHeight;
                
                // 条形宽度
                const barWidth = xScale(+dataPoint[valueField]);
                
                // 创建标签和图标组
                const labelGroup = g.append("g")
                    .attr("transform", `translate(0, ${barY + barHeight/2})`);
                
                
                
                // 绘制维度标签（右对齐，与图标的左边缘对齐）
                labelGroup.append("text")
                    .attr("x",  - 5) // 左侧5像素
                    .attr("y", 0)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end") // 右对齐
                    .style("font-family", typography.label.font_family)
                    .style("font-size", typography.label.font_size)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", colors.text_color || "#333")
                    .text(dimension);
                
                // 绘制条形
                g.append("rect")
                    .attr("x", 0)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", actualBarHeight) // 略小于计算高度，留出间距
                    .attr("fill", variables.has_gradient ? 
                        `url(#gradient-${group.replace(/\s+/g, '-').toLowerCase()})` : 
                        getGroupColor(group))
                    .attr("rx", variables.has_rounded_corners ? 3 : 0)
                    .attr("ry", variables.has_rounded_corners ? 3 : 0)
                    .style("stroke", variables.has_stroke ? getStrokeColor() : "none")
                    .style("stroke-width", variables.has_stroke ? 1 : 0)
                    .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
                    .on("mouseover", function() {
                        d3.select(this).attr("opacity", 0.8);
                    })
                    .on("mouseout", function() {
                        d3.select(this).attr("opacity", 1);
                    });
                
                // 绘制数值标签（附加单位，如果有）
                const formattedValue = valueUnit ? 
                    `${dataPoint[valueField]}${valueUnit}` : 
                    `${dataPoint[valueField]}`;
                
                // 创建临时文本元素来计算数值文本的宽度
                const tempText = g.append("text")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(18,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("visibility", "hidden")
                    .text(formattedValue);
                
                // 获取文本宽度
                const textWidth = tempText.node().getBBox().width;
                
                // 删除临时文本
                tempText.remove();
                
                // 检查文本是否适合条形的宽度（考虑内边距）
                const padding = 3; // 每侧5px内边距
                
                // 如果条形太窄，无法容纳文本，则放在条形外部
                if (barWidth < textWidth + padding) {
                    g.append("text")
                        .attr("x", barWidth + 5) // 条形右侧5像素处
                        .attr("y", barY + actualBarHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("fill", colors.text_color || "#333") 
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${Math.min(18,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("pointer-events", "none")
                        .text(formattedValue);
                } else {
                    // 文本适合放在条形内部
                    g.append("text")
                        .attr("x", barWidth - 5)
                        .attr("y", barY + actualBarHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "end")
                        .style("fill", "#ffffff") 
                        .style("font-family", typography.annotation.font_family)
                        .style("font-size", `${Math.min(18,Math.max(barHeight * 0.5, parseFloat(typography.annotation.font_size)))}px`)
                        .style("font-weight", typography.annotation.font_weight)
                        .style("pointer-events", "none")
                        .text(formattedValue);
                }
            }
        });
    });
    
    return svg.node();
}

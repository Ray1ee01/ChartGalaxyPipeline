/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "overlay",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 使用D3.js创建简单的垂直条形图
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data || [];          // 图表数据
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333", 
        other: { primary: "#73D2C7", secondary: "#4682B4" } 
    };
    const images = jsonData.images || { field: {}, other: {} };  // 图片(标志等)
    const dataColumns = jsonData.data.columns || [];            // 数据列
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表尺寸和边距
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 边距: 上, 右, 下, 左
    const margin = { 
        top: 60,         // 柱子上方数值标签的空间
        right: 30, 
        bottom: 150,     // x轴和图标的空间
        left: 60
    };
    
    // 计算实际图表区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    
    let xField, yField;
    let xUnit = "", yUnit = "";
    
    // 安全提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    
    // 获取字段单位(如果存在)
    if (xColumn && xColumn.unit && xColumn.unit !== "none") {
        xUnit = xColumn.unit;
    }
    
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        yUnit = yColumn.unit;
    }
    
    // 数值单位规范
    // 添加数值格式化函数
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
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一的x轴值
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    
    // 创建按y值降序排序的数据
    const sortedData = chartData.map(d => ({
        x: d[xField],
        y: +d[yField] // 确保y是数值类型
    })).sort((a, b) => b.y - a.y);
    
    // ---------- 5. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    
    
    // ---------- 6. 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 获取颜色函数
    const getColor = () => colors.other.primary;
    
    // 如果需要创建阴影滤镜
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
    
    // 如果需要创建渐变
    if (variables.has_gradient) {
        sortedData.forEach((item, idx) => {
            // 添加安全的ID处理
            const safeCategory = typeof item.x === 'string' ? 
                item.x.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                `category-${idx}`;
            
            const baseColor = getColor();
            const gradientId = `gradient-${safeCategory}`;
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "0%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.1));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.1));
        });
    }
    
    // ---------- 7. 创建图表 ----------
    
    // 创建图表组
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建比例尺
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d.x))
        .range([0, innerWidth])
        .padding(variables.has_spacing ? 0.4 : 0.2);
    
    const yMax = d3.max(sortedData, d => d.y);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 1]) // 处理y都为0的情况，并添加10%的填充
        .range([innerHeight, 0]);
    
    // *******************************************************************
    // ** 开始修改：预计算标签字体大小和最大行数 **
    // *******************************************************************
    const defaultLabelFontSize = parseFloat(typography.label.font_size || 12);
    const minLabelFontSize = 10; // 最小字体大小
    const currentBarWidth = xScale.bandwidth(); // 使用实际的bar宽度
    let finalLabelFontSize = defaultLabelFontSize;
    let maxLinesNeeded = 1; // 记录所有标签所需的最大行数
    const labelFontFamily = typography.label.font_family || "Arial";
    const labelFontWeight = typography.label.font_weight || "normal";
    const lineHeightFactor = 1.2; // 行高倍数

    // 文本宽度测量辅助函数 (使用 canvas 提高性能)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // 第一遍计算：确定统一的字体大小
    if (currentBarWidth > 0) { // 确保 barWidth 有效
        let maxRatio = 1;
        sortedData.forEach(d => {
            const labelText = String(d.x); // 确保是字符串
            const textWidth = getTextWidthCanvas(labelText, labelFontFamily, defaultLabelFontSize, labelFontWeight);
            const ratio = textWidth / currentBarWidth;
            if (ratio > maxRatio) {
                maxRatio = ratio;
            }
        });

        if (maxRatio > 1) {
            finalLabelFontSize = Math.max(minLabelFontSize, Math.floor(defaultLabelFontSize / maxRatio));
        }

        // 第二遍计算：确定是否需要换行以及最大行数 (使用最终字体大小)
        sortedData.forEach(d => {
            const labelText = String(d.x);
            const textWidth = getTextWidthCanvas(labelText, labelFontFamily, finalLabelFontSize, labelFontWeight);

            if (textWidth > currentBarWidth) {
                // 模拟换行计算行数
                const words = labelText.split(/\s+/); // 按空格分词
                let currentLine = '';
                let lines = 1;
                let simulationSuccess = false; // 标记模拟是否成功

                if (words.length > 1) { // 优先按单词换行
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        const testWidth = getTextWidthCanvas(testLine, labelFontFamily, finalLabelFontSize, labelFontWeight);
                        if (testWidth > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = words[i];
                            // 检查单个单词是否也超长
                            if (getTextWidthCanvas(currentLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth) {
                                // 单个单词超长，需要转字符换行
                                simulationSuccess = false;
                                break; // 退出单词循环
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                     if(currentLine !== '') simulationSuccess = true; // 如果有剩余单词则标记成功

                }

                // 如果单词换行不成功或只有一个单词，尝试字符换行
                if(words.length <= 1 || !simulationSuccess) {
                    lines = 1; // 重置行数
                    const chars = labelText.split('');
                    currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (getTextWidthCanvas(testLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth && currentLine !== '') {
                            lines++;
                            currentLine = chars[i];
                        } else {
                            currentLine += chars[i];
                        }
                    }
                }


                if (lines > maxLinesNeeded) {
                    maxLinesNeeded = lines;
                }
            }
        });
    } else {
        // 如果barWidth无效，则使用默认字体大小且不换行
        finalLabelFontSize = defaultLabelFontSize;
        maxLinesNeeded = 1;
    }
    // *******************************************************************
    // ** 结束修改：预计算标签字体大小和最大行数 **
    // *******************************************************************

    // *******************************************************************
    // ** 开始修改：计算图标的统一Y位置 **
    // *******************************************************************
    const labelStartY = innerHeight + 10; // 标签开始的 Y 位置 (保持和原来一致)
    const lineHeight = finalLabelFontSize * lineHeightFactor; // 行高
    const labelBottomApprox = labelStartY + (maxLinesNeeded - 1) * lineHeight + finalLabelFontSize * 0.71; // 估算最下方标签基线位置
    const iconRadius = 15; // 图标半径
    const iconYPosition = labelBottomApprox + iconRadius + 5; // 在标签下方留出 5px 间距放置图标中心
    const iconBottomY = iconYPosition + iconRadius; // 图标底部的Y坐标
    const barExtensionBuffer = 5; // 柱子比图标底部多延伸的距离
    const barBottomY = iconBottomY + barExtensionBuffer; // 柱子需要延伸到的最终Y坐标
    // *******************************************************************
    // ** 结束修改：计算图标的统一Y位置 **
    // *******************************************************************

    // 添加延伸到图标的柱子
    chart.selectAll(".bar")
        .data(sortedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.x))
        .attr("y", d => yScale(d.y))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, barBottomY - yScale(d.y)))
        .attr("fill", d => {
            if (variables.has_gradient) {
                const safeCategory = typeof d.x === 'string' ? 
                    d.x.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                    `category-${sortedData.findIndex(item => item.x === d.x)}`; // 修正: 使用 findIndex 确保唯一性
                return `url(#gradient-${safeCategory})`;
            } 
            return getColor();
        })
        .attr("rx", variables.has_rounded_corners ? 4 : 0)
        .attr("ry", variables.has_rounded_corners ? 4 : 0)
        .style("stroke", variables.has_stroke ? "#333" : "none")
        .style("stroke-width", variables.has_stroke ? 1 : 0)
        .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
        });
    
    // 在柱子上方添加数值标签
    const defaultAnnotationFontSize = parseFloat(typography.annotation.font_size || 12);
    const minAnnotationFontSize = 6; // 数值标签最小字体
    const annotationFontFamily = typography.annotation.font_family || "Arial";
    const annotationFontWeight = typography.annotation.font_weight || "bold";

    chart.selectAll(".value-label")
        .data(sortedData)
        .enter()
        .append("text")
        .attr("class", "value-label")
        .attr("x", d => xScale(d.x) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.y) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", annotationFontFamily)
        .style("font-weight", annotationFontWeight)
        .style("fill", colors.text_color || "#333333")
        .each(function(d) {
            const valueText = formatValue(d.y) + (yUnit ? ` ${yUnit}` : "");
            const maxWidth = xScale.bandwidth() * 1.1; // 最大允许宽度为柱宽的1.1倍
            let finalValueFontSize = defaultAnnotationFontSize;

            if (maxWidth > 0) { // 仅当宽度有效时计算
                const textWidth = getTextWidthCanvas(valueText, annotationFontFamily, defaultAnnotationFontSize, annotationFontWeight);
                if (textWidth > maxWidth) {
                    finalValueFontSize = Math.max(minAnnotationFontSize, Math.floor(defaultAnnotationFontSize * (maxWidth / textWidth)));
                }
            }

            d3.select(this)
                .style("font-size", `${finalValueFontSize}px`)
                .text(valueText);
        });
    
    
    // *******************************************************************
    // ** 开始修改：添加维度标签 (统一字体大小，自动换行) **
    // *******************************************************************
    chart.selectAll(".dimension-label")
        .data(sortedData)
        .enter()
        .append("text")
        .attr("class", "dimension-label")
        .attr("text-anchor", "middle")
        .style("font-family", labelFontFamily)
        .style("font-size", `${finalLabelFontSize}px`) // 应用预计算的字体大小
        .style("font-weight", labelFontWeight)
        .style("fill", "#ffffff") // 使用默认文本颜色
        .each(function(d) {
            const labelText = String(d.x);
            const textWidth = getTextWidthCanvas(labelText, labelFontFamily, finalLabelFontSize, labelFontWeight);
            const textElement = d3.select(this);
            const xPos = xScale(d.x) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();

            if (textWidth > availableWidth && availableWidth > 0) {
                // 需要换行 (重复之前的换行逻辑来渲染)
                const words = labelText.split(/\s+/);
                let lines = [];
                let currentLine = '';
                let simulationSuccess = false;

                if(words.length > 1){
                     for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        const testWidth = getTextWidthCanvas(testLine, labelFontFamily, finalLabelFontSize, labelFontWeight);
                        if (testWidth > availableWidth && currentLine !== '') {
                            lines.push(currentLine);
                            currentLine = words[i];
                            if (getTextWidthCanvas(currentLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > availableWidth) {
                                simulationSuccess = false; break;
                            }
                        } else { currentLine = testLine; }
                    }
                    if(currentLine !== '') { lines.push(currentLine); simulationSuccess = true; }
                }
                 if(words.length <= 1 || !simulationSuccess) {
                    lines = [];
                    const chars = labelText.split('');
                    currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (getTextWidthCanvas(testLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine); currentLine = chars[i];
                        } else { currentLine += chars[i]; }
                    }
                     lines.push(currentLine);
                 }

                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", labelStartY + i * lineHeight)
                        .attr("dy", "0.71em")
                        .text(line);
                });
            } else {
                // 不需要换行
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", labelStartY)
                   .attr("dy", "0.71em")
                   .text(labelText);
            }
        });
    // *******************************************************************
    // ** 结束修改：添加维度标签 **
    // *******************************************************************


    // *******************************************************************
    // ** 开始修改：添加圆形图标 - 动态调整 Y 位置 **
    // *******************************************************************
    chart.selectAll(".icon-circle")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", "icon-circle")
        .attr("transform", d => `translate(${xScale(d.x) + xScale.bandwidth() / 2}, ${iconYPosition})`) // 应用动态Y位置
        .each(function(d) {
            // 添加圆形轮廓
            d3.select(this)
                .append("circle")
                .attr("r", iconRadius) // 使用变量
                .attr("fill", "none") // 无填充
                .attr("stroke", "#2D3748") // 更深灰色的描边
                .attr("stroke-width", 0.1);
            
            // 如果有该类别的图像
            if (images && images.field && images.field[d.x]) {
                d3.select(this)
                    .append("image")
                    .attr("xlink:href", images.field[d.x])
                    .attr("x", -12)
                    .attr("y", -12)
                    .attr("width", 24)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("height", 24);
            }
        });
    // *******************************************************************
    // ** 结束修改：添加圆形图标 **
    // *******************************************************************


    // 返回SVG节点
    return svg.node();
}
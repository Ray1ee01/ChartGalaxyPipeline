/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_08",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
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
    
    
    // *** BEGIN ADDITION: Define vertical gradient per category ***
    sortedData.forEach((item, idx) => {
        const dimension = item.x;
        let barColor = colors.other.primary; // Default color
        if (colors.field && colors.field[dimension]) {
            barColor = colors.field[dimension]; // Use specific color if available
        }

        // Create safe ID for the gradient
        const safeCategory = typeof dimension === 'string' ?
            dimension.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() :
            `category-${idx}`;
        const gradientId = `gradient-${safeCategory}`;

        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "100%") // Bottom
            .attr("x2", "0%")
            .attr("y2", "0%");  // Top

        // Darker color at the bottom
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(barColor).darker(0.5)); // Adjust factor as needed

        // Lighter color at the top
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(barColor).brighter(0.5)); // Adjust factor as needed
    });
    // *** END ADDITION ***

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
    
    // 文本宽度测量辅助函数 (使用 canvas 提高性能)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // 计算字体大小的函数，确保文本在指定宽度内
    const calculateFontSize = (text, maxWidth, baseSize = 14) => {
        // 检查参数是否有效
        if (!text || typeof text !== 'string' || !maxWidth || maxWidth <= 0 || !baseSize || baseSize <= 0) {
            return Math.max(10, baseSize || 14); // 返回一个合理的默认值或最小尺寸
        }
        
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        
        // 否则，按比例缩小字体大小，确保不小于10
        return Math.max(10, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // 文本换行辅助函数 (添加 alignment 参数)
    function wrapText(textElement, str, width, lineHeight = 1.1, alignment = 'middle') {
        const words = str.split(/\s+/).reverse(); // 按空格分割单词
        let word;
        let line = [];
        let lineNumber = 0;
        const initialY = parseFloat(textElement.attr("y")); // 获取原始y坐标
        const initialX = parseFloat(textElement.attr("x")); // 获取原始x坐标
        // const actualFontSize = parseFloat(textElement.style("font-size")); // 获取实际应用的字体大小

        textElement.text(null); // 清空现有文本

        let tspans = []; // 存储最终要渲染的行

        // 优先按单词换行
        if (words.length > 1) {
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = textElement.append("tspan").text(currentLine.join(" ")); // 创建临时tspan测试宽度
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove(); // 移除临时tspan

                if (isOverflow && currentLine.length > 1) {
                    currentLine.pop(); // 回退一个词
                    tspans.push(currentLine.join(" ")); // 添加完成的行
                    currentLine = [word]; // 新行以当前词开始
                    lineNumber++;
                }
            }
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine.join(" "));
            }
        } else { // 如果没有空格或只有一个词，则按字符换行
            const chars = str.split('');
            let currentLine = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLine = currentLine + chars[i];
                const tempTspan = textElement.append("tspan").text(nextLine); // 测试宽度
                const isOverflow = tempTspan.node().getComputedTextLength() > width;
                tempTspan.remove();

                if (isOverflow && currentLine.length > 0) { // 如果加了新字符就超长了，并且当前行不为空
                    tspans.push(currentLine); // 添加当前行
                    currentLine = chars[i]; // 新行从这个字符开始
                    lineNumber++;
                } else {
                    currentLine = nextLine; // 没超长就继续加字符
                }
            }
            // 添加最后一行
            if (currentLine.length > 0) {
                tspans.push(currentLine);
            }
        }

        // 计算总行数
        const totalLines = tspans.length;
        let startDy = 0;
        
        // 根据对齐方式计算起始偏移
        if (alignment === 'middle') {
             // 垂直居中：向上移动半行*(总行数-1)
            startDy = -( (totalLines - 1) * lineHeight / 2);
        } else if (alignment === 'bottom') {
            // 底部对齐：计算总高度，向上移动 总高度 - 单行高度(近似)
            const totalHeightEm = totalLines * lineHeight;
            startDy = -(totalHeightEm - lineHeight); // 将底部对齐到原始y
        }
        // 如果是 'top' 对齐，startDy 保持为 0，即第一行基线在原始y位置

        // 创建所有行的tspan元素
        tspans.forEach((lineText, i) => {
            textElement.append("tspan")
                .attr("x", initialX) // x坐标与父<text>相同
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em") // 第一行应用起始偏移，后续行应用行高
                .text(lineText);
        });
        // 保存实际行数
        textElement.attr("data-lines", totalLines);
    }

    // 预计算标签字体大小和最大行数
    const defaultLabelFontSize = parseFloat(typography.label.font_size || 12);
    const baseFontSize = defaultLabelFontSize;
    const labelFontFamily = typography.label.font_family || "Arial";
    const labelFontWeight = typography.label.font_weight || "normal";
    const labelLineHeight = 1.2; // 行高倍数

    let maxLinesOverall = 0;
    let uniformFontSize = baseFontSize;

    // 第一遍：计算统一字体大小
    const longestLabel = sortedData.reduce((a, b) => String(a.x).length > String(b.x).length ? a : b, {x:""}).x;
    const labelMaxWidth = xScale.bandwidth() * 0.9;
    uniformFontSize = calculateFontSize(String(longestLabel), labelMaxWidth, baseFontSize);

    // 第二遍：使用统一字体大小计算每个标签的实际行数，并找出最大行数
    sortedData.forEach(d => {
        const tempText = svg.append("text") // 临时创建text用于调用wrapText
            .attr("x", -1000) // 移出可视区
            .attr("y", -1000)
            .style("font-size", `${uniformFontSize}px`)
            .style("font-family", labelFontFamily)
            .style("font-weight", labelFontWeight);
        
        wrapText(tempText, String(d.x), xScale.bandwidth(), labelLineHeight, 'top');
        const lines = parseInt(tempText.attr("data-lines") || 1);
        if (lines > maxLinesOverall) {
            maxLinesOverall = lines;
        }
        tempText.remove(); // 移除临时text元素
    });

    // 计算维度标签的起始Y位置和水平线的Y位置
    const labelBaselineFirstLineY = innerHeight + 22; // 维度标签第一行基线的Y位置 (原为 innerHeight + 20)
    const paddingBarToLabelTop = 3; // Bar底部到标签顶部的额外间距
    // horizontalLineY 现在基于标签顶部加上额外间距
    const horizontalLineY = labelBaselineFirstLineY - (uniformFontSize * 0.8) - paddingBarToLabelTop; // uniformFontSize * 0.8 估算升部高度

    // 计算图标的统一Y位置
    // 计算标签块的底部Y坐标
    const bottomOfLabelBlockY = labelBaselineFirstLineY + (maxLinesOverall - 1) * uniformFontSize * labelLineHeight + uniformFontSize * 0.25; // 0.25 估算降部高度
    const iconRadius = 12; // 图标的半径或半尺寸 (假设图标是24x24)
    const iconPaddingFromLabel = 2; // 图标与最下方标签的间距 (原为5)
    const iconCenterY = bottomOfLabelBlockY + iconPaddingFromLabel + iconRadius;

    // 添加水平线 (作为柱子底部和标签顶部参考)
    chart.append("line")
        .attr("x1", 0)
        .attr("y1", horizontalLineY)
        .attr("x2", innerWidth)
        .attr("y2", horizontalLineY)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 1);

    // 添加柱子 (修改高度和Y值，使其底部在horizontalLineY)
    chart.selectAll(".bar")
        .data(sortedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d.x))
        .attr("width", xScale.bandwidth())
        .attr("y", d => yScale(d.y)) // Y值由yScale决定 (顶部)
        .attr("height", d => Math.max(0, horizontalLineY - yScale(d.y))) // 高度延伸到水平线
        .attr("fill", d => {
             const dimension = d.x;
             const safeCategory = typeof dimension === 'string' ?
                dimension.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() :
                `category-${sortedData.findIndex(item => item.x === dimension)}`;
             const gradientId = `gradient-${safeCategory}`;
             return `url(#${gradientId})`;
        })
        .attr("rx", 4) 
        .attr("ry", 4) 
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
            const valueText = formatValue(d.y) + (yUnit ? ` ${yUnit}` : '');
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
    
    // 添加维度标签 (使用新的wrapText和统一的Y位置)
    chart.selectAll(".dimension-label")
        .data(sortedData)
        .enter()
        .append("text")
        .attr("class", "dimension-label")
        .attr("x", d => xScale(d.x) + xScale.bandwidth() / 2)
        .attr("y", labelBaselineFirstLineY) // 统一的起始Y (使用新的变量名)
        .attr("text-anchor", "middle")
        .style("font-family", labelFontFamily)
        .style("font-size", `${uniformFontSize}px`)
        .style("font-weight", labelFontWeight)
        .style("fill", colors.text_color || "#333333") // 使用默认文本颜色
        .each(function(d) {
            wrapText(d3.select(this), String(d.x), xScale.bandwidth(), labelLineHeight, 'top');
        });

    // 添加图标 (统一Y位置)
    chart.selectAll(".icon-group")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", "icon-group")
        .attr("transform", d => `translate(${xScale(d.x) + xScale.bandwidth() / 2}, ${iconCenterY})`) // 应用统一的Y位置
        .each(function(d) {
            if (images && images.field && images.field[d.x]) {
                d3.select(this)
                    .append("image")
                    .attr("xlink:href", images.field[d.x])
                    .attr("x", -iconRadius) // 基于iconRadius调整
                    .attr("y", -iconRadius) // 基于iconRadius调整
                    .attr("width", iconRadius * 2)
                    .attr("height", iconRadius * 2)
                    .attr("preserveAspectRatio","xMidYMid meet");
            }
        });

    // 返回SVG节点
    return svg.node();
}
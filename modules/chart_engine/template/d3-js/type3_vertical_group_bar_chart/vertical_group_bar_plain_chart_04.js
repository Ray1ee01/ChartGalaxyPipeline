/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Grouped Bar Chart",
    "chart_name": "vertical_group_bar_plain_chart_04",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 5], [0, "inf"], [2, 3]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

/* ───────── 代码主体 ───────── */
function makeChart(containerSelector, dataJSON) {

    /* ============ 1. 字段检查 ============ */
    const cols = dataJSON.data.columns || [];
    const xField = cols.find(c=>c.role==="x")?.name;
    const yField = cols.find(c=>c.role==="y")?.name;
    const groupField = cols.find(c=>c.role==="group")?.name;
    const yUnit = cols.find(c=>c.role==="y")?.unit === "none" ? "" : cols.find(c=>c.role==="y")?.unit ?? "";
    if(!xField || !yField || !groupField){
        d3.select(containerSelector).html('<div style="color:red">缺少必要字段</div>');
        return;
    }

    const raw = dataJSON.data.data.filter(d=>+d[yField]>0);
    if(!raw.length){
        d3.select(containerSelector).html('<div>无有效数据</div>');
        return;
    }

    /* ============ 2. 尺寸与比例尺 ============ */
    const fullW = dataJSON.variables?.width  || 600;
    const fullH = dataJSON.variables?.height || 400;
    const margin = { top: 80, right: 40, bottom: 80, left: 40 }; // 边距调整，增加底部和顶部空间
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 获取主颜色
    const primaryColor = dataJSON.colors?.other?.primary || "#C13C37"; // 默认为红色

    // 数据处理
    // 获取所有唯一的x值和group值
    const xValues = Array.from(new Set(raw.map(d => d[xField])));
    const groupValues = Array.from(new Set(raw.map(d => d[groupField])));
    
    // 计算每个分组的最大值，用于比例尺
    const maxValue = d3.max(raw, d => +d[yField]); 

    // 计算分组间距和条形宽度
    const xGroupScale = d3.scaleBand()
        .domain(xValues)
        .range([0, W])
        .padding(0.2);
        
    const xBarScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, xGroupScale.bandwidth()])
        .padding(0.1);
    
    // 高度比例尺，留出上方空间给数值标签
    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([H, 50]);
    
    /* ============ 3. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    
    // 创建 SVG 画布
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%") // 宽度占满容器
        .attr("height", fullH) // 高度固定
        .attr("viewBox", `0 0 ${fullW} ${fullH}`) // 设置视窗
        .attr("preserveAspectRatio", "xMidYMid meet") // 保持宽高比
        .style("max-width", "100%") // 最大宽度
        .style("height", "auto") // 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建阴影效果滤镜
    const defs = svg.append("defs");
    const shadowFilter = defs.append("filter")
        .attr("id", "bar-shadow")
        .attr("width", "150%")
        .attr("height", "150%");
        
    // 添加阴影效果
    shadowFilter.append("feDropShadow")
        .attr("dx", "2") // 水平偏移
        .attr("dy", "2") // 垂直偏移
        .attr("stdDeviation", "2") // 模糊度
        .attr("flood-color", "rgba(0,0,0,0.3)") // 阴影颜色
        .attr("flood-opacity", "0.4"); // 阴影不透明度

    // 创建主绘图区域 <g> 元素，应用边距
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    /* ---- 文本和样式设置 ---- */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSize = parseFloat(dataJSON.typography?.annotation?.font_size || '12'); // 数值标签字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSize = 11;
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    
    // 辅助函数 - 使用canvas测量文本宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

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

    // 文本分行辅助函数
    function splitTextIntoLines(text, fontFamily, fontSize, maxWidth, fontWeight) {
        if (!text) return [""];
        
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";
        
        // 如果单词很少，可能是中文或者其他不使用空格分隔的语言
        if (words.length <= 2 && text.length > 5) {
            // 按字符分割
            const chars = text.split('');
            currentLine = chars[0] || "";
            
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i];
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
        } else {
            // 按单词分割
            currentLine = words[0] || "";
            
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
        }
        
        return lines;
    }
    
    // 专门用于数值标签的文本分行函数
    function splitValueTextIntoLines(text, fontFamily, fontSize, fontWeight, maxWidthForSplit) {
        if (!text) return [""];
        const lines = [];
        if (maxWidthForSplit <= 0) return [text]; // 防止条形宽度过小导致问题

        let currentLine = "";
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const testLine = currentLine + char;
            if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidthForSplit) {
                currentLine = testLine;
            } else {
                if (currentLine === "") { // 当前字符本身就超出宽度
                    lines.push(char);
                    // currentLine 保持为空，因为这个字符自成一行
                } else {
                    lines.push(currentLine);
                    currentLine = char; // 新行以当前字符开始
                }
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        // 如果没有产生任何行，确保返回包含原始文本的一行
        return lines.length > 0 ? lines : (text ? [text] : [""]);
    }
    
    // 创建轴线（基准线）
    g.append("line")
        .attr("x1", 0)
        .attr("y1", H)
        .attr("x2", W)
        .attr("y2", H)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // 创建圆角三角形路径的辅助函数
    function createRoundedTrianglePath(topPoint, leftPoint, rightPoint, radius) {
        // 计算每个顶点的单位向量方向
        function calculateUnitVector(p1, p2) {
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const length = Math.sqrt(dx * dx + dy * dy);
            return [dx / length, dy / length];
        }
        
        // 顶点间的向量
        const top_left = calculateUnitVector(topPoint, leftPoint);
        const left_right = calculateUnitVector(leftPoint, rightPoint);
        const right_top = calculateUnitVector(rightPoint, topPoint);
        
        // 计算圆角起始点
        const topLeftStart = [
            topPoint[0] + top_left[0] * radius, 
            topPoint[1] + top_left[1] * radius
        ];
        const leftRightStart = [
            leftPoint[0] + left_right[0] * radius, 
            leftPoint[1] + left_right[1] * radius
        ];
        const rightTopStart = [
            rightPoint[0] + right_top[0] * radius, 
            rightPoint[1] + right_top[1] * radius
        ];
        
        // 计算圆角结束点
        const topRightEnd = [
            topPoint[0] + right_top[0] * radius * -1, 
            topPoint[1] + right_top[1] * radius * -1
        ];
        const leftTopEnd = [
            leftPoint[0] + top_left[0] * radius * -1, 
            leftPoint[1] + top_left[1] * radius * -1
        ];
        const rightLeftEnd = [
            rightPoint[0] + left_right[0] * radius * -1, 
            rightPoint[1] + left_right[1] * radius * -1
        ];
        
        // 构建圆角三角形的路径
        return `
            M ${topLeftStart[0]},${topLeftStart[1]}
            L ${leftTopEnd[0]},${leftTopEnd[1]}
            A ${radius},${radius} 0 0 0 ${leftRightStart[0]},${leftRightStart[1]}
            L ${rightLeftEnd[0]},${rightLeftEnd[1]}
            A ${radius},${radius} 0 0 0 ${rightTopStart[0]},${rightTopStart[1]}
            L ${topRightEnd[0]},${topRightEnd[1]}
            A ${radius},${radius} 0 0 0 ${topLeftStart[0]},${topLeftStart[1]}
            Z
        `;
    }

    // 检查x轴标签的宽度，决定是否旋转
    const shouldRotateLabels = xValues.some(x => {
        const width = getTextWidth(x, categoryFontFamily, categoryFontSize, categoryFontWeight);
        return width > xGroupScale.bandwidth() * 0.8;
    });

    // 绘制x轴标签
    xValues.forEach(x => {
        const xPos = xGroupScale(x) + xGroupScale.bandwidth() / 2;
        
        if (shouldRotateLabels) {
            g.append("text")
                .attr("class", "x-axis-label")
                .attr("text-anchor", "end")
                .attr("x", xPos)
                .attr("y", H + 10)
                .attr("transform", `rotate(-45, ${xPos}, ${H + 10})`)
                .style("font-family", categoryFontFamily)
                .style("font-size", `${categoryFontSize}px`)
                .style("font-weight", categoryFontWeight)
                .style("fill", "#333")
                .text(x);
        } else {
            // 如果标签太长，分行显示
            const maxWidth = xGroupScale.bandwidth() * 0.9;
            const lines = splitTextIntoLines(x, categoryFontFamily, categoryFontSize, maxWidth, categoryFontWeight);
            const lineHeight = categoryFontSize * 1.2;
            
            lines.forEach((line, i) => {
                g.append("text")
                    .attr("class", "x-axis-label")
                    .attr("text-anchor", "middle")
                    .attr("x", xPos)
                    .attr("y", H + 15 + i * lineHeight)
                    .style("font-family", categoryFontFamily)
                    .style("font-size", `${categoryFontSize}px`)
                    .style("font-weight", categoryFontWeight)
                    .style("fill", "#333")
                    .text(line);
            });
        }
    });

    // 绘制每个分组下的条形
    xValues.forEach(x => {
        groupValues.forEach(group => {
            // 查找对应的数据点
            const dataPoint = raw.find(d => d[xField] === x && d[groupField] === group);
            if (!dataPoint) return; // 跳过没有数据的组合
            
            const value = +dataPoint[yField];
            if (value <= 0) return; // 跳过0或负值
            
            // 获取对应group的颜色，如果没有则使用主颜色
            const color = dataJSON.colors?.field?.[group] || primaryColor;
            
            // 计算条形位置和尺寸
            const barX = xGroupScale(x) + xBarScale(group);
            const barY = yScale(value);
            const barHeight = H - barY;
            const barWidth = xBarScale.bandwidth();
            const barMidX = barX + barWidth / 2;
            
            // 创建三角形路径坐标
            const cornerRadius = 4; // 圆角半径
            const trianglePath = createRoundedTrianglePath(
                [barMidX, barY],                // 顶点（上）
                [barX, H],                      // 左下角
                [barX + barWidth, H],           // 右下角
                cornerRadius
            );
            
            // 绘制三角形
            g.append("path")
                .attr("class", "bar")
                .attr("d", trianglePath)
                .attr("fill", color)
                .attr("fill-opacity", 0.7) // 设置透明度
                .attr("filter", "url(#bar-shadow)");
                
            // 添加数值标签 - 修改为始终在条形上方
            const formattedValue = formatValue(value);
            const valText = `${formattedValue}${yUnit}`;
            
            // 使用条形宽度作为文本换行的最大宽度
            const maxTextWidth = barWidth - 4;
            const lines = splitValueTextIntoLines(valText, valueFontFamily, valueFontSize, valueFontWeight, maxTextWidth);
            
            const actualLineHeight = valueFontSize * 1.2; // 每行文本的估计高度 (包括行间距)
            const wrappedLabelHeight = lines.length * actualLineHeight;
            
            // 计算标签位置 - 始终在条形上方
            const labelAboveBarBottomMargin = 4; // 标签底部与条形顶部的间距
            
            // 计算第一行文本中心点的Y坐标
            // 确保最后一行文本的底部与条形顶部有一定间距
            const startYForFirstLineCenter = barY - labelAboveBarBottomMargin - wrappedLabelHeight + actualLineHeight / 2;
            
            // 为上方的标签添加背景矩形以提高可读性
            const maxWrappedTextWidth = d3.max(lines, l => getTextWidth(l, valueFontFamily, valueFontSize, valueFontWeight)) || 0;
            if (maxWrappedTextWidth > 0) {
                const rectPadding = 3; // 内边距
                const bgRectWidth = Math.max(barWidth, maxWrappedTextWidth + rectPadding * 2); // 背景矩形宽度
                const bgRectHeight = wrappedLabelHeight + rectPadding; // 背景矩形高度
                
                // 背景矩形的Y坐标 (矩形顶部)
                const bgRectY = startYForFirstLineCenter - (actualLineHeight / 2) - rectPadding / 2;
                
                g.append("rect")
                    .attr("x", barMidX - bgRectWidth / 2) // 水平居中于条形
                    .attr("y", bgRectY)
                    .attr("width", bgRectWidth)
                    .attr("height", bgRectHeight)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("fill", "#fff")
                    .attr("fill-opacity", 0.9); // 背景稍微透明
            }
            
            // 绘制每一行文本
            lines.forEach((line, i) => {
                const textY = startYForFirstLineCenter + (i * actualLineHeight);
                g.append("text")
                    .attr("class", "value-label")
                    .attr("text-anchor", "middle")
                    .attr("x", barMidX)
                    .attr("y", textY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", valueFontFamily)
                    .style("font-size", `${valueFontSize}px`)
                    .style("font-weight", valueFontWeight)
                    .style("fill", color)
                    .text(line);
            });
        });
    });
    
    /* ============ 4. 添加动态图例 ============ */ // 支持图例换行并且居中，并且能够让图例刚好在chart上方
    if (groupValues && groupValues.length > 0) {
        const legendMarkerWidth = 12; // 图例标记宽度
        const legendMarkerHeight = 12; // 图例标记高度
        const legendMarkerRx = 3; // 图例标记圆角X
        const legendMarkerRy = 3; // 图例标记圆角Y
        const legendPadding = 6; // 图例标记和文本之间的间距
        const legendInterItemSpacing = 12; // 图例项之间的水平间距
        
        const legendFontFamily = dataJSON.typography?.label?.font_family || 'Arial'; // 图例字体
        const legendFontSize = parseFloat(dataJSON.typography?.label?.font_size || '11'); // 图例字号
        const legendFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 图例字重

        // 1. 准备图例项数据
        const legendItemsData = groupValues.map(group => {
            const text = String(group);
            const color = dataJSON.colors?.field?.[group] || primaryColor;
            const textWidth = getTextWidth(text, legendFontFamily, legendFontSize, legendFontWeight);
            // visualWidth 是单个图例项（标记+间距+文本）的实际显示宽度
            const visualWidth = legendMarkerWidth + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        // 2. 将图例项排列成行
        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0; // 当前行已占用的视觉宽度
        // 图例换行的可用宽度，基于图表主体绘图区 W
        const availableWidthForLegendWrapping = W; // W = fullW - margin.left - margin.right

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) { // 如果不是当前行的第一个元素，需要加上间距
                widthIfAdded += legendInterItemSpacing;
            }

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                // 当前行已满，将当前行数据存入 legendLines
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                // 开始新行
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth; // 新行的初始宽度
            } else {
                // 将元素添加到当前行
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendInterItemSpacing; // 添加元素间距
                }
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth; // 加上元素自身宽度
            }
        });

        // 添加最后一行（如果有）
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        // 3. 计算图例块的整体垂直位置
        if (legendLines.length > 0) {
            const itemMaxHeight = Math.max(legendMarkerHeight, legendFontSize); // 单行图例内容的最大高度
            const interLineVerticalPadding = 6; // 图例行之间的垂直间距
            const paddingBelowLegendToChart = 15; // 图例块底部与图表顶部的间距
            const minSvgGlobalTopPadding = 15; // SVG顶部到图例块的最小间距

            const totalLegendBlockHeight = legendLines.length * itemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
            
            let legendBlockStartY = margin.top - paddingBelowLegendToChart - totalLegendBlockHeight;
            legendBlockStartY = Math.max(minSvgGlobalTopPadding, legendBlockStartY); // 确保不超出SVG顶部

            const legendContainerGroup = svg.append("g").attr("class", "custom-legend-container");

            // 4. 渲染每一行图例
            let currentLineBaseY = legendBlockStartY; // 当前渲染行的顶部Y坐标
            legendLines.forEach((line) => {
                // 每一行在整个SVG中水平居中
                const lineRenderStartX = (fullW - line.totalVisualWidth) / 2;
                const lineCenterY = currentLineBaseY + itemMaxHeight / 2; // 用于文本垂直居中

                let currentItemDrawX = lineRenderStartX; // 当前图例项的起始X坐标

                line.items.forEach((item, itemIndex) => {
                    // 绘制图例标记 (矩形)
                    legendContainerGroup.append("rect")
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (itemMaxHeight - legendMarkerHeight) / 2) // 使标记在行高内垂直居中
                        .attr("width", legendMarkerWidth)
                        .attr("height", legendMarkerHeight)
                        .attr("rx", legendMarkerRx)
                        .attr("ry", legendMarkerRy)
                        .attr("fill", item.color)
                        .attr("fill-opacity", 0.85); // 与柱状图透明度协调或略作区分

                    // 绘制图例文本
                    legendContainerGroup.append("text")
                        .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding)
                        .attr("y", lineCenterY) // 文本基线对齐到行中心线
                        .attr("dominant-baseline", "middle") // 确保文本垂直居中
                        .style("font-family", legendFontFamily)
                        .style("font-size", `${legendFontSize}px`)
                        .style("font-weight", legendFontWeight)
                        .style("fill", "#333") // 保持与X轴标签等文本颜色一致
                        .text(item.text);

                    // 更新下一个图例项的起始X坐标
                    if (itemIndex < line.items.length - 1) {
                         currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                    }
                });
                currentLineBaseY += itemMaxHeight + interLineVerticalPadding; // 移动到下一行的顶部Y坐标
            });
        }
    }

    return svg.node(); // 返回 SVG DOM 节点
} 
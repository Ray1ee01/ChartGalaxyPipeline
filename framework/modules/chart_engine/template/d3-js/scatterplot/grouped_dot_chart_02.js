/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Grouped Dot Chart",
    "chart_name": "grouped_dot_chart_02",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "hierarchy": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// 散点图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据与配置 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    // 清空容器 & 创建文本测量上下文
    d3.select(containerSelector).html("");
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        context.font = `${fontWeight || 'normal'} ${fontSize || '12px'} ${fontFamily || 'Arial'}`;
        return context.measureText(text).width;
    }
    
    // 添加文本自动换行辅助函数
    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return [];
        
        const words = text.toString().split(/\s+/).filter(d => d.length > 0);
        if (words.length === 0) return [];
        
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = getTextWidthCanvas(currentLine + " " + word, fontFamily, fontSize, fontWeight);
            
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        lines.push(currentLine);
        return lines;
    }
    
    // 如果只有一个单词但超长，进行单词拆分
    function breakLongWord(word, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!word) return [];
        
        const characters = word.split('');
        const lines = [];
        let currentLine = '';
        
        for (let char of characters) {
            const testLine = currentLine + char;
            const width = getTextWidthCanvas(testLine, fontFamily, fontSize, fontWeight);
            
            if (width < maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    // 如果单个字符就超宽，强制添加
                    lines.push(char);
                    currentLine = '';
                }
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // 格式化大数字为易读格式
    function formatLargeNumber(value) {
        if (value === null || value === undefined || isNaN(value)) return '0';
        
        // 处理负数
        const sign = value < 0 ? '-' : '';
        const absValue = Math.abs(value);
        
        if (absValue >= 1000000000) {
            return sign + (absValue / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        } else if (absValue >= 1000000) {
            return sign + (absValue / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        } else if (absValue >= 1000) {
            return sign + (absValue / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        } else if (absValue < 1 && absValue > 0) {
            // 处理小数，最多保留3位小数
            return sign + absValue.toFixed(3).replace(/\.?0+$/, '');
        } else {
            return sign + absValue.toString();
        }
    }

    // ---------- 2. 尺寸与边距 ----------
    const width = variables.width || 600;
    const height = variables.height || 500;
    // 初始边距，后续动态调整
    let margin = { top: 75, right: 20, bottom: 70, left: 20 };

    // ---------- 3. 字段提取 ----------
    const dimensionField = dataColumns.find(col => col.role === "x").name; // Y轴类别字段
    const valueField = dataColumns.find(col => col.role === "y").name;     // X轴数值字段
    const groupField = dataColumns.find(col => col.role === "group").name;   // 分组字段

    // ---------- 4. 数据处理 ----------
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))]; // Y轴唯一类别
    const groups = [...new Set(chartData.map(d => d[groupField]))];       // 唯一分组

    // ---------- 5. 动态计算边距与内部尺寸 ----------

    // --- 5a: 计算X轴需求 ---
    const maxValue = d3.max(chartData, d => +d[valueField]) || 0;
    const tempXScale = d3.scaleLinear().domain([0, maxValue]).nice(); // 用于计算刻度的临时比例尺
    const xAxisTicks = tempXScale.ticks(5);
    const xAxisTickFormat = tempXScale.tickFormat(5);

    // 计算X轴标签所需高度 -> 更新下边距
    let maxXAxisLabelHeight = 0;
    if (xAxisTicks.length > 0) {
        const labelFontSize = typography.label.font_size || '12px';
        maxXAxisLabelHeight = parseFloat(labelFontSize) * 1.2; // 基于字体大小估算
    }
    const xAxisPadding = 15;
    margin.bottom = Math.max(margin.bottom, maxXAxisLabelHeight + xAxisPadding);

    // 计算X轴标签最大宽度 -> 更新右边距
    let maxXAxisLabelWidth = 0;
    if (xAxisTicks.length > 0) {
        const fontFamily = typography.label.font_family || 'Arial';
        const fontSize = typography.label.font_size || '12px';
        const fontWeight = typography.label.font_weight || 'normal';
        xAxisTicks.forEach(tick => {
            const formattedTickText = formatLargeNumber(tick);
            const textWidth = getTextWidthCanvas(formattedTickText, fontFamily, fontSize, fontWeight);
            maxXAxisLabelWidth = Math.max(maxXAxisLabelWidth, textWidth);
        });
    }
    // 调整右边距防止标签溢出
    margin.right = Math.max(margin.right, (maxXAxisLabelWidth / 2) + 10);


    // --- 5b: 估算Y轴需求 -> 更新左边距 ---
    const iconPadding = 5;
    let maxYAxisLabelWidth = 0;

    // 估算图标尺寸 (基于预估的条带宽度)
    let preliminaryInnerHeight = height - margin.top - margin.bottom;
    let preliminaryYScale = d3.scaleBand().domain(dimensions).range([0, preliminaryInnerHeight]).padding(0.1);
    let estIconHeight = preliminaryYScale.bandwidth() > 0 ? preliminaryYScale.bandwidth() * 0.6 : 20;
    let estIconWidth = estIconHeight * 1.33; // 假设4:3宽高比

    // 计算Y轴标签+图标所需宽度
    const maxYAxisLabelSpace = width * 0.25; // 最大允许Y轴标签宽度（占图表宽度的25%）
    const minFontSize = 8; // 最小字体大小
    const baseFontSize = parseFloat(typography.label.font_size || '12px');
    const fontFamily = typography.label.font_family || 'Arial';
    const fontWeight = typography.label.font_weight || 'normal';
    
    const yLabelsInfo = {}; // 存储标签相关信息

    dimensions.forEach(dim => {
        // 移除图标相关代码
        const iconSpace = 0; // 不再考虑图标空间
        const labelWidth = getTextWidthCanvas(dim, fontFamily, `${baseFontSize}px`, fontWeight);
        
        // 如果标签超长需要适配
        if (labelWidth > (maxYAxisLabelSpace - iconSpace)) {
            // 计算需要的缩放因子
            const scaleFactor = Math.max(0.7, (maxYAxisLabelSpace - iconSpace) / labelWidth);
            const adjustedFontSize = Math.max(minFontSize, baseFontSize * scaleFactor);
            
            // 检查是否需要换行
            if (adjustedFontSize < baseFontSize * 0.8) {
                // 计算单行最大宽度
                const maxLineWidth = maxYAxisLabelSpace - iconSpace;
                
                // 尝试按空格换行
                let textLines = wrapText(dim, maxLineWidth, fontFamily, `${adjustedFontSize}px`, fontWeight);
                
                // 如果是单个长词，尝试字符分割
                if (textLines.length === 1 && getTextWidthCanvas(textLines[0], fontFamily, `${adjustedFontSize}px`, fontWeight) > maxLineWidth) {
                    textLines = breakLongWord(dim, maxLineWidth, fontFamily, `${adjustedFontSize}px`, fontWeight);
                }
                
                yLabelsInfo[dim] = {
                    fontSize: adjustedFontSize,
                    lines: textLines,
                    needsWrap: true
                };
                
                // 计算包含所有行的宽度
                let maxTextLineWidth = 0;
                textLines.forEach(line => {
                    const lineWidth = getTextWidthCanvas(line, fontFamily, `${adjustedFontSize}px`, fontWeight);
                    maxTextLineWidth = Math.max(maxTextLineWidth, lineWidth);
                });
                
                const requiredWidth = iconSpace + maxTextLineWidth;
                maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, requiredWidth);
            } else {
                // 只需缩小字体，不需换行
                yLabelsInfo[dim] = {
                    fontSize: adjustedFontSize,
                    lines: [dim],
                    needsWrap: false
                };
                
                const requiredWidth = iconSpace + getTextWidthCanvas(dim, fontFamily, `${adjustedFontSize}px`, fontWeight);
                maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, requiredWidth);
            }
        } else {
            // 标签长度正常
            yLabelsInfo[dim] = {
                fontSize: baseFontSize,
                lines: [dim],
                needsWrap: false
            };
            
            const requiredWidth = iconSpace + labelWidth;
            maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, requiredWidth);
        }
    });

    const yAxisPadding = 20;
    // 减少左边距30像素
    margin.left = Math.max(margin.left, maxYAxisLabelWidth + yAxisPadding) - 30;

    // --- 5c: 最终确定内部尺寸 ---
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // ---------- 6. 比例尺 ----------
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.1); // Y轴类别比例尺

    const xScale = d3.scaleLinear()
        .domain(tempXScale.domain()) // 复用优化后的域
        .range([0, innerWidth]); // X轴数值比例尺

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => colors.field[group] || d3.schemeCategory10[i % 10])); // 分组颜色比例尺

    // 点的半径，基于Y轴条带高度，有上下限
    const pointRadius = Math.max(3, Math.min(yScale.bandwidth() * 0.25, 10));

    // ---------- 7. SVG 容器与主分组 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`) // 实现响应式缩放
        .attr("style", `max-width: 100%; height: auto;`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink"); // 用于xlink:href

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`); // 主绘图区

    // ---------- 8. 绘制坐标轴与网格线 ----------

    // X轴 (仅标签)
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => formatLargeNumber(d))
        .tickSizeOuter(0);

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove()) // 移除轴线
        .call(g => g.selectAll(".tick line").remove()) // 移除刻度线
        .call(g => g.selectAll(".tick text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", colors.text_color || "#333"));

    // 添加X轴标题
    g.append("text")
        .attr("class", "x-axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + margin.bottom / 2 + 5)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold")
        .style("fill", colors.text_color || "#333")
        .text(valueField); // 使用Y变量名称作为标题

    // --- 绘制垂直网格线 (手动) ---
    const gridPadding = 5; // 网格线上下延伸距离
    const yTopGrid = dimensions.length > 0 ? yScale(dimensions[0]) + yScale.bandwidth() / 2 : 0; // 最上方水平网格线Y
    const yBottomGrid = dimensions.length > 0 ? yScale(dimensions[dimensions.length - 1]) + yScale.bandwidth() / 2 : innerHeight; // 最下方水平网格线Y

    const xTickValues = xScale.ticks(5); // 获取刻度值

    g.append("g")
        .attr("class", "grid vertical-grid")
        .selectAll("line")
        .data(xTickValues)
        .enter()
        .append("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", yTopGrid - gridPadding) // 起点Y
        .attr("y2", yBottomGrid + gridPadding) // 终点Y
        .attr("stroke", "#aaaaaa")
        .attr("stroke-opacity", 0.7);


    // 水平网格线 (每个Y类别条带中心)
    g.append("g")
        .attr("class", "grid horizontal-grid")
        .selectAll("line")
        .data(dimensions)
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2) // Y坐标在条带中心
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", "#aaaaaa")
        .attr("stroke-opacity", 0.7);

    // ---------- 9. 绘制Y轴标签与图标 ----------
    const yAxisGroup = g.append("g").attr("class", "y-axis-labels");

    dimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2; // 类别条带中心Y
        const labelInfo = yLabelsInfo[dim];
        const lineCount = labelInfo.lines.length;
        const lineHeight = parseFloat(labelInfo.fontSize) * 1.2; // 行高
        const totalTextHeight = lineHeight * lineCount;
        
        // 标签X位置 (不考虑图标)
        const labelX = -5;

        // 处理多行文本或单行文本
        if (labelInfo.needsWrap && lineCount > 1) {
            const labelGroup = yAxisGroup.append("g")
                .attr("class", "y-axis-label-group");
                
            // 计算多行文本的起始Y位置（居中对齐）
            const startY = yPos - (totalTextHeight / 2) + (lineHeight / 2);
            
            labelInfo.lines.forEach((line, i) => {
                labelGroup.append("text")
                    .attr("x", labelX)
                    .attr("y", startY + (i * lineHeight))
                    .attr("text-anchor", "end") // 右对齐
                    .style("font-family", typography.label.font_family)
                    .style("font-size", `${labelInfo.fontSize}px`)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", colors.text_color || "#333")
                    .text(line);
            });
        } else {
            // 单行文本
            yAxisGroup.append("text")
                .attr("x", labelX)
                .attr("y", yPos)
                .attr("dy", "0.35em") // 垂直微调居中
                .attr("text-anchor", "end") // 右对齐
                .style("font-family", typography.label.font_family)
                .style("font-size", `${labelInfo.fontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333")
                .text(dim);
        }
    });

    // ---------- 10. 绘制数据点 ----------
    g.append("g")
        .attr("class", "scatter-points")
        .selectAll("circle")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(+d[valueField]))
        .attr("cy", d => yScale(d[dimensionField]) + yScale.bandwidth() / 2) // Y坐标在条带中心
        .attr("r", pointRadius)
        .attr("fill", d => colorScale(d[groupField]));

    // ---------- 11. 绘制图例 ----------
    const initialLegendFontSize = parseFloat(typography.label?.font_size || 12);
    const legendFontWeight = typography.label?.font_weight || "normal";
    const legendFontFamily = typography.label?.font_family || "Arial";
    const legendColor = colors.text_color || "#333333";
    const legendItemPadding = 5; // 标记与文本间距
    const legendColumnPadding = 20; // 图例项间距，增加了间距
    const legendMinimumFontSize = 9; // 最小图例字体大小
    const legendRowPadding = 15; // 图例行间距，增加以防止行间重叠
    
    // 图例标题设置
    const legendTitle = groupField; // 使用分组字段名作为图例标题
    const legendTitleFontSize = initialLegendFontSize;
    const legendTitleFontWeight = "bold"; // 标题加粗

    if (groups.length > 0) {
        // 增大图例图标尺寸：使用更大的基础尺寸
        const legendIconRadiusBase = pointRadius * 1.8; // 增大图例图标基础尺寸
        
        // 图例项的初始布局估算 (单行)
        let totalLegendWidth = 0;
        const legendItems = [];
        
        groups.forEach((cg) => {
            const textWidth = getTextWidthCanvas(cg, legendFontFamily, initialLegendFontSize, legendFontWeight);
            // 增加每个项目的空间，防止重叠
            const itemWidth = (legendIconRadiusBase * 2) + legendItemPadding + textWidth + 10; // 增加5px额外空间
            legendItems.push({
                group: cg,
                textWidth: textWidth,
                itemWidth: itemWidth
            });
            totalLegendWidth += itemWidth + legendColumnPadding;
        });
        totalLegendWidth -= legendColumnPadding;
        
        // 计算布局方案
        let legendLayout = {
            rows: 1,
            rowItems: [],
            rowWidths: [],
            fontSize: initialLegendFontSize,
            markRadius: legendIconRadiusBase // 使用更大的图标半径
        };
        
        const maxAllowedLegendWidth = innerWidth * 0.9; // 允许图例占用的最大宽度

        // 如果单行图例超过允许宽度，尝试多行布局
        if (totalLegendWidth > maxAllowedLegendWidth) {
            // 先尝试分成多行，每行不超过最大宽度
            let currentRowWidth = 0;
            let currentRowItems = [];
            legendLayout.rowItems = [currentRowItems];
            
            // 尝试在不缩小字体的情况下分行
            legendItems.forEach(item => {
                if (currentRowWidth + item.itemWidth + legendColumnPadding > maxAllowedLegendWidth && currentRowItems.length > 0) {
                    // 新行
                    legendLayout.rowWidths.push(currentRowWidth);
                    currentRowItems = [];
                    legendLayout.rowItems.push(currentRowItems);
                    currentRowWidth = 0;
                }
                
                currentRowItems.push(item);
                currentRowWidth += item.itemWidth + legendColumnPadding;
            });
            
            // 添加最后一行宽度
            if (currentRowWidth > 0) {
                legendLayout.rowWidths.push(currentRowWidth - legendColumnPadding);
            }
            
            legendLayout.rows = legendLayout.rowItems.length;
            
            // 如果行数过多(超过2行)或者最后一行项目太少(只有1-2项)，尝试缩小字体但不超过两行
            const maxAllowedRows = 2;
            
            if (legendLayout.rows > maxAllowedRows || 
                (legendLayout.rows > 1 && legendLayout.rowItems[legendLayout.rows-1].length <= 2)) {
                
                // 清除前面的布局计算
                legendLayout.rowItems = [];
                legendLayout.rowWidths = [];
                
                // 尝试缩小字体，计算新的缩放比例
                let scaleFactor = maxAllowedLegendWidth / totalLegendWidth * 0.95; // 95%以留出一些余量
                let newFontSize = Math.max(legendMinimumFontSize, initialLegendFontSize * scaleFactor);
                let newMarkRadius = Math.max(legendIconRadiusBase * 0.6, legendIconRadiusBase * scaleFactor);
                
                // 如果字体缩放后仍然太小，则坚持使用较大字体，但使用两行布局
                if (newFontSize < initialLegendFontSize * 0.8) {
                    newFontSize = Math.max(legendMinimumFontSize, initialLegendFontSize * 0.8);
                    legendLayout.rows = 2;
                } else {
                    legendLayout.rows = 1;
                }
                
                legendLayout.fontSize = newFontSize;
                legendLayout.markRadius = newMarkRadius;
                
                // 重新计算调整后的项目宽度
                const adjustedItems = legendItems.map(item => {
                    const newTextWidth = getTextWidthCanvas(item.group, legendFontFamily, newFontSize, legendFontWeight);
                    return {
                        group: item.group,
                        textWidth: newTextWidth,
                        itemWidth: (newMarkRadius * 2) + legendItemPadding + newTextWidth + 5 // 增加5px额外空间
                    };
                });
                
                // 如果调整后仍需多行，计算每行的元素
                if (legendLayout.rows > 1) {
                    const totalItems = adjustedItems.length;
                    const itemsPerRow = Math.ceil(totalItems / legendLayout.rows);
                    
                    for (let row = 0; row < legendLayout.rows; row++) {
                        const startIdx = row * itemsPerRow;
                        const endIdx = Math.min(startIdx + itemsPerRow, totalItems);
                        const rowItems = adjustedItems.slice(startIdx, endIdx);
                        
                        legendLayout.rowItems.push(rowItems);
                        
                        // 计算行宽度
                        let rowWidth = 0;
                        rowItems.forEach(item => {
                            rowWidth += item.itemWidth + legendColumnPadding;
                        });
                        
                        legendLayout.rowWidths.push(rowWidth - legendColumnPadding);
                    }
                } else {
                    // 单行布局
                    legendLayout.rowItems.push(adjustedItems);
                    
                    let totalWidth = 0;
                    adjustedItems.forEach(item => {
                        totalWidth += item.itemWidth + legendColumnPadding;
                    });
                    
                    legendLayout.rowWidths.push(totalWidth - legendColumnPadding);
                }
            }
        } else {
            // 单行布局足够
            legendLayout.rowItems.push(legendItems);
            legendLayout.rowWidths.push(totalLegendWidth);
        }
        
        // 计算图例总高度和垂直定位
        const rowHeight = legendLayout.fontSize * 1.5; // 每行的基本高度
        const legendTotalHeight = (legendLayout.rows - 1) * legendRowPadding + legendLayout.rows * rowHeight;
        const legendStartY = margin.top / 2 - legendTotalHeight / 2 + legendLayout.fontSize / 2;
        
        // 绘制图例
        const legendGroup = svg.append("g").attr("class", "chart-legend");
        
        // 添加图例标题（在左侧，与Y轴标签对齐）
        const titleWidth = getTextWidthCanvas(legendTitle, legendFontFamily, legendTitleFontSize, legendTitleFontWeight);
        // 标题X位置与Y轴标签对齐（需要减去margin.left）
        const titleX = margin.left - 10; // 左侧对齐位置
        const titleY = legendStartY + (legendLayout.rows > 1 ? (legendTotalHeight / 2) - rowHeight / 2 : 0); // 垂直居中
        
        legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", titleX)
            .attr("y", titleY)
            .attr("dy", "0.35em") // 微调垂直对齐
            .attr("text-anchor", "end") // 右对齐文本
            .style("font-family", legendFontFamily)
            .style("font-size", `${legendTitleFontSize}px`)
            .style("font-weight", legendTitleFontWeight)
            .style("fill", legendColor)
            .text(legendTitle);
        
        legendLayout.rowItems.forEach((rowItems, rowIndex) => {
            // 计算行的水平居中位置
            const rowWidth = legendLayout.rowWidths[rowIndex];
            const rowStartX = margin.left + (innerWidth - rowWidth) / 2;
            const rowY = legendStartY + rowIndex * (rowHeight + legendRowPadding);
            
            const rowGroup = legendGroup.append("g")
                .attr("class", `legend-row-${rowIndex}`)
                .attr("transform", `translate(${rowStartX}, ${rowY})`);
            
            let currentX = 0;
            
            rowItems.forEach(item => {
                const legendItem = rowGroup.append("g")
                    .attr("transform", `translate(${currentX}, 0)`);
                
                // 图例标记 (圆)
                legendItem.append("circle")
                    .attr("cx", legendLayout.markRadius)
                    .attr("cy", 0)
                    .attr("r", legendLayout.markRadius)
                    .attr("fill", colorScale(item.group));
                
                // 图例文本
                legendItem.append("text")
                    .attr("x", (legendLayout.markRadius * 2) + legendItemPadding)
                    .attr("y", 0)
                    .attr("dominant-baseline", "middle") // 垂直居中
                    .attr("text-anchor", "start")
                    .style("font-family", legendFontFamily)
                    .style("font-size", `${legendLayout.fontSize}px`)
                    .style("font-weight", legendFontWeight)
                    .style("fill", legendColor)
                    .text(item.group);
                
                currentX += item.itemWidth + legendColumnPadding;
            });
        });
    }

    // ---------- 12. 返回 SVG 节点 ----------
    return svg.node();
}
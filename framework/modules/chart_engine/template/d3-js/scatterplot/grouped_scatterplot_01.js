/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Grouped Scatterplot",
    "chart_name": "grouped_scatterplot_01",
    "required_fields": ["x", "y", "y2", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "hierarchy": ["group"],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 750,
    "min_width": 750,
    "background": "no",
    "icon_mark": "replace",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Extract data
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    const colors = jsonData.colors;
    
    // Clear container
    d3.select(containerSelector).html("");
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const y2Field = dataColumns[2].name;
    let group_column = null;
    for (const column of dataColumns) {
        if (column.role === "group") {
            group_column = column;
        }
    }
    const groupField = group_column.name;
    // Set dimensions and margins
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 25, right: 25, bottom: 50, left: 50 };
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // Create chart area
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // Create scales
    const xExtent = d3.extent(chartData, d => d[yField]);
    const yExtent = d3.extent(chartData, d => d[y2Field]);
    
    // 检查数据是否包含负值或0值
    function hasNegativeOrZeroValues(data, field) {
        return data.some(d => d[field] <= 0);
    }
    
    // 判断数据分布是否不均匀
    function isDistributionUneven(data, field) {
        const values = data.map(d => d[field]);
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        
        // 不均匀分布的判断标准
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    }
    
    // 为X轴创建合适的比例尺
    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yField);
    const xIsUneven = isDistributionUneven(chartData, yField);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven) 
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.1), xExtent[1] * 1.1])
            .range([0, chartWidth])
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, chartWidth]);
            
    // 为Y轴创建合适的比例尺
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2Field);
    const yIsUneven = isDistributionUneven(chartData, y2Field);
    
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.1), yExtent[1] * 1.1])
            .range([chartHeight, 0])
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
            .range([chartHeight, 0]);
    
    // Create axes
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10);
        
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10);
    
    // Add X axis
    const xAxisGroup = g.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis)

    xAxisGroup
        .selectAll("path")
        .style("stroke", colors.text_color)
        .style("stroke-width", 1)
        .style("opacity", 0.5)

    xAxisGroup
        .selectAll("text")
        .style("color", colors.text_color)
        
    // Add Y axis
    const yAxisGroup = g.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis)
        .style("color", colors.text_color)
        .style("fill", "black");

    yAxisGroup
        .selectAll("path")
        .style("stroke", colors.text_color)
        .style("stroke-width", 1)
        .style("opacity", 0.5)

    yAxisGroup
        .selectAll("text")
        .style("color", colors.text_color)
    
    // Add axis titles
    g.append("text")
        .attr("class", "axis-title")
        .attr("x", chartWidth)
        .attr("y", chartHeight + margin.bottom / 2 + 15)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(yField);
        
    g.append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -margin.top)
        .attr("y", -margin.left / 2 - 10)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(y2Field);
        
    // Helper function to find optimal label position
    function findOptimalPosition(d, allPoints, currentPositions = {}) {
        const positions = [
            { x: 20, y: 4, anchor: "start", priority: 1 },         // right
            { x: 0, y: -20, anchor: "middle", priority: 2 },       // top
            { x: -20, y: 4, anchor: "end", priority: 3 },          // left
            { x: 0, y: 28, anchor: "middle", priority: 4 },        // bottom
            { x: 20, y: -20, anchor: "start", priority: 5 },       // top-right
            { x: -20, y: -20, anchor: "end", priority: 6 },        // top-left
            { x: -20, y: 28, anchor: "end", priority: 7 },         // bottom-left
            { x: 20, y: 28, anchor: "start", priority: 8 }         // bottom-right
        ];

        const pointX = xScale(d[yField]);
        const pointY = yScale(d[y2Field]);

        // 如果已经有位置分配，直接返回
        if (currentPositions[d[xField]]) {
            return currentPositions[d[xField]];
        }

        // 创建临时文本元素来测量实际文本大小
        const tempText = g.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", "10px")
            .text(d[xField]);
        const textBBox = tempText.node().getBBox();
        tempText.remove();

        const labelWidth = textBBox.width;
        const labelHeight = textBBox.height;

        // 贪心算法：按优先级顺序尝试每个位置，选择第一个没有重叠的位置
        for (const pos of positions) {
            let hasOverlap = false;

            // 计算标签边界
            let labelX1, labelY1, labelX2, labelY2;

            if (pos.priority === 1) { // right
                labelX1 = pointX + 20;
                labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 2) { // top
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY - 20 - labelHeight;
            } else if (pos.priority === 3) { // left
                labelX1 = pointX - 20 - labelWidth;
                labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 4) { // bottom
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY + 20;
            } else if (pos.priority === 5) { // top-right
                labelX1 = pointX + 15;
                labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 6) { // top-left
                labelX1 = pointX - 15 - labelWidth;
                labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 7) { // bottom-left
                labelX1 = pointX - 15 - labelWidth;
                labelY1 = pointY + 15;
            } else { // bottom-right
                labelX1 = pointX + 15;
                labelY1 = pointY + 15;
            }

            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            // 检查边界约束
            if (labelX1 < 0 || labelX2 > chartWidth || labelY1 < 0 || labelY2 > chartHeight) {
                continue;
            }

            // 检查与其他点及其标签的重叠
            for (const p of allPoints) {
                if (p === d) continue;

                const pX = xScale(p[yField]);
                const pY = yScale(p[y2Field]);

                // 检查与点的重叠
                const pointRadius = circleRadius;
                const dx = labelX1 + labelWidth/2 - pX;
                const dy = labelY1 + labelHeight/2 - pY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < pointRadius + Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight) / 2) {
                    hasOverlap = true;
                    break;
                }

                // 检查与其他标签的重叠
                const pPos = currentPositions[p[xField]];
                if (pPos) {
                    const tempText = g.append("text")
                        .style("font-family", typography.label.font_family)
                        .style("font-size", "10px")
                        .text(p[xField]);
                    const otherBBox = tempText.node().getBBox();
                    tempText.remove();

                    let otherX1, otherY1;
                    if (pPos.anchor === "start") {
                        otherX1 = pX + pPos.x;
                        otherY1 = pY + pPos.y - otherBBox.height/2;
                    } else if (pPos.anchor === "middle") {
                        otherX1 = pX + pPos.x - otherBBox.width/2;
                        otherY1 = pY + pPos.y;
                    } else {
                        otherX1 = pX + pPos.x - otherBBox.width;
                        otherY1 = pY + pPos.y - otherBBox.height/2;
                    }

                    if (labelX1 < otherX1 + otherBBox.width && labelX2 > otherX1 &&
                        labelY1 < otherY1 + otherBBox.height && labelY2 > otherY1) {
                        hasOverlap = true;
                        break;
                    }
                }
            }

            if (!hasOverlap) {
                return { ...pos, canShow: true };
            }
        }

        // 如果所有位置都有重叠，返回优先级最高的位置，但标记为不显示
        return { ...positions[0], canShow: false };
    }
    // Determine circle size based on number of data points
    const numPoints = chartData.length;
    const circleRadius = numPoints <= 15 ? 15 : Math.max(10, 15 - (numPoints - 15) / 20);
    
    // Add data points
    const points = g.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "data-point")
        .attr("transform", d => `translate(${xScale(d[yField])}, ${yScale(d[y2Field])})`);
    
    // Add white circular background
    points.append("circle")
        .attr("r", circleRadius)
        .attr("fill", d => colors.field[d[groupField]])
        .attr("stroke", d => colors.field[d[groupField]])
        .attr("stroke-width", 8);
    
    // Add icon images
    points.append("image")
        .attr("xlink:href", d => images.field[d[xField]])
        .attr("width", circleRadius * 2)
        .attr("height", circleRadius * 2)
        .attr("x", -circleRadius)
        .attr("y", -circleRadius);
    
    // Calculate optimal positions for all labels
    let labelPositions = {};
    chartData.forEach(d => {
        labelPositions[d[xField]] = findOptimalPosition(d, chartData, labelPositions);
    });

    // Add labels with optimized positions, only showing non-overlapping ones
    points.append("text")
        .attr("class", "data-label")
        .attr("x", d => labelPositions[d[xField]].x)
        .attr("y", d => labelPositions[d[xField]].y)
        .attr("text-anchor", d => labelPositions[d[xField]].anchor)
        .style("font-family", typography.label.font_family)
        .style("font-size", 10)
        .style("font-weight", typography.label.font_weight)
        .style("opacity", d => labelPositions[d[xField]].canShow ? 1 : 0)
        .text(d => d[xField]);
    
    // 添加图例
    // 获取分组列表
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 图例配置参数
    const initialLegendFontSize = parseFloat(typography.label?.font_size || 12);
    const legendFontWeight = typography.label?.font_weight || "normal";
    const legendFontFamily = typography.label?.font_family || "Arial";
    const legendColor = colors.text_color || "#333333";
    const legendItemPadding = 5; // 标记与文本间距
    const legendColumnPadding = 20; // 图例项间距
    const legendMinimumFontSize = 9; // 最小图例字体大小
    const legendRowPadding = 15; // 图例行间距
    
    if (groups.length > 0) {
        // 测量文本宽度的函数
        function getTextWidth(text, fontFamily, fontSize, fontWeight) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            return context.measureText(text).width;
        }
        
        // 图例项的初始布局估算 (单行)
        let totalLegendWidth = 0;
        const legendItems = [];
        
        groups.forEach((group) => {
            const textWidth = getTextWidth(group, legendFontFamily, `${initialLegendFontSize}px`, legendFontWeight);
            // 图例项宽度 = 圆点直径 + 间距 + 文本宽度 + 额外间距
            const itemWidth = (circleRadius * 2) + legendItemPadding + textWidth + 5;
            legendItems.push({
                group: group,
                textWidth: textWidth,
                itemWidth: itemWidth
            });
            totalLegendWidth += itemWidth + legendColumnPadding;
        });
        totalLegendWidth -= legendColumnPadding; // 减去最后一项多余的间距
        
        // 计算布局方案
        let legendLayout = {
            rows: 1,
            rowItems: [],
            rowWidths: [],
            fontSize: initialLegendFontSize,
            markRadius: circleRadius
        };
        
        const maxAllowedLegendWidth = chartWidth * 0.9; // 允许图例占用的最大宽度
        
        // 如果单行图例超过允许宽度，尝试多行布局
        if (totalLegendWidth > maxAllowedLegendWidth) {
            // 尝试分成多行，每行不超过最大宽度
            let currentRowWidth = 0;
            let currentRowItems = [];
            legendLayout.rowItems = [currentRowItems];
            
            // 尝试在不缩小字体的情况下分行
            legendItems.forEach(item => {
                if (currentRowWidth + item.itemWidth + legendColumnPadding > maxAllowedLegendWidth && currentRowItems.length > 0) {
                    // 开始新行
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
                let newMarkRadius = Math.max(circleRadius * 0.6, circleRadius * scaleFactor);
                
                // 如果字体缩放后仍然太小，则使用较大字体，但使用两行布局
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
                    const newTextWidth = getTextWidth(item.group, legendFontFamily, `${newFontSize}px`, legendFontWeight);
                    return {
                        group: item.group,
                        textWidth: newTextWidth,
                        itemWidth: (newMarkRadius * 2) + legendItemPadding + newTextWidth + 5
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
        
        // 添加图例标题
        const legendTitle = legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", margin.left + chartWidth / 2)
            .attr("y", legendStartY - 20)
            .attr("text-anchor", "middle")
            .style("font-family", legendFontFamily)
            .style("font-size", `${legendLayout.fontSize + 1}px`)
            .style("font-weight", "bold")
            .style("fill", legendColor)
            .text(groupField);
        
        legendLayout.rowItems.forEach((rowItems, rowIndex) => {
            // 计算行的水平居中位置
            const rowWidth = legendLayout.rowWidths[rowIndex];
            const rowStartX = margin.left + (chartWidth - rowWidth) / 2;
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
                    .attr("fill", colors.field[item.group]);
                
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
    
    return svg.node();
}
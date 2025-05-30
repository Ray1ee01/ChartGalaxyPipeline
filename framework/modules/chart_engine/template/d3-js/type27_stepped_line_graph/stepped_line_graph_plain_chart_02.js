/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stepped Line Graph",
    "chart_name": "stepped_line_graph_plain_chart_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// 分组step_line_graph_plain_chart_02
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

    // 创建智能日期比例尺和刻度
    const createXAxisScaleAndTicks = (data, xField, rangeStart, rangeEnd) => {
        const dates = data.map(d => parseDate(d[xField]));
        const xExtent = d3.extent(dates);
        const xScale = d3.scaleTime().domain(xExtent).range([rangeStart, rangeEnd]);
        
        const timeSpan = xExtent[1] - xExtent[0];
        const yearSpan = timeSpan / (1000 * 60 * 60 * 24 * 365);
        
        let timeInterval, formatFunction;
        if (yearSpan > 2) {
            timeInterval = d3.timeYear.every(1);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 1) {
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => `${d.getFullYear().toString().slice(-2)}Q${Math.floor(d.getMonth() / 3) + 1}`;
        } else {
            timeInterval = d3.timeMonth.every(1);
            formatFunction = d => d3.timeFormat("%m %Y")(d);
        }
        
        const xTicks = xScale.ticks(timeInterval);
        return { xScale, xTicks, xFormat: formatFunction };
    };

    // 格式化数值
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
    };

    // 智能排版图例
    const layoutLegend = (g, groups, colors, options = {}) => {
        const defaults = {
            maxWidth: 500, x: 0, y: 0, itemHeight: 20, itemSpacing: 20,
            rowSpacing: 10, symbolSize: 10, textColor: "#333", fontSize: 12,
            fontWeight: "normal", align: "left", shape: "circle"
        };
        
        const opts = {...defaults, ...options};
        
        const tempText = g.append("text")
            .attr("visibility", "hidden")
            .style("font-size", `${opts.fontSize}px`)
            .style("font-weight", opts.fontWeight);
        
        const itemWidths = groups.map(group => {
            tempText.text(group);
            return opts.symbolSize * 2 + tempText.node().getComputedTextLength() + 5;
        });
        
        tempText.remove();
        
        const rows = [];
        let currentRow = [];
        let currentRowWidth = 0;
        
        itemWidths.forEach((width, i) => {
            if (currentRow.length === 0 || currentRowWidth + width + opts.itemSpacing <= opts.maxWidth) {
                currentRow.push(i);
                currentRowWidth += width + (currentRow.length > 1 ? opts.itemSpacing : 0);
            } else {
                rows.push(currentRow);
                currentRow = [i];
                currentRowWidth = width;
            }
        });
        
        if (currentRow.length > 0) {
            rows.push(currentRow);
        }
        
        const totalHeight = rows.length * opts.itemHeight + (rows.length - 1) * opts.rowSpacing;
        const maxRowWidth = Math.max(...rows.map(row => {
            return row.reduce((sum, i, idx) => {
                return sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0);
            }, 0);
        }));
        
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.reduce((sum, i, idx) => {
                return sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0);
            }, 0);
            
            let rowStartX = opts.align === "center" ? opts.x + (opts.maxWidth - rowWidth) / 2 :
                           opts.align === "right" ? opts.x + opts.maxWidth - rowWidth : opts.x;
            
            let currentX = rowStartX;
            row.forEach(i => {
                const group = groups[i];
                const color = colors.field && colors.field[group] ? colors.field[group] : d3.schemeCategory10[i % 10];
                    
                const legendGroup = g.append("g")
                    .attr("transform", `translate(${currentX}, ${opts.y + rowIndex * (opts.itemHeight + opts.rowSpacing)})`);
                
                if (opts.shape === "line") {
                    legendGroup.append("line")
                        .attr("x1", 0).attr("y1", opts.itemHeight / 2)
                        .attr("x2", opts.symbolSize).attr("y2", opts.itemHeight / 2)
                        .attr("stroke", color).attr("stroke-width", 4)
                        .attr("class", "mark");
                } else {
                    legendGroup.append("circle")
                        .attr("cx", opts.symbolSize / 2).attr("cy", opts.itemHeight / 2)
                        .attr("r", opts.symbolSize / 2).attr("fill", color)
                        .attr("class", "mark");
                }
                
                legendGroup.append("text")
                    .attr("x", opts.symbolSize * 1.5).attr("y", opts.itemHeight / 2)
                    .attr("dominant-baseline", "middle").attr("fill", opts.textColor)
                    .attr("class", "label")
                    .style("font-size", `${opts.fontSize}px`)
                    .style("font-weight", opts.fontWeight)
                    .text(group);
                
                currentX += itemWidths[i] + opts.itemSpacing;
            });
        });
        
        return { width: maxRowWidth, height: totalHeight };
    };

    // 动态规划标签放置算法
    const placeLabelsDP = (points, avoidYPositions, chartHeight) => {
        const GRID_SIZE = 3;
        const PROTECTION_RADIUS = 3;
        const LABEL_HEIGHT = 10;
        
        const gridCount = Math.ceil(chartHeight / GRID_SIZE);
        points.sort((a, b) => a.y - b.y);
        
        const occupied = new Array(gridCount).fill(false);
        
        // 标记数据点保护区域
        points.forEach(point => {
            const gridY = Math.floor(point.y / GRID_SIZE) - 3;
            for (let i = Math.max(0, gridY - PROTECTION_RADIUS); i <= Math.min(gridCount - 1, gridY + PROTECTION_RADIUS); i++) {
                occupied[i] = true;
            }
        });
        
        const n = points.length;
        const dp = Array(n).fill().map(() => Array(gridCount).fill(Infinity));
        const prev = Array(n).fill().map(() => Array(gridCount).fill(-1));
        
        // 初始化第一个点
        const firstPointGridY = Math.floor(points[0].y / GRID_SIZE);
        for (let j = 0; j < gridCount; j++) {
            if (!occupied[j] && j + LABEL_HEIGHT <= gridCount) {
                let canPlace = true;
                for (let k = 0; k < LABEL_HEIGHT; k++) {
                    if (j + k < gridCount && occupied[j + k]) {
                        canPlace = false;
                        break;
                    }
                }
                if (canPlace) {
                    dp[0][j] = Math.abs(j - firstPointGridY);
                }
            }
        }
        
        // 动态规划填表
        for (let i = 1; i < n; i++) {
            const pointGridY = Math.floor(points[i].y / GRID_SIZE);
            
            for (let j = 0; j < gridCount; j++) {
                if (!occupied[j] && j + LABEL_HEIGHT <= gridCount) {
                    let canPlace = true;
                    for (let k = 0; k < LABEL_HEIGHT; k++) {
                        if (j + k < gridCount && occupied[j + k]) {
                            canPlace = false;
                            break;
                        }
                    }
                    
                    if (canPlace) {
                        for (let k = 0; k + LABEL_HEIGHT <= j; k++) {
                            if (dp[i-1][k] !== Infinity) {
                                const curCost = Math.abs(j - pointGridY);
                                const totalCost = dp[i-1][k] + curCost;
                                
                                if (totalCost < dp[i][j]) {
                                    dp[i][j] = totalCost;
                                    prev[i][j] = k;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 找最优解并回溯
        let minCost = Infinity;
        let bestPos = -1;
        
        for (let j = 0; j < gridCount; j++) {
            if (dp[n-1][j] < minCost) {
                minCost = dp[n-1][j];
                bestPos = j;
            }
        }
        
        const labelPositions = [];
        if (bestPos !== -1) {
            let pos = bestPos;
            for (let i = n - 1; i >= 0; i--) {
                labelPositions.unshift({
                    point: points[i],
                    labelY: pos * GRID_SIZE
                });
                pos = prev[i][pos];
            }
        } else {
            // 退化方案
            let lastY = 0;
            for (let i = 0; i < n; i++) {
                const point = points[i];
                let maxY = chartHeight;
                if (i < n - 1) {
                    maxY = points[i+1].y;
                }
                const labelY = Math.min(Math.max(point.y + 20, lastY + 25), maxY - 5);
                labelPositions.push({ point: point, labelY: labelY });
                lastY = labelY;
            }
        }
        
        return labelPositions;
    };

    // ---------- 主要代码 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 30, bottom: 60, left: 60 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const groupedData = d3.group(chartData, d => d[groupField]);

    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);
    const yPadding = (yMax - yMin) * 0.3;
    const yDomainMax = yMax + yPadding;
    const yDomainMin = Math.min(0, yMin - yPadding);
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin, yDomainMax])
        .range([chartHeight, 0]);
    
    // 颜色函数
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeCategory10[groups.indexOf(d) % 10];
    };
    
    const yTicks = yScale.ticks(5);
    
    // 添加水平网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0).attr("y1", yScale(tick))
            .attr("x2", chartWidth).attr("y2", yScale(tick))
            .attr("stroke", "#dddddd").attr("stroke-width", 1)
            .attr("class", "gridline");
    });
    
    // 添加刻度之间的额外网格线
    if (yTicks.length > 1) {
        for (let i = 0; i < yTicks.length - 1; i++) {
            const midValue = (yTicks[i] + yTicks[i + 1]) / 2;
            g.append("line")
                .attr("x1", 0).attr("y1", yScale(midValue))
                .attr("x2", chartWidth).attr("y2", yScale(midValue))
                .attr("stroke", "#dddddd").attr("stroke-width", 1)
                .attr("class", "gridline");
        }
    }
    
    // Y轴刻度文本
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -10).attr("y", yScale(tick))
            .attr("text-anchor", "end").attr("dominant-baseline", "middle")
            .attr("class", "value")
            .attr("fill", "#666")
            .style("font-size", "14px")
            .text(formatValue(tick));
    });
    
    // X轴刻度文本
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick)).attr("y", chartHeight + 20)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .attr("fill", "#666")
            .style("font-size", "14px")
            .text(xFormat(tick));
    });
    
    // X轴线
    g.append("line")
        .attr("x1", 0).attr("y1", chartHeight)
        .attr("x2", chartWidth).attr("y2", chartHeight)
        .attr("stroke", "#aaa").attr("stroke-width", 1)
        .attr("class", "axis");
    
    // 创建阶梯线生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveStepAfter);
    
    // 收集标注数据点
    const startPoints = [];
    const middlePoints = [];
    const endPoints = [];
    
    groupedData.forEach((values, group) => {
        values.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
        const color = colors.field[group];
        
        // 绘制阶梯线
        g.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 4)
            .attr("class", "mark")
            .attr("d", line);
        
        const middleIndex = Math.floor(values.length / 2);
        
        values.forEach((d, i) => {
            const pointData = {
                x: xScale(parseDate(d[xField])),
                y: yScale(d[yField]),
                value: d[yField],
                color: color,
                group: group,
                point: d
            };
            
            if (i === 0) {
                startPoints.push(pointData);
            } else if (i === values.length - 1) {
                endPoints.push(pointData);
            } else if (i === middleIndex) {
                middlePoints.push(pointData);
            }
        });
    });
    
    // 应用动态规划算法
    const startLabelPositions = placeLabelsDP(startPoints, yTicks.map(tick => yScale(tick)), chartHeight);
    const middleLabelPositions = placeLabelsDP(middlePoints, yTicks.map(tick => yScale(tick)), chartHeight);
    const endLabelPositions = placeLabelsDP(endPoints, yTicks.map(tick => yScale(tick)), chartHeight);
    
    // 绘制标签函数
    const drawLabels = (labelPositions) => {
        labelPositions.forEach(placement => {
            const point = placement.point;
            const labelY = placement.labelY;
            
            const labelText = formatValue(point.value);
            const labelWidth = labelText.toString().length * 10 + 10;
            const labelHeight = 24;
            
            // 圆角矩形背景
            g.append("rect")
                .attr("x", point.x - labelWidth / 2)
                .attr("y", labelY + labelHeight / 2)
                .attr("width", labelWidth).attr("height", labelHeight)
                .attr("rx", 5).attr("ry", 5)
                .attr("fill", point.color)
                .attr("class", "mark");
            
            // 标签文本
            g.append("text")
                .attr("x", point.x)
                .attr("y", labelY + labelHeight)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", "#fff").attr("font-weight", "bold")
                .attr("class", "value")
                .style("font-size", "14px")
                .text(labelText);
        });
    };
    
    // 绘制所有标签
    drawLabels(startLabelPositions);
    drawLabels(middleLabelPositions);
    drawLabels(endLabelPositions);
    
    // 添加图例
    const legendGroup = g.append("g");
    
    const legendSize = layoutLegend(legendGroup, groups, colors, {
        x: 0, y: 0, fontSize: 14, fontWeight: "bold",
        align: "left", maxWidth: chartWidth, shape: "line"
    });

    const maxYTickPosition = yScale(yTicks[yTicks.length - 1]);
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width) / 2}, ${maxYTickPosition - 50 - legendSize.height/2})`);
    
    return svg.node();
} 
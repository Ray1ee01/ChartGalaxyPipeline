/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Scatterplot",
    "chart_name": "scatterplot_plain_chart_01",
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 750,
    "min_width": 750,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 计算文本宽度
    const getTextWidth = (text, fontSize) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize}px Arial`;
        const width = context.measureText(text).width;
        canvas.remove();
        return width;
    };

    // 寻找最优标签位置
    const findOptimalPosition = (d, allPoints, currentPositions = {}) => {
        const positions = [
            { x: 20, y: 4, anchor: "start", priority: 1 },
            { x: 0, y: -20, anchor: "middle", priority: 2 },
            { x: -20, y: 4, anchor: "end", priority: 3 },
            { x: 0, y: 28, anchor: "middle", priority: 4 },
            { x: 20, y: -20, anchor: "start", priority: 5 },
            { x: -20, y: -20, anchor: "end", priority: 6 },
            { x: -20, y: 28, anchor: "end", priority: 7 },
            { x: 20, y: 28, anchor: "start", priority: 8 }
        ];

        const pointX = xScale(d[yField]);
        const pointY = yScale(d[y2Field]);

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

        for (const pos of positions) {
            let hasOverlap = false;
            let labelX1, labelY1, labelX2, labelY2;

            if (pos.priority === 1) {
                labelX1 = pointX + 20;
                labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 2) {
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY - 20 - labelHeight;
            } else if (pos.priority === 3) {
                labelX1 = pointX - 20 - labelWidth;
                labelY1 = pointY - labelHeight / 2;
            } else if (pos.priority === 4) {
                labelX1 = pointX - labelWidth / 2;
                labelY1 = pointY + 20;
            } else if (pos.priority === 5) {
                labelX1 = pointX + 15;
                labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 6) {
                labelX1 = pointX - 15 - labelWidth;
                labelY1 = pointY - 15 - labelHeight;
            } else if (pos.priority === 7) {
                labelX1 = pointX - 15 - labelWidth;
                labelY1 = pointY + 15;
            } else {
                labelX1 = pointX + 15;
                labelY1 = pointY + 15;
            }

            labelX2 = labelX1 + labelWidth;
            labelY2 = labelY1 + labelHeight;

            if (labelX1 < 0 || labelX2 > chartWidth || labelY1 < 0 || labelY2 > chartHeight) {
                continue;
            }

            for (const p of allPoints) {
                if (p === d) continue;

                const pX = xScale(p[yField]);
                const pY = yScale(p[y2Field]);

                const pointRadius = circleRadius;
                const dx = labelX1 + labelWidth/2 - pX;
                const dy = labelY1 + labelHeight/2 - pY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < pointRadius + Math.sqrt(labelWidth * labelWidth + labelHeight * labelHeight) / 2) {
                    hasOverlap = true;
                    break;
                }

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

        return { ...positions[0], canShow: false };
    };

    // 数据提取
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const dataColumns = jsonData.data.columns || [];
    const colors = jsonData.colors;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const y2Field = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 25, right: 25, bottom: 50, left: 50 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 创建比例尺
    const xExtent = d3.extent(chartData, d => d[yField]);
    const yExtent = d3.extent(chartData, d => d[y2Field]);
    
    // 检查数据分布特征
    const hasNegativeOrZeroValues = (data, field) => data.some(d => d[field] < 1);
    const isDistributionUneven = (data, field) => {
        const values = data.map(d => d[field]);
        const extent = d3.extent(values);
        const range = extent[1] - extent[0];
        const median = d3.median(values);
        const q1 = d3.quantile(values.sort(d3.ascending), 0.25);
        const q3 = d3.quantile(values.sort(d3.ascending), 0.75);
        const iqr = q3 - q1;
        return range > iqr * 3 || Math.abs(median - (extent[0] + extent[1])/2) > range * 0.2;
    };
    
    // X轴比例尺
    const xHasNegativeOrZero = hasNegativeOrZeroValues(chartData, yField);
    const xIsUneven = isDistributionUneven(chartData, yField);
    
    const xScale = (!xHasNegativeOrZero && xIsUneven) 
        ? d3.scaleLog()
            .domain([Math.max(xExtent[0] * 0.9, 0.1), xExtent[1] * 1.1])
            .range([0, chartWidth])
        : d3.scaleLinear()
            .domain([xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1])
            .range([0, chartWidth]);
            
    // Y轴比例尺
    const yHasNegativeOrZero = hasNegativeOrZeroValues(chartData, y2Field);
    const yIsUneven = isDistributionUneven(chartData, y2Field);
    
    const yScale = (!yHasNegativeOrZero && yIsUneven)
        ? d3.scaleLog()
            .domain([Math.max(yExtent[0] * 0.9, 0.1), yExtent[1] * 1.1])
            .range([chartHeight, 0])
        : d3.scaleLinear()
            .domain([yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1])
            .range([chartHeight, 0]);
    
    // 创建坐标轴
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3.axisLeft(yScale).tickSize(0).tickPadding(10);
    
    // 添加X轴
    const xAxisGroup = g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("path")
        .style("stroke", colors.text_color)
        .style("stroke-width", 1)
        .style("opacity", 0.5);

    xAxisGroup.selectAll("text")
        .style("color", colors.text_color)
        .attr("class", "value");
        
    // 添加Y轴
    const yAxisGroup = g.append("g")
        .attr("class", "axis")
        .call(yAxis);

    yAxisGroup.selectAll("path")
        .style("stroke", colors.text_color)
        .style("stroke-width", 1)
        .style("opacity", 0.5);

    yAxisGroup.selectAll("text")
        .style("color", colors.text_color)
        .attr("class", "value");
    
    // 添加轴标题
    g.append("text")
        .attr("class", "text")
        .attr("x", chartWidth)
        .attr("y", chartHeight + margin.bottom / 2 + 15)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(yField);
        
    g.append("text")
        .attr("class", "text")
        .attr("transform", "rotate(-90)")
        .attr("x", -margin.top)
        .attr("y", -margin.left / 2 - 20)
        .attr("text-anchor", "end")
        .attr("font-size", 13)
        .text(y2Field);
    
    // 创建提示框
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // 确定圆圈大小 - 优化的半径计算逻辑
    const numPoints = chartData.length;
    let circleRadius;
    
    if (numPoints <= 10) {
        circleRadius = 18 - numPoints * 0.6;
    } else {
        circleRadius = 12 - (numPoints - 10) * 0.3;
    }
    
    // 确保半径在合理范围内
    circleRadius = Math.max(1.5, Math.min(18, circleRadius));
    
    // 添加数据点
    const points = g.selectAll(".data-point")
        .data(chartData)
        .enter()
        .append("g")
        .attr("class", "data-point")
        .attr("transform", d => `translate(${xScale(d[yField])}, ${yScale(d[y2Field])})`);
    
    
    // 添加彩色数据点圆圈
    points.append("circle")
        .attr("class", "mark")
        .attr("r", circleRadius)
        .attr("fill", colors.other.primary)
    
    // 计算所有标签的最优位置
    let labelPositions = {};
    chartData.forEach(d => {
        labelPositions[d[xField]] = findOptimalPosition(d, chartData, labelPositions);
    });

    // 添加优化位置的标签
    points.append("text")
        .attr("class", "label")
        .attr("x", d => labelPositions[d[xField]].x)
        .attr("y", d => labelPositions[d[xField]].y)
        .attr("text-anchor", d => labelPositions[d[xField]].anchor)
        .style("font-family", typography.label.font_family)
        .style("font-size", 10)
        .style("font-weight", typography.label.font_weight)
        .style("opacity", d => labelPositions[d[xField]].canShow ? 1 : 0)
        .text(d => d[xField]);

    return svg.node();
}
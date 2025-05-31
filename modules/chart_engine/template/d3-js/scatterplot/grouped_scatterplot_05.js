/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Grouped Scatterplot",
    "chart_name": "grouped_scatterplot_05",
    "required_fields": ["x", "y", "y2", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[8, 150], [0, "inf"], [0, "inf"], [2, 6]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": [],
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
    const effects = variables.effects || {};
    
    // 强制启用阴影效果和网格线，确保它们始终显示
    const hasShadow = true; // 将其设置为true，不再依赖effects.shadow
    const hasGridlines = true;
    
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
    const margin = { top: 50, right: 25, bottom: 50, left: 50 };
    
    // 设置标记大小和圆角效果（移到前面定义）
    const squareSize = 24; // 正方形的尺寸
    const cornerRadius = effects.radius_corner ? 3 : 0; // 圆角半径，根据效果设置
    
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
    
    // 获取分组列表（只在一个地方定义，避免重复）
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 创建定义区域，用于存放图标和滤镜
    const defs = svg.append("defs");
        
    // 预先为每个分组定义图标，避免重复
    groups.forEach((group, i) => {
        // 如果有图标，添加到defs中以便复用
        if (images.field && images.field[group]) {
            defs.append("image")
                .attr("id", `icon-${i}`)
                .attr("xlink:href", images.field[group])
                .attr("width", squareSize)
                .attr("height", squareSize)
                .attr("x", -squareSize/2)
                .attr("y", -squareSize/2);
        }
    });
    
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
    
    // 格式化数值的函数，处理对数刻度和小数值的情况
    function formatAxisValue(value) {
        // 检查是否为小数值（小于1但大于0）
        if (value > 0 && value < 1) {
            // 对于小数值，选择合适的精度
            if (value < 0.01) {
                return value.toFixed(3);
            } else if (value < 0.1) {
                return value.toFixed(2);
            } else {
                return value.toFixed(1);
            }
        }
        
        // 对于大数使用 SI 前缀 (k, M, G 等)
        if (value >= 1000) {
            // 1000 -> 1k, 1500 -> 1.5k, etc.
            const lookup = [
                { value: 1, symbol: "" },
                { value: 1e3, symbol: "k" },
                { value: 1e6, symbol: "M" },
                { value: 1e9, symbol: "G" }
            ];
            const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
            const item = lookup.slice().reverse().find(function(item) {
                return value >= item.value;
            });
            return item ? (value / item.value).toFixed(1).replace(rx, "$1") + item.symbol : "0";
        }
        
        // 对于其他值，自动确定小数位数
        const absValue = Math.abs(value);
        if (absValue >= 100) {
            return value.toFixed(0);
        } else if (absValue >= 10) {
            return value.toFixed(1);
        } else {
            return value.toFixed(2);
        }
    }
    
    // 添加网格线 - 白色半透明网格线，直接控制网格线数量
    if (hasGridlines) {
        // 定义固定的网格线数量，无论是线性还是对数刻度
        const xGridCount = 8; // X轴固定8条网格线
        const yGridCount = 6; // Y轴固定6条网格线
        
        // 手动计算网格线位置，确保在对数刻度下也有固定数量
        function generateGridPositions(scale, count, domain) {
            const min = domain[0];
            const max = domain[1];
            const isLog = scale.constructor.name.includes('Log');
            
            if (isLog) {
                // 对数刻度下创建均匀分布的网格线
                const logMin = Math.log10(Math.max(min, 0.1)); // 保护性处理，避免负数或0
                const logMax = Math.log10(max);
                const step = (logMax - logMin) / (count - 1);
                
                return Array.from({length: count}, (_, i) => {
                    return Math.pow(10, logMin + step * i);
                });
            } else {
                // 线性刻度下创建均匀分布的网格线
                const step = (max - min) / (count - 1);
                return Array.from({length: count}, (_, i) => min + step * i);
            }
        }
        
        // 生成网格线位置
        const xGridPositions = generateGridPositions(
            xScale, 
            xGridCount, 
            [xExtent[0] - (xExtent[1] - xExtent[0]) * 0.1, xExtent[1] + (xExtent[1] - xExtent[0]) * 0.1]
        );
        
        const yGridPositions = generateGridPositions(
            yScale, 
            yGridCount, 
            [yExtent[0] - (yExtent[1] - yExtent[0]) * 0.1, yExtent[1] + (yExtent[1] - yExtent[0]) * 0.1]
        );
        
        // 添加垂直网格线，使用固定数量的位置
        g.append("g")
            .attr("class", "grid x-grid")
            .attr("transform", `translate(0, ${chartHeight})`)
            .call(d3.axisBottom(xScale)
                .tickSize(-chartHeight)
                .tickFormat("")
                .tickValues(xGridPositions) // 使用固定数量的位置
            )
            .selectAll("line")
            .style("stroke", "white")
            .style("stroke-width", 1.0)
            .style("stroke-opacity", 0.5)
            .style("stroke-dasharray", "none");

        // 添加水平网格线，使用固定数量的位置
        g.append("g")
            .attr("class", "grid y-grid")
            .call(d3.axisLeft(yScale)
                .tickSize(-chartWidth)
                .tickFormat("")
                .tickValues(yGridPositions) // 使用固定数量的位置
            )
            .selectAll("line")
            .style("stroke", "white")
            .style("stroke-width", 1.0)
            .style("stroke-opacity", 0.5)
            .style("stroke-dasharray", "none");

        // 隐藏网格线轴的路径
        g.selectAll(".grid path")
            .style("stroke", "none");
            
        // 确保网格线显示在数据点下方
        g.selectAll(".grid").lower();
    }
    
    // Create axes with自定义格式化 - 限制tick数量，但确保显示一定数量
    const xAxis = d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10)
        .ticks((!xHasNegativeOrZero && xIsUneven) ? 5 : 6) // 对数刻度使用较少的刻度
        .tickFormat(d => formatAxisValue(d));
        
    const yAxis = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .ticks((!yHasNegativeOrZero && yIsUneven) ? 5 : 6) // 对数刻度使用较少的刻度
        .tickFormat(d => formatAxisValue(d));
    
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
        
    // 对于对数刻度，更智能地过滤刻度标签，确保至少显示关键点
    if (!xHasNegativeOrZero && xIsUneven) {
        // 获取所有刻度值
        const ticks = xAxisGroup.selectAll(".tick").data();
        const visibleTicks = new Set();
        
        // 确保显示范围端点
        if (ticks.length > 0) {
            visibleTicks.add(ticks[0]);
            visibleTicks.add(ticks[ticks.length - 1]);
        }
        
        // 添加10的整数幂刻度点
        ticks.forEach(d => {
            const log10 = Math.log10(d);
            if (Math.abs(log10 - Math.round(log10)) < 0.01) {
                visibleTicks.add(d);
            }
        });
        
        // 如果可见刻度太少，添加一些中间值
        if (visibleTicks.size < 3 && ticks.length > 3) {
            // 添加中间点
            const middleIndex = Math.floor(ticks.length / 2);
            visibleTicks.add(ticks[middleIndex]);
        }
        
        // 隐藏不需要的刻度标签
        xAxisGroup.selectAll(".tick text").each(function(d) {
            if (!visibleTicks.has(d)) {
                d3.select(this).style("display", "none");
            }
        });
    }
    
    if (!yHasNegativeOrZero && yIsUneven) {
        // 获取所有刻度值
        const ticks = yAxisGroup.selectAll(".tick").data();
        const visibleTicks = new Set();
        
        // 确保显示范围端点
        if (ticks.length > 0) {
            visibleTicks.add(ticks[0]);
            visibleTicks.add(ticks[ticks.length - 1]);
        }
        
        // 添加10的整数幂刻度点
        ticks.forEach(d => {
            const log10 = Math.log10(d);
            if (Math.abs(log10 - Math.round(log10)) < 0.01) {
                visibleTicks.add(d);
            }
        });
        
        // 如果可见刻度太少，添加一些中间值
        if (visibleTicks.size < 3 && ticks.length > 3) {
            // 添加中间点
            const middleIndex = Math.floor(ticks.length / 2);
            visibleTicks.add(ticks[middleIndex]);
        }
        
        // 隐藏不需要的刻度标签
        yAxisGroup.selectAll(".tick text").each(function(d) {
            if (!visibleTicks.has(d)) {
                d3.select(this).style("display", "none");
            }
        });
    }
    
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
    
    // Create tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    
    // 计算标签边界的辅助函数（移到外层作用域）
    function calculateLabelBounds(pointX, pointY, position, labelWidth, labelHeight) {
        let labelX1, labelY1;
        
        if (position.priority === 1) { // right
            labelX1 = pointX + 20;
            labelY1 = pointY - labelHeight/2;
        } else if (position.priority === 2) { // top
            labelX1 = pointX - labelWidth / 2;
            labelY1 = pointY - 20 - labelHeight;
        } else if (position.priority === 3) { // left
            labelX1 = pointX - 20 - labelWidth;
            labelY1 = pointY - labelHeight/2;
        } else if (position.priority === 4) { // bottom
            labelX1 = pointX - labelWidth / 2;
            labelY1 = pointY + 20;
        } else if (position.priority === 5) { // top-right
            labelX1 = pointX + 15;
            labelY1 = pointY - 15 - labelHeight;
        } else if (position.priority === 6) { // top-left
            labelX1 = pointX - 15 - labelWidth;
            labelY1 = pointY - 15 - labelHeight;
        } else if (position.priority === 7) { // bottom-left
            labelX1 = pointX - 15 - labelWidth;
            labelY1 = pointY + 20;
        } else { // bottom-right
            labelX1 = pointX + 15;
            labelY1 = pointY + 20;
        }
        
        return {
            x1: labelX1,
            y1: labelY1,
            x2: labelX1 + labelWidth,
            y2: labelY1 + labelHeight
        };
    }
    
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
    
    // 添加数据点
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
        .attr("xlink:href", d => images.field[d[groupField]])
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
    
    // Add interactivity
    points
        .on("mouseover", function(event, d) {
            const markGroup = d3.select(this).select(".mark-group");
            
            // 判断是使用图标还是圆形，分别处理放大效果
            if (markGroup.select("use").size() > 0) {
                markGroup.select("use")
                    .transition()
                    .duration(200)
                    .attr("transform", "scale(1.2)");
            } else if (markGroup.select("circle").size() > 0) {
                markGroup.select("circle")
                    .transition()
                    .duration(200)
                    .attr("r", squareSize * 0.6);
            }
                
            d3.select(this).select(".data-label")
                .style("font-weight", "bold");
                
            // 格式化工具提示中的数值
            const yValueFormatted = formatAxisValue(d[yField]);
            const y2ValueFormatted = formatAxisValue(d[y2Field]);
                
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
            tooltip.html(`<strong>${d[xField]}</strong><br/>${yField}: ${yValueFormatted}<br/>${y2Field}: ${y2ValueFormatted}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            const markGroup = d3.select(this).select(".mark-group");
            
            // 判断是使用图标还是圆形，分别处理还原效果
            if (markGroup.select("use").size() > 0) {
                markGroup.select("use")
                    .transition()
                    .duration(200)
                    .attr("transform", "scale(1)");
            } else if (markGroup.select("circle").size() > 0) {
                markGroup.select("circle")
                    .transition()
                    .duration(200)
                    .attr("r", squareSize/2);
            }
                
            d3.select(this).select(".data-label")
                .style("font-weight", "normal");
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
    
    // 图例配置参数
    const legendFontSize = parseFloat(typography.label?.font_size || 12);
    const legendFontWeight = typography.label?.font_weight || "normal";
    const legendFontFamily = typography.label?.font_family || "Arial";
    const legendColor = colors.text_color || "#333333";
    const legendSquareSize = 20; // 图例方块尺寸
    const legendItemPadding = 5; // 方块与文本间距
    const legendColumnPadding = 20; // 图例项间距
    
    // 创建图例组，标题放在左侧
    if (groups.length > 0) {
        // 创建图例容器
        const legendGroup = svg.append("g").attr("class", "chart-legend");
        
        // 设置图例位置
        let legendStartX = margin.left;
        const legendY = 20; // 图例垂直位置在顶部
        
        // 添加图例标题
        const legendTitle = legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", legendStartX)
            .attr("y", legendY)
            .attr("dominant-baseline", "middle")
            .style("font-family", legendFontFamily)
            .style("font-size", `${legendFontSize + 1}px`)
            .style("font-weight", "bold")
            .style("fill", legendColor)
            .text(groupField + ":");
            
        // 计算标题宽度并调整后续图例项的起始位置
        const titleWidth = legendTitle.node().getComputedTextLength();
        legendStartX += titleWidth + 15; // 标题后添加一些间距
        
        // 在同一行添加图例项
        const legendItems = legendGroup.append("g")
            .attr("transform", `translate(${legendStartX}, 0)`);
            
        let currentX = 0;
        let totalLegendWidth = 0;
        
        // 预先计算所有图例项的总宽度
        groups.forEach(group => {
            // 创建临时文本元素来计算宽度
            const tempText = legendItems.append("text")
                .style("font-family", legendFontFamily)
                .style("font-size", `${legendFontSize}px`)
                .text(group);
                
            const textWidth = tempText.node().getComputedTextLength();
            tempText.remove(); // 移除临时元素
            
            totalLegendWidth += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
        });
        
        totalLegendWidth -= legendColumnPadding; // 减去最后一个多余的间距
        
        // 添加图例背景和边框 (在添加图例项之前)
        const legendPadding = 10; // 图例内边距
        const legendBgWidth = totalLegendWidth + (legendPadding * 2);
        const legendBgHeight = legendSquareSize + (legendPadding * 2);
        const legendBgX = legendStartX - legendPadding;
        const legendBgY = legendY - legendBgHeight/2;
        
        // 添加带圆角的背景矩形
        legendGroup.insert("rect", ":first-child")
            .attr("class", "legend-background")
            .attr("x", legendBgX)
            .attr("y", legendBgY)
            .attr("width", legendBgWidth)
            .attr("height", legendBgHeight)
            .attr("rx", 8) // 圆角半径
            .attr("ry", 8)
            .style("fill", "rgba(255, 255, 255, 0.8)") // 半透明白色背景
            .style("stroke", "#dddddd") // 轻微的边框
            .style("stroke-width", 1.5);
            
        // 添加图例项
        groups.forEach(group => {
            const legendItem = legendItems.append("g")
                .attr("transform", `translate(${currentX}, 0)`);
                
            // 图例标记（图标或圆形）
            const groupIndex = groups.indexOf(group);
            
            if (images.field && images.field[group]) {
                // 检查defs中是否已定义图标
                const iconExists = defs.select(`#icon-${groupIndex}`).size() > 0;
                
                if (iconExists) {
                    // 使用use元素引用现有图标
                    legendItem.append("use")
                        .attr("xlink:href", `#icon-${groupIndex}`)
                        .attr("transform", `translate(${legendSquareSize/2}, ${legendY}) scale(1)`)
                        .style("opacity", 0.9)
                        .on("error", function() {
                            // 图标加载失败时替换为彩色圆形
                            d3.select(this).remove();
                            legendItem.append("circle")
                                .attr("cx", legendSquareSize/2)
                                .attr("cy", legendY)
                                .attr("r", legendSquareSize/2)
                                .attr("fill", colors.field[group])
                                .style("opacity", 0.8);
                        });
                } else {
                    // 使用彩色圆形
                    legendItem.append("circle")
                        .attr("cx", legendSquareSize/2)
                        .attr("cy", legendY)
                        .attr("r", legendSquareSize/2)
                        .attr("fill", colors.field[group])
                        .style("opacity", 0.8);
                }
            } else {
                // 使用彩色圆形
                legendItem.append("circle")
                    .attr("cx", legendSquareSize/2)
                    .attr("cy", legendY)
                    .attr("r", legendSquareSize/2)
                    .attr("fill", colors.field[group])
                    .style("opacity", 0.8);
            }
            
            // 如果有阴影效果，为图例添加阴影
            if (hasShadow) {
                const groupIndex = groups.indexOf(group);
                // 为图例项添加阴影，无论是图标还是圆形
                legendItem.attr("filter", `url(#shadow-${groupIndex})`);
            }
            
            // 图例文本
            const legendText = legendItem.append("text")
                .attr("x", legendSquareSize + legendItemPadding)
                .attr("y", legendY)
                .attr("dominant-baseline", "middle")
                .style("font-family", legendFontFamily)
                .style("font-size", `${legendFontSize}px`)
                .style("font-weight", legendFontWeight)
                .style("fill", legendColor)
                .text(group);
                
            // 计算这一项的宽度，为下一项定位
            const textWidth = legendText.node().getComputedTextLength();
            currentX += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
        });
    }
    
    // 统一处理轴标签格式化
    function applyFormattedAxisLabels(axisGroup) {
        axisGroup.selectAll(".tick text")
            .each(function(d) {
                const formattedValue = formatAxisValue(d);
                d3.select(this).text(formattedValue);
            });
    }
    
    // 修改轴标签格式
    applyFormattedAxisLabels(xAxisGroup);
    applyFormattedAxisLabels(yAxisGroup);
    
    return svg.node();
}
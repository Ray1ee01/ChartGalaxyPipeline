/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Spline Graph",
    "chart_name": "spline_graph_plain_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// 单条线spline_graph_plain_chart_01
function makeChart(containerSelector, data) {
    // ---------- 辅助函数 ----------
    // 解析日期
    const parseDate = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1);
        if (typeof d === 'string') {
            const parts = d.split('-');
            
            // YYYY-MM-DD 格式
            if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);
                return new Date(year, month, day);
            }
            
            // YYYY-MM 格式
            if (parts.length === 2) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                return new Date(year, month, 1);
            }
            
            // YYYY 格式
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
                const year = parseInt(parts[0]);
                return new Date(year, 0, 1);
            }
        }
        return new Date();
    };

    // 创建智能日期比例尺和刻度
    const createXAxisScaleAndTicks = (data, xField, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
        // 解析所有日期
        const dates = data.map(d => parseDate(d[xField]));
        const xExtent = d3.extent(dates);
        const xRange = xExtent[1] - xExtent[0];
        const xPadding = xRange * padding;
        
        // 创建比例尺
        const xScale = d3.scaleTime()
            .domain([
                new Date(xExtent[0].getTime() - xPadding),
                new Date(xExtent[1].getTime() + xPadding)
            ])
            .range([rangeStart, rangeEnd]);
        
        // 计算日期跨度（毫秒）
        const timeSpan = xExtent[1] - xExtent[0];
        const daySpan = timeSpan / (1000 * 60 * 60 * 24);
        const monthSpan = daySpan / 30;
        const yearSpan = daySpan / 365;
        
        // 根据跨度选择合适的时间间隔
        let timeInterval;
        let formatFunction;
        
        if (yearSpan > 35) {
            timeInterval = d3.timeYear.every(10);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 15) {
            timeInterval = d3.timeYear.every(5);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 7) {
            timeInterval = d3.timeYear.every(2);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 2) {
            timeInterval = d3.timeYear.every(1);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 1) {
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => {
                const month = d.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                return `${d.getFullYear().toString().slice(-2)}Q${quarter}`;
            };
        } else if (monthSpan > 6) {
            timeInterval = d3.timeMonth.every(1);
            formatFunction = d => d3.timeFormat("%m %Y")(d);
        } else if (monthSpan > 2) {
            timeInterval = d3.timeWeek.every(1);
            formatFunction = d => d3.timeFormat("%d %m")(d);
        } else {
            const dayInterval = Math.max(1, Math.ceil(daySpan / 10));
            timeInterval = d3.timeDay.every(dayInterval);
            formatFunction = d => d3.timeFormat("%d %m")(d);
        }
        
        // 生成刻度
        const xTicks = xScale.ticks(timeInterval);
        
        // 确保包含最后一个日期
        if (xTicks.length > 0 && xTicks[xTicks.length - 1] < xExtent[1]) {
            if (xTicks.length > 7) {
                xTicks.pop();
            }
            xTicks.push(xExtent[1]);
        }
        
        return {
            xScale: xScale,
            xTicks: xTicks,
            xFormat: formatFunction
        };
    };

    // 计算文本宽度
    const getTextWidth = (text, fontSize) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize}px Arial`;
        const metrics = context.measureText(text);
        const width = metrics.width;
        canvas.remove();
        return width;
    };

    // 找到最接近刻度的数据点
    const findTickDataPoints = (chartData, xField, xTicks) => {
        const tickDataPoints = [];
        
        xTicks.forEach(tick => {
            // 找到最接近这个刻度时间的数据点
            let closestPoint = null;
            let minDistance = Infinity;
            
            chartData.forEach(d => {
                const dataDate = parseDate(d[xField]);
                const distance = Math.abs(dataDate.getTime() - tick.getTime());
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = d;
                }
            });
            
            if (closestPoint) {
                tickDataPoints.push(closestPoint);
            }
        });
        
        // 去重（避免同一个数据点被多次选中）
        const uniquePoints = [];
        const addedPoints = new Set();
        
        tickDataPoints.forEach(point => {
            const key = `${point[xField]}-${point[yField]}`;
            if (!addedPoints.has(key)) {
                addedPoints.add(key);
                uniquePoints.push(point);
            }
        });
        
        return uniquePoints;
    };
    
    // ---------- 主要代码 ----------
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 80, bottom: 80, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;");
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // 添加渐变效果
    const defs = svg.append("defs");

    // 添加网格背景渐变
    const gridGradient = defs.append("linearGradient")
        .attr("class", "background")
        .attr("id", "grid-background-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "0%").attr("y2", "100%");
        
    gridGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#1e90ff")
        .attr("stop-opacity", 0);
        
    gridGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1e90ff")
        .attr("stop-opacity", 0.15);

    // 添加网格背景矩形
    g.append("rect")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "url(#grid-background-gradient)")
        .attr("class", "background")
        .attr("rx", 0).attr("ry", 0);

    // 创建比例尺
    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // Y轴比例尺，支持负值
    const yScale = d3.scaleLinear()
        .domain([
            Math.min(0, d3.min(chartData, d => d[yField]) * 1.1),
            d3.max(chartData, d => d[yField]) * 1.2 // 给数值标签留出空间
        ])
        .range([innerHeight, 0]);
    
    // 获取线条颜色
    const lineColor = colors.primary || "#1e90ff";
    
    // 添加网格线
    const yTicks = yScale.ticks(5);
    const gridExtension = 5;

    // 水平网格线
    g.selectAll("line.gridline-y")
        .data(yTicks)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", -gridExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 1)
        .attr("opacity", 0.15);

    // 垂直网格线
    g.selectAll("line.gridline-x")
        .data(xTicks.filter((d, i) => i > 0 && i < xTicks.length - 1))
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight + 10)
        .attr("stroke", "#1e90ff")
        .attr("stroke-width", 1)
        .attr("opacity", 0.15);
    
    // 创建曲线生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX);

    // 绘制线条
    g.append("path")
        .datum(chartData)
        .attr("class", "mark")
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 3)
        .attr("d", line);
    
    // 找到与刻度对应的数据点
    const tickDataPoints = findTickDataPoints(chartData, xField, xTicks);
    
    // 只在刻度位置添加数据点圆圈和标签
    tickDataPoints.forEach(d => {
        const cx = xScale(parseDate(d[xField]));
        const cy = yScale(d[yField]);
        const value = d[yField];
        
        // 空心圆
        g.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", 8)
            .attr("class", "mark")
            .attr("fill", "white")
            .attr("stroke", lineColor)
            .attr("stroke-width", 3);
        
        // 数值标签
        g.append("text")
            .attr("x", cx)
            .attr("y", cy - 15)
            .attr("text-anchor", "middle")
            .attr("class", "value")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${parseInt(typography.label.font_size) + 2}px`)
            .style("font-weight", "bold")
            .style("fill", lineColor)
            .text(Math.round(value));
    });
    
    // X轴标签
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", innerHeight + 25)
            .attr("text-anchor", "middle")
            .attr("class", "label")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#333333")
            .text(xFormat(tick));
    });
    
    // Y轴标签
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -gridExtension - 5)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("class", "value")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", "#333333")
            .text(tick);
    });

    // 添加Y轴字段标签
    const maxYTick = yTicks[yTicks.length - 1];
    const maxYPos = yScale(maxYTick);
    
    const labelGroup = g.append("g")
        .attr("transform", `translate(${-margin.left + 35}, ${maxYPos - 40})`);

    const labelText = yField;
    const labelPadding = 20;
    const textWidth = getTextWidth(labelText, typography.label.font_size);
    const labelWidth = textWidth + 2 * labelPadding;
    const labelHeight = 20;
    const triangleHeight = 6;

    const labelPath = `
        M 0,0 
        H ${labelWidth} 
        V ${labelHeight} 
        H ${labelWidth/2 + triangleHeight} 
        L ${labelWidth/2},${labelHeight + triangleHeight} 
        L ${labelWidth/2 - triangleHeight},${labelHeight} 
        H 0 
        Z
    `;

    labelGroup.append("path")
        .attr("d", labelPath)
        .attr("fill", "transparent")
        .attr("stroke", "#333333")
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5)
        .attr("class", "other");

    labelGroup.append("text")
        .attr("x", labelWidth/2)
        .attr("y", labelHeight/2 + 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("class", "text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("fill", "#333333")
        .text(labelText);
    
    return svg.node();
}


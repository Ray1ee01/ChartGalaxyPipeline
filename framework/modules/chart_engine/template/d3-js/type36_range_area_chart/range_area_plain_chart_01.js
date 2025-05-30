/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Range Area Chart",
    "chart_name": "range_area_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "overlay",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "comparison"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 内联utils函数
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

    const createXAxisScaleAndTicks = (data, xField, rangeStart = 0, rangeEnd = 100) => {
        const dates = data.map(d => parseDate(d[xField]));
        const xExtent = d3.extent(dates);
        const xRange = xExtent[1] - xExtent[0];
        const xPadding = xRange * 0.05;
        
        const xScale = d3.scaleTime()
            .domain([new Date(xExtent[0].getTime() - xPadding), new Date(xExtent[1].getTime() + xPadding)])
            .range([rangeStart, rangeEnd]);
        
        const timeSpan = xExtent[1] - xExtent[0];
        const yearSpan = timeSpan / (1000 * 60 * 60 * 24 * 365);
        
        let timeInterval, formatFunction;
        if (yearSpan > 7) {
            timeInterval = d3.timeYear.every(2);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 2) {
            timeInterval = d3.timeYear.every(1);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else {
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => d3.timeFormat("%Y-%m")(d);
        }
        
        const xTicks = xScale.ticks(timeInterval);
        if (xTicks.length > 0 && xTicks[xTicks.length - 1] < xExtent[1]) {
            if (xTicks.length > 7) xTicks.pop();
            xTicks.push(xExtent[1]);
        }
        
        return { xScale, xTicks, xFormat: formatFunction };
    };

    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 60, bottom: 60, left: 120 }; // 增加左边距为label留空间
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 分离两个组的数据
    const groupNames = [...new Set(chartData.map(d => d[groupField]))];
    
    // 计算每个组的平均值并排序
    const groupAverages = groupNames.map(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        const avg = d3.mean(groupData, d => d[yField]);
        return { group, avg };
    }).sort((a, b) => b.avg - a.avg);
    
    // 选择平均值最高和最低的组
    const highestGroup = groupAverages[0].group;
    const lowestGroup = groupAverages[groupAverages.length - 1].group;
    
    // 获取这两个组的数据并排序
    const group1Data = chartData.filter(d => d[groupField] === highestGroup)
        .sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    const group2Data = chartData.filter(d => d[groupField] === lowestGroup)
        .sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    
    const selectedGroupNames = [highestGroup, lowestGroup];

    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 创建y轴比例尺
    const yMin = Math.max(0, d3.min(chartData, d => d[yField]));
    const yMax = d3.max(chartData, d => d[yField]);
    const yPadding = 0.3 * (yMax - yMin);
    
    const yScale = d3.scaleLinear()
        .domain([yMin - yPadding, yMax + yPadding])
        .range([chartHeight, 0]);
    
    // 添加水平网格线和y轴刻度
    const yTicks = d3.ticks(yMin - yPadding, yMax + yPadding, 5);
    yTicks.forEach(tick => {
        if (tick > 0) {
            g.append("line")
                .attr("class", "gridline")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", chartWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", "#cccccc")
                .attr("stroke-width", 1);
        }
        
        g.append("text")
            .attr("class", "value")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "10px")
            .style("fill", "#222222")
            .text(d3.format(",.0f")(tick));
    });
    
    // 添加x轴刻度标签
    xTicks.forEach(tick => {
        g.append("text")
            .attr("class", "value")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 15)
            .attr("text-anchor", "start")
            .style("font-family", "Arial")
            .style("font-size", "10px")
            .style("fill", "#222222")
            .text(xFormat(tick));
    });

    // 添加坐标轴
    g.append("line")
        .attr("class", "axis")
        .attr("x1", 0)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#666666")
        .attr("stroke-width", 1);
    
    g.append("line")
        .attr("class", "axis")
        .attr("x1", 0)
        .attr("y1", yScale(d3.max(yTicks)))
        .attr("x2", 0)
        .attr("y2", chartHeight)
        .attr("stroke", "#222222")
        .attr("stroke-width", 1);
    
    // 添加y轴标题
    g.append("text")
        .attr("class", "text")
        .attr("x", -40)
        .attr("y", yScale(d3.max(yTicks)) - 25)
        .attr("text-anchor", "start")
        .style("font-family", "Arial")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#222222")
        .text(`${dataColumns[1].description} ${d3.min(chartData, d => parseDate(d[xField]).getFullYear())}-${d3.max(chartData, d => parseDate(d[xField]).getFullYear())}`);

    g.append("text")
        .attr("class", "text")
        .attr("x", -40)
        .attr("y", yScale(d3.max(yTicks)) - 12)
        .attr("text-anchor", "start")
        .style("font-family", "Arial")
        .style("font-size", "10px")
        .style("fill", "#222222")
        .text(dataColumns[1].name);
    
    // 创建线条和面积生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]));
    
    const area = d3.area()
        .x(d => xScale(parseDate(d[xField])))
        .y0(d => yScale(d.group2Value))
        .y1(d => yScale(d.group1Value));
    
    // 创建合并的数据集用于面积图
    const areaData = [];
    
    // 找到共同的时间点
    const commonDates = group1Data.map(d => d[xField]).filter(date => 
        group2Data.some(d2 => d2[xField] === date)
    );
    
    // 按时间排序构建面积数据
    commonDates.sort((a, b) => parseDate(a) - parseDate(b)).forEach(date => {
        const group1Item = group1Data.find(d => d[xField] === date);
        const group2Item = group2Data.find(d => d[xField] === date);
        
        if (group1Item && group2Item) {
            areaData.push({
                [xField]: date,
                group1Value: group1Item[yField],
                group2Value: group2Item[yField]
            });
        }
    });
    
    // 绘制面积
    g.append("path")
        .attr("class", "mark")
        .datum(areaData)
        .attr("fill", colors.available_colors?.[0] || "#ebbc48")
        .attr("d", area);
    
    // 绘制线条1（高值组）
    g.append("path")
        .attr("class", "mark")
        .datum(group1Data)
        .attr("fill", "none")
        .attr("stroke", colors.field[selectedGroupNames[0]])
        .attr("stroke-width", 3)
        .attr("d", line);
    
    // 绘制线条2（低值组）
    g.append("path")
        .attr("class", "mark")
        .datum(group2Data)
        .attr("fill", "none")
        .attr("stroke", colors.field[selectedGroupNames[1]])
        .attr("stroke-width", 3)
        .attr("d", line);
    
    // 添加组标签到线的左侧
    const firstPoint1 = group1Data[0];
    const firstPoint2 = group2Data[0];
    const lastPoint1 = group1Data[group1Data.length - 1];
    const lastPoint2 = group2Data[group2Data.length - 1];
    
    // 高值组标签（左侧）
    g.append("text")
        .attr("class", "label")
        .attr("x", -15)
        .attr("y", yScale(firstPoint1[yField]))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[0]])
        .text(selectedGroupNames[0]);
    
    // 低值组标签（左侧）
    g.append("text")
        .attr("class", "label")
        .attr("x", -15)
        .attr("y", yScale(firstPoint2[yField]))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[1]])
        .text(selectedGroupNames[1]);
    
    // 添加起始和终点数值标签
    g.append("text")
        .attr("class", "value")
        .attr("x", xScale(parseDate(firstPoint1[xField])) - 10)
        .attr("y", yScale(firstPoint1[yField]))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[0]])
        .text(d3.format(",.0f")(firstPoint1[yField]));
    
    g.append("text")
        .attr("class", "value")
        .attr("x", xScale(parseDate(firstPoint2[xField])) - 10)
        .attr("y", yScale(firstPoint2[yField]))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[1]])
        .text(d3.format(",.0f")(firstPoint2[yField]));
    
    g.append("text")
        .attr("class", "value")
        .attr("x", xScale(parseDate(lastPoint1[xField])) + 10)
        .attr("y", yScale(lastPoint1[yField]))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[0]])
        .text(d3.format(",.0f")(lastPoint1[yField]));
    
    g.append("text")
        .attr("class", "value")
        .attr("x", xScale(parseDate(lastPoint2[xField])) + 10)
        .attr("y", yScale(lastPoint2[yField]))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", colors.field[selectedGroupNames[1]])
        .text(d3.format(",.0f")(lastPoint2[yField]));
    
    
    
    return svg.node();
} 
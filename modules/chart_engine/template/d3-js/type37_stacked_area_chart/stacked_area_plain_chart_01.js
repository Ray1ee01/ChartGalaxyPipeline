/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stacked Area Chart",
    "chart_name": "stacked_area_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], [0, "inf"], [2, 10]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "no",
    "icon_mark": "overlay",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
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
            // 超过35年，每10年一个刻度
            timeInterval = d3.timeYear.every(10);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 15) {
            // 超过15年，每5年一个刻度
            timeInterval = d3.timeYear.every(5);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 7) {
            // 超过7年，每2年一个刻度  
            timeInterval = d3.timeYear.every(2);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 2) {
            // 2-7年，每年一个刻度
            timeInterval = d3.timeYear.every(1);
            formatFunction = d => d3.timeFormat("%Y")(d);
        } else if (yearSpan > 1) {
            // 1-2年，每季度一个刻度
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => {
                const month = d.getMonth();
                const quarter = Math.floor(month / 3) + 1;
                return `${d.getFullYear().toString().slice(-2)}Q${quarter}`;
            };
        } else if (monthSpan > 6) {
            // 6个月-1年，每月一个刻度
            timeInterval = d3.timeMonth.every(1);
            formatFunction = d => d3.timeFormat("%m %Y")(d);
        } else if (monthSpan > 2) {
            // 2-6个月，每周一个刻度
            timeInterval = d3.timeWeek.every(1);
            formatFunction = d => d3.timeFormat("%d %m")(d);
        } else {
            // 少于2个月，每天一个刻度或每几天一个刻度
            const dayInterval = Math.max(1, Math.ceil(daySpan / 10));
            timeInterval = d3.timeDay.every(dayInterval);
            formatFunction = d => d3.timeFormat("%d %m")(d);
        }
        
        // 生成刻度
        const xTicks = xScale.ticks(timeInterval);
        
        // 确保包含最后一个日期，但避免刻度重叠
        if (xTicks.length > 0 && xTicks[xTicks.length - 1] < xExtent[1]) {
            const lastTick = xTicks[xTicks.length - 1];
            const lastDataDate = xExtent[1];
            
            // 计算像素距离
            const lastTickX = xScale(lastTick);
            const lastDataX = xScale(lastDataDate);
            const minPixelDistance = 60; // 最小60像素距离
            
            if (Math.abs(lastDataX - lastTickX) >= minPixelDistance) {
                // 距离足够，添加新刻度
                xTicks.push(lastDataDate);
            } else {
                // 距离太近，替换最后一个刻度
                xTicks[xTicks.length - 1] = lastDataDate;
            }
        }
        
        return {
            xScale: xScale,
            xTicks: xTicks,
            xFormat: formatFunction,
            timeSpan: {
                days: daySpan,
                months: monthSpan,
                years: yearSpan
            }
        };
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
    
    // 获取唯一的组值并按平均值排序
    const groups = [...new Set(chartData.map(d => d[groupField]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartData.filter(d => d[groupField] === a), d => d[yField]);
            const avgB = d3.mean(chartData.filter(d => d[groupField] === b), d => d[yField]); 
            return avgA - avgB;
        });
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 60, bottom: 40, left: 80 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const { xScale, xTicks, xFormat } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 准备堆叠数据
    const groupedData = d3.group(chartData, d => d[xField]);
    
    // 转换为堆叠格式
    const stackData = Array.from(groupedData, ([key, values]) => {
        const obj = { date: parseDate(key) };
        values.forEach(v => {
            obj[v[groupField]] = v[yField];
        });
        return obj;
    });
    
    // 确保所有组都有值，缺失的填充为0
    stackData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0;
            }
        });
    });
    
    // 按日期排序
    stackData.sort((a, b) => a.date - b.date);
    
    // 创建堆叠生成器
    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);
    
    // 生成堆叠数据
    const stackedData = stack(stackData);
    
    // 创建y轴比例尺
    const yMax = d3.max(stackedData[stackedData.length - 1], d => d[1]) * 1.1;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([chartHeight, 0]);
    
    // 添加Y轴网格线和刻度
    const yTicks = yScale.ticks(5);
    yTicks.forEach(tick => {
        g.append("line")
            .attr("class", "gridline")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#cccccc")
            .attr("stroke-opacity", 0.5);
        
        g.append("text")
            .attr("class", "value")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", colors.text_color || "#414141")
            .attr("font-size", "12px")
            .text(d3.format(".1s")(tick));
    });
    
    // 添加x轴刻度标签
    xTicks.forEach(tick => {
        g.append("text")
            .attr("class", "value")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 25)
            .attr("text-anchor", "start")
            .style("font-family", "Arial")
            .style("font-size", "16px")
            .style("fill", colors.text_color || "#414141")
            .text(xFormat(tick));
    });
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(d.data.date))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveLinear);
    
    // 绘制堆叠面积图
    stackedData.forEach((d, i) => {
        const group = d.key;
        
        g.append("path")
            .attr("class", "mark")
            .datum(d)
            .attr("fill", colors.field[group])
            .attr("d", area);
            
        // 智能标签定位算法
        const gridSize = 10;
        const numGrids = Math.floor(chartWidth / gridSize);
        const gridWidths = [];
        
        // 计算每个网格位置对应的区域宽度
        for (let gridIdx = 0; gridIdx < numGrids; gridIdx++) {
            const gridX = gridIdx * gridSize;
            const gridDate = xScale.invert(gridX);
            
            // 找到插值的两个数据点
            let leftIdx = 0, rightIdx = 0;
            for (let j = 0; j < d.length - 1; j++) {
                if (d[j].data.date <= gridDate && d[j + 1].data.date >= gridDate) {
                    leftIdx = j;
                    rightIdx = j + 1;
                    break;
                }
            }
            
            // 计算插值比例和边界值
            const leftDate = d[leftIdx].data.date;
            const rightDate = d[rightIdx].data.date;
            const ratio = (gridDate - leftDate) / (rightDate - leftDate);
            const y0 = d3.interpolateNumber(d[leftIdx][0], d[rightIdx][0])(ratio);
            const y1 = d3.interpolateNumber(d[leftIdx][1], d[rightIdx][1])(ratio);
            
            gridWidths.push({
                gridIdx: gridIdx,
                gridX: gridX,
                dataIdx: leftIdx,
                y0: yScale(y0),
                y1: yScale(y1)
            });
        }
        
        // 计算每个网格及其前后5个网格的平均宽度
        const avgWidths = [];
        for (let i = 5; i < gridWidths.length - 5; i++) {
            let curY0 = gridWidths[i].y0;
            let curY1 = gridWidths[i].y1;
            let sum = curY0 - curY1;
            const count = 11;

            // 计算前5个网格的影响
            for (let j = Math.max(0, i - 5); j < i; j++) {
                if (gridWidths[j].y0 < curY0) curY0 = gridWidths[j].y0;
                if (gridWidths[j].y1 > curY1) curY1 = gridWidths[j].y1;
                sum += curY0 - curY1;
            }

            // 重置当前位置的边界
            curY0 = gridWidths[i].y0;
            curY1 = gridWidths[i].y1;

            // 计算后5个网格的影响
            for (let j = i + 1; j <= Math.min(gridWidths.length - 1, i + 5); j++) {
                if (gridWidths[j].y0 < curY0) curY0 = gridWidths[j].y0;
                if (gridWidths[j].y1 > curY1) curY1 = gridWidths[j].y1;
                sum += curY0 - curY1;
            }
            
            avgWidths.push({
                gridIdx: gridWidths[i].gridIdx,
                gridX: gridWidths[i].gridX,
                avgWidth: sum / count,
                dataIdx: gridWidths[i].dataIdx
            });
        }
        
        // 找到平均宽度最大的网格（偏向右侧）
        let maxAvgWidth = 0;
        let bestGridIdx = 0;
        for (let i = Math.floor(avgWidths.length / 2); i < avgWidths.length - 1; i++) {
            const gain = avgWidths[i].avgWidth + 0.1 * i;
            if (gain > maxAvgWidth) {
                maxAvgWidth = gain;
                bestGridIdx = i;
            }
        }
        
        // 使用找到的最佳位置
        const bestGrid = avgWidths[bestGridIdx];
        
        // 计算标签位置
        const labelX = bestGrid.gridX;
        const y0 = gridWidths[bestGridIdx].y0;
        const y1 = gridWidths[bestGridIdx].y1;
        const labelY = y0 + (y1 - y0) * 0.5;

        // 添加组名标签
        g.append("text")
            .attr("class", "label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("fill", colors.text_color || "#414141")
            .style("opacity", 0.8)
            .text(group);
    });
    
    // 添加Y轴标题
    g.append("text")
        .attr("class", "text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -chartHeight / 2)
        .attr("text-anchor", "middle")
        .attr("fill", colors.text_color || "#414141")
        .style("font-size", "14px")
        .text(yField);
    
    return svg.node();
} 
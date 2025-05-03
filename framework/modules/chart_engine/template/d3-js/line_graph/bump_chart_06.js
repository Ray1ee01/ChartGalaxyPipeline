/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_06",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [4, 12],
        [0, "inf"],
        [3, 10]
    ],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/



function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : (colors.other ? colors.other.primary : "#888");
    };
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距 - 右侧留出更多空间用于标签
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值和X值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))].sort();
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    
    // 1. 计算每个x下各group的排名
    // 构建排名数据结构：{ group1: [{x, rank}], group2: ... }
    const rankData = {};
    
    // 初始化每个分组的数据结构，确保每个分组都有所有x值的条目
    groups.forEach(group => {
        rankData[group] = [];
    });
    
    xValues.forEach(x => {
        // 取出该x下所有group的数据
        const items = chartData.filter(d => d[xField] === x);
        // 按yField降序排序（y越大排名越高）
        items.sort((a, b) => b[yField] - a[yField]);
        
        // 存储该时间点有数据的分组
        const groupsWithData = new Set(items.map(d => d[groupField]));
        
        // 为有数据的分组添加排名
        items.forEach((d, i) => {
            rankData[d[groupField]].push({
                x: d[xField],
                rank: i + 1, // 排名从1开始
                value: d[yField],
                hasData: true
            });
        });
        
        // 为缺失数据的分组添加空条目
        groups.forEach(group => {
            if (!groupsWithData.has(group)) {
                const existingEntries = rankData[group];
                const lastRank = existingEntries.length > 0 ? existingEntries[existingEntries.length - 1].rank : groups.length;
                
                rankData[group].push({
                    x: x,
                    rank: lastRank, // 使用上一个时间点的排名或默认为最后
                    value: null,
                    hasData: false
                });
            }
        });
    });
    
    // 确保每个分组的数据按时间排序
    groups.forEach(group => {
        rankData[group].sort((a, b) => {
            return parseDate(a.x) - parseDate(b.x);
        });
    });

    // 2. y轴比例尺：排名（1在顶部）
    const yScale = d3.scaleLinear()
        .domain([1, groups.length])
        .range([0, innerHeight]);

    // 优化时间标签避免重叠
    const optimizeTimeLabels = (ticks, format, availableWidth) => {
        if (ticks.length <= 1) return ticks;
        
        // 创建临时文本元素计算宽度
        const tempLabelText = g.append("text")
            .attr("font-size", 14)
            .attr("visibility", "hidden");
        
        // 计算所有标签的宽度
        const calculateLabelWidth = (tick) => {
            tempLabelText.text(format(tick));
            return tempLabelText.node().getComputedTextLength() + 20; // 添加一些边距
        };
        
        const tickWidths = ticks.map(tick => calculateLabelWidth(tick));
        
        // 检查是否会重叠
        let willOverlap = false;
        let positions = ticks.map(t => xScale(t));
        
        for (let i = 0; i < positions.length - 1; i++) {
            const gap = positions[i+1] - positions[i];
            if (gap < (tickWidths[i] + tickWidths[i+1]) / 2) {
                willOverlap = true;
                break;
            }
        }
        
        // 如果不会重叠，显示所有标签
        if (!willOverlap) {
            tempLabelText.remove();
            return ticks;
        }
        
        // 计算可以显示的标签数量
        const averageWidth = tickWidths.reduce((a, b) => a + b, 0) / ticks.length;
        let maxLabels = Math.floor(availableWidth / averageWidth);
        
        // 确保至少显示首尾标签
        if (maxLabels <= 2) {
            tempLabelText.remove();
            return [ticks[0], ticks[ticks.length - 1]];
        }
        
        // 均匀选择标签
        const step = Math.ceil(ticks.length / maxLabels);
        const optimizedTicks = [];
        
        for (let i = 0; i < ticks.length; i += step) {
            optimizedTicks.push(ticks[i]);
        }
        
        // 确保包含最后一个标签
        if (optimizedTicks[optimizedTicks.length - 1] !== ticks[ticks.length - 1]) {
            optimizedTicks.push(ticks[ticks.length - 1]);
        }
        
        tempLabelText.remove();
        return optimizedTicks;
    };
    
    // 优化时间标签
    const optimizedXTicks = optimizeTimeLabels(xTicks, xFormat, innerWidth);

    // 添加顶部时间标签
    optimizedXTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .attr("font-size", 14)
            .attr("fill", "#555")
            .text(xFormat(tick));
    });

    // 3. 绘制线条
    groups.forEach(group => {
        const groupRanks = rankData[group];
        
        // 只在有数据的点之间绘制线条
        const validSegments = [];
        let currentSegment = [];
        
        groupRanks.forEach((d, i) => {
            if (d.hasData) {
                currentSegment.push(d);
            } else if (currentSegment.length > 0) {
                validSegments.push(currentSegment);
                currentSegment = [];
            }
        });
        
        if (currentSegment.length > 0) {
            validSegments.push(currentSegment);
        }
        
        // 如果有连续的有效数据点，绘制线段
        validSegments.forEach(segment => {
            if (segment.length > 1) {
                g.append("path")
                    .datum(segment)
                    .attr("fill", "none")
                    .attr("stroke", getColor(group))
                    .attr("stroke-width", 3)
                    .attr("d", d3.line()
                        .x(d => xScale(parseDate(d.x)))
                        .y(d => yScale(d.rank))
                    );
            }
        });
        
        // 计算y值的范围用于缩放圆点大小
        const yValues = chartData
            .filter(d => d[yField] !== null && d[yField] !== undefined)
            .map(d => d[yField]);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const radiusScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([7, 7]); // 圆点半径范围

        // 绘制每个点的圆点（只绘制有数据的点）
        groupRanks.forEach(d => {
            if (d.hasData) {
                g.append("circle")
                    .attr("class", `dot-${group.replace(/\+/g, '_plus')}`) // 避免选择器中的+号
                    .attr("cx", xScale(parseDate(d.x)))
                    .attr("cy", yScale(d.rank))
                    .attr("r", radiusScale(d.value))
                    .attr("fill", getColor(group))
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 2);
                
                // 添加数据标签显示在点的下方
                g.append("text")
                    .attr("x", xScale(parseDate(d.x)))
                    .attr("y", yScale(d.rank) + radiusScale(d.value) + 12) // 放在点下方，留出间距
                    .attr("text-anchor", "middle")
                    .attr("font-size", 12)
                    .attr("fill", "#333")
                    .text(d.value.toLocaleString()); // 格式化数字显示
            }
        });
    });

    // 4. 绘制y轴标签（排名）
    const yAxisG = g.append("g");

    // 5. 绘制group标签和三角形标记
    // 首先计算所有group标签的宽度
    const tempText = g.append("text")
        .attr("font-size", 18)
        .attr("font-weight", "bold");
    
    const groupWidths = groups.map(group => {
        tempText.text(group);
        return tempText.node().getComputedTextLength();
    });
    tempText.remove();
    
    const maxGroupWidth = Math.max(...groupWidths);
    const triangleWidth = 10; // 三角形宽度
    const padding = 5; // 标签之间的间距

    // 计算三角形的位置（固定在图表左侧）
    const triangleX = -margin.left + 40;
    
    // 计算group标签的位置（左对齐，以最长的为基准）
    const groupX = triangleX - maxGroupWidth - padding;
    
    // 计算rank标签的位置（在group标签左侧）
    const rankX = groupX - 30; // rank标签固定宽度

    // 绘制三角形和标签
    groups.forEach((group, i) => {
        // 获取当前分组的第一个有效数据点
        let first = rankData[group].find(d => d.hasData);
        if (!first && rankData[group].length > 0) {
            // 如果没有有效数据点，使用第一个数据点
            first = rankData[group][0];
        }
        
        if (!first) return; // 如果没有数据点，跳过该分组
        
        // 添加三角形标记（指向右侧）
        g.append("path")
            .attr("d", "M0,-5 L10,0 L0,5 Z")
            .attr("transform", `translate(${triangleX},${yScale(first.rank)})`)
            .attr("fill", getColor(group));
        
        // 检查图片是否存在
        if (jsonData.images && jsonData.images.field && jsonData.images.field[group]) {
            g.append("image")
                .attr("xlink:href", jsonData.images.field[group])
                .attr("x", triangleX)
                .attr("y", yScale(first.rank) - 20)
                .attr("width", 40)
                .attr("height", 40);
        }

        // 添加group标签
        g.append("text")
            .attr("x", groupX)
            .attr("y", yScale(first.rank) + 5)
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .attr("font-size", 18)
            .attr("fill", "#000")
            .text(group);
            
        // 添加rank标签
        g.append("text")
            .attr("x", rankX)
            .attr("y", yScale(first.rank) + 5)
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .attr("font-size", 16)
            .text(first.rank);
    });

    return svg.node();
} 
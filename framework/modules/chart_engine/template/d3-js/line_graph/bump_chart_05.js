/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_05",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [2, 12],
        [0, "inf"],
        [4, 10]
    ],
    "required_fields_icons": [],
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
    const margin = { top: 60, right: 180, bottom: 60, left: 80 }; // 增加顶部边距以容纳时间标签
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
    
    // 为每个组分配固定位置 (1到groups.length)
    const fixedGroupPositions = {};
    groups.forEach((group, i) => {
        fixedGroupPositions[group] = i + 1;
    });
    
    // 1. 计算每个x下各group的排名
    // 构建排名数据结构：{ group1: [{x, rank}], group2: ... }
    const rankData = {};
    
    // 初始化每个group的数据结构
    groups.forEach(group => {
        rankData[group] = [];
    });
    
    // 为每个时间点和每个组创建排名数据
    xValues.forEach(x => {
        // 取出该x下所有group的数据
        const items = chartData.filter(d => d[xField] === x);
        
        // 记录该时间点存在的组
        const existingGroups = items.map(d => d[groupField]);
        
        // 按yField降序排序（y越大排名越高）
        items.sort((a, b) => b[yField] - a[yField]);
        
        // 为有数据的组计算排名
        const rankByGroup = {};
        items.forEach((d, i) => {
            rankByGroup[d[groupField]] = i + 1; // 排名从1开始
        });
        
        // 为每个组添加排名数据，无论是否存在
        groups.forEach(group => {
            if (existingGroups.includes(group)) {
                // 该组在该时间点有数据
                const dataItem = items.find(d => d[groupField] === group);
                rankData[group].push({
                    x: x,
                    rank: rankByGroup[group],
                    value: dataItem[yField],
                    missing: false
                });
            } else {
                // 该组在该时间点没有数据
                
                // 查找该组最近的有效排名
                let nearestRank = null;
                // 先尝试找前一个时间点的排名
                const groupData = rankData[group];
                if (groupData && groupData.length > 0) {
                    const lastValidPoint = [...groupData].reverse().find(d => !d.missing);
                    if (lastValidPoint) {
                        nearestRank = lastValidPoint.rank;
                    }
                }
                
                // 如果找不到有效的历史排名，使用固定位置
                if (nearestRank === null) {
                    nearestRank = fixedGroupPositions[group];
                }
                
                rankData[group].push({
                    x: x,
                    rank: nearestRank, // 使用最近的有效排名或固定位置
                    value: null,
                    missing: true
                });
            }
        });
    });
    
    // 对每个组的数据按x值排序
    groups.forEach(group => {
        rankData[group].sort((a, b) => {
            const dateA = parseDate(a.x);
            const dateB = parseDate(b.x);
            return dateA - dateB;
        });
    });

    // 2. y轴比例尺：排名（1在顶部）
    const yScale = d3.scaleLinear()
        .domain([1, groups.length])
        .range([0, innerHeight]);

    // 3. 绘制线条
    groups.forEach(group => {
        const groupRanks = rankData[group];
        
        // 使用定义的线条生成器来创建中断的线条
        const lineGenerator = d3.line()
            .x(d => xScale(parseDate(d.x)))
            .y(d => yScale(d.rank))
            .defined(d => !d.missing); // 只在有效数据点之间绘制线条
            
        g.append("path")
            .datum(groupRanks)
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 3)
            .attr("d", lineGenerator);
        
        // 计算y值的范围用于缩放圆点大小
        const yValues = chartData.map(d => d[yField]).filter(d => d !== null && d !== undefined);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        const radiusScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([5, 30]); // 圆点半径范围从5到30

        // 计算颜色亮度的函数
        const getLuminance = (color) => {
            const rgb = d3.color(color).rgb();
            return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        };

        // 为每个组生成一个安全的CSS类名
        const safeGroupId = `group-${groups.indexOf(group)}`;

        // 绘制每个点的圆点 - 只绘制非缺失的点
        g.selectAll(`.dot-${safeGroupId}`)
            .data(groupRanks.filter(d => !d.missing))
            .enter()
            .append("circle")
            .attr("class", `dot-${safeGroupId}`)
            .attr("cx", d => xScale(parseDate(d.x)))
            .attr("cy", d => yScale(d.rank))
            .attr("r", d => radiusScale(d.value))
            .attr("fill", getColor(group))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);

        // 添加数值标签 - 只为非缺失的点添加
        g.selectAll(`.label-${safeGroupId}`)
            .data(groupRanks.filter(d => !d.missing))
            .enter()
            .append("text")
            .attr("class", `label-${safeGroupId}`)
            .attr("x", d => xScale(parseDate(d.x)))
            .attr("y", d => {
                const radius = radiusScale(d.value);
                return radius < 10 ? yScale(d.rank) - radius - 5 : yScale(d.rank);
            })
            .attr("text-anchor", "middle")
            .attr("dy", d => {
                const radius = radiusScale(d.value);
                return radius < 10 ? "0" : "0.35em";
            })
            .attr("font-size", "12px")
            .attr("fill", d => {
                const radius = radiusScale(d.value);
                if (radius < 10) {
                    return "#000"; // 小圆点外的标签使用黑色
                } else {
                    // 大圆点内的标签根据背景亮度选择颜色
                    const luminance = getLuminance(getColor(group));
                    return luminance > 0.5 ? "#000" : "#fff";
                }
            })
            .attr("font-weight", "bold")
            .text(d => Math.round(d.value));
    });

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
            .attr("y", -40)
            .attr("text-anchor", "middle")
            .attr("font-size", 14)
            .attr("fill", "#555")
            .text(xFormat(tick));
    });
    // 4. 绘制group标签和三角形标记
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
    const triangleX = -margin.left + 20;
    
    // 计算group标签的位置（左对齐，以最长的为基准）
    const groupX = triangleX - maxGroupWidth - padding;
    
    // 计算rank标签的位置（在group标签左侧）
    const rankX = groupX - 30; // rank标签固定宽度

    // 使用固定位置绘制标签而不是第一个数据点的位置，避免重叠
    groups.forEach((group, i) => {
        const fixedRank = fixedGroupPositions[group];
        
        // 添加三角形标记（指向右侧）
        g.append("path")
            .attr("d", "M0,-5 L10,0 L0,5 Z")
            .attr("transform", `translate(${triangleX},${yScale(fixedRank)})`)
            .attr("fill", getColor(group));
            
        // 添加group标签
        g.append("text")
            .attr("x", groupX)
            .attr("y", yScale(fixedRank) + 5)
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .attr("font-size", 18)
            .attr("fill", getColor(group))
            .text(group);
            
        // 添加rank标签
        g.append("text")
            .attr("x", rankX)
            .attr("y", yScale(fixedRank) + 5)
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .attr("font-size", 16)
            .text(i + 1);
    });

    return svg.node();
} 
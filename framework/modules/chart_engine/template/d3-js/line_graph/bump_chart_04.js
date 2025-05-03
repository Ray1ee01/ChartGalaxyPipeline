/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_04",
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
    "background": "dark",
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
    const colors = jsonData.colors_dark || {};
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
    const margin = { top: 40, right: 180, bottom: 60, left: 80 };
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
    
    // 将组名转换为CSS安全的类名
    const safeClassName = (name) => {
        return "group-" + (name || "").toString().replace(/[^a-zA-Z0-9]/g, "-");
    };
    
    // 1. 计算每个x下各group的排名
    // 构建排名数据结构：{ group1: [{x, rank}], group2: ... }
    const rankData = {};
    
    // 初始化每个组的数据数组
    groups.forEach(group => {
        rankData[group] = [];
    });
    
    // 为每个时间点计算排名
    xValues.forEach(x => {
        // 取出该x下所有group的数据
        const items = chartData.filter(d => d[xField] === x);
        
        // 排序前检查数据有效性，过滤掉无效的数据点
        const validItems = items.filter(d => d[yField] !== null && d[yField] !== undefined && !isNaN(d[yField]));
        
        // 按yField降序排序（y越大排名越高）
        validItems.sort((a, b) => b[yField] - a[yField]);
        
        // 为每个有效的组添加排名数据
        validItems.forEach((d, i) => {
            if (d[groupField]) {
                rankData[d[groupField]].push({
                    x: d[xField],
                    rank: i + 1, // 排名从1开始
                    value: d[yField]
                });
            }
        });
    });

    // 2. y轴比例尺：排名（1在顶部）
    const yScale = d3.scaleLinear()
        .domain([1, groups.length])
        .range([0, innerHeight]);

    // 3. 绘制线条
    groups.forEach(group => {
        if (!rankData[group] || rankData[group].length === 0) {
            return; // 跳过没有数据的组
        }
        
        const groupRanks = rankData[group];
        const safeClass = safeClassName(group);
        
        // 确保数据点按x排序
        groupRanks.sort((a, b) => {
            return parseDate(a.x) - parseDate(b.x);
        });
        
        // 只在有足够数据点时绘制线条
        if (groupRanks.length > 1) {
            g.append("path")
                .datum(groupRanks)
                .attr("fill", "none")
                .attr("stroke", getColor(group))
                .attr("stroke-width", 3)
                .attr("d", d3.line()
                    .defined(d => d.rank !== null && d.rank !== undefined && !isNaN(d.rank))
                    .x(d => xScale(parseDate(d.x)))
                    .y(d => yScale(d.rank))
                    .curve(d3.curveCatmullRom.alpha(0.5)) // 添加曲线平滑效果
                );
        }
        
        // 绘制每个点的圆点
        g.selectAll(null)  // 使用null避免选择器问题
            .data(groupRanks)
            .enter()
            .append("circle")
            .attr("class", `dot-${safeClass}`)
            .attr("cx", d => xScale(parseDate(d.x)))
            .attr("cy", d => yScale(d.rank))
            .attr("r", 5)
            .attr("fill", getColor(group))
            .attr("stroke", "#fff")
            .attr("stroke-width", 2);
            
        // 添加数据点标签
        g.selectAll(null)  // 使用null避免选择器问题
            .data(groupRanks)
            .enter()
            .append("text")
            .attr("class", `label-${safeClass}`)
            .attr("x", d => xScale(parseDate(d.x)))
            .attr("y", d => yScale(d.rank) - 10)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#fff")
            .text(d => d.value);
    });

    // 4. 绘制y轴标签（排名）
    const yAxisG = g.append("g");
    for (let i = 1; i <= groups.length; i++) {
        yAxisG.append("text")
            .attr("x", -10)
            .attr("y", yScale(i) + 5)
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .attr("font-size", 16)
            .attr("fill", "#fff") // 将标签改为白色
            .text(i);
    }

    // 5. 绘制group标签（左侧和右侧）
    // 左侧
    groups.forEach(group => {
        if (!rankData[group] || rankData[group].length === 0) {
            return; // 跳过没有数据的组
        }
        
        const first = rankData[group][0];
        if (first && first.rank) {
            g.append("text")
                .attr("x", -margin.left + 10)
                .attr("y", yScale(first.rank) + 5)
                .attr("text-anchor", "end")
                .attr("font-weight", "bold")
                .attr("font-size", 18)
                .attr("fill", getColor(group))
                .text(group);
        }
    });
    
    // 右侧
    groups.forEach(group => {
        if (!rankData[group] || rankData[group].length === 0) {
            return; // 跳过没有数据的组
        }
        
        const last = rankData[group][rankData[group].length - 1];
        if (last && last.rank) {
            g.append("text")
                .attr("x", innerWidth + 10)
                .attr("y", yScale(last.rank) + 5)
                .attr("text-anchor", "start")
                .attr("font-weight", "bold")
                .attr("font-size", 18)
                .attr("fill", getColor(group))
                .text(group);
        }
    });

    // 6. 添加顶部时间标签（优化以避免重叠）
    // 创建一个临时的SVG元素来测量文本宽度
    const tempSvg = d3.select("body").append("svg").attr("width", 0).attr("height", 0);
    const tempText = tempSvg.append("text").attr("font-size", 16);
    
    // 估算每个标签的宽度
    const estimatedLabelWidths = xTicks.map(tick => {
        tempText.text(xFormat(tick));
        const width = tempText.node().getComputedTextLength ? 
                     tempText.node().getComputedTextLength() : 
                     xFormat(tick).length * 10; // 如果无法计算，使用一个近似值
        return width;
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 计算可用空间和标签所需空间
    const availableWidth = innerWidth;
    const minLabelSpacing = 10; // 标签之间的最小间距
    
    // 动态计算要显示的标签数量
    let ticksToShow = [...xTicks];
    
    // 如果标签会重叠，减少标签数量
    // 先计算所有标签占用的总宽度
    const totalLabelWidth = estimatedLabelWidths.reduce((sum, width) => sum + width, 0) + 
                           (estimatedLabelWidths.length - 1) * minLabelSpacing;
    
    // 如果总宽度超过可用空间，则减少标签
    if (totalLabelWidth > availableWidth) {
        // 根据可用空间计算可以显示的标签数量
        const idealCount = Math.floor(availableWidth / (d3.mean(estimatedLabelWidths) + minLabelSpacing));
        
        // 至少保留首尾两个标签
        if (idealCount >= 2) {
            // 如果理想数量小于实际数量，则需要筛选标签
            if (idealCount < xTicks.length) {
                // 保留首尾两个标签，其余均匀抽样
                ticksToShow = [xTicks[0]];
                
                if (xTicks.length > 2) {
                    // 在中间均匀选择idealCount-2个标签
                    const step = (xTicks.length - 2) / (idealCount - 1);
                    for (let i = 1; i < idealCount - 1; i++) {
                        const index = Math.round(1 + i * step);
                        if (index < xTicks.length - 1) {
                            ticksToShow.push(xTicks[index]);
                        }
                    }
                }
                
                ticksToShow.push(xTicks[xTicks.length - 1]);
            }
        } else {
            // 如果连两个标签都显示不下，则只显示首尾标签
            ticksToShow = [xTicks[0], xTicks[xTicks.length - 1]];
        }
    }
    
    // 绘制选中的标签
    ticksToShow.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", -40)
            .attr("text-anchor", "middle")
            .attr("font-size", 16)
            .attr("fill", "#fff")
            .text(xFormat(tick));
    });

    return svg.node();
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stacked Area Chart",
    "chart_name": "stacked_area_plain_chart_02",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 10], [0, "inf"], [2, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
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
            return avgB - avgA; // 从大到小排序，使较大的值在底部
        });
    
    // 找出所有组都有数据的x值
    const xValuesByGroup = {};
    groups.forEach(group => {
        xValuesByGroup[group] = new Set(
            chartData.filter(d => d[groupField] === group).map(d => d[xField])
        );
    });
    
    // 找出所有组共有的x值
    let commonXValues = [...xValuesByGroup[groups[0]]];
    for (let i = 1; i < groups.length; i++) {
        commonXValues = commonXValues.filter(x => xValuesByGroup[groups[i]].has(x));
    }
    
    // 按照原始顺序排序x值
    commonXValues.sort((a, b) => {
        const aIndex = chartData.findIndex(d => d[xField] === a);
        const bIndex = chartData.findIndex(d => d[xField] === b);
        return aIndex - bIndex;
    });
    
    // 过滤数据，只保留所有组都有的x值
    const filteredData = chartData.filter(d => commonXValues.includes(d[xField]));
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 80, right: 20, bottom: 60, left: 60 };
    
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
    
    // 创建x轴比例尺 - 使用分类比例尺
    const xScale = d3.scaleBand()
        .domain(commonXValues)
        .range([0, chartWidth])
        .padding(0.3);
    
    // 为堆叠数据准备
    const groupedData = d3.group(filteredData, d => d[xField]);
    
    // 转换为堆叠格式
    const stackData = Array.from(groupedData, ([key, values]) => {
        const obj = { category: key };
        values.forEach(v => {
            obj[v[groupField]] = v[yField];
        });
        return obj;
    });
    
    // 确保所有组都有值（如果某些类别缺少某组的数据，填充为0）
    stackData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0;
            }
        });
    });
    
    // 按照原始x值顺序排序
    stackData.sort((a, b) => {
        return commonXValues.indexOf(a.category) - commonXValues.indexOf(b.category);
    });
    
    // 计算每个类别的总和，并转换为百分比
    stackData.forEach(d => {
        const total = groups.reduce((sum, group) => sum + d[group], 0);
        groups.forEach(group => {
            d[group + "_original"] = d[group]; // 保存原始值
            d[group] = (d[group] / total) * 100; // 转换为百分比
        });
    });
    
    // 创建堆叠生成器
    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);
    
    // 生成堆叠数据
    const stackedData = stack(stackData);
    
    // 创建y轴比例尺 (固定为0-100%)
    const yScale = d3.scaleLinear()
        .domain([0, 100])
        .range([chartHeight, 0]);
    
    // 添加Y轴网格线
    const yTicks = [0, 20, 40, 60, 80, 100];
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#dddddd")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");
        
        // 添加Y轴刻度文本 - 设置为粗体
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#666")
            .attr("font-weight", "bold") // 添加粗体
            .style("font-size", "14px")
            .text(tick + "%");
    });
    
    // 添加X轴刻度和标签
    commonXValues.forEach(category => {
        // 添加刻度标签 - 设置为粗体
        g.append("text")
            .attr("x", xScale(category) + xScale.bandwidth() / 2)
            .attr("y", chartHeight + 25)
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("font-weight", "bold") // 添加粗体
            .style("fill", "#666")
            .text(category);
    });
    
    // 添加X轴线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", chartHeight)
        .attr("x2", chartWidth)
        .attr("y2", chartHeight)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1);
    
    // 绘制堆叠条形图和过渡区域
    // 首先创建一个函数来获取颜色的深色版本
    function getDarkerColor(color, factor = 0.7) {
        const c = d3.color(color);
        c.opacity = 0.9;
        return d3.rgb(c.r * factor, c.g * factor, c.b * factor);
    }
    
    // 绘制堆叠条形图
    commonXValues.forEach((category, categoryIndex) => {
        const barData = stackData.find(d => d.category === category);
        if (!barData) return;
        
        // 获取当前类别的x位置和宽度
        const barX = xScale(category);
        const barWidth = xScale.bandwidth();
        
        // 累积高度
        let cumulativeHeight = 0;
        
        // 为每个组绘制条形图部分
        groups.forEach((group, groupIndex) => {
            const value = barData[group];
            const height = (value / 100) * chartHeight;
            const y = chartHeight - cumulativeHeight - height;
            
            // 获取颜色
            const color = colors.field && colors.field[group] 
                ? colors.field[group] 
                : d3.schemeCategory10[groupIndex % 10];
            
            // 绘制条形图
            g.append("rect")
                .attr("x", barX)
                .attr("y", y)
                .attr("width", barWidth)
                .attr("height", height)
                .attr("fill", color);
            
            // 添加标签 - 只有当高度足够大时才添加
            const minHeightForLabel = 25; // 显示标签的最小高度
            
            if (height >= minHeightForLabel) {
                // 计算标签位置 - 在组区域的中心
                const labelX = barX + barWidth / 2;
                const labelY = y + height / 2;
                
                // 获取原始值
                const originalValue = barData[group + "_original"];
                
                // 添加百分比标签
                g.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY - 5) // 稍微上移
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", "#fff")
                    .attr("font-weight", "bold")
                    .style("font-size", "12px")
                    .text(`${value.toFixed(1)}%`);
                
                // 添加原始数据标签
                g.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY + 5) // 稍微下移
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", getDarkerColor(color, 0.5)) // 使用深色版本
                    .attr("font-weight", "bold")
                    .style("font-size", "10px")
                    .text(`(${originalValue.toFixed(1)})`);
            }
            
            // 如果不是最后一个类别，添加过渡区域
            if (categoryIndex < commonXValues.length - 1) {
                const nextCategory = commonXValues[categoryIndex + 1];
                const nextBarData = stackData.find(d => d.category === nextCategory);
                
                if (nextBarData) {
                    const nextValue = nextBarData[group];
                    const nextHeight = (nextValue / 100) * chartHeight;
                    
                    // 计算当前组在当前类别和下一个类别中的位置
                    // 当前类别中的顶部和底部位置
                    const topY = y;
                    const bottomY = y + height;
                    
                    // 下一个类别中的累积高度（需要重新计算）
                    let nextCumulativeHeight = 0;
                    for (let i = 0; i < groupIndex; i++) {
                        const nextGroupValue = nextBarData[groups[i]];
                        nextCumulativeHeight += (nextGroupValue / 100) * chartHeight;
                    }
                    
                    // 下一个类别中的顶部和底部位置
                    const nextTopY = chartHeight - nextCumulativeHeight - nextHeight;
                    const nextBottomY = nextTopY + nextHeight;
                    
                    // 过渡区域的位置和大小
                    const transitionX = barX + barWidth;
                    const transitionWidth = xScale(nextCategory) - (barX + barWidth);
                    
                    // 创建过渡区域的路径 - 修复底边连接
                    const pathData = `
                        M ${transitionX} ${topY}
                        L ${transitionX + transitionWidth} ${nextTopY}
                        L ${transitionX + transitionWidth} ${nextBottomY}
                        L ${transitionX} ${bottomY}
                        Z
                    `;
                    
                    // 绘制过渡区域
                    g.append("path")
                        .attr("d", pathData)
                        .attr("fill", getDarkerColor(color));
                }
            }
            
            // 更新累积高度
            cumulativeHeight += height;
        });
    });
    
    // 添加图例 - 放在图表上方
    const legendGroup = g.append("g")
        .attr("transform", `translate(0, -50)`);
    
    
    
    // 计算字段名宽度并添加间距
    const titleWidth = groupField.length * 10;
    const titleMargin = 15;

    const legendSize = layoutLegend(legendGroup, groups, colors, {
        x: titleWidth + titleMargin,
        y: 0,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth - titleWidth - titleMargin,
        shape: "rect",
    });

    // 添加字段名称
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", legendSize.height / 2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(groupField);
    
    // 将图例组向上移动 height/2, 并居中
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, ${-50 - legendSize.height/2})`);
    
    return svg.node();
} 
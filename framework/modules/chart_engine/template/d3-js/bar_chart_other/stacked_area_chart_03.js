/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stacked Area Chart",
    "chart_name": "stacked_area_chart_03",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "dark",
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
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 数值单位规范
    // 添加数值格式化函数
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
    }
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值并按平均值排序 - 从大到小排序，使较大的值在顶部
    const groups = [...new Set(chartData.map(d => d[groupField]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartData.filter(d => d[groupField] === a), d => d[yField]);
            const avgB = d3.mean(chartData.filter(d => d[groupField] === b), d => d[yField]); 
            return avgB - avgA; // 从大到小排序，使较大的值在顶部
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
    const margin = { top: 100, right: 5, bottom: 10, left: 5 };
    
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
        .padding(0.2);
    
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
    
    // 找出总和最大的类别
    let maxTotalCategory = stackData[0];
    let maxTotal = 0;
    
    stackData.forEach(d => {
        const total = groups.reduce((sum, group) => sum + d[group], 0);
        if (total > maxTotal) {
            maxTotal = total;
            maxTotalCategory = d;
        }
    });
    
    // 计算基准值 - 最大总和的1.1倍
    const baselineTotal = maxTotal * 1.1;
    
    // 计算每个类别的百分比 - 相对于基准值
    stackData.forEach(d => {
        groups.forEach(group => {
            d[group + "_original"] = d[group]; // 保存原始值
            d[group] = (d[group] / baselineTotal) * 100; // 转换为相对于基准的百分比
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
    
    // 添加X轴刻度和标签 - 放在条形图上方
    commonXValues.forEach(category => {
        // 添加刻度标签 - 设置为粗体和白色，放在上方
        g.append("text")
            .attr("x", xScale(category) + xScale.bandwidth() / 2)
            .attr("y", -10) // 放在条形图上方
            .attr("text-anchor", "middle")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("fill", "#fff") // 白色
            .text(category);
    });
    
    // 创建斜线图案
    const defs = svg.append("defs");
    const patternId = "diagonalHatch";
    
    const pattern = defs.append("pattern")
        .attr("id", patternId)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8)
        .attr("height", 8)
        .attr("patternTransform", "rotate(-45)");
    
    pattern.append("rect")
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", "#364d51");
    
    pattern.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", 8)
        .attr("stroke", "#90c0ad")
        .attr("stroke-width", 2);
    
    // 绘制堆叠条形图 - 从顶部向下
    commonXValues.forEach((category, categoryIndex) => {
        const barData = stackData.find(d => d.category === category);
        if (!barData) return;
        
        // 获取当前类别的x位置和宽度
        const barX = xScale(category);
        const barWidth = xScale.bandwidth();
        
        // 累积高度 - 从顶部开始
        let cumulativeHeight = 0;
        
        // 计算该类别的总百分比
        const totalPercent = groups.reduce((sum, group) => sum + barData[group], 0);
        
        // 使用全局排序的组顺序 - 不再对每个类别单独排序
        // 直接使用groups数组，它已经按照全局平均值从大到小排序
        
        // 为每个组绘制条形图部分 - 从顶部向下
        groups.forEach((group, groupIndex) => {
            const value = barData[group];
            const height = (value / 100) * chartHeight;
            
            // 从顶部计算y坐标
            const y = cumulativeHeight;
            
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
            
            // 添加标签
            const minHeightForLabel = 20; // 显示标签的最小高度
            const isLastGroup = groupIndex === groups.length - 1; // 是否是最下面的分组
            
            // 计算标签位置
            const labelX = barX + barWidth / 2;
            const labelY = y + height - 10;
            const labelText = `${value.toFixed(1)}%`;
            
            if (height >= minHeightForLabel) {
                // 高度足够，在条形图内部绘制标签
                g.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", "#364d51")
                    .attr("font-weight", "bold")
                    .style("font-size", "12px")
                    .text(labelText);
            } else if (isLastGroup && value > 0) {
                // 最下面的分组且高度不足，将标签绘制在条形图边界下方
                const externalLabelY = y + height + 15; // 条形图下方15像素
                
                // 添加背景矩形
                const padding = 1;
                const textWidth = labelText.length * 7; // 估算文本宽度
                const textHeight = 12;
                
                g.append("rect")
                    .attr("x", labelX - textWidth/2 - padding)
                    .attr("y", externalLabelY - textHeight/2 - padding)
                    .attr("width", textWidth + padding*2)
                    .attr("height", textHeight + padding*2)
                    .attr("fill", "#364d51");
                
                // 添加文本标签
                g.append("text")
                    .attr("x", labelX)
                    .attr("y", externalLabelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", color) // 使用组的颜色
                    .attr("font-weight", "bold")
                    .style("font-size", "12px")
                    .text(labelText);
            }
            
            // 更新累积高度
            cumulativeHeight += height;
        });
        
        // 添加剩余空间的斜线填充
        const remainingHeight = chartHeight - cumulativeHeight;
        if (remainingHeight > 0) {
            g.append("rect")
                .attr("x", barX)
                .attr("y", cumulativeHeight)
                .attr("width", barWidth)
                .attr("height", remainingHeight)
                .attr("fill", `url(#${patternId})`)
                .lower();
        }
    });
    
    // 重新设计图例 - 使用半圆样式
    const legendGroup = g.append("g")
        .attr("transform", `translate(${chartWidth/2 - (groups.length * 60)}, -60)`); // 居中放置
    
    // 添加各组图例 - 使用半圆样式
    groups.forEach((group, i) => {
        const color = colors.field && colors.field[group] 
            ? colors.field[group] 
            : d3.schemeCategory10[i % 10];
        
        // 计算水平位置
        const xPos = i * 120; // 每个图例占120像素宽度
        const yPos = 30; // 半圆中心的Y位置
        
        // 创建半圆组
        const legendItem = legendGroup.append("g")
            .attr("transform", `translate(${xPos}, 0)`);
        
        // 创建半圆路径 - 半圆朝上
        const radius = 30; // 半圆半径
        const semicircle = d3.arc()
            .innerRadius(0)
            .outerRadius(radius)
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2);
        
        // 添加半圆
        legendItem.append("path")
            .attr("d", semicircle)
            .attr("transform", `translate(${radius}, ${yPos})`)
            .attr("fill", color);
        
        // 添加组名 - 放在半圆上方
        legendItem.append("text")
            .attr("x", radius)
            .attr("y", -12) // 半圆上方
            .attr("text-anchor", "middle")
            .attr("fill", color) // 使用组的颜色
            .attr("font-weight", "bold")
            .style("font-size", "14px")
            .text(group);
        
        // 添加图标 - 如果有的话
        if (images && images.field && images.field[group]) {
            const iconSize = radius * 1.5; // 图标大小略大于半径
            legendItem.append("image")
                .attr("x", radius - iconSize/2)
                .attr("y", yPos - iconSize)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("href", images.field[group])
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });
    
    return svg.node();
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Line Graphs",
    "chart_name": "small_multiples_line_graphs_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [2, 8]],
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
    
    // 获取唯一的组值和X值
    let groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))].sort();
    
    // 测试代码：添加更多组以测试不同布局
    // 可以通过修改这个数字来测试不同数量的子图
    const additionalGroups = 0; // 修改这个值来测试不同数量的子图
    
    if (additionalGroups > 0) {
        const originalData = [...chartData];
        const originalGroups = [...groups];
        
        // 为每个新组复制数据并修改组名和值
        for (let i = 1; i <= additionalGroups; i++) {
            const newGroupName = `测试组 ${i}`;
            const newGroupData = originalData.map(d => {
                // 创建数据的深拷贝
                const newData = {...d};
                // 修改组名
                newData[groupField] = newGroupName;
                // 稍微修改y值，使曲线看起来不同
                newData[yField] = d[yField] * (0.8 + Math.random() * 0.4);
                return newData;
            });
            
            // 将新组数据添加到原始数据中
            chartData.push(...newGroupData);
            
            // 为新组添加颜色（如果没有自动分配）
            if (colors.field) {
                // 从原始组中随机选择一个颜色并稍微修改
                const randomOriginalGroup = originalGroups[Math.floor(Math.random() * originalGroups.length)];
                const baseColor = colors.field[randomOriginalGroup] || "#1a1a4f";
                
                // 生成稍微不同的颜色
                const r = parseInt(baseColor.slice(1, 3), 16);
                const g = parseInt(baseColor.slice(3, 5), 16);
                const b = parseInt(baseColor.slice(5, 7), 16);
                
                // 调整颜色值
                const newR = Math.min(255, Math.max(0, r + Math.floor(Math.random() * 60 - 30)));
                const newG = Math.min(255, Math.max(0, g + Math.floor(Math.random() * 60 - 30)));
                const newB = Math.min(255, Math.max(0, b + Math.floor(Math.random() * 60 - 30)));
                
                // 创建新的颜色
                const newColor = `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
                colors.field[newGroupName] = newColor;
            }
        }
        
        // 更新组列表
        groups = [...new Set(chartData.map(d => d[groupField]))];
    }
    
    // 计算基准线值（全局平均值）
    const baselineValue = d3.mean(chartData, d => d[yField]);
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    
    // 计算子图布局 - 改进布局逻辑
    let rows, cols;

    // 根据组数量确定最佳布局
    if (groups.length === 4) {
        // 4个组：2×2布局
        rows = 2;
        cols = 2;
    } else if (groups.length === 5) {
        // 5个组：上面2个，下面3个
        rows = 2;
        cols = 3;
    } else if (groups.length === 6) {
        // 6个组：2×3布局
        rows = 2;
        cols = 3;
    } else if (groups.length === 7) {
        // 7个组：2-3-2布局
        rows = 3;
        cols = 3;
    } else if (groups.length <= 3) {
        // 3个或更少：单行
        rows = 1;
        cols = groups.length;
    } else {
        // 其他情况：尽量接近正方形的布局
        cols = Math.ceil(Math.sqrt(groups.length));
        rows = Math.ceil(groups.length / cols);
    }

    // 子图尺寸
    const subplotWidth = (width - margin.left - margin.right) / cols;
    const subplotHeight = (height - margin.top - margin.bottom) / rows;
    const subplotMargin = { top: 40, right: 20, bottom: 40, left: 40 };
    const innerWidth = subplotWidth - subplotMargin.left - subplotMargin.right;
    const innerHeight = subplotHeight - subplotMargin.top - subplotMargin.bottom;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建X轴比例尺
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // 创建Y轴比例尺
    const yMin = d3.min(chartData, d => d[yField]) * 0.9;
    const yMax = d3.max(chartData, d => d[yField]) * 1.1;
    const yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([innerHeight, 0]);
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX);
    
    // 辅助函数：获取组的颜色
    function getColor(group) {
        return colors.field && colors.field[group] 
            ? colors.field[group] 
            : d3.schemeCategory10[groups.indexOf(group) % 10];
    }
    
    // 辅助函数：估算文本宽度
    function getTextWidth(text, fontSize) {
        return text.length * (fontSize * 0.6);
    }
    
    // 辅助函数：找到最接近给定日期的数据点
    function findClosestDataPoint(data, date) {
        if (!data || data.length === 0) return null;
        
        let closest = data[0];
        let minDiff = Math.abs(parseDate(closest[xField]) - date);
        
        for (let i = 1; i < data.length; i++) {
            const diff = Math.abs(parseDate(data[i][xField]) - date);
            if (diff < minDiff) {
                minDiff = diff;
                closest = data[i];
            }
        }
        
        return closest;
    }
    
    // 为每个组创建子图
    groups.forEach((group, i) => {
        let row, col;
        
        // 特殊布局处理
        if (groups.length === 5) {
            if (i < 2) {
                // 5个组的情况：前2个在第一行居中
                row = 0;
                // 计算居中偏移量：(3-2)/2 = 0.5个单位
                col = i + 0.5;
            } else {
                // 后3个在第二行
                row = 1;
                col = i - 2;
            }
        } else if (groups.length === 7) {
            if (i < 2) {
                // 7个组的情况：前2个在第一行居中
                row = 0;
                col = i + 0.5; // 居中偏移
            } else if (i < 5) {
                // 中间3个在第二行
                row = 1;
                col = i - 2;
            } else {
                // 后2个在第三行居中
                row = 2;
                col = (i - 5) + 0.5; // 居中偏移
            }
        } else {
            row = Math.floor(i / cols);
            col = i % cols;
        }
        
        // 子图位置
        const subplotX = margin.left + col * subplotWidth;
        const subplotY = margin.top + row * subplotHeight;
        
        // 创建子图组
        const subplot = svg.append("g")
            .attr("class", "subplot")
            .attr("transform", `translate(${subplotX}, ${subplotY})`);
        
        // 创建图表组
        const g = subplot.append("g")
            .attr("transform", `translate(${subplotMargin.left}, ${subplotMargin.top})`);
        
        // 添加组名标题和图例 - 居中显示
        const legendWidth = 30 + 5 + getTextWidth(group, 14);
        const legendX = (innerWidth - legendWidth) / 2;
        
        g.append("rect")
            .attr("x", legendX)
            .attr("y", -27)
            .attr("width", 30)
            .attr("height", 3)
            .attr("fill", getColor(group));
        
        g.append("text")
            .attr("x", legendX + 35)
            .attr("y", -25)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.title.font_family)
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("fill", "#1a1a4f") // 深蓝色
            .text(group);
        
        // 添加Y轴 - 左侧
        const yTicks = yScale.ticks(3); // 使用3个刻度点，避免拥挤
        
        // 添加Y轴网格线
        yTicks.forEach(tick => {
            g.append("line")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", innerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", "#1a1a4f")
                .attr("stroke-opacity", 0.1)
                .attr("stroke-dasharray", "2,2");
        });
        
        // 添加Y轴刻度文本
        yTicks.forEach(tick => {
            g.append("text")
                .attr("x", -5)
                .attr("y", yScale(tick))
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", "10px")
                .style("fill", "#1a1a4f")
                .style("opacity", 0.7)
                .text(d3.format(".1s")(tick));
        });
        
        // 绘制基准线（虚线）
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(baselineValue))
            .attr("x2", innerWidth)
            .attr("y2", yScale(baselineValue))
            .attr("stroke", "#333")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
        
        // 绘制当前组的线条（彩色）
        const groupData = chartData.filter(d => d[groupField] === group);
        
        g.append("path")
            .datum(groupData)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", getColor(group))
            .attr("stroke-width", 3)
            .attr("d", line);
        
        // 绘制X轴刻度（只在基准线上显示，且只有第一个子图显示文本）
        xTicks.forEach(tick => {
            g.append("line")
                .attr("x1", xScale(tick))
                .attr("y1", yScale(baselineValue) - 3)
                .attr("x2", xScale(tick))
                .attr("y2", yScale(baselineValue) + 3)
                .attr("stroke", "#110c57")
                .attr("stroke-width", 1);
            
            // 只在第一个子图显示X轴刻度文本，并根据数据值自动避让
            if (i === 0) {
                // 获取当前组在该刻度处的数据值
                const tickDate = tick;
                const closestDataPoint = findClosestDataPoint(groupData, tickDate);
                
                // 确定刻度文本的位置（上方或下方）
                const isAboveBaseline = closestDataPoint && closestDataPoint[yField] > baselineValue;
                const textY = isAboveBaseline 
                    ? yScale(baselineValue) + 10  // 如果数据点高于基准线，文本放在下方
                    : yScale(baselineValue) - 10; // 如果数据点低于基准线，文本放在上方
                
                // 文本锚点方向也相应调整
                const textAnchor = isAboveBaseline ? "start" : "end";
                const rotation = 90;
                
                g.append("text")
                    .attr("x", xScale(tick))
                    .attr("y", textY + 5)
                    .attr("transform", `rotate(${rotation}, ${xScale(tick)}, ${textY})`)
                    .attr("text-anchor", textAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", "10px")
                    .style("font-weight", "bold")
                    .style("fill", "#110c57")
                    .style("opacity", 0.3)
                    .text(xFormat(tick));
            }
        });
        
        // 先绘制其他组的线条（灰色）
        groups.forEach(otherGroup => {
            if (otherGroup !== group) {
                const otherGroupData = chartData.filter(d => d[groupField] === otherGroup);
                
                g.append("path")
                    .datum(otherGroupData)
                    .attr("class", "line")
                    .attr("fill", "none")
                    .attr("stroke", "#ccc")
                    .attr("stroke-width", 1)
                    .attr("opacity", 0.5)
                    .attr("d", line);
            }
        });
    });
    
    return svg.node();
}
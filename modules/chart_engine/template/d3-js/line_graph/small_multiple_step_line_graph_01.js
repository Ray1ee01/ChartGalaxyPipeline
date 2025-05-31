/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiple Step Line Graph",
    "chart_name": "small_multiple_step_line_graph_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 30], ["-inf", "inf"], [4, 4]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "dark",
    "icon_mark": "side",
    "icon_label": "side",
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    
    // 计算子图布局 - 2x2布局或根据组数量调整
    const rows = Math.ceil(groups.length / 2);
    const cols = Math.min(groups.length, 2);
    
    // 子图尺寸
    const subplotWidth = (width - margin.left - margin.right) / cols;
    const subplotHeight = (height - margin.top - margin.bottom) / rows;
    const subplotMargin = { top: 60, right: 20, bottom: 40, left: 50 };
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
    
    // 创建defs元素用于存放遮罩
    const defs = svg.append("defs");
    
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    // 为每个组创建子图
    groups.forEach((group, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
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
        
        // 获取当前组的数据
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 创建y轴比例尺 - 根据数据调整
        const groupYMin = Math.min(0, d3.min(groupData, d => d[yField]) * 1.4);
        const groupYMax = d3.max(groupData, d => d[yField]) * 1.1;
        
        const yScale = d3.scaleLinear()
            .domain([groupYMin, groupYMax])
            .range([innerHeight, 0]);
        
        // 添加网格线 - 减少刻度密度
        const yTicks = yScale.ticks(4); // 从6减少到4
        yTicks.forEach(tick => {
            g.append("line")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", innerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", "#333")
                .attr("stroke-width", 0.5);
        });
        
        // 减少X轴刻度密度
        xTicks.forEach(tick => {
            g.append("line")
                .attr("x1", xScale(tick))
                .attr("y1", 0)
                .attr("x2", xScale(tick))
                .attr("y2", innerHeight)
                .attr("stroke", "#333")
                .attr("stroke-width", 0.5);
        });
        
        // 添加X轴线条（绘制在0刻度处）
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(0))  // 使用0刻度的Y坐标
            .attr("x2", innerWidth)
            .attr("y2", yScale(0))  // 使用0刻度的Y坐标
            .attr("stroke", "#999999")
            .attr("stroke-width", 1);

        // 如果是最右侧的图表，在右侧也添加Y轴线
        if (col === cols - 1) {
            g.append("line")
                .attr("x1", innerWidth)
                .attr("y1", 0)
                .attr("x2", innerWidth)
                .attr("y2", innerHeight)
                .attr("stroke", "#999999")
                .attr("stroke-width", 1);
        } else {
            g.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 0)
                .attr("y2", innerHeight)
                .attr("stroke", "#999999")
                .attr("stroke-width", 1);
        }
        
        // 添加标题和图片
        subplot.append("text")
            .attr("x", subplotMargin.left + 40)
            .attr("y", 32)
            .attr("text-anchor", "start")
            .style("font-family", 'Impact')
            .style("font-size", "24px")
            // .style("font-weight", "bold")
            .style("fill", "#FFFFFF")
            .text(group);
        
        // 添加组图片（如果有）
        if (images.field && images.field[group]) {
            // 创建圆形遮罩
            const maskId = `circle-mask-${i}`;
            
            // 添加圆形遮罩定义
            defs.append("mask")
                .attr("id", maskId)
                .append("circle")
                .attr("cx", 18)
                .attr("cy", 18)
                .attr("r", 19.5)
                .attr("fill", "white");
            
            // 获取图片的base64数据
            const imgData = images.field[group];
            
            // 创建图片容器组
            const imgGroup = subplot.append("g")
                .attr("transform", `translate(${subplotMargin.left}, 7)`);
            
            // 添加白色圆形边框
            imgGroup.append("circle")
                .attr("cx", 18)
                .attr("cy", 18)
                .attr("r", 19.5)
                .attr("fill", "none")
                .attr("stroke", "white")
                .attr("stroke-width", 1);
            
            // 添加带遮罩的图片
            imgGroup.append("image")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 36)
                .attr("height", 36)
                .attr("mask", `url(#${maskId})`)
                .attr("xlink:href", imgData);
        }
    
        // 添加y轴刻度 - 根据位置决定显示左侧还是右侧
        yTicks.forEach(tick => {
            
            // 右侧刻度 - 只有最右侧的图表显示
            if (col === cols - 1) {
                g.append("text")
                    .attr("x", innerWidth + 10)
                    .attr("y", yScale(tick))
                    .attr("text-anchor", "start")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", 'Arial Narrow')
                    .style("font-size", "16px")
                    .style("fill", "#d5d5d5")
                    .text(tick);
            } else {
                // 左侧刻度
                g.append("text")
                    .attr("x", -10)
                    .attr("y", yScale(tick))
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", 'Arial Narrow')
                    .style("font-size", "16px")
                    .style("fill", "#d5d5d5")
                    .text(tick);
            }
        });
        
        // 添加x轴刻度
        xTicks.forEach(tick => {
            g.append("text")
                .attr("x", xScale(tick))
                .attr("y", innerHeight + 25)
                .attr("text-anchor", "middle")
                .style("font-family", 'Arial Narrow')
                .style("font-size", "16px")
                .style("fill", "#d5d5d5")
                .text(xFormat(tick));
        });
        
        // 创建线条生成器
        const line = d3.line()
            .x(d => xScale(parseDate(d[xField])))
            .y(d => yScale(d[yField]))
            .curve(d3.curveStepAfter); // 使用阶梯曲线
        
        // 绘制线条
        g.append("path")
            .datum(groupData)
            .attr("fill", "none")
            .attr("stroke", colors.field[group]) // 蓝色
            .attr("stroke-width", 2.5)
            .attr("d", line);
        
        // 添加最终利率值标签
        if (groupData.length > 0) {
            const lastPoint = groupData[groupData.length - 1];
            const secondLastPoint = groupData[groupData.length - 2];
            
            // 判断最后一段是向上还是向下
            const isGoingDown = lastPoint[yField] < secondLastPoint[yField];
            
            // 根据方向决定标签位置
            const labelOffset = isGoingDown ? 20 : -10;

            const labelXOffset = col === cols - 1 ? -17 : 0;
            
            g.append("text")
                .attr("x", xScale(parseDate(lastPoint[xField])) + labelXOffset)
                .attr("y", yScale(lastPoint[yField]) + labelOffset)
                .attr("text-anchor", "middle")
                .style("font-family", 'Arial Narrow')
                .style("font-size", "18px")
                .style("fill", "#d5d5d5")
                .text(lastPoint[yField].toFixed(1));
        }
    });
    
    return svg.node();
} 
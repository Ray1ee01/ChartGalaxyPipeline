/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Bar Chart",
    "chart_name": "vertical_bar_chart_02",
    "is_composite": true,
    "required_fields": [["x", "y"], ["x", "y2"]],
    "required_fields_type": [
        [["categorical"], ["numerical"]],
        [["categorical"], ["numerical"]]
    ],
    "required_fields_range": [
        [[2, 30], [0, "inf"]],
        [[2, 30], [-100, 100]]
    ],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["radius_corner", "spacing", "shadow", "gradient", "stroke"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "bottom",
    "has_x_axis": "yes",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 垂直条形图与百分比圆圈复合图表实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          
    const chartData = jsonData.data.data || [];          
    const variables = jsonData.variables || {};     
    const typography = jsonData.typography || {     
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || { 
        text_color: "#000000", 
        field: {},
        other: { 
            primary: "#FF9F55",  // 默认柱状图颜色
            indicator: "#8BDB24"  // 默认指示器颜色
        } 
    };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.data_columns || [];
    const titles = jsonData.titles || {};
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true;
    variables.has_shadow = variables.has_shadow !== undefined ? variables.has_shadow : false;
    variables.has_gradient = variables.has_gradient !== undefined ? variables.has_gradient : false;
    variables.has_stroke = variables.has_stroke !== undefined ? variables.has_stroke : false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表尺寸
    const width = variables.width || 800;
    const height = variables.height || 500;
    
    // 设置边距
    const margin = {
        top: 80,       // 顶部留出空间用于百分比圆圈
        right: 30,
        bottom: 60,    // 底部留出空间用于标签
        left: 40
    };
    
    // 计算实际绘图区域大小
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 3. 提取字段名称和单位 ----------
    
    // 从数据列中提取字段名称
    const categoryField = dataColumns.find(col => col.role === "x")?.name || "Event";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "Spending (billion USD)";
    
    // 直接提取百分比字段名称，不做任何额外假设
    const percentageField = dataColumns.find(col => col.role === "y2")?.name || "Change vs. 2021";
    
    // 获取字段单位（如果存在）
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                     dataColumns.find(col => col.role === "y")?.unit || "";
    const percentageUnit = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : 
                         dataColumns.find(col => col.role === "y2")?.unit || "%";
    
    // ---------- 4. 数据处理 ----------
    
    // 使用提供的数据
    let useData = [...chartData];
    
    // 获取分类的唯一值
    const categories = useData.map(d => d[categoryField]);
    
    // 获取百分比的最小和最大值，用于缩放圆的面积
    const minPercentage = d3.min(useData, d => +d[percentageField]);
    const maxPercentage = d3.max(useData, d => +d[percentageField]);
    
    // ---------- 5. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6. 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 如果需要，创建阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 如果需要，为每个类别创建渐变
    if (variables.has_gradient) {
        categories.forEach((category, i) => {
            const color = getBarColor(category);
            
            const gradient = defs.append("linearGradient")
                .attr("id", `gradient-${i}`)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "0%")
                .attr("y2", "100%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(color).brighter(0.5));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(color).darker(0.3));
        });
    }
    
    // ---------- 7. 创建图表区域 ----------
    
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 8. 创建比例尺 ----------
    
    // X比例尺（分类）
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(variables.has_spacing ? 0.4 : 0.1);
    
    // Y比例尺（数值）
    // 找出数据中的最大值并添加一些边距
    const dataMax = d3.max(useData, d => +d[valueField]) * 1.2;
    
    const yScale = d3.scaleLinear()
        .domain([0, dataMax])
        .range([innerHeight, 0]);
    
    // 修改: 创建圆圈面积的比例尺，而不是半径
    // 定义最小和最大面积
    const minArea = Math.PI * Math.pow(xScale.bandwidth() / 8, 2); // 最小圆的面积 (半径为20)
    const maxArea = Math.PI * Math.pow(xScale.bandwidth() / 3, 2); // 最大圆的面积 (半径为40)
    
    const areaScale = d3.scaleLinear()
        .domain([minPercentage, maxPercentage])
        .range([minArea, maxArea]);
    
    // ---------- 9. 获取颜色的辅助函数 ----------
    
    // 获取柱状图颜色
    function getBarColor(category) {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        
        
        
        return colors.other.primary || "#FF9F55";
    }
    
    // 获取指示器颜色
    function getIndicatorColor() {
        return colors.other.primary || "#8BDB24";  // 亮绿色
    }
    
    // ---------- 10. 添加图例 ----------
    
    // 在图表顶部添加百分比圆圈图例
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${margin.left + innerWidth/2}, 80)`);
    
    // 添加图例圆圈
    legend.append("circle")
        .attr("cx", -10)
        .attr("cy", 0)
        .attr("r", 10)
        .attr("fill", getIndicatorColor());
    
    // 添加图例文本
    const legendText = legend.append("text")
        .attr("x", 10)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(percentageField);
    
    // 重新定位图例到真正的中心位置
    // 计算文本宽度 (使用getBBox获取实际文本尺寸)
    const textWidth = legendText.node().getBBox().width;
    // 计算整个图例的总宽度 (圆圈宽度 + 间距 + 文本宽度)
    const circleWidth = 20; // 圆直径
    const spacing = 10;     // 圆和文本之间的间距
    const totalLegendWidth = circleWidth + spacing + textWidth;
    
    // 重新定位整个图例组，使其整体居中
    legend.attr("transform", `translate(${margin.left + innerWidth/2 - totalLegendWidth/2}, 80)`);
    
    // ---------- 11. 计算动态文本大小的函数 ----------
    
    const calculateFontSize = (text, maxWidth, baseSize = 14) => {
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        // 否则，按比例缩小字体大小
        return Math.max(10, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // 检查是否应该显示x轴标签
    const shouldShowLabels = () => {
        // 检查图表
        const labelsTooLong = useData.some(d => {
            const text = d[categoryField].toString();
            const avgCharWidth = 12 * 0.6; // 使用基础字体大小12
            const textWidth = text.length * avgCharWidth;
            return textWidth > xScale.bandwidth() * 2;
        });
        
        // 如果任意标签太长，返回false
        return !labelsTooLong;
    };
    
    // ---------- 12. 创建底部x轴 ----------
    
    const showLabels = shouldShowLabels();
    
    chart.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call(g => {
            g.select(".domain").remove();
            g.selectAll(".tick text")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color)
                .attr("dy", "1em")
                .style("visibility", showLabels ? "visible" : "hidden")
                .each(function(d) {
                    if (showLabels) {
                        const text = d.toString();
                        const fontSize = calculateFontSize(text, xScale.bandwidth(), 14);
                        d3.select(this).style("font-size", `${fontSize}px`);
                    }
                });
        });
    
    // ---------- 13. 绘制柱状图和指示器 ----------
    
    useData.forEach((d, i) => {
        const category = d[categoryField];
        const value = +d[valueField];
        
        // 正确获取百分比值
        const percentage = +d[percentageField];
        
        const barWidth = xScale.bandwidth();
        const barHeight = innerHeight - yScale(value);
        const barX = xScale(category);
        const barY = yScale(value);
        
        // 绘制柱状图
        chart.append("rect")
            .attr("class", "bar")
            .attr("x", barX)
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("fill", variables.has_gradient ? `url(#gradient-${i})` : getBarColor(category))
            .attr("rx", variables.has_rounded_corners ? 5 : 0)
            .attr("ry", variables.has_rounded_corners ? 5 : 0)
            .attr("stroke", variables.has_stroke ? d3.rgb(getBarColor(category)).darker(0.5) : "none")
            .attr("stroke-width", variables.has_stroke ? 1.5 : 0)
            .style("filter", "none");
        
        // 添加数值标签在柱状图底部
        chart.append("text")
            .attr("class", "value-label")
            .attr("x", barX + barWidth / 2)
            .attr("y", innerHeight)  // 放在底部
            .attr("dy", "-0.5em")   // 向上微调
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", Math.max(12,barWidth/5)+"px")
            .style("font-weight", "bold")
            .style("fill", "#ffffff")  // 使用文本颜色
            .text(value + (valueUnit ? " " + valueUnit : ""));

        // 修改: 根据面积比例计算圆半径
        // 1. 获取与百分比对应的面积
        const area = areaScale(percentage);
        // 2. 从面积计算半径: r = sqrt(area / π)
        const circleRadius = Math.min(Math.sqrt(area / Math.PI), barWidth / 2);
        
        const circleX = barX + barWidth / 2;
        // 放置在柱子顶部
        const circleY = barY;
        
        // 绘制百分比圆圈背景
        chart.append("circle")
            .attr("class", "percentage-circle")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", circleRadius)
            .attr("fill", getIndicatorColor())
            .attr("stroke", variables.has_stroke ? d3.rgb(getIndicatorColor()).darker(0.3) : "none")
            .attr("stroke-width", variables.has_stroke ? 1 : 0)
            .style("filter", variables.has_shadow ? "url(#shadow)" : "none");
        
        // FIX: 添加带+号的百分比文本
        const percentageText = percentage >= 0 ? `+${percentage}${percentageUnit}` : `${percentage}${percentageUnit}`;
        
        chart.append("text")
            .attr("class", "percentage-label")
            .attr("x", circleX)
            .attr("y", circleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)  // 动态调整字体大小
            .style("font-weight", typography.label.font_weight)
            .style("fill", "#000000")
            .text(percentageText);
        
        // 如果需要，添加阴影效果
        if (variables.has_shadow) {
            // 为圆圈添加阴影
            chart.append("circle")
                .attr("cx", circleX + 2)
                .attr("cy", circleY + 2)
                .attr("r", circleRadius)
                .attr("fill", "rgba(0,0,0,0.2)")
                .attr("opacity", 0.3)
                .style("filter", "blur(3px)")
                .lower();  // 将阴影移到圆圈后面
        }
    });
    
    // 返回SVG节点
    return svg.node();
}
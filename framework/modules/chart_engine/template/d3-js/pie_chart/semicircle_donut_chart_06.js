/*
REQUIREMENTS_BEGIN
{
    "chart_type": "SemiCircle Donut Chart",
    "chart_name": "semi_circle_donut_chart_06_d3",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner", "stroke"],
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

// 半圆饼图实现 - 使用半圆饼图表示数据值
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data || [];
    const variables = jsonData.variables || {};
    const dataColumns = jsonData.data.columns || [];

    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    let colors = jsonData.colors || {
        text_color: "#333333",
        field: {},
        other: {
            primary: "#4682B4" // 默认主色调
        }
    };

    // 提取字段名称
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    // Set dimensions and margins
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // Calculate center point and max radius
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d[yField])
        .sort(null);

    // 创建弧形生成器
    const arc = d3.arc()
        .innerRadius(maxRadius*0.5)
        .outerRadius(maxRadius)
        .startAngle(-Math.PI / 2)  // 设置起始角度为-90度
        .endAngle(Math.PI / 2)     // 设置结束角度为90度
        .padAngle(0)
        .cornerRadius(5);

    // 计算每个组的百分比
    const total = d3.sum(chartData, d => d[yField]);
    const dataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: (d[yField] / total) * 100
    }));
    const sectors = pie(dataWithPercentages);
    console.log("sectors: ", sectors);

    // 计算标签位置的函数
    function calculateLabelPosition(d, outerRadius) {
        // 计算扇区中心角度
        const angle = (d.startAngle + d.endAngle) / 2;
        
        // 计算外部标签位置，添加一些边距
        const labelRadius = outerRadius * 1.2;
        
        // 基于角度和半径计算最终位置
        const x = Math.sin(angle) * labelRadius;
        const y = -Math.cos(angle) * labelRadius;
        
        return [x, y];
    }

    // 估算文本宽度和高度的函数
    function estimateTextDimensions(text, fontSize) {
        // 一个简单的估算方法，可根据实际情况调整
        const avgCharWidth = fontSize * 0.6;
        const width = text.length * avgCharWidth;
        const height = fontSize * 1.2;
        return { width, height };
    }
    
    // 计算扇区最大可用宽度
    function calculateSectorMaxWidth(d, radius) {
        // 计算扇区角度
        const sectorAngle = d.endAngle - d.startAngle;
        // 在弧的中间位置计算最大宽度
        // 弧长 = 角度 * 半径，取80%作为安全尺寸
        return Math.min(sectorAngle * radius * 0.8, 60); // 添加硬限制60
    }
    
    // 截断或调整文本以适应最大宽度
    function fitTextToWidth(text, fontSize, maxWidth) {
        const dimensions = estimateTextDimensions(text, fontSize);
        if (dimensions.width <= maxWidth) {
            return { text, fontSize };
        }
        
        // 如果文本太长，先尝试缩小字体
        const minFontSize = 10; // 最小可接受的字体大小
        if (fontSize > minFontSize) {
            const newFontSize = Math.max(minFontSize, fontSize * (maxWidth / dimensions.width));
            const newDimensions = estimateTextDimensions(text, newFontSize);
            if (newDimensions.width <= maxWidth) {
                return { text, fontSize: newFontSize };
            }
        }
        
        // 如果缩小字体后仍然超出，则截断文本
        const charWidth = fontSize * 0.6;
        const maxChars = Math.floor(maxWidth / charWidth) - 2; // 减2留出省略号空间
        if (maxChars < 3) { // 如果连3个字符都放不下
            return { text: "...", fontSize };
        }
        
        return { text: text.substring(0, maxChars) + "...", fontSize };
    }
    
    for (let i = 0; i < sectors.length; i++) {
        const d = sectors[i];
        console.log("d", d);
        // 绘制甜甜圈图的各个部分
        const path = g.append("path")
            .attr("fill", colors.field[d.data[xField]] || colors.other.primary)
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 2)
            .attr("d", arc(d));

        // 计算扇区中心点
        // 创建一个专门用于计算扇区中心的弧生成器
        const arcCentroid = d3.arc()
            .innerRadius((maxRadius*0.5 + maxRadius) / 2) // 使用内外半径的中点
            .outerRadius((maxRadius*0.5 + maxRadius) / 2);
        
        // 获取扇区中心点坐标
        const [cx, cy] = arcCentroid.centroid(d);
        
        // 计算图标尺寸，根据扇区大小调整
        const angleSize = d.endAngle - d.startAngle;
        const iconSizeBase = Math.min(angleSize * maxRadius * 0.3, 60);
        let iconWidth = Math.max(iconSizeBase, 20); // 至少20像素
        let iconHeight = iconWidth;
        
        // 创建剪切路径
        const clipId = `clip-${i}`;
        const defs = g.append("defs");
        const clipPath = defs.append("clipPath")
            .attr("id", clipId);
            
        // 设置剪切路径
        clipPath.append("circle")
            .attr("cx", cx)
            .attr("cy", cy) 
            .attr("r", iconWidth / 2);

        // 添加白色背景圆
        const circle = g.append("circle")
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", iconWidth / 2 + 3)
            .attr("fill", "white")
            .attr("stroke", colors.field[d.data[xField]] || colors.other.primary)
            .attr("stroke-width", 2);

        // 使用剪切路径裁剪图片
        const icon = g.append("image")
            .attr("xlink:href", jsonData.images.field[d.data[xField]])
            .attr("clip-path", `url(#${clipId})`)
            .attr("x", cx - iconWidth / 2)
            .attr("y", cy - iconHeight / 2)
            .attr("width", iconWidth)
            .attr("height", iconHeight);

        // 计算标签位置（在外部）
        const labelPosition = calculateLabelPosition(d, maxRadius);
        
        // 准备显示文本
        let displayTextCategory = d.data[xField];
        let displayTextNumerical = `${d.data.percentage.toFixed(1)}%`;
        
        // 设置字体大小
        let categoryFontSize = 14;
        let numericalFontSize = 16;
        
        // 计算最大可用宽度
        const maxAvailableWidth = 80; // 外部标签可以稍微宽一些
        
        // 调整文本以适应可用宽度
        const fittedCategory = fitTextToWidth(displayTextCategory, categoryFontSize, maxAvailableWidth);
        displayTextCategory = fittedCategory.text;
        categoryFontSize = fittedCategory.fontSize;
        
        const fittedNumerical = fitTextToWidth(displayTextNumerical, numericalFontSize, maxAvailableWidth);
        displayTextNumerical = fittedNumerical.text;
        numericalFontSize = fittedNumerical.fontSize;
        
        // 确定文本颜色（这里使用黑色，因为标签在外部）
        const textColor = "#000000";
        
        // 添加文本标签
        // 添加类别文本
        const textCategory = g.append("text")
            .attr("transform", `translate(${labelPosition})`)
            .attr("text-anchor", "middle")
            .style("fill", textColor)
            .style("font-family", typography.label.font_family)
            .style("font-size", `${categoryFontSize}px`)
            .text(displayTextCategory);

        // 添加数值文本（在类别下方）
        const textNumerical = g.append("text")
            .attr("transform", `translate(${labelPosition[0]}, ${labelPosition[1] + categoryFontSize + 2})`)
            .attr("text-anchor", "middle")
            .style("fill", textColor)
            .style("font-family", typography.label.font_family)
            .style("font-size", `${numericalFontSize}px`)
            .style("font-weight", "bold")
            .text(displayTextNumerical);
            
        // 添加一条连接线，从扇区边缘到标签
        const midRadius = (maxRadius*0.5 + maxRadius) / 2;
        const angle = (d.startAngle + d.endAngle) / 2;
        const startX = Math.sin(angle) * maxRadius * 1.05;
        const startY = -Math.cos(angle) * maxRadius * 1.05;
        
        g.append("line")
            .attr("x1", startX)
            .attr("y1", startY)
            .attr("x2", labelPosition[0])
            .attr("y2", labelPosition[1] - categoryFontSize/2) // 稍微偏上一点，指向文字的中上部
            .attr("stroke", "#999")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3"); // 虚线效果
    }

    // 加入label
    const label = g.append("text")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("text-anchor", "middle")
        .style("fill", colors.text_color)
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .text(jsonData.title);

    // 添加图例 - 放在图表上方
    const legendGroup = svg.append("g")
        .attr("transform", `translate(0, -50)`);
    
    // 计算字段名宽度并添加间距
    const titleWidth = xField.length * 10;
    const titleMargin = 15;
    
    let xs = [...new Set(chartData.map(d => d[xField]))];

    const legendSize = layoutLegend(legendGroup, xs, colors, {
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
        .text(xField);
    
    // 将图例组向上移动 height/2, 并居中
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, ${-legendSize.height / 2 - 20})`);
    
    return svg.node();
}
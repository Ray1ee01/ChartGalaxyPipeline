/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Donut Chart",
    "chart_name": "donut_chart_07_d3",
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
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

    // 存储图像位置信息，用于后续避免标签重叠
    const imagePositions = [];

    // 计算避免标签与图像重叠的位置
    function calculateLabelPosition(d, iconCentroid, iconWidth, innerRadius, outerRadius, textWidth, textHeight, isLargeIcon) {
        // 计算扇区中心角度
        const angle = (d.startAngle + d.endAngle) / 2;
        
        // 计算图标半径，添加额外边距
        const iconRadius = iconWidth / 2 + 5;
        
        // 增加安全距离，确保标签和图标不重叠
        const safetyDistance = 20;
        
        // 所有标签都放在外圈，统一使用较大的半径
        const labelRadius = outerRadius + safetyDistance;
        
        // 基于角度和半径计算最终位置
        const x = Math.sin(angle) * labelRadius;
        const y = -Math.cos(angle) * labelRadius;
        
        // 额外检查：检测是否与图标有重叠
        const distance = Math.sqrt(
            Math.pow(x - iconCentroid[0], 2) + 
            Math.pow(y - iconCentroid[1], 2)
        );
        
        // 如果距离太近，再增加一些距离
        if (distance < safetyDistance) {
            const extraFactor = 1.5; // 增加额外的安全系数
            const extraDistance = (safetyDistance - distance) * extraFactor;
            labelRadius += extraDistance;
            
            // 重新计算位置
            return [
                Math.sin(angle) * labelRadius,
                -Math.cos(angle) * labelRadius
            ];
        }
        
        return [x, y];
    }

    // 移除文本宽度限制相关的函数
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

        
        const innerLength = (d.endAngle - d.startAngle) * maxRadius*0.5;
        const outerLength = (d.endAngle - d.startAngle) * maxRadius;


        let iconWidth = Math.min(innerLength / 3, 150);
        let iconHeight = iconWidth;
        if (iconWidth > 20) {
            // 获取扇区中心点
            const iconArc = d3.arc()
                .innerRadius(maxRadius*0.5)
                .outerRadius(maxRadius);
            
            const [cx, cy] = iconArc.centroid(d);

            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            // 使用扇区的路径作为剪切路径
            clipPath.append("path")
                .attr("d", iconArc(d));

            // 计算扇区的尺寸
            const angle = (d.startAngle + d.endAngle) / 2;
            const outerRadius = maxRadius;
            const innerRadius = maxRadius * 0.5;
            const sectorWidth = outerRadius * 2;
            const sectorHeight = outerRadius * 2;

            // 创建pattern用于平铺图片
            const patternId = `pattern-${i}`;
            const pattern = defs.append("pattern")
                .attr("id", patternId)
                .attr("patternUnits", "userSpaceOnUse")
                .attr("width", 50)  // 设置pattern的宽度
                .attr("height", 50) // 设置pattern的高度
                .attr("patternTransform", `rotate(${(d.startAngle + d.endAngle) * 90 / Math.PI})`); // 根据扇区角度旋转pattern

            // 在pattern中添加图片
            pattern.append("image")
                .attr("xlink:href", jsonData.images.field[d.data[xField]])
                .attr("width", 50)  // 设置图片大小
                .attr("height", 50)
                .attr("preserveAspectRatio", "xMidYMid slice");

            // 使用pattern填充扇区
            const sector = g.append("path")
                .attr("d", iconArc(d))
                .attr("fill", `url(#${patternId})`)
                .attr("clip-path", `url(#${clipId})`);

            // 存储图像位置信息
            imagePositions.push({
                centroid: [cx, cy],
                width: sectorWidth,
                height: sectorHeight
            });

            let displayTextCategory = d.data[xField];
            let displayTextNumerical = d.data.percentage >= 2 ? `${d.data.percentage.toFixed(1)}%` : '';
            let categoryFontSize = 20;
            let numericalFontSize = 20;
            
            // 移除文本宽度限制相关的计算
            const categoryDimensions = estimateTextDimensions(displayTextCategory, categoryFontSize);
            const numericalDimensions = estimateTextDimensions(displayTextNumerical, numericalFontSize);
            // 计算标签总高度（包括两行文本和间距）
            const labelHeight = categoryDimensions.height + numericalDimensions.height + 5;
            // 取两行文本中较宽的一个作为标签宽度
            const labelWidth = Math.max(categoryDimensions.width, numericalDimensions.width);
            
            // 计算避免与图像重叠的标签位置
            const labelPosition = calculateLabelPosition(
                d, 
                [cx, cy], 
                iconWidth, 
                maxRadius*0.5, 
                maxRadius,
                labelWidth,
                labelHeight,
                true  // 传递标志表示这是大图标情况
            );
            
            const fillColor = colors.field[d.data[xField]] || colors.other.primary;
            // 如果这里颜色深，则使用白色文字，否则使用黑色文字
            // 将颜色转换为RGB值
            const rgb = fillColor.match(/\d+/g).map(Number);
            // 计算亮度 (使用相对亮度公式)
            const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
            if (brightness < 150) {
                colors.text_color = '#FFFFFF';
            } else {
                colors.text_color = '#000000';
            }

            // 根据角度决定文本对齐方式
            let textAnchor;
            if (angle < Math.PI/8 || angle > 15*Math.PI/8) {
                textAnchor = "middle";  // 正上方和正下方，居中对齐
            } else if (angle >= Math.PI/8 && angle < 7*Math.PI/8) {
                textAnchor = "start";   // 右侧区域，左对齐
            } else if (angle >= 7*Math.PI/8 && angle < 9*Math.PI/8) {
                textAnchor = "middle";  // 正左方，居中对齐
            } else if (angle >= 9*Math.PI/8 && angle < 15*Math.PI/8) {
                textAnchor = "end";     // 左侧区域，右对齐
            } else {
                textAnchor = "middle";  // 默认值
            }

            const textCategory = g.append("text")
                .attr("transform", `translate(${labelPosition})`)
                .attr("text-anchor", textAnchor)
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", categoryFontSize)
                .text(displayTextCategory);

            const textNumerical = g.append("text")
                .attr("transform", `translate(0,20) translate(${labelPosition})`)
                .attr("text-anchor", textAnchor)
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", numericalFontSize)
                .text(displayTextNumerical);
        } else {
            iconWidth = 20;
            iconHeight = 20;
            
            // 获取扇区中心点和弧形路径
            const iconArc = d3.arc()
                .innerRadius(maxRadius*0.5)
                .outerRadius(maxRadius);
            
            const [cx, cy] = iconArc.centroid(d);

            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            // 使用扇区的路径作为剪切路径
            clipPath.append("path")
                .attr("d", iconArc(d));

            // 计算扇区的尺寸
            const angle = (d.startAngle + d.endAngle) / 2;
            const outerRadius = maxRadius;
            const innerRadius = maxRadius * 0.5;
            const sectorWidth = outerRadius * 2;
            const sectorHeight = outerRadius * 2;

            // 创建pattern用于平铺图片
            const patternId = `pattern-${i}`;
            const pattern = defs.append("pattern")
                .attr("id", patternId)
                .attr("patternUnits", "userSpaceOnUse")
                .attr("width", 50)  // 设置pattern的宽度
                .attr("height", 50) // 设置pattern的高度
                .attr("patternTransform", `rotate(${(d.startAngle + d.endAngle) * 90 / Math.PI})`); // 根据扇区角度旋转pattern

            // 在pattern中添加图片
            pattern.append("image")
                .attr("xlink:href", jsonData.images.field[d.data[xField]])
                .attr("width", 50)  // 设置图片大小
                .attr("height", 50)
                .attr("preserveAspectRatio", "xMidYMid slice");

            // 使用pattern填充扇区
            const sector = g.append("path")
                .attr("d", iconArc(d))
                .attr("fill", `url(#${patternId})`)
                .attr("clip-path", `url(#${clipId})`);

            // 存储图像位置信息
            imagePositions.push({
                centroid: [cx, cy],
                width: sectorWidth,
                height: sectorHeight
            });
            
            let displayTextCategory = d.data[xField];
            let displayTextNumerical = `${d.data.percentage.toFixed(1)}%`;
            let categoryFontSize = 20;
            let numericalFontSize = 20;
            
            // 计算扇区的最大可用宽度
            const maxAvailableWidth = calculateSectorMaxWidth(d, maxRadius*0.5-30);
            
            // 调整类别文本和字体大小以适应扇区
            const fittedCategory = fitTextToWidth(displayTextCategory, categoryFontSize, maxAvailableWidth);
            displayTextCategory = fittedCategory.text;
            categoryFontSize = fittedCategory.fontSize;
            
            // 调整数值文本和字体大小
            const fittedNumerical = fitTextToWidth(displayTextNumerical, numericalFontSize, maxAvailableWidth);
            displayTextNumerical = fittedNumerical.text;
            numericalFontSize = fittedNumerical.fontSize;
            
            // 估算文本尺寸
            const categoryDimensions = estimateTextDimensions(displayTextCategory, categoryFontSize);
            const numericalDimensions = estimateTextDimensions(displayTextNumerical, numericalFontSize);
            // 计算标签总高度（包括两行文本和间距）
            const labelHeight = categoryDimensions.height + numericalDimensions.height + 5;
            // 取两行文本中较宽的一个作为标签宽度
            const labelWidth = Math.max(categoryDimensions.width, numericalDimensions.width);
            
            // 计算避免与图像重叠的标签位置
            const labelPosition = calculateLabelPosition(
                d, 
                [cx, cy], 
                iconWidth, 
                maxRadius*0.5-60,
                maxRadius*0.5,
                labelWidth,
                labelHeight,
                false  // 传递标志表示这是小图标情况
            );
            
            const fillColor = colors.field[d.data[xField]] || colors.other.primary;

            // 根据角度决定文本对齐方式
            let textAnchor;
            if (angle < Math.PI/8 || angle > 15*Math.PI/8) {
                textAnchor = "middle";  // 正上方和正下方，居中对齐
            } else if (angle >= Math.PI/8 && angle < 7*Math.PI/8) {
                textAnchor = "start";   // 右侧区域，左对齐
            } else if (angle >= 7*Math.PI/8 && angle < 9*Math.PI/8) {
                textAnchor = "middle";  // 正左方，居中对齐
            } else if (angle >= 9*Math.PI/8 && angle < 15*Math.PI/8) {
                textAnchor = "end";     // 左侧区域，右对齐
            } else {
                textAnchor = "middle";  // 默认值
            }

            const textCategory = g.append("text")
                .attr("transform", `translate(${labelPosition})`)
                .attr("text-anchor", textAnchor)
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", categoryFontSize)
                .text(displayTextCategory);

            const textNumerical = g.append("text")
                .attr("transform", `translate(0,20) translate(${labelPosition})`)
                .attr("text-anchor", textAnchor)
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", numericalFontSize)
                .text(displayTextNumerical);
        }
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
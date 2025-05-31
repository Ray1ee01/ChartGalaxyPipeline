/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Donut Chart",
    "chart_name": "donut_chart_icons_02",
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
    const centerY = height / 2 + 100;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d[yField])
        .sort(null)
        .startAngle(0)  // 设置起始角度为-90度
        .endAngle(2*Math.PI)     // 设置结束角度为90度

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

    // 存储图像位置信息，用于后续避免标签重叠
    const imagePositions = [];

    // 计算避免标签与图像重叠的位置
    function calculateLabelPosition(d, iconCentroid, iconWidth, innerRadius, outerRadius, textWidth, textHeight, isLargeIcon) {
        // 计算扇区中心角度
        const angle = (d.startAngle + d.endAngle) / 2;
        
        // 计算图标半径，添加额外边距
        const iconRadius = iconWidth / 2 + 5;
        
        // 增加安全距离，确保标签和图标不重叠
        const safetyDistance = isLargeIcon ? 
            iconRadius + Math.max(textWidth, textHeight) / 1.5 :
            iconRadius * 2;
        
        // 根据扇区角度调整标签位置
        let labelRadius;

        // 根据扇区的角度位置采用不同的放置策略
        if (angle >= 0 && angle <= Math.PI / 4) {
            // 右上角，标签放在外圈右侧
            labelRadius = outerRadius + safetyDistance / 2.5;
        } else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) {
            // 上半部，标签放在较远的位置
            labelRadius = outerRadius + safetyDistance / 2;
        } else if (angle > 3 * Math.PI / 4 && angle <= 5 * Math.PI / 4) {
            // 左半部，标签靠近内圈
            labelRadius = Math.max(innerRadius - safetyDistance / 1.8, innerRadius * 0.4);
        } else if (angle > 5 * Math.PI / 4 && angle <= 7 * Math.PI / 4) {
            // 下半部，标签放在较远的位置
            labelRadius = outerRadius + safetyDistance / 2;
        } else {
            // 右下角，标签放在外圈右侧
            labelRadius = outerRadius + safetyDistance / 2.5;
        }
        
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
            const extraFactor = 2.0; // 增加额外的安全系数
            const extraDistance = (safetyDistance - distance) * extraFactor;
            
            // 根据角度决定向哪个方向移动更多
            if ((angle >= 0 && angle <= Math.PI / 4) || (angle > 7 * Math.PI / 4 && angle <= 2 * Math.PI)) {
                // 右侧区域，向外移动
                labelRadius += extraDistance;
            } else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) {
                // 上方区域，向上移动
                labelRadius += extraDistance;
            } else if (angle > 3 * Math.PI / 4 && angle <= 5 * Math.PI / 4) {
                // 左侧区域，优先向内移动
                if (innerRadius > textWidth * 1.2) {
                    labelRadius = Math.max(innerRadius * 0.35, labelRadius - extraDistance);
                } else {
                    labelRadius += extraDistance;
                }
            } else {
                // 下方区域，向下移动
                labelRadius += extraDistance;
            }
            
            // 重新计算位置
            return [
                Math.sin(angle) * labelRadius,
                -Math.cos(angle) * labelRadius
            ];
        }
        
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
        return sectorAngle * radius * 0.8;
    }
    
    // 调整文本以适应最大宽度 - 只缩小字体，不截断文本
    function fitTextToWidth(text, fontSize, maxWidth) {
        const dimensions = estimateTextDimensions(text, fontSize);
        if (dimensions.width <= maxWidth) {
            return { text, fontSize };
        }
        
        // 如果文本太长，尝试缩小字体
        const minFontSize = 8; // 最小可接受的字体大小
        if (fontSize > minFontSize) {
            const newFontSize = Math.max(minFontSize, fontSize * (maxWidth / dimensions.width));
            return { text, fontSize: newFontSize };
        }
        
        return { text, fontSize: minFontSize };
    }
    
    // 计算标签位置 - 确保标签始终在外部，不会出现在饼图内部
    function calculateOuterLabelPosition(d, outerRadius) {
        // 计算扇区中心角度
        const angle = (d.startAngle + d.endAngle) / 2;
        
        // 确保标签始终在外圈，添加更大的边距确保不会出现在内部
        // 增加倍数从1.2到1.5，确保标签彻底在外部
        const labelRadius = outerRadius * 1.5;
        
        // 基于角度和半径计算最终位置
        return [
            Math.sin(angle) * labelRadius,
            -Math.cos(angle) * labelRadius
        ];
    }
    
    // 检查扇区是否有足够空间放置图标
    function hasEnoughSpaceForIcon(d, innerRadius) {
        // 计算扇区的内圆弧长度
        const sectorAngle = d.endAngle - d.startAngle;
        const arcLength = sectorAngle * innerRadius;
        
        // 严格判断：扇区必须足够大才显示图标
        // 最小要求提高到30像素，确保图标有足够空间
        return arcLength >= 30;
    }
    
    for (let i = 0; i < sectors.length; i++) {
        const d = sectors[i];
        // 绘制甜甜圈图的各个部分
        const path = g.append("path")
            .attr("fill", colors.field[d.data[xField]] || colors.other.primary)
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 2)
            .attr("d", arc(d));

        // 检查扇区是否有足够空间放置图标
        const innerRadius = maxRadius * 0.75;
        const hasSpace = hasEnoughSpaceForIcon(d, innerRadius);
        
        // 只有当扇区空间足够大时才显示图标
        if (hasSpace) {
            // 计算扇区的内圆弧长度
            const sectorAngle = d.endAngle - d.startAngle;
            const arcLength = sectorAngle * innerRadius;
            
            // 根据弧长计算图标大小，保持最小和最大限制
            const minIconSize = 16;  // 最小图标尺寸
            const maxIconSize = 50;  // 最大图标尺寸
            const baseIconSize = Math.min(maxIconSize, Math.max(minIconSize, arcLength * 0.5));
            
            // 设置图标尺寸
            const iconWidth = baseIconSize;
            const iconHeight = baseIconSize;
            
            // 计算图标位置 - 确保图标在内圆弧上居中
            const angle = (d.startAngle + d.endAngle) / 2;
            const iconRadius = innerRadius; // 确保图标位于内圆弧之上
            const cx = Math.sin(angle) * iconRadius;
            const cy = -Math.cos(angle) * iconRadius;
            
            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            clipPath.append("circle")
                .attr("cx", cx)
                .attr("cy", cy) 
                .attr("r", iconWidth / 2);

            // 添加白色背景圆
            g.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconWidth / 2 + 3)
                .attr("fill", "white")
                .attr("stroke", colors.field[d.data[xField]] || colors.other.primary)
                .attr("stroke-width", 2);

            // 使用剪切路径裁剪图片
            g.append("image")
                .attr("xlink:href", jsonData.images.field[d.data[xField]])
                .attr("clip-path", `url(#${clipId})`)
                .attr("x", cx - iconWidth / 2)
                .attr("y", cy - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight);
        }
        
        // 标签处理 - 所有标签都放在外部
        // 准备显示的文本
        let displayTextCategory = d.data[xField];
        let displayTextValue = `${d.data.percentage.toFixed(1)}% (${d.data[yField]})`;
        
        // 设置初始字体大小
        let categoryFontSize = 14;
        let valueFontSize = 12;
        
        // 计算标签位置 - 确保标签在外部
        const labelPosition = calculateOuterLabelPosition(d, maxRadius);
        
        // 计算最大可用宽度 - 外部标签可以有更多空间
        const outerSpaceWidth = width * 0.4; // 增加到宽度的40%
        
        // 调整文本字体大小以确保文本完整显示
        const fittedCategory = fitTextToWidth(displayTextCategory, categoryFontSize, outerSpaceWidth);
        const fittedValue = fitTextToWidth(displayTextValue, valueFontSize, outerSpaceWidth);
        
        // 设置文本颜色
        const fillColor = colors.field[d.data[xField]] || colors.other.primary;
        // 计算文本颜色 - 使用黑色作为默认颜色，确保可读性
        const textColor = "#000000";
        
        // 添加标签 - 类别名称
        g.append("text")
            .attr("transform", `translate(${labelPosition})`)
            .attr("text-anchor", "middle")
            .style("fill", textColor)
            .style("font-family", typography.label.font_family)
            .style("font-size", `${fittedCategory.fontSize}px`)
            .style("font-weight", "bold")
            .text(fittedCategory.text);

        // 添加标签 - 百分比和原始值
        g.append("text")
            .attr("transform", `translate(${labelPosition[0]}, ${labelPosition[1] + fittedCategory.fontSize + 4})`)
            .attr("text-anchor", "middle")
            .style("fill", textColor)
            .style("font-family", typography.label.font_family)
            .style("font-size", `${fittedValue.fontSize}px`)
            .text(fittedValue.text);
        
        // 添加辅助线连接扇区和标签
        const arcCentroid = arc.centroid(d);
        
        // 连接线起点位于扇区中心位置
        const lineStartX = arcCentroid[0];
        const lineStartY = arcCentroid[1];
        
        // 连接线终点位于标签起始位置的90%处，避免直接连到文字
        const lineEndX = labelPosition[0] * 0.9;
        const lineEndY = labelPosition[1] * 0.9;
        
        g.append("line")
            .attr("x1", lineStartX)
            .attr("y1", lineStartY)
            .attr("x2", lineEndX)
            .attr("y2", lineEndY)
            .attr("stroke", "#888888")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
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
    const legendGroup = svg.append("g");
    
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
        .attr("fill", colors.text_color)
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(xField);
    
    // 将图例组向上移动 height/2, 并居中
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, ${-legendSize.height / 2 - 50})`);
    
    return svg.node();
}
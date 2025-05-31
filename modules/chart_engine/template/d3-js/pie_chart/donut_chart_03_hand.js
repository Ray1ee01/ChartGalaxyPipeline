/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Donut Chart",
    "chart_name": "donut_chart_03_d3_hand",
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
    function calculateLabelPosition(d, iconCentroid, iconWidth, innerRadius, outerRadius, textWidth, textHeight) {
        // 计算扇区中心角度
        const angle = (d.startAngle + d.endAngle) / 2;
        
        // 计算基础文本位置（在内圆和外圆之间）
        const labelRadius = (innerRadius + outerRadius) / 2;
        const x = Math.sin(angle) * labelRadius;
        const y = -Math.cos(angle) * labelRadius;
        
        // 计算文本边界框
        const textBBox = {
            x: x - textWidth / 2,
            y: y - textHeight / 2,
            width: textWidth,
            height: textHeight
        };
        
        // 计算图像边界框
        const iconBBox = {
            x: iconCentroid[0] - iconWidth / 2,
            y: iconCentroid[1] - iconWidth / 2,
            width: iconWidth,
            height: iconWidth
        };
        
        // 检查边界框是否重叠
        // 计算重叠程度
        let overlapX = 0;
        let overlapY = 0;
        
        // 计算X轴重叠
        if (textBBox.x < iconBBox.x + iconBBox.width && iconBBox.x < textBBox.x + textBBox.width) {
            // 找出重叠部分的左边界和右边界
            const leftOverlap = Math.max(textBBox.x, iconBBox.x);
            const rightOverlap = Math.min(textBBox.x + textBBox.width, iconBBox.x + iconBBox.width);
            overlapX = rightOverlap - leftOverlap;
        }
        
        // 计算Y轴重叠
        if (textBBox.y < iconBBox.y + iconBBox.height && iconBBox.y < textBBox.y + textBBox.height) {
            // 找出重叠部分的上边界和下边界
            const topOverlap = Math.max(textBBox.y, iconBBox.y);
            const bottomOverlap = Math.min(textBBox.y + textBBox.height, iconBBox.y + iconBBox.height);
            overlapY = bottomOverlap - topOverlap;
        }
        
        // 只有当X轴和Y轴都有重叠时，才算是真正的重叠
        const overlap = overlapX > 0 && overlapY > 0;
        
        if (overlap) {
            // 计算重叠面积占文本面积的比例
            const overlapArea = overlapX * overlapY;
            const textArea = textWidth * textHeight;
            const overlapRatio = overlapArea / textArea;
            
            // 确定最小安全距离，基于重叠比例和图像尺寸
            const minSafeDistance = iconWidth/2 + 5; // 最小基础安全距离
            // 根据重叠比例增加安全距离，重叠越大，距离越远
            const additionalDistance = Math.max(30 * overlapRatio, 10);
            const safetyDistance = minSafeDistance + additionalDistance;
            
            // 计算当前标签中心到图像中心的距离
            const currentDistance = Math.sqrt(
                Math.pow(x - iconCentroid[0], 2) + 
                Math.pow(y - iconCentroid[1], 2)
            );
            
            // 如果当前位置与图标重叠，尝试沿圆周寻找合适的位置
            if (currentDistance < safetyDistance) {
                // 在当前角度的基础上，尝试在圆周方向上偏移
                // 尝试不同的偏移角度，寻找最佳位置
                const maxOffset = Math.PI / 4; // 最大偏移±45度
                const steps = 16; // 增加尝试步数
                
                let bestPosition = null;
                let bestDistance = -1;
                let bestOverlapRatio = Infinity; // 记录最小重叠比例
                
                // 在扇区角度范围内，以步进方式尝试不同位置
                const sectorWidth = d.endAngle - d.startAngle;
                // 使用扇区宽度或最大偏移值中较小的一个作为搜索范围
                const searchRange = Math.max(Math.min(maxOffset, sectorWidth * 0.8), Math.PI / 12);
                const angularStep = searchRange / steps;
                
                // 同时尝试不同的半径
                const radiusVariations = [
                    labelRadius * 0.8,  // 向内收缩
                    labelRadius,        // 原始半径
                    labelRadius * 1.1,  // 稍微向外扩展
                    labelRadius * 1.2   // 更多向外扩展
                ];
                
                // 扩大搜索范围
                for (let i = -steps; i <= steps; i++) {
                    // 计算偏移角度
                    const offsetAngle = angle + i * angularStep;
                    
                    // 对每种半径变化尝试
                    for (const testRadius of radiusVariations) {
                        // 计算新位置
                        const newX = Math.sin(offsetAngle) * testRadius;
                        const newY = -Math.cos(offsetAngle) * testRadius;
                        
                        // 计算新文本边界框
                        const newTextBBox = {
                            x: newX - textWidth / 2,
                            y: newY - textHeight / 2,
                            width: textWidth,
                            height: textHeight
                        };
                        
                        // 计算与图标的距离
                        const dist = Math.sqrt(
                            Math.pow(newX - iconCentroid[0], 2) + 
                            Math.pow(newY - iconCentroid[1], 2)
                        );
                        
                        // 检查新位置是否与图标重叠
                        let newOverlapX = 0;
                        let newOverlapY = 0;
                        
                        if (newTextBBox.x < iconBBox.x + iconBBox.width && iconBBox.x < newTextBBox.x + newTextBBox.width) {
                            const leftOverlap = Math.max(newTextBBox.x, iconBBox.x);
                            const rightOverlap = Math.min(newTextBBox.x + newTextBBox.width, iconBBox.x + iconBBox.width);
                            newOverlapX = rightOverlap - leftOverlap;
                        }
                        
                        if (newTextBBox.y < iconBBox.y + iconBBox.height && iconBBox.y < newTextBBox.y + newTextBBox.height) {
                            const topOverlap = Math.max(newTextBBox.y, iconBBox.y);
                            const bottomOverlap = Math.min(newTextBBox.y + newTextBBox.height, iconBBox.y + iconBBox.height);
                            newOverlapY = bottomOverlap - topOverlap;
                        }
                        
                        const newOverlap = newOverlapX > 0 && newOverlapY > 0;
                        
                        if (!newOverlap) {
                            // 如果没有重叠，计算这个位置相对于理想位置的距离偏移
                            // 理想位置是沿着原角度的中间半径
                            const idealX = Math.sin(angle) * labelRadius;
                            const idealY = -Math.cos(angle) * labelRadius;
                            const deviationFromIdeal = Math.sqrt(
                                Math.pow(newX - idealX, 2) + 
                                Math.pow(newY - idealY, 2)
                            );
                            
                            // 如果是首次找到无重叠位置，或者这个位置比之前找到的更接近理想位置
                            if (bestPosition === null || deviationFromIdeal < bestDistance) {
                                bestPosition = [newX, newY];
                                bestDistance = deviationFromIdeal;
                                bestOverlapRatio = 0;
                            }
                        } else if (bestOverlapRatio > 0) {
                            // 如果有重叠但比之前找到的重叠度更小
                            const overlapArea = newOverlapX * newOverlapY;
                            const textArea = textWidth * textHeight;
                            const overlapRatio = overlapArea / textArea;
                            
                            if (overlapRatio < bestOverlapRatio) {
                                // 如果重叠程度更小，也许是个好选择
                                bestPosition = [newX, newY];
                                bestDistance = dist;
                                bestOverlapRatio = overlapRatio;
                            }
                        }
                    }
                }
                
                // 如果找到了更好的位置，返回它
                if (bestPosition !== null) {
                    return bestPosition;
                }
                
                // 如果没有找到合适的圆周位置，则尝试调整半径
                // 根据角度所在象限决定向内还是向外移动
                const extraDistance = safetyDistance - currentDistance;
                let adjustedRadius;
                
                if (angle >= 0 && angle < Math.PI) {
                    // 右半边，向外移动
                    adjustedRadius = labelRadius + extraDistance + 10; // 额外10像素作为缓冲
                } else {
                    // 左半边，向内移动(如果内径足够大)或向外移动(如果内径太小)
                    if (innerRadius > textWidth) {
                        adjustedRadius = Math.max(innerRadius * 0.6, labelRadius - extraDistance - 10);
                    } else {
                        adjustedRadius = labelRadius + extraDistance + 10;
                    }
                }
                
                return [
                    Math.sin(angle) * adjustedRadius,
                    -Math.cos(angle) * adjustedRadius
                ];
            }
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
            .attr("stroke", "none")
            .attr("stroke-width", 2)
            .attr("d", arc(d));

        
        const outerLength = (d.endAngle - d.startAngle) * maxRadius;


        let iconWidth = Math.min(outerLength / 3, 150);
        let iconHeight = iconWidth;
        if (iconWidth > 20) {
            const iconArc = d3.arc()
                .innerRadius(maxRadius)
                .outerRadius(maxRadius)
                .padAngle(0.01)

            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            // 确保剪切路径有正确的位置和尺寸
            const [cx, cy] = iconArc.centroid(d);
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

            // 存储图像位置信息
            imagePositions.push({
                centroid: [cx, cy],
                width: iconWidth,
                height: iconHeight
            });

            let displayTextCategory = d.data[xField];
            let displayTextNumerical = d.data.percentage >= 2 ? `${d.data.percentage.toFixed(1)}% (${d.data[yField]})` : '';
            let categoryFontSize = 20;
            let numericalFontSize = 20;
            
            // 计算扇区的最大可用宽度
            const maxAvailableWidth = calculateSectorMaxWidth(d, (maxRadius + maxRadius*0.5) / 2);
            
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
            
            // 对于大图标，调整标签区域以避免重叠
            const labelInnerRadius = maxRadius * 0.4; // 稍微向内收缩内半径
            const labelOuterRadius = maxRadius * 1.1; // 稍微向外扩展外半径
            
            // 计算避免与图像重叠的标签位置
            const labelPosition = calculateLabelPosition(
                d, 
                [cx, cy], 
                iconWidth, 
                labelInnerRadius, 
                labelOuterRadius,
                labelWidth,
                labelHeight
            );
            
            const fillColor = colors.field[d.data[xField]] || colors.other.primary;
            // 如果这里颜色深，则使用白色文字，否则使用黑色文字
            // 将颜色转换为RGB值
            const rgb = fillColor.match(/\d+/g).map(Number);
            // 计算亮度 (使用相对亮度公式)
            const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;

            const textCategory = g.append("text")
                .attr("transform", `translate(${labelPosition})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", categoryFontSize)
                .text(displayTextCategory);

            const textNumerical = g.append("text")
                .attr("transform", `translate(0,20) translate(${labelPosition})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", numericalFontSize)
                .text(displayTextNumerical);
        } else {
            iconWidth = 20;
            iconHeight = 20;
            const iconArc = d3.arc()
                .innerRadius(maxRadius+30)
                .outerRadius(maxRadius+30);

            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            // 确保剪切路径有正确的位置和尺寸
            const [cx, cy] = iconArc.centroid(d);
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
            
            // 存储图像位置信息
            imagePositions.push({
                centroid: [cx, cy],
                width: iconWidth,
                height: iconHeight
            });
            
            let displayTextCategory = d.data[xField];
            let displayTextNumerical = `${d.data.percentage.toFixed(1)}% (${d.data[yField]})`;
            let categoryFontSize = 20;
            let numericalFontSize = 20;
            
            // 计算扇区的最大可用宽度
            const maxAvailableWidth = calculateSectorMaxWidth(d, maxRadius + 30);
            
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
            
            // 对于小图标情况，使用更大的内外半径差，给标签更多空间
            const labelInnerRadius = maxRadius + 10; // 向外偏移一点
            const labelOuterRadius = maxRadius + 70; // 更大的外半径给更多空间
            
            // 计算不重叠的标签位置
            const labelPosition = calculateLabelPosition(
                d, 
                [cx, cy], 
                iconWidth, 
                labelInnerRadius, 
                labelOuterRadius,
                labelWidth,
                labelHeight
            );
            
            const fillColor = colors.field[d.data[xField]] || colors.other.primary;

            const textCategory = g.append("text")
                .attr("transform", `translate(${labelPosition})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", categoryFontSize)
                .text(displayTextCategory);

            const textNumerical = g.append("text")
                .attr("transform", `translate(0,20) translate(${labelPosition})`)
                .attr("text-anchor", "middle")
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
        .attr("transform", `translate(0, -85)`);
    
    // 计算字段名宽度并添加间距
    const titleWidth = xField.length * 10;
    const titleMargin = 15;
    
    let xs = [...new Set(chartData.map(d => d[xField]))];

    const legendSize = layoutLegend(legendGroup, xs, colors, {
        x: titleWidth + titleMargin,
        y: 0,
        fontSize: 14 * 1.25, // 增大字体大小1.25倍
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth - titleWidth - titleMargin,
        shape: "rect",
        symbolSize: 10 * 1.8, // 增大矩形大小1.8倍
        itemSpacing: 23, // 默认20px，增加3px
        rowSpacing: 13  // 默认10px，增加3px
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
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, ${-legendSize.height / 2 - 23})`); // 增加向上移动的距离
    
    const roughness = 1;
    const bowing = 1;
    const fillStyle = "solid";
    const randomize = false;
    const pencilFilter = false;
        
    const svgConverter = new svg2roughjs.Svg2Roughjs(containerSelector);
    svgConverter.pencilFilter = pencilFilter;
    svgConverter.randomize = randomize;
    svgConverter.svg = svg.node();
    svgConverter.roughConfig = {
        bowing,
        roughness,
        fillStyle
    };
    svgConverter.sketch();
    // Remove the first SVG element if it exists
    const firstSvg = document.querySelector(`${containerSelector} svg`);
    if (firstSvg) {
        firstSvg.remove();
    }

    return svg.node();
}
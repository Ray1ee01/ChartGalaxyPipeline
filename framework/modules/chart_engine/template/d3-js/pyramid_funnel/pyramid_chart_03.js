/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Pyramid Chart",
    "chart_name": "pyramid_chart_03",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 10], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "light",
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
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const categoryField = dataColumns[0].name;
    const valueField = dataColumns[1].name;
    
    // 按值从小到大排序数据（小的在顶部）
    const sortedData = [...chartData].sort((a, b) => a[valueField] - b[valueField]);
    
    // 计算总和以获取百分比
    const total = d3.sum(sortedData, d => d[valueField]);
    
    // 为每个数据点添加百分比和累积百分比
    let cumulativePercent = 0;
    sortedData.forEach(d => {
        d.percent = (d[valueField] / total) * 100;
        d.cumulativePercentStart = cumulativePercent;
        cumulativePercent += d.percent;
        d.cumulativePercentEnd = cumulativePercent;
    });
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 120, bottom: 40, left: 60 };
    
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
    const initialChartHeightForLegend = height - margin.top - margin.bottom;

    // ---------- 图例逻辑 (借鉴 Voronoi Treemap / function_modules.js) ----------
    const uniqueCategories = [...new Set(sortedData.map(d => d[categoryField]))];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthHelper(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    let legendBlockHeight = 0;
    const legendLines = [];
    const paddingBelowLegendToChart = 20; // 图例和金字塔之间的间距增加
    const minSvgGlobalTopPadding = 15; 
    let legendItemMaxHeight = 0; 
    let interLineVerticalPadding = parseFloat(typography.label?.line_spacing || '6'); 
    let legendInterItemSpacing = 10; 

    // 获取颜色函数，与后续金字塔层颜色逻辑保持一致
    const getColorForLegend = (category, index) => {
        return colors.field && colors.field[category] 
            ? colors.field[category] 
            : d3.schemeCategory10[index % 10];
    };

    if (uniqueCategories && uniqueCategories.length > 0) { 
        const legendColorRectWidth = 12;
        const legendColorRectHeight = 12;
        const legendIconWidth = typography.label?.icon_size || 16; 
        const legendIconHeight = typography.label?.icon_size || 16;
        const legendPaddingRectIcon = 4; 
        const legendPaddingIconText = 4; 
        
        const legendFontFamily = typography.label?.font_family || 'Arial';
        const legendFontSize = parseFloat(typography.label?.font_size || '12');
        const legendFontWeight = typography.label?.font_weight || 'normal';

        legendItemMaxHeight = Math.max(legendColorRectHeight, legendIconHeight, legendFontSize);

        const legendItemsData = uniqueCategories.map((catName, index) => {
            const text = String(catName);
            const color = getColorForLegend(catName, sortedData.findIndex(d => d[categoryField] === catName)); // 确保颜色与金字塔层一致
            const iconUrl = images.field && images.field[catName] ? images.field[catName] : null;
            const textWidth = getTextWidthHelper(text, legendFontFamily, legendFontSize, legendFontWeight);
            
            let itemVisualWidth = legendColorRectWidth;
            if (iconUrl) {
                itemVisualWidth += legendPaddingRectIcon + legendIconWidth + legendPaddingIconText;
            } else {
                itemVisualWidth += legendPaddingRectIcon; // 如果没有图标，颜色块和文本之间仍有间距
            }
            itemVisualWidth += textWidth;
            return { text, color, iconUrl, textWidth, visualWidth: itemVisualWidth };
        });

        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        const availableWidthForLegendWrapping = chartWidth; // 图例在图表区域内换行

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) {
                widthIfAdded += legendInterItemSpacing;
            }
            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth;
            } else {
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendInterItemSpacing;
                }
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth;
            }
        });
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }
        if (legendLines.length > 0) {
            legendBlockHeight = legendLines.length * legendItemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
        }
    }

    let effectiveMarginTop = margin.top;
    let legendStartY = minSvgGlobalTopPadding;

    if (legendBlockHeight > 0) {
        legendStartY = Math.max(minSvgGlobalTopPadding, margin.top); // 确保图例从至少 margin.top 或 minPadding 开始
        effectiveMarginTop = legendStartY + legendBlockHeight + paddingBelowLegendToChart;
    } else {
        effectiveMarginTop = Math.max(margin.top, minSvgGlobalTopPadding);
    }
    
    // 实际用于金字塔绘制的 chartHeight
    const chartHeight = height - effectiveMarginTop - margin.bottom;

    // 创建图表区域 (g)，使用新的 effectiveMarginTop
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${effectiveMarginTop})`);

    // ---------- 绘制图例 (如果存在) ----------
    if (legendBlockHeight > 0 && legendLines.length > 0) {
        const legendContainerGroup = svg.append("g") // 注意：图例容器直接附加到svg，其Y坐标由legendStartY决定
            .attr("class", "custom-legend-container")
            .attr("transform", `translate(0, ${legendStartY})`);

        let currentLineBaseY = 0; 
        const currentLegendInterItemSpacing = legendInterItemSpacing;

        legendLines.forEach((line) => {
            const lineRenderStartX = margin.left + (chartWidth - line.totalVisualWidth) / 2; // 水平居中于chartWidth区域
            const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
            let currentItemDrawX = lineRenderStartX;
            
            const legendColorRectWidth = 12; 
            const legendColorRectHeight = 12;
            const legendIconWidth = typography.label?.icon_size || 16;
            const legendIconHeight = typography.label?.icon_size || 16;
            const legendPaddingRectIcon = 4;
            const legendPaddingIconText = 4;
            const legendFontFamily = typography.label?.font_family || 'Arial';
            const legendFontSize = parseFloat(typography.label?.font_size || '12');
            const legendFontWeight = typography.label?.font_weight || 'normal';

            line.items.forEach((item, itemIndex) => {
                legendContainerGroup.append("rect")
                    .attr("x", currentItemDrawX)
                    .attr("y", currentLineBaseY + (legendItemMaxHeight - legendColorRectHeight) / 2)
                    .attr("width", legendColorRectWidth).attr("height", legendColorRectHeight)
                    .attr("rx", 3).attr("ry", 3) // 圆角矩形
                    .attr("fill", item.color).attr("fill-opacity", 0.85);
                currentItemDrawX += legendColorRectWidth;
                if (item.iconUrl) {
                    currentItemDrawX += legendPaddingRectIcon;
                    legendContainerGroup.append("image").attr("xlink:href", item.iconUrl)
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - legendIconHeight) / 2)
                        .attr("width", legendIconWidth).attr("height", legendIconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentItemDrawX += legendIconWidth + legendPaddingIconText;
                } else {
                    currentItemDrawX += legendPaddingRectIcon; 
                }
                legendContainerGroup.append("text").attr("x", currentItemDrawX).attr("y", lineCenterY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", legendFontFamily).style("font-size", `${legendFontSize}px`)
                    .style("font-weight", legendFontWeight).style("fill", colors.text_color || typography.label?.font_color || "#333333")
                    .text(item.text);
                currentItemDrawX += item.textWidth; 
                if (itemIndex < line.items.length - 1) {
                     currentItemDrawX += (line.items[itemIndex+1].visualWidth > 0 ? (currentLegendInterItemSpacing || 10) : 0) ;
                }
            });
            currentLineBaseY += legendItemMaxHeight + interLineVerticalPadding;
        });
    }

    // 计算金字塔的最大宽度（底部）和高度，使用调整后的 chartHeight
    const maxPyramidWidth = chartWidth * 0.6;
    const pyramidHeight = chartHeight * 0.8; // 使用 chartHeight 的80%，给上下留些空间
    
    // 计算面积比例
    // 金字塔总面积
    const totalArea = maxPyramidWidth * pyramidHeight / 2;
    
    // 计算每个部分的高度（基于面积比例）
    let currentHeight = 0;
    const sections = [];
    
    sortedData.forEach((d, i) => {
        // 该部分应占的面积比例
        const areaRatio = d.percent / 100;
        const sectionArea = totalArea * areaRatio;
        
        // 计算该部分的高度
        // 对于梯形，面积 = (上底+下底) * 高 / 2
        // 我们需要求解高度，已知面积和下底（上一部分的上底）
        
        // 首先计算该部分在整个三角形中的相对位置
        const bottomPosition = currentHeight / pyramidHeight;
        // 正三角形：底部宽，顶部窄
        const bottomWidth = maxPyramidWidth * bottomPosition;
        
        // 求解该部分的高度
        // 设高度为h，则上底 = maxPyramidWidth * (currentHeight + h) / pyramidHeight
        // 面积方程：sectionArea = (bottomWidth + topWidth) * h / 2
        
        // 简化后的二次方程：
        // h^2 * (maxPyramidWidth / (2 * pyramidHeight)) + h * bottomWidth - 2 * sectionArea = 0
        
        const a = maxPyramidWidth / (2 * pyramidHeight);
        const b = bottomWidth;
        const c = -2 * sectionArea;
        
        // 使用求根公式
        const h = (-b + Math.sqrt(b*b - 4*a*c)) / (2*a);
        
        // 计算该部分的上底宽度
        const topPosition = (currentHeight + h) / pyramidHeight;
        const topWidth = maxPyramidWidth * topPosition;
        
        sections.push({
            data: d,
            bottomY: currentHeight,
            topY: currentHeight + h,
            bottomWidth: bottomWidth,
            topWidth: topWidth
        });
        
        currentHeight += h;
    });
    
    // 计算垂直居中的偏移量
    const verticalOffset = (chartHeight - pyramidHeight) / 2;
    
    // 绘制金字塔的每一层
    sections.forEach((section, i) => {
        const d = section.data;
        
        // 获取颜色 (与图例逻辑中的 getColorForLegend 对应)
        const color = getColorForLegend(d[categoryField], i); // 使用 i (排序后的索引) 作为后备
        
        // 绘制梯形 - 添加垂直偏移
        const points = [
            [chartWidth / 2 - section.topWidth / 2, section.topY + verticalOffset],
            [chartWidth / 2 + section.topWidth / 2, section.topY + verticalOffset],
            [chartWidth / 2 + section.bottomWidth / 2, section.bottomY + verticalOffset],
            [chartWidth / 2 - section.bottomWidth / 2, section.bottomY + verticalOffset]
        ];
        
        g.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color);
        
        // 计算标签位置，避免重叠 - 添加垂直偏移
        const labelY = (section.topY + section.bottomY) / 2 + verticalOffset;
        const labelX = chartWidth / 2 + Math.max(section.topWidth, section.bottomWidth) / 2 + 10;
        
        // 修改标签为只显示百分比
        g.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .attr("font-size", typography.label?.font_size || "12px") // 使用label字号
            .attr("font-weight", typography.label?.font_weight || "normal")
            .attr("fill", colors.text_color || typography.label?.font_color || "#333333")
            .text(`${Math.round(d.percent)}%`);
    });
    
    return svg.node();
} 
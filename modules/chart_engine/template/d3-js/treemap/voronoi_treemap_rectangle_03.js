/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Voronoi Treemap(Rectangle)",
    "chart_name": "voronoi_treemap_rectangle_03",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 40], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "side",
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
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const initialMargin = { // 初始边距，图例将影响顶边距
        top: variables.margin?.top ?? 10, 
        right: variables.margin?.right ?? 10, 
        bottom: variables.margin?.bottom ?? 10, 
        left: variables.margin?.left ?? 10 
    };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // chartWidth is needed for legend wrapping calculation
    const chartWidth = width - initialMargin.left - initialMargin.right;
    
    // 准备数据 (This processedData and colorScale are used by the *correct* chart logic later)
    const processedData = chartData.map(d => ({
        name: d[categoryField],
        weight: d[valueField]
    }));
    
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        const localUniqueCategories = [...new Set(chartData.map(d => d[categoryField]))]; // Use local var to avoid conflict if uniqueCategories is defined globally for legend
        return d3.schemeTableau10[localUniqueCategories.indexOf(d) % 10];
    };

    // ---------- 新增图例 (uniqueCategories is defined here for legend) ----------
    const uniqueCategories = [...new Set(chartData.map(d => d[categoryField]))];

    // 辅助函数：使用 canvas 估算文本宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthHelper(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // ---------- 图例计算与布局 (在主图表布局之前) ----------
    let legendBlockHeight = 0;
    const legendLines = [];
    const paddingBelowLegendToChart = 15; 
    const minSvgGlobalTopPadding = 10; // SVG顶部到图例顶部的最小间距
    let legendItemMaxHeight = 0; // 将在下面计算
    let interLineVerticalPadding = parseFloat(typography.label?.line_spacing || '6'); // 图例行间距，移到外部并提供默认值
    let legendInterItemSpacing = 10; // 默认的图例项间距，移到外部

    if (uniqueCategories && uniqueCategories.length > 0 && images) { // 确保images已定义
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
        interLineVerticalPadding = parseFloat(typography.label?.line_spacing || '6');


        const legendItemsData = uniqueCategories.map(catName => {
            const text = String(catName);
            const color = colorScale(catName);
            const iconUrl = images.field && images.field[catName] ? images.field[catName] : null;
            const textWidth = getTextWidthHelper(text, legendFontFamily, legendFontSize, legendFontWeight);
            
            let itemVisualWidth = legendColorRectWidth;
            if (iconUrl) {
                itemVisualWidth += legendPaddingRectIcon + legendIconWidth + legendPaddingIconText;
            } else {
                itemVisualWidth += legendPaddingRectIcon; 
            }
            itemVisualWidth += textWidth;

            return { text, color, iconUrl, textWidth, visualWidth: itemVisualWidth };
        });

        let currentLineItems = [];
        let currentLineVisualWidth = 0;
        // 图例换行基于 chartWidth (主绘图区的宽度)
        const availableWidthForLegendWrapping = chartWidth; 

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

    // ---------- 根据图例调整边距和图表尺寸 ----------
    let effectiveMarginTop;
    let legendStartY = minSvgGlobalTopPadding; // 图例将从这里开始绘制Y坐标

    if (legendBlockHeight > 0) {
        // 图例存在，主图表内容在其下方
        effectiveMarginTop = legendStartY + legendBlockHeight + paddingBelowLegendToChart;
    } else {
        // 没有图例，使用初始上边距或最小上边距
        effectiveMarginTop = Math.max(initialMargin.top, minSvgGlobalTopPadding);
    }
    
    // 现在计算主绘图区域的 chartHeight
    const chartHeight = height - effectiveMarginTop - initialMargin.bottom;

    if (chartHeight <= 0) {
        console.warn("Voronoi Treemap: Chart height is not positive after accommodating legend and margins. SVG might be too short.");
        // You might want to stop execution or display an error if chartHeight is not positive
        // For example: 
        // d3.select(containerSelector).html("<p style='color:red;'>Error: Not enough height for the chart and legend.</p>");
        // return null; // Or svg.node() if you still want to return an empty SVG
    }
    
    // ---------- 绘制图例 (如果存在) ----------
    if (legendBlockHeight > 0 && legendLines.length > 0) {
        const legendContainerGroup = svg.append("g")
            .attr("class", "custom-legend-container")
            .attr("transform", `translate(0, ${legendStartY})`); // 图例容器的Y偏移

        let currentLineBaseY = 0; // Y坐标相对于 legendContainerGroup
        
        // 在图例绘制作用域内重新获取或确认常量值，以确保它们是可用的
        const currentLegendInterItemSpacing = legendInterItemSpacing; // 使用已在外部定义的 legendInterItemSpacing

        legendLines.forEach((line) => {
            // 每行在 chartWidth 内水平居中，因此X起始位置需要加上 initialMargin.left
            const lineRenderStartX = initialMargin.left + (chartWidth - line.totalVisualWidth) / 2;
            const lineCenterY = currentLineBaseY + legendItemMaxHeight / 2;
            let currentItemDrawX = lineRenderStartX;
            
            const legendColorRectWidth = 12; // 从外部作用域或重新定义
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
                    .attr("width", legendColorRectWidth)
                    .attr("height", legendColorRectHeight)
                    .attr("fill", item.color)
                    .attr("fill-opacity", 0.85);
                currentItemDrawX += legendColorRectWidth;

                if (item.iconUrl) {
                    currentItemDrawX += legendPaddingRectIcon;
                    legendContainerGroup.append("image")
                        .attr("xlink:href", item.iconUrl)
                        .attr("x", currentItemDrawX)
                        .attr("y", currentLineBaseY + (legendItemMaxHeight - legendIconHeight) / 2)
                        .attr("width", legendIconWidth)
                        .attr("height", legendIconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentItemDrawX += legendIconWidth;
                    currentItemDrawX += legendPaddingIconText;
                } else {
                    currentItemDrawX += legendPaddingRectIcon; 
                }
                
                legendContainerGroup.append("text")
                    .attr("x", currentItemDrawX)
                    .attr("y", lineCenterY)
                    .attr("dominant-baseline", "middle")
                    .style("font-family", legendFontFamily)
                    .style("font-size", `${legendFontSize}px`)
                    .style("font-weight", legendFontWeight)
                    .style("fill", colors.text_color || typography.label?.font_color || "#333333")
                    .text(item.text);
                
                currentItemDrawX += item.textWidth; 
                
                if (itemIndex < line.items.length - 1) {
                     currentItemDrawX += (line.items[itemIndex+1].visualWidth > 0 ? (currentLegendInterItemSpacing || 10) : 0) ; // 使用在当前作用域确认的 currentLegendInterItemSpacing
                }
            });
            currentLineBaseY += legendItemMaxHeight + interLineVerticalPadding;
        });
    }

    // ---------- 创建主图表绘图区域 (g) ----------
    const g = svg.append("g")
        .attr("transform", `translate(${initialMargin.left}, ${effectiveMarginTop})`);

    // 定义裁剪多边形（矩形）- 使用计算后的 chartWidth 和 chartHeight
    const clip = [
        [0, 0],
        [0, chartHeight],
        [chartWidth, chartHeight],
        [chartWidth, 0]
    ];
    
    // 创建 Voronoi Map 模拟
    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clip)
        .stop();
    
    // 运行模拟直到结束
    let state = simulation.state();
    while (!state.ended) {
        simulation.tick();
        state = simulation.state();
    }
    
    // 获取最终的多边形
    const polygons = state.polygons;
    
    // 绘制多边形
    const cells = g.selectAll("g")
        .data(polygons)
        .enter()
        .append("g");
    
    // 添加单元格
    cells.append("path")
        .attr("d", d => {
            // console.log(d.site.originalObject.data.originalData.name); // 保留此行以备调试
            return "M" + d.join("L") + "Z";
        })
        .attr("fill", d => colorScale(d.site.originalObject.data.originalData.name))
        .attr("fill-opacity", 0.8)
        .attr("stroke", "none");
    
    // 为每个单元格添加工具提示 (格式化函数)
    const format = d3.format(",d");
    
    // 修改值标签，使其成为单元格中唯一的主要文本
    cells.append("text")
        .attr("class", "value-label-cell")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1]) // 居中Y
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle") // 垂直居中
        .attr("fill",  "#ffffff") // 使用主题或默认白色
        .attr("font-size", typography.label?.font_size || "16px") // 字体稍大
        .attr("font-weight", typography.label?.font_weight || "bold") // 加粗
        .text(d => format(d.site.originalObject.data.originalData.weight))
        .each(function(d) {
            // 计算多边形的边界框
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            d.forEach(point => {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            });
            
            const boxWidth = maxX - minX;
            const boxHeight = maxY - minY;
            
            // 检查文本是否适合单元格
            const textWidth = this.getComputedTextLength();
            const textHeight = parseFloat(this.getAttribute("font-size")); // 获取字体大小

            if (textWidth > boxWidth * 0.9 || textHeight > boxHeight * 0.8) { // 检查宽度和高度
                // 如果文本太长或太高，隐藏它
                d3.select(this).style("display", "none");
            }
        });

    return svg.node();
} 
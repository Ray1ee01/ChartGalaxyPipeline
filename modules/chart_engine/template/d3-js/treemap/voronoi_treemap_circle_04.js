/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Voronoi Treemap(Circle)",
    "chart_name": "voronoi_treemap_circle_04",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[5, 40], [0, "inf"]],
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
    const initialMargin = { // 引入初始边距，图例将影响顶边距
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
    
    // chartWidth 用于图例换行计算，在图例逻辑之前定义
    const chartWidth = width - initialMargin.left - initialMargin.right;
    // chartHeight 和主图表区域的 g 将在图例计算后定义

    // 准备数据 (在图例和主图表逻辑都会用到)
    const processedData = chartData.map(d => ({
        name: d[categoryField],
        weight: d[valueField]
    }));
    
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        const localUniqueCategories = [...new Set(chartData.map(d => d[categoryField]))]; 
        return d3.schemeTableau10[localUniqueCategories.indexOf(d) % 10];
    };

    // ---------- 图例逻辑 (借鉴 rectangle_03) ----------
    const uniqueCategories = [...new Set(chartData.map(d => d[categoryField]))];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthHelper(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    let legendBlockHeight = 0;
    const legendLines = [];
    const paddingBelowLegendToChart = 15; 
    const minSvgGlobalTopPadding = 10; 
    let legendItemMaxHeight = 0; 
    let interLineVerticalPadding = parseFloat(typography.label?.line_spacing || '6'); 
    let legendInterItemSpacing = 10; 

    if (uniqueCategories && uniqueCategories.length > 0 && images) { 
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

    let effectiveMarginTop;
    let legendStartY = minSvgGlobalTopPadding;
    if (legendBlockHeight > 0) {
        effectiveMarginTop = legendStartY + legendBlockHeight + paddingBelowLegendToChart;
    } else {
        effectiveMarginTop = Math.max(initialMargin.top, minSvgGlobalTopPadding);
    }
    
    // 重新计算主图表区域的 chartHeight 和 centerY (用于圆形裁剪)
    const mainChartHeight = height - effectiveMarginTop - initialMargin.bottom; // Renamed to mainChartHeight to avoid conflict if chartHeight is used above for legend width context

    if (mainChartHeight <= 0) {
        console.warn("Voronoi Treemap (Circle): Chart height is not positive after accommodating legend and margins.");
        // return null; // Or handle error appropriately
    }

    // ---------- 绘制图例 (如果存在) ----------
    if (legendBlockHeight > 0 && legendLines.length > 0) {
        const legendContainerGroup = svg.append("g")
            .attr("class", "custom-legend-container")
            .attr("transform", `translate(0, ${legendStartY})`);
        let currentLineBaseY = 0; 
        const currentLegendInterItemSpacing = legendInterItemSpacing;

        legendLines.forEach((line) => {
            const lineRenderStartX = initialMargin.left + (chartWidth - line.totalVisualWidth) / 2;
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

    // ---------- 创建主图表绘图区域 (g) ----------
    const g = svg.append("g")
        .attr("transform", `translate(${initialMargin.left}, ${effectiveMarginTop})`);

    // 计算圆形裁剪区域 - 使用新的 mainChartHeight 和 chartWidth (for radius calculation if width constrained)
    // chartWidth for the main drawing area is the same as for legend (width - initialMargin.left - initialMargin.right)
    const mainChartContentWidth = chartWidth; 
    const radius = Math.min(mainChartContentWidth, mainChartHeight) / 2;
    const centerX = mainChartContentWidth / 2;
    const centerY = mainChartHeight / 2;
    
    // 创建圆形裁剪多边形 - 使用多边形近似圆形
    const numPoints = 50;
    const clip = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        clip.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }
    
    // 创建 Voronoi Map 模拟
    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clip)
        .stop();
    
    // 运行模拟直到结束 - 限制迭代次数以避免超时
    let state = simulation.state();
    let iterations = 0;
    const maxIterations = 300; // 限制最大迭代次数
    
    while (!state.ended && iterations < maxIterations) {
        simulation.tick();
        state = simulation.state();
        iterations++;
    }
    
    // 获取最终的多边形
    const polygons = state.polygons;
    
    // 绘制多边形
    const cells = g.selectAll("g.cell")
        .data(polygons)
        .enter()
        .append("g")
        .attr("class", "cell");
    
    // 添加单元格
    cells.append("path")
        .attr("d", d => {
            return "M" + d.join("L") + "Z";
        })
        .attr("fill", d => {
            try {
                return colorScale(d.site.originalObject.data.originalData.name);
            } catch (e) {
                console.error("Error accessing color data:", e);
                return "#ccc"; // 默认颜色
            }
        })
        .attr("fill-opacity", 0.8)
        .attr("stroke", "none")
    
    // 添加值标签 (调整为只显示数值，并适应单元格)
    const format = d3.format(",d");
    cells.append("text")
        .attr("class", "value-label-cell")
        .attr("x", d => {
            try { return d3.polygonCentroid(d)[0]; } catch (e) { console.error("Centroid error for value:", e); return 0; }
        })
        .attr("y", d => {
            try { return d3.polygonCentroid(d)[1]; } catch (e) { console.error("Centroid error for value:", e); return 0; }
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#ffffff")
        .attr("font-size", typography.value?.font_size || "12px") // 调整基础字体大小
        .attr("font-weight", typography.value?.font_weight || "normal")
        .text(d => {
            try { return format(d.site.originalObject.data.originalData.weight); } catch (e) { console.error("Weight data error:", e); return ""; }
        })
        .each(function(d) {
            try {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                d.forEach(point => {
                    minX = Math.min(minX, point[0]);
                    minY = Math.min(minY, point[1]);
                    maxX = Math.max(maxX, point[0]);
                    maxY = Math.max(maxY, point[1]);
                });
                const boxWidth = maxX - minX;
                const boxHeight = maxY - minY;
                const textWidth = this.getComputedTextLength();
                const currentFontSize = parseFloat(this.getAttribute("font-size"));

                // 如果文本太宽或太高，尝试缩小字体，最小到8px
                if ((textWidth > boxWidth * 0.9 || currentFontSize > boxHeight * 0.7) && currentFontSize > 8) {
                    this.setAttribute("font-size", Math.max(8, currentFontSize - 2) + "px");
                    // 递归调用以再次检查，或直接隐藏如果还是太大
                    const newTextWidth = this.getComputedTextLength();
                    const newFontSize = parseFloat(this.getAttribute("font-size"));
                    if (newTextWidth > boxWidth * 0.9 || newFontSize > boxHeight * 0.7) {
                         d3.select(this).style("display", "none");
                    }
                } else if (textWidth > boxWidth * 0.9 || currentFontSize > boxHeight * 0.7) {
                     d3.select(this).style("display", "none"); // 如果已经是8px还太大，则隐藏
                }
            } catch (e) {
                console.error("Error in value label sizing:", e);
                d3.select(this).style("display", "none"); // 出错则隐藏
            }
        });
    
    return svg.node();
} 
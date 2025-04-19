/*
REQUIREMENTS_BEGIN
{
    "chart_type": "scatter chart",
    "chart_name": "scatter_chart_01",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 散点图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据与配置 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];

    // 清空容器 & 创建文本测量上下文
    d3.select(containerSelector).html("");
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        context.font = `${fontWeight || 'normal'} ${fontSize || '12px'} ${fontFamily || 'Arial'}`;
        return context.measureText(text).width;
    }
    // // 如果之后需要更精确的BBox测量，可以使用临时SVG，但对于简单宽度，canvas更快。(保留解释)
    // let tempSvg;
    // function getTempSvg() {
    //     if (!tempSvg) {
    //         tempSvg = d3.select(document.body).append("svg") // 附加到body以确保测量可见性
    //             .attr("width", 0)
    //             .attr("height", 0)
    //             .style("position", "absolute")
    //             .style("visibility", "hidden");
    //     }
    //     return tempSvg;
    // }
    // function getTextBBox(text, fontFamily, fontSize, fontWeight) {
    //     const svg = getTempSvg();
    //     const tempText = svg.append("text")
    //         .style("font-family", fontFamily)
    //         .style("font-size", fontSize)
    //         .style("font-weight", fontWeight)
    //         .text(text);
    //     const bbox = tempText.node().getBBox();
    //     tempText.remove();
    //     return bbox;
    // }

    // ---------- 2. 尺寸与边距 ----------
    const width = variables.width || 600;
    const height = variables.height || 500;
    // 初始边距，后续动态调整
    let margin = { top: 100, right: 20, bottom: 70, left: 60 };

    // ---------- 3. 字段提取 ----------
    const dimensionField = dataColumns.find(col => col.role === "x").name; // Y轴类别字段
    const valueField = dataColumns.find(col => col.role === "y").name;     // X轴数值字段
    const groupField = dataColumns.find(col => col.role === "group").name;   // 分组字段

    // ---------- 4. 数据处理 ----------
    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))]; // Y轴唯一类别
    const groups = [...new Set(chartData.map(d => d[groupField]))];       // 唯一分组

    // ---------- 5. 动态计算边距与内部尺寸 ----------

    // --- 5a: 计算X轴需求 ---
    const maxValue = d3.max(chartData, d => +d[valueField]) || 0;
    const tempXScale = d3.scaleLinear().domain([0, maxValue]).nice(); // 用于计算刻度的临时比例尺
    const xAxisTicks = tempXScale.ticks(5);
    const xAxisTickFormat = tempXScale.tickFormat(5);

    // 计算X轴标签所需高度 -> 更新下边距
    let maxXAxisLabelHeight = 0;
    if (xAxisTicks.length > 0) {
        const labelFontSize = typography.label.font_size || '12px';
        maxXAxisLabelHeight = parseFloat(labelFontSize) * 1.2; // 基于字体大小估算
    }
    const xAxisPadding = 15;
    margin.bottom = Math.max(margin.bottom, maxXAxisLabelHeight + xAxisPadding);

    // 计算X轴标签最大宽度 -> 更新右边距
    let maxXAxisLabelWidth = 0;
    if (xAxisTicks.length > 0) {
        const fontFamily = typography.label.font_family || 'Arial';
        const fontSize = typography.label.font_size || '12px';
        const fontWeight = typography.label.font_weight || 'normal';
        xAxisTicks.forEach(tick => {
            const tickText = xAxisTickFormat(tick);
            const textWidth = getTextWidthCanvas(tickText, fontFamily, fontSize, fontWeight); // 使用canvas测量提高性能
            maxXAxisLabelWidth = Math.max(maxXAxisLabelWidth, textWidth);
        });
    }
    // 调整右边距防止标签溢出
    margin.right = Math.max(margin.right, (maxXAxisLabelWidth / 2) + 10);


    // --- 5b: 估算Y轴需求 -> 更新左边距 ---
    const iconPadding = 5;
    let maxYAxisLabelWidth = 0;

    // 估算图标尺寸 (基于预估的条带宽度)
    let preliminaryInnerHeight = height - margin.top - margin.bottom;
    let preliminaryYScale = d3.scaleBand().domain(dimensions).range([0, preliminaryInnerHeight]).padding(0.1);
    let estIconHeight = preliminaryYScale.bandwidth() > 0 ? preliminaryYScale.bandwidth() * 0.6 : 20;
    let estIconWidth = estIconHeight * 1.33; // 假设4:3宽高比

    // 计算Y轴标签+图标所需宽度
    dimensions.forEach(dim => {
        const labelWidth = getTextWidthCanvas(dim, typography.label.font_family, typography.label.font_size, typography.label.font_weight);
        const hasIcon = images.field && images.field[dim];
        const requiredWidth = (hasIcon ? estIconWidth + iconPadding : 0) + labelWidth;
        maxYAxisLabelWidth = Math.max(maxYAxisLabelWidth, requiredWidth);
    });

    const yAxisPadding = 20;
    margin.left = Math.max(margin.left, maxYAxisLabelWidth + yAxisPadding);

    // --- 5c: 最终确定内部尺寸 ---
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // // 如果创建了临时SVG，则将其移除 (如果getTextBBox未被使用，则可以移除)
    // if (tempSvg) {
    //     tempSvg.remove();
    //     tempSvg = null;
    // }

    // ---------- 6. 比例尺 ----------
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.1); // Y轴类别比例尺

    const xScale = d3.scaleLinear()
        .domain(tempXScale.domain()) // 复用优化后的域
        .range([0, innerWidth]); // X轴数值比例尺

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => colors.field[group] || d3.schemeCategory10[i % 10])); // 分组颜色比例尺

    // 点的半径，基于Y轴条带高度，有上下限
    const pointRadius = Math.max(3, Math.min(yScale.bandwidth() * 0.25, 10));

    // ---------- 7. SVG 容器与主分组 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`) // 实现响应式缩放
        .attr("style", `max-width: 100%; height: auto; background-color: ${jsonData.colors?.background_color || 'transparent'};`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink"); // 用于xlink:href

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`); // 主绘图区

    // ---------- 8. 绘制坐标轴与网格线 ----------

    // X轴 (仅标签)
    const xAxis = d3.axisBottom(xScale)
        .ticks(5, xAxisTickFormat)
        .tickSizeOuter(0);

    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis)
        .call(g => g.select(".domain").remove()) // 移除轴线
        .call(g => g.selectAll(".tick line").remove()) // 移除刻度线
        .call(g => g.selectAll(".tick text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("fill", colors.text_color || "#333"));

    // --- 绘制垂直网格线 (手动) ---
    const gridPadding = 5; // 网格线上下延伸距离
    const yTopGrid = dimensions.length > 0 ? yScale(dimensions[0]) + yScale.bandwidth() / 2 : 0; // 最上方水平网格线Y
    const yBottomGrid = dimensions.length > 0 ? yScale(dimensions[dimensions.length - 1]) + yScale.bandwidth() / 2 : innerHeight; // 最下方水平网格线Y

    const xTickValues = xScale.ticks(5); // 获取刻度值

    g.append("g")
        .attr("class", "grid vertical-grid")
        .selectAll("line")
        .data(xTickValues)
        .enter()
        .append("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", yTopGrid - gridPadding) // 起点Y
        .attr("y2", yBottomGrid + gridPadding) // 终点Y
        .attr("stroke", "#aaaaaa")
        .attr("stroke-opacity", 0.7);


    // 水平网格线 (每个Y类别条带中心)
    g.append("g")
        .attr("class", "grid horizontal-grid")
        .selectAll("line")
        .data(dimensions)
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2) // Y坐标在条带中心
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", "#aaaaaa")
        .attr("stroke-opacity", 0.7);

    // ---------- 9. 绘制Y轴标签与图标 ----------
    const yAxisGroup = g.append("g").attr("class", "y-axis-labels");

    dimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2; // 类别条带中心Y
        const iconHeight = yScale.bandwidth() * 0.6;
        const iconWidth = iconHeight * 1.33;
        const hasIcon = images.field && images.field[dim];
        const labelX = hasIcon ? -(iconWidth + iconPadding + 5) : -5; // 标签X位置 (考虑图标)

        if (hasIcon) {
            yAxisGroup.append("image")
                .attr("xlink:href", images.field[dim])
                .attr("x", -(iconWidth + 5))
                .attr("y", yPos - iconHeight / 2) // 垂直居中
                .attr("width", iconWidth)
                .attr("height", iconHeight);
        }

        yAxisGroup.append("text")
            .attr("x", labelX)
            .attr("y", yPos)
            .attr("dy", "0.35em") // 垂直微调居中
            .attr("text-anchor", "end") // 右对齐
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color || "#333")
            .text(dim);
    });

    // ---------- 10. 绘制数据点 ----------
    g.append("g")
        .attr("class", "scatter-points")
        .selectAll("circle")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(+d[valueField]))
        .attr("cy", d => yScale(d[dimensionField]) + yScale.bandwidth() / 2) // Y坐标在条带中心
        .attr("r", pointRadius)
        .attr("fill", d => colorScale(d[groupField]));

    // ---------- 11. 绘制图例 ----------
    const initialLegendFontSize = parseFloat(typography.label?.font_size || 12);
    const legendFontWeight = typography.label?.font_weight || "normal";
    const legendFontFamily = typography.label?.font_family || "Arial";
    const legendColor = colors.text_color || "#333333";
    const legendItemPadding = 5; // 标记与文本间距
    const legendColumnPadding = 15; // 图例项间距

    if (groups.length > 0) {
        let totalLegendWidth = 0;
        // 计算图例总宽度 (未缩放)
        groups.forEach((cg) => {
            const textWidth = getTextWidthCanvas(cg, legendFontFamily, initialLegendFontSize, legendFontWeight);
            totalLegendWidth += (pointRadius * 2) + legendItemPadding + textWidth + legendColumnPadding;
        });
        totalLegendWidth -= legendColumnPadding;

        let legendScaleFactor = 1;
        // 如果图例过宽，则计算缩放因子
        if (totalLegendWidth > innerWidth) {
            legendScaleFactor = (innerWidth / totalLegendWidth) * 0.95; // 留少量缓冲
        }
        // 计算最终图例元素尺寸 (应用缩放，有最小值)
        const finalLegendFontSize = Math.max(6, initialLegendFontSize * legendScaleFactor);
        const finalLegendMarkRadius = Math.max(3, pointRadius * legendScaleFactor);

        // 重新计算最终图例宽度
        let finalLegendWidth = 0;
        groups.forEach((cg) => {
            const textWidth = getTextWidthCanvas(cg, legendFontFamily, finalLegendFontSize, legendFontWeight);
            finalLegendWidth += (finalLegendMarkRadius * 2) + legendItemPadding + textWidth + legendColumnPadding;
        });
        finalLegendWidth -= legendColumnPadding;

        // 定位图例 (顶部居中)
        const legendStartX = margin.left + (innerWidth - finalLegendWidth) / 2;
        const legendY = margin.top / 5*4;

        // 创建图例分组 (附加到SVG根，避免受主分组'g'影响)
        const legendGroup = svg.append("g")
            .attr("class", "chart-legend")
            .attr("transform", `translate(${legendStartX}, ${legendY})`);

        let currentLegendX = 0;
        groups.forEach((cg) => {
            const color = colorScale(cg);
            const textWidth = getTextWidthCanvas(cg, legendFontFamily, finalLegendFontSize, legendFontWeight);
            const itemWidth = (finalLegendMarkRadius * 2) + legendItemPadding + textWidth;

            const legendItem = legendGroup.append("g")
                .attr("transform", `translate(${currentLegendX}, 0)`);

            // 图例标记 (圆)
            legendItem.append("circle")
                .attr("cx", finalLegendMarkRadius)
                .attr("cy", 0)
                .attr("r", finalLegendMarkRadius)
                .attr("fill", color);

            // 图例文本
            legendItem.append("text")
                .attr("x", (finalLegendMarkRadius * 2) + legendItemPadding)
                .attr("y", 0)
                .attr("dominant-baseline", "middle") // 垂直居中
                .attr("text-anchor", "start")
                .style("font-family", legendFontFamily)
                .style("font-size", `${finalLegendFontSize}px`)
                .style("font-weight", legendFontWeight)
                .style("fill", legendColor)
                .text(cg);

            currentLegendX += itemWidth + legendColumnPadding;
        });
    }

    // ---------- 12. 返回 SVG 节点 ----------
    return svg.node();
}
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Donut Chart",
    "chart_name": "donut_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
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

// 饼图带左侧详细图例 - 使用D3.js (v3 - 优化图例布局)
function makeChart(containerSelector, dataJSON) {
    // ---------- 1. 数据准备阶段 ----------
    const chartData = dataJSON.data.data;
    const variables = dataJSON.variables || {};
    const typography = dataJSON.typography || {      // 字体设置
        // 统一使用 label 字体设置图例中的所有文本
        label: { font_family: "Arial", font_size: "13px", font_weight: "normal" }
        // annotation 不再直接用于图例
    };
    const colors = dataJSON.colors || { text_color: "#333333", field: {} };  // 颜色设置
    const images = dataJSON.images || { field: {} };   // 图像（图标）设置
    const dataColumns = dataJSON.data.columns || []; // 数据列定义

    // 清空容器
    d3.select(containerSelector).html("");

    if (!chartData || chartData.length === 0) {
        d3.select(containerSelector).text("无有效数据");
        return;
    }

    // ---------- 3. 提取字段名和单位 ----------
    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;

    if (!xField || !yField) {
        d3.select(containerSelector).text("缺少 x 或 y 字段定义");
        return;
    }

    let valueUnit = ""; // yField 的单位
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit || "";
    }

    // ---------- 4. 数据处理与验证 ----------
    const validData = chartData.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && parseFloat(d[yField]) >= 0);
    const totalY = d3.sum(validData, d => +d[yField]);

    if (validData.length === 0 || totalY <= 0) {
        d3.select(containerSelector).html("");
        d3.select(containerSelector).text(totalY <= 0 && validData.length > 0 ? "数值总和必须大于 0" : "无有效数据或数值均为0");
        return;
    }

    // 按原始数值降序排序
    const processedData = validData.sort((a, b) => +b[yField] - +a[yField]);

    // ---------- 2. 尺寸和SVG设置 ----------
    const totalWidth = variables.width || 800;
    const totalHeight = variables.height || 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 }; // 调整为更通用的外边距

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", totalHeight)
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // ---------- 5. 图例布局精细计算 ----------

    // 5.1 定义常量和获取字体信息
    const legendMarkerRadius = 6; 
    const idealIconSizeRatio = 1.1; // 图标尺寸相对于字体大小的理想比例
    const minIconSize = 10;         // 图标最小尺寸
    const legendLabelFontSize = parseFloat(typography.label.font_size || '13');
    const legendLabelFontFamily = typography.label.font_family || 'Arial';
    const legendLabelFontWeight = typography.label.font_weight || 'normal';
    const legendTextColor = colors.text_color || "#333333";
    const padding1 = 10;           // 标记和图标间距
    const padding2 = 10;           // 图标和数值间距
    const padding3 = 10;           // 数值和标签间距
    const verticalPaddingRatio = 0.4; // 上下总留白占字体高度的比例

    // 5.2 计算理想和最小行高/图标尺寸
    const idealIconSize = Math.max(minIconSize, legendLabelFontSize * idealIconSizeRatio);
    const idealItemHeight = Math.max(legendLabelFontSize, idealIconSize) * (1 + verticalPaddingRatio); 
    const absoluteMinItemHeight = Math.max(16, legendLabelFontSize + 4, minIconSize + 4); // 绝对最小行高，保证基本可读

    // 5.3 测量文本宽度 (使用统一的Label字体)
    const tempSvg = svg.append("g").attr("opacity", 0); // 临时测量组
    let maxValueWidth = 0;
    let maxLabelWidth = 0;
    processedData.forEach(d => {
        const valueText = `${d[yField]}${valueUnit}`;
        const tempValueText = tempSvg.append("text")
            .style("font-family", legendLabelFontFamily)
            .style("font-size", legendLabelFontSize + "px")
            .style("font-weight", legendLabelFontWeight) // 数值也用Label weight
            .text(valueText);
        maxValueWidth = Math.max(maxValueWidth, tempValueText.node().getBBox().width);

        const labelText = d[xField];
        const tempLabelText = tempSvg.append("text")
            .style("font-family", legendLabelFontFamily)
            .style("font-size", legendLabelFontSize + "px")
            .style("font-weight", legendLabelFontWeight)
            .text(labelText);
        maxLabelWidth = Math.max(maxLabelWidth, tempLabelText.node().getBBox().width);
    });
    tempSvg.remove();

    // 5.4 计算最终行高和图标尺寸 (核心逻辑 - 调整版)
    const legendAvailableHeight = totalHeight - margin.top - margin.bottom;
    const maxHeightPerItem = legendAvailableHeight / processedData.length; // 每个item最大可用高度

    // 限制 idealItemHeight 不能超过 maxHeightPerItem，且不小于 absoluteMinItemHeight
    let finalLegendItemHeight = Math.max(absoluteMinItemHeight, Math.min(idealItemHeight, maxHeightPerItem));

    // 基于最终行高重新计算图标尺寸 (保证图标不超过行高太多，且不小于最小值)
    // 如果 finalLegendItemHeight 被压缩，相应缩小图标，否则使用 idealIconSize
    if (finalLegendItemHeight < idealItemHeight) {
        finalIconSize = Math.max(minIconSize, finalLegendItemHeight * (idealIconSize / idealItemHeight));
    } else {
        finalIconSize = idealIconSize; // 空间充足，使用理想图标尺寸
        // 如果空间充足且 idealItemHeight 小于 maxHeightPerItem，则 finalLegendItemHeight 使用 idealItemHeight
        finalLegendItemHeight = idealItemHeight;
    }

    // 5.5 计算图例总实际高度和起始 Y 坐标
    const totalActualLegendHeight = finalLegendItemHeight * processedData.length;
    // 垂直居中显示图例块，确保不超出顶部边界
    let legendStartY = margin.top + (legendAvailableHeight - totalActualLegendHeight) / 5;

    // 5.6 计算图例总宽度和饼图区域
    const finalLegendItemWidth = (legendMarkerRadius * 2) + padding1 + finalIconSize + padding2 + maxValueWidth + padding3 + maxLabelWidth;
    const legendAreaWidth = margin.left + finalLegendItemWidth + padding3; // 右侧也加点边距

    const pieAreaMargin = { top: 20, right: 20, bottom: 20, left: 30 }; // 饼图与图例/边缘间距
    const pieAreaWidth = totalWidth - legendAreaWidth - pieAreaMargin.left - margin.right; // 修正：减去外层右边距
    const pieAreaHeight = totalHeight - margin.top - margin.bottom - pieAreaMargin.top - pieAreaMargin.bottom;

    if (pieAreaWidth <= 0 || pieAreaHeight <= 0) {
        svg.remove(); // 移除已创建的SVG
        d3.select(containerSelector).text("空间不足以绘制图表，请增加宽度或高度。");
        return;
    }

    const pieRadius = Math.min(pieAreaWidth, pieAreaHeight) / 2;
    const innerRadiusRatio = 0.6; 
    const pieCenterX = legendAreaWidth + pieAreaMargin.left + pieRadius;
    const pieCenterY = margin.top + pieAreaMargin.top + pieAreaHeight / 2;

    // ---------- 6. 颜色比例尺 ----------
    const colorDomain = processedData.map(d => d[xField]);
    const colorRange = colorDomain.map(field => colors.field[field] || "#cccccc");
    const colorScale = d3.scaleOrdinal()
        .domain(colorDomain)
        .range(colorRange.length > 0 ? colorRange : d3.schemeTableau10);

    // ---------- 7. 绘制图例 ----------
    const legendGroup = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${margin.left}, ${legendStartY})`); // 使用计算好的起始Y

    processedData.forEach((d, i) => {
        const itemY = i * finalLegendItemHeight; 
        const itemCenterY = itemY + finalLegendItemHeight / 2; // 行内垂直中心

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(0, ${itemY})`);

        // 1. 颜色标记
        legendItem.append("circle")
            .attr("cx", legendMarkerRadius)
            .attr("cy", itemCenterY)
            .attr("r", legendMarkerRadius)
            .attr("fill", colorScale(d[xField]));

        // 2. 图标 (使用最终动态尺寸)
        const iconX = (legendMarkerRadius * 2) + padding1;
        if (images.field && images.field[d[xField]]) {
            legendItem.append("image")
                .attr("x", iconX)
                .attr("y", itemCenterY - finalIconSize / 2) // 基于最终图标尺寸居中
                .attr("width", finalIconSize)
                .attr("height", finalIconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[d[xField]]);
        }

        // 3. 数值标签 (右对齐, 统一字体)
        const valueX = iconX + finalIconSize + padding2 + maxValueWidth;
        legendItem.append("text")
            .attr("x", valueX)
            .attr("y", itemCenterY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle") // 垂直居中
            .style("font-family", legendLabelFontFamily)
            .style("font-size", legendLabelFontSize + "px")
            .style("font-weight", legendLabelFontWeight)
            .style("fill", legendTextColor)
            .text(`${d[yField]}${valueUnit}`);

        // 4. 维度标签 (左对齐, 统一字体)
        const labelX = valueX + padding3;
        legendItem.append("text")
            .attr("x", labelX)
            .attr("y", itemCenterY)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle") // 垂直居中
            .style("font-family", legendLabelFontFamily)
            .style("font-size", legendLabelFontSize + "px")
            .style("font-weight", legendLabelFontWeight)
            .style("fill", legendTextColor)
            .text(d[xField]);
    });

    // ---------- 8. 绘制饼图 ----------
    const pieGroup = svg.append("g")
        .attr("class", "pie-chart")
        .attr("transform", `translate(${pieCenterX}, ${pieCenterY})`);

    const pie = d3.pie()
        .value(d => +d[yField]) 
        .sort(null) 
        .padAngle(0);

    const arc = d3.arc()
        .innerRadius(pieRadius * innerRadiusRatio) 
        .outerRadius(pieRadius)
        .cornerRadius(0);

    pieGroup.selectAll("path")
        .data(pie(processedData))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => colorScale(d.data[xField])) 
        .style("stroke", "none") 
        .style("stroke-width", 0) 
        .style("filter", "none") 
        .on("mouseover", function(event, d) {
            d3.select(this)
              .transition().duration(150)
              .attr("transform", `scale(1.03)`);
        })
        .on("mouseout", function(event, d) {
            d3.select(this)
              .transition().duration(150)
              .attr("transform", `scale(1.0)`);
        });

    // ---------- 9. 返回SVG节点 ----------
    return svg.node();
}
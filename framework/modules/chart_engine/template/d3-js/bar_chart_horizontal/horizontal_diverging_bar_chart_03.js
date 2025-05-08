/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Diverging Bar Chart",
    "chart_name": "horizontal_diverging_bar_chart_03",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], ["-inf", "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary","secondary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 双向水平条形图实现 (中心标签盒子样式) - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------

    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {      // 字体默认设置
        title: { font_family: "Arial", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" }, // 中心标签字体
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" } // 数值标签字体
    };
    const colors = jsonData.colors || {              // 颜色默认设置
        text_color: "#FFFFFF",                       // 中心标签文本颜色
        other: {
            primary: "#FFD966",                      // 正值颜色
            secondary: "#F4754C"                     // 负值颜色
        }
    };
    const images = jsonData.images || { field: {}, other: {} }; // 图像设置 (当前未使用)
    const dataColumns = jsonData.data.columns || [];

    // 视觉效果设置 (使用默认值或传入的值)
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : true;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true;

    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }

    // 清空容器，防止重复渲染
    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------

    const width = variables.width || 600; // 图表总宽度
    const height = variables.height || 600; // 图表总高度

    // ---------- 3. 提取字段名和单位 ----------

    let dimensionField = ""; // 维度字段 (类别轴, X)
    let valueField = "";     // 度量字段 (数值轴, Y)
    let valueFieldName = ""; // 度量字段的显示名称
    let dimensionFieldName = ""; // 维度字段的显示名称

    // 从 dataColumns 获取字段角色和名称
    for (let i = 0; i < dataColumns.length; i++) {
        if (dataColumns[i].role === "x") {
            dimensionField = dataColumns[i].name;
            dimensionFieldName = dataColumns[i].name || dimensionField;
        } else if (dataColumns[i].role === "y") {
            valueField = dataColumns[i].name;
        }
    }

    let valueUnit = ""; // 度量值的单位 (例如 '%')
    const valueCol = dataColumns.find(col => col.role === "y");
    if (valueCol) {
        valueFieldName = valueCol.name || valueField; // 优先使用列配置中的名称
        if (valueCol.unit && valueCol.unit !== "none") {
            valueUnit = valueCol.unit;
        }
    }

    // ---------- 4. 数据处理 ----------

    const dimensions = chartData.map(d => d[dimensionField]); // 获取所有维度值

    // ---------- 5. 创建临时SVG测量文本宽度 ----------
    // (用于精确计算布局，避免标签重叠或溢出)

    const tempSvg = d3.select("body").append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden")
        .style("position", "absolute");

    // 测量最长的数值标签宽度
    let maxValueLabelWidth = 0;
    const tempValueTextElement = tempSvg.append("text")
        .style("font-family", typography.annotation.font_family)
        .style("font-size", typography.annotation.font_size)
        .style("font-weight", "bold");

    chartData.forEach(d => {
        const value = d[valueField];
        const formattedValue = (value >= 0 ? "+" : "") + formatValue(value) + valueUnit;
        tempValueTextElement.text(formattedValue);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, tempValueTextElement.node().getComputedTextLength());
    });

    // 测量最长的中心维度标签宽度
    let maxCenterLabelWidth = 0;
    const tempLabelTextElement = tempSvg.append("text")
         .style("font-family", typography.label.font_family)
         .style("font-size", typography.label.font_size)
         .style("font-weight", typography.label.font_weight); // 使用标签字体样式

     chartData.forEach(d => {
         tempLabelTextElement.text(d[dimensionField]);
         let currentWidth = tempLabelTextElement.node().getComputedTextLength();
         maxCenterLabelWidth = Math.max(maxCenterLabelWidth, currentWidth);
     });

    tempSvg.remove(); // 移除临时SVG

    // ---------- 6. 计算内部绘图区域尺寸和布局 ----------

    const centerBoxInternalPadding = 15; // 中心列内部左右填充
    const valuePadding = 8;          // 数值标签与条形末端的间距
    const axisNameLabelHeight = 20;  // 顶部轴名称标签的高度
    const axisTickSpace = 20;        // 轴刻度线和刻度标签的间距
    const directionLabelSpace = 20;  // 方向指示标签 ("<- Return") 的空间

    // 计算中心列的宽度
    const centerBoxWidth = maxCenterLabelWidth + 2 * centerBoxInternalPadding;

    // 计算最大绝对值，用于确定对称的X轴范围
    const maxNegativeValue = d3.min(chartData, d => d[valueField] < 0 ? d[valueField] : 0) || 0;
    const maxPositiveValue = d3.max(chartData, d => d[valueField] > 0 ? d[valueField] : 0) || 0;
    const maxAbsValue = Math.max(Math.abs(maxNegativeValue), Math.abs(maxPositiveValue)) * 1.05; // 添加5%缓冲

    // 定义边距 (考虑了数值标签、刻度标签、轴名称等空间)
    const margin = {
        top: axisNameLabelHeight + directionLabelSpace + axisTickSpace + 60, // 顶部空间总和
        right: 30, // 右侧需容纳最宽的数值标签和填充
        bottom: 60,
        left: 30  // 左侧需容纳最宽的数值标签和填充
    };

    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 检查内部宽度是否足够容纳中心列
    if (innerWidth < centerBoxWidth) {
        console.warn("图表宽度不足以容纳中心标签列。");
    }

    // 计算中心列的左右X坐标
    const centerBoxLeft = (innerWidth - centerBoxWidth) / 2;
    const centerBoxRight = centerBoxLeft + centerBoxWidth;

    // 计算每侧可用于绘制条形的宽度
    const availableWidthPerSide = (innerWidth - centerBoxWidth) / 2;
    if (availableWidthPerSide <= 0) {
         console.warn("中心标签列过宽，没有空间绘制条形图。");
    }

    // 计算方向指示标签的中心点
    const midPointLeft = centerBoxLeft / 2;
    const midPointRight = centerBoxRight + availableWidthPerSide / 2;

    // Y轴比例尺 (序数比例尺，用于放置条形和标签段)
    const yScale = d3.scaleBand()
        .domain(dimensions)       // 定义域为维度值
        .range([0, innerHeight]) // 值域为内部绘图高度
        .padding(0);              // 段之间无间距

    // 在定义Y轴比例尺后，计算每个标签行的高度
    const barHeight = yScale.bandwidth();

    // X轴比例尺 (线性比例尺，用于度量值)
    // 将 [0, maxAbsValue] 映射到 [0, availableWidthPerSide]
    const magnitudeScale = d3.scaleLinear()
        .domain([0, maxAbsValue])           // 定义域为0到最大绝对值
        .range([0, availableWidthPerSide]) // 值域为单侧可用宽度
        .nice();                             // 优化刻度，使其更易读

    // 获取优化后的最大绝对值域，用于刻度计算
    const niceMaxAbsValue = magnitudeScale.domain()[1];

    // ---------- 7. 创建SVG容器 ----------

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", `max-width: 100%; height: auto;`) // 可以设置背景色
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // ---------- 7a. 添加效果定义 <defs> ----------
    const defs = svg.append("defs");

    // 添加阴影滤镜 (如果启用 has_shadow)
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
        feMerge.append("feMergeNode"); // 阴影层
        feMerge.append("feMergeNode").attr("in", "SourceGraphic"); // 原始图形层
    }

    // 添加渐变 (如果启用 has_gradient)
    if (variables.has_gradient) {
        const positiveBaseColor = colors.other.primary || "#FFD966";
        const negativeBaseColor = colors.other.secondary || "#F4754C";

        // 正值渐变 (左亮右暗)
        const positiveGradient = defs.append("linearGradient")
            .attr("id", "positive-gradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
        positiveGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(positiveBaseColor).brighter(0.5));
        positiveGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(positiveBaseColor).darker(0.3));

        // 负值渐变 (右亮左暗)
        const negativeGradient = defs.append("linearGradient")
             .attr("id", "negative-gradient")
             .attr("x1", "100%").attr("y1", "0%").attr("x2", "0%").attr("y2", "0%");
        negativeGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(negativeBaseColor).brighter(0.5));
        negativeGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", d3.rgb(negativeBaseColor).darker(0.3));
    }

    // ---------- 8. 获取颜色配置 ----------

    const positiveColor = variables.has_gradient ? "url(#positive-gradient)" : (colors.other.primary || "#FFD966");
    const negativeColor = variables.has_gradient ? "url(#negative-gradient)" : (colors.other.secondary || "#F4754C");
    const strokeColor = variables.has_stroke ? (colors.stroke_color || "#FFFFFF") : "none"; // 描边颜色
    const centerTextColor = colors.text_color || "#FFFFFF"; // 中心标签文字颜色
    

    // ---------- 9. 创建主绘图组 (g元素) ----------
    // 将所有图形元素添加到这个组中，方便统一应用边距变换
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // ---------- 10. 添加中心列、轴名称标签和坐标轴元素 ----------

    // 绘制顶部维度轴名称标签的容器 (圆角矩形)
    const axisNameRectHeight = barHeight; // 高度与数据标签行一致
    const axisNameRectY = -axisNameRectHeight; // Y坐标使其底部与中心列顶部对齐
    const axisNameRectX = centerBoxLeft;       // X坐标与中心列左侧对齐
    const axisNameRectWidth = centerBoxWidth;    // 宽度与中心列一致
    const axisNameRectRadius = axisNameRectHeight ; // 圆角半径调整为高度的一半

    g.append("path")
        // 路径数据：从左下角 -> 左上角圆弧起点 -> 上边线 -> 右上角圆弧终点 -> 右下角 -> 闭合
        .attr("d", `M ${axisNameRectX},0 ` + // M = Move to (左下角, y=0)
                    `L ${axisNameRectX},${axisNameRectY + axisNameRectRadius} ` + // L = Line to (左上角圆弧起点)
                    `a ${axisNameRectRadius},${axisNameRectRadius} 0 0 1 ${axisNameRectRadius},-${axisNameRectRadius} ` + // a = arc (左上角圆弧)
                    `h ${axisNameRectWidth - 2 * axisNameRectRadius} ` + // h = horizontal line (上边线)
                    `a ${axisNameRectRadius},${axisNameRectRadius} 0 0 1 ${axisNameRectRadius},${axisNameRectRadius} ` + // a = arc (右上角圆弧)
                    `L ${axisNameRectX + axisNameRectWidth},0 ` + // L = Line to (右下角, y=0)
                    `Z`) // Z = Close path (自动绘制底边线)
        .attr("fill", "none") // 设置为透明
        .attr("stroke", "#CCCCCC") // 浅灰色描边
        .attr("stroke-width", 0.5); // 统一宽度

    // 添加维度轴名称文本
    g.append("text")
        .attr("x", axisNameRectX + centerBoxWidth / 2) // 水平居中
        .attr("y", axisNameRectY + axisNameRectHeight / 2) // 垂直居中
        .attr("dy", "0.35em") // 文本垂直对齐微调
        .attr("text-anchor", "middle") // 文本水平对齐方式
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", centerTextColor)
        .text(dimensionFieldName); // 显示维度名称

    // 绘制中心列的背景矩形
    g.append("rect")
        .attr("x", centerBoxLeft)
        .attr("y", 0) // 从顶部开始 (Y=0)
        .attr("fill", "none") // 设置为透明
        .attr("width", centerBoxWidth)
        .attr("height", innerHeight);

    // 绘制中心列内部的水平分隔线
    dimensions.forEach((dim, i) => {
        if (i > 0) { // 跳过最顶部 (因为轴名称标签容器已形成顶部边界)
            const yLinePos = yScale(dim);
            g.append("line")
                .attr("x1", centerBoxLeft)
                .attr("y1", yLinePos)
                .attr("x2", centerBoxRight)
                .attr("y2", yLinePos)
                .attr("stroke", "#CCCCCC") // 浅灰色描边
                .attr("stroke-width", 0.5); // 统一宽度
        }
    });

    // 添加最底部的水平线
    g.append("line")
        .attr("x1", centerBoxLeft)
        .attr("y1", innerHeight)
        .attr("x2", centerBoxRight)
        .attr("y2", innerHeight)
        .attr("stroke", "#CCCCCC") // 浅灰色描边
        .attr("stroke-width", 0.5); // 统一宽度

    // 绘制中心列的垂直左右边框线
    g.append("line") // 左边线
        .attr("x1", centerBoxLeft)
        .attr("y1", 0)
        .attr("x2", centerBoxLeft)
        .attr("y2", innerHeight)
        .attr("stroke", "#CCCCCC") // 浅灰色描边
        .attr("stroke-width", 0.5) // 统一宽度
        .style("opacity", 0.5);
    g.append("line") // 右边线
        .attr("x1", centerBoxRight)
        .attr("y1", 0)
        .attr("x2", centerBoxRight)
        .attr("y2", innerHeight)
        .attr("stroke", "#CCCCCC") // 浅灰色描边
        .attr("stroke-width", 0.5) // 统一宽度
        .style("opacity", 0.5);

    // 添加顶部左右方向指示标签 (例如 "<- Return", "Return ->")
    const directionLabelY = -(axisTickSpace + directionLabelSpace); // 定位在刻度线上方 - 已修改，进一步向上移动
    const directionLabelFontSize = typography.label.font_size;

    // 调整标签大小以适应可用空间的函数
    function adjustLabel(textElement, availableSpace) {
        let currentFontSize = parseInt(directionLabelFontSize);
        textElement.style("font-size", `${currentFontSize}px`);
        // 如果文本宽度超过可用空间，并且字号大于8px，则缩小字号
        while (textElement.node().getComputedTextLength() > availableSpace ) {
            currentFontSize -= 1;
            textElement.style("font-size", `${currentFontSize}px`);
        }
    }

    // 左侧方向标签
    const leftLabel = g.append("text")
        .attr("x", midPointLeft)
        .attr("y", directionLabelY)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", "12px") // 设置明确的字体大小
        .style("font-weight", typography.label.font_weight) // 加粗使其更显眼
        .style("fill", centerTextColor)
        .html(`&larr; ${valueFieldName}`); // 使用度量字段名称

    // 右侧方向标签
    const rightLabel = g.append("text")
        .attr("x", midPointRight)
        .attr("y", directionLabelY)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", "12px") // 设置明确的字体大小
        .style("font-weight", typography.label.font_weight) // 加粗使其更显眼
        .style("fill", centerTextColor)
        .html(`${valueFieldName} &rarr;`); // 使用度量字段名称

    // 生成刻度值 (基于优化后的 niceMaxAbsValue)
    const tickValues = magnitudeScale.ticks(5); // 获取D3优化的刻度值

    // 创建一个临时的SVG元素用于刻度标签测量
    const tempTickMeasureSvg = d3.select(containerSelector).append("svg")
        .attr("width", 0).attr("height", 0)
        .style("opacity", 0).style("position", "absolute");

    // 帮助函数：调整刻度标签以避免重叠
    function adjustTickLabel(fullText, numericString, signString, initialFontSize, minFontSize, availableWidth, unit, tempSvg) {
        let currentText = fullText;
        let currentFontSize = initialFontSize;

        tempSvg.selectAll("text").remove(); // 清除之前的临时文本
        const tempTextElement = tempSvg.append("text")
            .style("font-family", typography.annotation.font_family)
            .style("font-weight", typography.annotation.font_weight || "normal");

        const measure = (txt, size) => {
            tempTextElement.style("font-size", `${size}px`).text(txt);
            return tempTextElement.node().getComputedTextLength();
        };

        let textWidth = measure(currentText, currentFontSize);

        // 阶段 1: 使用完整文本（符号 + 数字 + 单位）减小字体大小
        while (textWidth > availableWidth && currentFontSize > minFontSize) {
            currentFontSize--;
            textWidth = measure(currentText, currentFontSize);
        }

        // 阶段 2: 如果仍然太宽，则删除单位并重新评估
        if (textWidth > availableWidth && unit && unit.length > 0 && currentText.includes(unit)) {
            currentText = signString + numericString; // 文本变为类似 "+60" 或 "-60"
            textWidth = measure(currentText, currentFontSize); // 使用当前（可能已减小）的字体大小测量

            // 阶段 3: 如果仍然太宽（没有单位），尝试进一步减小字体大小
            while (textWidth > availableWidth && currentFontSize > minFontSize) {
                currentFontSize--;
                textWidth = measure(currentText, currentFontSize);
            }
        }
        return { text: currentText, fontSize: currentFontSize };
    }

    // 计算刻度标签的可用宽度
    let minTickGap = availableWidthPerSide; // 如果只有一个刻度或除了0没有其他刻度，则默认为整个侧边宽度
    if (tickValues.length > 1) {
        const distinctSortedPixelValues = [...new Set(tickValues.map(v => magnitudeScale(v)))]
                                          .sort((a, b) => a - b);
        if (distinctSortedPixelValues.length > 1) {
            minTickGap = Infinity;
            for (let i = 0; i < distinctSortedPixelValues.length - 1; i++) {
                const gap = distinctSortedPixelValues[i+1] - distinctSortedPixelValues[i];
                if (gap > 0) { // 确保间隙为正
                    minTickGap = Math.min(minTickGap, gap);
                }
            }
        }
        if (minTickGap === Infinity || minTickGap === 0) { // 如果所有刻度值映射到相同的像素或间隙为0，则回退
             minTickGap = availableWidthPerSide / (tickValues.filter(v => v !== 0).length || 1);
        }
    } else if (tickValues.length === 1 && tickValues[0] !== 0) { // 单个非零刻度
         minTickGap = magnitudeScale(tickValues[0]); // 从0到此刻度的空间
    }
    if (minTickGap <=0) minTickGap = availableWidthPerSide / 2; // 最后的防线


    const availableTickLabelWidth = Math.max(10, minTickGap * 0.9); // 刻度标记之间最小间隙的90%，至少10px
    const initialTickFontSize = 14; // 根据现有代码
    const minTickFontSize = 8;

    tickValues.forEach(value => {
        if (value === 0 && tickValues.length > 1) return; // 如果有其他刻度，跳过0刻度线自身的标签 (0线本身可能不需要标签)
                                                       // 如果只有0刻度，还是会画出来（虽然tickValues可能不只含0）
        
        const tickWidth = magnitudeScale(value); // 当前刻度值对应的像素宽度

        // 正刻度 (右侧)
        const xPosPositive = centerBoxRight + tickWidth;
        g.append("line") // 刻度线
            .attr("x1", xPosPositive)
            .attr("y1", -axisTickSpace)
            .attr("x2", xPosPositive)
            .attr("y2", innerHeight)
            .attr("stroke", "#CCCCCC")
            .attr("stroke-width", 0.5)
            .style("opacity", 0.5);
        
        const originalPositiveText = `+${formatValue(value)}${valueUnit}`;
        const positiveNumericString = value.toFixed(0);
        const adjustedPositiveLabel = adjustTickLabel(originalPositiveText, positiveNumericString, "+", initialTickFontSize, minTickFontSize, availableTickLabelWidth, valueUnit, tempTickMeasureSvg);

        if (value !== 0 || (value === 0 && tickValues.filter(v => v !== 0).length === 0)) { // 只在非零处或仅有0刻度时绘制标签
        g.append("text") // 刻度标签
            .attr("x", xPosPositive)
            .attr("y", -axisTickSpace)
                .attr("dy", "-0.3em")
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
                .style("font-size", `${adjustedPositiveLabel.fontSize}px`)
            .style("fill", centerTextColor)
                .text(adjustedPositiveLabel.text);
        }

        // 负刻度 (左侧) - 仅当值不为0时绘制对称的负刻度
        if (value !== 0) {
        const xPosNegative = centerBoxLeft - tickWidth;
            g.append("line") // 刻度线
            .attr("x1", xPosNegative)
            .attr("y1", -axisTickSpace)
            .attr("x2", xPosNegative)
            .attr("y2", innerHeight)
                .attr("stroke", "#CCCCCC")
                .attr("stroke-width", 0.5)
            .style("opacity", 0.5);

            const originalNegativeText = `-${formatValue(value)}${valueUnit}`;
            const negativeNumericString = value.toFixed(0); // value本身是正的
            const adjustedNegativeLabel = adjustTickLabel(originalNegativeText, negativeNumericString, "-", initialTickFontSize, minTickFontSize, availableTickLabelWidth, valueUnit, tempTickMeasureSvg);
            
        g.append("text") // 刻度标签
            .attr("x", xPosNegative)
            .attr("y", -axisTickSpace)
                .attr("dy", "-0.3em")
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
                .style("font-size", `${adjustedNegativeLabel.fontSize}px`)
            .style("fill", centerTextColor)
                .text(adjustedNegativeLabel.text);
        }
    });

    // 清理临时SVG元素
    tempTickMeasureSvg.remove();

    // 找到第一个非零刻度值对应的像素宽度
    const firstTickValue = d3.min(tickValues.filter(v => v !== 0));
    const firstTickWidth = firstTickValue ? magnitudeScale(firstTickValue) : availableWidthPerSide; // Fallback if no ticks

    // 重新定位左右方向指示标签到第一个刻度线内
    const directionLabelPadding = 0; // 标签与边界的内边距
    const availableSpaceForDirectionLabel = Math.max(10, firstTickWidth - directionLabelPadding * 2); // Ensure minimum space

    // 计算新的中心点 X 坐标
    const midPointLeftNew = centerBoxLeft - firstTickWidth / 2;
    const midPointRightNew = centerBoxRight + firstTickWidth / 2;

    // 更新标签位置
    leftLabel.attr("x", centerBoxLeft)
             .attr("text-anchor", "end"); // 改为右对齐
    
    rightLabel.attr("x", centerBoxRight)
              .attr("text-anchor", "start"); // 改为左对齐
    

    // ---------- 11. 绘制条形和标签 ----------

    const cornerRadius = variables.has_rounded_corners ? Math.min(12, barHeight / 2) : 0; // 条形圆角半径

    // 遍历数据，绘制每个条形及其标签
    chartData.forEach(d => {
        const dimension = d[dimensionField];
        const value = d[valueField];
        const yPos = yScale(dimension); // 获取当前维度对应的Y坐标

        const barColor = value >= 0 ? positiveColor : negativeColor; // 根据正负选择颜色
        const formattedValue = value >= 0 ? 
            `+${formatValue(value)}${valueUnit}` : 
            `${formatValue(value)}${valueUnit}`;

        // 临时测量当前数值标签宽度 (用于判断标签是放内部还是外部)
        const tempValueMeasureSvg = d3.select("body").append("svg").attr("width",0).attr("height",0).style("visibility","hidden");
        const tempValueMeasureText = tempValueMeasureSvg.append("text")
             .style("font-family", typography.annotation.font_family)
             .style("font-size", typography.annotation.font_size)
             .style("font-weight", "bold")
             .text(formattedValue);
        const currentValLabelWidth = tempValueMeasureText.node().getComputedTextLength();
        tempValueMeasureSvg.remove();

        let barX, barWidth;
        const absValue = Math.abs(value);
        barWidth = magnitudeScale(absValue); // 使用量级比例尺计算条形宽度
        barWidth = Math.max(0, barWidth); // 确保宽度非负

        // 计算条形X坐标
        if (value >= 0) {
            barX = centerBoxRight; // 正值条紧贴中心列右侧开始
        } else {
            barX = centerBoxLeft - barWidth; // 负值条在中心列左侧向左绘制
        }

        // 绘制条形（统一使用外侧半圆形）
        const semiCircleRadius = barHeight / 2;
        let pathData;

        // 确保条形宽度至少为半径，否则半圆无法绘制
        if (barWidth >= semiCircleRadius) {
            if (value >= 0) { // 正值: 右侧半圆 (修正路径)
                pathData = `M ${barX},${yPos}` +                             // 左上角
                           `L ${barX + barWidth - semiCircleRadius},${yPos}` + // 右上圆弧起点
                           `a ${semiCircleRadius},${semiCircleRadius} 0 0 1 0,${barHeight}` + // 右侧半圆弧向下
                           `L ${barX},${yPos + barHeight}` +                   // 左下角
                           `Z`;                                               // 闭合路径 (正确路径)
            } else { // 负值: 左侧半圆 (路径正确)
                 pathData = `M ${barX + barWidth},${yPos}` + // 右上角
                            `L ${barX + barWidth},${yPos + barHeight}` + // 右下角
                            `L ${barX + semiCircleRadius},${yPos + barHeight}` + // 左下圆弧起点
                            `a ${semiCircleRadius},${semiCircleRadius} 0 0 1 0,-${barHeight}` + // 左侧半圆弧 (连接到左上圆弧终点)
                            `Z`; // 闭合路径
            }
        } else {
           // 如果条形宽度小于半径，绘制普通矩形避免形状错误
           pathData = `M ${barX},${yPos} L ${barX+barWidth},${yPos} L ${barX+barWidth},${yPos+barHeight} L ${barX},${yPos+barHeight} Z`;
        }

        g.append("path")
            .attr("d", pathData)
            .attr("fill", barColor)
            .style("stroke", strokeColor)
            .style("stroke-width", variables.has_stroke ? 0.5 : 0) // Ensure stroke width is consistent or none
            .style("filter", variables.has_shadow ? "url(#shadow)" : null);

        // --- 绘制中心维度标签 ---
        const labelY = yPos + barHeight / 2; // 标签垂直中心位置
        const centerLabelX = centerBoxLeft + centerBoxWidth / 2; // 标签水平中心位置

        g.append("text")
            .attr("x", centerLabelX)
            .attr("y", labelY)
            .attr("dy", "0.35em") // 垂直对齐微调
            .attr("text-anchor", "middle") // 水平居中
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", centerTextColor)
            .text(dimension);

        // --- 绘制数值标签 ---
        // 判断标签是否能放在条形内部
        const canFitInside = barWidth > currentValLabelWidth + valuePadding * 2;
        let valueLabelX, valueLabelAnchor, valueLabelColor;

        if (value >= 0) { // 正值标签定位
            if (canFitInside) {
                valueLabelX = barX + barWidth - valuePadding; // 内部右侧
                valueLabelAnchor = "end"; // 右对齐
                valueLabelColor = centerTextColor; // 内部用白色
            } else {
                valueLabelX = barX + barWidth + valuePadding; // 外部右侧
                valueLabelAnchor = "start"; // 左对齐
                valueLabelColor = barColor; // 外部用条形颜色
            }
        } else { // 负值标签定位
            if (canFitInside) {
                valueLabelX = barX + valuePadding; // 内部左侧
                valueLabelAnchor = "start"; // 左对齐
                valueLabelColor = centerTextColor; // 内部用白色
            } else {
                valueLabelX = barX - valuePadding; // 外部左侧
                valueLabelAnchor = "end"; // 右对齐
                valueLabelColor = barColor; // 外部用条形颜色
            }
        }

        g.append("text")
            .attr("x", valueLabelX)
            .attr("y", labelY)
            .attr("dy", "0.35em") // 垂直对齐
            .attr("text-anchor", valueLabelAnchor) // 水平对齐
            .style("font-family", typography.annotation.font_family)
            .style("font-size", typography.annotation.font_size)
            .style("font-weight", "bold") // 数值标签加粗
            .style("fill", valueLabelColor)
            .text(formattedValue);
    });

    // ---------- 12. 返回SVG DOM节点 ----------
    return svg.node();
}
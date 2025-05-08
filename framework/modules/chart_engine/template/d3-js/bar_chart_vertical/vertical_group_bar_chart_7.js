/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_7",
    "is_composite": false,
    "required_fields": ["x", "y", "group", "group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
    "required_fields_range": [
        [2, 20], 
        [0, "inf"], 
        [2, 2], 
        [2, 2]  
    ],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"], 
    "required_other_colors": [],
    "supported_effects": ["radius_corner", "spacing"], 
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes", 
    "has_y_axis": "no" 
}
REQUIREMENTS_END
*/

// 垂直分组叠加（模式覆盖）条形图实现
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    const jsonData = data;
    const chartData = jsonData.data.data || [];
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "10px", font_weight: "normal" } // Smaller annotation for labels
    };
    const colors = jsonData.colors || {
        text_color: "#333333",
        field: {}, // Colors for group1 (e.g., Year) should be here
        other: {}
    };
    const dataColumns = jsonData.data.columns || [];

    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners !== undefined ? variables.has_rounded_corners : false;
    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true; // Default spacing to true

    // 创建用于文本测量的Canvas Context
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // 清除容器
    d3.select(containerSelector).html("");

    // 添加数值格式化函数
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

    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 800;
    const height = variables.height || 500;

    const margin = {
        top: 90,    // 为顶部标签留出空间
        right: 40,
        bottom: 100,  // x轴标签空间
        left: 40
    };

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // ---------- 3. 提取字段名称和单位 ----------
    let xField, yField, group1Field, group2Field;
    let yUnit = "";

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    

    

    xField = xColumn.name;
    yField = yColumn.name;
    group1Field = dataColumns.find(col => col.role === "group").name;
    group2Field = dataColumns.find(col => col.role === "group2").name;
    if (yColumn.unit && yColumn.unit !== "none") {
        yUnit = yColumn.unit; // 通常是 '%'
    }

    // ---------- 4. 数据处理与重组 ----------
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    const group1Values = [...new Set(chartData.map(d => d[group1Field]))]; 
    const group2Values = [...new Set(chartData.map(d => d[group2Field]))]; // 指标名称 ("Answered", "Thereof correct")

    if (group2Values.length !== 2) {
         console.error(`Expected exactly 2 unique values for the second group field ('${group2Field}'), but found ${group2Values.length}.`);
         d3.select(containerSelector).append("p").text(`Error: Need exactly 2 metrics in '${group2Field}'.`);
         return;
    }
    // 假定第一个group2值是主指标(如"Answered")，第二个是次指标(如"Thereof correct")
    const primaryMetricName = group2Values[0];
    const secondaryMetricName = group2Values[1];

    const processedData = {}; // 结构: { xValue: { group1Value: { primaryValue: y, secondaryRate: y, overlayValue: y_calc }, ... }, ... }

    chartData.forEach(d => {
        const xVal = d[xField];
        const g1Val = d[group1Field];
        const g2Val = d[group2Field];
        const yVal = +d[yField] || 0; // Ensure numerical, default to 0

        if (!processedData[xVal]) {
            processedData[xVal] = {};
        }
        if (!processedData[xVal][g1Val]) {
            processedData[xVal][g1Val] = { primaryValue: 0, secondaryRate: 0, overlayValue: 0 };
        }

        if (g2Val === primaryMetricName) {
            processedData[xVal][g1Val].primaryValue = yVal;
        } else if (g2Val === secondaryMetricName) {
            processedData[xVal][g1Val].secondaryRate = yVal;
        }
    });

    // 计算 overlayValue
    Object.values(processedData).forEach(xGroup => {
        Object.values(xGroup).forEach(groupData => {
            // Overlay height = primaryValue * (secondaryRate / 100)
            // Assumes both are percentages 0-100
            groupData.overlayValue = groupData.primaryValue * (groupData.secondaryRate / 100);
        });
    });


    // ---------- 5. 创建SVG容器和Defs ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const defs = svg.append("defs");

    // 创建斜线模式
    const patternSize = 8;
    const pattern = defs.append("pattern")
        .attr("id", "diagonal-stripe-pattern")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", patternSize)
        .attr("height", patternSize)
        .attr("patternTransform", "rotate(-45)"); // *** 保持: 旋转方向-45度 ***

    // *** 修改: 图案背景透明，线条变细、变深 ***
    pattern.append("rect")
           .attr("width", patternSize)
           .attr("height", patternSize)
           .attr("fill", "none"); // 透明背景

    pattern.append("line")
           .attr("x1", 0)
           .attr("y1", patternSize / 2)
           .attr("x2", patternSize)
           .attr("y2", patternSize / 2)
           .attr("stroke", "#FFFFFF") // *** 修改: 斜线改回白色 ***
           .attr("stroke-width", 1.5); // 线条变细


    // ---------- 6. 创建比例尺和颜色 ----------
    // X主分类比例尺
    const xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, innerWidth])
        .padding(0.25); // 主分组之间的间距

    // X子分类比例尺 (e.g., Year)
    const group1Scale = d3.scaleBand()
        .domain(group1Values)
        .range([0, xScale.bandwidth()])
        .padding(variables.has_spacing ? 0.1 : 0.05); // 组内条形之间的间距

    // Y比例尺 (基于主指标的最大值)
    const yMax = d3.max(chartData, d => (d[group2Field] === primaryMetricName) ? (+d[yField] || 0) : 0) * 1.1 || 100;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([innerHeight, 0])
        .nice(); // 使坐标轴刻度更友好

    // 颜色比例尺 (基于第一个分组 - Year)
    const colorScale = d3.scaleOrdinal()
        .domain(group1Values)
        .range(group1Values.map(g1 => colors.field[g1] || d3.schemeCategory10[group1Values.indexOf(g1) % 10])); // 提供备用颜色

    // ---------- 7. 文本宽度计算函数 ----------
    function getTextWidth(text, fontSize, fontWeight, fontFamily) {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        return context.measureText(text).width;
    }

    // *** 添加: 文本换行辅助函数 ***
    function wrapText(textElement, text, width, x, y, fontSize, fontWeight, fontFamily) {
        textElement.each(function() { // Use normal function for 'this'
            let words = String(text).split(/\s+/).reverse(), // Ensure text is string
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, // ems
                tspan = d3.select(this).text(null).append("tspan").attr("x", x).attr("y", y), // Use d3.select(this)
                dy = 0; // Initial dy for first line

            // Check total estimated width first using precise measurement
            if (getTextWidth(text, fontSize, fontWeight, fontFamily) <= width) {
                tspan.text(text);
                return; // No wrapping needed
            }

            // Try to wrap (limit to max 2 lines for simplicity here)
            let lines = [];
            let currentLine = "";
            while (word = words.pop()) {
                line.push(word);
                currentLine = line.join(" ");
                // Use precise measurement for wrapping check
                if (getTextWidth(currentLine, fontSize, fontWeight, fontFamily) > width && line.length > 1) {
                    line.pop();
                    lines.push(line.join(" "));
                    line = [word];
                    if (lines.length >= 1) { // Stop after creating the first line break potential
                        line = [word].concat(words.reverse()); // Put remaining words on the second line
                        break;
                    }
                }
            }
            lines.push(line.join(" ")); // Add the last or only line

            // Render the lines (max 2)
            lines.slice(0, 2).forEach((lineText, i) => {
                if (i > 0) dy = lineHeight;
                // Remove previous tspan content if it exists and we are adding the first real line
                if (i === 0) d3.select(this).selectAll("tspan").remove();
                tspan = d3.select(this).append("tspan") // Append subsequent tspans
                             .attr("x", x)
                             .attr("y", y) // Y is same, dy handles vertical shift
                             .attr("dy", `${dy}em`)
                             .text(lineText);
            });
        });
    }

    // ---------- 8. 创建主图表组 ----------
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // ---------- 8.5 添加图例 ----------
    const legendY = margin.top / 4*3; // 图例垂直居中在顶部边距
    const legendSquareSize = 12;
    const legendPadding = 25; // 项之间的主间距
    const legendItemPadding = 8; // 图形和文本之间的间距

    // *** 修改: 获取两个 group1 的颜色 ***
    if (group1Values.length < 2) {
        console.warn("Legend style expects at least 2 group1 values for colors. Using defaults.");
    }
    const legendG1Color1 = colorScale(group1Values[0]); // 第一个 group1 的颜色
    const legendG1Color2 = colorScale(group1Values[1] || group1Values[0]); // 第二个 group1 的颜色 (或备用)

    const legendFontFamily = typography.label.font_family;
    const legendFontSize = parseFloat(typography.label.font_size);
    const legendFontWeight = typography.label.font_weight;

    // 计算文本宽度
    const metric1NameWidth = getTextWidth(primaryMetricName, legendFontSize, legendFontWeight, legendFontFamily);
    const metric2NameWidth = getTextWidth(secondaryMetricName, legendFontSize, legendFontWeight, legendFontFamily);

    // 计算总宽度
    const totalLegendWidth = (legendSquareSize + legendItemPadding + metric1NameWidth) + 
                           legendPadding + 
                           (legendSquareSize + legendItemPadding + metric2NameWidth);

    // 计算起始X坐标以居中
    const legendStartX = margin.left + (innerWidth - totalLegendWidth) / 2;

    // 创建图例组
    const legendGroup = svg.append("g")
        .attr("class", "chart-legend")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);

    let currentX = 0;

    // --- 绘制第一个指标图例 ---
    const swatch1 = legendGroup.append("g")
        .attr("transform", `translate(${currentX}, ${-legendSquareSize / 2})`);
    
    // 左上三角形 (group1 color 1)
    swatch1.append("path")
        .attr("d", `M0,0 L${legendSquareSize},0 L0,${legendSquareSize} Z`)
        .attr("fill", legendG1Color1);
    // 右下三角形 (group1 color 2)
    swatch1.append("path")
        .attr("d", `M${legendSquareSize},${legendSquareSize} L0,${legendSquareSize} L${legendSquareSize},0 Z`)
        .attr("fill", legendG1Color2);
    
    currentX += legendSquareSize + legendItemPadding;

    // 指标1文本
    legendGroup.append("text")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", colors.text_color || "#333333")
        .text(primaryMetricName);
    currentX += metric1NameWidth + legendPadding; // 使用主间距

    // --- 绘制第二个指标图例 ---
    const swatch2 = legendGroup.append("g")
        .attr("transform", `translate(${currentX}, ${-legendSquareSize / 2})`);
    
    // 左上三角形 (group1 color 1)
    swatch2.append("path")
        .attr("d", `M0,0 L${legendSquareSize},0 L0,${legendSquareSize} Z`)
        .attr("fill", legendG1Color1);
    // 右下三角形 (group1 color 2)
    swatch2.append("path")
        .attr("d", `M${legendSquareSize},${legendSquareSize} L0,${legendSquareSize} L${legendSquareSize},0 Z`)
        .attr("fill", legendG1Color2);
    // 图案覆盖层
    swatch2.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", legendSquareSize)
        .attr("height", legendSquareSize)
        .attr("fill", "url(#diagonal-stripe-pattern)"); // 应用图案
        
    currentX += legendSquareSize + legendItemPadding;

    // 指标2文本
    legendGroup.append("text")
        .attr("x", currentX)
        .attr("y", 0)
        .attr("dominant-baseline", "middle")
        .style("font-family", legendFontFamily)
        .style("font-size", `${legendFontSize}px`)
        .style("font-weight", legendFontWeight)
        .style("fill", colors.text_color || "#333333")
        .text(secondaryMetricName);

    // ---------- 9. 绘制条形和覆盖层 ----------
    const barGroups = chart.selectAll(".bar-group")
        .data(xValues)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d)}, 0)`);

    barGroups.each(function(xValue) { // 使用普通函数获取 'this'
        const groupG = d3.select(this);

        group1Values.forEach(group1Value => {
            const groupData = processedData[xValue]?.[group1Value];
            if (!groupData) return; // 跳过没有数据的分组

            const barX = group1Scale(group1Value);
            const barWidth = group1Scale.bandwidth();
            const barColor = colorScale(group1Value);

            // 主条形 (代表 primaryValue)
            const primaryY = yScale(groupData.primaryValue);
            const primaryHeight = innerHeight - primaryY;

            if (primaryHeight > 0) {
                groupG.append("rect")
                    .attr("class", "main-bar")
                    .attr("x", barX)
                    .attr("y", primaryY)
                    .attr("width", barWidth)
                    .attr("height", primaryHeight)
                    .attr("fill", barColor)
                    .attr("rx", variables.has_rounded_corners ? 3 : 0)
                    .attr("ry", variables.has_rounded_corners ? 3 : 0);
            }

            // 覆盖层 (代表 overlayValue)
            const overlayY = yScale(groupData.overlayValue);
            const overlayHeight = innerHeight - overlayY;

            if (overlayHeight > 0) {
                 // 先绘制一个相同颜色的底，防止图案在空白处绘制
                 groupG.append("rect")
                    .attr("class", "overlay-base")
                    .attr("x", barX)
                    .attr("y", overlayY)
                    .attr("width", barWidth)
                    .attr("height", overlayHeight)
                    .attr("fill", barColor)
                    .attr("rx", variables.has_rounded_corners ? 3 : 0) // 确保圆角匹配
                    .attr("ry", variables.has_rounded_corners ? 3 : 0);
                 // 再绘制图案层
                 groupG.append("rect")
                    .attr("class", "overlay-pattern")
                    .attr("x", barX)
                    .attr("y", overlayY)
                    .attr("width", barWidth)
                    .attr("height", overlayHeight)
                    .attr("fill", "url(#diagonal-stripe-pattern)")
                    .attr("rx", variables.has_rounded_corners ? 3 : 0) // 确保圆角匹配
                    .attr("ry", variables.has_rounded_corners ? 3 : 0);
            }
        });
    });

    // ---------- 10. 绘制标签 ----------
     // 预计算标签字体大小
    const baseFontSizeLabel = parseFloat(typography.label.font_size) || 12; // For Group1 labels
    const baseFontSizeAnnotation = parseFloat(typography.annotation.font_size) || 10;
    const minFontSize = 4;
    let minPrimaryLabelRatio = 1.0;
    let minSecondaryLabelRatio = 1.0;
    const maxLabelWidth = group1Scale.bandwidth() * 1.1; // 允许稍微超出条形 for value labels
    // *** 添加: Group1标签的宽度限制和最小比例 ***
    const maxGroup1LabelWidth = group1Scale.bandwidth(); // Group1标签严格限制在bar宽度内
    let minGroup1LabelRatio = 1.0;

    // 预计算缩放比例
    xValues.forEach(xValue => {
        group1Values.forEach(group1Value => {
            const groupData = processedData[xValue]?.[group1Value];
            if (!groupData) return;

            // 主指标标签
            const primaryText = formatValue(groupData.primaryValue) + (yUnit ? ` ${yUnit}` : '');
            let width = getTextWidth(primaryText, baseFontSizeAnnotation, typography.annotation.font_weight, typography.annotation.font_family);
            if (width > maxLabelWidth) {
                minPrimaryLabelRatio = Math.min(minPrimaryLabelRatio, maxLabelWidth / width);
            }

            // 次指标标签 (Rate)
            const secondaryText = formatValue(groupData.secondaryRate) + (yUnit ? ` ${yUnit}` : '');
            width = getTextWidth(secondaryText, baseFontSizeAnnotation, typography.annotation.font_weight, typography.annotation.font_family);
             if (width > maxLabelWidth) { // 也应用宽度限制
                 minSecondaryLabelRatio = Math.min(minSecondaryLabelRatio, maxLabelWidth / width);
             }

            // *** 添加: Group1标签宽度预计算 ***
            const group1Text = String(group1Value);
            width = getTextWidth(group1Text, baseFontSizeLabel, typography.label.font_weight, typography.label.font_family);
            if (width > maxGroup1LabelWidth) {
                minGroup1LabelRatio = Math.min(minGroup1LabelRatio, maxGroup1LabelWidth / width);
            }
        });
    });

    const finalPrimaryFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minPrimaryLabelRatio);
    const finalSecondaryFontSize = Math.max(minFontSize, baseFontSizeAnnotation * minSecondaryLabelRatio);
    // *** 添加: 计算最终 Group1 标签字体大小 ***
    const finalGroup1FontSize = Math.max(minFontSize, baseFontSizeLabel * minGroup1LabelRatio);

    // *** 添加: 定义 iconPaddingTop 在循环外部 ***
    const iconPaddingTop = 35; // 图标距离Group1标签区的垂直距离

    // 绘制标签
    barGroups.each(function(xValue) {
        const groupG = d3.select(this);

        group1Values.forEach(group1Value => {
            const groupData = processedData[xValue]?.[group1Value];
            if (!groupData) return;

            const barX = group1Scale(group1Value);
            const barWidth = group1Scale.bandwidth();
            const centerX = barX + barWidth / 2;
            const barColor = colorScale(group1Value);

            // 1. 主指标值标签 (条形上方)
            const primaryY = yScale(groupData.primaryValue);
            if (groupData.primaryValue > 0) {
                 groupG.append("text")
                    .attr("class", "primary-label")
                    .attr("x", centerX)
                    .attr("y", primaryY - 5) // 在条形上方5px
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${finalPrimaryFontSize}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", colors.text_color || "#333333")
                    .text(formatValue(groupData.primaryValue) + (yUnit ? ` ${yUnit}` : ''));
            }


            // 2. 次指标率标签 (覆盖层上，带背景)
            const overlayY = yScale(groupData.overlayValue);
             if (groupData.overlayValue > 0 && groupData.secondaryRate > 0) { // 仅当overlay和rate都>0时显示
                const labelHeight = finalSecondaryFontSize * 1.4; // 背景高度略大于字体
                const labelWidth = getTextWidth(groupData.secondaryRate.toFixed(1) + yUnit, finalSecondaryFontSize, typography.annotation.font_weight, typography.annotation.font_family) + 8; // 背景宽度带内边距
                const labelRectWidth = Math.min(barWidth * 0.9, labelWidth); // 限制文本背景宽度
                // *** 修改: 计算背景矩形的宽度和X坐标 ***
                const labelBgWidth = barWidth * 1.05; // 背景比bar稍宽
                const labelBgX = centerX - labelBgWidth / 2; // 水平居中背景
                const labelRectY = overlayY + (innerHeight - overlayY) * 0.2; // 放在覆盖层高度20%的位置

                // 标签背景矩形
                groupG.append("rect")
                    .attr("class", "secondary-label-bg")
                    .attr("x", labelBgX) // 使用计算好的X坐标
                    .attr("y", labelRectY - labelHeight / 2)
                    .attr("width", labelBgWidth) // 使用稍宽的背景宽度
                    .attr("height", labelHeight)
                    // .attr("text-anchor","middle") // 'text-anchor' 无效 for rect
                    .attr("fill", barColor) // 使用条形颜色做背景
                    .attr("rx", 3)
                    .attr("ry", 3);

                // 标签文本
                groupG.append("text")
                    .attr("class", "secondary-label")
                    .attr("x", centerX)
                    .attr("y", labelRectY) // 文本的Y坐标在矩形中心
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${finalSecondaryFontSize}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("fill", "#FFFFFF") // 白色文本
                    .text(groupData.secondaryRate.toFixed(1) + yUnit);
            }

             // *** 添加: Group1 标签 (年份等) ***
            const group1LabelY = innerHeight + 15; // Y 坐标放在 X 轴下方一点
            const group1Text = String(group1Value);
            const group1Label = groupG.append("text")
                .attr("class", "group1-label")
                .attr("x", centerX)
                .attr("y", group1LabelY)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", `${finalGroup1FontSize}px`)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333");

            // 调用 wrapText 处理 Group1 标签的文本和换行
            group1Label.call(wrapText, group1Text, maxGroup1LabelWidth, centerX, group1LabelY, finalGroup1FontSize, typography.label.font_weight, typography.label.font_family);

        }); // 结束 group1Values.forEach

         // *** 添加: X维度图标 ***
        const iconUrl = jsonData.images?.field?.[xValue];
        const iconSize = xScale.bandwidth() * 0.6; // 图标大小为X Band宽度的60%
        const iconY = innerHeight + iconPaddingTop; // 定位在 group1 标签下方

        if (iconUrl && iconSize > 10) { // 仅当有URL且图标不太小时绘制
            const iconX = xScale.bandwidth() / 2; // 在主X组的中心

            groupG.append("image")
                .attr("x", iconX - iconSize / 2)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("xlink:href", iconUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

    }); // 结束 barGroups.each

    // ---------- 11. 添加分隔线 ----------
    const separatorColor = "#d3d3d3"; // 浅灰色
    const separatorStrokeWidth = 1;

    // 1. Bar底部水平线
    chart.append("line")
        .attr("class", "separator-line-bars")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight)
        .attr("stroke", separatorColor)
        .attr("stroke-width", separatorStrokeWidth);

    // 2. Group1标签下方水平线
    const yLine2 = innerHeight + 30; // 定义第二条线的Y坐标
    chart.append("line")
        .attr("class", "separator-line-group1")
        .attr("x1", 0)
        .attr("y1", yLine2)
        .attr("x2", innerWidth)
        .attr("y2", yLine2)
        .attr("stroke", separatorColor)
        .attr("stroke-width", separatorStrokeWidth);

    // 3. 图标区域之间的垂直线
    const iconAreaBottomPadding = 10;
    const maxIconSize = d3.max(xValues, x => xScale.bandwidth() * 0.6) || 24; // 计算最大可能的图标大小
    const verticalLineStartY = yLine2;
    const verticalLineEndY = innerHeight + iconPaddingTop + maxIconSize + iconAreaBottomPadding; // 线的底部在最大图标下方

    for (let i = 0; i < xValues.length - 1; i++) {
        // 计算分隔线的 X 坐标 (两个 band 中间)
        const xSeparator = xScale(xValues[i]) + xScale.bandwidth() + xScale.paddingInner() * xScale.step() / 2;
        chart.append("line")
            .attr("class", "separator-line-vertical")
            .attr("x1", xSeparator)
            .attr("y1", verticalLineStartY)
            .attr("x2", xSeparator)
            .attr("y2", verticalLineEndY)
            .attr("stroke", separatorColor)
            .attr("stroke-width", separatorStrokeWidth);
    }

    // ---------- 12. 返回SVG节点 ----------
    return svg.node();
} 
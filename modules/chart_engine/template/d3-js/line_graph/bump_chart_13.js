/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Sorted Lines Chart",
    "chart_name": "bump_chart_13",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [2, 12],
        [0, "inf"],
        [4, 10]
    ],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["spacing"],
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

// 排序线图(Bump Chart)实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------

    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data;           // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "bold" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义

    // 清空容器
    d3.select(containerSelector).html("");

    // ---------- 辅助函数：动态调整字体大小 ----------
    function getAdaptedFontSize(text, maxWidth, initialFontSize, fontFamily, fontWeight) {
        let fontSize = initialFontSize;
        const tempSvgForFont = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("position", "absolute") // 防止影响布局
            .style("visibility", "hidden");

        let textElement = tempSvgForFont.append("text")
            .style("font-family", fontFamily)
            .style("font-weight", fontWeight)
            .text(text);

        while (fontSize > 1) { // 最小字体大小为1px
            textElement.style("font-size", fontSize + "px");
            const textWidth = textElement.node().getBBox().width;
            if (textWidth <= maxWidth) {
                break;
            }
            fontSize -= 1;
        }
        tempSvgForFont.remove();
        return fontSize;
    }

    // ---------- 辅助函数：创建正六边形路径（横边朝上） ----------
    function hexagonPath(cx, cy, r) {
        const angles = d3.range(6).map(i => (i * Math.PI / 3) + (Math.PI / 6)); // 六边形的6个角，旋转30度(π/6)使横边朝上
        const points = angles.map(angle => [
            cx + r * Math.sin(angle),
            cy - r * Math.cos(angle)
        ]);
        return d3.line()(points) + "Z"; // Z表示闭合路径
    }

    // ---------- 辅助函数：获取文本宽度 ----------
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = d3.select(containerSelector)
            .append("svg")
            .attr("width", 0)
            .attr("height", 0)
            .style("position", "absolute")
            .style("visibility", "hidden");

        const textElement = tempSvg.append("text")
            .style("font-family", fontFamily)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", fontWeight)
            .text(text);

        const width = textElement.node().getBBox().width;
        tempSvg.remove();
        return width;
    }



    // ---------- 2. 尺寸和布局设置 ----------

    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;

    // 设置边距
    const margin = {
        top: 120,     // 顶部留出标题和图例空间
        right: 50,    // 右侧足够显示数值
        bottom: 50,   // 底部边距
        left: 50      // 左侧空间，不再需要为组标签留空间
    };

    // ---------- 3. 提取字段名和单位 ----------

    // 根据数据列顺序提取字段名
    const timeField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;

    // 注意：此图表模板不使用字段单位

    // ---------- 4. 数据处理 ----------

    // 添加数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format(".1f")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format(".1f")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format(".0f")(value / 1000) + "K";
        } else {
            return d3.format(".0f")(value);
        }
    };

    // 获取唯一时间点和分组值
    const timePoints = [...new Set(chartData.map(d => d[timeField]))].sort();
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    // ---------- 数据完整性检查 ----------
    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            const dataExists = chartData.some(d => d[groupField] === group && d[timeField] === timePoint);
            if (!dataExists) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) {
            break;
        }
    }

    if (!allDataPresent) {
        d3.select(containerSelector).html(""); // 清空容器
        // 可以选择在此处添加提示信息到容器中，例如：
        // d3.select(containerSelector).append("p").text("数据不完整：每个组在所有时间点都必须有数据。图表无法生成。").style("padding", "10px").style("text-align", "center");
        return null; // 不返回图表节点
    }

    // 不再需要为左侧组标签计算宽度

    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // ---------- 6. 创建SVG容器 ----------

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");



    // ---------- 7. 计算最大值 (用于圆圈大小比例尺) ----------
    const maxValue = d3.max(chartData, d => +d[valueField]);

    // ---------- 8. 创建比例尺 ----------

    // X轴比例尺（时间点）
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    // Y轴比例尺（组）
    const yScale = d3.scaleBand()
        .domain(groups)
        .range([0, innerHeight])
        .padding(0.2);

    // 颜色比例尺（组）
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            return d3.schemeCategory10[i % 10]; // 使用D3默认颜色方案
        }));

    // ---------- 9. 创建主图表组 ----------

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 不再在左侧添加组标签和图标，改为在顶部添加图例

    // ---------- 11. 绘制数据点和连线 ----------

    // 注意：直接在下面的循环中为每个组绘制数据点和连线

    // 为每个组和每个时间点绘制数据点
    groups.forEach(group => {
        // 创建路径生成器
        const lineGenerator = d3.line()
            .x(d => xScale(d[timeField]) + xScale.bandwidth() / 2)
            .y(d => yScale(d[groupField]) + yScale.bandwidth() / 2);

        // 获取此组的所有数据点，按时间排序
        const groupData = chartData.filter(d => d[groupField] === group)
            .sort((a, b) => timePoints.indexOf(a[timeField]) - timePoints.indexOf(b[timeField]));

        // 如果至少有2个数据点，绘制连线
        if (groupData.length >= 2) {
            // 绘制连线
            g.append("path")
                .datum(groupData)
                .attr("fill", "none")
                .attr("stroke", colorScale(group))
                .attr("stroke-width", 2)
                .attr("d", lineGenerator);
        }

        // 为每个时间点绘制圆点和数值
        groupData.forEach(d => {
            const cx = xScale(d[timeField]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupField]) + yScale.bandwidth() / 2;
            const value = +d[valueField];

            // 圆圈大小基于数值，不超过可用宽度和高度
            const maxRadiusForTimePointWidth = (xScale.bandwidth() / 2) * 0.9; // 0.9 为宽度边距因子
            const maxRadiusForTimePointHeight = (yScale.bandwidth() / 2) * 0.9; // 0.9 为高度边距因子
            const maxRadiusForTimePoint = Math.min(maxRadiusForTimePointWidth, maxRadiusForTimePointHeight); // 取宽高中的较小值
            const minCircleArea = Math.PI * Math.pow(2, 2); // 最小半径为2px
            const maxCircleArea = Math.PI * Math.pow(maxRadiusForTimePoint, 2);

            const areaScale = d3.scaleLinear()
                .domain([0, maxValue]) // 假设最小值为0
                .range([minCircleArea, maxCircleArea])
                .clamp(true); // 防止超出范围

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            // 绘制六边形背景（无描边）
            g.append("path")
                .attr("d", hexagonPath(cx, cy, circleRadius))
                .attr("fill", colorScale(group));

            // 添加数值标签，动态调整字体大小
            const formattedValue = formatValue(value);
            const initialAnnotationFontSize = parseFloat(typography.annotation.font_size);
            // 数值标签的最大宽度现在是时间点的可用宽度
            const annotationMaxWidth = xScale.bandwidth();

            const annotationFontSize = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth,
                initialAnnotationFontSize,
                typography.annotation.font_family,
                typography.annotation.font_weight
            );



            // 统一将标签放在六边形下方
            const labelPaddingBelowHexagon = 5; // 六边形和标签之间的间距
            g.append("text")
                .attr("x", cx)
                .attr("y", cy + circleRadius + labelPaddingBelowHexagon)
                .attr("dominant-baseline", "hanging") // 确保文本从y坐标开始向下渲染
                .attr("text-anchor", "middle")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", annotationFontSize + "px")
                .style("font-weight", typography.annotation.font_weight)
                .style("fill", "#333333") // 统一使用黑色作为标签颜色
                .text(formattedValue);
        });
    });

    // ---------- 12. 添加图例 ----------

    // 添加动态图例，支持图例换行并且居中
    if (groups && groups.length > 0) {
        const legendHexSize = 12; // 图例六边形大小
        const legendPadding = 6; // 图例标记和文本之间的间距
        const legendInterItemSpacing = 12; // 图例项之间的水平间距

        const legendFontFamily = typography.label.font_family || 'Arial'; // 图例字体
        const legendFontSize = parseFloat(typography.label.font_size || '11'); // 图例字号
        const legendFontWeight = typography.label.font_weight || 'normal'; // 图例字重

        // 1. 准备图例项数据
        const legendItemsData = groups.map(group => {
            const text = String(group);
            const color = colors.field && colors.field[group] ? colors.field[group] : colorScale(group);
            const textWidth = getTextWidth(text, legendFontFamily, legendFontSize, legendFontWeight);
            // visualWidth 是单个图例项（标记+间距+文本）的实际显示宽度
            const visualWidth = legendHexSize + legendPadding + textWidth;
            return { text, color, visualWidth };
        });

        // 2. 将图例项排列成行
        const legendLines = [];
        let currentLineItems = [];
        let currentLineVisualWidth = 0; // 当前行已占用的视觉宽度
        // 图例换行的可用宽度，基于图表主体绘图区
        const availableWidthForLegendWrapping = innerWidth;

        legendItemsData.forEach(item => {
            let widthIfAdded = item.visualWidth;
            if (currentLineItems.length > 0) { // 如果不是当前行的第一个元素，需要加上间距
                widthIfAdded += legendInterItemSpacing;
            }

            if (currentLineItems.length > 0 && (currentLineVisualWidth + widthIfAdded) > availableWidthForLegendWrapping) {
                // 当前行已满，将当前行数据存入 legendLines
                legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
                // 开始新行
                currentLineItems = [item];
                currentLineVisualWidth = item.visualWidth; // 新行的初始宽度
            } else {
                // 将元素添加到当前行
                if (currentLineItems.length > 0) {
                    currentLineVisualWidth += legendInterItemSpacing; // 添加元素间距
                }
                currentLineItems.push(item);
                currentLineVisualWidth += item.visualWidth; // 加上元素自身宽度
            }
        });

        // 添加最后一行（如果有）
        if (currentLineItems.length > 0) {
            legendLines.push({ items: currentLineItems, totalVisualWidth: currentLineVisualWidth });
        }

        // 3. 计算图例块的整体垂直位置
        if (legendLines.length > 0) {
            const itemMaxHeight = Math.max(legendHexSize, legendFontSize); // 单行图例内容的最大高度
            const interLineVerticalPadding = 6; // 图例行之间的垂直间距
            const minSvgGlobalTopPadding = 15; // SVG顶部到图例块的最小间距

            let legendBlockStartY = -margin.top + minSvgGlobalTopPadding; // 图例起始Y坐标

            const legendContainerGroup = g.append("g").attr("class", "custom-legend-container");

            // 4. 渲染每一行图例
            let currentLineBaseY = legendBlockStartY; // 当前渲染行的顶部Y坐标
            legendLines.forEach((line) => {
                // 每一行在整个图表中水平居中
                const lineRenderStartX = (innerWidth - line.totalVisualWidth) / 2;
                const lineCenterY = currentLineBaseY + itemMaxHeight / 2; // 用于文本垂直居中

                let currentItemDrawX = lineRenderStartX; // 当前图例项的起始X坐标

                line.items.forEach((item, itemIndex) => {
                    // 绘制图例标记 (六边形)
                    const hexRadius = legendHexSize / 2;
                    const hexCenterX = currentItemDrawX + hexRadius;
                    const hexCenterY = lineCenterY;

                    legendContainerGroup.append("path")
                        .attr("d", hexagonPath(hexCenterX, hexCenterY, hexRadius))
                        .attr("fill", item.color);

                    // 绘制图例文本
                    legendContainerGroup.append("text")
                        .attr("x", currentItemDrawX + legendHexSize + legendPadding)
                        .attr("y", lineCenterY) // 文本基线对齐到行中心线
                        .attr("dominant-baseline", "middle") // 确保文本垂直居中
                        .style("font-family", legendFontFamily)
                        .style("font-size", `${legendFontSize}px`)
                        .style("font-weight", legendFontWeight)
                        .style("fill", "#333") // 保持与X轴标签等文本颜色一致
                        .text(item.text);

                    // 更新下一个图例项的起始X坐标
                    if (itemIndex < line.items.length - 1) {
                         currentItemDrawX += item.visualWidth + legendInterItemSpacing;
                    }
                });
                currentLineBaseY += itemMaxHeight + interLineVerticalPadding; // 移动到下一行的顶部Y坐标
            });
        }
    }

    // ---------- 13. 添加时间点标签 ----------

    // 在顶部添加时间点标签
    timePoints.forEach(timePoint => {
        const availableWidthForTimeLabel = xScale.bandwidth();
        const initialLabelFontSize = parseFloat(typography.label.font_size);

        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            timePoint,
            availableWidthForTimeLabel,
            initialLabelFontSize,
            typography.label.font_family,
            typography.label.font_weight
        );

        g.append("text")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", -10) // 根据需要调整Y位置
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", adaptedTimeLabelFontSize + "px")
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(timePoint);
    });

    // 返回SVG节点
    return svg.node();
}
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_01",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group", "group2"],
    "hierarchy":["group2"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
    "required_fields_range": [
        [2, 30],
        [0, "inf"],
        [2, 2],
        [1, 10]
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

// 水平分离组条形图 (左右独立排序，固定宽度条，新标签布局，带连接线)
function makeChart(containerSelector, data) {
    // ---------- 1. 数据与配置 ----------
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#FFFFFF", // 条内标签默认白色
        field: {},
        available_colors: ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099"]
    };
    const dataColumns = jsonData.data.columns || [];

    variables.has_spacing = variables.has_spacing !== undefined ? variables.has_spacing : true;

    // 清空容器 & 创建文本测量上下文
    d3.select(containerSelector).html("");
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        return context.measureText(text).width;
    }

    // ---------- 2. 尺寸与边距 ----------
    const width = variables.width || 600;
    const height = variables.height || 600;
    const margin = { top: 90, right: 30, bottom: 60, left: 30 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // 布局: 左右图表区域和中心间隙 (35% / 30% / 35%)
    const leftChartWidthRatio = 0.35;
    const rightChartWidthRatio = 0.35;
    // const centerGapRatio = 0.3; // 中心间隙宽度由左右宽度确定
    const leftChartWidth = innerWidth * leftChartWidthRatio;
    const rightChartWidth = innerWidth * rightChartWidthRatio;
    const rightChartStartX = innerWidth - rightChartWidth;

    // ---------- 3. 字段提取 ----------
    const xColumn = dataColumns.find(col => col.role === "x");        // 类别字段 (如：国家)
    const yColumn = dataColumns.find(col => col.role === "y");        // 数值字段
   


    const categoryField = xColumn.name;
    const valueField = yColumn.name;
    const conditionField = dataColumns.filter(col => col.role === "group")[0].name;
    const colorField = dataColumns.filter(col => col.role === "group2")[0].name;
    let valueUnit = (yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    // ---------- 4. 数据处理与排序 ----------
    const conditions = [...new Set(chartData.map(d => d[conditionField]))];
    if (conditions.length !== 2) {
        console.error(`条件字段 '${conditionField}' 必须有2个唯一值`);
        return;
    }
    const conditionLeft = conditions[0];
    const conditionRight = conditions[1];

    const colorGroups = [...new Set(chartData.map(d => d[colorField]))];

    // 预处理数据，聚合左右两侧的值
    const processedData = {};
    chartData.forEach(d => {
        const cat = d[categoryField];
        if (!processedData[cat]) {
            processedData[cat] = { leftValue: null, rightValue: null, colorGroup: null };
        }
        if (d[conditionField] === conditionLeft) {
            processedData[cat].leftValue = +d[valueField] || 0;
        } else if (d[conditionField] === conditionRight) {
            processedData[cat].rightValue = +d[valueField] || 0;
        }
        processedData[cat].colorGroup = d[colorField]; // 假设同一类别的颜色组一致
    });

    // 基础数据数组，包含所有处理后的类别
    const baseData = Object.entries(processedData)
        .map(([category, values]) => ({ category, ...values }));

    // 分别过滤和排序左右两侧的数据
    const sortedDataLeft = baseData
        .filter(d => d.leftValue !== null)
        .sort((a, b) => b.leftValue - a.leftValue);

    const sortedDataRight = baseData
        .filter(d => d.rightValue !== null)
        .sort((a, b) => b.rightValue - a.rightValue);

    const sortedCategoriesLeft = sortedDataLeft.map(d => d.category);
    const sortedCategoriesRight = sortedDataRight.map(d => d.category);

    // ---------- 5. 比例尺与常量定义 ----------
    const maxCount = Math.max(sortedDataLeft.length, sortedDataRight.length); // Y轴基于最大条目数

    // 统一Y轴比例尺
    const unifiedYDomain = d3.range(maxCount);
    const yScale = d3.scaleBand()
        .domain(unifiedYDomain)
        .range([0, innerHeight])
        .padding(variables.has_spacing ? 0.2 : 0.15);

    // 颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(colorGroups)
        .range(colorGroups.map((cg, i) => colors.field[cg] || colors.available_colors[i % colors.available_colors.length]));

    // 条形尺寸与位置常量
    const barHeight = yScale.bandwidth();
    const barRadius = barHeight / 2;
    const fixedBarPixelWidth = leftChartWidth * 0.98; // 固定条形宽度
    const leftBarLeftEdge = 0; // 左侧条形左边缘
    const leftBarRightEdge = leftBarLeftEdge + fixedBarPixelWidth; // 左侧条形右边缘
    const rightBarRightEdge = innerWidth; // 右侧条形右边缘
    const rightBarLeftEdge = rightBarRightEdge - fixedBarPixelWidth; // 右侧条形左边缘

    // ---------- 6. SVG 容器与主分组 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", `max-width: 100%; height: auto; background-color: ${jsonData.colors?.background_color || 'transparent'};`)
        .attr("xmlns", "http://www.w3.org/2000/svg");

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // ---------- 7. 字体大小动态计算辅助函数 ----------
    function calculateScaledFontSize(initialSize, scaleFactor, minSize = 6) {
        return Math.max(minSize, initialSize * scaleFactor);
    }

    // ---------- 8. 标题与图例定位及绘制 (仅当有数据时) ----------
    const initialHeaderFontSize = parseFloat(typography.label?.font_size || 16);
    const headerFontFamily = typography.label?.font_family || "Arial";
    const headerFontWeight = typography.label?.font_weight || "bold";
    let finalHeaderFontSize = initialHeaderFontSize;
    let headerY = -margin.top + initialHeaderFontSize; // 无数据时的默认标题Y位置

    const initialLegendFontSize = parseFloat(typography.label?.font_size || 12);
    const legendFontWeight = typography.label?.font_weight || "normal";
    const legendFontFamily = typography.label?.font_family || "Arial";
    const legendColor = jsonData.colors?.text_color || "#333333";
    let legendSquareSize = 12;
    const legendItemPadding = 8;
    const legendColumnPadding = 20;
    let finalLegendFontSize = initialLegendFontSize;
    let legendY = headerY - finalLegendFontSize - 5; // 无数据时的默认图例Y位置
    let legendStartX = 0;
    const relevantColorGroups = [...new Set(baseData.map(d => d.colorGroup).filter(Boolean))]; // 有效的颜色分组

    if (maxCount > 0 && barHeight > 0) { // 确保有数据且条形高度有效
        // --- 标题尺寸与位置计算 ---
        let leftHeaderWidth = getTextWidth(conditionLeft, headerFontFamily, initialHeaderFontSize, headerFontWeight);
        let rightHeaderWidth = getTextWidth(conditionRight, headerFontFamily, initialHeaderFontSize, headerFontWeight);
        let headerScaleFactor = 1;
        if (leftHeaderWidth > leftChartWidth || rightHeaderWidth > rightChartWidth) {
            const scaleLeft = leftHeaderWidth > leftChartWidth ? leftChartWidth / leftHeaderWidth : 1;
            const scaleRight = rightHeaderWidth > rightChartWidth ? rightChartWidth / rightHeaderWidth : 1;
            headerScaleFactor = Math.min(scaleLeft, scaleRight) * 0.98; // 统一缩小比例
        }
        finalHeaderFontSize = calculateScaledFontSize(initialHeaderFontSize, headerScaleFactor);
        const headerPaddingBottom = 10;
        headerY = yScale(0) - headerPaddingBottom; // 标题在第一个条形上方

        // --- 图例尺寸与位置计算 ---
        if (relevantColorGroups.length > 0) {
            let totalLegendWidth = 0;
            relevantColorGroups.forEach((cg) => {
                const textWidth = getTextWidth(cg, legendFontFamily, initialLegendFontSize, legendFontWeight);
                totalLegendWidth += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
            });
            totalLegendWidth -= legendColumnPadding;

            let legendScaleFactor = 1;
            if (totalLegendWidth > innerWidth) {
                legendScaleFactor = (innerWidth / totalLegendWidth) * 0.98; // 统一缩小比例
            }
            finalLegendFontSize = calculateScaledFontSize(initialLegendFontSize, legendScaleFactor);
            legendSquareSize *= legendScaleFactor;

            // 重新计算最终图例宽度
            let finalLegendWidth = 0;
            relevantColorGroups.forEach((cg) => {
                const textWidth = getTextWidth(cg, legendFontFamily, finalLegendFontSize, legendFontWeight);
                finalLegendWidth += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
            });
            finalLegendWidth -= legendColumnPadding;

            legendStartX = (innerWidth - finalLegendWidth) / 2; // 水平居中
            const legendPaddingBottom = 5;
            legendY = headerY - finalHeaderFontSize - legendPaddingBottom; // 图例在标题上方

            // --- 绘制图例 ---
            const legendGroup = g.append("g")
                .attr("class", "chart-legend")
                .attr("transform", `translate(${legendStartX}, ${legendY})`);

            let currentLegendX = 0;
            relevantColorGroups.forEach((cg) => {
                const color = colorScale(cg);
                const textWidth = getTextWidth(cg, legendFontFamily, finalLegendFontSize, legendFontWeight);
                const itemWidth = legendSquareSize + legendItemPadding + textWidth;
                const legendItem = legendGroup.append("g")
                    .attr("transform", `translate(${currentLegendX}, 0)`);

                legendItem.append("rect")
                    .attr("x", 0)
                    .attr("y", -legendSquareSize / 2)
                    .attr("width", legendSquareSize)
                    .attr("height", legendSquareSize)
                    .attr("fill", color);

                legendItem.append("text")
                    .attr("x", legendSquareSize + legendItemPadding)
                    .attr("y", 0)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", legendFontFamily)
                    .style("font-size", `${finalLegendFontSize}px`)
                    .style("font-weight", legendFontWeight)
                    .style("fill", legendColor)
                    .text(cg);

                currentLegendX += itemWidth + legendColumnPadding;
            });
        } // end if relevantColorGroups

        // --- 绘制标题 ---
        g.append("text")
            .attr("class", "header-left")
            .attr("x", 0)
            .attr("y", headerY)
            .attr("text-anchor", "start")
            .style("font-family", headerFontFamily)
            .style("font-size", `${finalHeaderFontSize}px`)
            .style("font-weight", headerFontWeight)
            .style("fill", jsonData.colors?.text_color || "#333333")
            .text(conditionLeft);

        g.append("text")
            .attr("class", "header-right")
            .attr("x", innerWidth)
            .attr("y", headerY)
            .attr("text-anchor", "end")
            .style("font-family", headerFontFamily)
            .style("font-size", `${finalHeaderFontSize}px`)
            .style("font-weight", headerFontWeight)
            .style("fill", jsonData.colors?.text_color || "#333333")
            .text(conditionRight);
    } // end if maxCount > 0

    // ---------- 9. 条形、连接线、标签 ----------

    // 辅助函数：生成圆角矩形路径
    function roundedRectPath(x, y, width, height, radius) {
        const r = Math.min(radius, height / 2);
        if (width <= 0 || height <= 0) return ""; // 避免无效路径
        return `M${x + r},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height - r} A${r},${r} 0 0 1 ${x + width - r},${y + height} H${x + r} A${r},${r} 0 0 1 ${x},${y + height - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y}`;
    }

    // --- 计算条内标签最终字体大小 ---
    const labelPadding = 8;
    const initialLabelFontSize = calculateScaledFontSize(parseFloat(typography.annotation?.font_size || 12), 1);
    // 初始目标字体大小：基于条高，但不超过20px
    const targetLabelFontSize = barHeight > 0 ? Math.min(20, Math.max(barHeight * 0.6, initialLabelFontSize)) : initialLabelFontSize;
    const labelFontWeight = typography.annotation?.font_weight || "normal";
    const labelFontFamily = typography.annotation?.font_family || "Arial";
    const labelColor = colors.text_color || "#FFFFFF";

    let finalLabelFontSize = targetLabelFontSize;
    let maxLeftValueWidth = 0; // 用于左侧标签对齐
    let maxRightValueWidth = 0; // 用于右侧标签对齐

    if (maxCount > 0 && barHeight > 0) { // 仅当有数据和有效条高时计算缩放
        let maxRequiredWidthLeft = 0;
        sortedDataLeft.forEach(d => {
            const valueText = d.leftValue.toFixed() + valueUnit;
            const valueWidth = getTextWidth(valueText, labelFontFamily, targetLabelFontSize, labelFontWeight);
            const nameWidth = getTextWidth(d.category, labelFontFamily, targetLabelFontSize, labelFontWeight);
            maxRequiredWidthLeft = Math.max(maxRequiredWidthLeft, labelPadding + valueWidth + labelPadding + nameWidth + labelPadding);
        });

        let maxRequiredWidthRight = 0;
        sortedDataRight.forEach(d => {
            const valueText = d.rightValue.toFixed() + valueUnit;
            const valueWidth = getTextWidth(valueText, labelFontFamily, targetLabelFontSize, labelFontWeight);
            const nameWidth = getTextWidth(d.category, labelFontFamily, targetLabelFontSize, labelFontWeight);
            maxRequiredWidthRight = Math.max(maxRequiredWidthRight, labelPadding + nameWidth + labelPadding + valueWidth + labelPadding);
        });

        let labelScaleFactor = 1;
        if (maxRequiredWidthLeft > fixedBarPixelWidth) {
            labelScaleFactor = Math.min(labelScaleFactor, (fixedBarPixelWidth / maxRequiredWidthLeft) * 0.98);
        }
        if (maxRequiredWidthRight > fixedBarPixelWidth) {
            labelScaleFactor = Math.min(labelScaleFactor, (fixedBarPixelWidth / maxRequiredWidthRight) * 0.98);
        }
        finalLabelFontSize = calculateScaledFontSize(targetLabelFontSize, labelScaleFactor);

        // 重新计算用于对齐的最大宽度
        sortedDataLeft.forEach(d => {
            const text = d.leftValue.toFixed() + valueUnit;
            maxLeftValueWidth = Math.max(maxLeftValueWidth, getTextWidth(text, labelFontFamily, finalLabelFontSize, labelFontWeight));
        });
        sortedDataRight.forEach(d => {
            const text = d.rightValue.toFixed() + valueUnit;
            maxRightValueWidth = Math.max(maxRightValueWidth, getTextWidth(text, labelFontFamily, finalLabelFontSize, labelFontWeight));
        });
    }

    // --- 绘制连接线 ---
    if (maxCount > 0 && barHeight > 0) {
        g.append("g")
            .attr("class", "connectors")
            .selectAll("path.connector")
            .data(baseData.filter(d => d.leftValue !== null && d.rightValue !== null)) // 仅连接两侧都有数据的类别
            .enter()
            .append("path")
            .attr("class", "connector")
            .attr("d", d => {
                const category = d.category;
                const indexLeft = sortedCategoriesLeft.indexOf(category);
                const indexRight = sortedCategoriesRight.indexOf(category);
                if (indexLeft === -1 || indexRight === -1) return null; // 确保类别在两侧都存在

                const yPosLeft = yScale(indexLeft);
                const yPosRight = yScale(indexRight);
                if (yPosLeft === undefined || yPosRight === undefined) return null;

                // 连接点位于条形主体与圆角的切点
                const leftConnectX = leftBarLeftEdge + fixedBarPixelWidth - barRadius;
                const rightConnectX = rightBarLeftEdge + barRadius;
                return `M${leftConnectX},${yPosLeft} L${rightConnectX},${yPosRight} L${rightConnectX},${yPosRight + barHeight} L${leftConnectX},${yPosLeft + barHeight} Z`;
            })
            .attr("fill", d => colorScale(d.colorGroup));
    }

    // --- 绘制左侧条形与标签 ---
    if (maxCount > 0 && barHeight > 0) {
        sortedDataLeft.forEach((d) => {
            const category = d.category;
            const index = sortedCategoriesLeft.indexOf(category);
            const yPos = yScale(index);
            if (yPos === undefined || index === -1) {
                 console.warn(`左侧类别 '${category}' 在Y轴上无位置`);
                 return;
            }
            const color = colorScale(d.colorGroup);
            const leftVal = d.leftValue;

            // 绘制条形
            g.append("path")
                .attr("class", "bar-left")
                .attr("d", roundedRectPath(leftBarLeftEdge, yPos, fixedBarPixelWidth, barHeight, barRadius))
                .attr("fill", color);

            // 绘制标签 (如果字体够大)
            if (finalLabelFontSize >= 6) {
                const leftValueText = leftVal.toFixed() + valueUnit;
                const leftNameText = category;

                // 值标签 (左对齐)
                g.append("text")
                    .attr("class", "label-left-value")
                    .attr("x", leftBarLeftEdge + labelPadding)
                    .attr("y", yPos + barHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", labelFontFamily)
                    .style("font-size", `${finalLabelFontSize}px`)
                    .style("font-weight", labelFontWeight)
                    .style("fill", labelColor)
                    .text(leftValueText);

                // 类别标签 (左对齐，在值标签右侧)
                g.append("text")
                    .attr("class", "label-left-name")
                    .attr("x", leftBarLeftEdge + labelPadding + maxLeftValueWidth + labelPadding) // 基于最大值宽度定位
                    .attr("y", yPos + barHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "start")
                    .style("font-family", labelFontFamily)
                    .style("font-size", `${finalLabelFontSize}px`)
                    .style("font-weight", labelFontWeight)
                    .style("fill", labelColor)
                    .text(leftNameText);
            }
        });
    }

    // --- 绘制右侧条形与标签 ---
    if (maxCount > 0 && barHeight > 0) {
        sortedDataRight.forEach((d) => {
            const category = d.category;
            const index = sortedCategoriesRight.indexOf(category);
            const yPos = yScale(index);
             if (yPos === undefined || index === -1) {
                 console.warn(`右侧类别 '${category}' 在Y轴上无位置`);
                 return;
            }
            const color = colorScale(d.colorGroup);
            const rightVal = d.rightValue;

            // 绘制条形
            g.append("path")
                .attr("class", "bar-right")
                .attr("d", roundedRectPath(rightBarLeftEdge, yPos, fixedBarPixelWidth, barHeight, barRadius))
                .attr("fill", color);

            // 绘制标签 (如果字体够大)
            if (finalLabelFontSize >= 6) {
                const rightValueText = rightVal.toFixed() + valueUnit;
                const rightNameText = category;

                // 值标签 (右对齐)
                g.append("text")
                    .attr("class", "label-right-value")
                    .attr("x", rightBarRightEdge - labelPadding)
                    .attr("y", yPos + barHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "end")
                    .style("font-family", labelFontFamily)
                    .style("font-size", `${finalLabelFontSize}px`)
                    .style("font-weight", labelFontWeight)
                    .style("fill", labelColor)
                    .text(rightValueText);

                // 类别标签 (右对齐，在值标签左侧)
                g.append("text")
                    .attr("class", "label-right-name")
                    .attr("x", rightBarRightEdge - labelPadding - maxRightValueWidth - labelPadding) // 基于最大值宽度定位
                    .attr("y", yPos + barHeight / 2)
                    .attr("dominant-baseline", "middle")
                    .attr("text-anchor", "end")
                    .style("font-family", labelFontFamily)
                    .style("font-size", `${finalLabelFontSize}px`)
                    .style("font-weight", labelFontWeight)
                    .style("fill", labelColor)
                    .text(rightNameText);
            }
        });
    }

    // ---------- 11. 返回 SVG 节点 ----------
    return svg.node();
}
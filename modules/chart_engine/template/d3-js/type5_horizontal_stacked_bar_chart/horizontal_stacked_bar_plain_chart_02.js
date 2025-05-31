/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Stacked Bar Chart",
    "chart_name": "horizontal_stacked_bar_plain_chart_02",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 4]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
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

// 水平堆叠条形图实现 - 使用D3.js  Horizontal Stacked Bar Chart  plain chart#2（圆角）
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------

// 提取数据和配置
const jsonData = data;                       // 完整的JSON数据对象
const chartData = jsonData.data.data;        // 实际数据点数组  
const variables = jsonData.variables || {};  // 图表配置
const typography = jsonData.typography || {  // 字体设置，如果不存在则使用默认值
    title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
    label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
    description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
    annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
};
const colors = jsonData.colors || { 
    text_color: "#333333",
    other: { 
        primary: "#D32F2F",    // Red for "Still active"
        secondary: "#AAAAAA",  // Gray for "Ended"
        background: "#F0F0F0" 
    }
};  // 颜色设置
const dataColumns = jsonData.data.columns || []; // 数据列定义

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

// 设置视觉效果变量的默认值
variables.has_shadow = variables.has_shadow || false;
variables.has_stroke = variables.has_stroke || false;

// 清空容器
d3.select(containerSelector).html("");

// ---------- 2. 尺寸和布局设置 ----------

// 设置图表总尺寸
const width = variables.width || 600;
const height = variables.height || 400;

// 设置边距
const margin = {
    top: 50,
    right: 30,
    bottom: 80,
    left: 200
};

// 计算实际绘图区域大小
const chartWidth = width - margin.left - margin.right;
const chartHeight = height - margin.top - margin.bottom;

// ---------- 3. 提取字段名和单位 ----------

// 根据数据列获取字段名
const xField = dataColumns.find(col => col.role === "x")?.name || "period";
const yField = dataColumns.find(col => col.role === "y")?.name || "value";
const groupField = dataColumns.find(col => col.role === "group")?.name || "status";

// 获取字段单位（如果存在）
let xUnit = "";
let yUnit = "";
let groupUnit = "";

if (dataColumns.find(col => col.role === "x")?.unit !== "none") {
    xUnit = dataColumns.find(col => col.role === "x").unit;
}

if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
    yUnit = dataColumns.find(col => col.role === "y").unit;
}

if (dataColumns.find(col => col.role === "group")?.unit !== "none") {
    groupUnit = dataColumns.find(col => col.role === "group").unit;
}

// ---------- 4. 数据处理 ----------

// 获取所有唯一的组值
const groups = Array.from(new Set(chartData.map(d => d[groupField])));

// 处理数据为堆叠格式
const groupedData = d3.group(chartData, d => d[xField]);
const processedData = Array.from(groupedData, ([key, values]) => {
    const obj = { period: key };
    groups.forEach(group => {
        obj[group] = d3.sum(values.filter(d => d[groupField] === group), d => +d[yField]);
    });
    obj.total = d3.sum(values, d => +d[yField]);
    return obj;
});

// 创建堆叠生成器
const stack = d3.stack()
    .keys(groups)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

// 生成堆叠数据
const stackedData = stack(processedData);

// ---------- 5. 创建比例尺 ----------

// Y轴比例尺 - 使用时间段作为分类
const yScale = d3.scaleBand()
    .domain(processedData.map(d => d.period))
    .range([chartHeight, 0])
    .padding(0.3);

// X轴比例尺 - 使用数值
const xScale = d3.scaleLinear()
    .domain([0, d3.max(processedData, d => d.total)])
    .range([0, chartWidth])
    .nice();

// 根据colors.field的值，获取对应的color
let group_colors = []
for (let i = 0; i < groups.length; i++) {
    group_colors.push(colors.field[groups[i]])
}
// 颜色比例尺
const colorScale = d3.scaleOrdinal()
    .domain(groups)
    .range(group_colors)



// ---------- 6. 创建SVG容器 ----------

const svg = d3.select(containerSelector)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("style", "max-width: 100%; height: auto;")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

// 添加图表主体容器
const chartGroup = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

// ---------- 7. 绘制图表元素 ----------

// 绘制堆叠的条形
const layers = chartGroup.selectAll(".layer")
    .data(stackedData)
    .enter().append("g")
    .attr("class", "layer")
    .style("fill", (d) => colorScale(d.key));

layers.selectAll("path")
    .data(d => d)
    .enter().append("path")
    .attr("d", d => {
        const xPos = xScale(d[0]);
        const yPos = yScale(d.data.period);
        const segmentWidth = xScale(d[1]) - xScale(d[0]);
        const barHeight = yScale.bandwidth();
        const isRightmost = Math.abs(d[1] - d.data.total) < 1e-9; // Epsilon for float comparison

        if (segmentWidth <= 1e-9) return ""; // 避免绘制零宽度或负宽度段

        if (isRightmost) {
            // 对于最右侧的段，总是尝试绘制右侧半圆形（或适应的椭圆弧）
            return createRightSemicirclePath(xPos, yPos, segmentWidth, barHeight, barHeight / 2);
        } else {
            // 内部段或太窄的最右段的标准矩形
            return `M${xPos},${yPos} L${xPos + segmentWidth},${yPos} L${xPos + segmentWidth},${yPos + barHeight} L${xPos},${yPos + barHeight} Z`;
        }
    })
    .style("stroke", variables.has_stroke ? "#ffffff" : "none")
    .style("stroke-width", variables.has_stroke ? 1 : 0);

// 添加数值标注
layers.selectAll("text")
    .data(d => d)
    .enter().append("text")
    .attr("y", d => yScale(d.data.period) + yScale.bandwidth() / 2)
    .attr("x", d => {
        const width = xScale(d[1]) - xScale(d[0]);
        return xScale(d[0]) + width / 2;
    })
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("fill", "#ffffff")
    .style("font-family", typography.annotation.font_family)
    .style("font-size", typography.annotation.font_size)
    .text(d => {
        const value = d[1] - d[0];
        const width = xScale(d[1]) - xScale(d[0]);
        const formattedText = `${formatValue(value)}${yUnit}`;
        const textwidth = getTextWidth(formattedText, typography.annotation.font_size);
        // 只在宽度大于文本宽度且值大于0时显示文本
        return (width > textwidth && value > 0) ? formattedText : '';
    });

// 添加X轴
const xAxis = chartGroup.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${chartHeight})`)
    .call(d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(10))
    .call(g => g.select(".domain").remove())
    .selectAll("text")
    .remove();

// 添加Y轴
const yAxis = chartGroup.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat(d => d))
    .call(g => g.select(".domain").remove())
yAxis.selectAll("text")
    .style("text-anchor", "end")
    .style("font-family", typography.label.font_family)
    .style("font-size", typography.label.font_size)
    .style("fill", colors.text_color);

let bandWidth = yScale.bandwidth()
let iconSize = yScale.bandwidth()*0.7
let iconPadding = 10;
// 添加文本和图标
yAxis.selectAll(".tick").each(function(d) {
    const tick = d3.select(this);
    if(jsonData.images && jsonData.images.field[d]) {
        tick.append("image")
            .attr("x", - iconSize - iconPadding)  // 10是原有的padding
            .attr("y", -iconSize/2)
            .attr("width", iconSize)
            .attr("height", iconSize)
            .attr("xlink:href", jsonData.images.field[d]);
        tick.select("text")
            .style("text-anchor", "end") 
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .attr("x", -iconSize-2*iconPadding)
    }
});

// 辅助函数：获取文本宽度
function getTextWidth(text, fontFamily, fontSize, fontWeight) {
    const tempText = svg.append("text")
        .attr("x", -1000) // 放在视图外
        .attr("y", -1000)
        .style("font-family", fontFamily)
        .style("font-size", fontSize + "px")
        .style("font-weight", fontWeight)
        .text(text);
    
    const width = tempText.node().getBBox().width;
    tempText.remove();
    return width;
}

// 水平条形图右侧半圆路径生成函数
function createRightSemicirclePath(x, y, barWidth, barHeight, radius) {
    // x, y: bar的左上角坐标
    // barWidth: bar的宽度
    // barHeight: bar的高度
    // radius: 半圆的半径 (通常是 barHeight / 2)

    if (barWidth <= 1e-9) return ""; // 避免绘制零宽度或负宽度段

    if (barWidth >= radius) {
        // 宽度足以容纳一个矩形部分和一个完整的半圆
        const rectPartWidth = barWidth - radius;
        return `M${x},${y}` + // 移动到左上角
               `L${x + rectPartWidth},${y}` + // 画到矩形部分的右上角
               `A${radius},${radius} 0 0,1 ${x + rectPartWidth},${y + barHeight}` + // 画右侧半圆弧
               `L${x},${y + barHeight}` + // 画到底部左边
               `Z`; // 关闭路径
    } else {
        // barWidth < radius. 条形太窄，无法形成完整的半圆。
        // 右端将是一个椭圆弧。x方向的"半径"是barWidth，y方向的"半径"是radius (barHeight / 2)。
        const arcRx = barWidth;
        const arcRy = radius; // 等于 barHeight / 2

        // 画一个向右凸出的椭圆弧，从左上角到左下角，最右端到达 x + barWidth
        return `M${x},${y}` + // 从左上角开始
               `A${arcRx},${arcRy} 0 1,1 ${x},${y + barHeight}` + // 画大弧，向右凸出
               `Z`; // 关闭路径
    }
}

/* ============ 4. 添加动态图例 ============ */
// 支持图例换行并且居中，并且能够让图例刚好在chart上方
if (groups && groups.length > 0) {
    const legendMarkerWidth = 12; // 图例标记宽度
    const legendMarkerHeight = 12; // 图例标记高度
    const legendMarkerRx = 3; // 图例标记圆角X
    const legendMarkerRy = 3; // 图例标记圆角Y
    const legendPadding = 6; // 图例标记和文本之间的间距
    const legendInterItemSpacing = 12; // 图例项之间的水平间距
    
    const legendFontFamily = typography.label.font_family || 'Arial'; // 图例字体
    const legendFontSize = parseFloat(typography.label.font_size || '11'); // 图例字号
    const legendFontWeight = typography.label.font_weight || 'normal'; // 图例字重
    const primaryColor = colors.other && colors.other.primary ? colors.other.primary : "#F7941D";

    // 1. 准备图例项数据
    const legendItemsData = groups.map(group => {
        const text = String(group);
        const color = colors.field?.[group] || primaryColor;
        const textWidth = getTextWidth(text, legendFontFamily, legendFontSize, legendFontWeight);
        // visualWidth 是单个图例项（标记+间距+文本）的实际显示宽度
        const visualWidth = legendMarkerWidth + legendPadding + textWidth;
        return { text, color, visualWidth };
    });

    // 2. 将图例项排列成行
    const legendLines = [];
    let currentLineItems = [];
    let currentLineVisualWidth = 0; // 当前行已占用的视觉宽度
    // 图例换行的可用宽度，基于图表主体绘图区
    const availableWidthForLegendWrapping = chartWidth;

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
        const itemMaxHeight = Math.max(legendMarkerHeight, legendFontSize); // 单行图例内容的最大高度
        const interLineVerticalPadding = 6; // 图例行之间的垂直间距
        const paddingBelowLegendToChart = 15; // 图例块底部与图表顶部的间距
        const minSvgGlobalTopPadding = 15; // SVG顶部到图例块的最小间距

        const totalLegendBlockHeight = legendLines.length * itemMaxHeight + Math.max(0, legendLines.length - 1) * interLineVerticalPadding;
        
        let legendBlockStartY = margin.top - paddingBelowLegendToChart - totalLegendBlockHeight;
        legendBlockStartY = Math.max(minSvgGlobalTopPadding, legendBlockStartY); // 确保不超出SVG顶部

        const legendContainerGroup = svg.append("g").attr("class", "custom-legend-container");

        // 4. 渲染每一行图例
        let currentLineBaseY = legendBlockStartY; // 当前渲染行的顶部Y坐标
        legendLines.forEach((line) => {
            // 每一行在整个SVG中水平居中
            const lineRenderStartX = (width - line.totalVisualWidth) / 2;
            const lineCenterY = currentLineBaseY + itemMaxHeight / 2; // 用于文本垂直居中

            let currentItemDrawX = lineRenderStartX; // 当前图例项的起始X坐标

            line.items.forEach((item, itemIndex) => {
                // 绘制图例标记 (矩形)
                legendContainerGroup.append("rect")
                    .attr("x", currentItemDrawX)
                    .attr("y", currentLineBaseY + (itemMaxHeight - legendMarkerHeight) / 2) // 使标记在行高内垂直居中
                    .attr("width", legendMarkerWidth)
                    .attr("height", legendMarkerHeight)
                    .attr("rx", legendMarkerRx)
                    .attr("ry", legendMarkerRy)
                    .attr("fill", item.color)
                    .attr("fill-opacity", 0.85); // 与柱状图透明度协调或略作区分

                // 绘制图例文本
                legendContainerGroup.append("text")
                    .attr("x", currentItemDrawX + legendMarkerWidth + legendPadding)
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

        // 添加字段名称 - 居中于图例上方
        const groupNameText = svg.append("text")
            .attr("x", width / 2)
            .attr("y", legendBlockStartY - 10) // 放在图例上方，保持间距
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "alphabetic")
            .attr("fill", "#333")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(groupField);
    }
}

return svg.node();
}
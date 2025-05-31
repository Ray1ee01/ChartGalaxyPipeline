/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Circular Bar Chart",
    "chart_name": "circular_bar_plain_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke"],
    "min_height": 500,
    "min_width": 500,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------

    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#333333",
        other: { primary: "#084594" }
    };
    const dataColumns = jsonData.data.columns || [];

    // 视觉效果默认值
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;

    // 清空容器
    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------

    const width = variables.width || 800;
    const height = variables.height || 800;
    const size = Math.min(width, height);

    const margin = {
        top: 90,
        right: 50,
        bottom: 60,
        left: 50
    };

    const innerWidth = size - margin.left - margin.right;
    const innerHeight = size - margin.top - margin.bottom;

    const centerX = margin.left + innerWidth / 2;
    const centerY = margin.top + innerHeight / 2;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    // ---------- 3. 提取字段名和单位 ----------

    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "category";
    const valueField = dataColumns.find(col => col.role === "y")?.name || "value";

    // 单位
    let valueUnit = "";
    const valueCol = dataColumns.find(col => col.role === "y");
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit === "B" ? " B" : valueCol.unit;
    }

    // ---------- 4. 数据处理 ----------

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

    // 按值降序排序数据
    chartData.sort((a, b) => b[valueField] - a[valueField]);

    const totalItems = chartData.length;
    if (totalItems === 0) return;

    const anglePerItem = (2 * Math.PI) / totalItems;
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const minValue = 0;

    // ---------- 5. 创建SVG和效果定义 ----------

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const defs = svg.append("defs");

    // 阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("x", -innerWidth/2).attr("y", -innerHeight/2)
            .attr("width", innerWidth*2).attr("height", innerHeight*2);
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 4);
        filter.append("feOffset").attr("dx", 3).attr("dy", 3).attr("result", "offsetblur");
        filter.append("feFlood").attr("flood-color", "#000").attr("flood-opacity", 0.3);
        filter.append("feComposite").attr("in2", "offsetblur").attr("operator", "in");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // 定义主颜色
    const primaryColor = colors.other.primary;

    // ---------- 6. 创建比例尺 ----------

    const centralCircleRadius = radius * 0.25;
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([centralCircleRadius + 20, radius * 0.9]);

    // 颜色比例尺 - 值越高颜色越深
    const lightColor = d3.rgb(primaryColor).brighter(0.5);
    const darkColor = d3.rgb(primaryColor).darker(0.5);
    const colorInterpolator = d3.interpolateRgb(lightColor, darkColor);
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([totalItems - 1, 0]);

    // ---------- 7. 创建中心圆和背景 ----------

    svg.append("circle")
        .attr("class", "background")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", "#ffffff")
        .attr("stroke", "#aaaaaa")
        .attr("stroke-width", 1.5);

    // ---------- 8. 创建扇形、端点圆和标签 ----------

    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius)
        .padAngle(0.02);

    const sectorsGroup = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const labelsGroup = svg.append("g")
         .attr("transform", `translate(${centerX}, ${centerY})`);

    // 遍历排序后的数据来创建元素
    chartData.forEach((d, i) => {
        const value = +d[valueField];
        const category = d[dimensionField];

        const startAngle = (i * anglePerItem);
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;

        const currentOuterRadius = radiusScale(value);

        // --- 8a. 绘制扇形 ---
        sectorsGroup.append("path")
            .datum({
                innerRadius: centralCircleRadius,
                outerRadius: currentOuterRadius,
                startAngle: startAngle,
                endAngle: endAngle
            })
            .attr("class", "mark")
            .attr("d", arcGenerator)
            .attr("fill", colorScale(i)) 
            .attr("stroke", variables.has_stroke ? d3.rgb(colorScale(i)).darker(0.5) : "none")
            .attr("stroke-width", variables.has_stroke ? 1 : 0)
            .attr("style", variables.has_shadow ? "filter: url(#shadow)" : null)
            .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

        // --- 8b. 计算末端圆圈位置 ---
        const endCircleX = Math.sin(midAngle) * currentOuterRadius;
        const endCircleY = -Math.cos(midAngle) * currentOuterRadius;
        const endCircleRadius = Math.max(12, Math.min(30, radius * 0.1 * (value / maxValue * 2 + 0.5)));

        // --- 8c. 绘制末端圆圈 ---
        sectorsGroup.append("circle")
            .attr("class", "background")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadius)
            .attr("fill", colorScale(i))
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1)
            .attr("style", variables.has_shadow ? "filter: url(#shadow)" : null);

        // --- 8d. 在末端圆圈内添加数值文本 ---
        const valueText = `${formatValue(value)}${valueUnit}`;
        let valueFontSize = endCircleRadius * 0.9;
        if (valueText.length * valueFontSize * 0.6 > endCircleRadius * 1.8) {
            valueFontSize = endCircleRadius * 1.8 / (valueText.length * 0.6); 
        }

        sectorsGroup.append("text")
            .attr("class", "value")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.annotation.font_family)
            .attr("font-size", `${valueFontSize}px`)
            .attr("font-weight", "bold")
            .attr("fill", "#ffffff")
            .text(valueText);

        // --- 8e. 计算外部标签位置 ---
        const labelPadding = 20;
        const labelRadius = currentOuterRadius + endCircleRadius + labelPadding;
        const labelX = Math.sin(midAngle) * labelRadius;
        const labelY = -Math.cos(midAngle) * labelRadius;

        // --- 8f. 添加类别文本标签 ---
        labelsGroup.append("text")
            .attr("class", "label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.label.font_family)
            .attr("font-size", typography.label.font_size)
            .attr("font-weight", typography.label.font_weight)
            .attr("fill", colors.text_color)
            .text(category);
    });

    return svg.node();
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Circular Bar Chart",
    "chart_name": "circular_bar_chart_04",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[5,10], [0, "inf"]],
    "required_fields_icons": ["x"],
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

    // 数值单位规范
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

    // 清空容器
    d3.select(containerSelector).html("");

    // ---------- 2. 尺寸和布局设置 ----------
    const width = variables.width || 800;
    const height = variables.height || 800;
    const size = Math.min(width, height);

    const margin = {
        top: 100,
        right: 100,
        bottom: 100,
        left: 100
    };

    const innerWidth = size - margin.left - margin.right;
    const innerHeight = size - margin.top - margin.bottom;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    // ---------- 3. 提取字段名 ----------
    const dimensionField = jsonData.data.columns.find(col => col.role === "x")?.name || "category";
    const valueField = jsonData.data.columns.find(col => col.role === "y")?.name || "value";
    
    // 获取单位信息
    let valueUnit = "";
    const valueCol = jsonData.data.columns.find(col => col.role === "y");
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit;
    }
    if (valueUnit.length > 6) {
        valueUnit = ''
    }

    // ---------- 4. 数据处理 ----------
    const totalItems = chartData.length;
    if (totalItems === 0) return;

    const anglePerItem = (2 * Math.PI) / totalItems;
    
    // 添加：计算最大值用于比例尺
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const minValue = 0;

    // 添加：创建半径比例尺
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([radius * 0.4, radius * 0.8]); // 最小40%到最大80%的半径范围

    // ---------- 5. 创建SVG ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`)
        .attr("style", "max-width: 100%; height: auto;");

    // ---------- 6. 定义颜色 ----------
    const getColor = (i) => {
        // 左半部分使用深灰色，右半部分使用浅色
        if (i >= totalItems / 2) {
            return "#4a4a4a"; // 深灰色
        }
        return "#ffffff"; // 白色
    };

    // ---------- 7. 创建中心圆 ----------
    const centralCircleRadius = radius * 0.2;
    svg.append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", "none")
        .attr("stroke", "#4a4a4a")
        .attr("stroke-width", 1);

    // ---------- 8. 创建扇形和标签 ----------
    const sectorsGroup = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const labelsGroup = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // 扇区的弧生成器
    const arcGenerator = d3.arc()
        .innerRadius(centralCircleRadius)
        .outerRadius(d => radiusScale(+d.value)) // 使用比例尺计算外半径
        .cornerRadius(10)
        .padAngle(0.04);
    const outerArcGenerator = d3.arc()
        .innerRadius(centralCircleRadius)
        .outerRadius(radius)
        .cornerRadius(10)
        .padAngle(0.04);

    // 标签的弧生成器（用于计算标签位置）
    const labelArc = d3.arc()
        .innerRadius(radius * 0.85)
        .outerRadius(radius * 0.85);

    // 遍历数据创建扇形和标签
    chartData.forEach((d, i) => {
        const startAngle = i * anglePerItem - Math.PI / 2;
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;


        sectorsGroup.append("path")
            .attr("d", outerArcGenerator({
                startAngle: startAngle,
                endAngle: endAngle
            }))
            .attr("fill", "#59575a")
            .style("stroke", "none")
            .style("stroke-width", 0);

        // 创建扇形，添加value属性
        sectorsGroup.append("path")
            .datum({
                startAngle: startAngle,
                endAngle: endAngle,
                value: d[valueField] // 添加value属性供arcGenerator使用
            })
            .attr("d", arcGenerator)
            .attr("fill", "#dcd5dd")
            .attr("stroke", "none")
            .attr("stroke-width", 0);

        // 计算标签位置时也使用动态半径
        const currentRadius = radiusScale(+d[valueField]);
        const labelX = Math.sin(midAngle) * (radius - 30);
        const labelY = -Math.cos(midAngle) * (radius - 30);

        // 添加类别标签
        labelsGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.label.font_family)
            .attr("font-size", "14px")
            .attr("fill", "#000000")
            .text(d[dimensionField]);

        // 添加数值，位置在扇区中间
        const valueX = labelX;
        const valueY = labelY+20;
        
        // 使用formatValue格式化数值并添加单位
        const formattedValue = `${formatValue(d[valueField])}${valueUnit}`;
        
        labelsGroup.append("text")
            .attr("x", valueX)
            .attr("y", valueY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.annotation.font_family)
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .attr("fill", "#000000")
            .text(formattedValue);
    });

    return svg.node();
}
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stacked Circular Bar Chart",
    "chart_name": "stacked_circular_bar_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 20], [0, "inf"], [2, 10]],
    "required_fields_icons": ["x", "group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
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
    const images = jsonData.images || {};
    const dataColumns = jsonData.data.columns || [];

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
    const groupField = dataColumns.find(col => col.role === "group")?.name || "group";

    // 单位
    let valueUnit = "";
    const valueCol = dataColumns.find(col => col.role === "y");
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit === "B" ? " B" : valueCol.unit;
    }

    // ---------- 4. 数据处理 ----------
    // 获取所有唯一的组
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 按类别分组并计算堆叠值
    const groupedData = d3.group(chartData, d => d[dimensionField]);
    const stackedData = Array.from(groupedData, ([category, values]) => {
        const stack = {};
        let total = 0;
        groups.forEach(group => {
            const groupValue = values.find(v => v[groupField] === group)?.[valueField] || 0;
            stack[group] = {
                start: total,
                end: total + groupValue,
                value: groupValue
            };
            total += groupValue;
        });
        return {
            category,
            stacks: stack,
            total
        };
    });

    // 按总值降序排序
    stackedData.sort((a, b) => b.total - a.total);

    const totalItems = stackedData.length;
    if (totalItems === 0) return;

    // 修改为270度（1.5π）而不是360度（2π）
    const anglePerItem = (1.5 * Math.PI) / totalItems;
    const maxValue = d3.max(stackedData, d => d.total);

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

    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("x", -innerWidth/2)
            .attr("y", -innerHeight/2)
            .attr("width", innerWidth*2)
            .attr("height", innerHeight*2);
        filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 4);
        filter.append("feOffset").attr("dx", 3).attr("dy", 3).attr("result", "offsetblur");
        filter.append("feFlood").attr("flood-color", "#000").attr("flood-opacity", 0.3);
        filter.append("feComposite").attr("in2", "offsetblur").attr("operator", "in");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // ---------- 6. 创建比例尺 ----------
    const centralCircleRadius = radius * 0.25;
    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([(centralCircleRadius + 20) / 2, radius * 0.9]);

    // 为每个组创建颜色
    const groupColors = {};
    groups.forEach((group, i) => {
        const baseColor = colors.fields?.[group] || colors.other.primary;
        groupColors[group] = colors.field[group]
    });

    // ---------- 7. 创建中心圆和背景 ----------
    // 移除中心圆，不需要以下代码
    // svg.append("circle")
    //     .attr("cx", centerX)
    //     .attr("cy", centerY)
    //     .attr("r", centralCircleRadius)
    //     .attr("fill", "#ffffff")
    //     .attr("stroke", "#aaaaaa")
    //     .attr("stroke-width", 1.5);

    // ---------- 8. 创建堆叠扇形 ----------
    const sectorsGroup = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    const labelsGroup = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    stackedData.forEach((d, i) => {
        const startAngle = i * anglePerItem;
        const endAngle = startAngle + anglePerItem;
        const midAngle = startAngle + anglePerItem / 2;

        // 为每个组创建堆叠的扇形
        groups.forEach(group => {
            const stack = d.stacks[group];
            if (stack.value > 0) {
                // 由于移除了中心圆，可以将内半径设为较小值或0
                const innerRadius = Math.max(5, radiusScale(stack.start));
                const outerRadius = radiusScale(stack.end);

                const arcGenerator = d3.arc()
                    .innerRadius(innerRadius)
                    .outerRadius(outerRadius)
                    .startAngle(startAngle)
                    .endAngle(endAngle)
                    .padAngle(0.02);

                sectorsGroup.append("path")
                    .attr("d", arcGenerator)
                    .attr("fill", groupColors[group])
                    .attr("stroke", variables.has_stroke ? d3.rgb(groupColors[group]).darker(0.5) : "none")
                    .attr("stroke-width", variables.has_stroke ? 1 : 0)
                    .attr("style", variables.has_shadow ? "filter: url(#shadow)" : null)
            }
        });

        // 添加末端圆圈和标签
        const outerRadius = radiusScale(d.total);
        const endCircleX = Math.sin(midAngle) * outerRadius;
        const endCircleY = -Math.cos(midAngle) * outerRadius;
        const endCircleRadius = Math.max(12, Math.min(30, radius * 0.1));

        sectorsGroup.append("circle")
            .attr("cx", endCircleX)
            .attr("cy", endCircleY)
            .attr("r", endCircleRadius)
            .attr("fill", "#ffffff")
            .attr("stroke", "#aaaaaa")
            .attr("stroke-width", 1);

        // 图标放在数据标签位置（即小圆中）
        const iconUrl = images?.field?.[d.category];
        if (iconUrl) {
            const iconSize = endCircleRadius * 1.2;
            labelsGroup.append("image")
                .attr("xlink:href", iconUrl)
                .attr("x", endCircleX - iconSize / 2)
                .attr("y", endCircleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }

        // 数据标签放在外圈（即原来x标签的位置）
        const valueText = `${formatValue(d.total)}${valueUnit}`;
        const labelRadius = outerRadius + endCircleRadius + 20;
        const labelX = Math.sin(midAngle) * labelRadius;
        const labelY = -Math.cos(midAngle) * labelRadius;
        
        labelsGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.annotation.font_family)
            .attr("font-size", typography.annotation.font_size)
            .attr("font-weight", "bold")
            .attr("fill", "#333333")
            .text(valueText);
    });

    // 添加图例
    const legend = svg.append("g")
        .attr("transform", `translate(${size - 150}, 50)`);

    groups.forEach((group, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`);

        legendItem.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", groupColors[group]);

        legendItem.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .attr("fill", colors.text_color)
            .attr("font-family", typography.label.font_family)
            .attr("font-size", typography.label.font_size)
            .text(group);
    });

    return svg.node();
}
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stacked Circular Bar Chart",
    "chart_name": "stacked_circular_bar_chart_03",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 20], [0, "inf"], [2, 10]],
    "required_fields_icons": [],
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

    // 处理长文本标签的函数
    const addAdaptiveText = (parent, text, x, y, maxWidth = 120, initialFontSize = 14) => {
        const tempText = parent.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.label.font_family)
            .attr("font-size", `${initialFontSize}px`)
            .attr("font-weight", "bold")
            .attr("fill", colors.text_color || "#333333")
            .style("visibility", "hidden")
            .text(text);
        
        const textWidth = tempText.node().getComputedTextLength();
        tempText.remove();

        // 如果文本宽度在限制内，直接显示
        if (textWidth <= maxWidth) {
            return parent.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-family", typography.label.font_family)
                .attr("font-size", `${initialFontSize}px`)
                .attr("font-weight", "bold")
                .attr("fill", colors.text_color || "#333333")
                .text(text);
        }

        // 尝试缩小字体
        const minFontSize = 10;
        let fontSize = initialFontSize;
        let currentWidth = textWidth;

        while (currentWidth > maxWidth && fontSize > minFontSize) {
            fontSize -= 1;
            const testText = parent.append("text")
                .attr("font-family", typography.label.font_family)
                .attr("font-size", `${fontSize}px`)
                .attr("font-weight", "bold")
                .style("visibility", "hidden")
                .text(text);
            
            currentWidth = testText.node().getComputedTextLength();
            testText.remove();
        }

        // 如果缩小字体后仍然过长，使用换行
        if (currentWidth > maxWidth) {
            const words = text.split(' ');
            const textElement = parent.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-family", typography.label.font_family)
                .attr("font-size", `${minFontSize}px`)
                .attr("font-weight", "bold")
                .attr("fill", colors.text_color || "#333333");

            let line = "";
            let lineNumber = 0;
            const lineHeight = minFontSize * 1.1;

            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + " ";
                const testTspan = textElement.append("tspan")
                    .style("visibility", "hidden")
                    .text(testLine);
                
                if (testTspan.node().getComputedTextLength() > maxWidth && line !== "") {
                    // 添加当前行
                    textElement.append("tspan")
                        .attr("x", x)
                        .attr("dy", lineNumber === 0 ? -lineHeight/2 : lineHeight)
                        .text(line.trim());
                    
                    line = words[i] + " ";
                    lineNumber++;
                } else {
                    line = testLine;
                }
                
                testTspan.remove();
            }
            
            // 添加最后一行
            if (line.trim() !== "") {
                textElement.append("tspan")
                    .attr("x", x)
                    .attr("dy", lineNumber === 0 ? 0 : lineHeight)
                    .text(line.trim());
            }

            return textElement;
        } else {
            // 使用缩小的字体显示单行文本
            return parent.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-family", typography.label.font_family)
                .attr("font-size", `${fontSize}px`)
                .attr("font-weight", "bold")
                .attr("fill", colors.text_color || "#333333")
                .text(text);
        }
    };

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

    const anglePerItem = (2 * Math.PI) / totalItems;
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
        .range([centralCircleRadius + 20, radius * 0.9]);

    // 为每个组创建颜色
    const groupColors = {};
    groups.forEach((group, i) => {
        const baseColor = colors.fields?.[group] || colors.other.primary;
        groupColors[group] = colors.field[group]
    });

    // ---------- 7. 创建中心圆和背景 ----------
    svg.append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", centralCircleRadius)
        .attr("fill", "#ffffff")
        .attr("stroke", "#aaaaaa")
        .attr("stroke-width", 1.5);

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
                const innerRadius = radiusScale(stack.start);
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

        // 添加总值标签
        const valueText = `${formatValue(d.total)}${valueUnit}`;
        sectorsGroup.append("text")
            .attr("x", endCircleX)
            .attr("y", endCircleY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("font-family", typography.annotation.font_family)
            .attr("font-size", `${endCircleRadius * 0.8}px`)
            .attr("font-weight", "bold")
            .attr("fill", "#333333")
            .text(valueText);

        // 添加类别标签（自适应宽度的维度标签）
        const baseLabelPadding = 10;
        // 根据角度动态调整距离，左右两侧增加更多距离
        const angleNormalized = (midAngle + Math.PI / 2) % (2 * Math.PI); // 将角度标准化，使0度在右侧
        const horizontalFactor = Math.abs(Math.cos(angleNormalized)); // 水平程度：1表示完全水平，0表示完全垂直
        const extraPadding = horizontalFactor * 20; // 水平位置额外增加最多30px距离
        const dynamicPadding = baseLabelPadding + extraPadding;
        
        const labelRadius = outerRadius + endCircleRadius + dynamicPadding;
        const labelX = Math.sin(midAngle) * labelRadius;
        const labelY = -Math.cos(midAngle) * labelRadius;

        // 使用自适应文本函数添加维度标签
        addAdaptiveText(labelsGroup, d.category, labelX, labelY, 80, 14);
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
            .attr("font-family", typography.label.font_family)
            .attr("font-size", typography.label.font_size)
            .text(group);
    });

    return svg.node();
}
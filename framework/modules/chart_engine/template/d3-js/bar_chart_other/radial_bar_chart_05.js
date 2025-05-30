/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Bar Chart",
    "chart_name": "radial_bar_chart_05",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) { //type7:Radial Bar Chart  plain chart#2 圆角
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const colors = jsonData.colors || {};
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

    // 生成圆角弧形路径的函数
    const createRoundedArcPath = (innerRadius, outerRadius, startAngle, endAngle, cornerRadius) => {
        const startAngleRad = startAngle - Math.PI / 2; // 调整起始角度，使0度在顶部
        const endAngleRad = endAngle - Math.PI / 2;
        
        // 计算各个关键点的坐标
        const innerStartX = innerRadius * Math.cos(startAngleRad);
        const innerStartY = innerRadius * Math.sin(startAngleRad);
        const innerEndX = innerRadius * Math.cos(endAngleRad);
        const innerEndY = innerRadius * Math.sin(endAngleRad);
        const outerStartX = outerRadius * Math.cos(startAngleRad);
        const outerStartY = outerRadius * Math.sin(startAngleRad);
        const outerEndX = outerRadius * Math.cos(endAngleRad);
        const outerEndY = outerRadius * Math.sin(endAngleRad);
        
        // 计算圆角的控制点
        const thickness = outerRadius - innerRadius;
        const adjustedCornerRadius = Math.min(cornerRadius, thickness / 2, 
            Math.abs(endAngle - startAngle) * innerRadius / 2);
        
        // 计算圆角在各个角的偏移
        const startCornerOffset = adjustedCornerRadius / innerRadius;
        const endCornerOffset = adjustedCornerRadius / innerRadius;
        
        // 内弧起始圆角点
        const innerStartCornerAngle = startAngleRad + startCornerOffset;
        const innerStartCornerX = innerRadius * Math.cos(innerStartCornerAngle);
        const innerStartCornerY = innerRadius * Math.sin(innerStartCornerAngle);
        
        // 内弧结束圆角点
        const innerEndCornerAngle = endAngleRad - endCornerOffset;
        const innerEndCornerX = innerRadius * Math.cos(innerEndCornerAngle);
        const innerEndCornerY = innerRadius * Math.sin(innerEndCornerAngle);
        
        // 外弧起始圆角点
        const outerStartCornerAngle = startAngleRad + adjustedCornerRadius / outerRadius;
        const outerStartCornerX = outerRadius * Math.cos(outerStartCornerAngle);
        const outerStartCornerY = outerRadius * Math.sin(outerStartCornerAngle);
        
        // 外弧结束圆角点
        const outerEndCornerAngle = endAngleRad - adjustedCornerRadius / outerRadius;
        const outerEndCornerX = outerRadius * Math.cos(outerEndCornerAngle);
        const outerEndCornerY = outerRadius * Math.sin(outerEndCornerAngle);
        
        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
        
        return `
            M ${innerStartCornerX} ${innerStartCornerY}
            A ${adjustedCornerRadius} ${adjustedCornerRadius} 0 0 1 ${outerStartCornerX} ${outerStartCornerY}
            A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndCornerX} ${outerEndCornerY}
            A ${adjustedCornerRadius} ${adjustedCornerRadius} 0 0 1 ${innerEndCornerX} ${innerEndCornerY}
            A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartCornerX} ${innerStartCornerY}
            Z
        `;
    };

    d3.select(containerSelector).html("");

    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;

    // 按yField降序排序
    chartData.sort((a, b) => b[yField] - a[yField]);

    // 尺寸
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;

    const nBars = chartData.length;
    const minRadius = maxRadius * 0.2;
    const maxBarRadius = maxRadius * 0.95;
    const barWidth = (maxBarRadius - minRadius) / nBars * 0.7;
    const barGap = (maxBarRadius - minRadius) / nBars * 0.3;

    // 角度比例尺（最大270°）
    const maxValue = d3.max(chartData, d => d[yField]);
    const angleScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, 1.5 * Math.PI]); // 270°

    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // 辅助线
    const numTicks = 5;
    const ticks = d3.range(0, maxValue + 1, maxValue / numTicks);
    ticks.forEach(tick => {
        g.append("path")
            .attr("d", d3.arc()
                .innerRadius(minRadius)
                .outerRadius(maxBarRadius + barWidth * 0.5)
                .startAngle(angleScale(tick))
                .endAngle(angleScale(tick))
            )
            .attr("stroke", "#e0e0e0")
            .attr("stroke-width", 1)
            .attr("fill", "none");
        g.append("text")
            .attr("x", Math.cos(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7))
            .attr("y", Math.sin(angleScale(tick) - Math.PI / 2) * (maxBarRadius + barWidth * 0.7))
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#888")
            .style("font-size", "12px")
            .text(formatValue(tick));
    });
    const labelPadding = 20;
    // 条形
    chartData.forEach((d, i) => {
        const innerR = minRadius + i * (barWidth + barGap);
        const outerR = innerR + barWidth;
        const endAngle = angleScale(d[yField]);
        const cornerRadius = barWidth / 2; // 圆角半径为宽度的一半

        // 使用圆角弧形路径
        g.append("path")
            .attr("d", createRoundedArcPath(innerR, outerR, 0, endAngle, cornerRadius))
            .attr("fill", colors.primary || "#ff4d4f")
            .attr("opacity", 0.85);

        // 类别标签
        g.append("text")
            .attr("x", Math.cos(-Math.PI / 2) * (innerR + barWidth / 2) - labelPadding)
            .attr("y", Math.sin(-Math.PI / 2) * (innerR + barWidth / 2))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#222b44")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text(d[xField]);

        // 数值标签（沿柱子末端弧线）
        const valueText = formatValue(d[yField]);
        const valueRadius = innerR + barWidth / 2;
        const valueAngle = endAngle;
        const valueTextPathId = `valueTextPath-${i}`;
        
        // 根据数值大小动态计算文字路径长度
        const valueTextLen = String(valueText).length * 12; // 调整字符宽度估计以避免重叠
        const minAngle = 0.1; // 减小最小角度
        // const maxAngle = 0.3; // 设置最大角度
        const valueShiftAngle = Math.max(valueTextLen / valueRadius, minAngle)
        

        // 计算文字路径的起始和结束角度
        const pathStartAngle = Math.max(0, valueAngle - valueShiftAngle);
        const pathEndAngle = Math.min(1.7 * Math.PI, valueAngle + valueShiftAngle);

        g.append("path")
            .attr("id", valueTextPathId)
            .attr("d", d3.arc()({
                innerRadius: valueRadius,
                outerRadius: valueRadius,
                startAngle: pathStartAngle,
                endAngle: pathEndAngle
            }))
            .style("fill", "none")
            .style("stroke", "none");

        g.append("text")
            .attr("font-size", "12px")
            .attr("fill", "#b71c1c")
            .append("textPath")
            .attr("xlink:href", `#${valueTextPathId}`)
            .attr("startOffset", "30%") 
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "start")
            .text(valueText);
    });

    return svg.node();
}
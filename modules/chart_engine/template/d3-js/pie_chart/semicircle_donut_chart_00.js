/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Semicircle Donut Chart",
    "chart_name": "semicircle_donut_chart_00",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "stroke"],
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

function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;
    const chartData = jsonData.data.data || [];
    const variables = jsonData.variables || {};
    const dataColumns = jsonData.data.columns || [];

    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#333333",
        field: {},
        other: {
            primary: "#4682B4" // 默认主色调
        }
    };

    // 提取字段名称
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    // Set dimensions and margins
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // Calculate center point and max radius
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);
    
    // 绘制半圆饼图
    const arc = d3.arc()
        .innerRadius(maxRadius * 0.75)
        .outerRadius(maxRadius)
        .padAngle(0.02)
        .cornerRadius(5);

    // 计算每个组的百分比
    const total = d3.sum(chartData, d => d[yField]);
    const dataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: d[yField] / total
    }));

    // 创建弧度数据
    const arcData = d3.pie()
        .value(d => d.percentage)
        .sort(null)
        .startAngle(-Math.PI / 2)  // 设置起始角度为-90度
        .endAngle(Math.PI / 2);    // 设置结束角度为90度

    // 绘制每个组的弧线
    const arcs = g.selectAll("path")
        .data(arcData(dataWithPercentages))
        .enter().append("path")
        .attr("fill", d => colors.field[d.data[xField]] || colors.other.primary)
        .attr("d", arc);

    // 创建用于外部标签的弧形路径
    const outerArc = d3.arc()
        .innerRadius(maxRadius * 1.1)  // 减小为1.1，让标签更靠近图形
        .outerRadius(maxRadius * 1.1);

    // 添加外部标签和连接线
    const labelGroup = g.selectAll(".label-group")
        .data(arcData(dataWithPercentages))
        .enter()
        .append("g")
        .attr("class", "label-group");

    // 记录labelGroup的位置信息
    const labelPositions = labelGroup.data().map(d => {
        const midPos = outerArc.centroid(d);
        const angle = midAngle(d);
        
        // 根据角度决定标签位置
        const textPos = [
            midPos[0] * 1.2,
            midPos[1] * 1.1
        ];
        
        // 确保标签在正确方向
        if (angle > 0) {
            textPos[0] = Math.abs(textPos[0]); // 右侧标签
        } else {
            textPos[0] = -Math.abs(textPos[0]); // 左侧标签
        }
        
        return {
            category: d.data[xField],
            value: d.data[yField],
            percentage: d.data.percentage,
            position: textPos,
            angle: angle
        };
    });


    // 找出y坐标最小的标签位置（即最上方的标签）
    const topLabelPosition = labelPositions.reduce((minYPos, currentPos) => {
        return (currentPos.position[1] < minYPos.position[1]) ? currentPos : minYPos;
    }, labelPositions[0]);

    // 添加连接线
    labelGroup.append("polyline")
        .attr("points", function(d) {
            const pos = arc.centroid(d);
            const midPos = outerArc.centroid(d);
            const angle = midAngle(d);
            
            // 确定标签位置，与半圆形状匹配
            const textPos = [
                midPos[0] * 1.2, // 减小为1.2，让标签更靠近图形
                midPos[1] * 1.1  // 减小为1.1，让标签更靠近图形
            ];
            
            // 确保连接线在正确方向
            if (angle > 0) {
                textPos[0] = Math.abs(textPos[0]); // 右侧标签
            } else {
                textPos[0] = -Math.abs(textPos[0]); // 左侧标签
            }
            
            return [pos, midPos, textPos];
        })
        .attr("stroke", "#888")
        .attr("fill", "none")
        .attr("stroke-width", 1);

    // 添加文本标签
    labelGroup.append("text")
        .attr("transform", function(d) {
            const midPos = outerArc.centroid(d);
            const angle = midAngle(d);
            
            // 根据角度决定标签位置
            const textPos = [
                midPos[0] * 1.2, // 减小为1.2，让标签更靠近图形
                midPos[1] * 1.1  // 减小为1.1，让标签更靠近图形
            ];
            
            // 确保标签在正确方向
            if (angle > 0) {
                textPos[0] = Math.abs(textPos[0]); // 右侧标签
            } else {
                textPos[0] = -Math.abs(textPos[0]); // 左侧标签
            }
            
            return `translate(${textPos})`;
        })
        .attr("text-anchor", d => midAngle(d) < 0 ? "end" : "start")
        .attr("dominant-baseline", "middle")
        .style("font-size", "16px") // 增大字体大小为16px
        .style("font-family", typography.label.font_family)
        .style("font-weight", typography.label.font_weight)
        .attr("fill", colors.text_color)
        .text(d => {
            const percentage = (d.data.percentage * 100).toFixed(1) + '%';
            return `${d.data[xField]}: ${percentage}`;
        });

    // 辅助函数：计算中间角度
    function midAngle(d) {
        return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

    // 添加图例 - 放在图表上方
    const legendGroup = svg.append("g")
    .attr("transform", `translate(0, 0)`);
    
    // 计算字段名宽度并添加间距
    const titleWidth = xField.length * 10;
    const titleMargin = 15;
    
    let xs = [...new Set(chartData.map(d => d[xField]))];
    console.log(topLabelPosition.position)
    const legendSize = layoutLegend(legendGroup, xs, colors, {
        x: titleWidth + titleMargin,
        y: topLabelPosition.position[1] + centerY,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth,
        shape: "rect",
    });
    console.log("legendSize", legendSize)
    // 添加字段名称
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", legendSize.height / 2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .text(xField);
    
    // 将图例组向上移动 height/2, 并居中
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, ${-legendSize.height-20})`);
    
    return svg.node();
}

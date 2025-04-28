/*
REQUIREMENTS_BEGIN
{
    "chart_type": "SemiCircle Pie Chart",
    "chart_name": "semi_circle_pie_chart_01_d3",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
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

// 半圆饼图实现 - 使用半圆饼图表示数据值
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
    let colors = jsonData.colors || {
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
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d[yField])
        .sort(null);

    // 创建弧形生成器
    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(maxRadius)
        .startAngle(-Math.PI / 2)  // 设置起始角度为-90度
        .endAngle(Math.PI / 2)     // 设置结束角度为90度
        .padAngle(0)
        .cornerRadius(5);

    // 计算每个组的百分比
    const total = d3.sum(chartData, d => d[yField]);
    const dataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: (d[yField] / total) * 100
    }));
    const sectors = pie(dataWithPercentages);
    console.log("sectors: ", sectors);

    for (let i = 0; i < sectors.length; i++) {
        const d = sectors[i];
        console.log("d", d);
        // 绘制甜甜圈图的各个部分
        const path = g.append("path")
            .attr("fill", colors.field[d.data[xField]] || colors.other.primary)
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", 2)
            .attr("d", arc(d));

        
        const outerLength = (d.endAngle - d.startAngle) * maxRadius;


        let iconWidth = Math.min(outerLength / 3, 150);
        let iconHeight = iconWidth;
        if (iconWidth > 20) {
            const iconArc = d3.arc()
                .innerRadius(maxRadius)
                .outerRadius(maxRadius);

            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            // 确保剪切路径有正确的位置和尺寸
            const [cx, cy] = iconArc.centroid(d);
            clipPath.append("circle")
                .attr("cx", cx)
                .attr("cy", cy) 
                .attr("r", iconWidth / 2);

            // 添加白色背景圆
            const circle = g.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconWidth / 2 + 3)
                .attr("fill", "white")
                .attr("stroke", colors.field[d.data[xField]] || colors.other.primary)
                .attr("stroke-width", 2);

            // 使用剪切路径裁剪图片
            const icon = g.append("image")
                .attr("xlink:href", jsonData.images.field[d.data[xField]])
                .attr("clip-path", `url(#${clipId})`)
                .attr("x", cx - iconWidth / 2)
                .attr("y", cy - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight);

            let displayTextCategory = d.data[xField];
            let displayTextNumerical = d.data.percentage >= 2 ? `${d.data.percentage.toFixed(1)}%` : '';
            let categoryFontSize = 20;
            let numericalFontSize = 20;
            let categoryTextWidth = getTextWidth(displayTextCategory, categoryFontSize);
            let numericalTextWidth = getTextWidth(displayTextNumerical, numericalFontSize);
            const textArc = d3.arc()
                .innerRadius(maxRadius*0.5)
                .outerRadius(maxRadius*0.5);
            const fillColor = colors.field[d.data[xField]] || colors.other.primary;
            // 如果这里颜色深，则使用白色文字，否则使用黑色文字
            // 将颜色转换为RGB值
            const rgb = fillColor.match(/\d+/g).map(Number);
            // 计算亮度 (使用相对亮度公式)
            const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
            if (brightness < 128) {
                colors.text_color = '#FFFFFF';
            } else {
                colors.text_color = '#000000';
            }

            const textCategory = g.append("text")
                .attr("transform", `translate(${textArc.centroid(d)})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", categoryFontSize)
                .text(displayTextCategory);

            const textNumerical = g.append("text")
                .attr("transform", `translate(0,20) translate(${textArc.centroid(d)})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", numericalFontSize)
                .text(displayTextNumerical);
        } else {
            iconWidth = 20;
            iconHeight = 20;
            const iconArc = d3.arc()
                .innerRadius(maxRadius+30)
                .outerRadius(maxRadius+30);

            // 创建剪切路径
            const clipId = `clip-${i}`;
            const defs = g.append("defs");
            const clipPath = defs.append("clipPath")
                .attr("id", clipId);
                
            // 确保剪切路径有正确的位置和尺寸
            const [cx, cy] = iconArc.centroid(d);
            clipPath.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconWidth / 2);

            // 添加白色背景圆
            const circle = g.append("circle")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", iconWidth / 2 + 3)
                .attr("fill", "white")
                .attr("stroke", colors.field[d.data[xField]] || colors.other.primary)
                .attr("stroke-width", 2);

            // 使用剪切路径裁剪图片
            const icon = g.append("image")
                .attr("xlink:href", jsonData.images.field[d.data[xField]])
                .attr("clip-path", `url(#${clipId})`)
                .attr("x", cx - iconWidth / 2)
                .attr("y", cy - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight);
            
            let displayTextCategory = d.data[xField];
            let displayTextNumerical = `${d.data.percentage.toFixed(1)}%`;
            let categoryFontSize = 20;
            let numericalFontSize = 20;
            const textArc = d3.arc()
                .innerRadius(maxRadius+70)
                .outerRadius(maxRadius+70);
            const fillColor = colors.field[d.data[xField]] || colors.other.primary;

            const textCategory = g.append("text")
                .attr("transform", `translate(${textArc.centroid(d)})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", categoryFontSize)
                .text(displayTextCategory);

            const textNumerical = g.append("text")
                .attr("transform", `translate(0,20) translate(${textArc.centroid(d)})`)
                .attr("text-anchor", "middle")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", numericalFontSize)
                .text(displayTextNumerical);
        }
    }



    // 加入label
    const label = g.append("text")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("text-anchor", "middle")
        .style("fill", colors.text_color)
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .text(jsonData.title);

    // 添加图例 - 放在图表上方
    const legendGroup = svg.append("g")
        .attr("transform", `translate(0, -50)`);
    
    // 计算字段名宽度并添加间距
    const titleWidth = xField.length * 10;
    const titleMargin = 15;
    
    let xs = [...new Set(chartData.map(d => d[xField]))];

    const legendSize = layoutLegend(legendGroup, xs, colors, {
        x: titleWidth + titleMargin,
        y: 0,
        fontSize: 14,
        fontWeight: "bold",
        align: "left",
        maxWidth: chartWidth - titleWidth - titleMargin,
        shape: "rect",
    });

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
    legendGroup.attr("transform", `translate(${(chartWidth - legendSize.width - titleWidth - titleMargin) / 2}, ${-legendSize.height / 2 - 20})`);
    
    return svg.node();
}
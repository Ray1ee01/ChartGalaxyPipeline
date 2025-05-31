/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Donut Chart",
    "chart_name": "donut_chart_09",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 12], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, dataJSON) {
    // ---------- 1. 数据准备阶段 ----------
    const chartData = dataJSON.data.data;
    const variables = dataJSON.variables || {};
    const typography = dataJSON.typography || {
        title: { font_family: "Arial, sans-serif", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "13px", font_weight: "normal" }
    };
    const colors = dataJSON.colors || { text_color: "#333333", field: {} };
    const dataColumns = dataJSON.data.columns || [];

    // 清空容器
    d3.select(containerSelector).html("");

    if (!chartData || chartData.length === 0) {
        d3.select(containerSelector).text("无有效数据");
        return;
    }

    // ---------- 2. 提取字段名和单位 ----------
    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;

    if (!xField || !yField) {
        d3.select(containerSelector).text("缺少 x 或 y 字段定义");
        return;
    }

    let valueUnit = "";
    if (dataColumns.find(col => col.role === "y")?.unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit || "";
    }

    // ---------- 3. 数据处理与验证 ----------
    const validData = chartData.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && parseFloat(d[yField]) >= 0);
    const totalValue = d3.sum(validData, d => +d[yField]);

    if (validData.length === 0 || totalValue <= 0) {
        d3.select(containerSelector).html("");
        d3.select(containerSelector).text(totalValue <= 0 && validData.length > 0 ? "数值总和必须大于 0" : "无有效数据或数值均为0");
        return;
    }

    // 按原始数值降序排序
    const processedData = validData.sort((a, b) => +b[yField] - +a[yField]);
    
    // 找出最大值的索引
    const maxValueIndex = processedData.findIndex(d => d[yField] === d3.max(processedData, d => +d[yField]));

    // ---------- 4. 尺寸和SVG设置 ----------
    const totalWidth = variables.width || 600;
    const totalHeight = variables.height || 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const chartWidth = totalWidth - margin.left - margin.right;
    const chartHeight = totalHeight - margin.top - margin.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    const innerRadius = radius * 0.5; // 内圆半径，控制环形图厚度

    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", totalHeight)
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // ---------- 5. 颜色比例尺 ----------
    const colorDomain = processedData.map(d => d[xField]);
    const colorRange = colorDomain.map(field => colors.field[field] || "#cccccc");
    const colorScale = d3.scaleOrdinal()
        .domain(colorDomain)
        .range(colorRange.length > 0 ? colorRange : d3.schemeTableau10);

    // ---------- 6. 绘制环形图 ----------
    const pieGroup = svg.append("g")
        .attr("transform", `translate(${totalWidth / 2}, ${totalHeight / 2})`);

    // 创建饼图生成器，按值从大到小排序，使最大值在底部中心
    const pie = d3.pie()
        .value(d => +d[yField])
        .sort((a, b) => b[yField] - a[yField]) // 从大到小排序
        .padAngle(0) // 去掉扇区间的间隙
        .startAngle(Math.PI - Math.PI * 2 * (processedData[0][yField] / totalValue) / 2) // 从180度减去第一块的一半角度开始
        .endAngle(Math.PI - Math.PI * 2 * (processedData[0][yField] / totalValue) / 2 + Math.PI * 2); // 确保完整的圆

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius)
        .cornerRadius(0); // 去掉圆角

    // 创建扇区
    const arcs = pieGroup.selectAll(".arc")
        .data(pie(processedData))
        .enter()
        .append("g")
        .attr("class", "arc");

    // 绘制扇区路径
    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => colorScale(d.data[xField]))
        .attr("stroke", "none") // 去掉描边
        .style("filter", "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))");

    // ---------- 7. 添加标签 ----------
    // 计算标签位置的弧
    const labelArc = d3.arc()
        .innerRadius(innerRadius + (radius - innerRadius) * 0.5)
        .outerRadius(innerRadius + (radius - innerRadius) * 0.5);

    // 添加类别和数值标签
    arcs.append("text")
        .attr("transform", d => {
            // 获取弧的中心点
            const centroid = labelArc.centroid(d);
            return `translate(${centroid})`;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", '#FFFFFF')
        .attr("font-family", "Arial, sans-serif") // 使用Arial字体
        .attr("font-size", "12px")
        .each(function(d) {
            // 计算扇区的角度范围
            const angleRange = d.endAngle - d.startAngle;
            // 如果扇区太小，显示省略号
            if (angleRange < 0.3) {
                const text = d3.select(this);
                text.text("...");
                text.attr("font-size", "16px");
                text.attr("font-weight", "bold");
                return;
            }
            
            // 获取数据
            const category = d.data[xField];
            const value = d.data[yField];
            
            // 创建多行文本
            const text = d3.select(this);
            
            // 添加类别名称
            text.append("tspan")
                .attr("x", 0)
                .attr("dy", "-0.8em")
                .attr("font-size", "20px")
                .attr("font-weight", "bold")
                .text(category);
            
            // 添加数值
            text.append("tspan")
                .attr("x", 0)
                .attr("dy", "1.6em") // 增加间距，因为没有百分比行
                .attr("font-size", "36px")
                .attr("font-weight", "bold")
                .text(`${value}${valueUnit}`);
            
            // 不添加百分比
        });

    // ---------- 8. 返回SVG节点 ----------
    return svg.node();
}

// 辅助函数：计算对比色
function getContrastColor(hexColor) {
    // 将十六进制颜色转换为RGB
    let r = parseInt(hexColor.slice(1, 3), 16);
    let g = parseInt(hexColor.slice(3, 5), 16);
    let b = parseInt(hexColor.slice(5, 7), 16);
    
    // 计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 根据亮度返回黑色或白色
    return brightness > 128 ? "#000000" : "#ffffff";
} 
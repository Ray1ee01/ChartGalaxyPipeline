/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radar Line Chart",
    "chart_name": "radar_line_chart_03",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 12], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const categoryField = dataColumns[0].name;
    const valueField = dataColumns[1].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    
    const g = svg.append("g")
        .attr("transform", `translate(${width/2}, ${height/2})`);
    
    // 获取唯一类别
    const categories = [...new Set(chartData.map(d => d[categoryField]))];
    
    // 获取主色调
    const mainColor = colors.other && colors.other.primary ? colors.other.primary : "#1f77b4";
    
    // 创建角度比例尺
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]);
    
    // 创建半径比例尺
    const allValues = chartData.map(d => d[valueField]);
    const minValue = Math.min(0, d3.min(allValues));
    const maxValue = d3.max(allValues);
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue * 1.2])
        .range([0, radius])
        .nice();
    
    // 绘制背景圆环
    const ticks = radiusScale.ticks(5);
    
    // 绘制同心圆
    g.selectAll(".circle-axis")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "circle-axis")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", "#bbb")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");
    
    // 绘制径向轴线
    g.selectAll(".axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d, i) => radius * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y2", (d, i) => radius * Math.sin(angleScale(d) - Math.PI/2))
        .attr("stroke", "#bbb")
        .attr("stroke-width", 1);
    
    // 添加类别标签
    g.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "category-label")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI/2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) {
                return "middle";
            }
            return angle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) {
                return "middle";
            }
            return angle < Math.PI ? "hanging" : "auto";
        })
        .attr("fill", "#fff")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);
    
    // 添加刻度值标签
    g.selectAll(".tick-label")
        .data(ticks)
        .enter()
        .append("text")
        .attr("class", "tick-label")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("font-size", "14px")
        .attr("fill", "#ddd")
        .text(d => d);
    
    // 创建折线生成器
    const lineGenerator = () => {
        const points = categories.map(cat => {
            const point = chartData.find(item => item[categoryField] === cat);
            if (point) {
                const angle = angleScale(cat) - Math.PI/2;
                const distance = radiusScale(point[valueField]);
                return [
                    distance * Math.cos(angle),
                    distance * Math.sin(angle)
                ];
            }
            return [0, 0]; // 如果没有数据，默认为中心点
        });
        
        // 使用折线连接点
        return d3.line()(points) + "Z"; // 闭合路径
    };
    
    // 绘制雷达折线
    g.append("path")
        .attr("class", "radar-line")
        .attr("d", lineGenerator())
        .attr("fill", mainColor)
        .attr("fill-opacity", 0.2)
        .attr("stroke", mainColor)
        .attr("stroke-width", 6)
        .attr("stroke-linejoin", "miter"); // 使用尖角连接，强调折线效果
    
    // 绘制数据点
    categories.forEach((cat, index) => {
        const point = chartData.find(item => item[categoryField] === cat);
        if (point) {
            const angle = angleScale(cat) - Math.PI/2;
            const distance = radiusScale(point[valueField]);
            
            g.append("circle")
                .attr("class", "radar-point")
                .attr("cx", distance * Math.cos(angle))
                .attr("cy", distance * Math.sin(angle))
                .attr("r", 6)
                .attr("fill", mainColor)
                .attr("stroke", "#fff")
                .attr("stroke-width", 3);

            // 添加数值标签背景
            const labelText = point[valueField].toString();
            const textWidth = getTextWidth(labelText, 14);

            const textX = index === 0 ? (distance + 30) * Math.cos(angle) - 20 : (distance + 30) * Math.cos(angle);
            const textY = index === 0 ? (distance + 15) * Math.sin(angle) : (distance + 30) * Math.sin(angle);

            g.append("rect")
                .attr("class", "value-label-bg")
                .attr("x", textX - textWidth/2 - 4)
                .attr("y", textY - 8)
                .attr("width", textWidth + 8)
                .attr("height", 16)
                .attr("fill", colors.other.primary)
                .attr("rx", 3);

            // 添加数值标签
            g.append("text")
                .attr("class", "value-label")
                .attr("x", textX)
                .attr("y", textY)
                .attr("text-anchor", "middle") 
                .attr("dominant-baseline", "middle")
                .attr("font-size", "14px")
                .attr("fill", "#fff")
                .text(labelText);
        }
    });
    
    return svg.node();
} 
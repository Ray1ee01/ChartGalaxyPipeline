/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Area Chart",
    "chart_name": "radial_area_chart_grid_01",
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
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 内联utils函数
    const getTextWidth = (text, fontSize) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontSize}px Arial`;
        const width = ctx.measureText(text).width;
        canvas.remove();
        return width;
    };

    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
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
    
    // 获取唯一类别和主色调
    const categories = [...new Set(chartData.map(d => d[categoryField]))];
    const mainColor = colors.other?.primary || "#1f77b4";
    
    // 创建比例尺
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]);
    
    const allValues = chartData.map(d => d[valueField]);
    const radiusScale = d3.scaleLinear()
        .domain([Math.min(0, d3.min(allValues)), d3.max(allValues) * 1.2])
        .range([0, radius])
        .nice();
    
    // 绘制网格线
    const ticks = radiusScale.ticks(5);
    
    // 绘制同心圆网格
    g.selectAll(".gridline")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "gridline")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", "#bbb")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");
    
    // 绘制径向轴线
    g.selectAll(".axis")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI/2))
        .attr("stroke", "#bbb")
        .attr("stroke-width", 1);
    
    // 添加类别标签
    g.selectAll(".label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI/2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) return "middle";
            return angle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) return "middle";
            return angle < Math.PI ? "hanging" : "auto";
        })
        .attr("fill", "#333")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);
    
    // 添加刻度值标签
    g.selectAll(".value")
        .data(ticks)
        .enter()
        .append("text")
        .attr("class", "value")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("font-size", "14px")
        .attr("fill", "#666")
        .text(d => d);
    
    // 创建雷达路径
    const points = categories.map(cat => {
        const point = chartData.find(item => item[categoryField] === cat);
        if (point) {
            const angle = angleScale(cat) - Math.PI/2;
            const distance = radiusScale(point[valueField]);
            return [distance * Math.cos(angle), distance * Math.sin(angle)];
        }
        return [0, 0];
    });
    
    // 绘制雷达面积
    g.append("path")
        .attr("class", "mark")
        .attr("d", d3.line()(points) + "Z")
        .attr("fill", mainColor)
        .attr("fill-opacity", 0.2)
        .attr("stroke", mainColor)
        .attr("stroke-width", 6)
        .attr("stroke-linejoin", "miter");
    
    // 绘制数据点和数值标签
    categories.forEach((cat, index) => {
        const point = chartData.find(item => item[categoryField] === cat);
        if (point) {
            const angle = angleScale(cat) - Math.PI/2;
            const distance = radiusScale(point[valueField]);
            const x = distance * Math.cos(angle);
            const y = distance * Math.sin(angle);
            
            // 数据点
            g.append("circle")
                .attr("class", "mark")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 6)
                .attr("fill", mainColor)
                .attr("stroke", "#fff")
                .attr("stroke-width", 3);

            // 数值标签
            const labelText = point[valueField].toString();
            const textWidth = getTextWidth(labelText, 14);
            const textX = index === 0 ? (distance + 30) * Math.cos(angle) - 20 : (distance + 30) * Math.cos(angle);
            const textY = index === 0 ? (distance + 15) * Math.sin(angle) : (distance + 30) * Math.sin(angle);

            // 标签背景
            g.append("rect")
                .attr("class", "background")
                .attr("x", textX - textWidth/2 - 4)
                .attr("y", textY - 8)
                .attr("width", textWidth + 8)
                .attr("height", 16)
                .attr("fill", mainColor)
                .attr("rx", 3);

            // 标签文字
            g.append("text")
                .attr("class", "value")
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
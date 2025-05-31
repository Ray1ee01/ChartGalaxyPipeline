/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Layered Area Chart",
    "chart_name": "radial_layered_area_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 7], [0, "inf"], [1, 6]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
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

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const categoryField = dataColumns[0].name;
    const valueField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 内联layoutLegend函数
    const layoutLegend = (g, groups, colors, options = {}) => {
        const defaults = {
            maxWidth: 500, x: 0, y: 0, itemHeight: 20, itemSpacing: 20, rowSpacing: 10,
            symbolSize: 10, textColor: "#333", fontSize: 12, fontWeight: "normal", align: "left", shape: "circle"
        };
        const opts = {...defaults, ...options};
        
        const tempText = g.append("text").attr("visibility", "hidden").style("font-size", `${opts.fontSize}px`).style("font-weight", opts.fontWeight);
        const itemWidths = groups.map(group => {
            tempText.text(group);
            return opts.symbolSize * 2 + tempText.node().getComputedTextLength() + 5;
        });
        tempText.remove();
        
        const rows = [];
        let currentRow = [], currentRowWidth = 0;
        itemWidths.forEach((width, i) => {
            if (currentRow.length === 0 || currentRowWidth + width + opts.itemSpacing <= opts.maxWidth) {
                currentRow.push(i);
                currentRowWidth += width + (currentRow.length > 1 ? opts.itemSpacing : 0);
            } else {
                rows.push(currentRow);
                currentRow = [i];
                currentRowWidth = width;
            }
        });
        if (currentRow.length > 0) rows.push(currentRow);
        
        const totalHeight = rows.length * opts.itemHeight + (rows.length - 1) * opts.rowSpacing;
        const maxRowWidth = Math.max(...rows.map(row => row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0)));
        
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0);
            let rowStartX = opts.align === "center" ? opts.x + (opts.maxWidth - rowWidth) / 2 : opts.align === "right" ? opts.x + opts.maxWidth - rowWidth : opts.x;
            
            let currentX = rowStartX;
            row.forEach(i => {
                const group = groups[i];
                const color = colors.field && colors.field[group] ? colors.field[group] : d3.schemeCategory10[i % 10];
                const legendGroup = g.append("g").attr("transform", `translate(${currentX}, ${opts.y + rowIndex * (opts.itemHeight + opts.rowSpacing)})`);
                
                legendGroup.append("circle").attr("class", "mark").attr("cx", opts.symbolSize / 2).attr("cy", opts.itemHeight / 2).attr("r", opts.symbolSize / 2).attr("fill", color);
                legendGroup.append("text").attr("class", "label").attr("x", opts.symbolSize * 1.5).attr("y", opts.itemHeight / 2).attr("dominant-baseline", "middle").attr("fill", opts.textColor).style("font-size", `${opts.fontSize}px`).style("font-weight", opts.fontWeight).text(group);
                
                currentX += itemWidths[i] + opts.itemSpacing;
            });
        });
        
        return { width: maxRowWidth, height: totalHeight };
    };
    
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
    
    // 获取唯一类别和分组
    const categories = [...new Set(chartData.map(d => d[categoryField]))];
    const groupAvgs = [...new Set(chartData.map(d => d[groupField]))]
        .map(group => ({
            group,
            avg: d3.mean(chartData.filter(d => d[groupField] === group), d => d[valueField])
        }))
        .sort((a, b) => b.avg - a.avg);
    
    const groups = groupAvgs.map(d => d.group);
    
    // 创建颜色比例尺
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        return d3.schemeTableau10[groups.indexOf(d) % 10];
    };
    
    // 创建角度比例尺
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]);
    
    // 创建半径比例尺
    const allValues = chartData.map(d => d[valueField]);
    const minValue = Math.min(0, d3.min(allValues));
    const maxValue = d3.max(allValues);
    
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([0, radius])
        .nice();
    
    // 绘制背景圆环
    const ticks = radiusScale.ticks(5);
    
    // 绘制径向轴线
    g.selectAll(".axis-line")
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
    g.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI/2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI/2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            return angle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", "#333")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d);
    
    // 创建径向面积生成器 - 关键：所有面积都从中心点开始(innerRadius=0)
    const areaRadial = d3.areaRadial()
        .angle(d => angleScale(d[categoryField]))
        .innerRadius(0) // 关键：所有系列共享零基线(中心点)
        .outerRadius(d => radiusScale(d[valueField]))
        .curve(d3.curveLinearClosed);
    
    // 绘制每个组的径向分层面积 - 按平均值降序绘制，确保小的不被大的完全遮挡
    [...groups].reverse().forEach(group => {
        const groupData = chartData.filter(d => d[groupField] === group);
        
        // 确保数据按角度排序，形成完整的径向面积
        const sortedData = categories.map(cat => {
            const point = groupData.find(d => d[categoryField] === cat);
            return point || { [categoryField]: cat, [valueField]: 0, [groupField]: group };
        });
        
        // 绘制径向面积
        g.append("path")
            .datum(sortedData)
            .attr("class", "mark")
            .attr("d", areaRadial)
            .attr("fill", colorScale(group))
            .attr("fill-opacity", 0.3) // 半透明，便于看见被遮挡的层
            .attr("stroke", colorScale(group))
            .attr("stroke-width", 2)
            .attr("stroke-opacity", 0.8);
        
        // 绘制数据点
        categories.forEach(cat => {
            const point = groupData.find(item => item[categoryField] === cat);
            if (point) {
                const angle = angleScale(cat) - Math.PI/2;
                const distance = radiusScale(point[valueField]);
                
                g.append("circle")
                    .attr("class", "mark")
                    .attr("cx", distance * Math.cos(angle))
                    .attr("cy", distance * Math.sin(angle))
                    .attr("r", 3)
                    .attr("fill", colorScale(group))
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1);
            }
        });
    });
    
    // 添加图例
    const legendGroup = svg.append("g");
    const legendSize = layoutLegend(legendGroup, groups, colors, {
        x: 0, y: 0, fontSize: 14, fontWeight: "bold", align: "center",
        maxWidth: chartWidth, shape: "circle", textColor: "#333"
    });
    
    // 居中legend
    legendGroup.attr("transform", `translate(${(width - legendSize.width) / 2}, ${height - margin.bottom + 10})`);
    
    return svg.node();
} 
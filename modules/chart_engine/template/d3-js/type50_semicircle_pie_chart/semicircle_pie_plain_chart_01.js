/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Semicircle Pie Chart",
    "chart_name": "semicircle_pie_plain_chart_01",
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
    // 计算文本宽度
    const getTextWidth = (text, fontSize) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontSize}px Arial`;
        const width = context.measureText(text).width;
        canvas.remove();
        return width;
    };

    // 智能排版图例
    const layoutLegend = (g, groups, colors, options = {}) => {
        const opts = {
            maxWidth: 500, x: 0, y: 0, itemHeight: 20, itemSpacing: 20, rowSpacing: 10,
            symbolSize: 10, textColor: "#333", fontSize: 12, fontWeight: "normal",
            align: "left", shape: "circle", ...options
        };
        
        const itemWidths = groups.map(group => {
            const textWidth = getTextWidth(group, opts.fontSize);
            return opts.symbolSize * 2 + textWidth + 5;
        });
        
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
        const maxRowWidth = Math.max(...rows.map(row => {
            return row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0);
        }));
        
        rows.forEach((row, rowIndex) => {
            const rowWidth = row.reduce((sum, i, idx) => sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0), 0);
            let rowStartX = opts.align === "center" ? opts.x + (opts.maxWidth - rowWidth) / 2 :
                           opts.align === "right" ? opts.x + opts.maxWidth - rowWidth : opts.x;
            
            let currentX = rowStartX;
            row.forEach(i => {
                const group = groups[i];
                const color = colors.field && colors.field[group] ? colors.field[group] : d3.schemeCategory10[i % 10];
                const legendGroup = g.append("g")
                    .attr("transform", `translate(${currentX}, ${opts.y + rowIndex * (opts.itemHeight + opts.rowSpacing)})`)
                    .attr("class", "other");
                
                if (opts.shape === "rect") {
                    legendGroup.append("rect")
                        .attr("x", 0).attr("y", opts.itemHeight / 2 - opts.symbolSize / 2)
                        .attr("width", opts.symbolSize).attr("height", opts.symbolSize)
                        .attr("fill", color).attr("class", "mark");
                } else {
                    legendGroup.append("circle")
                        .attr("cx", opts.symbolSize / 2).attr("cy", opts.itemHeight / 2)
                        .attr("r", opts.symbolSize / 2).attr("fill", color).attr("class", "mark");
                }
                
                legendGroup.append("text")
                    .attr("x", opts.symbolSize * 1.5).attr("y", opts.itemHeight / 2)
                    .attr("dominant-baseline", "middle").attr("fill", opts.textColor)
                    .style("font-size", `${opts.fontSize}px`).style("font-weight", opts.fontWeight)
                    .attr("class", "label").text(group);
                
                currentX += itemWidths[i] + opts.itemSpacing;
            });
        });
        
        return { width: maxRowWidth, height: totalHeight };
    };

    // 计算颜色亮度
    const getColorBrightness = (hexColor) => {
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    };

    // 数据准备
    const jsonData = data;
    const chartData = jsonData.data.data || [];
    const variables = jsonData.variables || {};
    const dataColumns = jsonData.data.columns || [];
    const typography = jsonData.typography || {
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#333333", field: {}, other: { primary: "#4682B4" }
    };

    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 80, right: 40, bottom: 20, left: 40 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 计算半圆参数
    const centerX = width / 2;
    const centerY = height - margin.bottom - 100;
    const maxRadius = Math.min(width - margin.left - margin.right, (height - margin.top - margin.bottom) * 1.2) / 2;
    
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);
    
    // 创建半圆饼图生成器
    const pie = d3.pie()
        .value(d => d[yField])
        .sort(null)
        .startAngle(-Math.PI / 2)
        .endAngle(Math.PI / 2);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(maxRadius)
        .padAngle(0.01)
        .cornerRadius(5);

    // 计算百分比
    const total = d3.sum(chartData, d => d[yField]);
    const dataWithPercentages = chartData.map(d => ({
        ...d,
        percentage: (d[yField] / total) * 100
    }));

    // 绘制半圆扇形
    g.selectAll("path")
        .data(pie(dataWithPercentages))
        .enter()
        .append("path")
        .attr("fill", (d, i) => colors.field[d.data[xField]] || colors.other.primary)
        .attr("d", arc)
        .attr("class", "mark");

    // 添加百分比标签
    const labelArc = d3.arc()
        .innerRadius(maxRadius * 0.7)
        .outerRadius(maxRadius * 0.7);

    g.selectAll("text.value")
        .data(pie(dataWithPercentages))
        .enter()
        .append("text")
        .attr("transform", d => `translate(${labelArc.centroid(d)})`)
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .style("fill", d => {
            const color = colors.field[d.data[xField]] || colors.other.primary;
            const brightness = getColorBrightness(color);
            return brightness > 128 ? "#000000" : "#FFFFFF";
        })
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", "bold")
        .attr("class", "value")
        .text(d => d.data.percentage >= 5 ? `${d.data.percentage.toFixed(1)}%` : '');

    // 添加图例
    const legendGroup = svg.append("g");
    const xs = [...new Set(chartData.map(d => d[xField]))];
    const legendSize = layoutLegend(legendGroup, xs, colors, {
        maxWidth: width - 80,
        fontSize: 12,
        fontWeight: "normal",
        align: "center",
        shape: "rect"
    });

    // 居中放置图例
    legendGroup.attr("transform", `translate(${(width - legendSize.width) / 2}, ${margin.top - 40})`); 
    return svg.node();
}

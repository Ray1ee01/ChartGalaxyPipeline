/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Semicircle Pie Charts",
    "chart_name": "small_multiple_semicircle_pie_plain_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 9]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "radius_corner", "stroke"],
    "min_height": 400,
    "min_width": 600,
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
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || {
        text_color: "#333333", field: {}, other: { primary: "#4682B4" }
    };

    // 清空容器
    d3.select(containerSelector).html("");

    // 提取字段名
    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    const width = variables.width || 600;
    const height = variables.height || 400;
    const margin = { top: 90, right: 30, bottom: 30, left: 30 };

    // 按分组字段分组数据
    const groupedByGroup = d3.group(chartData, d => d[groupField]);
    const groupArray = Array.from(groupedByGroup, ([key, values]) => ({
        group: key,
        values: values,
        total: d3.sum(values, d => d[yField])
    })).sort((a, b) => a.group.localeCompare(b.group));

    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");

    // 创建图例，固定在50px高度开始
    const allXValues = [...new Set(chartData.map(d => d[xField]))];
    const legend = svg.append("g").attr("class", "legend");
    const legendSize = layoutLegend(legend, allXValues, colors, {
        maxWidth: width - 80,
        fontSize: 12,
        fontWeight: "normal",
        align: "center",
        shape: "rect"
    });

    // 图例固定位置：从50px高度开始，水平居中
    legend.attr("transform", `translate(${(width - legendSize.width) / 2}, 50)`);

    // 优化网格布局逻辑
    const numCharts = groupArray.length;
    let rows, cols;

    if (numCharts === 2) {
        // 2个图：1×2布局
        rows = 1;
        cols = 2;
    } else if (numCharts <= 4) {
        // 3-4个图：2×2布局
        rows = 2;
        cols = 2;
    } else if (numCharts <= 6) {
        // 5-6个图：3×2布局
        rows = 3;
        cols = 2;
    } else {
        // 7-9个图：3×3布局
        rows = 3;
        cols = 3;
    }

    // 计算每行的图表数量
    const itemsPerRow = [];
    for (let i = 0; i < rows; i++) {
        const startIndex = i * cols;
        const endIndex = Math.min(startIndex + cols, numCharts);
        const itemsInThisRow = endIndex - startIndex;
        if (itemsInThisRow > 0) {
            itemsPerRow.push(itemsInThisRow);
        }
    }

    // 计算每个图表的可用空间
    const chartAreaWidth = width - margin.left - margin.right;
    const chartAreaHeight = height - margin.top - margin.bottom;
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows;

    // 计算图表半径，确保半圆能完全显示
    const radius = Math.min(cellWidth / 2.4, cellHeight / 1.8) - 15;

    // 创建多个半圆饼图
    let dataIndex = 0;
    for (let row = 0; row < itemsPerRow.length; row++) {
        const itemsInThisRow = itemsPerRow[row];
        // 计算行的水平居中偏移
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let col = 0; col < itemsInThisRow; col++) {
            if (dataIndex >= numCharts) break;

            const groupData = groupArray[dataIndex];
            
            // 计算当前图表的中心位置，半圆在margin.top下面的区域
            const chartCenterX = margin.left + rowOffset + (col + 0.5) * cellWidth;
            const chartCenterY = margin.top + (row + 0.7) * cellHeight;

            // 创建单个图表组
            const chartGroup = svg.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            // 创建半圆饼图生成器
            const pie = d3.pie()
                .value(d => d[yField])
                .sort(null)
                .startAngle(-Math.PI / 2)
                .endAngle(Math.PI / 2);

            const arc = d3.arc()
                .innerRadius(0)
                .outerRadius(radius)
                .padAngle(0.02)
                .cornerRadius(2);

            // 计算百分比
            const total = d3.sum(groupData.values, d => d[yField]);
            const dataWithPercentages = groupData.values.map(d => ({
                ...d,
                percentage: (d[yField] / total) * 100
            }));

            // 绘制半圆扇形
            chartGroup.selectAll("path")
                .data(pie(dataWithPercentages))
                .enter()
                .append("path")
                .attr("fill", d => colors.field[d.data[xField]] || colors.other.primary)
                .attr("d", arc)
                .attr("class", "mark");

            // 添加百分比标签（只为较大的扇形添加）
            const labelArc = d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius * 0.6);

            chartGroup.selectAll("text.value")
                .data(pie(dataWithPercentages))
                .enter()
                .append("text")
                .attr("transform", d => {
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / Math.PI; // 半圆的比例
                    if (percent > 0.12) { // 只为占比超过12%的扇形添加标签
                        return `translate(${labelArc.centroid(d)})`;
                    } else {
                        return "translate(-1000, -1000)"; // 隐藏小扇形的标签
                    }
                })
                .attr("text-anchor", "middle")
                .attr("dy", ".35em")
                .style("fill", d => {
                    const color = colors.field[d.data[xField]] || colors.other.primary;
                    const brightness = getColorBrightness(color);
                    return brightness > 128 ? "#000000" : "#FFFFFF";
                })
                .style("font-family", typography.annotation.font_family)
                .style("font-size", "10px")
                .style("font-weight", "bold")
                .attr("class", "value")
                .text(d => {
                    const arcAngle = d.endAngle - d.startAngle;
                    const percent = arcAngle / Math.PI;
                    return percent > 0.12 ? `${d.data.percentage.toFixed(1)}%` : '';
                });

            // 添加分组标签（上方）
            chartGroup.append("text")
                .attr("x", 0)
                .attr("y", -radius - 15)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight)
                .style("fill", colors.text_color || "#333333")
                .attr("class", "label")
                .text(groupData.group);

            dataIndex++;
        }
    }

    return svg.node();
}

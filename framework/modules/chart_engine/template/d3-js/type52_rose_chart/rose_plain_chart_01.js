/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Rose Chart",
    "chart_name": "rose_plain_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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

    const width = variables.width || 500;
    const height = variables.height || 500;
    const margin = { top: 80, right: 50, bottom: 50, left: 50 };

    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");

    // 获取唯一分类值并创建智能图例
    const groups = [...new Set(chartData.map(d => d[xField]))];
    const legendGroup = svg.append("g").attr("class", "other");
    
    // 图例配置
    const legendConfig = {
        itemSpacing: 20, rowSpacing: 15, iconSize: 12, iconTextSpacing: 6,
        maxWidth: width - 100, fontSize: 12
    };
    
    // 测量文本并计算图例布局
    const tempText = legendGroup.append("text").attr("visibility", "hidden")
        .style("font-size", `${legendConfig.fontSize}px`)
        .style("font-family", typography.label.font_family);
    
    const legendItems = groups.map(group => {
        tempText.text(group);
        return {
            label: group,
            color: colors.field[group] || colors.other.primary,
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + tempText.node().getComputedTextLength()
        };
    });
    tempText.remove();
    
    // 自动换行布局
    const rows = [];
    let currentRow = [], currentRowWidth = 0;
    legendItems.forEach(item => {
        const needWidth = currentRowWidth + item.width + (currentRow.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentRow.length === 0 || needWidth <= legendConfig.maxWidth) {
            currentRow.push(item);
            currentRowWidth = needWidth;
        } else {
            rows.push(currentRow);
            currentRow = [item];
            currentRowWidth = item.width;
        }
    });
    if (currentRow.length > 0) rows.push(currentRow);
    
    // 计算图例尺寸并绘制
    const maxRowWidth = Math.max(...rows.map(row => 
        row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0)
    ));
    const legendStartX = (width - maxRowWidth) / 2;
    const legendStartY = 15;
    
    rows.forEach((row, rowIndex) => {
        const rowWidth = row.reduce((sum, item, i) => sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
        let x = legendStartX + (maxRowWidth - rowWidth) / 2;
        const y = legendStartY + rowIndex * (legendConfig.fontSize + legendConfig.rowSpacing);
        
        row.forEach(item => {
            const itemGroup = legendGroup.append("g").attr("transform", `translate(${x}, ${y})`);
            itemGroup.append("circle")
                .attr("cx", legendConfig.iconSize / 2).attr("cy", legendConfig.fontSize / 2)
                .attr("r", legendConfig.iconSize / 2).attr("fill", item.color).attr("class", "mark");
            itemGroup.append("text")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", legendConfig.fontSize / 2).attr("dominant-baseline", "middle")
                .attr("fill", colors.text_color).style("font-size", `${legendConfig.fontSize}px`)
                .style("font-family", typography.label.font_family).attr("class", "label")
                .text(item.label);
            x += item.width + legendConfig.itemSpacing;
        });
    });

    // 计算玫瑰图参数
    const centerX = width / 2;
    const centerY = height / 2 + 10;
    const maxRadius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;
    const innerRadius = maxRadius * 0.15;

    const g = svg.append("g").attr("transform", `translate(${centerX}, ${centerY})`);

    // 创建饼图生成器和弧形生成器
    const pie = d3.pie().value(d => d[yField]).sort(null).padAngle(0.02);
    const maxValue = d3.max(chartData, d => d[yField]);
    const arc = d3.arc().innerRadius(innerRadius)
        .outerRadius(d => {
            const ratio = d.data[yField] / maxValue;
            return innerRadius + (maxRadius - innerRadius) * ratio;
        });

    // 计算百分比并绘制玫瑰图扇形
    const total = d3.sum(chartData, d => d[yField]);
    const dataWithPercentages = chartData.map(d => ({
        ...d, percentage: (d[yField] / total) * 100
    }));

    g.selectAll("path").data(pie(dataWithPercentages)).enter().append("path")
        .attr("fill", d => colors.field[d.data[xField]] || colors.other.primary)
        .attr("d", arc).attr("class", "mark");

    // 添加数值标签
    g.selectAll("text.value").data(pie(dataWithPercentages)).enter().append("text")
        .attr("transform", d => {
            const midAngle = (d.startAngle + d.endAngle) / 2;
            const ratio = d.data[yField] / maxValue;
            const labelRadius = innerRadius + (maxRadius - innerRadius) * ratio * 0.7;
            const x = Math.sin(midAngle) * labelRadius;
            const y = -Math.cos(midAngle) * labelRadius;
            return `translate(${x}, ${y})`;
        })
        .attr("text-anchor", "middle").attr("dy", ".35em")
        .style("fill", d => {
            const color = colors.field[d.data[xField]] || colors.other.primary;
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 128 ? "#000000" : "#FFFFFF";
        })
        .style("font-family", typography.annotation.font_family)
        .style("font-size", "12px").style("font-weight", "bold")
        .attr("class", "value")
        .text(d => d.data.percentage >= 8 ? `${d.data.percentage.toFixed(1)}%` : '');

    return svg.node();
}

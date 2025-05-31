/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Radial Line Charts",
    "chart_name": "small_multiple_radial_line_plain_chart_01",
    "is_composite": false,
    "required_fields": ["group", "x", "y"],
    "required_fields_type": [["categorical"], ["categorical"], ["numerical"]],
    "required_fields_range": [[2, 7], [3, 12], [0, "inf"]],
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
    const chartData = jsonData.data.data;
    const variables = jsonData.variables || {};
    const typography = jsonData.typography || {
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { 
        text_color: "#333333",
        field: {},
        other: { primary: "#1f77b4" }
    };
    const dataColumns = jsonData.data.columns || [];

    // 清空容器
    d3.select(containerSelector).html("");

    // 尺寸和布局设置
    const width = variables.width || 800;
    const height = variables.height || 600;
    const margin = { top: 120, right: 50, bottom: 80, left: 50 };

    // 提取字段名
    const groupField = dataColumns.find(col => col.role === "group")?.name || dataColumns[0].name;
    const categoryField = dataColumns.find(col => col.role === "x")?.name || dataColumns[1].name;
    const valueField = dataColumns.find(col => col.role === "y")?.name || dataColumns[2].name;

    // 数据处理
    let groups = [...new Set(chartData.map(d => d[groupField]))];
    if (groups.length > 6) groups = groups.slice(0, 6);

    const groupedData = {};
    const groupMaxValues = {};
    groups.forEach(group => {
        groupedData[group] = chartData.filter(d => d[groupField] === group);
        groupMaxValues[group] = d3.max(groupedData[group], d => d[valueField]);
    });

    const sortedGroups = [...groups].sort((a, b) => groupMaxValues[b] - groupMaxValues[a]);
    const allValues = chartData.map(d => d[valueField]);
    const maxValue = d3.max(allValues);

    // 获取所有类别并创建颜色比例尺
    let allCategories = [];
    groups.forEach(group => {
        const categoriesInGroup = groupedData[group].map(d => d[categoryField]);
        allCategories = [...allCategories, ...categoriesInGroup];
    });
    allCategories = [...new Set(allCategories)];

    // 创建颜色比例尺
    const categoryColorScale = d3.scaleOrdinal()
        .domain(allCategories)
        .range(allCategories.map((cat, i) => 
            colors.field[cat] || d3.schemeCategory10[i % 10]
        ));

    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建图例
    const legendGroup = svg.append("g").attr("class", "other");
    const legendConfig = {
        itemSpacing: 15, rowSpacing: 8, iconSize: 8, iconTextSpacing: 6,
        maxWidth: width - 100, fontSize: 11
    };

    // 测量文本并计算图例布局
    const legendItems = allCategories.map(cat => {
        return {
            label: cat,
            color: categoryColorScale(cat),
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + getTextWidth(cat, legendConfig.fontSize)
        };
    });

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
    const legendHeight = rows.length * legendConfig.fontSize + (rows.length - 1) * legendConfig.rowSpacing;
    const legendStartX = (width - maxRowWidth) / 2;
    const legendStartY = 20;

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

    // 调整margin.top确保图例不重叠
    margin.top = legendStartY + legendHeight ;

    // 计算网格布局
    const numCharts = groups.length;
    let rows_layout, cols;
    if (numCharts <= 3) {
        rows_layout = 1; cols = numCharts;
    } else if (numCharts === 4) {
        rows_layout = 2; cols = 2;
    } else if (numCharts <= 8) {
        rows_layout = 2; cols = Math.ceil(numCharts / 2);
    } else {
        rows_layout = 3; cols = Math.ceil(numCharts / 3);
    }

    const chartAreaWidth = width - margin.left - margin.right;
    const chartAreaHeight = height - margin.top - margin.bottom;
    const cellWidth = chartAreaWidth / cols;
    const cellHeight = chartAreaHeight / rows_layout;

    // 测量最长组标签
    const groupFontSize = parseFloat(typography.label.font_size);
    let maxGroupWidth = 0;
    groups.forEach(group => {
        const groupWidth = getTextWidth(group, groupFontSize);
        maxGroupWidth = Math.max(maxGroupWidth, groupWidth);
    });

    // 计算间距和半径
    const innerCellWidth = cellWidth * 0.85;
    const innerCellHeight = cellHeight * 0.85;
    const radius = Math.min(innerCellWidth, innerCellHeight) / 2.2;

    // 调整字体大小
    const maxChartAreaWidth = radius * 2.4;
    let groupScaleFactor = 1;
    if (maxGroupWidth > maxChartAreaWidth) {
        groupScaleFactor = maxChartAreaWidth / (maxGroupWidth + 3);
    }
    const adjustedGroupFontSize = `${Math.floor(groupFontSize * groupScaleFactor)}px`;

    // 创建比例尺
    const angleScale = d3.scalePoint()
        .domain(allCategories)
        .range([0, 2 * Math.PI - (2 * Math.PI / allCategories.length)]);

    const radiusScale = d3.scaleLinear()
        .domain([0, maxValue * 1.2])
        .range([0, radius])
        .nice();

    // 雷达折线生成器
    const createLineGenerator = (groupData) => {
        return () => {
            const points = allCategories.map(cat => {
                const point = groupData.find(item => item[categoryField] === cat);
                if (point) {
                    const angle = angleScale(cat) - Math.PI/2;
                    const distance = radiusScale(point[valueField]);
                    return [distance * Math.cos(angle), distance * Math.sin(angle)];
                }
                return [0, 0];
            });
            return d3.line()(points) + "Z";
        };
    };

    // 创建雷达图
    let groupIndex = 0;
    for (let row = 0; row < rows_layout; row++) {
        const itemsInThisRow = row < rows_layout - 1 ? cols : numCharts - cols * (rows_layout - 1);
        const rowOffset = (cols - itemsInThisRow) * cellWidth / 2;

        for (let col = 0; col < itemsInThisRow; col++) {
            if (groupIndex >= numCharts) break;

            const group = sortedGroups[groupIndex];
            const groupData = groupedData[group];

            const chartCenterX = margin.left + rowOffset + (col + 0.5) * cellWidth;
            const chartCenterY = margin.top + (row + 0.5) * cellHeight;

            const chartGroup = svg.append("g")
                .attr("transform", `translate(${chartCenterX}, ${chartCenterY})`);

            // 绘制同心圆网格
            const ticks = radiusScale.ticks(4);
            chartGroup.selectAll(".circle-grid")
                .data(ticks.slice(1))
                .enter()
                .append("circle")
                .attr("class", "gridline")
                .attr("cx", 0).attr("cy", 0)
                .attr("r", d => radiusScale(d))
                .attr("fill", "none")
                .attr("stroke", colors.text_color || "#333")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3")
                .attr("opacity", 0.3);

            // 绘制径向轴线
            chartGroup.selectAll(".axis-line")
                .data(allCategories)
                .enter()
                .append("line")
                .attr("class", "axis")
                .attr("x1", 0).attr("y1", 0)
                .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI/2))
                .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI/2))
                .attr("stroke", colors.text_color || "#333")
                .attr("stroke-width", 1)
                .attr("opacity", 0.5);

            // 绘制雷达折线（细线，无填充）
            const lineGenerator = createLineGenerator(groupData);
            chartGroup.append("path")
                .attr("class", "mark")
                .attr("d", lineGenerator())
                .attr("fill", "none")
                .attr("stroke", colors.other.primary)
                .attr("stroke-width", 1.5)
                .attr("stroke-linejoin", "round");

            // 绘制数据点和标签
            allCategories.forEach(cat => {
                const point = groupData.find(item => item[categoryField] === cat);
                if (point) {
                    const angle = angleScale(cat) - Math.PI/2;
                    const distance = radiusScale(point[valueField]);
                    const pointColor = categoryColorScale(cat);
                    
                    // 数据点
                    chartGroup.append("circle")
                        .attr("class", "mark")
                        .attr("cx", distance * Math.cos(angle))
                        .attr("cy", distance * Math.sin(angle))
                        .attr("r", 3)
                        .attr("fill", pointColor)
                        .attr("stroke", "#fff")
                        .attr("stroke-width", 1);

                    // 数值标签（所有点都添加，放在径向外侧）
                    const labelText = point[valueField].toString();
                    const labelDistance = Math.max(distance + 12, 24);
                    const textX = labelDistance * Math.cos(angle);
                    const textY = labelDistance * Math.sin(angle);

                    chartGroup.append("text")
                        .attr("class", "value")
                        .attr("x", textX).attr("y", textY)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("font-size", typography.annotation.font_size)
                        .attr("font-weight", "bold")
                        .attr("fill", pointColor)
                        .text(labelText);
                }
            });

            // 添加组标题
            chartGroup.append("text")
                .attr("class", "label")
                .attr("x", 0).attr("y", -radius - 20)
                .attr("text-anchor", "middle")
                .style("font-family", typography.label.font_family)
                .style("font-size", adjustedGroupFontSize)
                .style("font-weight", "bold")
                .style("fill", colors.text_color || "#333")
                .text(group);

            groupIndex++;
        }
    }

    return svg.node();
} 
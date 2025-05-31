/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Gauge Chart",
    "chart_name": "gauge_chart_plain_chart_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[1, 5], [0, "inf"]],
    "required_fields_icons": [], 
    "required_other_icons": [],
    "required_fields_colors": ["x"], 
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow"],
    "min_height": 300, 
    "min_width": 300,  
    "background": "light",
    "icon_mark": "none", 
    "icon_label": "none",   
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
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
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 设置尺寸和边距
    const { width, height } = variables;
    const margin = { top: 80, right: 30, bottom: 40, left: 30 }; // 增加top margin用于图例
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 获取唯一X分类和对应数据
    const categoryData = [];
    const uniqueXCategories = [...new Set(chartData.map(d => d[xField]))];
    
    uniqueXCategories.forEach(xCategory => {
        const item = chartData.find(d => d[xField] === xCategory);
        if (item) {
            categoryData.push({
                category: xCategory,
                value: +item[yField],
                color: colors.field?.[xCategory] || colors.other?.primary || "#1f77b4"
            });
        }
    });
    
    // 按值从大到小排序，外层显示较大值
    categoryData.sort((a, b) => b.value - a.value);
    
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
        itemSpacing: 15, rowSpacing: 8, iconSize: 10, iconTextSpacing: 5,
        maxWidth: width - 60, fontSize: 12
    };
    
    // 测量文本并计算图例布局
    const tempText = legendGroup.append("text").attr("visibility", "hidden")
        .style("font-size", `${legendConfig.fontSize}px`);
    
    const legendItems = categoryData.map(d => {
        tempText.text(d.category);
        return {
            label: d.category,
            color: d.color,
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
    
    // 绘制图例
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
                .attr("fill", colors.text_color || "#333").style("font-size", `${legendConfig.fontSize}px`)
                .attr("class", "label").text(item.label);
            x += item.width + legendConfig.itemSpacing;
        });
    });
    
    const chartArea = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 计算仪表盘参数
    const centerX = chartWidth / 2;
    const centerY = chartHeight * 0.5; // 调整中心位置
    const maxRadius = Math.min(chartWidth, chartHeight * 0.9) / 2;
    const arcThickness = Math.max(12, maxRadius / (categoryData.length + 1)); // 根据层数调整厚度
    const gapBetweenLayers = Math.max(4, arcThickness * 0.2); // 增大层间间隙，根据圆弧厚度动态调整
    
    // 计算最大值用于角度比例尺
    const globalMaxValue = Math.max(...categoryData.map(d => d.value)); // 移除100的限制，使用实际最大值
    const angleScale = d3.scaleLinear().domain([0, globalMaxValue]).range([0, Math.PI]); // 0到180度
    
    const startAngle = -Math.PI / 2; // 12点钟位置
    const endAngle = Math.PI / 2;    // 6点钟位置
    
    // 创建主仪表盘组
    const gaugeGroup = chartArea.append("g")
        .attr("class", "other")
        .attr("transform", `translate(${centerX}, ${centerY})`);
    
    // 为每个类别创建同心圆弧
    categoryData.forEach((d, i) => {
        const outerRadius = maxRadius - i * (arcThickness + gapBetweenLayers);
        const innerRadius = outerRadius - arcThickness;
        
        // 背景弧（深灰色，完整半圆）
        const backgroundArc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(startAngle)
            .endAngle(endAngle);
        
        gaugeGroup.append("path")
            .attr("class", "mark")
            .attr("d", backgroundArc)
            .attr("fill", "#666666")
            .attr("opacity", 0.3);
        
        // 数值弧（彩色）
        const valueArc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(startAngle);
        
        // 计算目标角度
        const targetAngle = startAngle + angleScale(d.value);
        
        const valuePath = gaugeGroup.append("path")
            .attr("class", "mark")
            .attr("fill", d.color)
            .style("filter", variables.has_shadow ? "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" : "none");
        
        // 立即设置最终状态（无动画版本）
        const finalArcData = {
            startAngle: startAngle,
            endAngle: targetAngle
        };
        
        valuePath
            .datum(finalArcData)
            .attr("d", valueArc);
        
        // 数值标签定位到圆弧径向中心，9点钟方向下方
        const labelRadius = (innerRadius + outerRadius) / 2; // 圆弧径向宽度的中间位置
        const labelAngle = Math.PI; // 9点钟方向角度
        const labelX = labelRadius * Math.cos(labelAngle);
        const labelY = labelRadius * Math.sin(labelAngle) + arcThickness * 0.5; // 向下偏移，基于字体大小
        
        // 根据圆弧厚度自适应字体大小，确保文本不会溢出
        const maxFontSize = Math.min(arcThickness * 0.6, 16);
        const minFontSize = Math.max(8, arcThickness * 0.3);
        let fontSize = maxFontSize;
        
        // 创建临时文本元素测量宽度
        const tempText = gaugeGroup.append("text")
            .attr("visibility", "hidden")
            .style("font-size", fontSize + "px")
            .style("font-weight", "bold")
            .text(formatValue(d.value));
        
        const textWidth = tempText.node().getComputedTextLength();
        const availableWidth = arcThickness * 1.5; // 允许的文本宽度
        
        // 如果文本太宽，调整字体大小
        if (textWidth > availableWidth) {
            fontSize = Math.max(minFontSize, fontSize * availableWidth / textWidth);
        }
        
        tempText.remove();
        
        gaugeGroup.append("text")
            .attr("class", "value")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", fontSize + "px")
            .attr("font-weight", "bold")
            .attr("fill", d.color)
            .text(formatValue(d.value));
    });
    
    return svg.node();
} 
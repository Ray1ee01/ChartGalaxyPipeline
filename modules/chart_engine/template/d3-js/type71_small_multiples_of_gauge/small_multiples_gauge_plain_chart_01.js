/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Gauge Chart",
    "chart_name": "small_multiples_gauge_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 9], [0, "inf"], [2, 3]],
    "required_fields_icons": [], 
    "required_other_icons": [],
    "required_fields_colors": ["group"], 
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400, 
    "min_width": 600,  
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
    const groupField = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 20, bottom: 20, left: 20 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 获取唯一的x值和group值
    const uniqueXValues = [...new Set(chartData.map(d => d[xField]))];
    const uniqueGroups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 计算每个group的全局总值，用于确定统一的排序顺序
    const groupTotals = {};
    uniqueGroups.forEach(group => {
        groupTotals[group] = chartData
            .filter(d => d[groupField] === group)
            .reduce((sum, d) => sum + (+d[yField]), 0);
    });
    
    // 按全局总值从大到小排序group，确保所有子图顺序一致
    const sortedGroups = uniqueGroups.sort((a, b) => groupTotals[b] - groupTotals[a]);
    
    // 按x分组数据
    const groupedData = {};
    uniqueXValues.forEach(xValue => {
        groupedData[xValue] = [];
        sortedGroups.forEach(group => {
            const item = chartData.find(d => d[xField] === xValue && d[groupField] === group);
            if (item) {
                groupedData[xValue].push({
                    group: group,
                    value: +item[yField],
                    color: colors.field?.[group] || colors.other?.primary || "#1f77b4"
                });
            }
        });
        // 移除单独排序，使用统一的sortedGroups顺序
    });
    
    // 计算全局最大值，确保所有子图刻度一致
    const globalMaxValue = Math.max(...chartData.map(d => +d[yField]));
    const angleScale = d3.scaleLinear().domain([0, globalMaxValue]).range([0, Math.PI]);
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建group图例
    const legendGroup = svg.append("g").attr("class", "other");
    const legendConfig = { itemSpacing: 15, iconSize: 10, iconTextSpacing: 5, fontSize: 12 };
    
    // 测量文本并计算图例布局
    const tempText = legendGroup.append("text").attr("visibility", "hidden")
        .style("font-size", `${legendConfig.fontSize}px`);
    
    const legendItems = sortedGroups.map(group => {
        tempText.text(group);
        return {
            label: group,
            color: colors.field?.[group] || colors.other?.primary || "#1f77b4",
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + tempText.node().getComputedTextLength()
        };
    });
    tempText.remove();
    
    // 绘制图例
    const totalLegendWidth = legendItems.reduce((sum, item, i) => 
        sum + item.width + (i > 0 ? legendConfig.itemSpacing : 0), 0);
    const legendStartX = (width - totalLegendWidth) / 2;
    let legendX = legendStartX;
    
    legendItems.forEach(item => {
        const itemGroup = legendGroup.append("g").attr("transform", `translate(${legendX}, 15)`);
        itemGroup.append("circle")
            .attr("cx", legendConfig.iconSize / 2).attr("cy", legendConfig.fontSize / 2)
            .attr("r", legendConfig.iconSize / 2).attr("fill", item.color).attr("class", "mark");
        itemGroup.append("text")
            .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
            .attr("y", legendConfig.fontSize / 2).attr("dominant-baseline", "middle")
            .attr("fill", colors.text_color || "#333").style("font-size", `${legendConfig.fontSize}px`)
            .attr("class", "label").text(item.label);
        legendX += item.width + legendConfig.itemSpacing;
    });
    
    // 优化网格布局逻辑
    const numCharts = uniqueXValues.length;
    let rows, cols;
    
    if (numCharts === 2) {
        rows = 1; cols = 2;
    } else if (numCharts <= 4) {
        rows = 2; cols = 2;
    } else if (numCharts <= 6) {
        rows = 3; cols = 2;
    } else {
        rows = 3; cols = 3;
    }
    
    const subChartWidth = chartWidth / cols;
    const subChartHeight = chartHeight / rows;
    const chartArea = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 为每个x值创建子图
    uniqueXValues.forEach((xValue, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const subChartX = col * subChartWidth;
        const subChartY = row * subChartHeight;
        
        const subChart = chartArea.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${subChartX}, ${subChartY})`);
        
        // 计算仪表盘参数 - 优化空间利用
        const centerX = subChartWidth / 2;
        const centerY = subChartHeight * 0.75; // 圆心下移，给标签留更少空间
        // 增大半圆占用比例，减少边距浪费
        const maxRadius = Math.min(subChartWidth * 0.95, (subChartHeight - 30) * 0.8) / 2; // 宽度用95%，高度考虑标签后用80%
        const categoryData = groupedData[xValue];
        const arcThickness = Math.max(8, maxRadius / (categoryData.length + 1));
        const gapBetweenLayers = Math.max(2, arcThickness * 0.15);
        
        // 添加x标签，紧贴在半圆上方
        const labelY = centerY - maxRadius - 8; // 减小标签与半圆的间距
        subChart.append("text")
            .attr("x", subChartWidth / 2)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", colors.text_color || "#333")
            .attr("class", "label")
            .text(xValue);
        
        const startAngle = -Math.PI / 2;
        const endAngle = Math.PI / 2;
        
        const gaugeGroup = subChart.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${centerX}, ${centerY})`);
        
        // 为每个group创建同心圆弧
        categoryData.forEach((d, i) => {
            const outerRadius = maxRadius - i * (arcThickness + gapBetweenLayers);
            const innerRadius = outerRadius - arcThickness;
            
            // 背景弧
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
            
            // 数值弧
            const valueArc = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startAngle);
            
            const targetAngle = startAngle + angleScale(d.value);
            
            gaugeGroup.append("path")
                .attr("class", "mark")
                .attr("d", valueArc({
                    startAngle: startAngle,
                    endAngle: targetAngle
                }))
                .attr("fill", d.color)
                .style("filter", variables.has_shadow ? "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" : "none");
            
            // 数值标签
            const labelRadius = (innerRadius + outerRadius) / 2;
            const labelAngle = Math.PI;
            const labelX = labelRadius * Math.cos(labelAngle);
            const labelY = labelRadius * Math.sin(labelAngle) + arcThickness * 0.5;
            
            const maxFontSize = Math.min(arcThickness * 0.6, 12);
            const minFontSize = Math.max(5, arcThickness * 0.3);
            let fontSize = maxFontSize;
            
            const tempText = gaugeGroup.append("text")
                .attr("visibility", "hidden")
                .style("font-size", fontSize + "px")
                .style("font-weight", "bold")
                .text(formatValue(d.value));
            
            const textWidth = tempText.node().getComputedTextLength();
            const availableWidth = arcThickness * 1.5;
            
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
    });
    
    return svg.node();
} 
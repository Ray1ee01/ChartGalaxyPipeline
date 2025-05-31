/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Small Multiples of Gauge Chart",
    "chart_name": "small_multiples_gauge_plain_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 9], [0, "inf"]],
    "required_fields_icons": [], 
    "required_other_icons": [],
    "required_fields_colors": [], 
    "required_other_colors": ["primary"],
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
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 50, right: 20, bottom: 30, left: 20 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 获取唯一的x值并处理数据
    const uniqueXValues = [...new Set(chartData.map(d => d[xField]))];
    const processedData = uniqueXValues.map(xValue => {
        const item = chartData.find(d => d[xField] === xValue);
        return {
            category: xValue,
            value: +item[yField],
            color: colors.other?.primary || "#1f77b4"
        };
    });
    
    // 计算全局最大值，确保所有子图刻度一致
    const globalMaxValue = Math.max(...processedData.map(d => d.value));
    const angleScale = d3.scaleLinear().domain([0, globalMaxValue]).range([0, Math.PI * 1.5]); // 0到270度
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 优化网格布局逻辑
    const numCharts = uniqueXValues.length;
    let rows, cols;
    
    if (numCharts === 2) {
        rows = 1; cols = 2;
    } else if (numCharts <= 4) {
        rows = 2; cols = 2;
    } else if (numCharts <= 6) {
        rows = 2; cols = 3;
    } else {
        rows = 3; cols = 3;
    }
    
    const subChartWidth = chartWidth / cols;
    const subChartHeight = chartHeight / rows;
    const chartArea = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 为每个x值创建子图
    processedData.forEach((d, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const subChartX = col * subChartWidth;
        const subChartY = row * subChartHeight;
        
        const subChart = chartArea.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${subChartX}, ${subChartY})`);
        
        // 计算仪表盘参数 - 优化空间利用，增加内边距
        const subMargin = 20; // 子图内边距
        const centerX = subChartWidth / 2;
        const centerY = subChartHeight / 2; // 270度圆弧需要更居中的位置
        const maxRadius = Math.min((subChartWidth - subMargin * 2) * 0.9, (subChartHeight - subMargin * 2) * 0.9) / 2; // 考虑内边距后的半径
        const arcThickness = Math.max(12, maxRadius * 0.25); // 单个圆弧可以更厚
        
        // 添加x标签，在圆弧上方
        const labelY = centerY - maxRadius - 15;
        subChart.append("text")
            .attr("x", subChartWidth / 2)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", colors.text_color || "#333")
            .attr("class", "label")
            .text(d.category);
        
        // 270度角度设置：从-135度到135度
        const startAngle = -Math.PI * 0.75; // -135度
        const endAngle = Math.PI * 0.75;    // 135度
        
        const gaugeGroup = subChart.append("g")
            .attr("class", "other")
            .attr("transform", `translate(${centerX}, ${centerY})`);
        
        const outerRadius = maxRadius;
        const innerRadius = outerRadius - arcThickness;
        
        // 背景弧（270度完整圆弧）
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
            .attr("fill", d.color);
        
        // 数值标签紧贴在270度圆弧开口下方
        const valueLabelY = centerY + innerRadius + 15; // 圆弧开口位置下方15px
        subChart.append("text")
            .attr("class", "value")
            .attr("x", centerX)
            .attr("y", valueLabelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .attr("fill", d.color)
            .text(formatValue(d.value));
    });
    
    return svg.node();
} 
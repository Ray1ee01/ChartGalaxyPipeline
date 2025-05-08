/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Circular Bar Chart",
    "chart_name": "circular_bar_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    
    // 数值单位规范
    // 添加数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }
    
    // Clear container
    d3.select(containerSelector).html("");
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 获取单位信息
    let valueUnit = "";
    const valueCol = dataColumns.find(col => col.role === "y");
    if (valueCol && valueCol.unit && valueCol.unit !== "none") {
        valueUnit = valueCol.unit;
    }
    
    // 按yField降序排序数据
    chartData.sort((a, b) => b[yField] - a[yField]);

    
    // Set dimensions and margins
    const width = variables.width*2;
    const height = variables.height*2;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");

    // Create a root group to center everything
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 为每个柱子创建渐变
    const defs = svg.append("defs");
    
    // 添加图标pattern定义
    chartData.forEach((d, i) => {
        const iconId = `icon${i}`;
        const pattern = defs.append("pattern")
            .attr("id", iconId)
            .attr("width", 30)
            .attr("height", 30)
            .attr("patternUnits", "userSpaceOnUse");
            
        if (jsonData.images && jsonData.images[d[xField]]) {
            pattern.append("image")
                .attr("href", jsonData.images[d[xField]])
                .attr("width", 30)
                .attr("height", 30);
        } else {
            pattern.append("circle")
                .attr("cx", 15)
                .attr("cy", 15)
                .attr("r", 12)
                .attr("fill", "#008866");
        }
    });

    // Define center point of the entire visualization
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Define panel dimensions with adjusted left edge
    const panelLeft = centerX + 100;  // Left edge moved to the right of center
    const panelRight = width - 50;    // Right edge of panel
    const panelTop = centerY - 200;   // Top edge of panel
    const panelBottom = centerY + 200; // Bottom edge of panel
    const radius = 200;               // Radius of semicircle
    const barPadding = 50;            // Increased padding between semicircle and bars
    const rankRadius = radius + 20;   // Radius for rank numbers (now outside the semicircle)
    
    // Calculate the center of the semicircle
    const semicircleX = panelLeft;
    const semicircleY = (panelTop + panelBottom) / 2;
    const maxRadius = 700;

    
    // Define angles for both background lines and bars
    const startAngle = Math.PI/2;  // Start from top (90 degrees)
    const endAngle = -Math.PI/2;   // End at bottom (-90 degrees)
    const angleStep = (startAngle - endAngle) / (chartData.length - 1);
    const barWidth = 20;
    
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const gradientId = `barGradient${i}`;
        
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", semicircleX)
            .attr("y1", semicircleY)
            .attr("x2", semicircleX - maxRadius * Math.cos(angle))
            .attr("y2", semicircleY - maxRadius * Math.sin(angle));

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#008866")
            .attr("stop-opacity", 1);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#008866")
            .attr("stop-opacity", 0.3);
    });

    // Add soft background grid lines aligned with the data points
    for (let i = 0; i < chartData.length; i++) {
        const angle = startAngle - i * angleStep;
        g.append("line")
            .attr("x1", semicircleX)
            .attr("y1", semicircleY)
            .attr("x2", semicircleX - maxRadius * Math.cos(angle))
            .attr("y2", semicircleY - maxRadius * Math.sin(angle))
            .attr("stroke", "#dddddd")
            .attr("stroke-width", barWidth)
            .attr("opacity", 0.5)
            .attr("stroke-linecap", "round");
    }
    
    // 创建灰色背景面板
    g.append("path")
        .attr("d", `
            M ${panelLeft},${panelTop - maxRadius*0.8}
            L ${panelRight + maxRadius},${panelTop - maxRadius*0.8} 
            L ${panelRight + maxRadius},${panelBottom + maxRadius*0.8}
            L ${panelLeft},${panelBottom + maxRadius*0.8}
            A ${radius + maxRadius*0.8},${radius + maxRadius*0.8} 0 0,1 ${panelLeft},${panelTop - maxRadius*0.8}
            Z
        `)
        .attr("fill", "#dddddd")
        .attr("opacity", 0.25)
        .attr("stroke", "none");

    // 创建绿色前景面板
    g.append("path")
        .attr("d", `
            M ${panelLeft},${panelTop}
            L ${panelRight},${panelTop}
            L ${panelRight},${panelBottom}
            L ${panelLeft},${panelBottom}
            A ${radius},${radius} 0 0,1 ${panelLeft},${panelTop}
            Z
        `)
        .attr("fill", "#00995e")
        .attr("stroke", "none");
    
    // Create scale for bar lengths
    const barScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField])])
        .range([0, 300]);
    
    
    // Add rank numbers outside the semicircle
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const rankX = semicircleX - rankRadius * Math.cos(angle);
        const rankY = semicircleY - rankRadius * Math.sin(angle);
        
        // White circle background for rank numbers
        g.append("circle")
            .attr("cx", rankX)
            .attr("cy", rankY)
            .attr("r", 14)
            .attr("fill", "white")
            .attr("stroke", "#cccccc")
            .attr("stroke-width", 1);
            
        // Rank number
        g.append("text")
            .attr("x", rankX)
            .attr("y", rankY)
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "20px")
            .attr("fill", "#666")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(i+1);
    });
    
    // 添加环形刻度
    const tickCount = 5; // 刻度数量
    const maxValue = d3.max(chartData, d => d[yField]);
    const tickStep = maxValue / tickCount;
    
    for(let i = 1; i <= tickCount; i++) {
        const tickRadius = radius + barPadding + barScale(tickStep * i);
        
        // 绘制环形刻度线
        g.append("path")
            .attr("d", d3.arc()
                .innerRadius(tickRadius)
                .outerRadius(tickRadius)
                .startAngle(Math.PI)
                .endAngle(2*Math.PI))
            .attr("transform", `translate(${semicircleX},${semicircleY})`)
            .attr("stroke", "#ddd")
            .attr("stroke-width", 1)
            .attr("fill", "none");
            
        // 添加刻度值
        g.append("text")
            .attr("x", semicircleX + 20)  // 将刻度值放在右侧
            .attr("y", semicircleY - tickRadius)
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "16px")
            .attr("fill", "#666")
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .text(formatValue(Math.round(tickStep * i)) + valueUnit);
    }

    // Add the CO2 emission bars with padding
    g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("line")
        .attr("x1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return semicircleX - (radius + barPadding) * Math.cos(angle);
        })
        .attr("y1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return semicircleY - (radius + barPadding) * Math.sin(angle);
        })
        .attr("x2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return semicircleX - (radius + barPadding + barLength) * Math.cos(angle);
        })
        .attr("y2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return semicircleY - (radius + barPadding + barLength) * Math.sin(angle);
        })
        .attr("stroke-width", barWidth)
        .attr("stroke-linecap", "round")
        .attr("stroke", (d, i) => `url(#barGradient${i})`);
        
    // 添加柱子顶端的图标
    g.selectAll(".bar-icon")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("cx", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return semicircleX - (radius + barPadding + barLength) * Math.cos(angle);
        })
        .attr("cy", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return semicircleY - (radius + barPadding + barLength) * Math.sin(angle);
        })
        .attr("r", 14)
        .attr("fill", "#ffffff");
        
    // Add value labels
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;

        const barLength = barScale(d[yField]);

        
        // Position value label at the end of each bar
        const labelX = semicircleX - (radius + barPadding + barLength + 20) * Math.cos(angle);
        const labelY = semicircleY - (radius + barPadding + barLength + 20) * Math.sin(angle);
        
        
        // Add value label
        const labelText = `${d[xField]}: ${formatValue(d[yField])}${valueUnit}`;
        const textWidth = labelText.length * 16; // 估算文字宽度
      
        const totalRadius = radius + barPadding + barLength;
        console.log(labelText);
        console.log(totalRadius);

        let adjustedLabelX, adjustedLabelY;
        if (totalRadius > maxRadius) {
            // 如果文字宽度超出bar长度,则显示在bar内部
            adjustedLabelX = textWidth > barLength ? 
                semicircleX + (radius + barPadding + barLength - 20) * Math.cos(angle) :
                labelX;
            adjustedLabelY = textWidth > barLength ?
                semicircleY + (radius + barPadding + barLength - 20) * Math.sin(angle) :
                labelY;
        } else {
            adjustedLabelX = labelX;
            adjustedLabelY = labelY;
        }
            
        g.append("text")
            .attr("x", adjustedLabelX)
            .attr("y", adjustedLabelY) 
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "20px")
            .attr("font-weight", "bold")
            .attr("fill", "#005540")
            .attr("text-anchor", totalRadius > maxRadius ? "start" : "end")
            .attr("dominant-baseline", "middle")
            .attr("transform", () => {
                // Rotate text based on angle
                const rotation = (angle * 180 / Math.PI);
                return `rotate(${rotation}, ${adjustedLabelX}, ${adjustedLabelY})`;
            })
            .text(labelText);
    });
    
    let titleText = jsonData.titles.main_title;
    let subtitleText = jsonData.titles.sub_title;
    
    // 将标题分成3行
    let titleWords = titleText.split(" ");
    let ntitleWords = Math.ceil(titleWords.length / 3);
    let titleLine1 = titleWords.slice(0, ntitleWords).join(" ");
    let titleLine2 = titleWords.slice(ntitleWords, ntitleWords * 2).join(" ");
    let titleLine3 = titleWords.slice(ntitleWords * 2).join(" ");

    // 将副标题分成6行
    let subtitleWords = subtitleText.split(" ");
    let nsubtitleWords = Math.ceil(subtitleWords.length / 6);
    let subtitleLines = [];
    for(let i = 0; i < 6; i++) {
        subtitleLines[i] = subtitleWords.slice(i * nsubtitleWords, (i + 1) * nsubtitleWords).join(" ");
    }

    // 计算总高度以实现垂直居中
    const titleLineHeight = 40; // 标题行高
    const subtitleLineHeight = 30; // 副标题行高
    const totalHeight = (3 * titleLineHeight) + (6 * subtitleLineHeight);
    const startY = centerY - (totalHeight / 2) + 50;

    // 绘制标题
    g.append("text")
        .attr("x", panelLeft - 50)
        .attr("y", startY)
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "27px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("text-anchor", "start")
        .text(titleLine1);

    g.append("text")
        .attr("x", panelLeft - 50)
        .attr("y", startY + titleLineHeight)
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "42px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("text-anchor", "start")
        .text(titleLine2);

    g.append("text")
        .attr("x", panelLeft - 50)
        .attr("y", startY + (2 * titleLineHeight))
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "30px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("text-anchor", "start")
        .text(titleLine3);

    // 绘制副标题
    let subtitleStartY = startY + (3 * titleLineHeight);
    subtitleLines.forEach((line, i) => {
        g.append("text")
            .attr("x", panelLeft - 50)
            .attr("y", subtitleStartY + (i * subtitleLineHeight))
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "24px")
            .attr("fill", "white")
            .attr("text-anchor", "start")
            .text(line);
    });
    return svg.node();
}
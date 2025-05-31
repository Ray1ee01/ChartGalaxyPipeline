/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Circular Bar Chart",
    "chart_name": "circular_bar_plain_chart_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[15, 30], [0, 100]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "has_title": 1,
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 按yField降序排序数据
    chartData.sort((a, b) => b[yField] - a[yField]);

    // 设置尺寸和边距
    const width = 1000;
    const height = 1200;
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建根组来居中所有内容
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 为每个柱子创建渐变
    const defs = svg.append("defs");
    
    // 定义中心点
    const centerX = width / 2;
    const centerY = height / 2;
    
    const rectWidth = 300;
    const halfCircleRadius = 200;

    const halfCircleRight = width - margin.right - rectWidth;
    const halfCircleLeft = halfCircleRight - halfCircleRadius;
    const halfCircleTop = height/2 - halfCircleRadius;
    const halfCircleBottom = height/2 + halfCircleRadius;
    const halfCircleX = halfCircleRight;
    const halfCircleY = height/2;
    const backgroundRadius = height/2;
    const backgroundTop = height/2 - backgroundRadius;
    const backgroundBottom = height/2 + backgroundRadius;
    const backgroundX = halfCircleX;
    const backgroundY = halfCircleY;

    // 定义角度
    const startAngle = Math.PI/2;
    const endAngle = -Math.PI/2;
    const angleStep = (startAngle - endAngle) / (chartData.length - 1);
    const barWidth = 30;
    const rankRadius = halfCircleRadius + 25;
    const innerRadius = rankRadius + 40;

    // 创建条形长度比例尺
    const barScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField])])
        .range([0, backgroundRadius - innerRadius]);

    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const gradientId = `barGradient${i}`;
        
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("gradientUnits", "userSpaceOnUse");
            
        // 添加渐变变换，使渐变方向与柱子方向一致
        const x1 = halfCircleX - innerRadius * Math.cos(angle);
        const y1 = halfCircleY - innerRadius * Math.sin(angle);
        const x2 = halfCircleX - (innerRadius + barScale(d[yField])) * Math.cos(angle);
        const y2 = halfCircleY - (innerRadius + barScale(d[yField])) * Math.sin(angle);
        
        gradient
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2);

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#008866")
            .attr("stop-opacity", 1);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#008866")
            .attr("stop-opacity", 0.3);
    });

    // 添加背景网格线
    for (let i = 0; i < chartData.length; i++) {
        const angle = startAngle - i * angleStep;
        g.append("line")
            .attr("class", "gridline")
            .attr("x1", halfCircleX)
            .attr("y1", halfCircleY)
            .attr("x2", halfCircleX - (backgroundRadius-20) * Math.cos(angle))
            .attr("y2", halfCircleY - (backgroundRadius-20) * Math.sin(angle))
            .attr("stroke", "#dddddd")
            .attr("stroke-width", barWidth)
            .attr("opacity", 1)
            .attr("stroke-linecap", "round");
    }

    // 创建灰色背景面板
    g.append("path")
        .attr("class", "background")
        .attr("d", `
            M ${backgroundX},${backgroundTop}
            L ${backgroundX + backgroundRadius},${backgroundTop} 
            L ${backgroundX + backgroundRadius},${backgroundBottom}
            L ${backgroundX},${backgroundBottom}
            A ${backgroundRadius},${backgroundRadius} 0 0,1 ${backgroundX},${backgroundTop}
            Z
        `)
        .attr("fill", "#dddddd")
        .attr("opacity", 0.25)
        .attr("stroke", "none");

    // 创建面板渐变和效果
    const panelGradientId = "panelGradient";
    defs.append("linearGradient")
        .attr("id", panelGradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%")
        .attr("gradientUnits", "userSpaceOnUse")
        .selectAll("stop")
        .data([
            {offset: "0%", color: "#00df8a", opacity: 1},
            {offset: "25%", color: "#00ca7d", opacity: 1},
            {offset: "65%", color: "#00995e", opacity: 1},
            {offset: "100%", color: "#000000", opacity: 1}
        ])
        .enter()
        .append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color)
        .attr("stop-opacity", d => d.opacity);

    // 创建径向渐变，模拟左上角光源
    const radialGradientId = "radialHighlight";
    defs.append("radialGradient")
        .attr("id", radialGradientId)
        .attr("cx", "20%")
        .attr("cy", "20%")
        .attr("r", "90%")
        .attr("fx", "15%")
        .attr("fy", "15%")
        .selectAll("stop")
        .data([
            {offset: "0%", color: "#ffffff", opacity: 0.5},
            {offset: "30%", color: "#ffffff", opacity: 0.3},
            {offset: "70%", color: "#ffffff", opacity: 0.0},
        ])
        .enter()
        .append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color)
        .attr("stop-opacity", d => d.opacity);

    // 创建绿色前景面板 - 基础填充
    g.append("path")
        .attr("class", "background")
        .attr("d", `
            M ${halfCircleX},${halfCircleTop}
            L ${halfCircleX + rectWidth},${halfCircleTop}
            L ${halfCircleX + rectWidth},${halfCircleBottom}
            L ${halfCircleX},${halfCircleBottom}
            A ${halfCircleRadius},${halfCircleRadius} 0 0,1 ${halfCircleX},${halfCircleTop}
            Z
        `)
        .attr("fill", `url(#${panelGradientId})`)
        .attr("stroke", "none");
    
    // 添加径向高光效果，模拟光泽
    g.append("path")
        .attr("class", "background")
        .attr("d", `
            M ${halfCircleX},${halfCircleTop}
            L ${halfCircleX + rectWidth},${halfCircleTop}
            L ${halfCircleX + rectWidth},${halfCircleBottom}
            L ${halfCircleX},${halfCircleBottom}
            A ${halfCircleRadius},${halfCircleRadius} 0 0,1 ${halfCircleX},${halfCircleTop}
            Z
        `)
        .attr("fill", `url(#${radialGradientId})`)
        .attr("stroke", "none");

    // 添加排名数字
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const rankX = halfCircleX - rankRadius * Math.cos(angle);
        const rankY = halfCircleY - rankRadius * Math.sin(angle);
        
        // 排名数字的白色圆形背景
        g.append("circle")
            .attr("class", "background")
            .attr("cx", rankX)
            .attr("cy", rankY)
            .attr("r", 18)
            .attr("fill", "white")
            .attr("stroke", "#075c66")
            .attr("stroke-width", 2);
            
        // 排名数字
        g.append("text")
            .attr("class", "value")
            .attr("x", rankX)
            .attr("y", rankY)
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "25px")
            .attr("fill", "#075c66")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(i+1);
    });

    // 添加环形刻度
    const tickCount = 5;
    const maxValue = d3.max(chartData, d => d[yField]);
    const tickStep = maxValue / tickCount;
    
    for(let i = 1; i <= tickCount; i++) {
        const tickRadius = innerRadius + barScale(tickStep * i);
            
        // 添加刻度值
        g.append("text")
            .attr("class", "value")
            .attr("x", halfCircleX + 30)
            .attr("y", halfCircleY - tickRadius)
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "25px")
            .attr("fill", "#666")
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .text(Math.round(tickStep * i));
    }

    // 添加条形
    g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("line")
        .attr("class", "mark")
        .attr("x1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return halfCircleX - innerRadius * Math.cos(angle);
        })
        .attr("y1", (d, i) => {
            const angle = startAngle - i * angleStep;
            return halfCircleY - innerRadius * Math.sin(angle);
        })
        .attr("x2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return halfCircleX - (innerRadius + barLength) * Math.cos(angle);
        })
        .attr("y2", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return halfCircleY - (innerRadius + barLength) * Math.sin(angle);
        })
        .attr("stroke", (d, i) => `url(#barGradient${i})`)
        .attr("stroke-width", barWidth)
        .attr("stroke-linecap", "round");

    // 添加柱子顶端的圆形
    g.selectAll(".bar-circle")
        .data(chartData)
        .enter()
        .append("circle")
        .attr("class", "background")
        .attr("cx", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return halfCircleX - (innerRadius + barLength) * Math.cos(angle);
        })
        .attr("cy", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return halfCircleY - (innerRadius + barLength) * Math.sin(angle);
        })
        .attr("r", 18)
        .attr("fill", "#ffffff");

    // 添加柱子顶端的文本标签
    g.selectAll(".bar-text")
        .data(chartData)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return halfCircleX - (innerRadius + barLength) * Math.cos(angle);
        })
        .attr("y", (d, i) => {
            const angle = startAngle - i * angleStep;
            const barLength = barScale(d[yField]);
            return halfCircleY - (innerRadius + barLength) * Math.sin(angle);
        })
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "#333333")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text(d => d[xField].length > 3 ? d[xField].substring(0, 3) : d[xField]);

    // 添加数值标签
    chartData.forEach((d, i) => {
        const angle = startAngle - i * angleStep;
        const barLength = barScale(d[yField]);
        let insideFlag = false;
        
        // 在每个条形末端位置添加数值标签
        const labelX = halfCircleX - (innerRadius + barLength + 20) * Math.cos(angle);
        const labelY = halfCircleY - (innerRadius + barLength + 20) * Math.sin(angle);
        
        const labelText = `${d[xField]}: ${d[yField]}`;
        const textWidth = labelText.length * 20;
        
        const totalRadius = innerRadius + barLength + textWidth;

        let adjustedLabelX, adjustedLabelY;
        if (totalRadius > backgroundRadius) {
            adjustedLabelX = textWidth > barLength ? 
                labelX :
                labelX + 40*Math.cos(angle);
            adjustedLabelY = textWidth > barLength ?
                labelY :
                labelY + 40*Math.sin(angle);
            if (textWidth <= barLength) {
                insideFlag = true;
            }
        } else {
            adjustedLabelX = labelX;
            adjustedLabelY = labelY;
        }
            
        g.append("text")
            .attr("class", "text")
            .attr("x", adjustedLabelX)
            .attr("y", adjustedLabelY) 
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "22px")
            .attr("font-weight", "bold")
            .attr("fill", insideFlag? "#ffffff" : "#005540")
            .attr("text-anchor", insideFlag? "start" : "end")
            .attr("dominant-baseline", "middle")
            .attr("transform", () => {
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
    const titleLineHeight = 40;
    const subtitleLineHeight = 30;
    const totalHeight = (3 * titleLineHeight) + (6 * subtitleLineHeight);
    const startY = centerY - (totalHeight / 2) + 50;

    // 绘制标题
    g.append("text")
        .attr("class", "text")
        .attr("x", halfCircleRight - 120)
        .attr("y", startY)
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "27px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("text-anchor", "start")
        .text(titleLine1);

    g.append("text")
        .attr("class", "text")
        .attr("x", halfCircleRight - 120)
        .attr("y", startY + titleLineHeight)
        .attr("font-family", "Arial, sans-serif")
        .attr("font-size", "38px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .attr("text-anchor", "start")
        .text(titleLine2);

    g.append("text")
        .attr("class", "text")
        .attr("x", halfCircleRight - 120)
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
            .attr("class", "text")
            .attr("x", halfCircleRight - 120)
            .attr("y", subtitleStartY + (i * subtitleLineHeight))
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", "24px")
            .attr("fill", "white")
            .attr("text-anchor", "start")
            .text(line);
    });

    return svg.node();
} 
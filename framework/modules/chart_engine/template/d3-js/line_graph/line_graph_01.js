/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Line Graph",
    "chart_name": "line_graph_01",
    "required_fields": ["x", "y"],
    "required_fields_type": [["temporal"], ["numerical"]],
    "required_fields_range": [[5, 50], [-60, 60]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "styled",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// 解析年份函数
function parseYear(yearStr) {
    if (typeof yearStr === 'string') {
        const year = yearStr.split("/")[0];
        return new Date(parseInt(year), 0, 1);
    }
    return new Date(yearStr, 0, 1);
}

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data_columns || [];
    const images = jsonData.images || {};
    
    console.log(jsonData);
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 40, bottom: 60, left: 60 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;") // 浅灰色背景
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // 添加背景图片
    svg.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_BG.png')
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("preserveAspectRatio", "xMidYMid slice")
        .attr("x", 0)
        .attr("y", 0);
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);    
    
    // 确定全局x轴范围
    const allDates = chartData.map(d => parseYear(d[xField]));
    const xMin = d3.min(allDates);
    const xMax = d3.max(allDates);

    // 创建x轴比例尺
    const xScale = d3.scaleTime()
        .domain([xMin, xMax])
        .range([40, chartWidth]); // 将起点从0改为20,整体右移20像素
    
    // 创建y轴比例尺
    const yMin = d3.min(chartData, d => d[yField]);
    const yMax = d3.max(chartData, d => d[yField]);
    const yPadding = Math.max(Math.abs(yMin), Math.abs(yMax)) * 0.1;
    
    const yScale = d3.scaleLinear()
        .domain([Math.min(yMin - yPadding, -5), Math.max(yMax + yPadding, 5)])
        .range([chartHeight, 0]);
    
    // 生成年份刻度
    const startYear = xMin.getFullYear();
    const endYear = xMax.getFullYear();
    const yearStep = Math.ceil((endYear - startYear) / 10); // 约10个刻度
    
    const xTicks = [];
    for (let year = startYear; year <= endYear; year += yearStep) {
        xTicks.push(new Date(year, 0, 1));
    }
    
    // 添加水平网格线
    const yTicks = d3.ticks(yScale.domain()[0], yScale.domain()[1], 10);
    
    // 添加y轴线
    g.append("line")
        .attr("x1", 0)
        .attr("y1", yScale(yTicks[yTicks.length-1])) // 从最大刻度开始
        .attr("x2", 0)
        .attr("y2", yScale(yTicks[0])) // 到最小刻度结束
        .attr("stroke", "#000000")
        .attr("opacity", 0.1)
        .attr("stroke-width", 1);

    // 添加y轴刻度和标签
    yTicks.forEach(tick => {
        // 添加刻度小横线
        g.append("line")
            .attr("x1", -5)
            .attr("y1", yScale(tick))
            .attr("x2", 0)
            .attr("y2", yScale(tick))
            .attr("stroke", "#000000")
            .attr("opacity", 0.1)
            .attr("stroke-width", 1);
        
        
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Century Gothic")
            .style("font-size", tick === 0 ? "16px" : "12px")
            .style("font-weight", tick === 0 ? "bold" : "normal") 
            .style("fill", "#666666")
            .text(tick + "%");
    });
    
    // 添加x轴刻度和标签
    xTicks.forEach(tick => {
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", yScale(0))
            .attr("text-anchor", "middle")
            .style("font-family", "Century Gothic")
            .style("font-size", "12px")
            .style("fill", "#666666")
            .text(tick.getFullYear());
    });
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseYear(d[xField])))
        .y(d => yScale(d[yField]))
        .curve(d3.curveMonotoneX);
    
    // 创建渐变定义
    const defs = svg.append("defs");

    // 创建线条渐变
    const lineGradient = defs.append("linearGradient")
        .attr("id", "lineGradient")
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0)
        .attr("y1", yScale(yScale.domain()[1])) // 顶部位置
        .attr("x2", 0)
        .attr("y2", yScale(yScale.domain()[0])); // 底部位置

    // 添加渐变色停止点
    lineGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#e2922b"); // 橙色
    
    lineGradient.append("stop")
        .attr("offset", `${((yScale(0) - 60) / chartHeight) * 100}%`)
        .attr("stop-color", "#e2922b")
        .attr("stop-opacity", 1);

    lineGradient.append("stop")
        .attr("offset", `${(yScale(0) / chartHeight) * 100}%`)
        .attr("stop-color", "#e2922b")
        .attr("stop-opacity", 0);

    lineGradient.append("stop")
        .attr("offset", `${(yScale(0) / chartHeight) * 100}%`)
        .attr("stop-color", "#8364ac")
        .attr("stop-opacity", 0);
    
        lineGradient.append("stop")
        .attr("offset", `${((yScale(0) + 60) / chartHeight) * 100}%`)
        .attr("stop-color", "#8364ac")
        .attr("stop-opacity", 1);

    lineGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#8364ac"); // 紫色

    // 绘制线条
    g.append("path")
        .datum(chartData)
        .attr("fill", "none")
        .attr("stroke", "url(#lineGradient)")
        .attr("stroke-width", 3)
        .attr("d", line);
    
    // 添加最大值和最小值标注
    const maxPoint = chartData.reduce((max, p) => p[yField] > max[yField] ? p : max, chartData[0]);
    g.append("circle")
        .attr("cx", xScale(parseYear(maxPoint[xField])))
        .attr("cy", yScale(maxPoint[yField]))
        .attr("r", 6)
        .attr("fill", "#ffffff")
        .attr("stroke", "#ef9522")
        .attr("stroke-width", 2.5);
    
    g.append("text")
        .attr("x", xScale(parseYear(maxPoint[xField])))
        .attr("y", yScale(maxPoint[yField]) - 15)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#ef9522")
        .text(Math.round(maxPoint[yField]) + "%");
    
    const minPoint = chartData.reduce((min, p) => p[yField] < min[yField] ? p : min, chartData[0]);
    g.append("circle")
        .attr("cx", xScale(parseYear(minPoint[xField])))
        .attr("cy", yScale(minPoint[yField]))
        .attr("r", 6)
        .attr("fill", "#ffffff")
        .attr("stroke", "#9a8abe")
        .attr("stroke-width", 2.5);
    
    g.append("text")
        .attr("x", xScale(parseYear(minPoint[xField])))
        .attr("y", yScale(minPoint[yField]) + 20)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#9a8abe")
        .text(Math.round(minPoint[yField]) + "%");
    
    // 添加最新值标注
    const lastPoint = chartData[chartData.length - 1];
    g.append("circle")
        .attr("cx", xScale(parseYear(lastPoint[xField])))
        .attr("cy", yScale(lastPoint[yField]))
        .attr("r", 6)
        .attr("fill", "#ffffff")
        .attr("stroke", lastPoint[yField] >= 0 ? "#ef9522" : "#9a8abe")
        .attr("stroke-width", 2.5);
    
    g.append("text")
        .attr("x", xScale(parseYear(lastPoint[xField])))
        .attr("y", yScale(lastPoint[yField]) + 20)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", lastPoint[yField] >= 0 ? "#ef9522" : "#9a8abe")
        .text(Math.round(lastPoint[yField]) + "%");
    
    // 添加说明文本
    const wrapText = (text, width) => {
        const words = text.split(/\s+/);
        let line = [];
        let lines = [];
        let currentWidth = 0;
        
        words.forEach(word => {
            const wordWidth = word.length * 8; // 估算每个字符宽度为8px
            if (currentWidth + wordWidth > width) {
                lines.push(line.join(' '));
                line = [word];
                currentWidth = wordWidth;
            } else {
                line.push(word);
                currentWidth += wordWidth;
            }
        });
        lines.push(line.join(' '));
        return lines;
    };

    const nameLines = wrapText(dataColumns[1].name.toUpperCase(), 140);
    nameLines.forEach((line, i) => {
        g.append("text")
            .attr("x", 20)
            .attr("y", yScale(yMax) - 5 + i * 15) // 将第一行与最高刻度对齐
            .attr("text-anchor", "start") 
            .style("font-family", "Century Gothic")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", "#666666")
            .text(line);
    });

    const descLines = wrapText(dataColumns[1].description, 160);
    descLines.forEach((line, i) => {
        g.append("text")
            .attr("x", 20)
            .attr("y", yScale(yMax) - 5 + nameLines.length * 20 + i * 14) // 相应调整描述文本位置
            .attr("text-anchor", "start")
            .style("font-family", "Century Gothic") 
            .style("font-size", "11px")
            .style("fill", "#666666")
            .text(line);
    });

    // 自动寻找最佳箭头位置
    function findBestArrowPosition(isUpArrow) {
        const zeroY = yScale(0);
        const arrowSize = 100; // 箭头大小为100x100像素
        const stepSize = 10; // 每10像素尝试一次
        
        let bestX = isUpArrow ? 260 : 245; // 默认位置
        let bestY = isUpArrow ? 10 : 265;
        let bestCenterDistance = Infinity;
        
        // 图表中心点
        const centerX = chartWidth / 2;
        const centerY = chartHeight / 2;
        
        // 遍历可能的位置
        for (let x = 40; x <= chartWidth - arrowSize; x += stepSize) {
            for (let y = 0; y <= chartHeight - arrowSize; y += stepSize) {
                // 检查是否在正确的区域（上箭头在零线上方，下箭头在零线下方）
                if ((isUpArrow && y + arrowSize > zeroY) || (!isUpArrow && y < zeroY)) {
                    continue;
                }
                
                // 检查是否与数据线重叠
                let overlapsLine = false;
                for (let testX = x; testX < x + arrowSize; testX += 10) {
                    for (let testY = y; testY < y + arrowSize; testY += 10) {
                        // 获取测试点对应的数据点
                        const xValue = xScale.invert(testX);
                        const yValue = yScale.invert(testY);
                        
                        // 检查是否在数据线附近
                        for (let i = 0; i < chartData.length - 1; i++) {
                            const x1 = xScale(parseYear(chartData[i][xField]));
                            const y1 = yScale(chartData[i][yField]);
                            const x2 = xScale(parseYear(chartData[i + 1][xField]));
                            const y2 = yScale(chartData[i + 1][yField]);
                            
                            // 计算点到线段的距离
                            const distance = Math.abs(
                                (y2 - y1) * testX - (x2 - x1) * testY + x2 * y1 - y2 * x1
                            ) / Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
                            
                            if (distance < 20) { // 如果距离小于20像素，认为重叠
                                overlapsLine = true;
                                break;
                            }
                        }
                        if (overlapsLine) break;
                    }
                    if (overlapsLine) break;
                }
                
                if (!overlapsLine) {
                    // 计算到中心点的距离
                    const centerDistance = Math.sqrt(Math.pow(x + arrowSize/2 - centerX, 2) + 
                                                   Math.pow(y + arrowSize/2 - centerY, 2));
                    
                    // 如果这个位置比之前找到的更好，更新最佳位置
                    if (centerDistance < bestCenterDistance) {
                        bestX = x;
                        bestY = y;
                        bestCenterDistance = centerDistance;
                    }
                }
            }
        }
        
        return { x: bestX, y: bestY };
    }

    // 获取最佳箭头位置
    const upArrowPos = findBestArrowPosition(true);
    const downArrowPos = findBestArrowPosition(false);

    // 添加向上的箭头和向下的箭头
    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_UpArrow.png')
        .attr("width", "60")
        .attr("height", "60")
        .attr("x", upArrowPos.x)
        .attr("y", upArrowPos.y);
    
    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_UpLabelBG.png')
        .attr("width", "100")
        .attr("height", "30")
        .attr("x", upArrowPos.x - 20)
        .attr("y", upArrowPos.y + 65)
        .attr("preserveAspectRatio", "none");
    g.append("text")
        .attr("x", upArrowPos.x + 30)
        .attr("y", upArrowPos.y + 85)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text("U.S. EQUITIES");
    g.append("text")
        .attr("x", upArrowPos.x + 30)
        .attr("y", upArrowPos.y + 102)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text("outperform");
    

    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_DownArrow.png')
        .attr("width", "60")
        .attr("height", "60")
        .attr("x", downArrowPos.x)
        .attr("y", downArrowPos.y);
    
    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_DownLabelBG.png')
        .attr("width", "100")
        .attr("height", "30")
        .attr("x", downArrowPos.x - 20)
        .attr("y", downArrowPos.y + 65)
        .attr("preserveAspectRatio", "none");
    g.append("text")
        .attr("x", downArrowPos.x + 30)
        .attr("y", downArrowPos.y + 85)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text("GLOBAL EQUITIES");
    g.append("text")
        .attr("x", downArrowPos.x + 30)
        .attr("y", downArrowPos.y + 102)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text("outperform");
    
    return svg.node();
} 
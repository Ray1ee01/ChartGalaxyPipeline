/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Spline Graph",
    "chart_name": "spline_graph_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 50], [-1000, 1000], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "styled",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes",
    "chart_for": "comparison"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    console.log(jsonData);
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
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
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // 添加背景图片
    svg.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_BG.png')
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("preserveAspectRatio", "xMidYMid slice")
        .attr("class", "background")
        .attr("x", 0)
        .attr("y", 0);
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);    
    
    // 分离两个组的数据
    const groupNames = [...new Set(chartData.map(d => d[groupField]))];
    const group1Data = chartData.filter(d => d[groupField] === groupNames[0]);
    const group2Data = chartData.filter(d => d[groupField] === groupNames[1]);
    
    // 创建一个新的数据集，计算两组之间的差异
    const diffData = [];
    
    // 确保两组数据按年份排序
    group1Data.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    group2Data.sort((a, b) => parseDate(a[xField]) - parseDate(b[xField]));
    
    // 计算差异
    for (let i = 0; i < group1Data.length; i++) {
        const year = group1Data[i][xField];
        const group1Value = group1Data[i][yField];
        const group2Item = group2Data.find(d => d[xField] === year);
        
        if (group2Item) {
            const group2Value = group2Item[yField];
            const diff = group1Value - group2Value;
            diffData.push({
                [xField]: year,
                [yField]: diff
            });
        }
    }
    
    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(diffData, xField, 0, chartWidth);
    
    // 创建y轴比例尺
    const yMin = d3.min(diffData, d => d[yField]);
    const yMax = d3.max(diffData, d => d[yField]);
    const yPadding = Math.max(Math.abs(yMin), Math.abs(yMax)) * 0.1;
    
    const yScale = d3.scaleLinear()
        .domain([Math.min(yMin - yPadding, -5), Math.max(yMax + yPadding, 5)])
        .range([chartHeight, 0]);
    
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
            .text(xFormat(tick));
    });
    
    // 创建线条生成器
    const line = d3.line()
        .x(d => xScale(parseDate(d[xField])))
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
        .datum(diffData)
        .attr("fill", "none")
        .attr("stroke", "url(#lineGradient)")
        .attr("stroke-width", 3)
        .attr("d", line);
    
    // 添加最大值和最小值标注
    const maxPoint = diffData.reduce((max, p) => p[yField] > max[yField] ? p : max, diffData[0]);
    g.append("circle")
        .attr("cx", xScale(parseDate(maxPoint[xField])))
        .attr("cy", yScale(maxPoint[yField]))
        .attr("r", 6)
        .attr("fill", "#ffffff")
        .attr("stroke", "#ef9522")
        .attr("stroke-width", 2.5);

    g.append("text")
        .attr("x", xScale(parseDate(maxPoint[xField])))
        .attr("y", yScale(maxPoint[yField]) - 15)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#ef9522")
        .text(Math.round(maxPoint[yField]) + "%");

    const minPoint = diffData.reduce((min, p) => p[yField] < min[yField] ? p : min, diffData[0]);
    g.append("circle")
        .attr("cx", xScale(parseDate(minPoint[xField])))
        .attr("cy", yScale(minPoint[yField]))
        .attr("r", 6)
        .attr("fill", "#ffffff")
        .attr("stroke", "#9a8abe")
        .attr("stroke-width", 2.5);

    g.append("text")
        .attr("x", xScale(parseDate(minPoint[xField])))
        .attr("y", yScale(minPoint[yField]) + 20)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#9a8abe")
        .text(Math.round(minPoint[yField]) + "%");

    // 添加最新值标注
    const lastPoint = diffData[diffData.length - 1];
    if (lastPoint !== maxPoint && lastPoint !== minPoint) {
        g.append("circle")
            .attr("cx", xScale(parseDate(lastPoint[xField])))
            .attr("cy", yScale(lastPoint[yField]))
            .attr("r", 6)
            .attr("fill", "#ffffff")
            .attr("stroke", lastPoint[yField] >= 0 ? "#ef9522" : "#9a8abe")
            .attr("stroke-width", 2.5);

        g.append("text")
            .attr("x", xScale(parseDate(lastPoint[xField])))
            .attr("y", yScale(lastPoint[yField]) + 20)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Century Gothic")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("fill", lastPoint[yField] >= 0 ? "#ef9522" : "#9a8abe")
            .text(Math.round(lastPoint[yField]) + "%");
    }
    
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

    const nameLines = wrapText(dataColumns[1].name.toUpperCase() + " DIFFERENCE", 140);
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

    const descLines = wrapText(groupNames[0] + " and " + groupNames[1], 160);
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
        
        let bestX = 0;
        let bestY = 0;
        let bestCenterDistance = Infinity;
        
        // 图表中心点
        const centerX = chartWidth / 2;
        const centerY = chartHeight / 2;
        
        // 遍历可能的位置
        for (let x = 40; x <= chartWidth - arrowSize; x += stepSize) {
            for (let y = 0; y <= chartHeight - arrowSize; y += stepSize) {
                // 检查是否在正确的区域（上箭头在零线上方，下箭头在零线下方）
                if ((isUpArrow && y + arrowSize + 20 > zeroY) || (!isUpArrow && y - 20 < zeroY)) {
                    continue;
                }
                
                // 检查是否与数据线重叠
                let overlapsLine = false;
                for (let testX = x; testX < x + arrowSize; testX += 10) {
                    for (let testY = y; testY < y + arrowSize; testY += 10) {
                        // 检查是否在数据线附近
                        for (let i = 0; i < diffData.length - 1; i++) {
                            const x1 = xScale(parseDate(diffData[i][xField]));
                            const y1 = yScale(diffData[i][yField]);
                            const x2 = xScale(parseDate(diffData[i + 1][xField]));
                            const y2 = yScale(diffData[i + 1][yField]);
                            
                            // 检查测试点是否在线段的范围内
                            if (testX >= Math.min(x1, x2) && testX <= Math.max(x1, x2)) {
                                // 计算点到线段的距离
                                const A = y2 - y1;
                                const B = x1 - x2;
                                const C = x2 * y1 - x1 * y2;
                                
                                const distance = Math.abs(A * testX + B * testY + C) / 
                                               Math.sqrt(A * A + B * B);
                                
                                if (distance < 5) { // 如果距离小于20像素，认为重叠
                                    overlapsLine = true;
                                    break;
                                }
                            }
                        }
                        if (overlapsLine) break;
                    }
                    if (overlapsLine) break;
                }
                
                if (isUpArrow) {
                    console.log("x:", x, "y:", y, "overlapsLine:", overlapsLine);
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

    const leftOffset = 20;

    // 添加向上的箭头和向下的箭头
    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_UpArrow.png')
        .attr("width", "60")
        .attr("height", "60")
        .attr("x", upArrowPos.x + leftOffset)
        .attr("y", upArrowPos.y);
    
    // 根据文本长度计算背景宽度
    const upLabelWidth = Math.max(groupNames[0].toUpperCase().length * 8 + 5, 100); // 每个字符10px宽度,两边各加20px边距
    
    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_UpLabelBG.png')
        .attr("width", upLabelWidth)
        .attr("height", "30") 
        .attr("x", upArrowPos.x + leftOffset - upLabelWidth/2 + 30)
        .attr("y", upArrowPos.y + 65)
        .attr("preserveAspectRatio", "none");
    g.append("text")
        .attr("x", upArrowPos.x + leftOffset + 30)
        .attr("y", upArrowPos.y + 85)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text(groupNames[0].toUpperCase());
    g.append("text")
        .attr("x", upArrowPos.x + leftOffset + 30)
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
        .attr("x", downArrowPos.x + leftOffset)
        .attr("y", downArrowPos.y);
    
    // 根据文本长度计算背景宽度
    const downLabelWidth = Math.max(groupNames[1].toUpperCase().length * 8 + 5, 100); // 每个字符10px宽度,两边各加20px边距
    g.append("image")
        .attr("xlink:href", 'https://www.yczddgj.com/infographic_assets/line_graph_01_DownLabelBG.png')
        .attr("width", downLabelWidth)
        .attr("height", "30")
        .attr("x", downArrowPos.x + leftOffset - downLabelWidth/2 + 30)
        .attr("y", downArrowPos.y + 65)
        .attr("preserveAspectRatio", "none");
    g.append("text")
        .attr("x", downArrowPos.x + leftOffset + 30)
        .attr("y", downArrowPos.y + 85)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text(groupNames[1].toUpperCase());
    g.append("text")
        .attr("x", downArrowPos.x + leftOffset + 30)
        .attr("y", downArrowPos.y + 102)
        .attr("text-anchor", "middle")
        .style("font-family", "Century Gothic")
        .style("font-size", "12px")
        .style("fill", "#111111")
        .style("opacity", 0.8)
        .text("outperform");
    
    return svg.node();
} 
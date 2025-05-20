/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Grouped Bar Chart",
    "chart_name": "triangle_group_bar_chart_01",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 5], [0, "inf"], [2, 3]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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

/* ───────── 代码主体 ───────── */
function makeChart(containerSelector, dataJSON) {

    /* ============ 1. 字段检查 ============ */
    const cols = dataJSON.data.columns || [];
    const xField = cols.find(c=>c.role==="x")?.name;
    const yField = cols.find(c=>c.role==="y")?.name;
    const groupField = cols.find(c=>c.role==="group")?.name;
    const yUnit = cols.find(c=>c.role==="y")?.unit === "none" ? "" : cols.find(c=>c.role==="y")?.unit ?? "";
    if(!xField || !yField || !groupField){
        d3.select(containerSelector).html('<div style="color:red">缺少必要字段</div>');
        return;
    }

    const raw = dataJSON.data.data.filter(d=>+d[yField]>0);
    if(!raw.length){
        d3.select(containerSelector).html('<div>无有效数据</div>');
        return;
    }

    /* ============ 2. 尺寸与比例尺 ============ */
    const fullW = dataJSON.variables?.width  || 600;
    const fullH = dataJSON.variables?.height || 400;
    const margin = { top: 80, right: 40, bottom: 80, left: 40 }; // 边距调整，增加底部和顶部空间
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 获取主颜色
    const primaryColor = dataJSON.colors?.other?.primary || "#C13C37"; // 默认为红色

    // 数据处理
    // 获取所有唯一的x值和group值
    const xValues = Array.from(new Set(raw.map(d => d[xField])));
    const groupValues = Array.from(new Set(raw.map(d => d[groupField])));
    
    // 计算每个分组的最大值，用于比例尺
    const maxValue = d3.max(raw, d => +d[yField]); 

    // 计算分组间距和条形宽度
    const xGroupScale = d3.scaleBand()
        .domain(xValues)
        .range([0, W])
        .padding(0.2);
        
    const xBarScale = d3.scaleBand()
        .domain(groupValues)
        .range([0, xGroupScale.bandwidth()])
        .padding(0.1);
    
    // 高度比例尺
    const yScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([H, 0]);
    
    /* ============ 3. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    
    // 创建 SVG 画布
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%") // 宽度占满容器
        .attr("height", fullH) // 高度固定
        .attr("viewBox", `0 0 ${fullW} ${fullH}`) // 设置视窗
        .attr("preserveAspectRatio", "xMidYMid meet") // 保持宽高比
        .style("max-width", "100%") // 最大宽度
        .style("height", "auto") // 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建阴影效果滤镜
    const defs = svg.append("defs");
    const shadowFilter = defs.append("filter")
        .attr("id", "bar-shadow")
        .attr("width", "150%")
        .attr("height", "150%");
        
    // 添加阴影效果
    shadowFilter.append("feDropShadow")
        .attr("dx", "2") // 水平偏移
        .attr("dy", "2") // 垂直偏移
        .attr("stdDeviation", "2") // 模糊度
        .attr("flood-color", "rgba(0,0,0,0.3)") // 阴影颜色
        .attr("flood-opacity", "0.4"); // 阴影不透明度

    // 创建主绘图区域 <g> 元素，应用边距
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    /* ---- 文本和样式设置 ---- */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSize = parseFloat(dataJSON.typography?.annotation?.font_size || '12'); // 数值标签字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSize = 11;
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    
    // 辅助函数 - 使用canvas测量文本宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // 文本分行辅助函数
    function splitTextIntoLines(text, fontFamily, fontSize, maxWidth, fontWeight) {
        if (!text) return [""];
        
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";
        
        // 如果单词很少，可能是中文或者其他不使用空格分隔的语言
        if (words.length <= 2 && text.length > 5) {
            // 按字符分割
            const chars = text.split('');
            currentLine = chars[0] || "";
            
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i];
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
        } else {
            // 按单词分割
            currentLine = words[0] || "";
            
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
        }
        
        return lines;
    }
    
    // 创建轴线（基准线）
    g.append("line")
        .attr("x1", 0)
        .attr("y1", H)
        .attr("x2", W)
        .attr("y2", H)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // 创建圆角三角形路径的辅助函数
    function createRoundedTrianglePath(topPoint, leftPoint, rightPoint, radius) {
        // 计算每个顶点的单位向量方向
        function calculateUnitVector(p1, p2) {
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const length = Math.sqrt(dx * dx + dy * dy);
            return [dx / length, dy / length];
        }
        
        // 顶点间的向量
        const top_left = calculateUnitVector(topPoint, leftPoint);
        const left_right = calculateUnitVector(leftPoint, rightPoint);
        const right_top = calculateUnitVector(rightPoint, topPoint);
        
        // 计算圆角起始点
        const topLeftStart = [
            topPoint[0] + top_left[0] * radius, 
            topPoint[1] + top_left[1] * radius
        ];
        const leftRightStart = [
            leftPoint[0] + left_right[0] * radius, 
            leftPoint[1] + left_right[1] * radius
        ];
        const rightTopStart = [
            rightPoint[0] + right_top[0] * radius, 
            rightPoint[1] + right_top[1] * radius
        ];
        
        // 计算圆角结束点
        const topRightEnd = [
            topPoint[0] + right_top[0] * radius * -1, 
            topPoint[1] + right_top[1] * radius * -1
        ];
        const leftTopEnd = [
            leftPoint[0] + top_left[0] * radius * -1, 
            leftPoint[1] + top_left[1] * radius * -1
        ];
        const rightLeftEnd = [
            rightPoint[0] + left_right[0] * radius * -1, 
            rightPoint[1] + left_right[1] * radius * -1
        ];
        
        // 构建圆角三角形的路径
        return `
            M ${topLeftStart[0]},${topLeftStart[1]}
            L ${leftTopEnd[0]},${leftTopEnd[1]}
            A ${radius},${radius} 0 0 0 ${leftRightStart[0]},${leftRightStart[1]}
            L ${rightLeftEnd[0]},${rightLeftEnd[1]}
            A ${radius},${radius} 0 0 0 ${rightTopStart[0]},${rightTopStart[1]}
            L ${topRightEnd[0]},${topRightEnd[1]}
            A ${radius},${radius} 0 0 0 ${topLeftStart[0]},${topLeftStart[1]}
            Z
        `;
    }

    // 检查x轴标签的宽度，决定是否旋转
    const shouldRotateLabels = xValues.some(x => {
        const width = getTextWidth(x, categoryFontFamily, categoryFontSize, categoryFontWeight);
        return width > xGroupScale.bandwidth() * 0.8;
    });

    // 绘制x轴标签
    xValues.forEach(x => {
        const xPos = xGroupScale(x) + xGroupScale.bandwidth() / 2;
        
        if (shouldRotateLabels) {
            g.append("text")
                .attr("class", "x-axis-label")
                .attr("text-anchor", "end")
                .attr("x", xPos)
                .attr("y", H + 10)
                .attr("transform", `rotate(-45, ${xPos}, ${H + 10})`)
                .style("font-family", categoryFontFamily)
                .style("font-size", `${categoryFontSize}px`)
                .style("font-weight", categoryFontWeight)
                .style("fill", "#333")
                .text(x);
        } else {
            // 如果标签太长，分行显示
            const maxWidth = xGroupScale.bandwidth() * 0.9;
            const lines = splitTextIntoLines(x, categoryFontFamily, categoryFontSize, maxWidth, categoryFontWeight);
            const lineHeight = categoryFontSize * 1.2;
            
            lines.forEach((line, i) => {
                g.append("text")
                    .attr("class", "x-axis-label")
                    .attr("text-anchor", "middle")
                    .attr("x", xPos)
                    .attr("y", H + 15 + i * lineHeight)
                    .style("font-family", categoryFontFamily)
                    .style("font-size", `${categoryFontSize}px`)
                    .style("font-weight", categoryFontWeight)
                    .style("fill", "#333")
                    .text(line);
            });
        }
    });

    // 绘制每个分组下的条形
    xValues.forEach(x => {
        groupValues.forEach(group => {
            // 查找对应的数据点
            const dataPoint = raw.find(d => d[xField] === x && d[groupField] === group);
            if (!dataPoint) return; // 跳过没有数据的组合
            
            const value = +dataPoint[yField];
            if (value <= 0) return; // 跳过0或负值
            
            // 获取对应group的颜色，如果没有则使用主颜色
            const color = dataJSON.colors?.field?.[group] || primaryColor;
            
            // 计算条形位置和尺寸
            const barX = xGroupScale(x) + xBarScale(group);
            const barY = yScale(value);
            const barHeight = H - barY;
            const barWidth = xBarScale.bandwidth();
            const barMidX = barX + barWidth / 2;
            
            // 创建三角形路径坐标
            const cornerRadius = 4; // 圆角半径
            const trianglePath = createRoundedTrianglePath(
                [barMidX, barY],                // 顶点（上）
                [barX, H],                      // 左下角
                [barX + barWidth, H],           // 右下角
                cornerRadius
            );
            
            // 绘制三角形
            g.append("path")
                .attr("class", "bar")
                .attr("d", trianglePath)
                .attr("fill", color)
                .attr("fill-opacity", 0.7) // 设置透明度
                .attr("filter", "url(#bar-shadow)");
                
            // 添加数值标签
            const valText = `${value}${yUnit}`;
            const textWidth = getTextWidth(valText, valueFontFamily, valueFontSize, valueFontWeight);
            
            // 根据条形宽度决定文本位置
            if (textWidth > barWidth - 4) {
                // 如果文本比条形宽，显示在条形上方
                // 添加标签背景
                g.append("rect")
                    .attr("x", barMidX - textWidth/2 - 2)
                    .attr("y", barY - valueFontSize - 4)
                    .attr("width", textWidth + 4)
                    .attr("height", valueFontSize + 2)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("fill", "#fff");
                
                g.append("text")
                    .attr("class", "value-label")
                    .attr("text-anchor", "middle")
                    .attr("x", barMidX)
                    .attr("y", barY - 4)
                    .style("font-family", valueFontFamily)
                    .style("font-size", `${valueFontSize}px`)
                    .style("font-weight", valueFontWeight)
                    .style("fill", color)
                    .text(valText);
            } else {
                // 如果条形高度足够，显示在条形内部上方1/3处位置
                if (barHeight > valueFontSize * 2.5) {
                    g.append("text")
                        .attr("class", "value-label")
                        .attr("text-anchor", "middle")
                        .attr("x", barMidX)
                        .attr("y", barY + barHeight/3)
                        .style("font-family", valueFontFamily)
                        .style("font-size", `${valueFontSize}px`)
                        .style("font-weight", valueFontWeight)
                        .style("fill", "#fff")
                        .text(valText);
                } else {
                    // 条形太短，显示在上方
                    g.append("text")
                        .attr("class", "value-label")
                        .attr("text-anchor", "middle")
                        .attr("x", barMidX)
                        .attr("y", barY - 4)
                        .style("font-family", valueFontFamily)
                        .style("font-size", `${valueFontSize}px`)
                        .style("font-weight", valueFontWeight)
                        .style("fill", color)
                        .text(valText);
                }
            }
        });
    });
    
    // 添加图例
    const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${fullW - margin.right - groupValues.length * 80}, 20)`);
        
    groupValues.forEach((group, i) => {
        const color = dataJSON.colors?.field?.[group] || primaryColor;
        const legendX = i * 80;
        
        // 图例矩形
        legendGroup.append("rect")
            .attr("x", legendX)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("rx", 2)
            .attr("ry", 2)
            .attr("fill", color)
            .attr("fill-opacity", 0.7);
            
        // 图例文本
        legendGroup.append("text")
            .attr("x", legendX + 20)
            .attr("y", 12)
            .style("font-family", categoryFontFamily)
            .style("font-size", `${categoryFontSize}px`)
            .style("fill", "#333")
            .text(group);
    });

    return svg.node(); // 返回 SVG DOM 节点
} 
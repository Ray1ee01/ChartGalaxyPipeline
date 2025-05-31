/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Triangle)",
    "chart_name": "proportional_area_chart_triangle_05",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[8, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
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
    const yUnit = cols.find(c=>c.role==="y")?.unit === "none" ? "" : cols.find(c=>c.role==="y")?.unit ?? "";
    if(!xField || !yField){
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
    const fullH = dataJSON.variables?.height || 600;
    const margin = { top: 40, right: 20, bottom: 40, left: 20 }; // 边距
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 三角形尺寸参数
    const minRadius = 20; // 最小三角形半径
    const maxRadius = 80; // 最大三角形半径
    const minSideForInnerLabel = 60; // 三角形边长小于此值时，将标签放在外部
    const padding = 10; // 三角形之间的间距

    // 获取主颜色
    const primaryColor = dataJSON.colors?.other?.primary || "#1f77b4"; // 默认为蓝色

    // 数据处理：计算每个节点的值、大小、颜色等
    const maxValue = d3.max(raw, d => +d[yField]); // 获取最大值
    const minValue = d3.min(raw, d => +d[yField]); // 获取最小值
    
    // 创建线性比例尺映射函数
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([minRadius, maxRadius]);
    
    // 创建节点数据
    const nodes = raw.map((d,i)=>({
        id   : d[xField]!=null?String(d[xField]):`__${i}__`, // 节点ID (X字段)，若为空则生成临时ID
        val  : +d[yField], // 节点值 (Y字段)
        r    : radiusScale(+d[yField]), // 使用比例尺计算半径
        color: primaryColor, // 所有节点使用相同的主颜色
        icon : dataJSON.images?.field?.[d[xField]] || null, // 图标URL (从JSON中获取)
        raw  : d, // 原始数据
    })).sort((a,b)=>b.r-a.r); // 按半径降序排序

    /* ============ 3. 三角形布局计算 ============ */
    // 增加标签空间的预估高度
    const labelHeight = 50; // 减少标签高度预留
    
    // 调整三角形间距，为标签预留足够空间
    const horizontalPadding = 35; // 水平间距适当减少
    const verticalPadding = 60; // 减少垂直间距
    
    // 贪心布局 - 底部对齐
    const arrangeTrianglesBottomAligned = (nodes, containerWidth) => {
        let x = 0;
        let y = 0;
        let rowHeight = 0;
        let rowNodes = [];
        const rows = [];
        
        nodes.forEach(node => {
            const triangleSide = node.r * 2; // 三角形边长
            const triangleHeight = triangleSide * Math.sqrt(3) / 2; // 三角形高度
            
            // 计算该节点所需的总宽度（包括水平间距）
            const nodeWidth = triangleSide + horizontalPadding;
            
            // 如果当前行放不下，另起一行
            if (x + triangleSide > containerWidth) {
                // 保存当前行信息
                rows.push({
                    y: y,
                    height: rowHeight,
                    nodes: rowNodes
                });
                
                // 重置为新行
                x = 0;
                y += rowHeight + verticalPadding; // 使用增加的垂直间距
                rowHeight = 0;
                rowNodes = [];
            }
            
            // 设置三角形位置
            node.x = x + triangleSide / 2; // 中心点x坐标
            node.y = y; // 底部y坐标（基线）
            node.triangleSide = triangleSide;
            node.triangleHeight = triangleHeight;
            
            // 更新当前行信息
            rowHeight = Math.max(rowHeight, triangleHeight);
            x += nodeWidth; // 更新x位置，考虑了水平间距
            rowNodes.push(node);
        });
        
        // 保存最后一行
        if (rowNodes.length > 0) {
            rows.push({
                y: y,
                height: rowHeight,
                nodes: rowNodes
            });
        }
        
        // 返回所有行和总高度
        return {
            rows: rows,
            totalHeight: y + rowHeight + labelHeight // 增加额外空间用于底部标签
        };
    };

    // 布局计算
    const layout = arrangeTrianglesBottomAligned(nodes, W);
    const layoutHeight = layout.totalHeight;
    
    // 根据总高度调整绘图区域
    let adjustedH = H;
    if (layoutHeight > H) {
        adjustedH = layoutHeight + margin.top + margin.bottom;
    }
    
    /* ============ 4. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    
    // 创建 SVG 画布
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%") // 宽度占满容器
        .attr("height", adjustedH) // 高度固定
        .attr("viewBox", `0 0 ${fullW} ${adjustedH}`) // 设置视窗
        .attr("preserveAspectRatio", "xMidYMid meet") // 保持宽高比
        .style("max-width", "100%") // 最大宽度
        .style("height", "auto") // 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建阴影效果滤镜
    const defs = svg.append("defs");
    const shadowFilter = defs.append("filter")
        .attr("id", "triangle-shadow")
        .attr("width", "150%")
        .attr("height", "150%");
        
    // 添加阴影效果
    shadowFilter.append("feDropShadow")
        .attr("dx", "3") // 水平偏移
        .attr("dy", "3") // 垂直偏移
        .attr("stdDeviation", "2.5") // 模糊度
        .attr("flood-color", "rgba(0,0,0,0.3)") // 阴影颜色
        .attr("flood-opacity", "0.5"); // 阴影不透明度

    // 创建主绘图区域 <g> 元素，应用边距
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
        
    // 背景矩形（可选）
    // g.append("rect")
    //     .attr("width", W)
    //     .attr("height", adjustedH - margin.top - margin.bottom)
    //     .attr("fill", "#f9f9f9")
    //     .attr("opacity", 0.5);

    /* ---- 文本和图标设置 ---- */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSizeBase = parseFloat(dataJSON.typography?.annotation?.font_size || '12'); // 数值标签基础字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSizeBase = parseFloat(dataJSON.typography?.label?.font_size || '11'); // 维度标签基础字号
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    const textColor = dataJSON.colors?.text_color || '#000'; // 文本颜色 (优先JSON，默认黑色)

    // 图标大小相关配置
    const iconSizeRatio = 0.6; // 图标相对于三角形边长的比例
    const minIconSize = 24; // 最小图标尺寸
    const maxIconSize = 60; // 最大图标尺寸
    
    // 文本宽度测量辅助函数 (使用 canvas 提高性能)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // 文本颜色计算函数
    function getTextColorForBackground(backgroundColor) {
        return textColor; // 使用配置的文本颜色
    }

    // 创建节点分组
    const nodeGroups = g.selectAll("g.node")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "node")
        .attr("transform", d => {
            // 三角形底部对齐，但实际位置需要向上偏移三角形高度
            return `translate(${d.x}, ${d.y - d.triangleHeight * 1/3})`;
        });
        
    // 绘制每个三角形
    nodeGroups.each(function(d) {
        const gNode = d3.select(this);
        const side = d.triangleSide; // 三角形边长
        const triangleHeight = d.triangleHeight; // 三角形高度
        const valText = `${d.val}${yUnit}`; // 值文本
        let catText = d.id.startsWith("__") ? "" : d.id; // 类别文本
        
        // 判断三角形大小
        const isLargeTriangle = side >= 50; // 调整为边长50以上的三角形都在内部显示数值
        
        // 选择文本颜色
        const textFillColor = getTextColorForBackground(d.color);
        
        // 计算圆角三角形的路径
        const cornerRadius = 5; // 圆角半径
        
        // 三角形顶点坐标
        const topPoint = [0, -triangleHeight * 2/3];
        const leftPoint = [-side/2, triangleHeight * 1/3];
        const rightPoint = [side/2, triangleHeight * 1/3];
        
        // 创建圆角三角形路径
        const roundedTrianglePath = createRoundedTrianglePath(
            topPoint, leftPoint, rightPoint, cornerRadius
        );
        
        // 绘制圆角三角形
        gNode.append("path")
            .attr("d", roundedTrianglePath)
            .attr("fill", d.color) // 使用纯色填充，移除渐变
            .attr("stroke", "#fff")
            .attr("stroke-width", 3.0) // 3px白色边框
            .attr("filter", "url(#triangle-shadow)"); // 全局阴影效果
        
        // 准备标签文本
        if (!catText) {
            catText = d.id || "";
        }
        
        // 标签字体大小 - 根据三角形大小调整
        let catFontSize = Math.min(14, Math.max(10, side/12));
        let valFontSize = Math.min(16, Math.max(12, side/10));
        
        // 如果三角形足够大，数值显示在内部
        if (isLargeTriangle) {
            // 数值放在三角形下边缘上方5-10px位置
            const bottomEdgeY = triangleHeight * 1/3; // 三角形底边的Y坐标
            const innerValueY = bottomEdgeY - valFontSize - 8; // 从底边向上偏移适当距离
            
            // 确保数值文本宽度不超过三角形
            const maxValueWidth = side * 0.8;
            const valueWidth = getTextWidthCanvas(valText, valueFontFamily, valFontSize, valueFontWeight);
            
            if (valueWidth > maxValueWidth) {
                // 按比例缩小文本
                valFontSize = Math.max(10, Math.floor(valFontSize * maxValueWidth / valueWidth));
            }
                
            // 显示数值文本（白色，无背景）
            gNode.append("text")
                .attr("class", "inner-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("y", innerValueY)
                .style("font-family", valueFontFamily)
                .style("font-weight", valueFontWeight)
                .style("font-size", `${valFontSize}px`)
                .style("fill", "#fff") // 改为白色字
                .style("text-shadow", "0px 1px 2px rgba(0,0,0,0.2)") // 添加轻微阴影提高可读性
                .text(valText);
                
            // 类别标签放在上方并分行显示
            const topLabelY = -triangleHeight * 2/3 - 25; // 减少距离，让标签更靠近三角形
            
            // 测量文本宽度
            const catWidth = getTextWidthCanvas(catText, categoryFontFamily, catFontSize, categoryFontWeight);
            const maxLabelWidth = Math.max(side, 140); // 确保足够宽
            
            // 判断是否需要分行显示
            if (catWidth > maxLabelWidth) {
                // 分行显示类别标签
                const lines = splitTextIntoLines(catText, categoryFontFamily, catFontSize, maxLabelWidth, categoryFontWeight);
                const lineHeight = catFontSize * 1.1; // 减少行高
                const totalHeight = lines.length * lineHeight;
                
                // 添加标签背景
                gNode.append("rect")
                    .attr("x", -maxLabelWidth/2 - 5)
                    .attr("y", topLabelY - 2)
                    .attr("width", maxLabelWidth + 10)
                    .attr("height", totalHeight + 4)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.9)
                    .attr("stroke", "#ccc")
                    .attr("stroke-width", 0.5);
                
                // 添加多行文本
                lines.forEach((line, i) => {
                    gNode.append("text")
                        .attr("class", "category-label-line")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "hanging")
                        .attr("y", topLabelY + i * lineHeight)
                        .style("font-family", categoryFontFamily)
                        .style("font-weight", categoryFontWeight)
                        .style("font-size", `${catFontSize}px`)
                        .style("fill", "#000")
                        .text(line);
                });
            } else {
                // 单行显示
                gNode.append("rect")
                    .attr("x", -catWidth/2 - 5)
                    .attr("y", topLabelY - 2)
                    .attr("width", catWidth + 10)
                    .attr("height", catFontSize + 4)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.9)
                    .attr("stroke", "#ccc")
                    .attr("stroke-width", 0.5);
                    
                gNode.append("text")
                    .attr("class", "top-category-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", topLabelY)
                    .style("font-family", categoryFontFamily)
                    .style("font-weight", categoryFontWeight)
                    .style("font-size", `${catFontSize}px`)
                    .style("fill", "#000")
                    .text(catText);
            }
        } else {
            // 小三角形 - 所有标签都在上方
            
            // 尝试同时显示类别和数值
            const topLabelY = -triangleHeight * 2/3 - 20; // 减少距离，让标签更靠近三角形
            
            // 测量文本宽度
            const catWidth = getTextWidthCanvas(catText, categoryFontFamily, catFontSize, categoryFontWeight);
            const valWidth = getTextWidthCanvas(valText, valueFontFamily, valFontSize, valueFontWeight);
            const maxWidth = Math.max(catWidth, valWidth);
            const maxAllowedWidth = Math.max(side * 2, 120); // 最大允许宽度
            
            // 如果文本太宽，判断需要分行还是缩小字体
            let needWrap = false;
            let finalCatFontSize = catFontSize;
            let finalValFontSize = valFontSize;
            
            if (maxWidth > maxAllowedWidth) {
                // 检查是否类别文本需要分行
                if (catWidth > maxAllowedWidth && catText.length > 15) {
                    needWrap = true;
                } else {
                    // 按比例缩小字体
                    const scaleFactor = maxAllowedWidth / maxWidth;
                    finalCatFontSize = Math.max(8, Math.floor(catFontSize * scaleFactor));
                    finalValFontSize = Math.max(10, Math.floor(valFontSize * scaleFactor));
                }
            }
            
            if (needWrap) {
                // 分行显示类别文本
                const lines = splitTextIntoLines(catText, categoryFontFamily, finalCatFontSize, maxAllowedWidth, categoryFontWeight);
                const lineHeight = finalCatFontSize * 1.1; // 减少行高
                const totalCatHeight = lines.length * lineHeight;
                
                // 计算背景尺寸
                const valHeight = finalValFontSize + 4;
                const totalHeight = totalCatHeight + valHeight + 4; // 减少间距
                
                // 添加背景
                gNode.append("rect")
                    .attr("x", -maxAllowedWidth/2 - 5)
                    .attr("y", topLabelY - 2)
                    .attr("width", maxAllowedWidth + 10)
                    .attr("height", totalHeight)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.9)
                    .attr("stroke", "#ccc")
                    .attr("stroke-width", 0.5);
                
                // 添加多行类别文本
                lines.forEach((line, i) => {
                    gNode.append("text")
                        .attr("class", "category-label-line")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "hanging")
                        .attr("y", topLabelY + i * lineHeight)
                        .style("font-family", categoryFontFamily)
                        .style("font-weight", categoryFontWeight)
                        .style("font-size", `${finalCatFontSize}px`)
                        .style("fill", "#000")
                        .text(line);
                });
                
                // 添加值标签
                gNode.append("text")
                    .attr("class", "top-value-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", topLabelY + totalCatHeight + 2) // 减少间距
                    .style("font-family", valueFontFamily)
                    .style("font-weight", valueFontWeight)
                    .style("font-size", `${finalValFontSize}px`)
                    .style("fill", "#000")
                    .text(valText);
            } else {
                // 不分行，直接显示两行文本
                const newCatWidth = getTextWidthCanvas(catText, categoryFontFamily, finalCatFontSize, categoryFontWeight);
                const newValWidth = getTextWidthCanvas(valText, valueFontFamily, finalValFontSize, valueFontWeight);
                const newMaxWidth = Math.max(newCatWidth, newValWidth);
                const totalHeight = finalCatFontSize + finalValFontSize + 4; // 减少间距
                
                // 添加背景
                gNode.append("rect")
                    .attr("x", -newMaxWidth/2 - 5)
                    .attr("y", topLabelY - 2)
                    .attr("width", newMaxWidth + 10)
                    .attr("height", totalHeight)
                    .attr("rx", 3)
                    .attr("ry", 3)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.9)
                    .attr("stroke", "#ccc")
                    .attr("stroke-width", 0.5);
                
                // 添加类别标签
                gNode.append("text")
                    .attr("class", "top-category-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", topLabelY)
                    .style("font-family", categoryFontFamily)
                    .style("font-weight", categoryFontWeight)
                    .style("font-size", `${finalCatFontSize}px`)
                    .style("fill", "#000")
                    .text(catText);
                
                // 添加值标签
                gNode.append("text")
                    .attr("class", "top-value-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("y", topLabelY + finalCatFontSize + 2) // 减少间距
                    .style("font-family", valueFontFamily)
                    .style("font-weight", valueFontWeight)
                    .style("font-size", `${finalValFontSize}px`)
                    .style("fill", "#000")
                    .text(valText);
            }
        }
    });
    
    // 文本分行辅助函数
    function splitTextIntoLines(text, fontFamily, fontSize, maxWidth, fontWeight) {
        if (!text) return [""];
        
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";
        
        // 如果单词很少，可能是中文或者其他不使用空格分隔的语言
        if (words.length <= 2) {
            // 按字符分割
            const chars = text.split('');
            currentLine = chars[0] || "";
            
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (getTextWidthCanvas(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
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
                if (getTextWidthCanvas(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
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

    return svg.node(); // 返回 SVG DOM 节点
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_06",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
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
    const margin = { top: 90, right: 20, bottom: 60, left: 20 }; // 边距
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 计算可用面积的50%作为圆形最大总面积限制
    const maxTotalCircleArea = W * H * 0.5;

    // 半径限制
    const minRadius = 5; // 最小圆半径
    const maxRadius = H / 3; // 最大圆半径（不超过绘图区域高度的三分之一）

    // 创建颜色比例尺
    const uniqueCategories = [...new Set(raw.map(d => d[xField]))];
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueCategories)
        .range(uniqueCategories.map((cat, i) => 
            // 优先使用colors.field中的颜色
            dataJSON.colors?.field?.[cat] || 
            // 如果没有对应颜色，使用默认调色板
            d3.schemeTableau10[i % 10]
        ));

    // 创建初始半径比例尺
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(raw, d => +d[yField])])
        .range([minRadius, maxRadius * 0.8]);
        
    // 计算每个节点的初始半径和面积
    let nodes = raw.map((d, i) => {
        const val = +d[yField];
        const r = radiusScale(val);
        return {
            id: d[xField] != null ? String(d[xField]) : `__${i}__`,
            val: val,
            r: r,
            area: Math.PI * r * r,
            color: colorScale(d[xField]),
            raw: d
        };
    }).sort((a, b) => b.r - a.r); // 按半径从大到小排序
    
    // 计算总面积
    const initialTotalArea = d3.sum(nodes, d => d.area);
    
    // 如果总面积超过最大限制，按比例缩小所有半径
    if (initialTotalArea > maxTotalCircleArea) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.r *= areaRatio;
            node.area = Math.PI * node.r * node.r;
        });
    }

    /* ============ 3. 力模拟布局 ============ */
    // 设置顶部保护区域，防止与可能的标题或图例重叠
    const TOP_PROTECTED_AREA = 30;
    
    // 创建防碰撞力模拟布局
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(W/2, H/2).strength(0.05)) // 中心引力
        .force("charge", d3.forceManyBody().strength(-10)) // 节点间斥力
        // 使用collide力允许适度重叠（minDistance = radius1 + radius2 - 5）
        .force("collide", d3.forceCollide().radius(d => d.r - 5).strength(0.9))
        .stop();

    // 计算虚拟中心圆的半径 - 基于可用空间和节点数量
    const centralCircleRadius = Math.min(W, H) * 0.25; // 虚拟中心圆半径，占绘图区较小边的25%
    
    // 设置初始位置 - 所有圆按大小围绕虚拟中心圆排列
    if (nodes.length > 0) {
        // 计算排列角度和间距
        const totalAngle = 2 * Math.PI; // 完整圆周
        const angleStep = totalAngle / nodes.length; // 每个节点的角度间隔
        
        // 按照顺序排列圆形（从最大到最小）
        for (let i = 0; i < nodes.length; i++) {
            const angle = i * angleStep; // 当前节点的角度
            const node = nodes[i];
            
            // 计算距离中心的距离（虚拟中心圆半径 + 当前节点半径 + 一些间距）
            const distance = centralCircleRadius + node.r + 10;
            
            // 设置初始位置
            node.x = W/2 + distance * Math.cos(angle);
            node.y = H/2 + distance * Math.sin(angle);
            
            // 对较大的圆（前1/3的圆）应用固定位置以保持稳定的环形布局
            if (i < nodes.length / 3) {
                node.fx = node.x;
                node.fy = node.y;
            }
        }
    }

    // 设置节点并运行模拟
    simulation.nodes(nodes);

    // 运行模拟迭代
    const MIN_ITERATIONS = 200; // 较大的迭代次数以获得稳定布局
    
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        
        // 每次迭代后应用边界约束
        nodes.forEach(d => {
            if (!d.fx) { // 如果节点没有被固定
                // 向中心的力 - 保持环形布局
                const dx = d.x - W/2;
                const dy = d.y - H/2;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const targetDistance = centralCircleRadius + d.r + 10;
                const factor = 0.1; // 调整力度
                
                if (Math.abs(distance - targetDistance) > d.r * 0.2) {
                    // 如果偏离目标距离，施加力将其拉回环形路径
                    const angle = Math.atan2(dy, dx);
                    d.x = W/2 + (distance * (1 - factor) + targetDistance * factor) * Math.cos(angle);
                    d.y = H/2 + (distance * (1 - factor) + targetDistance * factor) * Math.sin(angle);
                }
                
                // 水平边界约束
                d.x = Math.max(d.r, Math.min(W - d.r, d.x));
                // 垂直边界约束，确保不进入顶部保护区域
                d.y = Math.max(TOP_PROTECTED_AREA + d.r, Math.min(H - d.r, d.y));
            }
        });
    }

    // 渲染虚拟中心圆的参考线（可选，仅用于调试）
    /*
    g.append("circle")
        .attr("cx", W/2)
        .attr("cy", H/2)
        .attr("r", centralCircleRadius)
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "5,5")
        .attr("stroke-width", 1.0);
    */

    /* ============ 4. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    // 创建 SVG 画布
    const svg=d3.select(containerSelector)
        .append("svg")
        .attr("width","100%") // 宽度占满容器
        .attr("height",fullH) // 高度固定
        .attr("viewBox",`0 0 ${fullW} ${fullH}`) // 设置视窗
        .attr("preserveAspectRatio","xMidYMid meet") // 保持宽高比
        .style("max-width","100%") // 最大宽度
        .style("height","auto"); // 高度自适应

    // 创建主绘图区域 <g> 元素，应用边距
    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);

    // 创建节点分组 <g> 元素
    const nodeG=g.selectAll("g.node")
        .data(nodes,d=>d.id) // 绑定已放置节点数据，使用 id 作为 key
        .join("g")
        .attr("class","node")
        .attr("transform",d=>`translate(${d.x},${d.y})`); // 定位到计算好的位置

    // 绘制圆形
    nodeG.append("circle")
        .attr("r",d=>d.r) // 半径
        .attr("fill",d=>d.color) // 填充色
        .attr("stroke","#fff") // 白色描边
        .attr("stroke-width",1.0); // 描边宽度

    /* ---- 文本 ---- */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSizeBase = parseFloat(dataJSON.typography?.annotation?.font_size || '12'); // 数值标签基础字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSizeBase = parseFloat(dataJSON.typography?.label?.font_size || '11'); // 维度标签基础字号
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    const textColor = dataJSON.colors?.text_color || '#fff'; // 文本颜色 (优先JSON，默认白色)

    // 文本宽度测量辅助函数 (使用 canvas 提高性能)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // ---- 类别标签换行控制 ----
    const minCatFontSize = 10; // 维度标签最小字号 (再小就换行或省略)
    const catLineHeight = 0.3; // 维度标签换行行高倍数（相对于字号）
    const needsWrapping = true; // 需要时是否允许换行

    // 弦长计算函数 - 根据到圆心的距离计算该位置的最大水平宽度
    function getChordLength(radius, distanceFromCenter) {
        // 检查 distanceFromCenter 是否有效
        if (Math.abs(distanceFromCenter) >= radius) {
            return 0; // 如果距离大于或等于半径，弦长为0
        }
        // 根据毕达哥拉斯定理，在距离圆心d的位置，水平弦长=2*√(r²-d²)
        return 2 * Math.sqrt(radius * radius - distanceFromCenter * distanceFromCenter);
    }

    // 计算颜色亮度的函数 (用于确定文本颜色)
    function getColorBrightness(color) {
        // 处理rgba格式
        if (color.startsWith('rgba')) {
            const rgba = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (rgba) {
                return (parseInt(rgba[1]) * 0.299 + parseInt(rgba[2]) * 0.587 + parseInt(rgba[3]) * 0.114) / 255;
            }
        }
        
        // 处理rgb格式
        if (color.startsWith('rgb')) {
            const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgb) {
                return (parseInt(rgb[1]) * 0.299 + parseInt(rgb[2]) * 0.587 + parseInt(rgb[3]) * 0.114) / 255;
            }
        }
        
        // 处理十六进制格式
        if (color.startsWith('#')) {
            let hex = color.substring(1);
            // 处理简写形式 (#fff -> #ffffff)
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        }
        
        // 默认返回中等亮度 (0.5)
        return 0.5;
    }
    
    // 根据背景色亮度选择合适的文本颜色
    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        // 亮度阈值0.6: 高于0.6用黑色文本，低于用白色
        return brightness > 0.6 ? '#000000' : '#ffffff';
    }

    // --- 新的文本渲染逻辑 ---
    const minAcceptableFontSize = 8; // 可接受的最小字体大小
    const minRadiusForCategoryLabel = 5; // 显示维度标签的最小圆半径阈值
    const fontSizeScaleFactor = 0.38; // 字体大小与圆半径的缩放比例
    const maxFontSize = 28; // 最大字体大小

    nodeG.each(function(d) {
        const gNode = d3.select(this);
        const r = d.r;
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        const maxTextWidth = r * 1.65; // 圆内文本允许的最大宽度 (这是一个简化估计)
        
        // 根据圆的背景色选择合适的文本颜色
        const backgroundColor = d.color;
        const adaptiveTextColor = getTextColorForBackground(backgroundColor);

        // 1. 计算初始字体大小候选值（值和维度标签使用相同大小）
        // 采用基础大小的平均值，按半径缩放，限制在最小/最大值之间
        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                r * fontSizeScaleFactor,
                (valueFontSizeBase + categoryFontSizeBase) / 2,
                maxFontSize
            )
        );

        // 2. 检查文本宽度并调整字体大小
        let valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
        let categoryWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight) : 0;
        let categoryLines = 1; // 默认类别标签只有一行
        let categoryLabelHeight = currentFontSize; // 类别标签默认高度
        let shouldWrapCategory = false; // 默认不换行
        let categoryMaxWidth = 0; // 类别标签在对应位置的最大宽度

        // 估算文本放置的垂直位置（简化处理，假设类别在上，数值在下）
        const estimatedCategoryY = catText ? -currentFontSize * 0.55 : 0;
        const estimatedValueY = catText ? currentFontSize * 0.55 : 0;

        // 循环减小字体，直到两个标签都能放下，或达到最小字号
        while (currentFontSize > minAcceptableFontSize) {
            valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
            categoryWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight) : 0;

            // 计算类别标签在该垂直位置允许的最大宽度
            categoryMaxWidth = catText ? getChordLength(r, Math.abs(estimatedCategoryY)) * 0.9 : 0; // 乘以0.9留边距
            // 计算数值标签在该垂直位置允许的最大宽度
            const valueMaxWidth = getChordLength(r, Math.abs(estimatedValueY)) * 0.9; // 乘以0.9留边距

            // 检查宽度是否合适
            const valueFits = valueWidth <= valueMaxWidth;
            let categoryFits = !catText || categoryWidth <= categoryMaxWidth;
            shouldWrapCategory = false; // 重置换行标记

            // 如果类别标签不适合，并且允许换行，并且字号足够大，尝试换行
            if (catText && !categoryFits && needsWrapping && currentFontSize >= minCatFontSize) {
                 shouldWrapCategory = true;
                 // 使用临时canvas估算换行后的行数和总高度
                 const tempCanvas = document.createElement('canvas');
                 const tempCtx = tempCanvas.getContext('2d');
                 tempCtx.font = `${categoryFontWeight} ${currentFontSize}px ${categoryFontFamily}`;
                 const words = catText.split(/\s+/);
                 let lines = [];
                 let line = [];
                 let word;
                 let fitsWithWrapping = true;

                 if (words.length <= 1) { // 按字符模拟换行
                     const chars = catText.split('');
                     let currentLine = '';
                     for (let i = 0; i < chars.length; i++) {
                         const testLine = currentLine + chars[i];
                         if (tempCtx.measureText(testLine).width <= categoryMaxWidth || currentLine.length === 0) {
                             currentLine += chars[i];
                         } else {
                             // 检查单行是否太高
                             if ((lines.length + 1) * currentFontSize * (1 + catLineHeight) > r * 1.8) { // 检查总高度
                                 fitsWithWrapping = false;
                                 break;
                             }
                             lines.push(currentLine);
                             currentLine = chars[i];
                         }
                     }
                     if (fitsWithWrapping) lines.push(currentLine);
                 } else { // 按单词模拟换行
                    while (word = words.shift()) {
                         line.push(word);
                         const testLine = line.join(" ");
                         if (tempCtx.measureText(testLine).width > categoryMaxWidth && line.length > 1) {
                             line.pop();
                             // 检查单行是否太高
                             if ((lines.length + 1) * currentFontSize * (1 + catLineHeight) > r * 1.8) {
                                 fitsWithWrapping = false;
                                 break;
                             }
                             lines.push(line.join(" "));
                             line = [word];
                         }
                     }
                     if (fitsWithWrapping) lines.push(line.join(" "));
                 }
                
                 if(fitsWithWrapping && lines.length > 0){ 
                     categoryLines = lines.length; // 更新行数
                     categoryLabelHeight = categoryLines * currentFontSize * (1 + catLineHeight); // 更新总高度
                     categoryFits = true; // 标记为可通过换行解决
                 } else {
                     // 即使换行也放不下，或者换行后太高
                     categoryFits = false;
                     shouldWrapCategory = false;
                 }
             } else if (catText && !categoryFits) {
                 // 字号太小不能换行，或者不允许换行
                 shouldWrapCategory = false;
             }

            // 如果两个标签都合适 (类别可能通过换行解决)
            if (valueFits && categoryFits) {
                break; // 找到合适的字号，跳出循环
            }

            // 如果不合适，减小字号继续尝试
            currentFontSize -= 1;
        }

        // 3. 确定最终字体大小和是否显示标签
        const finalFontSize = currentFontSize;
        const showValue = valueWidth <= getChordLength(r, Math.abs(estimatedValueY)) * 0.9 && finalFontSize >= minAcceptableFontSize;
        const showCategory = catText && finalFontSize >= minAcceptableFontSize && (getTextWidthCanvas(catText, categoryFontFamily, finalFontSize, categoryFontWeight) <= getChordLength(r, Math.abs(estimatedCategoryY)) * 0.9 || shouldWrapCategory) && r >= minRadiusForCategoryLabel;

        // 4. 渲染标签 - 动态调整垂直位置
        let finalValueY = 0;
        let finalCategoryY = 0;
        
        if (showValue && showCategory) {
            // 计算总高度
            const totalHeight = categoryLabelHeight + finalFontSize + finalFontSize * catLineHeight; // 类别高度 + 数值高度 + 间距
            // 垂直居中这个整体
            const startY = -totalHeight / 2;
            finalCategoryY = startY; // 类别标签从顶部开始
            finalValueY = startY + categoryLabelHeight + finalFontSize * catLineHeight; // 数值标签在类别下方加间距
        } else if (showValue) {
            finalValueY = 0; // 只显示数值，垂直居中
        } else if (showCategory) {
            // 只显示类别，将其垂直居中（考虑可能的多行）
            finalCategoryY = -categoryLabelHeight / 2;
        }

        // 渲染数值标签
        if (showValue) {
            gNode.append("text")
                .attr("class", "value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // 基线改为 hanging，方便从y值向下渲染
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("fill", adaptiveTextColor) // 使用自适应文本颜色
                .style("pointer-events", "none")
                .text(valText);
        }

        // 渲染类别标签 (可能换行)
        if (showCategory) {
            const catLabel = gNode.append("text")
                .attr("class", "category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // 基线改为 hanging
                .attr("y", finalCategoryY)
                .style("fill", adaptiveTextColor) // 使用自适应文本颜色
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("pointer-events", "none");

            if (shouldWrapCategory) {
                // 执行换行逻辑，使用 tspan
                const words = catText.split(/\s+/);
                let line = [];
                let lineNumber = 0;
                let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0); // 第一个tspan的dy为0
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.font = `${categoryFontWeight} ${finalFontSize}px ${categoryFontFamily}`;
                categoryMaxWidth = getChordLength(r, Math.abs(finalCategoryY + finalFontSize * (1 + catLineHeight) * lineNumber)) * 0.9; // 重新计算当前行的最大宽度

                if (words.length <= 1) { // 按字符换行
                    const chars = catText.split('');
                    let currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        // 检查宽度是否适合当前行
                         categoryMaxWidth = getChordLength(r, Math.abs(finalCategoryY + finalFontSize * (1 + catLineHeight) * lineNumber)) * 0.9;
                        if (tempCtx.measureText(testLine).width <= categoryMaxWidth || currentLine.length === 0) {
                            currentLine += chars[i];
                        } else {
                            tspan.text(currentLine);
                            lineNumber++;
                            currentLine = chars[i];
                            tspan = catLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`) // 后续行的dy
                                .text(currentLine);
                        }
                    }
                    tspan.text(currentLine);
                } else { // 按单词换行
                    let word;
                    while (word = words.shift()) {
                        line.push(word);
                        const testLine = line.join(" ");
                         // 检查宽度是否适合当前行
                         categoryMaxWidth = getChordLength(r, Math.abs(finalCategoryY + finalFontSize * (1 + catLineHeight) * lineNumber)) * 0.9;
                        if (tempCtx.measureText(testLine).width > categoryMaxWidth && line.length > 1) {
                            line.pop();
                            tspan.text(line.join(" "));
                            lineNumber++;
                            line = [word];
                            tspan = catLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`) // 后续行的dy
                                .text(word);
                        } else {
                            tspan.text(line.join(" "));
                        }
                    }
                }
            } else {
                // 不换行，直接显示
                catLabel.text(catText);
            }
        }
    });

    return svg.node(); // 返回 SVG DOM 节点
}

/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart(droplet)",
    "chart_name": "proportional_area_chart_other_01",
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
        .force("center", d3.forceCenter(W/2, H/2).strength(0.02)) // 减弱中心引力
        .force("charge", d3.forceManyBody().strength(-15)) // 增强节点间斥力
        // 使用collide力允许适度重叠（minDistance = radius1 + radius2 - 5）
        .force("collide", d3.forceCollide().radius(d => d.r).strength(0.95))
        // 添加环形引力，帮助节点保持在圆环位置
        .force("radial", d3.forceRadial(Math.min(W, H) * 0.3, W/2, H/2).strength(0.1))
        .stop();

    // 设置初始位置 - 大圆在中心，小圆在周围螺旋状排列
    if (nodes.length > 0) {
        // 最大的圆固定在中心位置
        nodes[0].fx = W * 0.5;
        nodes[0].fy = H * 0.5;
    }
    
    // 对于更多的圆，螺旋状初始位置
    if (nodes.length > 1) {
        const angle_step = 2 * Math.PI / (nodes.length - 1);
        let radius_step = Math.min(W, H) * 0.15;
        let current_radius = radius_step;
        
        for (let i = 1; i < nodes.length; i++) {
            const angle = i * angle_step;
            nodes[i].x = W/2 + current_radius * Math.cos(angle);
            nodes[i].y = H/2 + current_radius * Math.sin(angle);
            
            // 每5个节点增加螺旋半径
            if (i % 5 === 0) {
                current_radius += radius_step;
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
                // 水平边界约束
                d.x = Math.max(d.r, Math.min(W - d.r, d.x));
                // 垂直边界约束，确保不进入顶部保护区域
                d.y = Math.max(TOP_PROTECTED_AREA + d.r, Math.min(H - d.r, d.y));
            }
        });
    }

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

    // 添加渐变和高光效果的定义
    const defs = svg.append("defs");
    
    // 为每个节点创建唯一的高光渐变
    nodes.forEach((node, i) => {
        // 创建径向渐变定义
        const gradientId = `highlight-gradient-${i}`;
        
        // 获取基础颜色，并分析其亮度和饱和度
        const baseColor = d3.color(node.color);
        const isDarkColor = baseColor ? getColorBrightness(node.color) < 0.5 : false;
        
        // 根据颜色亮度调整高光参数
        const highlightParams = {
            cx: isDarkColor ? "65%" : "70%",   // 深色稍微向中心移动
            cy: isDarkColor ? "65%" : "70%",   // 深色稍微向中心移动
            r: isDarkColor ? "45%" : "40%",    // 深色高光范围稍大
            opacity: isDarkColor ? 0.9 : 0.8   // 深色不透明度更高
        };
        
        const gradient = defs.append("radialGradient")
            .attr("id", gradientId)
            .attr("cx", highlightParams.cx)
            .attr("cy", highlightParams.cy)
            .attr("r", highlightParams.r)
            .attr("fx", "75%")
            .attr("fy", "75%");
            
        // 根据颜色创建适当的高光色
        // 对于较深的颜色，使用更亮的高光
        const lightColor = baseColor 
            ? (isDarkColor ? baseColor.brighter(2.5) : baseColor.brighter(1.8)) 
            : "#ffffff";
        
        // 渐变颜色停止点
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#ffffff") // 中心点使用白色
            .attr("stop-opacity", isDarkColor ? 0.95 : 0.85);
            
        gradient.append("stop")
            .attr("offset", "15%")
            .attr("stop-color", lightColor)
            .attr("stop-opacity", isDarkColor ? 0.8 : 0.7);
            
        gradient.append("stop")
            .attr("offset", "40%") // 深色扩大高光范围
            .attr("stop-color", lightColor)
            .attr("stop-opacity", 0.3);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", node.color)
            .attr("stop-opacity", 0);
        
        // 保存渐变ID和高光参数到节点对象中
        node.gradientId = gradientId;
        node.highlightParams = highlightParams;
    });

    // 创建主绘图区域 <g> 元素，应用边距
    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);
    
    // 添加一个辅助函数用于创建水滴路径
    function createDropPath(radius) {
        // 使用用户提供的SVG路径，进行缩放调整
        // 原始路径: M505.328 61.552S191.472 464.832 191.856 632.944c0.416 181.296 149.408 327.84 319.168 327.392 169.744-0.464 322.192-147.824 321.776-329.12-0.416-173.744-327.472-569.664-327.472-569.664z
        
        // 计算缩放比例 (原始路径的中心约为 [512, 512]，尺寸约为 960)
        const scale = radius * 2 / 960;
        
        // 平移路径，使其中心在(0,0)点
        return `
            M${(505.328-512)*scale} ${(61.552-512)*scale}
            S${(191.472-512)*scale} ${(464.832-512)*scale} ${(191.856-512)*scale} ${(632.944-512)*scale}
            c${0.416*scale} ${181.296*scale} ${149.408*scale} ${327.84*scale} ${319.168*scale} ${327.392*scale}
            c${169.744*scale} ${-0.464*scale} ${322.192*scale} ${-147.824*scale} ${321.776*scale} ${-329.12*scale}
            c${-0.416*scale} ${-173.744*scale} ${-327.472*scale} ${-569.664*scale} ${-327.472*scale} ${-569.664*scale}
            z
        `;
    }

    // 创建节点分组 <g> 元素
    const nodeG=g.selectAll("g.node")
        .data(nodes,d=>d.id) // 绑定已放置节点数据，使用 id 作为 key
        .join("g")
        .attr("class","node")
        .attr("transform",d=>`translate(${d.x},${d.y})`); // 定位到计算好的位置

    // 绘制水滴形状
    nodeG.append("path")
        .attr("d", d => createDropPath(d.r)) // 使用水滴路径
        .attr("fill", d => d.color) // 填充色
        .attr("stroke", "#fff") // 白色描边
        .attr("stroke-width", 0.8) // 描边宽度
        .attr("opacity", 1); // 完全不透明
        
    // 添加高光效果图层 - 使用相同的路径但使用渐变填充
    nodeG.append("path")
        .attr("d", d => createDropPath(d.r)) // 使用相同的水滴路径
        .attr("fill", d => `url(#${d.gradientId})`) // 使用渐变填充
        .attr("stroke", "none") // 无描边
        .attr("opacity", d => d.highlightParams.opacity); // 使用为每个节点计算的不透明度

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

    // 弦长计算函数 - 根据到中心的距离计算该位置的最大水平宽度
    function getChordLength(radius, distanceFromCenter) {
        // 基于用户提供的水滴SVG路径估算宽度
        // 路径是顶部尖形，底部圆润的典型水滴形状

        // 检查 distanceFromCenter 是否有效 (原SVG尺寸约为垂直960)
        const maxHeight = radius * 2;
        if (Math.abs(distanceFromCenter) >= maxHeight / 2) {
            return 0; // 如果距离超出水滴范围，弦长为0
        }
        
        // 归一化距离 (-1到1之间)，顶部为负，底部为正
        const normalizedY = distanceFromCenter / (maxHeight / 2);
        
        // 基于水滴形状特征的宽度估算
        // 水滴顶部窄 (normalizedY接近-1)，底部宽 (normalizedY接近1)
        let widthRatio;
        
        if (normalizedY < -0.5) {
            // 顶部区域 (最窄)
            widthRatio = 0.1 + 0.3 * (1 + normalizedY); // 从0.1增加到0.4
        } else if (normalizedY < 0) {
            // 上半部分
            widthRatio = 0.4 + 0.3 * (1 + normalizedY * 2); // 从0.4增加到0.7
        } else {
            // 下半部分 (最宽)
            widthRatio = 0.7 + 0.2 * (1 - Math.pow(normalizedY, 2)); // 从0.7到0.9不等
        }
        
        // 计算该位置的估计宽度
        return radius * 2 * widthRatio;
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

        // 调整垂直位置 - 在水滴形状中，我们需要将文本整体上移一点，因为水滴底部更宽
        // 估算文本放置的垂直位置
        const verticalOffset = r * 0.15; // 向上偏移，因为水滴底部较宽
        const estimatedCategoryY = catText ? -currentFontSize * 0.55 - verticalOffset : -verticalOffset;
        const estimatedValueY = catText ? currentFontSize * 0.55 - verticalOffset : -verticalOffset;

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
            // 垂直居中这个整体，并向上偏移
            const startY = -totalHeight / 2 - verticalOffset;
            finalCategoryY = startY; // 类别标签从顶部开始
            finalValueY = startY + categoryLabelHeight + finalFontSize * catLineHeight; // 数值标签在类别下方加间距
        } else if (showValue) {
            finalValueY = -verticalOffset; // 只显示数值，垂直居中并向上偏移
        } else if (showCategory) {
            // 只显示类别，将其垂直居中（考虑可能的多行）并向上偏移
            finalCategoryY = -categoryLabelHeight / 2 - verticalOffset;
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

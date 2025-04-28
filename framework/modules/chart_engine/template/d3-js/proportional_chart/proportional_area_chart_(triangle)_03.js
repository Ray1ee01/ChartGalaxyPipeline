/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Triangle)",
    "chart_name": "proportional_area_chart_triangle_03",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "overlay",
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
    // 1) 圆占画布比例，越大越拥挤、越难排
    const fillRatio = 0.80;                 // 0.70 ~ 0.90

    // 2) 力模拟参数
    const forceSimulationSteps = 300;       // 模拟步数
    const forceCollideStrength = 0.8;       // 碰撞力强度 (0.1-1.0) - 增加强度
    const forceCenterStrength = 0.1;        // 中心力强度 (0.05-0.2)
    const forceCollideRadiusPadding = 8;    // 碰撞半径扩展 (预留边距) - 增加间隔

    const fullW = dataJSON.variables?.width  || 600;
    const fullH = dataJSON.variables?.height || 600;
    const margin = { top: 90, right: 20, bottom: 60, left: 20 }; // 边距
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 3) 半径限制
    const minRadius = 25; // 最小三角形半径 (对应边长50)
    const maxRadius = 100; // 最大三角形半径 (对应边长200)
    const minSideForInnerLabel = 70; // 三角形边长小于此值时，将标签放在外部

    // 数据处理：计算每个节点的值、大小、颜色等
    const maxValue = d3.max(raw, d => +d[yField]); // 获取最大值
    const minValue = d3.min(raw, d => +d[yField]); // 获取最小值
    
    // 创建线性比例尺映射函数
    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range([minRadius, maxRadius]);
    
    const nodes = raw.map((d,i)=>({
        id   : d[xField]!=null?String(d[xField]):`__${i}__`, // 节点ID (X字段)，若为空则生成临时ID
        val  : +d[yField], // 节点值 (Y字段)
        // 使用比例尺计算半径
        r    : radiusScale(+d[yField]),
        color: dataJSON.colors?.field?.[d[xField]] || d3.schemeTableau10[i%10], // 节点颜色
        icon : dataJSON.images?.field?.[d[xField]] || null, // 图标URL (从JSON中获取)
        raw  : d, // 原始数据
        // 初始化位置 (力导向布局的起点)
        x    : W * Math.random(),
        y    : H * Math.random()
    })).sort((a,b)=>b.r-a.r); // 按半径降序排序

    /* ============ 3. 力导向布局 ============ */
    // 创建力模拟
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(W/2, H/2).strength(forceCenterStrength)) // 中心力
        .force("collide", d3.forceCollide(d => {
            // 当三角形较小时增加碰撞半径，为外部标签留出更多空间
            const baseRadius = d.r + forceCollideRadiusPadding;
            return d.r < minSideForInnerLabel/2 ? baseRadius * 2.2 : baseRadius * 1.2; // 增加所有碰撞半径以避免重叠
        }).strength(forceCollideStrength)) // 碰撞力
        .force("x", d3.forceX(W/2).strength(0.05)) // x方向轻微约束力
        .force("y", d3.forceY(H/2).strength(0.05)) // y方向轻微约束力
        .stop(); // 先停止，手动控制步进

    // 运行指定步数的模拟
    for (let i = 0; i < forceSimulationSteps; ++i) {
        simulation.tick();
    }

    // 确保所有节点都在边界内
    nodes.forEach(d => {
        // 为小三角形预留外部标签空间
        const marginPadding = d.r < minSideForInnerLabel/2 ? d.r * 1.5 : d.r;
        d.x = Math.max(marginPadding, Math.min(W - marginPadding, d.x));
        d.y = Math.max(marginPadding, Math.min(H - marginPadding, d.y));
    });

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
        .style("height","auto") // 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建渐变定义
    const defs = svg.append("defs");

    // 为每个节点创建唯一的渐变ID
    nodes.forEach((node, i) => {
        // 提取基础颜色
        const baseColor = node.color;
        
        // 创建渐变
        const gradientId = `triangle-gradient-${i}`;
        node.gradientId = gradientId;
        
        // 创建线性渐变 - 从上到下
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%")
            .attr("spreadMethod", "pad");
        
        // 颜色处理
        let color1, color2, color3, color4;
        
        // 如果是十六进制颜色
        if (baseColor.startsWith("#")) {
            // 将颜色转换为 RGB 格式
            const r = parseInt(baseColor.slice(1, 3), 16);
            const g = parseInt(baseColor.slice(3, 5), 16);
            const b = parseInt(baseColor.slice(5, 7), 16);
            
            // 创建显著更亮的顶部颜色 (增加亮度约70%)
            const lighterR = Math.min(255, Math.round(r * 1.7));
            const lighterG = Math.min(255, Math.round(g * 1.7));
            const lighterB = Math.min(255, Math.round(b * 1.7));
            
            // 创建中上部过渡颜色
            const midLightR = Math.min(255, Math.round(r * 1.3));
            const midLightG = Math.min(255, Math.round(g * 1.3));
            const midLightB = Math.min(255, Math.round(b * 1.3));
            
            // 创建中下部过渡颜色
            const midDarkR = Math.min(255, Math.round(r * 0.9));
            const midDarkG = Math.min(255, Math.round(g * 0.9));
            const midDarkB = Math.min(255, Math.round(b * 0.9));
            
            // 创建显著更暗的底部颜色 (减少亮度约40%)
            const darkerR = Math.max(0, Math.round(r * 0.6));
            const darkerG = Math.max(0, Math.round(g * 0.6));
            const darkerB = Math.max(0, Math.round(b * 0.6));
            
            color1 = `rgb(${lighterR}, ${lighterG}, ${lighterB})`;
            color2 = `rgb(${midLightR}, ${midLightG}, ${midLightB})`;
            color3 = `rgb(${midDarkR}, ${midDarkG}, ${midDarkB})`;
            color4 = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
        } 
        // 如果是RGB或RGBA颜色
        else if (baseColor.startsWith("rgb")) {
            // 提取RGB值
            const rgbMatch = baseColor.match(/\d+/g);
            if (rgbMatch && rgbMatch.length >= 3) {
                const r = parseInt(rgbMatch[0]);
                const g = parseInt(rgbMatch[1]);
                const b = parseInt(rgbMatch[2]);
                
                // 创建显著更亮的顶部颜色
                const lighterR = Math.min(255, Math.round(r * 1.7));
                const lighterG = Math.min(255, Math.round(g * 1.7));
                const lighterB = Math.min(255, Math.round(b * 1.7));
                
                // 创建中上部过渡颜色
                const midLightR = Math.min(255, Math.round(r * 1.3));
                const midLightG = Math.min(255, Math.round(g * 1.3));
                const midLightB = Math.min(255, Math.round(b * 1.3));
                
                // 创建中下部过渡颜色
                const midDarkR = Math.min(255, Math.round(r * 0.9));
                const midDarkG = Math.min(255, Math.round(g * 0.9));
                const midDarkB = Math.min(255, Math.round(b * 0.9));
                
                // 创建显著更暗的底部颜色
                const darkerR = Math.max(0, Math.round(r * 0.6));
                const darkerG = Math.max(0, Math.round(g * 0.6));
                const darkerB = Math.max(0, Math.round(b * 0.6));
                
                // 处理透明度
                const alpha = rgbMatch.length > 3 ? rgbMatch[3] : "1";
                
                color1 = `rgba(${lighterR}, ${lighterG}, ${lighterB}, ${alpha})`;
                color2 = `rgba(${midLightR}, ${midLightG}, ${midLightB}, ${alpha})`;
                color3 = `rgba(${midDarkR}, ${midDarkG}, ${midDarkB}, ${alpha})`;
                color4 = `rgba(${darkerR}, ${darkerG}, ${darkerB}, ${alpha})`;
            } else {
                // 回退到原始颜色
                color1 = baseColor;
                color2 = baseColor;
                color3 = baseColor;
                color4 = baseColor;
            }
        } else {
            // 对于其他颜色格式，使用原始颜色
            color1 = baseColor;
            color2 = baseColor;
            color3 = baseColor;
            color4 = baseColor;
        }
        
        // 添加渐变停止点 - 更多的渐变点创造更平滑的效果
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", color1)
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "35%")
            .attr("stop-color", color2)
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "70%")
            .attr("stop-color", color3)
            .attr("stop-opacity", 1);
            
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", color4)
            .attr("stop-opacity", 1);
            
        // 添加高光效果
        const highlightId = `triangle-highlight-${i}`;
        node.highlightId = highlightId;
        
        // 创建高光渐变 - 从顶部向下
        const highlight = defs.append("linearGradient")
            .attr("id", highlightId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
            
        highlight.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "white")
            .attr("stop-opacity", 0.6);
            
        highlight.append("stop")
            .attr("offset", "15%")
            .attr("stop-color", "white")
            .attr("stop-opacity", 0.2);
            
        highlight.append("stop")
            .attr("offset", "30%")
            .attr("stop-color", "white")
            .attr("stop-opacity", 0.1);
            
        highlight.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "white")
            .attr("stop-opacity", 0);
            
        // 添加阴影
        const shadowId = `triangle-shadow-${i}`;
        node.shadowId = shadowId;
        
        // 创建滤镜
        const filter = defs.append("filter")
            .attr("id", shadowId)
            .attr("width", "150%")
            .attr("height", "150%");
            
        // 添加阴影效果
        filter.append("feDropShadow")
            .attr("dx", "3") // 水平偏移
            .attr("dy", "3") // 垂直偏移
            .attr("stdDeviation", "2.5") // 模糊度
            .attr("flood-color", "rgba(0,0,0,0.3)") // 阴影颜色
            .attr("flood-opacity", "0.5"); // 阴影不透明度
    });

    // 可选：添加全局背景微光效果，使图表更有深度感
    const backgroundGlowId = "background-glow";
    const backgroundGlow = defs.append("radialGradient")
        .attr("id", backgroundGlowId)
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "70%")
        .attr("fx", "50%")
        .attr("fy", "50%");

    backgroundGlow.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#ffffff")
        .attr("stop-opacity", 0.2);
        
    backgroundGlow.append("stop")
        .attr("offset", "70%")
        .attr("stop-color", "#f0f0f0")
        .attr("stop-opacity", 0.1);
        
    backgroundGlow.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#f5f5f5")
        .attr("stop-opacity", 0);

    // 创建主绘图区域 <g> 元素，应用边距
    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);

    // 添加微光背景效果
    g.append("rect")
        .attr("width", W)
        .attr("height", H)
        .attr("fill", `url(#${backgroundGlowId})`)
        .attr("opacity", 0.5); // 降低背景透明度，使其更微妙

    // 数据处理 - 添加绘图顺序索引（面积小的在上层，大的在底层）
    nodes.forEach((d, i) => {
        d.zIndex = nodes.length - i; // 由于数据已按半径降序排序，所以索引大的（面积小的）会有更高的zIndex
    });

    /* ---- 文本和图标设置 ---- */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSizeBase = parseFloat(dataJSON.typography?.annotation?.font_size || '12'); // 数值标签基础字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSizeBase = parseFloat(dataJSON.typography?.label?.font_size || '11'); // 维度标签基础字号
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    const textColor = dataJSON.colors?.text_color || '#fff'; // 文本颜色 (优先JSON，默认白色)

    // 图标大小相关配置
    const iconSizeRatio = 0.35; // 图标相对于三角形边长的比例 - 减小比例
    const minIconSize = 32; // 最小图标尺寸，确保所有图标至少32*32像素
    const maxIconSize = 60; // 最大图标尺寸 - 减小限制
    
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

    // 计算三角形在指定高度处的宽度
    function getTriangleWidthAtHeight(side, totalHeight, distanceFromTop) {
        // 如果超出三角形范围
        if (distanceFromTop < 0 || distanceFromTop > totalHeight) {
            return 0;
        }
        // 三角形底边的宽度
        const baseWidth = side;
        // 在指定高度处的宽度比例 (距离顶部越远，宽度越大)
        const widthRatio = distanceFromTop / totalHeight;
        return baseWidth * widthRatio;
    }

    // 外部标签固定使用黑色
    const externalLabelColor = "#000000";

    // 函数getTextColorForBackground不再需要使用动态颜色，直接返回黑色
    function getTextColorForBackground(backgroundColor) {
        return "#000000"; // 始终返回黑色文本
    }
    
    // --- 新的文本和图标渲染逻辑 ---
    const minAcceptableFontSize = 8; // 可接受的最小字体大小
    const minSideForCategoryLabel = 20; // 显示维度标签的最小边长阈值
    const fontSizeScaleFactor = 0.2; // 字体大小与三角形边长的缩放比例 - 减小比例
    const maxFontSize = 16; // 最大字体大小 - 减小限制

    // 创建节点分组 <g> 元素（按zIndex排序）
    const nodeG=g.selectAll("g.node")
        .data(nodes,d=>d.id) // 绑定已放置节点数据，使用 id 作为 key
        .join("g")
        .attr("class","node")
        .attr("transform",d=>`translate(${d.x},${d.y})`) // 定位到计算好的位置
        .sort((a, b) => a.zIndex - b.zIndex); // 确保面积小的在上层绘制

    // 绘制正三角形（替代圆形）
    nodeG.each(function(d) {
        // 为调试添加三角形ID标记
        const nodeId = d.id;
        
        const gNode = d3.select(this);
        const side = 2 * d.r; // 三角形边长 = 圆直径
        const triangleHeight = side * Math.sqrt(3) / 2; // 三角形高度
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        const hasIcon = d.icon != null;  // 提前计算是否有图标
        
        // 根据三角形的背景色选择合适的文本颜色
        const backgroundColor = d.color;
        const adaptiveTextColor = getTextColorForBackground(backgroundColor);

        // 创建三角形路径 - 使用渐变填充
        d3.select(this).append("path")
            .attr("d", d3.line()([
                [0, -triangleHeight * 2/3],          // 顶部顶点
                [-side/2, triangleHeight * 1/3],      // 左下顶点
                [side/2, triangleHeight * 1/3]        // 右下顶点
            ])) 
            .attr("fill", `url(#${d.gradientId})`) // 使用渐变填充
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.0)
            .attr("filter", `url(#${d.shadowId})`); // 应用阴影效果

        // 添加高光效果
        d3.select(this).append("path")
            .attr("d", d3.line()([
                [0, -triangleHeight * 2/3],          // 顶部顶点
                [-side/2, triangleHeight * 1/3],      // 左下顶点
                [side/2, triangleHeight * 1/3]        // 右下顶点
            ]))
            .attr("fill", `url(#${d.highlightId})`) // 使用高光渐变
            .attr("stroke", "none")
            .attr("pointer-events", "none"); // 确保高光不会影响交互

        // 判断是否使用外部标签
        const useExternalLabel = side < minSideForInnerLabel;
        
        // 如果使用外部标签，添加外部标签
        if (useExternalLabel) {
            // 如果有图标且足够大，在三角形内显示图标
            if (hasIcon && side >= 20) {
                const smallIconSize = Math.max(minIconSize, Math.min(side * 0.6, minIconSize * 1.2));
                
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", smallIconSize)
                    .attr("height", smallIconSize)
                    .attr("x", -smallIconSize/2)
                    .attr("y", -smallIconSize/2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            
            // 创建外部标签组
            const externalLabelFontSize = Math.min(12, Math.max(10, side/6));
            
            // 计算外部标签位置
            // 底部偏右位置
            const labelY = triangleHeight * 1/3 + 8;  // 增加间距，避免与三角形重叠
            
            // 添加连接线
            gNode.append("line")
                .attr("x1", 0)
                .attr("y1", triangleHeight * 1/3)
                .attr("x2", 0)
                .attr("y2", labelY - 2)
                .attr("stroke", "#666")
                .attr("stroke-width", 0.8);
            
            // 外部标签 - 始终同时显示类别和数值
            // 测量类别文本和值文本宽度
            const catWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, externalLabelFontSize, categoryFontWeight) : 0;
            const valWidth = getTextWidthCanvas(valText, valueFontFamily, externalLabelFontSize, valueFontWeight);
            const maxWidth = Math.max(catWidth, valWidth);
            
            // 如果没有类别文本，但需要显示，则使用id
            if (!catText) {
                catText = d.id || "";
            }
            
            // 即使没有类别文本也预留空间，保持一致的视觉效果
            const totalHeight = externalLabelFontSize * 2 + 6; // 两行文本高度加上间距
            
            // 添加背景矩形
            gNode.append("rect")
                .attr("x", -maxWidth/2 - 5)
                .attr("y", labelY - 2)
                .attr("width", maxWidth + 10)
                .attr("height", totalHeight)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", "white")
                .attr("fill-opacity", 0.8)
                .attr("stroke", "#ccc")
                .attr("stroke-width", 0.5);
            
            // 类别文本 - 始终显示
            gNode.append("text")
                .attr("class", "external-category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", labelY)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${externalLabelFontSize}px`)
                .style("fill", externalLabelColor)
                .text(catText);
            
            // 数值标签（在类别标签下方）
            gNode.append("text")
                .attr("class", "external-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", labelY + externalLabelFontSize + 2)
                .style("font-family", valueFontFamily)
                .style("font-weight", valueFontWeight)
                .style("font-size", `${externalLabelFontSize}px`)
                .style("fill", externalLabelColor)
                .text(valText);
            
            return; // 提前结束，不执行内部标签逻辑
        }

        // 内部标签逻辑 - 对于没走外部标签逻辑的三角形，总是尝试添加内部标签
        
        // --- 确保最小尺寸三角形能显示标签 ---
        if (side < 40) {
            // 非常小的三角形，改用外部标签（很小的三角形无法同时显示两个标签）
            const simpleFontSize = Math.max(8, Math.min(10, side/5));
            
            // 计算标签位置
            const labelY = triangleHeight * 1/3 + 8;
            
            // 添加连接线
            gNode.append("line")
                .attr("x1", 0)
                .attr("y1", triangleHeight * 1/3)
                .attr("x2", 0)
                .attr("y2", labelY - 2)
                .attr("stroke", "#666")
                .attr("stroke-width", 0.8);
                
            // 如果没有类别文本，但需要显示，则使用id
            if (!catText) {
                catText = d.id || "";
            }
            
            // 测量宽度和计算高度
            const catWidth = getTextWidthCanvas(catText, categoryFontFamily, simpleFontSize, categoryFontWeight);
            const valWidth = getTextWidthCanvas(valText, valueFontFamily, simpleFontSize, valueFontWeight);
            const maxWidth = Math.max(catWidth, valWidth);
            const totalHeight = simpleFontSize * 2 + 6;
            
            // 添加背景
            gNode.append("rect")
                .attr("x", -maxWidth/2 - 5)
                .attr("y", labelY - 2)
                .attr("width", maxWidth + 10)
                .attr("height", totalHeight)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", "white")
                .attr("fill-opacity", 0.8)
                .attr("stroke", "#ccc")
                .attr("stroke-width", 0.5);
            
            // 类别标签
            gNode.append("text")
                .attr("class", "small-category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", labelY)
                .style("font-size", `${simpleFontSize}px`)
                .style("font-weight", categoryFontWeight)
                .style("font-family", categoryFontFamily)
                .style("fill", externalLabelColor)
                .text(catText);
                
            // 值标签
            gNode.append("text")
                .attr("class", "small-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", labelY + simpleFontSize + 2)
                .style("font-size", `${simpleFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("fill", externalLabelColor)
                .text(valText);
                
            // 如果有图标，显示在三角形中央，确保最小尺寸
            if (hasIcon) {
                // 图标固定大小为32px
                const fixedIconSize = minIconSize;
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", fixedIconSize)
                    .attr("height", fixedIconSize)
                    .attr("x", -fixedIconSize/2)
                    .attr("y", -fixedIconSize/2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
                
            return; // 提前结束
        }
        
        // --- 对于大三角形，确保始终显示图标（如果有）和标签
        if (side >= 80) { // 降低大三角形的阈值以捕获更多三角形
            // 大三角形专用逻辑：简化布局，确保内容可见
            let currentY = -triangleHeight * 0.4; // 从顶部开始
            const simpleFontSize = Math.min(maxFontSize, Math.max(12, side * 0.08)); // 确保最小字体大小
            const iconSize = hasIcon ? Math.max(minIconSize, Math.min(maxIconSize, side * 0.3)) : 0;
            
            // 1. 如果有图标，添加图标
            if (hasIcon) {
                try {
                    gNode.append("image")
                        .attr("xlink:href", d.icon)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("x", -iconSize/2)
                        .attr("y", currentY)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    
                    currentY += iconSize + triangleHeight * 0.05; // 向下移动位置
                } catch(e) {
                    console.error("图标添加失败", e, d.icon);
                }
            }
            
            // 如果没有类别文本，但需要显示，则使用id
            if (!catText) {
                catText = d.id || "";
            }
            
            // 2. 始终添加类别标签
            // 添加背景提高可读性
            const catWidth = getTextWidthCanvas(catText, categoryFontFamily, simpleFontSize, categoryFontWeight);
            
            // 添加背景矩形
            gNode.append("rect")
                .attr("x", -catWidth/2 - 4)
                .attr("y", currentY - 2)
                .attr("width", catWidth + 8)
                .attr("height", simpleFontSize + 4)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", "white")
                .attr("fill-opacity", 0.7);
            
            gNode.append("text")
                .attr("class", "category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", currentY)
                .style("font-family", categoryFontFamily)
                .style("font-size", `${simpleFontSize}px`)
                .style("font-weight", categoryFontWeight)
                .style("fill", adaptiveTextColor)
                .text(catText);
            
            currentY += simpleFontSize + triangleHeight * 0.05; // 向下移动位置
            
            // 3. 添加值标签
            const valWidth = getTextWidthCanvas(valText, valueFontFamily, simpleFontSize, valueFontWeight);
            
            // 添加背景矩形
            gNode.append("rect")
                .attr("x", -valWidth/2 - 4)
                .attr("y", currentY - 2)
                .attr("width", valWidth + 8)
                .attr("height", simpleFontSize + 4)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", "white")
                .attr("fill-opacity", 0.7);
            
            gNode.append("text")
                .attr("class", "value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", currentY)
                .style("font-family", valueFontFamily)
                .style("font-size", `${simpleFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("fill", adaptiveTextColor)
                .text(valText);
            
            return; // 提前结束，不执行复杂布局逻辑
        }
        
        // 对于中等大小的三角形，执行标准布局计算
        // 1. 决定垂直空间划分 - 考虑有无图标
        
        // 基于边长动态调整图标比例
        const dynamicIconSizeRatio = side < 50 ? 0.25 : 0.35;
        
        // 2. 计算图标大小 (如果有)
        let iconSize = 0;
        if (hasIcon) {
            // 图标理想大小 = 边长 * 比例系数，但不超过最大值，不小于最小值
            iconSize = Math.max(minIconSize, Math.min(side * dynamicIconSizeRatio, maxIconSize));
        }
        
        // 3. 分配垂直空间 - 从上到下
        const padding = triangleHeight * 0.08; // 增加内部填充
        
        // 图标位置 (如果有)
        const iconY = -triangleHeight * 0.5 + padding; // 图标顶部Y坐标
        
        // 计算图标底部位置
        const iconBottom = hasIcon ? iconY + iconSize : -triangleHeight * 0.5 + padding;
        
        // 为三角形调整字体大小 - 三角形比圆形或正方形可用空间小
        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * fontSizeScaleFactor, // 基于边长和缩放因子估算初始大小
                (valueFontSizeBase + categoryFontSizeBase) / 2,
                maxFontSize
            )
        );

        // --- 文本位置初始计算 ---
        // 计算维度标签的位置 (在图标下方)
        const categoryY = iconBottom + padding;
        
        // 类别标签行高和换行处理
        let shouldWrapCategory = false;
        let categoryLines = 1;
        let categoryLineHeightPx = currentFontSize * (1 + catLineHeight);
        let categoryLabelHeight = currentFontSize;
        
        // 确保有类别文本可显示
        if (!catText) {
            catText = d.id || "";
        }
        
        // 文本换行和适应性调整
        let valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
        let categoryWidth = getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight);
        
        // 检查在各自位置的可用宽度
        const categoryYDistanceFromTop = triangleHeight * 2/3 + categoryY; // 从三角形顶点到类别标签的距离
        let availableWidthForCategory = getTriangleWidthAtHeight(side, triangleHeight, categoryYDistanceFromTop) * 0.9; // 留出10%安全边距
        
        // 计算值标签位置 (先假设类别标签是单行)
        const valueY = categoryY + categoryLabelHeight + padding;
        const valueYDistanceFromTop = triangleHeight * 2/3 + valueY;
        let availableWidthForValue = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.9;
        
        // 初始检查是否需要调整大小或换行
        let valueFits = valueWidth <= availableWidthForValue;
        let categoryFits = categoryWidth <= availableWidthForCategory;
        
        // 图标在其位置的可用宽度
        const iconYDistanceFromTop = triangleHeight * 2/3 + iconY + iconSize/2; // 图标中心到顶点的距离
        const availableWidthForIcon = hasIcon ? getTriangleWidthAtHeight(side, triangleHeight, iconYDistanceFromTop) * 0.9 : 0;
        
        // 检查是否需要调整图标大小
        const iconFits = !hasIcon || iconSize <= availableWidthForIcon;
        
        // 检查内部空间是否足够放置两个标签
        const canFitBothLabels = categoryFits && valueFits && (valueY + currentFontSize <= triangleHeight/2);
        
        // 如果无法同时适应类别和值标签，则改用外部标签
        if (!canFitBothLabels) {
            // 计算外部标签位置
            const labelY = triangleHeight * 1/3 + 8;
            
            // 添加连接线
            gNode.append("line")
                .attr("x1", 0)
                .attr("y1", triangleHeight * 1/3)
                .attr("x2", 0)
                .attr("y2", labelY - 2)
                .attr("stroke", "#666")
                .attr("stroke-width", 0.8);
                
            // 测量宽度和计算高度
            const extFontSize = Math.min(12, Math.max(10, side/6));
            const catWidth = getTextWidthCanvas(catText, categoryFontFamily, extFontSize, categoryFontWeight);
            const valWidth = getTextWidthCanvas(valText, valueFontFamily, extFontSize, valueFontWeight);
            const maxWidth = Math.max(catWidth, valWidth);
            const totalHeight = extFontSize * 2 + 6;
            
            // 添加背景
            gNode.append("rect")
                .attr("x", -maxWidth/2 - 5)
                .attr("y", labelY - 2)
                .attr("width", maxWidth + 10)
                .attr("height", totalHeight)
                .attr("rx", 3)
                .attr("ry", 3)
                .attr("fill", "white")
                .attr("fill-opacity", 0.8)
                .attr("stroke", "#ccc")
                .attr("stroke-width", 0.5);
            
            // 类别标签
            gNode.append("text")
                .attr("class", "external-category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", labelY)
                .style("font-size", `${extFontSize}px`)
                .style("font-weight", categoryFontWeight)
                .style("font-family", categoryFontFamily)
                .style("fill", externalLabelColor)
                .text(catText);
                
            // 值标签
            gNode.append("text")
                .attr("class", "external-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", labelY + extFontSize + 2)
                .style("font-size", `${extFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("fill", externalLabelColor)
                .text(valText);
            
            // 如果有图标且可以放在三角形内，仍然显示图标
            if (hasIcon && iconFits) {
                const adjustedIconSize = Math.max(minIconSize, iconSize);
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", adjustedIconSize)
                    .attr("height", adjustedIconSize)
                    .attr("x", -adjustedIconSize/2)
                    .attr("y", iconY)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            
            return; // 提前结束
        }
        
        // 调整字体大小和图标大小以适应三角形
        // 如果某个元素不适合，按照图标 > 类别标签 > 值标签的优先级调整
        if (!iconFits || !categoryFits || !valueFits) {
            // 1. 如果图标不适合，调整图标尺寸
            if (hasIcon && !iconFits) {
                iconSize = Math.max(minIconSize, availableWidthForIcon);
            }
            
            // 2. 如果文本不适合，调整字体大小或考虑换行
            while (!categoryFits || !valueFits) {
                // 先考虑换行类别文本
                if (catText && !categoryFits && needsWrapping && currentFontSize >= minCatFontSize) {
                    shouldWrapCategory = true;
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.font = `${categoryFontWeight} ${currentFontSize}px ${categoryFontFamily}`;
                    
                    // 估算换行行数
                    const words = catText.split(/\s+/);
                    const chars = catText.split('');
                    let lines = [];
                    let currentLine = '';
                    
                    // 根据空格数量决定按单词换行还是按字符换行
                    if (words.length <= 1) {
                        // 按字符换行
                        for (let i = 0; i < chars.length; i++) {
                            const testLine = currentLine + chars[i];
                            if (tempCtx.measureText(testLine).width <= availableWidthForCategory || currentLine === '') {
                                currentLine += chars[i];
                            } else {
                                lines.push(currentLine);
                                currentLine = chars[i];
                            }
                        }
                        if (currentLine) lines.push(currentLine);
                    } else {
                        // 按单词换行
                        let line = [];
                        for (const word of words) {
                            const testLine = [...line, word].join(' ');
                            if (tempCtx.measureText(testLine).width <= availableWidthForCategory || line.length === 0) {
                                line.push(word);
                            } else {
                                lines.push(line.join(' '));
                                line = [word];
                            }
                        }
                        if (line.length > 0) lines.push(line.join(' '));
                    }
                    
                    // 更新行数和总高度
                    categoryLines = lines.length;
                    categoryLabelHeight = currentFontSize * lines.length + catLineHeight * currentFontSize * (lines.length - 1);
                    
                    // 重新计算值标签位置和可用宽度
                    const newValueY = categoryY + categoryLabelHeight + padding;
                    const newValueYDistanceFromTop = triangleHeight * 2/3 + newValueY;
                    availableWidthForValue = getTriangleWidthAtHeight(side, triangleHeight, newValueYDistanceFromTop) * 0.9;
                    
                    // 重新检查值标签是否适合
                    valueFits = valueWidth <= availableWidthForValue;
                    categoryFits = true; // 通过换行解决类别标签
                } else {
                    // 如果无法通过换行解决或值标签仍不适合，尝试减小字体
                    currentFontSize -= 1;
                    if (currentFontSize < minAcceptableFontSize) {
                        break; // 达到最小字体大小，无法继续调整
                    }
                    
                    // 重新计算文本宽度
                    valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
                    categoryWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight) : 0;
                    
                    // 更新行高相关参数
                    categoryLineHeightPx = currentFontSize * (1 + catLineHeight);
                    if (!shouldWrapCategory) {
                        categoryLabelHeight = currentFontSize;
                    } else {
                        categoryLabelHeight = currentFontSize * categoryLines + catLineHeight * currentFontSize * (categoryLines - 1);
                    }
                    
                    // 重新检查适应性
                    valueFits = valueWidth <= availableWidthForValue;
                    categoryFits = !catText || categoryWidth <= availableWidthForCategory;
                }
            }
        }
        
        // 最终计算各元素位置
        const finalFontSize = currentFontSize;
        const finalIconSize = iconSize;
        
        // 决定是否显示各元素
        const showValue = valueFits && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryFits && finalFontSize >= minAcceptableFontSize;
        const showIcon = hasIcon && iconFits && iconSize >= minIconSize;
        
        // 确保至少显示值标签
        const mustShowValue = true; // 总是显示值标签
        
        // 计算内容高度和位置
        let totalContentHeight = 0;
        if (showIcon) totalContentHeight += finalIconSize + padding;
        if (showCategory) totalContentHeight += categoryLabelHeight + padding;
        if (showValue || mustShowValue) totalContentHeight += finalFontSize;
        
        // 垂直居中所有内容
        const availableHeight = triangleHeight * 0.8; // 只使用三角形高度的80%
        const contentTopY = -availableHeight / 2 + (availableHeight - totalContentHeight) / 2;
        
        // 计算各元素的垂直位置
        let finalIconY = 0, finalCategoryY = 0, finalValueY = 0;
        let currentY = contentTopY;
        
        if (showIcon) {
            finalIconY = currentY;
            currentY += finalIconSize + padding;
        }
        
        if (showCategory) {
            finalCategoryY = currentY;
            currentY += categoryLabelHeight + 3;
        }
        
        if (showValue || mustShowValue) {
            finalValueY = currentY;
        }
        
        // --- 渲染内容 ---
        
        // 1. 渲染图标
        if (showIcon) {
            // 计算图标在其位置的可用宽度
            const iconYCenter = finalIconY + finalIconSize / 2;
            const iconYDistanceFromTop = triangleHeight * 2/3 + iconYCenter;
            const iconAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, iconYDistanceFromTop) * 0.9;
            
            // 确保图标不超出可用宽度但不小于最小尺寸
            const adjustedIconSize = Math.max(minIconSize, Math.min(finalIconSize, iconAvailableWidth));
                
            // 添加图标
            gNode.append("image")
                .attr("xlink:href", d.icon)
                .attr("width", adjustedIconSize)
                .attr("height", adjustedIconSize)
                .attr("x", -adjustedIconSize/2)
                .attr("y", finalIconY)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        // 2. 渲染类别标签
        if (showCategory) {
            renderCategoryLabel(gNode, catText, finalCategoryY, shouldWrapCategory, side, 
                triangleHeight, categoryFontFamily, categoryFontWeight, finalFontSize, 
                adaptiveTextColor, categoryLineHeightPx, categoryWidth, words, getTextWidthCanvas);
        }
        
        // 3. 渲染值标签
        if (showValue || mustShowValue) {
            // 计算值标签在最终位置的可用宽度
            const valueYDistanceFromTop = triangleHeight * 2/3 + finalValueY;
            const valueAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.9;
            
            // 确保文本宽度适应可用空间
            let finalValueFontSize = finalFontSize;
            if (valueWidth > valueAvailableWidth) {
                // 计算适合的字体大小
                const ratio = valueAvailableWidth / valueWidth;
                finalValueFontSize = Math.max(minAcceptableFontSize, Math.floor(finalFontSize * ratio));
            }
                
            // 设置最终字体大小
            const fontSize = Math.max(finalValueFontSize, minAcceptableFontSize);
            
            // 如果空间不足，添加背景提高可读性
            if (valueWidth > valueAvailableWidth * 0.9) {
                gNode.append("rect")
                    .attr("x", -valueWidth/2 - 2)
                    .attr("y", finalValueY - 1)
                    .attr("width", valueWidth + 4)
                    .attr("height", fontSize + 2)
                    .attr("rx", 2)
                    .attr("ry", 2)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.7);
            }
            
            // 添加值标签文本
            gNode.append("text")
                .attr("class", "value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", `${fontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valText);
        }
    });

    // 辅助函数：渲染带换行的类别标签
    function renderCategoryLabel(gNode, catText, finalY, shouldWrap, side, triangleHeight, 
                                fontFamily, fontWeight, fontSize, textColor, lineHeight, 
                                width, words, measureFn) {
        // 创建实际文本标签
        const catLabel = gNode.append("text")
            .attr("class", "category-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", finalY)
            .style("fill", textColor)
            .style("font-family", fontFamily)
            .style("font-weight", fontWeight)
            .style("font-size", `${fontSize}px`)
            .style("pointer-events", "none");
            
        // 添加文本（处理换行）
        if (shouldWrap) {
            const words = catText.split(/\s+/);
            let lineNumber = 0;
            let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0);
            
            // 根据空格数量决定换行方式
            if (words.length <= 1) {
                // 按字符换行
                const chars = catText.split('');
                let currentLine = '';
                
                for (let i = 0; i < chars.length; i++) {
                    const testLine = currentLine + chars[i];
                    const lineY = finalY + lineNumber * lineHeight;
                    const distFromTop = triangleHeight * 2/3 + lineY;
                    const availableWidth = getTriangleWidthAtHeight(side, triangleHeight, distFromTop) * 0.9;
                    
                    if (measureFn(testLine, fontFamily, fontSize, fontWeight) <= availableWidth || currentLine === '') {
                        currentLine += chars[i];
                    } else {
                        tspan.text(currentLine);
                        lineNumber++;
                        currentLine = chars[i];
                        tspan = catLabel.append("tspan")
                            .attr("x", 0)
                            .attr("dy", `${1 + catLineHeight}em`);
                    }
                }
                if (currentLine) tspan.text(currentLine);
            } else {
                // 按单词换行
                let line = [];
                for (const word of words) {
                    const testLine = [...line, word].join(' ');
                    const lineY = finalY + lineNumber * lineHeight;
                    const distFromTop = triangleHeight * 2/3 + lineY;
                    const availableWidth = getTriangleWidthAtHeight(side, triangleHeight, distFromTop) * 0.9;
                    
                    if (measureFn(testLine, fontFamily, fontSize, fontWeight) <= availableWidth || line.length === 0) {
                        line.push(word);
                        tspan.text(line.join(' '));
                    } else {
                        lineNumber++;
                        line = [word];
                        tspan = catLabel.append("tspan")
                            .attr("x", 0)
                            .attr("dy", `${1 + catLineHeight}em`)
                            .text(word);
                    }
                }
            }
        } else {
            catLabel.text(catText);
        }
    }

    return svg.node(); // 返回 SVG DOM 节点
}
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Triangle)",
    "chart_name": "proportional_area_chart_triangle_04",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[8, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
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
    const labelHeight = 50; // 估计标签高度，包括文本和间距
    
    // 调整三角形间距，为标签预留足够空间
    const horizontalPadding = 30; // 水平间距 (之前是10)
    const verticalPadding = 60; // 垂直间距，考虑标签高度
    
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
        const hasIcon = d.icon != null; // 是否有图标
        
        // 选择文本颜色
        const textFillColor = getTextColorForBackground(d.color);
        
        // 绘制三角形
        gNode.append("path")
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
        gNode.append("path")
            .attr("d", d3.line()([
                [0, -triangleHeight * 2/3],          // 顶部顶点
                [-side/2, triangleHeight * 1/3],      // 左下顶点
                [side/2, triangleHeight * 1/3]        // 右下顶点
            ]))
            .attr("fill", `url(#${d.highlightId})`) // 使用高光渐变
            .attr("stroke", "none")
            .attr("pointer-events", "none"); // 确保高光不会影响交互
            
        // 在三角形中居中添加图标（如果有）
        if (hasIcon) {
            // 设置最小三角形边长阈值，小于此值不显示图标
            const minSideForIcon = 45;
            
            // 只有当三角形足够大时才显示图标
            if (side >= minSideForIcon) {
                // 计算适合的图标大小，确保不会超出三角形
                // 三角形内部的最大内切圆直径约为边长的0.5
                const maxSafeDiameter = side * 0.5;
                const iconSize = Math.max(minIconSize, Math.min(maxSafeDiameter, side * iconSizeRatio, maxIconSize));
                
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("x", -iconSize/2)
                    .attr("y", -triangleHeight/6 - iconSize/2)  // 垂直居中
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }
        
        // 所有标签都放在外部
        // 准备标签文本
        if (!catText) {
            catText = d.id || "";
        }
        
        // 初始标签字体大小 - 调整以适应三角形大小
        let labelFontSize = Math.min(14, Math.max(10, side/10));
        
        // 调整标签位置，确保足够的垂直间距
        const labelY = triangleHeight * 1/3 + 15; // 增加距离
        
        // 添加连接线
        gNode.append("line")
            .attr("x1", 0)
            .attr("y1", triangleHeight * 1/3)
            .attr("x2", 0)
            .attr("y2", labelY - 2)
            .attr("stroke", "#666")
            .attr("stroke-width", 0.8);
            
        // 测量文本宽度
        const catWidth = getTextWidthCanvas(catText, categoryFontFamily, labelFontSize, categoryFontWeight);
        const valWidth = getTextWidthCanvas(valText, valueFontFamily, labelFontSize, valueFontWeight);
        const maxWidth = Math.max(catWidth, valWidth);
        
        // 如果文本太宽，计算新的字体大小
        const maxAllowedWidth = Math.max(side * 2, 120); // 最大允许宽度，至少120px
        if (maxWidth > maxAllowedWidth) {
            // 按比例缩小字体以适应最大宽度
            const scaleFactor = maxAllowedWidth / maxWidth;
            const minAllowedFontSize = 8; // 最小允许字体大小
            labelFontSize = Math.max(minAllowedFontSize, Math.floor(labelFontSize * scaleFactor));
            
            // 重新计算调整后的宽度
            const newCatWidth = getTextWidthCanvas(catText, categoryFontFamily, labelFontSize, categoryFontWeight);
            const newValWidth = getTextWidthCanvas(valText, valueFontFamily, labelFontSize, valueFontWeight);
            const newMaxWidth = Math.max(newCatWidth, newValWidth);
            
            // 设置最终宽度
            finalWidth = newMaxWidth;
        } else {
            finalWidth = maxWidth;
        }
        
        const totalHeight = labelFontSize * 2 + 8; // 行间距
        
        // 添加标签背景
        gNode.append("rect")
            .attr("x", -finalWidth/2 - 5)
            .attr("y", labelY - 2)
            .attr("width", finalWidth + 10)
            .attr("height", totalHeight)
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("fill", "white")
            .attr("fill-opacity", 0.9)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 0.5);
            
        // 添加类别标签 - 完整显示
        gNode.append("text")
            .attr("class", "external-category-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", labelY)
            .style("font-family", categoryFontFamily)
            .style("font-weight", categoryFontWeight)
            .style("font-size", `${labelFontSize}px`)
            .style("fill", "#000")
            .text(catText);
            
        // 添加值标签 - 完整显示
        gNode.append("text")
            .attr("class", "external-value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", labelY + labelFontSize + 3) // 行间距
            .style("font-family", valueFontFamily)
            .style("font-weight", valueFontWeight)
            .style("font-size", `${labelFontSize}px`)
            .style("fill", "#000")
            .text(valText);
    });

    return svg.node(); // 返回 SVG DOM 节点
} 
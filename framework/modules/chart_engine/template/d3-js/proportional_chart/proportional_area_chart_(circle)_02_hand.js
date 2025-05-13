/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_02_hand",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 600,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
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
            icon: dataJSON.images?.field?.[d[xField]] || null,
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
        console.log(`缩小圆形总面积，缩放比例: ${areaRatio.toFixed(2)}`);
    }

    /* ============ 3. 力模拟布局 ============ */
    // 设置顶部保护区域，防止与可能的标题或图例重叠
    const TOP_PROTECTED_AREA = 30;
    
    // 创建防碰撞力模拟布局
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(W/2, H/2).strength(0.05)) // 中心引力
        .force("charge", d3.forceManyBody().strength(-10)) // 节点间斥力
        // 使用collide力允许适度重叠（minDistance = radius1 + radius2 - 10）
        .force("collide", d3.forceCollide().radius(d => d.r - 5).strength(0.9))
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
        .style("height","auto")// 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

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
        .attr("fill",d=>d.color) // 使用纯色填充
        .attr("stroke","none") // 白色描边
        .attr("stroke-width",1.0); // 描边宽度

    /* ============ 5. 文本工具函数 ============ */
    // 文本宽度测量辅助函数 (使用 canvas 提高性能)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
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
    
    // 弦长计算函数 - 根据到圆心的距离计算该位置的最大水平宽度
    function getChordLength(radius, distanceFromCenter) {
        // 根据毕达哥拉斯定理，在距离圆心d的位置，水平弦长=2*√(r²-d²)
        return 2 * Math.sqrt(Math.max(0, radius * radius - distanceFromCenter * distanceFromCenter));
    }

    /* ============ 6. 文本和图标参数 ============ */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSizeBase = parseFloat(dataJSON.typography?.annotation?.font_size || '12'); // 数值标签基础字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSizeBase = parseFloat(dataJSON.typography?.label?.font_size || '11'); // 维度标签基础字号
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    
    // 图标大小和字体大小计算参数
    const iconSizeRatio = 0.6; // 图标相对于圆半径的比例
    const minIconSize = 16; // 最小图标尺寸
    const maxIconSize = 120; // 最大图标尺寸
    const getIconSize = (r) => Math.max(minIconSize, Math.min(r * iconSizeRatio * 2, maxIconSize));
    
    // 字体大小计算基准
    const fontSizeScaleFactor = 0.35; // 字体大小与圆半径的缩放比例
    const minFontSize = 8; // 可接受的最小字体大小 
    const maxFontSize = 22; // 最大字体大小
    
    // 如果圆半径小于阈值，则只显示图标
    const minRadiusForText = 10; // 最小需要的半径来显示文本

    // 类别标签换行控制
    const minCatFontSize = 10; // 维度标签最小字号 (再小就换行)
    const catLineHeight = 0.3; // 维度标签换行行高倍数
    const needsWrapping = true; // 需要时是否允许换行

    /* ============ 7. 渲染内容 ============ */
    nodeG.each(function(d) {
        const gNode = d3.select(this);
        const r = d.r;
        
        // 对于非常小的圆，只显示图标
        if (r < minRadiusForText) {
            // 只添加图标，不添加文本
            if (d.icon) {
                // 对于小圆，图标要更小，防止溢出
                const iconSize = Math.min(r * 1.5, minIconSize * 1.2);
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", iconSize)
                    .attr("height", iconSize)
                    .attr("x", -iconSize/2)
                    .attr("y", -iconSize/2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            return;
        }
        
        // 对于足够大的圆，添加图标和文本
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        
        // 1. 确定布局比例和空间分配
        const verticalSafetyMargin = r * 0.95; // 垂直安全边界，避免内容太靠近圆边缘
        const verticalCenter = 0; // 圆的中心点Y坐标
        
        // 重新计算垂直布局，让图标尽量靠近顶部
        const topPadding = r * 0.2; // 顶部安全边距，图标到圆顶部的距离
        
        // 计算理想的图标大小，考虑圆的大小
        const idealIconSize = Math.min(r, maxIconSize); // 图标尺寸相对保守
        
        // 2. 计算垂直布局位置
        // 计算垂直布局的起点和终点，从上到下为负到正
        const verticalStart = -r + topPadding; // 从圆顶部开始，留一点边距
        const verticalEnd = r * 0.9; // 圆底部留一点边距
        
        // 计算图标的位置 - 靠近顶部
        const iconTopPosition = verticalStart; // 图标顶部位置
        // 根据弦长限制图标大小
        const iconMaxWidthAtTop = getChordLength(r, Math.abs(iconTopPosition + idealIconSize/2));
        const iconSize = Math.min(idealIconSize, iconMaxWidthAtTop); // 确保图标不超过其位置的弦长
        
        // 计算文本区域的位置，位于图标下方
        const iconBottomY = iconTopPosition + iconSize;
        const textAreaStart = iconBottomY + r * 0.05; // 文本区域起始位置，留一点间距
        const textAreaEnd = verticalEnd; // 文本区域结束位置
        const textAreaHeight = textAreaEnd - textAreaStart;
        
        // 计算文本的理想字体大小
        const idealFontSize = Math.max(
            minFontSize,
            Math.min(
                r * fontSizeScaleFactor,
                (valueFontSizeBase + categoryFontSizeBase) / 2,
                maxFontSize,
                textAreaHeight / (catText ? 3 : 1.5) // 根据有无分类文本调整大小
            )
        );
        
        // 3. 均匀分配文本空间 - 修改垂直布局逻辑使用固定间距比例
        const textSpaceTotal = textAreaEnd - textAreaStart;
        // 文本间距系数 (相对于字体大小)
        const spacingFactor = 0.3; 
        
        // 计算类别文本位置
        const categoryPosition = catText ? textAreaStart : 0;
        
        // 4. 确定最终的字体大小，确保文本不会溢出
        let fontSize = idealFontSize;
        const valTextWidth = getTextWidthCanvas(valText, valueFontFamily, fontSize, valueFontWeight);
        const catTextWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, fontSize, categoryFontWeight) : 0;
        
        // 计算最大可用宽度
        const categoryMaxWidth = catText ? 
            getChordLength(r, Math.abs(categoryPosition)) * 0.85 : 
            0; // 分类文本最大宽度，留安全边距
        
        // 5. 计算值文本位置（考虑类别文本高度和间距）
        let categoryLines = 1;
        let categoryLabelHeight = fontSize;
        let shouldWrapCategory = false;
        
        // 如果文本宽度超过可用宽度，则缩小字体
        if (valTextWidth > getChordLength(r, Math.abs(textAreaStart + textSpaceTotal * 0.7)) * 0.85 || 
            (catText && catTextWidth > categoryMaxWidth)) {
            
            const valueRatio = valTextWidth / (getChordLength(r, Math.abs(textAreaStart + textSpaceTotal * 0.7)) * 0.85);
            const catRatio = catText ? catTextWidth / categoryMaxWidth : 0;
            const maxRatio = Math.max(valueRatio, catRatio);
            
            if (maxRatio > 1) {
                fontSize = Math.max(minFontSize, fontSize / maxRatio);
            }
        }
        
        // 再次检查维度文本是否需要换行处理
        const adjustedCatTextWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, fontSize, categoryFontWeight) : 0;
        
        if (catText && adjustedCatTextWidth > categoryMaxWidth) {
            shouldWrapCategory = needsWrapping;
            if (shouldWrapCategory) {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.font = `${categoryFontWeight} ${fontSize}px ${categoryFontFamily}`;
                
                const words = catText.split(/\s+/);
                let lines = [];
                
                if (words.length <= 1) { // 按字符模拟
                    const chars = catText.split('');
                    let currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (tempCtx.measureText(testLine).width <= categoryMaxWidth || currentLine.length === 0) {
                            currentLine += chars[i];
                        } else {
                            lines.push(currentLine);
                            currentLine = chars[i];
                        }
                    }
                    lines.push(currentLine);
                } else { // 按单词模拟
                    let line = [];
                    let word;
                    while (word = words.shift()) {
                        line.push(word);
                        const testLine = line.join(" ");
                        if (tempCtx.measureText(testLine).width > categoryMaxWidth && line.length > 1) {
                            line.pop();
                            lines.push(line.join(" "));
                            line = [word];
                        }
                    }
                    lines.push(line.join(" "));
                }
                
                categoryLines = Math.max(1, lines.length);
                // 修改行高计算 - 使用更小的行高倍数
                categoryLabelHeight = categoryLines * fontSize * (1 + catLineHeight);
            }
        }
        
        // 计算值文本位置 - 使用固定间距而不是比例
        const valuePosition = catText ?
            categoryPosition + categoryLabelHeight + (fontSize * spacingFactor) : // 类别下方固定间距
            textAreaStart + textSpaceTotal * 0.5; // 如果没有类别，则居中
            
        // 获取文本颜色（根据背景颜色自适应）
        const adaptiveTextColor = '#000000'; // 固定使用黑色
        
        // 6. 绘制图标 - 靠近顶部
        if (d.icon) {
            gNode.append("image")
                .attr("xlink:href", d.icon)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("x", -iconSize/2)
                .attr("y", iconTopPosition)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        // 7. 绘制类别标签
        if (catText) {
            const catLabel = gNode.append("text")
                .attr("class", "category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", categoryPosition)
                .style("fill", adaptiveTextColor)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${fontSize}px`)
                .style("pointer-events", "none");
                
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let line = [];
                let lineNumber = 0;
                let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0);
                
                if (words.length <= 1) { // 按字符换行
                    const chars = catText.split('');
                    let currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (getTextWidthCanvas(testLine, categoryFontFamily, fontSize, categoryFontWeight) <= categoryMaxWidth || currentLine.length === 0) {
                            currentLine += chars[i];
                        } else {
                            tspan.text(currentLine);
                            lineNumber++;
                            currentLine = chars[i];
                            tspan = catLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`) // 修改行高
                                .text(currentLine);
                        }
                    }
                    tspan.text(currentLine);
                } else { // 按单词换行
                    let word;
                    while (word = words.shift()) {
                        line.push(word);
                        const testLine = line.join(" ");
                        if (getTextWidthCanvas(testLine, categoryFontFamily, fontSize, categoryFontWeight) > categoryMaxWidth && line.length > 1) {
                            line.pop();
                            tspan.text(line.join(" "));
                            lineNumber++;
                            line = [word];
                            tspan = catLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`) // 修改行高
                                .text(word);
                        } else {
                            tspan.text(line.join(" "));
                        }
                    }
                }
            } else {
                catLabel.text(catText);
            }
        }
        
        // 8. 绘制数值标签
        gNode.append("text")
            .attr("class", "value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", valuePosition)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", valueFontWeight)
            .style("font-family", valueFontFamily)
            .style("fill", adaptiveTextColor)
            .style("pointer-events", "none")
            .text(valText);
    });
    
    const roughness = 1;
    const bowing = 2;
    const fillStyle = "hachure";
    const randomize = false;
    const pencilFilter = false;
        
    const svgConverter = new svg2roughjs.Svg2Roughjs(containerSelector);
    svgConverter.pencilFilter = pencilFilter;
    svgConverter.randomize = randomize;
    svgConverter.svg = svg.node();
    svgConverter.roughConfig = {
        bowing,
        roughness,
        fillStyle
    };
    svgConverter.sketch();
    // Remove the first SVG element if it exists
    const firstSvg = document.querySelector(`${containerSelector} svg`);
    if (firstSvg) {
        firstSvg.remove();
    }

    return svg.node(); // 返回 SVG DOM 节点
}
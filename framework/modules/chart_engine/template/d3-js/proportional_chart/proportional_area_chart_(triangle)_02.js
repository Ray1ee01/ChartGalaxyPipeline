/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Triangle)",
    "chart_name": "proportional_area_chart_(triangle)_02",
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
    // 1) 圆占画布比例，越大越拥挤、越难排
    const fillRatio = 0.80;                 // 0.70 ~ 0.90

    // 2) 外切候选角度步长，值越小候选越密，单位 rad
    const angleStep = Math.PI / 24;         // Math.PI/8(粗) ~ Math.PI/24(细)

    // 3) 不同圆外切时额外加的空隙，越小越紧密
    const distPadding = 0.3;                // 0.3 ~ 0.8

    // 4) 最大允许重叠比例（占各自面积）
    const overlapMax = 0.12;               

    // 5) 排列失败后最多丢多少个最小圆重试
    const maxDropTries = 2;                 // 0 表示绝不丢圆

    // 6) 第一个圆放置位置，可多选：topleft / center
    const firstPositions = ["topleft", "center"];

    // 7) 候选排序方式：topleft / center / random
    const candidateSort = "topleft";
    const fullW = dataJSON.variables?.width  || 600;
    const fullH = dataJSON.variables?.height || 600;
    const margin = { top: 90, right: 20, bottom: 60, left: 20 }; // 边距
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 8) 半径限制
    const minRadius = 5; // 最小圆半径
    const maxRadius = H / 3; // 最大圆半径（不超过绘图区域高度的三分之一）

    const totalArea   = W * H * fillRatio; // 圆允许占用的总面积
    const totalValue  = d3.sum(raw,d=>+d[yField]); // Y字段总和
    const areaPerUnit = totalArea / totalValue; // 每单位Y值对应的面积

    // 数据处理：计算每个节点的面积、半径、颜色等
    const nodes = raw.map((d,i)=>({
        id   : d[xField]!=null?String(d[xField]):`__${i}__`, // 节点ID (X字段)，若为空则生成临时ID
        val  : +d[yField], // 节点值 (Y字段)
        area : +d[yField]*areaPerUnit, // 节点面积
        color: dataJSON.colors?.field?.[d[xField]] || d3.schemeTableau10[i%10], // 节点颜色
        icon : dataJSON.images?.field?.[d[xField]] || null, // 图标URL (从JSON中获取)
        raw  : d // 原始数据
    })).sort((a,b)=>b.area-a.area); // 按面积降序排序，方便布局

    // 计算每个节点的半径并应用限制
    nodes.forEach(n=>{ 
        // 从面积计算理论半径
        let calculatedRadius = Math.sqrt(n.area/Math.PI);
        // 应用半径限制（保证在[minRadius, maxRadius]范围内）
        n.r = Math.max(minRadius, Math.min(calculatedRadius, maxRadius));
        // 更新面积以匹配新半径（保持一致性）
        n.area = Math.PI * n.r * n.r;
    });

    /* ============ 3. 数学工具函数 ============ */
    // 计算两圆相交面积 (用于重叠检查)
    function interArea(a,b){
        const dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy); // 圆心距
        if(d>=a.r+b.r) return 0; // 外离或外切
        if(d<=Math.abs(a.r-b.r)) return Math.PI*Math.min(a.r,b.r)**2; // 内含或内切
        // 相交情况
        const α=Math.acos((a.r*a.r+d*d-b.r*b.r)/(2*a.r*d)); // 圆a扇形角
        const β=Math.acos((b.r*b.r+d*d-a.r*a.r)/(2*b.r*d)); // 圆b扇形角
        return a.r*a.r*α + b.r*b.r*β - d*a.r*Math.sin(α); // 两扇形面积 - 三角形面积 * 2
    }
    // 检查两圆是否可接受重叠
    const okPair=(a,b)=> {
        const ia=interArea(a,b);
        // 重叠面积占各自面积的比例不超过阈值
        return ia/a.area<=overlapMax && ia/b.area<=overlapMax;
    };
    // 检查新圆与所有已放置圆是否可接受重叠
    const okAll=(n,placed)=>placed.every(p=>okPair(n,p));

    /* ============ 4. 生成候选位置 ============ */
    function genCandidates(node, placed){
        const list=[]; // 候选位置列表
        // ---- 首个圆 ----
        if(!placed.length){
            if(firstPositions.includes("topleft"))
                list.push({x:node.r, y:node.r}); // 左上角
            if(firstPositions.includes("center"))
                list.push({x:W/2, y:H/2}); // 中心
            return list;
        }
        // ---- 与已放置圆外切 ----
        placed.forEach(p=>{
            const dist = p.r + node.r + distPadding; // 外切圆心距 + 额外间距
            for(let θ=0; θ<2*Math.PI; θ+=angleStep){ // 遍历外切角度
                const x=p.x+dist*Math.cos(θ), y=p.y+dist*Math.sin(θ);
                // 检查是否超出边界
                if(x-node.r<0||x+node.r>W||y-node.r<0||y+node.r>H) continue;
                list.push({x,y});
            }
        });

        // ---- 去重 ---- (通过Map，键为保留两位小数的坐标字符串)
        const uniq=new Map();
        list.forEach(p=>uniq.set(p.x.toFixed(2)+","+p.y.toFixed(2),p));
        const arr=[...uniq.values()];

        // ---- 排序 ---- (影响放置顺序)
        if(candidateSort==="center"){ // 优先靠近中心
            arr.sort((a,b)=> (a.y-H/2)**2+(a.x-W/2)**2 - (b.y-H/2)**2-(b.x-W/2)**2 );
        }else if(candidateSort==="random"){ // 随机
            d3.shuffle(arr);
        }else{ // 默认左上优先 (topleft)
            arr.sort((a,b)=>a.y-b.y || a.x-b.x);
        }
        return arr;
    }

    /* ============ 5. DFS + 回溯布局 ============ */
    // 深度优先搜索尝试放置所有节点
    function dfs(idx, placed){
        if(idx===nodes.length) return true;           // 递归基：全部放置成功
        const node = nodes[idx]; // 当前要放置的节点
        // 遍历当前节点的所有候选位置
        for(const c of genCandidates(node,placed)){
            node.x=c.x; node.y=c.y; // 尝试放置
            if(okAll(node,placed)){ // 检查是否与已放置节点重叠过多
                placed.push(node); // 放置成功，加入已放置列表
                if(dfs(idx+1,placed)) return true; // 递归放置下一个节点
                placed.pop();                         // 回溯：取出当前节点，尝试下一个候选位置
            }
        }
        return false;                                 // 该层全部候选位置失败
    }

    let placed=[]; // 已成功放置的节点
    let success=dfs(0,placed); // 启动DFS

    /* ============ 6. 若失败则删除最小圆重试 ============ */
    let drop=0; // 已丢弃的节点数
    // 如果布局失败，且允许丢弃节点，且还有节点可丢
    while(!success && drop<maxDropTries && nodes.length){
        nodes.pop(); drop++; // 丢弃面积最小的节点（因为已排序）
        placed=[]; success=dfs(0,placed); // 重新尝试布局
    }
    if(!success) placed=[]; // 最终仍失败则返回空结果

    /* ============ 7. 绘图 ============ */
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

    // 创建主绘图区域 <g> 元素，应用边距
    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);

    // 数据处理 - 添加绘图顺序索引（面积小的在上层，大的在底层）
    placed.forEach((d, i) => {
        d.zIndex = placed.length - i; // 由于数据已按面积降序排序，所以索引大的（面积小的）会有更高的zIndex
    });

    // 创建节点分组 <g> 元素（按zIndex排序）
    const nodeG=g.selectAll("g.node")
        .data(placed,d=>d.id) // 绑定已放置节点数据，使用 id 作为 key
        .join("g")
        .attr("class","node")
        .attr("transform",d=>`translate(${d.x},${d.y})`) // 定位到计算好的位置
        .sort((a, b) => a.zIndex - b.zIndex); // 确保面积小的在上层绘制

    // 绘制正三角形（替代圆形）
    nodeG.each(function(d) {
        const side = 2 * d.r; // 三角形边长 = 圆直径
        const height = side * Math.sqrt(3) / 2; // 三角形高度
        
        // 计算三角形的三个顶点坐标
        // 正三角形，中心在原点(0,0)
        const points = [
            [0, -height * 2/3],           // 顶部顶点
            [-side/2, height * 1/3],      // 左下顶点
            [side/2, height * 1/3]        // 右下顶点
        ];
        
        // 创建三角形路径
        d3.select(this).append("path")
            .attr("d", d3.line()(points)) // 使用d3.line()生成路径
            .attr("fill", d.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.0);
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
    const iconSizeRatio = 0.4; // 图标相对于三角形边长的比例
    const minIconSize = 5; // 最小图标尺寸
    const maxIconSize = 80; // 最大图标尺寸
    
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

    // --- 新的文本和图标渲染逻辑 ---
    const minAcceptableFontSize = 8; // 可接受的最小字体大小
    const minSideForCategoryLabel = 20; // 显示维度标签的最小边长阈值
    const fontSizeScaleFactor = 0.25; // 字体大小与三角形边长的缩放比例 (比之前的比例小，因为三角形可用空间较小)
    const maxFontSize = 20; // 最大字体大小

    nodeG.each(function(d) {
        const gNode = d3.select(this);
        const side = 2 * d.r; // 三角形边长 = 圆直径
        const triangleHeight = side * Math.sqrt(3) / 2; // 三角形高度
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        
        // 根据三角形的背景色选择合适的文本颜色
        const backgroundColor = d.color;
        const adaptiveTextColor = getTextColorForBackground(backgroundColor);

        // 当边长小于20px时，只显示图标
        if (side < 20) {
            if (d.icon) {
                // 对于小三角形，计算可用宽度
                const smallIconSize = Math.min(side * 0.7, minIconSize * 1.2);
                
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", smallIconSize)
                    .attr("height", smallIconSize)
                    .attr("x", -smallIconSize/2)
                    .attr("y", -smallIconSize/2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            return; // 提前返回，不显示文本
        }
        
        // --- 布局计算 ---
        // 1. 决定垂直空间划分 - 考虑有无图标
        const hasIcon = d.icon != null;
        
        // 基于边长动态调整图标比例
        const dynamicIconSizeRatio = side < 50 ? 0.3 : 0.4;
        
        // 2. 计算图标大小 (如果有)
        let iconSize = 0;
        if (hasIcon) {
            // 图标理想大小 = 边长 * 比例系数，但不超过最大值，不小于最小值
            iconSize = Math.max(minIconSize, Math.min(side * dynamicIconSizeRatio, maxIconSize));
        }
        
        // 3. 分配垂直空间 - 从上到下
        const padding = triangleHeight * 0.05; // 顶部边距
        
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
        
        // 文本换行和适应性调整
        let valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
        let categoryWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight) : 0;
        
        // 检查在各自位置的可用宽度
        const categoryYDistanceFromTop = triangleHeight * 2/3 + categoryY; // 从三角形顶点到类别标签的距离
        let availableWidthForCategory = getTriangleWidthAtHeight(side, triangleHeight, categoryYDistanceFromTop) * 0.9; // 留出10%安全边距
        
        // 计算值标签位置 (先假设类别标签是单行)
        const valueY = categoryY + (catText ? categoryLabelHeight + padding : 0);
        const valueYDistanceFromTop = triangleHeight * 2/3 + valueY;
        let availableWidthForValue = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.9;
        
        // 初始检查是否需要调整大小或换行
        let valueFits = valueWidth <= availableWidthForValue;
        let categoryFits = !catText || categoryWidth <= availableWidthForCategory;
        
        // 图标在其位置的可用宽度
        const iconYDistanceFromTop = triangleHeight * 2/3 + iconY + iconSize/2; // 图标中心到顶点的距离
        const availableWidthForIcon = hasIcon ? getTriangleWidthAtHeight(side, triangleHeight, iconYDistanceFromTop) * 0.9 : 0;
        
        // 检查是否需要调整图标大小
        const iconFits = !hasIcon || iconSize <= availableWidthForIcon;
        
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
        const showCategory = categoryFits && finalFontSize >= minAcceptableFontSize && side >= minSideForCategoryLabel;
        const showIcon = hasIcon && iconFits && iconSize >= minIconSize;
        
        // 重新计算最终位置，使其尽可能居中
        // 计算所有元素的总高度
        let totalContentHeight = 0;
        if (showIcon) totalContentHeight += finalIconSize + padding;
        if (showCategory) totalContentHeight += categoryLabelHeight + padding;
        if (showValue) totalContentHeight += finalFontSize;
        
        // 根据三角形高度位置垂直居中
        const availableHeight = triangleHeight * 0.8; // 只使用三角形高度的80%
        const contentTopY = -availableHeight / 2 + (availableHeight - totalContentHeight) / 2;
        
        // 最终位置计算
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
        
        if (showValue) {
            finalValueY = currentY;
        }
        
        // --- 渲染各元素 ---
        
        // 1. 渲染图标 (如果需要)
        if (showIcon) {
            // 计算图标在其位置的可用宽度
            const iconYCenter = finalIconY + finalIconSize / 2;
            const iconYDistanceFromTop = triangleHeight * 2/3 + iconYCenter;
            const iconAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, iconYDistanceFromTop) * 0.9;
            
            // 确保图标不超出可用宽度
            const adjustedIconSize = Math.min(finalIconSize, iconAvailableWidth);
            
            
                
            // 添加图标
            gNode.append("image")
                .attr("xlink:href", d.icon)
                .attr("width", adjustedIconSize)
                .attr("height", adjustedIconSize)
                .attr("x", -adjustedIconSize / 2)
                .attr("y", finalIconY)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        // 2. 渲染维度标签 (可能需要换行)
        if (showCategory) {
            // 创建临时文本来计算整体尺寸
            const tempCatLabel = gNode.append("text")
                .attr("class", "temp-category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("visibility", "hidden");
                
            // 如果需要换行，添加所有tspan以便计算尺寸
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let lineNumber = 0;
                let tspan = tempCatLabel.append("tspan").attr("x", 0).attr("dy", 0);
                
                // 决定按字符还是按单词换行
                if (words.length <= 1) {
                    // 按字符换行
                    const chars = catText.split('');
                    let currentLine = '';
                    
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        const lineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const lineYDistanceFromTop = triangleHeight * 2/3 + lineY;
                        const lineAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, lineYDistanceFromTop) * 0.9;
                        
                        if (getTextWidthCanvas(testLine, categoryFontFamily, finalFontSize, categoryFontWeight) <= lineAvailableWidth || currentLine === '') {
                            currentLine += chars[i];
                        } else {
                            tspan.text(currentLine);
                            lineNumber++;
                            currentLine = chars[i];
                            tspan = tempCatLabel.append("tspan")
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
                        const lineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const lineYDistanceFromTop = triangleHeight * 2/3 + lineY;
                        const lineAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, lineYDistanceFromTop) * 0.9;
                        
                        if (getTextWidthCanvas(testLine, categoryFontFamily, finalFontSize, categoryFontWeight) <= lineAvailableWidth || line.length === 0) {
                            line.push(word);
                            tspan.text(line.join(' '));
                        } else {
                            lineNumber++;
                            line = [word];
                            tspan = tempCatLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`)
                                .text(word);
                        }
                    }
                }
            } else {
                tempCatLabel.text(catText);
            }
            
            // 获取文本边界
            let catBBox;
            try {
                catBBox = tempCatLabel.node().getBBox();
            } catch(e) {
                // 如果getBBox失败，使用估算值
                catBBox = {
                    width: categoryWidth,
                    height: categoryLabelHeight,
                    x: -categoryWidth / 2,
                    y: finalCategoryY
                };
            }
            
            
            
            // 移除临时文本
            tempCatLabel.remove();
            
            // 创建实际文本标签
            const catLabel = gNode.append("text")
                .attr("class", "category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("fill", adaptiveTextColor)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("pointer-events", "none");
                
            // 添加实际文本内容（应用换行）
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let lineNumber = 0;
                let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0);
                
                // 决定按字符还是按单词换行
                if (words.length <= 1) {
                    // 按字符换行
                    const chars = catText.split('');
                    let currentLine = '';
                    
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        const lineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const lineYDistanceFromTop = triangleHeight * 2/3 + lineY;
                        const lineAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, lineYDistanceFromTop) * 0.9;
                        
                        if (getTextWidthCanvas(testLine, categoryFontFamily, finalFontSize, categoryFontWeight) <= lineAvailableWidth || currentLine === '') {
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
                        const lineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const lineYDistanceFromTop = triangleHeight * 2/3 + lineY;
                        const lineAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, lineYDistanceFromTop) * 0.9;
                        
                        if (getTextWidthCanvas(testLine, categoryFontFamily, finalFontSize, categoryFontWeight) <= lineAvailableWidth || line.length === 0) {
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
        
        // 3. 渲染数值标签
        if (showValue) {
            // 计算数值在最终位置的可用宽度
            const valueYDistanceFromTop = triangleHeight * 2/3 + finalValueY;
            const valueAvailableWidth = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.9;
            
            // 创建临时文本来测量尺寸
            const tempValueText = gNode.append("text")
                .attr("class", "temp-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("visibility", "hidden")
                .text(valText);
                
            // 获取文本边界框
            let valueBBox;
            try {
                valueBBox = tempValueText.node().getBBox();
            } catch(e) {
                valueBBox = { 
                    width: valueWidth, 
                    height: finalFontSize, 
                    x: -valueWidth/2, 
                    y: finalValueY 
                };
            }
            tempValueText.remove(); // 移除临时文本
           
                
            // 渲染实际文本（在背景上方）
            gNode.append("text")
                .attr("class", "value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // 使用hanging基线
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valText);
        }
    });

    return svg.node(); // 返回 SVG DOM 节点
}
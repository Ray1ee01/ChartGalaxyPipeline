/*
REQUIREMENTS_BEGIN
{
    "chart_type": "bubble_chart",
    "chart_name": "bubble_square_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 30], [0, "inf"]],
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
        icon : dataJSON.images?.field?.[d[xField]] || null, // 节点图标 (从JSON中获取)
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
        .style("height","auto")// 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建主绘图区域 <g> 元素，应用边距
    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);
        
    // 添加绘图顺序索引（面积小的在上层，大的在底层）
    placed.forEach((d, i) => {
        d.zIndex = placed.length - i; // 由于数据已按面积降序排序，所以索引大的（面积小的）会有更高的zIndex
    });

    // 创建节点分组 <g> 元素，按zIndex排序确保小方块在上层
    const nodeG=g.selectAll("g.node")
        .data(placed,d=>d.id) // 绑定已放置节点数据，使用 id 作为 key
        .join("g")
        .attr("class","node")
        .attr("transform",d=>`translate(${d.x},${d.y})`) // 定位到计算好的位置
        .sort((a, b) => a.zIndex - b.zIndex); // 确保面积小的在上层绘制

    // 绘制正方形（替代圆形）
    nodeG.append("rect")
        .attr("x", d => -d.r) // x位置（居中）
        .attr("y", d => -d.r) // y位置（居中）
        .attr("width", d => 2*d.r) // 宽度=直径
        .attr("height", d => 2*d.r) // 高度=直径
        .attr("fill", d => d.color) // 填充色
        .attr("stroke", "#fff") // 白色描边
        .attr("stroke-width", 1.0); // 描边宽度

    /* ---- 文本和图标设置 ---- */
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

    // 图标大小和字体大小计算函数
    const iconSizeRatio = 0.6; // 图标相对于方形边长的比例
    const minIconSize = 16; // 最小图标尺寸
    const maxIconSize = 120; // 最大图标尺寸
    const getIconSize = (side) => Math.max(minIconSize, Math.min(side * iconSizeRatio, maxIconSize));
    
    // 字体大小计算基准
    const fontSizeScaleFactor = 0.35; // 字体大小与方形边长的缩放比例
    const minFontSize = 8; // 可接受的最小字体大小 
    const maxFontSize = 22; // 最大字体大小
    
    // 如果方形边长小于阈值，则只显示图标
    const minSideForText = 20; // 最小需要的边长来显示文本

    // ---- 类别标签换行控制 ----
    const minCatFontSize = 10; // 维度标签最小字号 (再小就换行)
    const catLineHeight = 0.3; // 维度标签换行行高倍数
    const needsWrapping = true; // 需要时是否允许换行
    
    // --- 渲染内容 ---
    nodeG.each(function(d) {
        const gNode = d3.select(this);
        const r = d.r;
        const side = 2 * r; // 正方形边长 = 圆直径
        
        // 对于非常小的正方形，只显示图标
        if (side < minSideForText) {
            // 只添加图标，不添加文本
            if (d.icon) {
                // 对于小正方形，图标要更小，防止溢出
                const iconSize = Math.min(side * 0.8, minIconSize * 1.2);
                
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
        
        // 计算安全区域 - 对于大于50px的正方形，内容限制在中心70%区域内
        const useSafeZone = side > 50;
        const safeZoneRatio = 0.7; // 安全区域占总面积的比例
        const safeZoneSide = useSafeZone ? side * safeZoneRatio : side;
        const safeZoneR = safeZoneSide / 2;
        const safeZoneOffset = (side - safeZoneSide) / 2;
        
        // 边长小于20px只显示图标（已在上面处理）
        // 边长小于50px时，图标比例降低到0.3
        const iconSizeRatioModified = side < 50 ? 0.3 : 0.5;
        
        // 对于足够大的正方形，添加图标和文本
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        
        // 1. 确定布局比例和空间分配 - 使用安全区域边长
        const verticalSafetyMargin = safeZoneSide * 0.95; // 垂直安全边界，避免内容太靠近边缘
        const verticalCenter = 0; // 中心点Y坐标
        
        // 重新计算垂直布局，让图标尽量靠近安全区域顶部
        const topPadding = safeZoneSide * 0.1; // 顶部安全边距
        
        // 计算相对于中心点的安全区域顶部位置
        const safeZoneTop = useSafeZone ? -r + safeZoneOffset : -r;
        
        // 计算理想的图标大小，考虑安全区域的大小
        const idealIconSize = Math.min(safeZoneSide * iconSizeRatioModified, maxIconSize); // 根据条件使用修改后的图标比例
        
        // 2. 计算垂直布局位置
        // 计算垂直布局的起点和终点，从上到下为负到正
        const verticalStart = safeZoneTop + topPadding / 2; // 从安全区域顶部开始，留一点边距
        const verticalEnd = safeZoneTop + safeZoneSide * 0.9; // 底部留一点边距
        
        // 计算图标的位置 - 靠近顶部
        const iconTopPosition = verticalStart; // 图标顶部位置
        const iconSize = idealIconSize; // 正方形可以使用全宽
        
        // 计算文本区域的位置，位于图标下方
        const iconBottomY = iconTopPosition + iconSize;
        const textAreaStart = iconBottomY + safeZoneSide * 0.03; // 文本区域起始位置，留一点间距
        const textAreaEnd = verticalEnd; // 文本区域结束位置
        const textAreaHeight = textAreaEnd - textAreaStart;
        
        // 当边长小于20px时，只显示图标
        if (side < 20) {
            if (d.icon) {
                const smallIconSize = Math.min(side * 0.7, minIconSize * 1.2);
                
                gNode.append("image")
                    .attr("xlink:href", d.icon)
                    .attr("width", smallIconSize)
                    .attr("height", smallIconSize)
                    .attr("x", -smallIconSize/2)
                    .attr("y", -smallIconSize/2)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
            return;
        }
        
        // 计算文本的理想字体大小
        const idealFontSize = Math.max(
            minFontSize,
            Math.min(
                safeZoneSide * fontSizeScaleFactor,
                (valueFontSizeBase + categoryFontSizeBase) / 2,
                maxFontSize,
                textAreaHeight / (catText ? 3 : 1.5) // 根据有无分类文本调整大小
            )
        );
        
        // 3. 均匀分配文本空间 - 使用固定间距比例
        const textSpaceTotal = textAreaEnd - textAreaStart;
        // 文本间距系数 (相对于字体大小)
        const spacingFactor = 0.3; 
        
        // 计算类别文本位置
        const categoryPosition = catText ? textAreaStart : 0;
        
        // 4. 确定最终的字体大小，确保文本不会溢出
        let fontSize = idealFontSize;
        const valTextWidth = getTextWidthCanvas(valText, valueFontFamily, fontSize, valueFontWeight);
        const catTextWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, fontSize, categoryFontWeight) : 0;
        
        // 计算最大可用宽度 - 使用安全区域宽度的85%
        const maxTextWidth = safeZoneSide * 0.85;
        
        // 5. 计算值文本位置（考虑类别文本高度和间距）
        let categoryLines = 1;
        let categoryLabelHeight = fontSize;
        let shouldWrapCategory = false;
        
        // 如果文本宽度超过可用宽度，则缩小字体
        if (valTextWidth > maxTextWidth || (catText && catTextWidth > maxTextWidth)) {
            const valueRatio = valTextWidth / maxTextWidth;
            const catRatio = catText ? catTextWidth / maxTextWidth : 0;
            const maxRatio = Math.max(valueRatio, catRatio);
            
            if (maxRatio > 1) {
                fontSize = Math.max(minFontSize, fontSize / maxRatio);
            }
        }
        
        // 再次检查维度文本是否需要换行处理
        const adjustedCatTextWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, fontSize, categoryFontWeight) : 0;
        
        if (catText && adjustedCatTextWidth > maxTextWidth) {
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
                        if (tempCtx.measureText(testLine).width <= maxTextWidth || currentLine.length === 0) {
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
                        if (tempCtx.measureText(testLine).width > maxTextWidth && line.length > 1) {
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
        const adaptiveTextColor = getTextColorForBackground(d.color);
        
        // 6. 绘制图标 - 靠近顶部，并添加背景确保可见性
        if (d.icon) {
            gNode.append("image")
                .attr("xlink:href", d.icon)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("x", -iconSize/2)
                .attr("y", iconTopPosition)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        // 7. 绘制类别标签 - 添加背景确保在重叠时可见
        if (catText) {
            // 首先创建临时文本来计算尺寸
            const tempCatLabel = gNode.append("text")
                .attr("class", "temp-category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", categoryPosition)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${fontSize}px`)
                .style("visibility", "hidden");
                
            // 如果需要换行，计算换行后的完整高度
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let lineCount = 0;
                
                if (words.length <= 1) { // 按字符换行模拟
                    const chars = catText.split('');
                    let currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (getTextWidthCanvas(testLine, categoryFontFamily, fontSize, categoryFontWeight) <= maxTextWidth || currentLine.length === 0) {
                            currentLine += chars[i];
                        } else {
                            tempCatLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", lineCount === 0 ? 0 : `${1 + catLineHeight}em`)
                                .text(currentLine);
                            lineCount++;
                            currentLine = chars[i];
                        }
                    }
                    if (currentLine) {
                        tempCatLabel.append("tspan")
                            .attr("x", 0)
                            .attr("dy", lineCount === 0 ? 0 : `${1 + catLineHeight}em`)
                            .text(currentLine);
                    }
                } else { // 按单词换行模拟
                    let line = [];
                    let word;
                    const wordsCopy = [...words];
                    
                    while (word = wordsCopy.shift()) {
                        line.push(word);
                        const testLine = line.join(" ");
                        if (getTextWidthCanvas(testLine, categoryFontFamily, fontSize, categoryFontWeight) > maxTextWidth && line.length > 1) {
                            line.pop();
                            tempCatLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", lineCount === 0 ? 0 : `${1 + catLineHeight}em`)
                                .text(line.join(" "));
                            lineCount++;
                            line = [word];
                        }
                    }
                    if (line.length) {
                        tempCatLabel.append("tspan")
                            .attr("x", 0)
                            .attr("dy", lineCount === 0 ? 0 : `${1 + catLineHeight}em`)
                            .text(line.join(" "));
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
                    width: adjustedCatTextWidth,
                    height: categoryLabelHeight,
                    x: -adjustedCatTextWidth / 2,
                    y: categoryPosition
                };
            }
            
            
            
            // 移除临时文本
            tempCatLabel.remove();
            
            // 创建实际文本标签
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
                        if (getTextWidthCanvas(testLine, categoryFontFamily, fontSize, categoryFontWeight) <= maxTextWidth || currentLine.length === 0) {
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
                        if (getTextWidthCanvas(testLine, categoryFontFamily, fontSize, categoryFontWeight) > maxTextWidth && line.length > 1) {
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
        
        // 8. 绘制数值标签 - 添加背景确保在重叠时可见
        // 创建临时文本来计算尺寸
        const tempValLabel = gNode.append("text")
            .attr("class", "temp-value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .attr("y", valuePosition)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", valueFontWeight)
            .style("font-family", valueFontFamily)
            .style("visibility", "hidden")
            .text(valText);
            
        // 获取文本边界
        let valBBox;
        try {
            valBBox = tempValLabel.node().getBBox();
        } catch(e) {
            // 如果getBBox失败，使用估算值
            const valTextWidth = getTextWidthCanvas(valText, valueFontFamily, fontSize, valueFontWeight);
            valBBox = {
                width: valTextWidth,
                height: fontSize * 1.2,
                x: -valTextWidth / 2,
                y: valuePosition
            };
        }
        
        
            
        // 移除临时文本
        tempValLabel.remove();
        
        // 创建实际值标签
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

    // 进一步确保小方块在上方（根据面积重新排序）
    nodeG.sort((a, b) => a.zIndex - b.zIndex); 

    return svg.node(); // 返回 SVG DOM 节点
}
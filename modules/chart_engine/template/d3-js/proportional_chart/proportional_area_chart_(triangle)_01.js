/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Triangle)",
    "chart_name": "proportional_area_chart_triangle_3d_01",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": ["3d", "animation"],
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
    
    // 检查是否启用动画效果 (默认启用)
    const enableAnimation = dataJSON.variables?.enable_animation !== false;
    
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
        .style("height","auto"); // 高度自适应

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

    // --- 新的文本渲染逻辑 ---
    const minAcceptableFontSize = 8; // 可接受的最小字体大小
    const minSideForCategoryLabel = 20; // 显示维度标签的最小边长阈值
    const fontSizeScaleFactor = 0.28; // 字体大小与三角形边长的缩放比例 (比之前的比例小，因为三角形可用空间较小)
    const maxFontSize = 24; // 最大字体大小

    nodeG.each(function(d) {
        const gNode = d3.select(this);
        const side = 2 * d.r; // 三角形边长 = 圆直径
        const triangleHeight = side * Math.sqrt(3) / 2; // 三角形高度
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        
        // 根据三角形的背景色选择合适的文本颜色
        const backgroundColor = d.color;
        const adaptiveTextColor = getTextColorForBackground(backgroundColor);

        // 为三角形调整字体大小 - 三角形比圆形或正方形可用空间小
        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * fontSizeScaleFactor, // 基于边长和缩放因子估算初始大小
                (valueFontSizeBase + categoryFontSizeBase) / 2,
                maxFontSize
            )
        );

        // --- 迭代调整字体大小和换行以适应三角形 --- 
        let valueWidth = 0;
        let categoryWidth = 0;
        let shouldWrapCategory = false;
        let categoryLines = 1;
        let categoryLineHeightPx = currentFontSize * (1 + catLineHeight); // 包含行间距的行高
        let categoryLabelHeight = currentFontSize; // 初始类别标签高度
        let valueFits = false;
        let categoryFits = false;
        let finalCategoryY = -triangleHeight / 6; // 初始类别Y位置估计（偏上）
        let finalValueY = triangleHeight / 6;    // 初始数值Y位置估计（偏下）

        // 调整字体大小直到适合或达到最小值
        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
            categoryWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight) : 0;
            categoryLineHeightPx = currentFontSize * (1 + catLineHeight);
            categoryLabelHeight = currentFontSize; // 重置高度
            categoryLines = 1;
            shouldWrapCategory = false;
            
            // 重新计算基于当前字号的Y位置估计 (简单居中，稍后精调)
            // Y坐标是相对于三角形中心的偏移量, 需要转换为距离顶部顶点的距离来计算宽度
            const categoryYDistanceFromTop = triangleHeight * 2/3 + finalCategoryY;
            const valueYDistanceFromTop = triangleHeight * 2/3 + finalValueY;
            
            // 计算当前字号下，在估计位置的可用宽度 (增加边距)
            let availableWidthForValue = getTriangleWidthAtHeight(side, triangleHeight, valueYDistanceFromTop) * 0.8;
            let availableWidthForCategory = catText ? getTriangleWidthAtHeight(side, triangleHeight, categoryYDistanceFromTop) * 0.8 : 0;
            
            valueFits = valueWidth <= availableWidthForValue;
            categoryFits = !catText || categoryWidth <= availableWidthForCategory;
            
            // 检查是否需要换行显示类别标签
            if (catText && !categoryFits && needsWrapping && currentFontSize >= minCatFontSize) {
                // 尝试模拟换行
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.font = `${categoryFontWeight} ${currentFontSize}px ${categoryFontFamily}`;
                const words = catText.split(/\s+/);
                let lines = [];
                let line = [];
                let fitsWithWrapping = true;
                let currentLineY = finalCategoryY; // 第一行Y位置

                if (words.length <= 1) { // 按字符换行
                    const chars = catText.split('');
                    let currentLineText = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLineText + chars[i];
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;
                        
                        if (tempCtx.measureText(testLine).width <= lineWidthAvailable || currentLineText.length === 0) {
                            currentLineText += chars[i];
                        } else {
                            lines.push(currentLineText);
                            currentLineY += categoryLineHeightPx; // 移动到下一行位置
                            currentLineText = chars[i];
                            // 检查下一行是否还在三角形内且高度是否允许
                            if (lines.length >= 5 || currentLineY + currentFontSize > triangleHeight / 2) { // 限制最大行数和总高度
                                fitsWithWrapping = false;
                                break;
                            }
                        }
                    }
                     if (fitsWithWrapping && currentLineText) lines.push(currentLineText);
                } else { // 按单词换行
                    const wordsCopy = [...words]; // 创建副本以安全地使用shift
                    while (wordsCopy.length > 0) {
                        const word = wordsCopy.shift();
                        line.push(word);
                        const testLine = line.join(" ");
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;

                        if (tempCtx.measureText(testLine).width > lineWidthAvailable && line.length > 1) {
                            line.pop(); // 移除最后一个单词
                            lines.push(line.join(" "));
                            currentLineY += categoryLineHeightPx; // 移动到下一行位置
                            line = [word]; // 新行以当前单词开始
                            // 检查下一行是否还在三角形内且高度是否允许
                             if (lines.length >= 5 || currentLineY + currentFontSize > triangleHeight / 2) { // 限制最大行数和总高度
                                fitsWithWrapping = false;
                                break;
                            }
                        } else if (wordsCopy.length === 0) {
                            // 最后一个单词或能容纳
                            lines.push(line.join(" "));
                        }
                    }
                 }
                 
                 if (fitsWithWrapping && lines.length > 0) {
                     categoryLines = lines.length;
                     categoryLabelHeight = categoryLines * currentFontSize + (categoryLines - 1) * (categoryLineHeightPx - currentFontSize); // 总高度 = 行数*字号 + (行数-1)*行间距
                     categoryFits = true;
                     shouldWrapCategory = true;
                 } else {
                     categoryFits = false;
                     shouldWrapCategory = false;
                 }
             }
             
             // 如果两个标签都适合（或类别标签换行后适合），则退出循环
             if (valueFits && categoryFits) {
                 break;
             }
             
             // 减小字体尺寸，继续尝试
             currentFontSize -= 1;
         }
         
         // --- 确定最终字体大小和是否显示标签 --- 
         const finalFontSize = currentFontSize; // 使用循环确定的最终字体大小
         const showValue = valueFits && finalFontSize >= minAcceptableFontSize;
         const showCategory = categoryFits && finalFontSize >= minAcceptableFontSize && side >= minSideForCategoryLabel;
         
         // --- 精确计算最终垂直位置 --- 
         const labelSpacing = finalFontSize * 0.2; // 类别和数值之间的间距
         if (showValue && showCategory) {
             // 计算总高度
             const totalHeight = categoryLabelHeight + labelSpacing + finalFontSize;
             // 将这个块在三角形垂直中心偏下一点的位置居中 (大约在高度的1/3处)
             const blockCenterY = triangleHeight * 0.1;
             
             // 调整类别标签位置，当有多行时向上移动更多
             let categoryYOffset = 0;
             if (shouldWrapCategory && categoryLines > 1) {
                 // 根据行数增加向上的偏移量，行数越多偏移越大
                 // 增加偏移系数，从0.3增加到0.8，使标签向上移动更多
                 categoryYOffset = -(categoryLines - 1) * finalFontSize * 0.8;
                 
                 // 为每个额外行添加固定偏移量
                 categoryYOffset -= finalFontSize * 0.5;
             }
             
             // 将x标签向上移动8px，data标签向下移动8px
             finalCategoryY = blockCenterY - totalHeight / 2 + categoryYOffset - 8; // 类别标签的起始Y，额外向上移动8px
             finalValueY = finalCategoryY + categoryLabelHeight + labelSpacing + 16; // 数值标签的起始Y，额外向下移动8px
         } else if (showValue) {
             // 只显示值时，将其放在三角形中心偏下一点
             finalValueY = triangleHeight * 0.1 - finalFontSize / 2 + 8; // 向下移动8px
         } else if (showCategory) {
             // 只显示类别时，将其放在三角形中心偏下一点
             finalCategoryY = triangleHeight * 0.1 - categoryLabelHeight / 2 - 8; // 向上移动8px
             
             // 当只显示类别标签且有多行时，也向上移动
             if (shouldWrapCategory && categoryLines > 1) {
                 // 增加偏移系数，从0.3增加到0.8
                 finalCategoryY -= (categoryLines - 1) * finalFontSize * 0.8;
                 // 添加额外固定偏移量
                 finalCategoryY -= finalFontSize * 0.5;
             }
         }
         
        // --- 渲染 --- 
        // 渲染数值标签 (添加背景确保在重叠时可见)
        if (showValue) {
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
                valueBBox = { width: valueWidth, height: finalFontSize, x: -valueWidth/2, y: finalValueY };
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

        // 渲染类别标签 (可能换行)，添加背景确保在重叠时可见
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
                
            // 如果需要换行，添加所有tspan以计算bbox
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let line = [];
                let lineNumber = 0;
                let tspan = tempCatLabel.append("tspan").attr("x", 0).attr("dy", 0); // 第一个tspan的dy为0
                const tempCtx = document.createElement('canvas').getContext('2d');
                tempCtx.font = `${categoryFontWeight} ${finalFontSize}px ${categoryFontFamily}`;

                if (words.length <= 1) { // 按字符换行
                    const chars = catText.split('');
                    let currentLineText = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLineText + chars[i];
                        const currentLineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;
                        
                        if (tempCtx.measureText(testLine).width <= lineWidthAvailable || currentLineText.length === 0) {
                            currentLineText += chars[i];
                        } else {
                            tspan.text(currentLineText);
                            lineNumber++;
                            currentLineText = chars[i];
                            tspan = tempCatLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`);
                        }
                    }
                    if (currentLineText) tspan.text(currentLineText);
                } else { // 按单词换行
                    const wordsCopy = [...words];
                    while (wordsCopy.length > 0) {
                        const word = wordsCopy.shift();
                        line.push(word);
                        const testLine = line.join(" ");
                        const currentLineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;
                        
                        if (tempCtx.measureText(testLine).width > lineWidthAvailable && line.length > 1) {
                            line.pop(); // 移除最后一个单词
                            tspan.text(line.join(" "));
                            lineNumber++;
                            line = [word]; // 新行从这个单词开始
                            tspan = tempCatLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`);
                        }
                        if (wordsCopy.length === 0) { // 处理最后一行
                           tspan.text(line.join(" "));
                        } else { // 更新当前行的文本（如果未换行）
                             tspan.text(line.join(" "));
                        }
                    }
                }
            } else {
                tempCatLabel.text(catText); // 不需要换行，直接设置文本
            }
            
            // 获取包含所有tspan的文本边界
            let catBBox;
            try {
                catBBox = tempCatLabel.node().getBBox();
            } catch(e) {
                catBBox = { width: categoryWidth, height: categoryLabelHeight, x: -categoryWidth/2, y: finalCategoryY };
            }
            tempCatLabel.remove(); // 移除临时文本
            
            
            // 创建实际文本标签
            const catLabel = gNode.append("text")
                .attr("class", "category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging") // 使用hanging基线
                .attr("y", finalCategoryY)
                .style("fill", adaptiveTextColor)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("pointer-events", "none");
                
            // 添加实际文本内容（应用换行）
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let line = [];
                let lineNumber = 0;
                let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0); // 第一个tspan dy为0
                const tempCtx = document.createElement('canvas').getContext('2d');
                tempCtx.font = `${categoryFontWeight} ${finalFontSize}px ${categoryFontFamily}`;
                
                if (words.length <= 1) { // 按字符换行
                    const chars = catText.split('');
                    let currentLineText = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLineText + chars[i];
                        const currentLineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;
                        
                        if (tempCtx.measureText(testLine).width <= lineWidthAvailable || currentLineText.length === 0) {
                            currentLineText += chars[i];
                        } else {
                            tspan.text(currentLineText);
                            lineNumber++;
                            currentLineText = chars[i];
                            tspan = catLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`);
                        }
                    }
                     if (currentLineText) tspan.text(currentLineText);
                } else { // 按单词换行
                     const wordsCopy = [...words];
                     while (wordsCopy.length > 0) {
                        const word = wordsCopy.shift();
                        line.push(word);
                        const testLine = line.join(" ");
                        const currentLineY = finalCategoryY + lineNumber * categoryLineHeightPx;
                        const currentLineYDistanceFromTop = triangleHeight * 2/3 + currentLineY;
                        const lineWidthAvailable = getTriangleWidthAtHeight(side, triangleHeight, currentLineYDistanceFromTop) * 0.8;
                        
                        if (tempCtx.measureText(testLine).width > lineWidthAvailable && line.length > 1) {
                            line.pop(); // 移除导致溢出的单词
                            tspan.text(line.join(" "));
                            lineNumber++;
                            line = [word]; // 新行从这个单词开始
                            tspan = catLabel.append("tspan")
                                .attr("x", 0)
                                .attr("dy", `${1 + catLineHeight}em`);
                        } 
                         if (wordsCopy.length === 0) { // 处理最后一行
                           tspan.text(line.join(" "));
                        } else { // 更新当前行的文本（如果未换行）
                             tspan.text(line.join(" "));
                        }
                    }
                }
            } else {
                catLabel.text(catText); // 不需要换行，直接设置文本
            }
        }
    });

    return svg.node(); // 返回 SVG DOM 节点
}
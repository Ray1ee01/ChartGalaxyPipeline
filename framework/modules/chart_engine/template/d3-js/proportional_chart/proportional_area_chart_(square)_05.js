/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Square)",
    "chart_name": "proportional_area_chart_square_05",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 6]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "hierarchy": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["flat", "rounded"],
    "min_height": 600,
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
    // 1) 方形占画布比例，控制总面积
    const fillRatio = 0.50;                 // 设置为50%，与圆形图表保持一致

    // 2) 外切候选角度步长，值越小候选越密，单位 rad
    const angleStep = Math.PI / 24;         // Math.PI/8(粗) ~ Math.PI/24(细)

    // 3) 不同圆外切时额外加的空隙，越小越紧密
    const distPadding = 0.6;                // 原为0.3，增加到0.6使矩形间距离更大

    // 4) 最大允许重叠比例（占各自面积）
    const overlapMax = 0.05;                // 原为0.12，减少到0.05让重叠更少

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
    const minRadius = 20; // 最小半径
    const maxSide = 200; // 最大矩形边长限制为200
    const maxRadius = Math.min(H / 3, maxSide/2); // 最大半径（取两个限制中较小的）

    // 设置顶部保护区域，防止与可能的标题或图例重叠
    const TOP_PROTECTED_AREA = 30;

    // 9) 定义小矩形的阈值 - 小于此值的矩形将标签显示在外部
    const SMALL_RECT_THRESHOLD = 30;

    // 计算yValue的范围，用于线性比例尺
    const minYValue = d3.min(raw, d => +d[yField]);
    const maxYValue = d3.max(raw, d => +d[yField]);

    // 创建线性比例尺，将yValue映射到矩形大小
    const minSideValue = minRadius * 2; // 最小边长
    const maxSideValue = maxSide; // 最大边长

    // 创建线性比例尺
    const sideScale = d3.scaleSqrt()
        .domain([0, maxYValue])
        .range([minSideValue, maxSideValue]);

    // 如果最大值和最小值相差太小，应用某种缩放使差异更明显
    const scalingFactor = (maxYValue - minYValue) < (maxYValue * 0.3) ? 0.7 : 1;

    // 计算可用面积的50%作为矩形最大总面积限制
    const maxTotalArea = W * H * fillRatio;
    const totalValue = d3.sum(raw, d => +d[yField]); // Y字段总和
    const areaPerUnit = maxTotalArea / totalValue; // 每单位Y值对应的面积

    // 获取分组信息，用于创建颜色比例尺和图例
    const groups = [...new Set(raw.map(d => d[groupField]))];

    // 创建颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((cat, i) => 
            // 优先使用colors.field中的颜色
            dataJSON.colors?.field?.[cat] || 
            // 如果没有对应颜色，使用默认调色板
            d3.schemeTableau10[i % 10]
        ));

    // 数据处理：计算每个节点的面积、边长、颜色等
    const nodes = raw.map((d,i) => ({
        id   : d[xField]!=null?String(d[xField]):`__${i}__`, // 节点ID (X字段)，若为空则生成临时ID
        val  : +d[yField], // 节点值 (Y字段)
        area : +d[yField] * areaPerUnit, // 节点面积（仍然保留，用于布局计算）
        color: colorScale(d[groupField]), // 节点颜色使用group字段
        group: d[groupField], // 保存分组信息，用于图例
        raw  : d // 原始数据
    })).sort((a,b) => b.val - a.val); // 按值降序排序，方便布局

    // 计算每个节点的边长，使用线性比例尺
    nodes.forEach(n => { 
        // 使用线性比例尺计算方形边长
        let side = sideScale(n.val) * scalingFactor;
        
        // 确保边长在范围内
        side = Math.max(minSideValue, Math.min(side, maxSideValue));
        
        // 更新节点属性
        n.width = n.height = side;
        n.area = side * side; // 更新面积以匹配新边长
        
        // 标记小矩形（用于后续标签位置处理）
        n.isSmallRect = side < SMALL_RECT_THRESHOLD;
    });

    // 检查总面积是否超过限制并按比例缩小
    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalArea) {
        const scaleFactor = Math.sqrt(maxTotalArea / initialTotalArea);
        nodes.forEach(n => {
            n.width *= scaleFactor;
            n.height *= scaleFactor;
            n.area = n.width * n.height;
        });
    }

    /* ============ 3. 力导向布局 ============ */
    // 设置更好的初始位置 - 使用网格布局避免初始重叠
    function assignInitialPositions() {
        // 计算所有节点所需的近似网格大小
        const totalArea = d3.sum(nodes, d => d.area);
        const gridSide = Math.ceil(Math.sqrt(nodes.length));
        const cellSize = Math.max(
            d3.max(nodes, d => d.width),
            Math.sqrt(W * H / (gridSide * gridSide))
        );
        
        // 创建网格
        const grid = new Array(gridSide).fill(0).map(() => new Array(gridSide).fill(false));
        const centerX = W / 2;
        const centerY = H / 2;
        const startX = centerX - (cellSize * (gridSide - 1)) / 2;
        const startY = centerY - (cellSize * (gridSide - 1)) / 2;
        
        // 按从大到小的顺序分配网格位置
        // 大矩形优先在中心位置，小矩形在周围
        let assignedCount = 0;
        
        // 计算距离网格中心的距离
        function distanceToCenter(row, col) {
            const centerRow = (gridSide - 1) / 2;
            const centerCol = (gridSide - 1) / 2;
            return Math.sqrt(Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2));
        }
        
        // 按照到中心的距离给网格单元排序
        let cells = [];
        for (let row = 0; row < gridSide; row++) {
            for (let col = 0; col < gridSide; col++) {
                cells.push({row, col, distance: distanceToCenter(row, col)});
            }
        }
        cells.sort((a, b) => a.distance - b.distance);
        
        // 从中心开始，螺旋状向外分配位置
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const cell = cells[i % cells.length];
            
            // 分配位置并添加一些随机偏移以避免完全对齐
            const jitter = cellSize * 0.1; // 添加10%的随机偏移
            node.x = startX + cell.col * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            node.y = startY + cell.row * cellSize + cellSize/2 + (Math.random() - 0.5) * jitter;
            
            // 确保在画布内
            node.x = Math.max(node.width/2, Math.min(W - node.width/2, node.x));
            node.y = Math.max(TOP_PROTECTED_AREA + node.height/2, Math.min(H - node.height/2, node.y));
        }
        
        // 特殊处理最大节点（可选）- 固定在中心
        if (nodes.length > 0) {
            // 松散固定最大节点，让它有一定移动空间
            nodes[0].x = W * 0.5 + (Math.random() - 0.5) * 10;
            nodes[0].y = H * 0.5 + (Math.random() - 0.5) * 10;
        }
    }

    // 分配初始位置
    assignInitialPositions();

    // 创建自定义碰撞检测函数 - 处理矩形之间的碰撞，考虑方形的特性
    function rectCollide() {
        let nodes = [];
        let strength = 1;
        
        // 计算两个矩形之间的碰撞和间距
        function distance(nodeA, nodeB) {
            // 计算两个矩形中心点之间的距离
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            
            // 计算两个矩形边缘之间的距离（负值表示重叠）
            // 增加额外的间距，让矩形之间有更多空间
            const extraPadding = 15; // 额外添加的间距
            const overlapX = (nodeA.width + nodeB.width) / 2 + extraPadding - Math.abs(dx);
            const overlapY = (nodeA.height + nodeB.height) / 2 + extraPadding - Math.abs(dy);
            
            // 如果没有重叠，返回正距离
            if (overlapX <= 0 || overlapY <= 0) {
                // 返回最近边缘之间的欧几里得距离
                const edgeDistX = overlapX <= 0 ? -overlapX : 0;
                const edgeDistY = overlapY <= 0 ? -overlapY : 0;
                return Math.sqrt(edgeDistX * edgeDistX + edgeDistY * edgeDistY);
            }
            
            // 如果重叠，返回负的重叠程度（更精确地描述重叠情况）
            // 重叠值越大（负值绝对值越大），斥力越强
            return -Math.sqrt(overlapX * overlapY); // 使用重叠面积的平方根增强斥力效果
        }
        
        // 主要碰撞处理函数 - 防止矩形重叠，考虑方形的正交性质
        function force(alpha) {
            const quadtree = d3.quadtree()
                .x(d => d.x)
                .y(d => d.y)
                .addAll(nodes);
                
            for (let i = 0; i < nodes.length; i++) {
                const nodeA = nodes[i];
                
                // 查找可能与当前节点碰撞的其他节点
                const padding = 15; // 增加安全间距，原为5
                const searchRadius = Math.max(nodeA.width, nodeA.height) * 1.5 + padding;
                quadtree.visit((quad, x1, y1, x2, y2) => {
                    if (!quad.length) {
                        do {
                            if (quad.data !== nodeA) {
                                const nodeB = quad.data;
                                const dist = distance(nodeA, nodeB);
                                
                                // 即使矩形没有重叠，只要它们很接近，也应用较弱斥力
                                // 这样可以在布局阶段保持一定的间距
                                const repulsionThreshold = padding * 1.2; // 增加排斥阈值，使矩形保持更大距离
                                
                                if (dist < repulsionThreshold) {
                                    const dx = nodeB.x - nodeA.x;
                                    const dy = nodeB.y - nodeA.y;
                                    const l = Math.sqrt(dx * dx + dy * dy) || 1;
                                    
                                    // 计算斥力
                                    // 如果重叠（dist < 0），则力很强
                                    // 如果接近但不重叠（0 <= dist < repulsionThreshold），则力较弱
                                    const repulsionStrength = dist < 0 ? 1.2 : 1 - (dist / repulsionThreshold); // 增强斥力强度
                                    let force = Math.min(
                                        Math.abs(dist < 0 ? dist : dist - repulsionThreshold) * strength * alpha * repulsionStrength,
                                        20 // 增加最大斥力上限，原为15
                                    );
                                    
                                    // 考虑节点大小差异，使大节点更稳定
                                    const ratio = nodeA.area / (nodeA.area + nodeB.area);
                                    
                                    // 矩形特有：方向向量应考虑矩形特性
                                    // 计算主要重叠方向（水平或垂直）
                                    const overlapX = (nodeA.width + nodeB.width) / 2 - Math.abs(dx);
                                    const overlapY = (nodeA.height + nodeB.height) / 2 - Math.abs(dy);
                                    
                                    // 根据重叠方向分配力度
                                    let forceX = force * (dx / l);
                                    let forceY = force * (dy / l);
                                    
                                    // 矩形正交性处理：对不同方向应用不同力度
                                    // 如果矩形主要在水平方向重叠，增强垂直方向的力
                                    if (overlapX > overlapY && Math.abs(dy) > 0.1) {
                                        forceY *= 2.0; // 增强正交方向斥力，原为1.8
                                    }
                                    // 如果矩形主要在垂直方向重叠，增强水平方向的力
                                    else if (overlapY > overlapX && Math.abs(dx) > 0.1) {
                                        forceX *= 2.0; // 增强正交方向斥力，原为1.8
                                    }
                                    
                                    // 应用力（根据面积比例）
                                    if (!nodeA.fx) {
                                        nodeA.x -= forceX * (1 - ratio) * 0.95;
                                        nodeA.y -= forceY * (1 - ratio) * 0.95;
                                    }
                                    
                                    if (!nodeB.fx) {
                                        nodeB.x += forceX * ratio * 0.95;
                                        nodeB.y += forceY * ratio * 0.95;
                                    }
                                }
                            }
                        } while (quad = quad.next);
                    }
                    
                    // 如果当前四叉树区域与搜索区域不重叠，停止遍历该分支
                    const nodeRadius = Math.max(nodeA.width, nodeA.height) / 2 + padding;
                    return x1 > nodeA.x + nodeRadius || 
                           x2 < nodeA.x - nodeRadius || 
                           y1 > nodeA.y + nodeRadius || 
                           y2 < nodeA.y - nodeRadius;
                });
            }
        }
        
        // 设置API
        force.initialize = function(_) {
            nodes = _;
        };
        
        force.strength = function(_) {
            strength = _ ?? strength;
            return force;
        };
        
        return force;
    }

    // 创建防碰撞力模拟布局
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(W/2, H/2).strength(0.05)) // 中心引力，调整为适中强度
        .force("charge", d3.forceManyBody().strength(-30)) // 节点间斥力，增强到-30，原为-20
        .force("collide", rectCollide().strength(1.2)) // 增强碰撞强度到1.2，原为1.0
        .force("x", d3.forceX(W / 2).strength(0.02)) // x方向引力
        .force("y", d3.forceY(H / 2).strength(0.02)) // y方向引力
        .stop();

    // 使用模拟分阶段降温冷却，以获得更好的布局
    const MIN_ITERATIONS = 400; // 增加迭代次数以获得更稳定的布局，原为350
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        // 在早期阶段应用更强的边界约束，确保矩形不会飞出边界
        const boundaryStrength = 1 - Math.min(1, i / (MIN_ITERATIONS * 0.8));
        
        simulation.tick();
        
        // 每次迭代后应用边界约束
        nodes.forEach(d => {
            if (!d.fx) { // 如果节点没有被固定
                // 添加额外的边界吸引力，随着迭代的进行逐渐减弱
                const maxBoundaryForce = 2 * boundaryStrength;
                
                // 计算到边界的距离
                const distToLeft = d.x - d.width/2;
                const distToRight = W - d.x - d.width/2;
                const distToTop = d.y - d.height/2 - TOP_PROTECTED_AREA;
                const distToBottom = H - d.y - d.height/2;
                
                // 如果接近边界，施加一个向中心的力
                if (distToLeft < 20) d.x += maxBoundaryForce * (1 - distToLeft/20);
                if (distToRight < 20) d.x -= maxBoundaryForce * (1 - distToRight/20);
                if (distToTop < 20) d.y += maxBoundaryForce * (1 - distToTop/20);
                if (distToBottom < 20) d.y -= maxBoundaryForce * (1 - distToBottom/20);
                
                // 强制约束在边界内
                d.x = Math.max(d.width/2 + 1, Math.min(W - d.width/2 - 1, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.height/2 + 1, Math.min(H - d.height/2 - 1, d.y));
            }
        });
    }

    // 数据处理 - 添加绘图顺序索引（面积小的在上层，大的在底层）
    nodes.forEach((d, i) => {
        d.zIndex = nodes.length - i; // 由于数据已按面积降序排序，所以索引大的（面积小的）会有更高的zIndex
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("max-width","100%") // 最大宽度
        .style("height","auto"); // 高度自适应

    // 创建主绘图区域 <g> 元素，应用边距
    const g=svg.append("g")
        .attr("transform",`translate(${margin.left},${margin.top})`);

    // 获取效果设置
    const effects = dataJSON.effects || {};
    const useRoundedStyle = effects.rounded === true || effects.rounded === "true";
    const useFlatStyle = effects.flat === true || effects.flat === "true";

    // 创建节点分组 <g> 元素（按zIndex排序）
    const nodeG=g.selectAll("g.node")
        .data(nodes, d => d.id) // 绑定节点数据，使用 id 作为 key
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`) // 定位到力模拟计算后的位置
        .sort((a, b) => a.zIndex - b.zIndex); // 确保面积小的在上层绘制

    // 绘制正方形
    nodeG.append("rect")
        .attr("x", d => -d.width/2) // x位置（居中）
        .attr("y", d => -d.height/2) // y位置（居中）
        .attr("width", d => d.width) // 宽度
        .attr("height", d => d.height) // 高度
        .attr("fill", d => d.color) // 使用纯色填充，移除渐变
        .attr("stroke", "#fff") // 白色描边
        .attr("stroke-width", 1.0) // 描边宽度
        .attr("rx", d => useRoundedStyle ? Math.min(15, d.width * 0.15) : Math.min(5, d.width * 0.05)) // 增大圆角，最大为15像素或宽度的15%
        .attr("ry", d => useRoundedStyle ? Math.min(15, d.height * 0.15) : Math.min(5, d.height * 0.05)); // 增大圆角，最大为15像素或高度的15%

    // 为大方块添加图标（当宽度 > 50 时）
    nodeG.each(function(d) {
        // 只为足够大的方块添加图标（width > 50）
        if (d.width > 50) {
            const gNode = d3.select(this);
            const xValue = d.id;
            // 从dataJSON.images.field[xValue]获取图标URL
            const iconUrl = dataJSON.images?.field?.[xValue];
            
            if (iconUrl) {
                // 创建图标容器 - 白色圆形背景
                const iconSize = d.width / 2; // 图标大小为方块宽度的一半
                const yOffset = -d.height / 4 + 5; // 将图标放在上方1/4处，向下移动5px
                
                // 添加白色圆形背景
                gNode.append("circle")
                    .attr("cx", 0)
                    .attr("cy", yOffset)
                    .attr("r", iconSize / 2)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.5) // 设置透明度为0.5
                    .attr("stroke", "#eee")
                    .attr("stroke-width", 1);
                
                // 添加图标图像 - 稍微缩小图标确保不超出背景圆形
                const actualIconSize = iconSize * 0.8; // 将图标缩小到圆形背景的80%
                gNode.append("image")
                    .attr("xlink:href", iconUrl)
                    .attr("x", -actualIconSize / 2)
                    .attr("y", yOffset - actualIconSize / 2)
                    .attr("width", actualIconSize)
                    .attr("height", actualIconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }
    });

    // 添加图例
    if (groups.length > 0) {
        // 图例配置参数
        const typography = dataJSON.typography || {};
        const colors = dataJSON.colors || {};
        
        const legendFontSize = parseFloat(typography.label?.font_size || 12);
        const legendFontWeight = typography.label?.font_weight || "normal";
        const legendFontFamily = typography.label?.font_family || "Arial";
        const legendColor = colors.text_color || "#333333";
        const legendSquareSize = 20; // 图例方块尺寸
        const legendItemPadding = 5; // 方块与文本间距
        const legendColumnPadding = 20; // 图例项间距
        
        // 创建图例组，标题放在左侧
        const legendGroup = svg.append("g").attr("class", "chart-legend");
        
        // 设置图例位置
        let legendStartX = margin.left;
        const legendY = 20; // 图例垂直位置在顶部
        
        // 添加图例标题
        const legendTitle = legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", legendStartX)
            .attr("y", legendY)
            .attr("dominant-baseline", "middle")
            .style("font-family", legendFontFamily)
            .style("font-size", `${legendFontSize + 1}px`)
            .style("font-weight", "bold")
            .style("fill", legendColor)
            .text(groupField + ":");
            
        // 计算标题宽度并调整后续图例项的起始位置
        const titleWidth = legendTitle.node().getComputedTextLength();
        legendStartX += titleWidth + 15; // 标题后添加一些间距
        
        // 在同一行添加图例项
        const legendItems = legendGroup.append("g")
            .attr("transform", `translate(${legendStartX}, 0)`);
            
        let currentX = 0;
        let totalLegendWidth = 0;
        
        // 预先计算所有图例项的总宽度
        groups.forEach(group => {
            // 创建临时文本元素来计算宽度
            const tempText = legendItems.append("text")
                .style("font-family", legendFontFamily)
                .style("font-size", `${legendFontSize}px`)
                .text(group);
                
            const textWidth = tempText.node().getComputedTextLength();
            tempText.remove(); // 移除临时元素
            
            totalLegendWidth += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
        });
        
        totalLegendWidth -= legendColumnPadding; // 减去最后一个多余的间距
        
        // 添加图例背景和边框 (在添加图例项之前)
        const legendPadding = 10; // 图例内边距
        const legendBgWidth = totalLegendWidth + (legendPadding * 2);
        const legendBgHeight = legendSquareSize + (legendPadding * 2);
        const legendBgX = legendStartX - legendPadding;
        const legendBgY = legendY - legendBgHeight/2;
        
        // 添加带圆角的背景矩形
        legendGroup.insert("rect", ":first-child")
            .attr("class", "legend-background")
            .attr("x", legendBgX)
            .attr("y", legendBgY)
            .attr("width", legendBgWidth)
            .attr("height", legendBgHeight)
            .attr("rx", 8) // 圆角半径
            .attr("ry", 8)
            .style("fill", "rgba(255, 255, 255, 0.8)") // 半透明白色背景
            .style("stroke", "#dddddd") // 轻微的边框
            .style("stroke-width", 1.5);
            
        // 添加图例项
        groups.forEach(group => {
            const legendItem = legendItems.append("g")
                .attr("transform", `translate(${currentX}, 0)`);
                
            // 使用方形标记，与图表中的矩形相对应
            const rectSide = legendSquareSize * 0.8; // 稍小的正方形，保持与图例的外观一致性
            const groupColor = colorScale(group);
            
            // 创建方形标记
            legendItem.append("rect")
                .attr("x", (legendSquareSize - rectSide) / 2)
                .attr("y", legendY - rectSide / 2)
                .attr("width", rectSide)
                .attr("height", rectSide)
                .attr("fill", groupColor)
                .attr("rx", useRoundedStyle ? Math.min(6, rectSide * 0.15) : Math.min(2, rectSide * 0.05))
                .attr("ry", useRoundedStyle ? Math.min(6, rectSide * 0.15) : Math.min(2, rectSide * 0.05))
                .attr("stroke", "#fff") // 白色描边
                .attr("stroke-width", 0.5); // 描边宽度
                
            // 图例文本
            const legendText = legendItem.append("text")
                .attr("x", legendSquareSize + legendItemPadding)
                .attr("y", legendY)
                .attr("dominant-baseline", "middle")
                .style("font-family", legendFontFamily)
                .style("font-size", `${legendFontSize}px`)
                .style("font-weight", legendFontWeight)
                .style("fill", legendColor)
                .text(group);
                
            // 计算这一项的宽度，为下一项定位
            const textWidth = legendText.node().getComputedTextLength();
            currentX += legendSquareSize + legendItemPadding + textWidth + legendColumnPadding;
        });
    }

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
    
    // 外部标签的字体大小
    const externalLabelSize = 12; // 外部标签固定大小
    const externalLabelPadding = 3; // 外部标签与矩形之间的间距
    const maxLabelWidth = W * 0.9; // 标签最大宽度不超过画布宽度的90%
    const canvasPadding = 10; // 距离画布边缘的最小距离

    // 文本截断辅助函数
    function truncateText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return '';
        
        // 设置字体
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        
        // 如果文本宽度小于最大宽度，直接返回
        if (ctx.measureText(text).width <= maxWidth) {
            return text;
        }
        
        // 否则截断文本并添加省略号
        let truncated = text;
        const ellipsis = '...';
        const ellipsisWidth = ctx.measureText(ellipsis).width;
        
        while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        
        return truncated + ellipsis;
    }

    // 正方形中可用宽度计算函数 - 对于正方形，直接使用边长作为最大宽度
    function getSquareWidth(side, distanceFromCenter) {
        // 检查是否超出正方形范围
        if (Math.abs(distanceFromCenter) >= side/2) {
            return 0; // 如果距离大于或等于半边长，宽度为0
        }
        // 正方形中，在任何高度都可以使用完整的宽度
        return side; // 返回正方形边长
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
    const minSideForCategoryLabel = 10; // 显示维度标签的最小边长阈值
    const fontSizeScaleFactor = 0.38; // 字体大小与正方形边长的缩放比例
    const maxFontSize = 28; // 最大字体大小

    nodeG.each(function(d) {
        const gNode = d3.select(this);
        const side = d.width; // 正方形边长
        const valText = `${d.val}${yUnit}`;
        let catText = d.id.startsWith("__") ? "" : d.id;
        const maxTextWidth = side * 0.85; // 正方形内文本允许的最大宽度 (85%边长)
        
        // 根据正方形的背景色选择合适的文本颜色
        const backgroundColor = d.color;
        const adaptiveTextColor = getTextColorForBackground(backgroundColor);
        
        // 检查是否是小矩形（标签需要显示在外部）
        if (d.isSmallRect) {
            // 为小矩形创建外部标签
            // 创建包含类别和值的组合标签
            const combinedText = catText ? `${catText}: ${valText}` : valText;
            
            // 计算标签可能的宽度
            const labelWidth = getTextWidthCanvas(combinedText, valueFontFamily, externalLabelSize, valueFontWeight);
            
            // 检查标签是否可能超出画布边界
            const nodeX = d.x;
            const nodeY = d.y;
            const labelLeft = nodeX - labelWidth/2;
            const labelRight = nodeX + labelWidth/2;
            
            let fontSize = externalLabelSize;
            let finalText = combinedText;
            let yPosition = -side/2 - externalLabelPadding;
            let textBaseline = "text-after-edge"; // 默认从底部对齐文本（上方显示）
            
            // 如果标签太宽或可能超出画布边界
            if (labelWidth > maxLabelWidth || labelLeft < canvasPadding || labelRight > W - canvasPadding) {
                // 尝试缩小字体
                fontSize = Math.max(8, externalLabelSize - 2);
                
                // 计算新字体大小下的宽度
                const reducedWidth = getTextWidthCanvas(combinedText, valueFontFamily, fontSize, valueFontWeight);
                
                // 如果缩小字体后仍然太宽，截断文本
                if (reducedWidth > maxLabelWidth || nodeX - reducedWidth/2 < canvasPadding || nodeX + reducedWidth/2 > W - canvasPadding) {
                    // 计算可用宽度
                    const availableWidth = Math.min(maxLabelWidth, W - 2 * canvasPadding);
                    finalText = truncateText(combinedText, availableWidth, valueFontFamily, fontSize, valueFontWeight);
                }
            }
            
            // 检查垂直位置 - 优先考虑下边界
            const bottomSpace = H - (nodeY + side/2); // 方块下方到画布底部的空间
            const topSpace = nodeY - side/2 - TOP_PROTECTED_AREA; // 方块上方到顶部保护区的空间
            
            // 根据可用空间决定标签位置
            if (bottomSpace < fontSize + externalLabelPadding * 2) {
                // 下方空间不足，检查上方空间
                if (topSpace >= fontSize + externalLabelPadding * 2) {
                    // 上方空间足够，放在上方
                    yPosition = -side/2 - externalLabelPadding;
                    textBaseline = "text-after-edge"; // 从底部对齐文本（上方显示）
                } else {
                    // 上下空间都不足，尝试进一步缩小字体
                    const smallerFontSize = Math.max(6, fontSize - 2);
                    
                    // 判断缩小后是否能放入
                    if (bottomSpace >= smallerFontSize + externalLabelPadding * 2) {
                        // 可以放在下方
                        fontSize = smallerFontSize;
                        yPosition = side/2 + externalLabelPadding;
                        textBaseline = "hanging"; // 从顶部对齐文本（下方显示）
                    } else if (topSpace >= smallerFontSize + externalLabelPadding * 2) {
                        // 可以放在上方
                        fontSize = smallerFontSize;
                        yPosition = -side/2 - externalLabelPadding;
                        textBaseline = "text-after-edge"; // 从底部对齐文本（上方显示）
                    } else {
                        // 实在放不下，尝试放到矩形内部
                        fontSize = Math.min(smallerFontSize, side * 0.4);
                        yPosition = 0; // 放在矩形中央
                        textBaseline = "middle"; // 垂直居中
                    }
                }
            } else {
                // 下方空间足够，放在下方（优先使用下方空间）
                yPosition = side/2 + externalLabelPadding;
                textBaseline = "hanging"; // 从顶部对齐文本（下方显示）
            }
            
            // 添加标签
            gNode.append("text")
                .attr("class", "external-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", textBaseline)
                .attr("y", yPosition)
                .style("font-size", `${fontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("fill", textBaseline === "middle" ? adaptiveTextColor : "#333") // 使用自适应文本颜色
                .text(finalText);
                
            // 不显示内部标签
            return;
        }

        // 对于非小矩形，显示内部标签，保持原有逻辑
        // 1. 计算初始字体大小候选值
        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                side * fontSizeScaleFactor,
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

        // 检查是否足够大的方块（width > 50）需要调整文本位置
        const isLargeSquare = d.width > 50;
        
        // 估算文本放置的垂直位置（根据方块大小调整位置）
        let estimatedCategoryY, estimatedValueY;
        
        if (isLargeSquare) {
            // 对于大方块，将文本往下移动
            estimatedCategoryY = catText ? d.height / 4 : 0;  // 将类别标签放在下方1/4处
            estimatedValueY = catText ? d.height / 4 + currentFontSize * 1.2 : d.height / 4; // 值标签在类别标签下方
        } else {
            // 对于小方块，保持原来的居中布局
            estimatedCategoryY = catText ? -currentFontSize * 0.55 : 0;
            estimatedValueY = catText ? currentFontSize * 0.55 : 0;
        }

        // 循环减小字体，直到两个标签都能放下，或达到最小字号
        while (currentFontSize > minAcceptableFontSize) {
            valueWidth = getTextWidthCanvas(valText, valueFontFamily, currentFontSize, valueFontWeight);
            categoryWidth = catText ? getTextWidthCanvas(catText, categoryFontFamily, currentFontSize, categoryFontWeight) : 0;

            // 对于正方形，最大可用宽度就是边长的一定比例
            const categoryMaxWidth = maxTextWidth; 
            const valueMaxWidth = maxTextWidth;

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
                             if ((lines.length + 1) * currentFontSize * (1 + catLineHeight) > side * 0.85) { // 检查总高度不超过边长的85%
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
                             if ((lines.length + 1) * currentFontSize * (1 + catLineHeight) > side * 0.85) {
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
        const showValue = valueWidth <= maxTextWidth && finalFontSize >= minAcceptableFontSize;
        const showCategory = catText && finalFontSize >= minAcceptableFontSize && (categoryWidth <= maxTextWidth || shouldWrapCategory) && side >= minSideForCategoryLabel;

        // 4. 渲染标签 - 动态调整垂直位置
        let finalValueY = 0;
        let finalCategoryY = 0;
        
        if (isLargeSquare) {
            // 大方块文本位置调整 - 将文本放在下方，但略微往上提高位置
            if (showValue && showCategory) {
                // 当同时显示值和类别标签时
                finalCategoryY = d.height / 5 - 5; // 从1/5调整，再向上移动5px
                finalValueY = finalCategoryY + categoryLabelHeight + finalFontSize * catLineHeight; // 数值在类别下方
            } else if (showValue) {
                // 只显示值时
                finalValueY = d.height / 5 - 5; // 从1/5调整，再向上移动5px
            } else if (showCategory) {
                // 只显示类别时
                finalCategoryY = d.height / 5 - 5; // 从1/5调整，再向上移动5px
            }
        } else {
            // 小方块保持原来的居中布局
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
        }

        // 渲染数值标签（添加背景确保在重叠时可见）
        if (showValue) {
            // 先添加一个背景矩形
            const valueText = gNode.append("text")
                .attr("class", "value-label-measure")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", valueFontWeight)
                .style("font-family", valueFontFamily)
                .style("visibility", "hidden")
                .text(valText);
                
            // 获取文本尺寸
            let valueBBox;
            try {
                valueBBox = valueText.node().getBBox();
            } catch(e) {
                // 如果getBBox失败，使用估算值
                valueBBox = {
                    width: valueWidth,
                    height: finalFontSize * 1.2,
                    x: -valueWidth / 2,
                    y: finalValueY
                };
            }
            
            valueText.style("visibility", "visible"); // 显示文本
            
            // 实际文本（在背景上方）
            gNode.append("text")
                .attr("class", "value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
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
            // 首先创建临时文本来计算尺寸
            const tempCatLabel = gNode.append("text")
                .attr("class", "temp-category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-family", categoryFontFamily)
                .style("font-weight", categoryFontWeight)
                .style("font-size", `${finalFontSize}px`)
                .style("visibility", "hidden");
                
            // 如果需要换行，计算换行后的完整高度
            if (shouldWrapCategory) {
                const words = catText.split(/\s+/);
                let lineCount = 0;
                
                if (words.length <= 1) {
                    // 按字符换行模拟
                    const chars = catText.split('');
                    let currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        if (getTextWidthCanvas(testLine, categoryFontFamily, finalFontSize, categoryFontWeight) <= maxTextWidth || currentLine.length === 0) {
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
                } else {
                    // 按单词换行模拟
                    let line = [];
                    let word;
                    const wordsCopy = [...words];
                    
                    while (word = wordsCopy.shift()) {
                        line.push(word);
                        const testLine = line.join(" ");
                        if (getTextWidthCanvas(testLine, categoryFontFamily, finalFontSize, categoryFontWeight) > maxTextWidth && line.length > 1) {
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

            if (shouldWrapCategory) {
                // 执行换行逻辑，使用 tspan
                const words = catText.split(/\s+/);
                let line = [];
                let lineNumber = 0;
                let tspan = catLabel.append("tspan").attr("x", 0).attr("dy", 0); // 第一个tspan的dy为0
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.font = `${categoryFontWeight} ${finalFontSize}px ${categoryFontFamily}`;

                if (words.length <= 1) { // 按字符换行
                    const chars = catText.split('');
                    let currentLine = '';
                    for (let i = 0; i < chars.length; i++) {
                        const testLine = currentLine + chars[i];
                        // 检查宽度是否适合
                        if (tempCtx.measureText(testLine).width <= maxTextWidth || currentLine.length === 0) {
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
                        // 检查宽度是否适合
                        if (tempCtx.measureText(testLine).width > maxTextWidth && line.length > 1) {
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
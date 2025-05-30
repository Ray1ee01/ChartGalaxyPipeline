/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Proportional Area Chart (Circle)",
    "chart_name": "proportional_area_chart_circle_07",
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
        .attr("stroke","#fff") // 白色描边
        .attr("stroke-width",1.0); // 描边宽度

    /* ============ 5. 文本工具函数 ============ */
    // 文本宽度测量辅助函数 (使用 canvas 提高性能)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidthCanvas(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    /* ============ 6. 数据标签与图标绘制 ============ */
    // 计算颜色亮度的函数 (用于确定文本颜色)
    function getColorBrightness(color) {
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
        // 检查 distanceFromCenter 是否有效
        if (Math.abs(distanceFromCenter) >= radius) {
            return 0; // 如果距离大于或等于半径，弦长为0
        }
        // 根据毕达哥拉斯定理，在距离圆心d的位置，水平弦长=2*√(r²-d²)
        return 2 * Math.sqrt(radius * radius - distanceFromCenter * distanceFromCenter);
    }

    // 图标最小/最大尺寸
    const minIconSize = 20;  // 图标最小尺寸
    const maxIconSize = 60;  // 图标最大尺寸
    const iconSizeRatio = 0.4;  // 图标尺寸相对于圆半径的比例

    // 基于圆半径计算图标大小
    const getIconSize = (r) => Math.max(minIconSize, Math.min(r * iconSizeRatio * 2, maxIconSize));

    // 数值标签配置
    const valueFontFamily = 'Arial, sans-serif';
    const valueFontSize = 14;
    const valueFontWeight = 'bold';
    
    // 遍历节点绘制图标和标签
    nodeG.each(function(d) {
        const node = d3.select(this);
        
        // 1. 计算图标尺寸
        const iconSize = getIconSize(d.r);
        
        // 2. 绘制图标 (如果存在)
        if (d.icon) {
            node.append("image")
                .attr("xlink:href", d.icon)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("x", -iconSize / 2)
                .attr("y", -iconSize / 2)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
        
        // 3. 绘制数值标签
        // 基于圆的背景色选择文本颜色
        const textColor = getTextColorForBackground(d.color);
        // 适配文本尺寸
        const textSize = Math.max(12, Math.min(d.r / 4, 32)); // 限制在12px到32px之间
        
        // 如果圆足够大，在底部添加标签
        if (d.r >= 25) {
            node.append("text")
                .attr("class", "value-label")
                .attr("text-anchor", "middle")
                .attr("y", d.r / 2 +10) // 在圆内部底部放置
                .attr("fill", textColor)
                .style("font-family", valueFontFamily)
                .style("font-size", `${textSize}px`)
                .style("font-weight", valueFontWeight)
                .text(d.val + yUnit);
        }
    });
    
    /* ============ 7. 绘制侧边图例 ============ */
    // 颜色图例配置
    const legendMargin = { top: 30, right: 20, bottom: 10, left: 20 };
    const iconPadding = 10; // 图标与文本间距
    const legendItemHeight = 30; // 每个图例项高度
    const legendFontFamily = 'Arial, sans-serif';
    const legendFontSize = 14;
    const categoryPadding = 20; // 分类名称与图标间距
    
    // 创建图例组
    const legendG = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendMargin.left}, ${legendMargin.top})`);
    
    // 计算图例位置和列数
    const legendItems = uniqueCategories;
    const maxLegendWidth = fullW - legendMargin.left - legendMargin.right;
    const legendIconSize = 20;
    
    // 计算每个图例项的宽度
    const legendItemWidths = legendItems.map(item => {
        return legendIconSize + iconPadding + getTextWidthCanvas(item, legendFontFamily, legendFontSize) + categoryPadding;
    });
    
    // 确定图例布局 (多行)
    let currentRow = 0;
    let currentRowWidth = 0;
    const legendPositions = [];
    
    legendItemWidths.forEach((width, i) => {
        if (currentRowWidth + width > maxLegendWidth) {
            currentRow++;
            currentRowWidth = width;
        } else {
            currentRowWidth += width;
        }
        
        legendPositions.push({
            row: currentRow,
            x: currentRowWidth - width
        });
    });
    
    // 绘制图例
    legendItems.forEach((item, i) => {
        const legendItem = legendG.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendPositions[i].x}, ${legendPositions[i].row * legendItemHeight})`);
        
        // 绘制图例颜色方块
        legendItem.append("rect")
            .attr("width", legendIconSize)
            .attr("height", legendIconSize)
            .attr("fill", colorScale(item));
        
        // 绘制图例文本
        legendItem.append("text")
            .attr("x", legendIconSize + iconPadding)
            .attr("y", legendIconSize / 2)
            .attr("dominant-baseline", "central")
            .attr("fill", "#333")
            .style("font-family", legendFontFamily)
            .style("font-size", `${legendFontSize}px`)
            .text(item);
            
        // 添加图标 (如果存在)
        const itemIcon = dataJSON.images?.field?.[item];
        if (itemIcon) {
            legendItem.append("image")
                .attr("xlink:href", itemIcon)
                .attr("width", legendIconSize - 2)
                .attr("height", legendIconSize - 2)
                .attr("x", 1)
                .attr("y", 1)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    return svg.node(); // 返回 SVG DOM 节点
} 
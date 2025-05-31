/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Triangle Bar Chart",
    "chart_name": "triangle_bar_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 8], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
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
    const fullH = dataJSON.variables?.height || 400;
    const margin = { top: 80, right: 20, bottom: 80, left: 20 }; // 边距调整，增加底部和顶部空间
    const W = fullW  - margin.left - margin.right; // 绘图区域宽度
    const H = fullH  - margin.top  - margin.bottom; // 绘图区域高度

    // 获取主颜色
    const primaryColor = dataJSON.colors?.other?.primary || "#C13C37"; // 默认为红色

    // 数据处理
    const maxValue = d3.max(raw, d => +d[yField]); // 获取最大值
    const minValue = d3.min(raw, d => +d[yField]); // 获取最小值
    
    // 三角形参数
    const barWidth = 100; // 每个三角形的底边宽度
    const maxHeight = H * 0.9; // 最大高度
    
    // 根据节点数量自适应确定间距，数量多允许重叠，数量少则不重叠
    let padding;
    if (raw.length <= 4) {
        // 数量少时不重叠
        padding = 20;
    } else if (raw.length <= 6) {
        // 中等数量时轻微重叠
        padding = -10;
    } else {
        // 数量多时较大重叠
        padding = -30; // 最大重叠值
    }
    
    // 确保图表宽度不超过可用空间
    const totalWidthEstimate = raw.length * (barWidth + padding) - padding;
    if (totalWidthEstimate > W) {
        // 如果宽度超出，增加重叠度，但不超过最大重叠值
        padding = Math.max(-30, (W - raw.length * barWidth) / (raw.length - 1));
    }
    
    // 高度比例尺 - 根据数值映射高度
    const heightScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, maxHeight]);
    
    // 创建节点数据
    const nodes = raw.map((d,i)=>{
        const id = d[xField]!=null?String(d[xField]):`__${i}__`; // 节点ID (X字段)，若为空则生成临时ID
        // 获取对应于x值的颜色，如果没有则使用主颜色
        const color = dataJSON.colors?.field?.[d[xField]] || primaryColor;
        
        return {
            id: id,
            val: +d[yField], // 节点值 (Y字段)
            height: heightScale(+d[yField]), // 使用比例尺计算高度
            width: barWidth, // 固定底边宽度
            color: color, // 使用x字段对应的颜色
            raw: d, // 原始数据
        };
    });

    /* ============ 3. 水平布局计算 ============ */
    // 计算总宽度
    const totalWidth = nodes.length * (barWidth + padding) - padding;
    
    // 计算起始X位置，使得图表居中
    let startX = (W - totalWidth) / 2;
    if (startX < 0) startX = 0;
    
    // 设置每个节点的位置
    nodes.forEach((node, i) => {
        node.x = startX + i * (barWidth + padding) + barWidth / 2; // 中心位置
    });

    /* ============ 4. 绘图 ============ */
    d3.select(containerSelector).html(""); // 清空容器
    
    // 创建 SVG 画布
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%") // 宽度占满容器
        .attr("height", fullH) // 高度固定
        .attr("viewBox", `0 0 ${fullW} ${fullH}`) // 设置视窗
        .attr("preserveAspectRatio", "xMidYMid meet") // 保持宽高比
        .style("max-width", "100%") // 最大宽度
        .style("height", "auto") // 高度自适应
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // 创建阴影效果滤镜
    const defs = svg.append("defs");
    const shadowFilter = defs.append("filter")
        .attr("id", "triangle-shadow")
        .attr("width", "150%")
        .attr("height", "150%");
        
    // 添加阴影效果
    shadowFilter.append("feDropShadow")
        .attr("dx", "2") // 水平偏移
        .attr("dy", "2") // 垂直偏移
        .attr("stdDeviation", "2") // 模糊度
        .attr("flood-color", "rgba(0,0,0,0.3)") // 阴影颜色
        .attr("flood-opacity", "0.4"); // 阴影不透明度

    // 创建主绘图区域 <g> 元素，应用边距
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    /* ---- 文本和样式设置 ---- */
    // 提取字体排印设置，提供默认值
    const valueFontFamily = dataJSON.typography?.annotation?.font_family || 'Arial';
    const valueFontSize = parseFloat(dataJSON.typography?.annotation?.font_size || '14'); // 数值标签字号
    const valueFontWeight = dataJSON.typography?.annotation?.font_weight || 'bold'; // 数值标签字重
    const categoryFontFamily = dataJSON.typography?.label?.font_family || 'Arial';
    const categoryFontSize = 11;
    const categoryFontWeight = dataJSON.typography?.label?.font_weight || 'normal'; // 维度标签字重
    
    // 辅助函数 - 使用canvas测量文本宽度
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    function getTextWidth(text, fontFamily, fontSize, fontWeight) {
        ctx.font = `${fontWeight || 'normal'} ${fontSize}px ${fontFamily || 'Arial'}`;
        return ctx.measureText(text).width;
    }

    // 文本分行辅助函数
    function splitTextIntoLines(text, fontFamily, fontSize, maxWidth, fontWeight) {
        if (!text) return [""];
        
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = "";
        
        // 如果单词很少，可能是中文或者其他不使用空格分隔的语言
        if (words.length <= 2 && text.length > 5) {
            // 按字符分割
            const chars = text.split('');
            currentLine = chars[0] || "";
            
            for (let i = 1; i < chars.length; i++) {
                const testLine = currentLine + chars[i];
                if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = chars[i];
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
        } else {
            // 按单词分割
            currentLine = words[0] || "";
            
            for (let i = 1; i < words.length; i++) {
                const testLine = currentLine + " " + words[i];
                if (getTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
        }
        
        return lines;
    }
    
    // 检测标签是否会重叠 - 移动到字体变量初始化之后
    const checkLabelOverlap = () => {
        // 估算每个标签的最大宽度
        const estimatedLabelWidths = nodes.map(node => {
            const catText = node.id.startsWith("__") ? "" : node.id;
            if (!catText) return 0;
            return getTextWidth(catText, categoryFontFamily, categoryFontSize, categoryFontWeight);
        });
        
        // 计算每个柱子之间的间距
        const barSpacing = barWidth + padding;
        
        // 检查是否有重叠（如果标签宽度大于柱子间距的70%，认为可能有重叠）
        const hasOverlap = estimatedLabelWidths.some((width, i) => {
            return width > barSpacing * 0.7;
        });
        
        return hasOverlap;
    };
    
    // 确定是否需要换行显示标签
    const shouldWrapLabels = checkLabelOverlap();

    // 创建轴线（基准线）
    g.append("line")
        .attr("x1", 0)
        .attr("y1", H)
        .attr("x2", W)
        .attr("y2", H)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    // 绘制每个三角形条
    nodes.forEach(node => {
        const triangleGroup = g.append("g")
            .attr("class", "triangle-bar")
            .attr("transform", `translate(${node.x}, ${H})`);
        
        // 绘制三角形 (等腰三角形，顶点在上)
        const halfWidth = node.width / 2;
        
        // 创建三角形路径 - 圆角版本
        const cornerRadius = 8; // 增大圆角半径
        const trianglePath = createRoundedTrianglePath(
            [0, -node.height],        // 顶点
            [-halfWidth, 0],          // 左下角
            [halfWidth, 0],           // 右下角
            cornerRadius
        );
        
        // 绘制三角形 - 移除边框，修改透明度为0.6
        triangleGroup.append("path")
            .attr("d", trianglePath)
            .attr("fill", node.color)
            .attr("fill-opacity", 0.6) // 修改透明度为0.6
            .attr("filter", "url(#triangle-shadow)");
            
        // 显示值标签（顶部）- 添加白色背景和与柱子相同的颜色
        const valText = `${node.val}${yUnit}`;
        const textWidth = getTextWidth(valText, valueFontFamily, valueFontSize, valueFontWeight);
        
        // 添加标签背景
        triangleGroup.append("rect")
            .attr("x", -textWidth/2 - 4) // 左边缘位置加4px内边距
            .attr("y", -node.height - 10 - valueFontSize) // 顶部上方位置
            .attr("width", textWidth + 8) // 文本宽度加8px内边距
            .attr("height", valueFontSize + 4) // 文本高度加4px内边距
            .attr("rx", 3) // 圆角半径
            .attr("ry", 3) // 圆角半径
            .attr("fill", "#fff") // 白色背景
            .attr("stroke", "none");
        
        triangleGroup.append("text")
            .attr("class", "value-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "text-after-edge")
            .attr("x", 0)
            .attr("y", -node.height - 10) // 顶部上方10px
            .style("font-family", valueFontFamily)
            .style("font-weight", valueFontWeight)
            .style("font-size", `${valueFontSize}px`)
            .style("fill", node.color) // 使用与柱子相同的颜色
            .text(valText);
        
        // 显示类别标签（底部）
        const catText = node.id.startsWith("__") ? "" : node.id;
        if (catText) {
            const catWidth = getTextWidth(catText, categoryFontFamily, categoryFontSize, categoryFontWeight);
            const maxWidth = Math.max(barWidth * 1.2, 80);
            
            // 检查是否需要分行显示标签
            if (catWidth > maxWidth || shouldWrapLabels) {
                // 分行显示标签
                // 当检测到可能重叠时，使用更窄的最大宽度限制
                const effectiveMaxWidth = shouldWrapLabels ? 
                    Math.min(maxWidth, barWidth * 0.9) : maxWidth;
                    
                const lines = splitTextIntoLines(catText, categoryFontFamily, categoryFontSize, effectiveMaxWidth, categoryFontWeight);
                const lineHeight = categoryFontSize * 1.2;
                
                lines.forEach((line, i) => {
                    triangleGroup.append("text")
                        .attr("class", "category-label-line")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "hanging")
                        .attr("x", 0)
                        .attr("y", 15 + i * lineHeight) // 底部下方15px开始，每行递增
                        .style("font-family", categoryFontFamily)
                        .style("font-weight", categoryFontWeight)
                        .style("font-size", `${categoryFontSize}px`)
                        .style("fill", "#333")
                        .text(line);
                });
            } 
            // 检查是否需要旋转标签
            else if (catWidth > maxWidth * 1.5 && nodes.length > 4) {
                // 旋转标签
                triangleGroup.append("text")
                    .attr("class", "category-label")
                    .attr("text-anchor", "end")
                    .attr("dominant-baseline", "middle")
                    .attr("x", 0)
                    .attr("y", 20) // 底部下方20px
                    .attr("transform", "rotate(45)")
                    .style("font-family", categoryFontFamily)
                    .style("font-weight", categoryFontWeight)
                    .style("font-size", `${categoryFontSize}px`)
                    .style("fill", "#333")
                    .text(catText);
            } else {
                // 正常显示标签
                triangleGroup.append("text")
                    .attr("class", "category-label")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "hanging")
                    .attr("x", 0)
                    .attr("y", 15) // 底部下方15px
                    .style("font-family", categoryFontFamily)
                    .style("font-weight", categoryFontWeight)
                    .style("font-size", `${categoryFontSize}px`)
                    .style("fill", "#333")
                    .text(catText);
            }
        }
    });
    
    // 创建圆角三角形路径的辅助函数
    function createRoundedTrianglePath(topPoint, leftPoint, rightPoint, radius) {
        // 计算每个顶点的单位向量方向
        function calculateUnitVector(p1, p2) {
            const dx = p2[0] - p1[0];
            const dy = p2[1] - p1[1];
            const length = Math.sqrt(dx * dx + dy * dy);
            return [dx / length, dy / length];
        }
        
        // 顶点间的向量
        const top_left = calculateUnitVector(topPoint, leftPoint);
        const left_right = calculateUnitVector(leftPoint, rightPoint);
        const right_top = calculateUnitVector(rightPoint, topPoint);
        
        // 计算圆角起始点
        const topLeftStart = [
            topPoint[0] + top_left[0] * radius, 
            topPoint[1] + top_left[1] * radius
        ];
        const leftRightStart = [
            leftPoint[0] + left_right[0] * radius, 
            leftPoint[1] + left_right[1] * radius
        ];
        const rightTopStart = [
            rightPoint[0] + right_top[0] * radius, 
            rightPoint[1] + right_top[1] * radius
        ];
        
        // 计算圆角结束点
        const topRightEnd = [
            topPoint[0] + right_top[0] * radius * -1, 
            topPoint[1] + right_top[1] * radius * -1
        ];
        const leftTopEnd = [
            leftPoint[0] + top_left[0] * radius * -1, 
            leftPoint[1] + top_left[1] * radius * -1
        ];
        const rightLeftEnd = [
            rightPoint[0] + left_right[0] * radius * -1, 
            rightPoint[1] + left_right[1] * radius * -1
        ];
        
        // 构建圆角三角形的路径
        return `
            M ${topLeftStart[0]},${topLeftStart[1]}
            L ${leftTopEnd[0]},${leftTopEnd[1]}
            A ${radius},${radius} 0 0 0 ${leftRightStart[0]},${leftRightStart[1]}
            L ${rightLeftEnd[0]},${rightLeftEnd[1]}
            A ${radius},${radius} 0 0 0 ${rightTopStart[0]},${rightTopStart[1]}
            L ${topRightEnd[0]},${topRightEnd[1]}
            A ${radius},${radius} 0 0 0 ${topLeftStart[0]},${topLeftStart[1]}
            Z
        `;
    }

    return svg.node(); // 返回 SVG DOM 节点
} 
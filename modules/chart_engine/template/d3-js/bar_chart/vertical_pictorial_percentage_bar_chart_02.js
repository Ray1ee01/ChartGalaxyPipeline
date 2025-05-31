/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Pictorial Percentage Bar Chart",
    "chart_name": "vertical_pictorial_percentage_bar_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 10], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 400,
    "background": "dark",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 实现花瓶形状的柱状图 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data || [];          // 图表数据
    const variables = jsonData.variables || {};     // 图表配置，如果不存在则使用空对象
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors_dark || { 
        text_color: "#000000", 
        other: { primary: "#4682B4", secondary: "#FF7F50" } 
    }; 
    const images = jsonData.images || { field: {}, other: {} };  // 图像(国旗等)
    const dataColumns = jsonData.data.columns || [];            // 使用data_columns
   
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 提取字段名称 ----------
    let xField, yField;
    
    // 安全地提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    // 添加数值格式化函数
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }
    // ---------- 3. 数据处理 ----------
    // 按照y值降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[yField] - a[yField]);
    
    // ---------- 4. 尺寸和布局设置 ----------
    const width = variables.width || 800;     
    const height = variables.height || 600;        
    
    // 边距: 上, 右, 下, 左
    const margin = { 
        top: 120,         // 减少顶部空间
        right: 30, 
        bottom: 80,      // 国旗和标签的空间
        left: 30
    };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // ---------- 5. 创建SVG容器 ----------
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
   
    
    // 创建主图表组
    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 6. 创建比例尺 ----------
    // X轴比例尺（瓶子之间的间隔）
    const xScale = d3.scaleBand()
        .domain(sortedData.map(d => d[xField]))
        .range([0, innerWidth])
        .padding(0.2);
    
    // Y轴比例尺（瓶子的高度）
    const yMax = d3.max(sortedData, d => d[yField]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.1]) // 添加10%的空间
        .range([innerHeight, 0]);
    
    // ---------- 7. 创建瓶子和蒙版 ----------
    // 定义瓶子的宽度和高度 (不修改这部分)
    const bottleWidth = xScale.bandwidth();
    const bottleHeight = Math.max(bottleWidth * 3, innerHeight * 0.5);
    
    // 获取瓶子的主要颜色
    const bottleColor = colors.other.primary || "#4CAF50";
    
    // 定义国旗和文本的空间
    const flagTextHeight = 50; 
    
    // 计算瓶子底部应在的位置 - 让瓶子底部接近国旗
    const bottleBottomY = innerHeight - 10; // 瓶子底部位置，紧贴国旗上方
    const bottleTopY = bottleBottomY - bottleHeight; // 瓶子顶部位置
    
    // 创建一个数组来存储所有的值标签元素引用
    const valueLabels = [];
    const bottleImageSVG = `<svg viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg">
  <!-- 瓶身主体 -->
  <path d="M60,280 L60,450 Q100,480 140,450 L140,280 Z" fill="#2196F3" filter="url(#glow)"/>
  
  <!-- 瓶颈过渡部分 -->
  <path d="M60,230 L60,280 L140,280 L140,230 Z" fill="#64B5F6"/>
  <circle cx="100" cy="255" r="25" fill="#64B5F6"/>
  
  <!-- 瓶口 -->
  <path d="M75,50 Q100,40 125,50 L125,70 Q100,80 75,70 Z" fill="#90CAF9"/>
  <path d="M80,70 L60,230 L140,230 L120,70 Z" fill="#90CAF9"/>
  <path d="M80,70 Q100,60 120,70 L120,70 Q100,80 80,70 Z" fill="#90CAF9"/>
  
  <!-- 添加光泽效果 -->
  <defs>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.1)"/>
      <stop offset="50%" style="stop-color:rgba(255,255,255,0.3)"/>
      <stop offset="100%" style="stop-color:rgba(255,255,255,0.1)"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  
  <!-- 添加光泽效果 -->
  <path d="M70,280 L70,440 Q100,460 130,440 L130,280 Z" fill="url(#shine)" opacity="0.5"/>
</svg>`;

    // 辅助函数：将字符串转换为 base64
    function svgToBase64(svg) {
        // 移除所有换行符和多余的空格
        const cleanSvg = svg.replace(/\s+/g, ' ').trim();
        // 使用 encodeURIComponent 处理 Unicode 字符
        const encoded = encodeURIComponent(cleanSvg);
        return 'data:image/svg+xml;base64,' + btoa(unescape(encoded));
    }

    // 将 SVG 转换为 base64
    const bottleImageBase64 = svgToBase64(bottleImageSVG);
    
    // 从SVG的viewBox中获取实际比例
    const svgViewBox = bottleImageSVG.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const svgWidth = svgViewBox[2];
    const svgHeight = svgViewBox[3];
    const svgAspectRatio = svgHeight / svgWidth;

    // 计算基础间距（在 makeChart 函数开始处添加）
    const baseBottleWidth = xScale.bandwidth();
    const baseBottleHeight = baseBottleWidth * svgAspectRatio;
    const spacingAfterBottle = baseBottleWidth * 0.1; // 瓶子和图标之间的间距
    const spacingBetweenIconLabel = baseBottleWidth * 0.15; // 图标和标签之间的间距

    // 开始添加瓶子图像和蒙版
    chart.selectAll(".bottle-group")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", "bottle-group")
        .attr("transform", d => `translate(${xScale(d[xField])}, ${bottleTopY})`)
        .each(function(d, i) {
            const group = d3.select(this);
            const bottleWidth = xScale.bandwidth();
            // 根据SVG的实际比例计算瓶子高度
            const bottleHeight = bottleWidth * svgAspectRatio;
            // 判断是否为最大值
            const isMaxValue = d[yField] === yMax;
            const bottlePercentage = isMaxValue ? 1 : Math.max(0, (d[yField] / yMax));
            
            // 定义裁剪路径
            const clipId = `clip-${i}`;
            group.append("clipPath")
                .attr("id", clipId)
                .append("rect")
                .attr("x", 0)
                .attr("y", bottleHeight * (1 - bottlePercentage))
                .attr("width", bottleWidth)
                .attr("height", bottleHeight * bottlePercentage);

            // 添加半透明的背景瓶子
            group.append("image")
                .attr("xlink:href", bottleImageBase64)
                .attr("width", bottleWidth)
                .attr("height", bottleHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .style("opacity", 0.15);

            // 添加裁剪后的前景瓶子
            group.append("image")
                .attr("xlink:href", bottleImageBase64)
                .attr("width", bottleWidth)
                .attr("height", bottleHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("clip-path", `url(#${clipId})`);
            
            // 计算标签方块的大小和位置
            const squareSize = bottleWidth * 0.6;
            const squareX = (bottleWidth - squareSize) / 2;
            const squareY = bottleHeight * (2/3) - (squareSize / 2);
            
            
            // const formattedValue = `${formatValue(d[yField])}${valueUnit}`;
            // // 我们将在下面计算实际字体大小，先使用基础大小创建文本元素
            // const baseValueFontSize = 16;
            
            // // 添加数值文本但先不设置字体大小
            // const valueText = group.append("text")
            //     .attr("class", "value-label")
            //     .attr("x", bottleWidth / 2)
            //     .attr("y", squareY + (squareSize * 0.6)) // 先设置一个位置，稍后会调整
            //     .attr("text-anchor", "middle")
            //     .style("font-family", typography.label.font_family)
            //     .style("font-weight", "bold")
            //     .style("fill", "#fff")
            //     .style("font-size", `${baseValueFontSize}px`) // 先设置基础字体大小
            //     .text(formattedValue);
                
            // // 将值标签添加到数组中，以便后续统一调整
            // valueLabels.push({
            //     element: valueText,
            //     value: formattedValue,
            //     squareSize: squareSize
            // });
        });
    
        // ---------- 8. 添加国旗和国家名称 (修改后) ----------
        const baseLabelFontSize = 14; // 基础字体大小
        // 文本换行辅助函数 (添加 alignment 参数)
        function wrapText(text, str, width, lineHeight = 1.1, alignment = 'middle') {
            const words = str.split(/\s+/).reverse(); // 按空格分割单词
            let word;
            let line = [];
            let lineNumber = 0;
            const initialY = parseFloat(text.attr("y")); // 获取原始y坐标
            const initialX = parseFloat(text.attr("x")); // 获取原始x坐标
            const actualFontSize = parseFloat(text.style("font-size")); // 获取实际应用的字体大小

            text.text(null); // 清空现有文本

            let tspans = []; // 存储最终要渲染的行

            // 优先按单词换行
            if (words.length > 1) {
                let currentLine = [];
                while (word = words.pop()) {
                    currentLine.push(word);
                    const tempTspan = text.append("tspan").text(currentLine.join(" ")); // 创建临时tspan测试宽度
                    const isOverflow = tempTspan.node().getComputedTextLength() > width;
                    tempTspan.remove(); // 移除临时tspan

                    if (isOverflow && currentLine.length > 1) {
                        currentLine.pop(); // 回退一个词
                        tspans.push(currentLine.join(" ")); // 添加完成的行
                        currentLine = [word]; // 新行以当前词开始
                        lineNumber++;
                    }
                }
                // 添加最后一行
                if (currentLine.length > 0) {
                    tspans.push(currentLine.join(" "));
                }
            } else { // 如果没有空格或只有一个词，则按字符换行
                const chars = str.split('');
                let currentLine = '';
                for (let i = 0; i < chars.length; i++) {
                    const nextLine = currentLine + chars[i];
                    const tempTspan = text.append("tspan").text(nextLine); // 测试宽度
                    const isOverflow = tempTspan.node().getComputedTextLength() > width;
                    tempTspan.remove();

                    if (isOverflow && currentLine.length > 0) { // 如果加了新字符就超长了，并且当前行不为空
                        tspans.push(currentLine); // 添加当前行
                        currentLine = chars[i]; // 新行从这个字符开始
                        lineNumber++;
                    } else {
                        currentLine = nextLine; // 没超长就继续加字符
                    }
                }
                // 添加最后一行
                if (currentLine.length > 0) {
                    tspans.push(currentLine);
                }
            }

            // 计算总行数
            const totalLines = tspans.length;
            let startDy = 0;
            
            // 根据对齐方式计算起始偏移
            if (alignment === 'middle') {
                // 垂直居中：向上移动半行*(总行数-1)
                startDy = -( (totalLines - 1) * lineHeight / 2);
            } else if (alignment === 'bottom') {
                // 底部对齐：计算总高度，向上移动 总高度 - 单行高度(近似)
                // 注意：em单位是相对于字体大小的，这里用 lineHeight * actualFontSize 近似计算像素高度
                const totalHeightEm = totalLines * lineHeight;
                startDy = -(totalHeightEm - lineHeight); // 将底部对齐到原始y
            }
            // 如果是 'top' 对齐，startDy 保持为 0，即第一行基线在原始y位置
            // 其他对齐方式（如 'top'）可以保持 startDy 为 0

            // 创建所有行的tspan元素
            tspans.forEach((lineText, i) => {
                text.append("tspan")
                    .attr("x", initialX) // x坐标与父<text>相同
                    .attr("dy", (i === 0 ? startDy : lineHeight) + "em") // 第一行应用起始偏移，后续行应用行高
                    .text(lineText);
            });
            
            // 如果是底部对齐，可能需要重新设置 y 确保精确对齐 (可选优化)
            // if (alignment === 'bottom') {
            //    const bbox = text.node().getBBox();
            //    const currentBottom = bbox.y + bbox.height;
            //    const adjustment = initialY - currentBottom;
            //    text.attr("transform", `translate(0, ${adjustment})`);
            // }
        }
        // 创建临时文本元素来测量文本宽度 (用于计算统一缩放字体)
        const tempText = svg.append("text")
            .attr("visibility", "hidden")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${baseLabelFontSize}px`);
    
        // 计算所有维度标签在基础字体大小下的宽度
        const dimensionWidths = sortedData.map(d => {
            tempText.text(d[xField]);
            return tempText.node().getComputedTextLength();
        });
    
        const maxAvailableWidth = xScale.bandwidth() * 1.2;
    
        // 计算是否需要缩小字体以及缩放比例
        const maxDimensionWidth = Math.max(...dimensionWidths);
        const labelScaleFactor = maxDimensionWidth > maxAvailableWidth ? maxAvailableWidth / maxDimensionWidth : 1;
    
        // 确定最终的统一字体大小（增大1.5倍）
        const finalLabelFontSize = baseLabelFontSize * labelScaleFactor * 1.5;
    
        // 移除临时元素
        tempText.remove();
    
        // 开始添加国旗和标签组
        chart.selectAll(".flag-label-group")
            .data(sortedData)
            .enter()
            .append("g")
            .attr("class", "flag-label-group")
            // 根据实际瓶子高度调整位置
            .attr("transform", d => `translate(${xScale(d[xField]) + baseBottleWidth / 2}, ${bottleTopY + baseBottleHeight + spacingAfterBottle})`)
            .each(function(d, i) {
                const group = d3.select(this);
                
                // 计算图标尺寸
                const iconWidth = baseBottleWidth;
                const iconHeight = iconWidth * 0.75;

                // 添加国旗（如果数据中提供了图片字段和对应的值）
                if (images.field && images.field[d[xField]]) {
                    group.append("image")
                        .attr("xlink:href", images.field[d[xField]])
                        .attr("x", -iconWidth / 2)
                        .attr("y", 0)
                        .attr("width", iconWidth)
                        .attr("height", iconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                }

                // 添加国家名称文本
                const label = group.append("text")
                    .attr("class", "country-label")
                    .attr("x", 0)
                    .attr("y", iconHeight + spacingBetweenIconLabel)
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", `${finalLabelFontSize}px`)
                    .style("fill", colors.text_color)
                    .text(d[xField]);

                // 如果需要换行，重新应用换行
                const labelMaxWidth = baseBottleWidth * 1.05;
                if (label.node().getComputedTextLength() > labelMaxWidth) {
                    wrapText(label, d[xField].toString(), labelMaxWidth, 1.1, 'top');
                }
            });
    
    // ---------- 9. 统一调整所有值标签的字体大小 ----------
    // 创建临时文本元素来测量值标签文本宽度
   
    const baseValueFontSize = 16;
    const tempValueText = svg.append("text")
        .attr("visibility", "hidden")
        .style("font-family", typography.label.font_family)
        .style("font-weight", "bold")
        .style("font-size", `${baseValueFontSize}px`);
    
    // 计算所有值标签在基础字体大小下的实际宽度
    const valueTextWidths = valueLabels.map(item => {
        tempValueText.text(item.value);
        return tempValueText.node().getComputedTextLength();
    });
    
    // 计算每个标签所需的缩放比例（方形宽度 / 文本宽度）
    const valueScaleFactors = valueLabels.map((item, i) => {
        // 使用60%的方形宽度作为最大可用宽度
        const maxWidth = item.squareSize * 1; // 留一些边距
        return maxWidth / valueTextWidths[i];
    });
    
    // 取最小的缩放比例，确保所有值标签使用相同的字体大小
    const minValueScaleFactor = Math.min(...valueScaleFactors, 1); // 不要放大，只缩小
    
    // 计算最终的统一字体大小
    const finalValueFontSize = Math.min(baseValueFontSize * minValueScaleFactor, baseValueFontSize);
    
    // 移除临时元素
    tempValueText.remove();
    
    // 应用统一的字体大小到所有值标签
    valueLabels.forEach(item => {
        item.element
            .style("font-size", `${finalValueFontSize}px`);
    });
    
    // 返回SVG节点
    return svg.node();
}
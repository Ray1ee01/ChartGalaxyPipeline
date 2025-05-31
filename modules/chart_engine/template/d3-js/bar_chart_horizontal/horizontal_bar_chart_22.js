/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Bar Chart With Circle",
    "chart_name": "horizontal_bar_chart_22",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [
        ["categorical"],
        ["numerical"],
        ["numerical"]
    ],
    "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": ["primary"],
    "supported_effects": [],
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

// 水平条形图与比例方形复合图表实现 - 使用D3.jshorizontal_bar_chart_composite_04
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                           // 完整的JSON数据对象
    const chartData = jsonData.data.data                 // 实际数据点数组  
    const variables = jsonData.variables || {};      // 图表配置
    const typography = jsonData.typography || {      // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "28px", font_weight: 700 },
        label: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        description: { font_family: "Arial", font_size: "16px", font_weight: 500 },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: 400 }
    };
    const colors = jsonData.colors || { 
        text_color: "#000000", 
        background_color: "#FFFFFF",
        other: { primary: "#83C341" }
    };
    const images = jsonData.images || { field: {}, other: {} };   // 图像设置
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    const titles = jsonData.titles || {};           // 标题配置
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸
    const width = variables.width || 800;
    const height = variables.height || 600;
    
    // 设置边距
    const margin = {
        top: 100,      // 顶部留出标题空间
        right: 5,      // 右侧边距
        bottom: 40,    // 底部边距
        left: 10       // 左侧边距，给文字留出一些空间
    };
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x")?.name || "Country";
    const valueField1 = dataColumns.find(col => col.role === "y" )?.name || "Crypto Ownership Percentage";
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name || "Number of Owners";
    
    // 获取字段单位
    let valueUnit1 = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : 
                       dataColumns.find(col => col.role === "y")?.unit;
    let valueUnit2 = dataColumns.find(col => col.role === "y2")?.unit === "none"? "" :
                       dataColumns.find(col => col.role === "y2")?.unit;
    valueUnit1 = valueUnit1 ? valueUnit1 : "";
    valueUnit2 = valueUnit2 ? valueUnit2 : "";
    
    // 列标题（使用数据列的name字段，而不是description）
    const columnTitle1 = dataColumns.find(col => col.role === "y")?.name || 
                          "Crypto Ownership Percentage";
    const columnTitle2 = dataColumns.find(col => col.role === "y2")?.name || 
                          "Number of Owners";
    
    // ---------- 4. 数据处理 ----------
    
    // 按第一个数值字段降序排序数据
    const sortedData = [...chartData].sort((a, b) => b[valueField1] - a[valueField1]);
    const sortedDimensions = sortedData.map(d => d[dimensionField]);
    
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
    };
    
    // ---------- 5. 布局计算 ----------
    const flagWidth = 30; // 图标宽度
    const flagHeight = 30; // 图标高度
    const textPadding = 5; // 文本与图标/边缘的间距
    const labelGap = 10; // 外部标签间距

    // 更新左边距 (仅考虑图标和padding)
    const requiredLeftSpace = flagWidth + textPadding;
    margin.left = requiredLeftSpace + 5; // 加5px额外缓冲
    
    // 设置条形图和方形图的布局比例
    const leftColumnRatio = 0.85;  // 左列占比
    const rightColumnRatio = 0.15; // 右列占比
    
    // 计算内部绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算两列的宽度
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * rightColumnRatio;
    
    // ---------- 6. 创建比例尺 ----------
    
    // 计算条形的额外间距（如果启用）
    const barPadding = 0.2;
    
    // Y轴比例尺（用于维度）
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    
    // X轴比例尺（用于第一个数值）- 条形图
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField1]) * 1.05]) // 添加5%边距
        .range([0, barChartWidth]);
    
    // 正方形面积比例尺（用于第二个数值）
    const maxValue2 = d3.max(chartData, d => +d[valueField2]);
    const minSideLength = yScale.bandwidth() * 0.1; // 最小边长为bar height的10%
    const maxSideLength = Math.min(yScale.bandwidth() * 1.0, circleChartWidth * 0.8); // 最大边长
    
    const squareSideScale = d3.scaleSqrt() // 使用平方根比例尺确保面积比例正确
        .domain([0, maxValue2])
        .range([minSideLength, maxSideLength]);
    
    // ---------- 7. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 8. 添加SVG定义 ----------
    
    // ---------- 9. 添加标题和标题下的线条 ----------
   
    // 计算标题位置
    const titleY = margin.top - 25;
    const lineY = margin.top - 10;
    
    // 创建一个临时的SVG元素用于文本测量
    const tempTextSvg = d3.select(containerSelector).append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("opacity", 0)
        .style("position", "absolute");

    // ---------- Helper: Get Wrapped Lines ----------
    function getWrappedLines(textContent, availableWidth, fontConfig, tempSvg) {
        const words = (textContent || "").trim().toUpperCase().split(/\s+/).filter(w => w !== ""); // 转大写
        const lines = [];
        const fontSizeValue = parseFloat(fontConfig.font_size);
        const lineHeight = fontSizeValue * 1.2; 

        if (words.length === 0) {
            return { linesArray: [], numLines: 0, lineHeight: lineHeight };
        }

        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + " " + word;
            if (estimateGenericTextWidth(testLine, fontConfig, tempSvg) > availableWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine !== "") {
            lines.push(currentLine);
        }
        
        return { linesArray: lines, numLines: lines.length, lineHeight: lineHeight };
    }

    // ---------- Helper: Estimate Generic Text Width ----------
    function estimateGenericTextWidth(text, fontConfig, tempSvg) {
        tempSvg.selectAll("text").remove(); // 清除旧文本
        const tempText = tempSvg.append("text")
            .style("font-family", fontConfig.font_family)
            .style("font-size", fontConfig.font_size)
            .style("font-weight", fontConfig.font_weight)
            .text(text);
        const width = tempText.node().getBBox().width;
        return width;
    };

    // ---------- 重构标题部分 ----------
    const titleFontConfig = typography.description;
    const titleBottomPadding = 10; // 标题底部与横线之间的间距
    const desiredBaselineOfLastLine = lineY - titleBottomPadding; // 横线上方10px
    
    // 左侧列标题
    const leftTitleAvailableWidth = barChartWidth * 0.9; // 左侧标题可用宽度，给一些padding
    const leftTitleXPos = margin.left;
    const wrappedLeftTitle = getWrappedLines(columnTitle1, leftTitleAvailableWidth, titleFontConfig, tempTextSvg);

    if (wrappedLeftTitle.numLines > 0) {
        const initialYLeft = desiredBaselineOfLastLine - (wrappedLeftTitle.numLines - 1) * wrappedLeftTitle.lineHeight;
    const leftTitleText = svg.append("text")
            .attr("x", leftTitleXPos)
            .attr("y", initialYLeft)
    .attr("text-anchor", "start")
            .style("font-family", titleFontConfig.font_family)
            .style("font-size", titleFontConfig.font_size)
            .style("font-weight", titleFontConfig.font_weight)
            .style("fill", colors.text_color);

        wrappedLeftTitle.linesArray.forEach((line, i) => {
            leftTitleText.append("tspan")
                .attr("x", leftTitleXPos)
                .attr("dy", i === 0 ? 0 : wrappedLeftTitle.lineHeight)
                .text(line);
        });
    }
    
    // 右侧列标题
    const rightTitleAvailableWidth = circleChartWidth * 0.9; // 右侧标题可用宽度
    const rightTitleXPos = margin.left + barChartWidth + circleChartWidth; // 右对齐到右侧区域的末尾
    const wrappedRightTitle = getWrappedLines(columnTitle2, rightTitleAvailableWidth, titleFontConfig, tempTextSvg);

    if (wrappedRightTitle.numLines > 0) {
        const initialYRight = desiredBaselineOfLastLine - (wrappedRightTitle.numLines - 1) * wrappedRightTitle.lineHeight;
        const rightTitleText = svg.append("text")
            .attr("x", rightTitleXPos)
            .attr("y", initialYRight)
            .attr("text-anchor", "end") // 右侧标题右对齐
            .style("font-family", titleFontConfig.font_family)
            .style("font-size", titleFontConfig.font_size)
            .style("font-weight", titleFontConfig.font_weight)
            .style("fill", colors.text_color);

        wrappedRightTitle.linesArray.forEach((line, i) => {
            rightTitleText.append("tspan")
                .attr("x", rightTitleXPos)
                .attr("dy", i === 0 ? 0 : wrappedRightTitle.lineHeight)
                .text(line);
        });
    }
    
    // 标题下的黑线 (位置不变)
    svg.append("line")
        .attr("x1", margin.left)
        .attr("y1", lineY)
        .attr("x2", width - margin.right)
        .attr("y2", lineY)
        .attr("stroke", "#000000")
        .attr("stroke-width", 1.5);
    
    // 清理临时SVG元素
    tempTextSvg.remove();
    
    
    // ---------- 10. 创建主图表组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 11. 获取条形图颜色的辅助函数 ----------
    
    // 获取条形图颜色
    const getBarColor = (dimension) => {
        if (colors.field && colors.field[dimension]) {
            return colors.field[dimension];
        }
        return colors.other.primary || "#83C341";
    };
    
    // 重命名函数，逻辑不变 (获取正方形/条形颜色)
    const getShapeColor = getBarColor;
    
    // ---------- 13. 为每个维度绘制条形和正方形 ----------
    
    sortedDimensions.forEach((dimension, index) => {
        try {
            const dataPoint = chartData.find(d => d[dimensionField] === dimension);
            
            if (!dataPoint) {
                console.error(`No data found for dimension: ${dimension}`);
                return;
            }
            
            // 检查数据值是否有效
            if (isNaN(+dataPoint[valueField1]) || isNaN(+dataPoint[valueField2])) {
                console.error(`Invalid data values for ${dimension}: ${dataPoint[valueField1]}, ${dataPoint[valueField2]}`);
                return;
            }
            
            const barHeight = yScale.bandwidth();
            const y = yScale(dimension);
            if (typeof y !== 'number') {
                console.error(`Invalid y position for dimension: ${dimension}`);
                return;
            }
            
            const centerY = y + barHeight / 2;
            const barWidthValue = xScale(+dataPoint[valueField1]);

            // 定义图标X坐标
            const iconX = -(flagWidth + textPadding); // 图标放在最左侧，考虑padding
            
            // 1. 添加图标（如果有）
            const iconGroup = g.append("g")
                             .attr("transform", `translate(${iconX}, ${centerY - flagHeight/2})`);

            if (images.field && images.field[dimension]) {
                 iconGroup.append("image")
                    .attr("x", -5)
                    .attr("y", 0)
                    .attr("width", flagWidth)
                    .attr("height", flagHeight)
                    .attr("preserveAspectRatio","xMidYMid meet")
                    .attr("xlink:href", images.field[dimension]);
            } else {
                 // 占位符
                 iconGroup.append("rect") 
                    .attr("width", flagWidth * 0.8)
                    .attr("height", flagHeight * 0.8)
                    .attr("x", flagWidth * 0.1)
                    .attr("y", flagHeight * 0.1)
                    .attr("fill", getShapeColor(dimension))
                    .attr("opacity", 0.6);
            }
            
            // 2. 绘制条形（右侧圆角）
            const radius = barHeight / 2;
            const arcStartX = Math.max(0, barWidthValue - radius);
            g.append("path")
                .attr("d", `M 0,${y} 
                           L ${arcStartX},${y} 
                           A ${radius},${radius} 0 0,1 ${barWidthValue},${centerY} 
                           A ${radius},${radius} 0 0,1 ${arcStartX},${y + barHeight} 
                           L 0,${y + barHeight} 
                           Z`)
                .attr("fill", getBarColor(dimension)); // 直接使用颜色填充
            
            // 3. 准备标签文本和测量宽度
            const dimensionLabelText = dimension.toUpperCase();
            const formattedValue1 = `${formatValue(+dataPoint[valueField1])}${valueUnit1}`;
            const valueLabelFontSize = typography.label.font_size;
            const dimensionLabelFontSize = typography.label.font_size;

            // 测量维度标签宽度
            const tempDimText = g.append("text").attr("x", -1000).attr("y", -1000)
                             .style("font-family", typography.label.font_family)
                             .style("font-size", dimensionLabelFontSize)
                             .style("font-weight", typography.label.font_weight)
                             .text(dimensionLabelText);
            const countryLabelWidth = tempDimText.node().getBBox().width;
            tempDimText.remove();

            // 测量数值标签宽度
            const tempValueText = g.append("text").attr("x", -1000).attr("y", -1000)
                               .style("font-family", typography.label.font_family)
                               .style("font-size", valueLabelFontSize)
                               .style("font-weight", typography.label.font_weight)
                               .text(formattedValue1);
            const valueTextWidth = tempValueText.node().getBBox().width;
            tempValueText.remove();

            // 4. 决定并绘制标签
            let dimLabelX, dimLabelAnchor, dimLabelFill;
            let valueLabelX, valueLabelAnchor, valueLabelFill;

            const canDimFitInside = barWidthValue >= countryLabelWidth + 2 * textPadding; // 左右各5px padding
            const canValueAlsoFitInside = barWidthValue >= textPadding + countryLabelWidth + textPadding + valueTextWidth + textPadding; // 多加一个标签间padding

            if (canDimFitInside) {
                // 维度标签放内部左侧
                dimLabelX = textPadding;
                dimLabelAnchor = "start";
                dimLabelFill = "#FFFFFF";
                g.append("text")
                    .attr("x", dimLabelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", dimLabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", dimensionLabelFontSize)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", dimLabelFill)
                    .text(dimensionLabelText);

                if (canValueAlsoFitInside) {
                    // 数值标签放内部右侧
                    valueLabelX = barWidthValue - textPadding;
                    valueLabelAnchor = "end";
                    valueLabelFill = "#FFFFFF";
                } else {
                    // 数值标签放外部右侧
                    valueLabelX = barWidthValue + textPadding;
                    valueLabelAnchor = "start";
                    valueLabelFill = colors.text_color;
                }
                // 绘制数值标签
                g.append("text")
                    .attr("x", valueLabelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", valueLabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", valueLabelFontSize)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", valueLabelFill)
                    .text(formattedValue1);

            } else {
                // 维度标签放外部右侧
                dimLabelX = barWidthValue + textPadding;
                dimLabelAnchor = "start";
                dimLabelFill = colors.text_color;
                const externalDimLabel = g.append("text") // 保存引用以获取宽度
                    .attr("x", dimLabelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", dimLabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", dimensionLabelFontSize)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", dimLabelFill)
                    .text(dimensionLabelText);
                
                // 获取外部维度标签的实际渲染宽度
                const externalDimLabelWidth = externalDimLabel.node().getBBox().width;
                
                // 数值标签放外部维度标签右侧
                valueLabelX = dimLabelX + externalDimLabelWidth + labelGap;
                valueLabelAnchor = "start";
                valueLabelFill = colors.text_color;
                 // 绘制数值标签
                g.append("text")
                    .attr("x", valueLabelX)
                    .attr("y", centerY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", valueLabelAnchor)
                    .style("font-family", typography.label.font_family)
                    .style("font-size", valueLabelFontSize)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", valueLabelFill)
                    .text(formattedValue1);
            }

            // 5. 绘制正方形和数值标签
            const sideLength = squareSideScale(+dataPoint[valueField2]);
            const squareX = barChartWidth + circleChartWidth / 2 - sideLength / 2; // 水平居中
            const squareY = y + barHeight / 2 - sideLength / 2; // 垂直居中
            const squareFill = getShapeColor(dimension);

            // 绘制正方形（无视觉效果）
            g.append("rect")
                .attr("x", squareX)
                .attr("y", squareY)
                .attr("width", sideLength)
                .attr("height", sideLength)
                .attr("fill", squareFill); // 直接使用颜色填充
                
            // 添加正方形数值标签
            const formattedValue2 = `${formatValue(+dataPoint[valueField2])}${valueUnit2}`;
            const squareLabelFontSize = typography.label.font_size; // 使用label字体大小
            
            // 创建临时文本元素用于测量数值宽度
            const tempSquareValueText = g.append("text")
                .attr("x", -1000).attr("y", -1000)
                .style("font-family", typography.label.font_family)
                .style("font-size", squareLabelFontSize)
                .style("font-weight", typography.label.font_weight)
                .text(formattedValue2);
            
            const value2TextWidth = tempSquareValueText.node().getBBox().width;
            tempSquareValueText.remove();
            
            // 判断文本是否能放入正方形内
            let textFitsInSquare = (sideLength > value2TextWidth + 10); // 需要10px的内边距
            
            if (textFitsInSquare) {
                // 文本放在正方形内，白色
                g.append("text")
                    .attr("x", squareX + sideLength / 2) // 居中
                    .attr("y", squareY + sideLength / 2) // 居中
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", squareLabelFontSize)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", "#FFFFFF")
                    .text(formattedValue2);
            } else {
                // 文本放在正方形上方，与正方形颜色相同
                g.append("text")
                    .attr("x", squareX + sideLength / 2) // 水平居中
                    .attr("y", squareY - 2) // 正方形上方一点
                    .attr("dy", "0em")
                    .attr("text-anchor", "middle")
                    .style("font-family", typography.label.font_family)
                    .style("font-size", squareLabelFontSize)
                    .style("font-weight", typography.label.font_weight)
                    .style("fill", squareFill) // 与正方形同色
                    .text(formattedValue2);
            }
            
        } catch (error) {
            console.error(`Error rendering chart element for ${dimension}:`, error);
            // Continue with the next item instead of stopping the entire chart
        }
    });
    
    // 返回SVG节点
    return svg.node();
}
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Diverging Bar Chart",
    "chart_name": "diverging_bar_plain_chart_05",
    "chart_for": "comparison",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 400,
    "background": "none",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "no",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 水平对比型条形图实现 - 使用D3.js horizontal_split_bar_chart_01
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备阶段 ----------
    
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data                // 实际数据点数组
    const variables = jsonData.variables || {};     // 图表配置，如果不存在则使用空对象
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };  // 颜色设置，如果不存在则使用默认值
    const images = jsonData.images || { field: {}, other: {} };  // 图像(国旗等)
    const dataColumns = jsonData.data.columns || []; // 数据列定义
    

    variables.has_rounded_corners = variables.has_rounded_corners || false; 
    d3.select(containerSelector).html("");
    
    // 数值格式化函数
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
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表总尺寸和边距
    const width = variables.width;                  // 图表总宽度
    const height = variables.height;                // 图表总高度
    // 边距：top-顶部，right-右侧，bottom-底部，left-左侧
    const margin = { top: 100, right: 30, bottom: 40, left: 30 };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;    // 绘图区宽度
    const innerHeight = height - margin.top - margin.bottom;  // 绘图区高度
    
    // 设置各部分位置参数
    const centerX = margin.left + innerWidth / 2;   // 图表中心X坐标
    const topAreaHeight = 60;                       // 标题和标签区域高度
    const barPadding = 8;                           // 条形图之间的间距
    
    // ---------- 3. 提取字段名和单位 ----------
    
    // 根据数据列顺序提取字段名
    const dimensionField = dataColumns.find(col => col.role === "x").name;
    const valueField = dataColumns.find(col => col.role === "y").name;
    const groupField = dataColumns.find(col => col.role === "group").name;
    
    // 获取字段单位（如果存在）
    let dimensionUnit = "";
    let valueUnit = ""; // 默认为百分比
    let groupUnit = "";
    
    if (dataColumns.find(col => col.role === "x").unit !== "none") {
        dimensionUnit = dataColumns.find(col => col.role === "x").unit;
    }
    
    if (dataColumns.find(col => col.role === "y").unit !== "none") {
        valueUnit = dataColumns.find(col => col.role === "y").unit;
    }
    if (dataColumns.find(col => col.role === "group").unit!== "none") {
        groupUnit = dataColumns.find(col => col.role === "group").unit; 
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一维度值和分组值
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // 不对维度进行排序，直接使用原始顺序
    const dimensions = [...allDimensions];
    
    // 使用前两个分组作为左右两侧显示数据
    const leftGroup = groups[0];   // 左侧分组
    const rightGroup = groups[1];  // 右侧分组
   
    // 检查是否所有维度都同时具有左右两侧分组的数据
    const isDataComplete = dimensions.every(dimension => {
        const hasLeftData = chartData.some(d => d[dimensionField] === dimension && d[groupField] === leftGroup);
        const hasRightData = chartData.some(d => d[dimensionField] === dimension && d[groupField] === rightGroup);
        return hasLeftData && hasRightData;
    });

    // 如果数据不完整，显示错误信息并返回
    if (!isDataComplete) {
        d3.select(containerSelector)
            .append("div")
            .style("color", "orange") // 使用警告色
            .style("text-align", "center")
            .style("padding", "20px")
            .style("font-family", typography?.label?.font_family || "Arial")
            .style("font-size", typography?.label?.font_size || "12px")
            .html("存在缺少左侧或右侧分组数据的维度，无法生成图表。");
        return; // 停止执行
    }
    
    // ---------- 5. 动态计算维度标签区域宽度 ----------
    
    // 创建临时SVG容器用于测量文本宽度
    const tempSvg = d3.select(containerSelector)
        .append("svg")
        .attr("width", 0)
        .attr("height", 0)
        .style("visibility", "hidden");

    // 计算最大标签宽度
    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        // 格式化维度名称（附加单位，如果有）
        const formattedDimension = dimensionUnit ? 
            `${dimension}${dimensionUnit}` : 
            `${dimension}`;
            
        const tempText = tempSvg.append("text")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
        
        const textWidth = tempText.node().getBBox().width;
        const totalWidth = textWidth + 5; // 只考虑文本宽度和少量边距
        
        maxLabelWidth = Math.max(maxLabelWidth, totalWidth);
        
        tempText.remove();
    });
    
    // 删除临时SVG
    tempSvg.remove();
    
    // 为计算出的宽度添加边距，确保有足够空间
    const dimensionLabelWidth = Math.max(maxLabelWidth + 5, 80);  // 最小值为80像素
    
    // ---------- 6. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6.1 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 创建基于 group 的颜色比例尺
    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colors.field && colors.field[group]) {
                return colors.field[group];
            }
            // 使用 D3 默认分类色板作为备用
            return d3.schemeCategory10[i % 10]; 
        }));

    // 创建斜线纹理模式 - 每个 group 一个
    const patternDensity = 6; // 固定斜线密度
    const patternStrokeWidth = 1.5; // 固定斜线宽度
    groups.forEach((group, i) => {
        // 为每个组获取颜色
        const groupColor = colorScale(group);
        
        // 创建斜线纹理模式
        const patternId = `pattern-group-${group.replace(/[^a-zA-Z0-9]/g, '-')}-${i}`; // 基于 group 生成 ID
        const pattern = defs.append("pattern")
            .attr("id", patternId)
            .attr("patternUnits", "userSpaceOnUse")
            .attr("width", patternDensity)
            .attr("height", patternDensity)
            .attr("patternTransform", "rotate(45)");
        
        // 添加背景矩形
        pattern.append("rect")
            .attr("width", patternDensity)
            .attr("height", patternDensity)
            .attr("fill", groupColor) // 使用 group 的颜色
            .attr("opacity", 0.8);
        
        // 添加斜线
        pattern.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", patternDensity)
            .attr("stroke", "white")
            .attr("stroke-width", patternStrokeWidth)
            .attr("opacity", 0.6);
    });

    // ---------- 7. 添加左右组标签 ----------
    
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    svg.append("text")
        .attr("x", margin.left + innerWidth / 4)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(formattedLeftGroup);
    
    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    svg.append("text")
        .attr("x", margin.left + innerWidth * 3 / 4)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "middle")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color)
        .text(formattedRightGroup);
    
    // ---------- 8. 创建绘图组 ----------
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // ---------- 9. 创建比例尺 ----------
    
    const yScale = d3.scaleBand()
        .domain(dimensions) // 使用过滤后的维度
        .range([0, innerHeight])
        .padding(0.3); // 使用固定 padding
    
    // 计算全局最大值以统一比例尺
    const maxValue = d3.max(chartData, d => +d[valueField]);
    
    const leftXScale = d3.scaleLinear()
        .domain([0, maxValue]) // 使用全局最大值
        .range([innerWidth / 2 - dimensionLabelWidth/2, 0]);
    
    const rightXScale = d3.scaleLinear()
        .domain([0, maxValue]) // 使用全局最大值
        .range([0, innerWidth / 2 - dimensionLabelWidth/2]);
    
    // ---------- 10. 绘制维度标签和图标 ----------
    
    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        
        // 始终将文本居中绘制在中间区域
        const startX = innerWidth / 2; // X 坐标始终为中心点
        g.append("text")
            .attr("x", startX)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle") // 始终居中对齐
            .style("fill", colors.text_color)
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .text(formattedDimension);
    });
    
    // ---------- 11. 绘制左侧条形图 ----------
    
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === leftGroup
        );
        
        if (dataPoint) {
            const barWidth = innerWidth/2 - dimensionLabelWidth/2 - leftXScale(dataPoint[valueField]);
            const yPos = yScale(dimension);
            
            // 移除梯形相关的变量
            // const slopeLeft = 5; 
            const xStart = leftXScale(dataPoint[valueField]); // 最左侧 X 坐标
            const barHeight = yScale.bandwidth();
            const radius = barHeight / 2; // 半圆半径
            const xEnd = xStart + barWidth; // 右侧 X 坐标 (靠近中心)

            // 生成左侧条形图路径 (借鉴新逻辑: 右直左半圆/椭圆弧)
            let pathDataLeft;
            // 处理零或负值，避免绘制错误
            if (barWidth <= 0) {
                pathDataLeft = ""; // 不绘制任何路径
            } else if (barWidth < radius) {
                
                pathDataLeft = `M ${xEnd},${yPos} L ${xEnd},${yPos + barHeight} A ${barWidth},${radius} 0 0 1 ${xEnd},${yPos} Z`;
            } else {
                
                pathDataLeft = `M ${xEnd},${yPos} L ${xEnd},${yPos + barHeight} L ${xStart + radius},${yPos + barHeight} A ${radius},${radius} 0 0 1 ${xStart + radius},${yPos} Z`;
            }
            
            // 应用纹理填充 - 基于 group
            const patternId = `pattern-group-${leftGroup.replace(/[^a-zA-Z0-9]/g, '-')}-${groups.indexOf(leftGroup)}`;
            g.append("path")
                .attr("d", pathDataLeft)
                .attr("fill", `url(#${patternId})`) // 应用 group 的纹理
                .on("mouseover", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 0.8);
                })
                .on("mouseout", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 1);
                });
            
            // ------- 以下是数值标签原逻辑，不作改动 -------
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            const tempText = g.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("visibility", "hidden")
                .text(formattedValue);
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            let textX = leftXScale(dataPoint[valueField]) - 10;
            const rightBoundary = leftXScale(dataPoint[valueField]) + barWidth;
            if (textX + textWidth/2 > rightBoundary) {
                textX = rightBoundary - textWidth/2 - 2;
            }
            g.append("text")
                    .attr("class", "label")
                    .attr("x", leftXScale(dataPoint[valueField]) - 10)
                    .attr("y", yPos + yScale.bandwidth()/2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("fill", colors.text_color)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("pointer-events", "none")
                    .text(formattedValue);
        }
    });
    
    // ---------- 12. 绘制右侧条形图 ----------
    
    dimensions.forEach(dimension => {
        const dataPoint = chartData.find(d => 
            d[dimensionField] === dimension && d[groupField] === rightGroup
        );
        
        if (dataPoint) {
            const barWidth = rightXScale(dataPoint[valueField]);
            const yPos = yScale(dimension);
            const barLeft = innerWidth/2 + dimensionLabelWidth/2; // 左侧 X 坐标 (靠近中心)
            
            // 移除梯形相关的变量
            // const slopeRight = 5;
            const barHeight = yScale.bandwidth();
            const radius = barHeight / 2; // 半圆半径
            const xEnd = barLeft + barWidth; // 右侧 X 坐标

            // 生成右侧条形图路径 (借鉴新逻辑: 左直右半圆/椭圆弧)
            let pathDataRight;
            // 处理零或负值，避免绘制错误
            if (barWidth <= 0) {
                pathDataRight = ""; // 不绘制任何路径
            } else if (barWidth < radius) {
                pathDataRight = `M ${barLeft},${yPos} A ${barWidth},${radius} 0 0 1 ${barLeft},${yPos + barHeight} Z`;
            } else {
                pathDataRight = `M ${barLeft},${yPos} H ${xEnd - radius} A ${radius},${radius} 0 0 1 ${xEnd - radius},${yPos + barHeight} H ${barLeft} Z`;
            }
            
            // 应用纹理填充 - 基于 group
            const patternId = `pattern-group-${rightGroup.replace(/[^a-zA-Z0-9]/g, '-')}-${groups.indexOf(rightGroup)}`;
            g.append("path")
                .attr("d", pathDataRight)
                .attr("fill", `url(#${patternId})`) // 应用 group 的纹理
                .on("mouseover", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 0.8);
                })
                .on("mouseout", function(event, d) {
                    d3.select(this)
                      .transition()
                      .duration(100)
                      .attr("opacity", 1);
                });
            
            // ------- 以下是数值标签原逻辑，不作改动 -------
            const formattedValue = valueUnit ? 
                `${formatValue(dataPoint[valueField])}${valueUnit}` : 
                `${formatValue(dataPoint[valueField])}`;
            
            const tempText = g.append("text")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                .style("font-weight", typography.annotation.font_weight)
                .style("visibility", "hidden")
                .text(formattedValue);
            
            const textWidth = tempText.node().getBBox().width;
            tempText.remove();
            
            let textX = barLeft + barWidth + 10;
            if (textX - textWidth/2 < barLeft) {
                textX = barLeft + textWidth/2 + 2;
            }
            g.append("text")
                    .attr("class", "label")
                    .attr("x", barLeft + barWidth + 10)
                    .attr("y", yPos + yScale.bandwidth()/2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("fill", colors.text_color)
                    .style("font-family", typography.annotation.font_family)
                    .style("font-size", `${Math.min(20,Math.max(barHeight * 0.6, parseFloat(typography.annotation.font_size)))}px`)
                    .style("font-weight", typography.annotation.font_weight)
                    .style("pointer-events", "none")
                    .text(formattedValue);
            
        }
    });
    
    // 返回SVG节点
    return svg.node();
}

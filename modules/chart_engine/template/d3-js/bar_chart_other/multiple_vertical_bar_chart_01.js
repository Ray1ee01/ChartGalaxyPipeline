/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Multiple Vertical Bar Chart",
    "chart_name": "multiple_vertical_bar_chart_01",
    "chart_for": "comparison",
    "is_composite": true,
    "required_fields": ["x", "y", "y2"],
    "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
    "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
    "min_height": 400,
    "min_width": 600,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "no"
}
REQUIREMENTS_END
*/

// 复合柱状图实现 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    // 提取数据和配置
    const jsonData = data;                          // 完整的JSON数据对象
    const chartData = jsonData.data.data || [];          // 修正: 直接使用jsonData.data而不是jsonData.data.data
    const variables = jsonData.variables || {};     // 图表配置，如果不存在则使用空对象
    const typography = jsonData.typography || {     // 字体设置，如果不存在则使用默认值
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333", other: { primary: "#4682B4", secondary: "#FF7F50" } };  // 修正: 添加默认other颜色
    const images = jsonData.images || { field: {}, other: {} };  // 图像(国旗等)
    const dataColumns = jsonData.data.columns || [];            // 使用data_columns
    
    // 数值单位规范
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
    
    // 添加subtitle字段如果不存在
    typography.subtitle = typography.subtitle || typography.description;
    
    // 设置视觉效果变量
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || false;
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 尺寸和布局设置 ----------
    
    // 设置图表尺寸和边距
    const width = variables.width || 800;          // 添加默认宽度
    const height = variables.height || 600;        // 添加默认高度
    
    // 边距: 上, 右, 下, 左
    const margin = { 
        top: 100,        // 标题和副标题的空间
        right: 30, 
        bottom: 100,     // x轴和图标的空间
        left: 60         // 增加左边距以适应更大的数字
    };
    
    // 计算实际绘图区域尺寸
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 计算每个图表(左和右)的尺寸
    const chartWidth = innerWidth / 2 - 20;  // 20px用于图表之间的间距
    
    // ---------- 3. 提取字段名称和单位 ----------
    
    let xField, yField, y2Field;
    let xUnit = "", yUnit = "", y2Unit = "";
    
    // 安全地提取字段名称
    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const y2Column = dataColumns.find(col => col.role === "y2");
    
    if (xColumn) xField = xColumn.name;
    if (yColumn) yField = yColumn.name;
    if (y2Column) y2Field = y2Column.name;
    
    // 获取字段单位(如果存在)
    if (xColumn && xColumn.unit && xColumn.unit !== "none") {
        xUnit = xColumn.unit;
    }
    
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        yUnit = yColumn.unit;
        if (yUnit === "none") {
            yUnit = "";
        }
        if (yUnit.length > 5) {
            yUnit = "";
        }
    }
    
    if (y2Column && y2Column.unit && y2Column.unit !== "none") {
        y2Unit = y2Column.unit; 
        if (y2Unit === "none") {
            y2Unit = "";
        }
        if (y2Unit.length > 5) {
            y2Unit = "";
        }
    }
    
    // ---------- 4. 数据处理 ----------
    
    // 获取唯一的x轴值
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    
    // 为左右图表创建单独的数据集
    const leftChartData = chartData.map(d => ({
        x: d[xField],
        y: d[yField]
    })).sort((a, b) => b.y - a.y);  // 按y值降序排序
    
    const rightChartData = chartData.map(d => ({
        x: d[xField],
        y: d[y2Field]
    })).sort((a, b) => b.y - a.y);  // 按y值降序排序
    
    // 为每个图表获取所有项目(不限制为5个)
    const topLeftItems = leftChartData.map(d => d.x);
    const topRightItems = rightChartData.map(d => d.x);
    
    // ---------- 5. 创建SVG容器 ----------
    
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // ---------- 6. 创建视觉效果 ----------
    
    const defs = svg.append("defs");
    
    // 获取类别颜色的函数
    const getColor = (category, isLeft) => {
        return isLeft ? 
            (colors.other.primary) : 
            (colors.other.secondary);
    };
    
    // 如果需要，创建阴影滤镜
    if (variables.has_shadow) {
        const filter = defs.append("filter")
            .attr("id", "shadow")
            .attr("filterUnits", "userSpaceOnUse")
            .attr("width", "200%")
            .attr("height", "200%");
        
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 3);
        
        filter.append("feOffset")
            .attr("dx", 2)
            .attr("dy", 2)
            .attr("result", "offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }
    
    // 如果需要，为柱子创建渐变
    if (variables.has_gradient) {
        // 为每个唯一类别创建渐变
        [...new Set([...topLeftItems, ...topRightItems])].forEach((category, idx) => {
            // 添加安全的ID处理
            const safeCategory = typeof category === 'string' ? 
                category.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                `category-${idx}`;
            
            const baseColor = getColor(category, topLeftItems.includes(category));
            const gradientId = `gradient-${safeCategory}`;
            
            const gradient = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "100%")
                .attr("x2", "0%")
                .attr("y2", "0%");
            
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.7));
            
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.7));
        });
    }
    
    // 计算动态文本大小的函数
    const calculateFontSize = (text, maxWidth, baseSize = 14) => {
        // 估算每个字符的平均宽度 (假设为baseSize的60%)
        const avgCharWidth = baseSize * 0.6;
        // 计算文本的估计宽度
        const textWidth = text.length * avgCharWidth;
        // 如果文本宽度小于最大宽度，返回基础大小
        if (textWidth < maxWidth) {
            return baseSize;
        }
        // 否则，按比例缩小字体大小
        return Math.max(1, Math.floor(baseSize * (maxWidth / textWidth)));
    };
    
    // 检查是否应该显示x轴标签
    const shouldShowLabels = () => {
        // 检查左侧图表
        const leftLabelsTooLong = leftChartData.some(d => {
            const text = d.x.toString();
            const avgCharWidth = 12 * 0.6; // 使用基础字体大小12
            const textWidth = text.length * avgCharWidth;
            return textWidth > leftXScale.bandwidth() * 2;
        });
        
        // 检查右侧图表
        const rightLabelsTooLong = rightChartData.some(d => {
            const text = d.x.toString();
            const avgCharWidth = 12 * 0.6; // 使用基础字体大小12
            const textWidth = text.length * avgCharWidth;
            return textWidth > rightXScale.bandwidth() * 2;
        });
        
        // 如果任一图表的标签太长，返回false
        return !(leftLabelsTooLong || rightLabelsTooLong);
    };
    
    // ---------- 8. 创建左侧图表 ----------
    
    // 创建左侧图表组
    const leftChart = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 添加左侧图表标题 (yField)
    if (yField) {
        const fontSize = calculateFontSize(yField, chartWidth);
        leftChart.append("text")
            .attr("x", 0)
            .attr("y", -10)
            .attr("text-anchor", "start")
            .style("font-family", typography.title.font_family)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", typography.title.font_weight)
            .style("fill", colors.text_color)
            .text(yField + (yUnit ? ` (${yUnit})` : ''));
    }
    
    // 为左侧图表创建比例尺
    const leftXScale = d3.scaleBand()
        .domain(topLeftItems)
        .range([0, chartWidth])
        .padding(variables.has_spacing ? 0.4 : 0.2);
    
    const leftYMax = d3.max(leftChartData.filter(d => topLeftItems.includes(d.x)), d => d.y);
    const leftYScale = d3.scaleLinear()
        .domain([0, leftYMax * 1.1]) // 添加10%的填充
        .range([innerHeight, 0]);
    
    // 添加水平网格线
    leftChart.append("g")
        .attr("class", "grid-lines")
        .selectAll("line")
        .data(leftYScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("y1", d => leftYScale(d))
        .attr("x2", chartWidth)
        .attr("y2", d => leftYScale(d))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1);
    
    // 创建并添加左侧图表的X轴
    leftChart.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(leftXScale).tickSize(0).tickFormat(''));
    
    // 创建并添加左侧图表的Y轴 (无刻度线，无轴线)
    leftChart.append("g")
        .call(g => {
            const axis = d3.axisLeft(leftYScale)
                .ticks(5)
                .tickSize(0) // 移除刻度线
                .tickFormat(d => formatValue(d) + yUnit); // 使用formatValue格式化数值并添加单位
            
            g.call(axis);
            g.select(".domain").remove(); // 移除轴线
            
            g.selectAll("text")
                .style("fill", colors.text_color)
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight);
        });
    
    // 为左侧图表添加柱子
    leftChart.selectAll(".bar")
        .data(leftChartData.filter(d => topLeftItems.includes(d.x)))
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => leftXScale(d.x))
        .attr("y", d => leftYScale(d.y))
        .attr("width", leftXScale.bandwidth())
        .attr("height", d => innerHeight - leftYScale(d.y))
        .attr("fill", d => {
            if (variables.has_gradient) {
                // 添加安全的ID处理
                const safeCategory = typeof d.x === 'string' ? 
                    d.x.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                    `category-${leftChartData.indexOf(d)}`;
                return `url(#gradient-${safeCategory})`;
            } 
            return getColor(d.x, true);
        })
        .attr("rx", variables.has_rounded_corners ? 4 : 0)
        .attr("ry", variables.has_rounded_corners ? 4 : 0)
        .style("stroke", variables.has_stroke ? "#333" : "none")
        .style("stroke-width", variables.has_stroke ? 1 : 0)
        .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
        });
    
    // 如果有，添加国旗图标
    if (images && images.field) {
        leftChart.selectAll(".flag-icon")
            .data(topLeftItems)
            .enter()
            .append("g")
            .attr("class", "flag-icon")
            .attr("transform", d => `translate(${leftXScale(d) + leftXScale.bandwidth() / 2}, ${innerHeight + 20})`)
            .each(function(d) { // `this` 是 <g> 元素。 `d` 是来自 topLeftItems 的类别。
                if (images.field[d]) {
                    const imagePath = images.field[d];
                    const barBandwidth = leftXScale.bandwidth();
                    const iconDiameter = barBandwidth; // 图标直径与条形宽度一致
                    const iconRadius = iconDiameter / 2; // 用于圆形剪切和图像居中的半径

                    // 1. 正确的 clipId 生成
                    // 清理类别键值，确保其作为ID是安全的
                    const safeCategoryKey = String(d).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                    const clipId = `clip-path-left-${safeCategoryKey}`;

                    // 2. 使用全局 defs (已在文件顶部定义 const defs = svg.append("defs");)
                    // 检查 clipPath 是否已存在于全局 defs 中，以避免重复定义
                    let clipPath = defs.select(`#${clipId}`);
                    if (clipPath.empty()) { 
                        clipPath = defs.append("clipPath")
                            .attr("id", clipId);
                        
                        clipPath.append("circle")
                            .attr("r", iconRadius); // cx, cy 默认为0,0，适用于 clipPath
                    }
                    
                    // 3. 正确的图像附加：附加到 `this` (<g> 元素)
                    d3.select(this).append("image")
                        .attr("xlink:href", imagePath)
                        .attr("clip-path", `url(#${clipId})`) // 应用圆形剪切
                        .attr("x", -iconRadius) // 居中图像: x 从 -iconRadius 到 +iconRadius
                        .attr("y", -iconRadius) // 居中图像: y 从 -iconRadius 到 +iconRadius
                        .attr("width", iconDiameter)
                        .attr("height", iconDiameter);
                }
            });
    }
    
    // ---------- 9. 创建右侧图表 ----------
    
    // 创建右侧图表组
    const rightChart = svg.append("g")
        .attr("transform", `translate(${margin.left + chartWidth + 40}, ${margin.top})`);
    
    // 添加右侧图表标题 (y2Field)
    if (y2Field) {
        const fontSize = calculateFontSize(y2Field, chartWidth);
        rightChart.append("text")
            .attr("x", 0)
            .attr("y", -10)
            .attr("text-anchor", "start")
            .style("font-family", typography.title.font_family)
            .style("font-size", `${fontSize}px`)
            .style("font-weight", typography.title.font_weight)
            .style("fill", colors.text_color)
            .text(y2Field + (y2Unit ? ` (${y2Unit})` : ''));
    }
    
    // 为右侧图表创建比例尺
    const rightXScale = d3.scaleBand()
        .domain(topRightItems)
        .range([0, chartWidth])
        .padding(variables.has_spacing ? 0.4 : 0.2);
    
    const rightYMax = d3.max(rightChartData.filter(d => topRightItems.includes(d.x)), d => d.y);
    const rightYScale = d3.scaleLinear()
        .domain([0, rightYMax * 1.1]) // 添加10%的填充
        .range([innerHeight, 0]);
    
    // 添加水平网格线
    rightChart.append("g")
        .attr("class", "grid-lines")
        .selectAll("line")
        .data(rightYScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("y1", d => rightYScale(d))
        .attr("x2", chartWidth)
        .attr("y2", d => rightYScale(d))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1);
    
    // 创建并添加右侧图表的X轴
    rightChart.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(rightXScale).tickSize(0).tickFormat(''));
    
    // 创建并添加右侧图表的Y轴 (无刻度线，无轴线)
    rightChart.append("g")
        .call(g => {
            const axis = d3.axisLeft(rightYScale)
                .ticks(5)
                .tickSize(0) // 移除刻度线
                .tickFormat(d => formatValue(d) + y2Unit); // 使用formatValue格式化数值并添加单位
            
            g.call(axis);
            g.select(".domain").remove(); // 移除轴线
            
            g.selectAll("text")
                .style("font-family", typography.label.font_family)
                .style("font-size", typography.label.font_size)
                .style("font-weight", typography.label.font_weight);
        });
    
    // 为右侧图表添加柱子
    rightChart.selectAll(".bar")
        .data(rightChartData.filter(d => topRightItems.includes(d.x)))
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => rightXScale(d.x))
        .attr("y", d => rightYScale(d.y))
        .attr("width", rightXScale.bandwidth())
        .attr("height", d => innerHeight - rightYScale(d.y))
        .attr("fill", d => {
            if (variables.has_gradient) {
                // 添加安全的ID处理
                const safeCategory = typeof d.x === 'string' ? 
                    d.x.toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : 
                    `category-${rightChartData.indexOf(d)}`;
                return `url(#gradient-${safeCategory})`;
            } 
            return getColor(d.x, false);
        })
        .attr("rx", variables.has_rounded_corners ? 4 : 0)
        .attr("ry", variables.has_rounded_corners ? 4 : 0)
        .style("stroke", variables.has_stroke ? "#333" : "none")
        .style("stroke-width", variables.has_stroke ? 1 : 0)
        .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
        });
    
    // 如果有，添加国旗图标
    if (images && images.field) {
        rightChart.selectAll(".flag-icon")
            .data(topRightItems)
            .enter()
            .append("g")
            .attr("class", "flag-icon")
            .attr("transform", d => `translate(${rightXScale(d) + rightXScale.bandwidth() / 2}, ${innerHeight + 20})`)
            .each(function(d) { // `this` 是 <g> 元素。 `d` 是来自 topRightItems 的类别。
                if (images.field[d]) {
                    const imagePath = images.field[d];
                    const barBandwidth = rightXScale.bandwidth();
                    const iconDiameter = barBandwidth; // 图标直径与条形宽度一致
                    const iconRadius = iconDiameter / 2; // 用于圆形剪切和图像居中的半径

                    // 1. 正确的 clipId 生成
                    // 清理类别键值，确保其作为ID是安全的
                    const safeCategoryKey = String(d).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                    const clipId = `clip-path-right-${safeCategoryKey}`; // 与左侧图表ID区分

                    // 2. 使用全局 defs
                    let clipPath = defs.select(`#${clipId}`);
                    if (clipPath.empty()) {
                        clipPath = defs.append("clipPath")
                            .attr("id", clipId);
                        
                        clipPath.append("circle")
                            .attr("r", iconRadius);
                    }
                    
                    // 3. 正确的图像附加：附加到 `this` (<g> 元素)
                    d3.select(this).append("image")
                        .attr("xlink:href", imagePath)
                        .attr("clip-path", `url(#${clipId})`) // 应用圆形剪切
                        .attr("x", -iconRadius)
                        .attr("y", -iconRadius)
                        .attr("width", iconDiameter)
                        .attr("height", iconDiameter);
                }
            });
    }
    
    // 检查是否应该显示X轴标签
    const showLabels = shouldShowLabels();
    
    // 添加X轴标签 (移到X轴上方，贴近bar底部)
    if (showLabels) {
        // 添加左侧图表X轴标签
        leftChart.selectAll(".x-label")
            .data(leftChartData.filter(d => topLeftItems.includes(d.x)))
            .enter()
            .append("text")
            .attr("class", "x-label")
            .attr("x", d => leftXScale(d.x) + leftXScale.bandwidth() / 2)
            .attr("y", innerHeight - 5) // 放置在x轴上方，贴近bar底部
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(d => d.x);
        
        // 添加右侧图表X轴标签
        rightChart.selectAll(".x-label")
            .data(rightChartData.filter(d => topRightItems.includes(d.x)))
            .enter()
            .append("text")
            .attr("class", "x-label")
            .attr("x", d => rightXScale(d.x) + rightXScale.bandwidth() / 2)
            .attr("y", innerHeight - 5) // 放置在x轴上方，贴近bar底部
            .attr("text-anchor", "middle")
            .style("font-family", typography.label.font_family)
            .style("font-size", typography.label.font_size)
            .style("font-weight", typography.label.font_weight)
            .style("fill", colors.text_color)
            .text(d => d.x);
    }
    
    // 返回SVG节点
    return svg.node();
}
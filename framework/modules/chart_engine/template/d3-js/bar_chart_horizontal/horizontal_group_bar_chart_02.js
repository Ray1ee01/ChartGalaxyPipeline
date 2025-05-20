/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Horizontal Group Bar Chart",
    "chart_name": "horizontal_group_bar_chart_02",
    "is_composite": false,
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "hierarchy":["group"],
    "required_fields_range": [[2, 30], [0, "inf"], [2, 10]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "hierarchy":["group"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner", "gradient", "stroke", "spacing"],
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

// 水平条形图 - 使用D3.js
function makeChart(containerSelector, data) {
    // ---------- 1. 数据准备 ----------
    const jsonData = data;                          
    const chartData = jsonData.data.data                
    const variables = jsonData.variables || {};     
    const typography = jsonData.typography || {     
        title: { font_family: "Arial", font_size: "18px", font_weight: "bold" },
        label: { font_family: "Arial", font_size: "12px", font_weight: "normal" },
        description: { font_family: "Arial", font_size: "14px", font_weight: "normal" },
        annotation: { font_family: "Arial", font_size: "12px", font_weight: "normal" }
    };
    const colors = jsonData.colors || { text_color: "#333333" };
    const images = jsonData.images || { field: {}, other: {} };
    const dataColumns = jsonData.data.columns || [];
    
    // 设置图表视觉效果
    variables.has_rounded_corners = variables.has_rounded_corners || false;
    variables.has_shadow = variables.has_shadow || false;
    variables.has_gradient = variables.has_gradient || true; 
    variables.has_stroke = variables.has_stroke || false;
    variables.has_spacing = variables.has_spacing || false;
    
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // ---------- 2. 提取字段 ----------
    const dimensionField = dataColumns.length > 0 ? dataColumns[0].name : "dimension";
    const valueField = dataColumns.length > 1 ? dataColumns[1].name : "value";
    const groupField = dataColumns.length > 2 ? dataColumns[2].name : "group";
    
    // 单位 (若有)
    let valueUnit = "";
    if (dataColumns[0]?.unit && dataColumns[0].unit!== "none") {
        valueUnit = dataColumns[0].unit;
    }
    if (dataColumns[1]?.unit && dataColumns[1].unit !== "none") {
        valueUnit = dataColumns[1].unit;
    }
    if (dataColumns[2]?.unit && dataColumns[2].unit!== "none") {
        valueUnit = dataColumns[2].unit;
    }
    
    // ---------- 3. 数据排序 ----------
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    chartData.sort((a, b) => {
        const vc = +a[valueField] - +b[valueField];
        if (vc !== 0) return vc;
        return a[dimensionField].localeCompare(b[dimensionField]);
    });
    const dimensions = chartData.map(d => d[dimensionField]);
    
    // ---------- 4. 布局 ----------
    const width = variables.width || 600;
    const height = variables.height || 600;
    
    const margin = { 
        top: 50, 
        right: width*0.4, 
        bottom: 90, 
        left: 40
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const barHeight = innerHeight / dimensions.length;
    const actualBarHeight = barHeight * 0.75;
    const iconWidth = actualBarHeight * 0.85;
    const iconHeight = iconWidth;
    const iconRightPadding = - iconWidth * 0.3;
    
    // ---------- 5. 创建SVG ----------
    d3.select(containerSelector).html("");
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .style("max-width", "100%")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const defs = svg.append("defs");
    
    // ---------- 6. 视觉效果 (阴影/渐变) ----------
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
            .attr("result","offsetblur");
        
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode");
        feMerge.append("feMergeNode").attr("in","SourceGraphic");
    }
    
    // 渐变
    if (variables.has_gradient) {
        groups.forEach(grp => {
            const gradientId = `gradient-${grp.replace(/\s+/g, '-').toLowerCase()}`;
            const baseColor = getGroupColor(grp);
            
            const grad = defs.append("linearGradient")
                .attr("id", gradientId)
                .attr("x1", "0%")
                .attr("y1", "0%")
                .attr("x2", "100%")
                .attr("y2", "0%");
            
            grad.append("stop")
                .attr("offset","0%")
                .attr("stop-color", d3.rgb(baseColor).brighter(0.2));
            grad.append("stop")
                .attr("offset","100%")
                .attr("stop-color", d3.rgb(baseColor).darker(0.2));
        });
    }
    
    // ---------- 7. 比例尺 ----------
    const maxValue = d3.max(chartData, d => +d[valueField]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth]);
    
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.1);
    
    // ---------- 8. 主容器 <g> ----------
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // ---------- 9. 工具函数 ----------
    function getGroupColor(grp) {
        if (colors.field && colors.field[grp]) {
            return colors.field[grp];
        }
        if (colors.available_colors && colors.available_colors.length>0) {
            const idx = groups.indexOf(grp);
            return colors.available_colors[idx % colors.available_colors.length];
        }
        const defaultSet = d3.schemeTableau10;
        const idx = groups.indexOf(grp);
        return defaultSet[idx % defaultSet.length];
    }
    
    function getStrokeColor() {
        if (colors.stroke_color) return colors.stroke_color;
        if (colors.available_colors && colors.available_colors.length>0) {
            return colors.available_colors[0];
        }
        return "#333";
    }
    
    function getTextWidth(txt, fontFamily, fontSize, fontWeight) {
        const tmp = svg.append("text")
            .attr("x",-9999)
            .attr("y",-9999)
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .text(txt);
        const w = tmp.node().getComputedTextLength();
        tmp.remove();
        return w;
    }
    
    // ---------- 10. 绘制 ----------
    // 10.1 收集相同value的bar位置
    const barPositionsByValue = {};
    
    // 绘制所有bar
    chartData.forEach(d => {
        const dimension = d[dimensionField];
        const value = +d[valueField];
        const grp = d[groupField];
        
        const barColor = getGroupColor(grp);
        
        const barY = yScale(dimension);
        const centerY = barY + yScale.bandwidth()/2;
        
        g.append("rect")
            .attr("x",0)
            .attr("y",barY)
            .attr("width", xScale(value))
            .attr("height", actualBarHeight)
            .attr("fill", barColor)
            .attr("rx", variables.has_rounded_corners?3:0)
            .attr("ry", variables.has_rounded_corners?3:0)
            .style("stroke", variables.has_stroke? getStrokeColor():"none")
            .style("stroke-width", variables.has_stroke?1:0)
            .style("filter", variables.has_shadow?"url(#shadow)":"none")
            .attr("transform",`translate(0, ${(yScale.bandwidth()-actualBarHeight)/2})`);
        
        // 如果有图标
        if (images.field && images.field[dimension]) {
            g.append("circle")
                .attr("cx", iconRightPadding)
                .attr("cy", centerY)
                .attr("r", iconWidth*0.7)
                .attr("fill","white");
            g.append("circle")
                .attr("cx", iconRightPadding)
                .attr("cy", centerY)
                .attr("r", iconWidth*0.6)
                .attr("fill","none")
                .attr("stroke","#000")
                .attr("stroke-width",0.5);
            g.append("image")
                .attr("x", iconRightPadding - iconWidth/2)
                .attr("y", centerY - iconHeight/2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio","xMidYMid meet")
                .attr("xlink:href", images.field[dimension]);
        }
        
        // 自适应维度文字
        let fs = actualBarHeight*0.8;
        let fit = false;
        while(!fit && fs>4){
            const txtW = getTextWidth(
                dimension, 
                typography.label.font_family,
                `${fs}px`,
                typography.label.font_weight
            );
            if (txtW + iconWidth < xScale(value)-10) fit=true;
            else fs-=1;
        }
        g.append("text")
            .attr("x", iconWidth*0.9)
            .attr("y", centerY)
            .attr("dy","0.35em")
            .style("font-family", typography.label.font_family)
            .style("font-size", `${fs}px`)
            .style("font-weight", typography.label.font_weight)
            .style("fill","#fff")
            .text(dimension);
        
        // 收集bar的中心位置
        if(!barPositionsByValue[value]){
            barPositionsByValue[value]=[];
        }
        barPositionsByValue[value].push(centerY);
    });
    
    // ---------- 10.2 绘制大括号：有上下横线+竖线，只在文字处挖空 ----------
    Object.keys(barPositionsByValue).forEach(valStr=>{
        const val = +valStr;
        const centers = barPositionsByValue[val];
        centers.sort((a,b)=>a-b);
        
        // 只有1条柱形就简单写数值
        if (centers.length===1) {
            g.append("text")
                .attr("x", xScale(val)+5)
                .attr("y", centers[0])
                .attr("dy","0.35em")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("fill", colors.text_color||"#333")
                .text(valueUnit? formatValue(val)+valueUnit : formatValue(val));
        } else {
            // 多条bar => 计算顶部、底部和中间
            const topY = centers[0] - actualBarHeight/2;
            const bottomY = centers[centers.length-1] + actualBarHeight/2;
            const midY = (topY + bottomY)/2;
            
            // 估算文字高度
            const fontSizeNum = parseFloat(typography.annotation.font_size) || 12;
            // 留出一点额外空隙，防止文字贴在竖线上
            const offset = (fontSizeNum*0.6); 
            
            // 括号位置 & 横线长度
            const bracketX = xScale(val) + 5;
            const bracketWidth = 10; 
            
            // 1) 画"上横线"
            //   M bracketX, topY  -> h bracketWidth
            const pathTopLine = [
                `M ${bracketX},${topY}`,
                `h ${bracketWidth}`
            ].join(" ");
            g.append("path")
                .attr("d", pathTopLine)
                .attr("fill","none")
                .attr("stroke", colors.text_color||"#333")
                .attr("stroke-width",1);
            
            // 2) 画"下横线"
            //   M bracketX, bottomY -> h bracketWidth
            const pathBottomLine = [
                `M ${bracketX},${bottomY}`,
                `h ${bracketWidth}`
            ].join(" ");
            g.append("path")
                .attr("d", pathBottomLine)
                .attr("fill","none")
                .attr("stroke", colors.text_color||"#333")
                .attr("stroke-width",1);
            
            // 3) 画竖线的上半段
            //   从( bracketX+bracketWidth, topY )到( bracketX+bracketWidth, midY - offset )
            const pathVerticalTop = [
                `M ${bracketX+bracketWidth},${topY}`,
                `V ${midY - offset}`
            ].join(" ");
            g.append("path")
                .attr("d", pathVerticalTop)
                .attr("fill","none")
                .attr("stroke", colors.text_color||"#333")
                .attr("stroke-width",1);
            
            // 4) 画竖线的下半段
            //   从( bracketX+bracketWidth, midY + offset )到( bracketX+bracketWidth, bottomY )
            const pathVerticalBottom = [
                `M ${bracketX+bracketWidth},${midY + offset}`,
                `V ${bottomY}`
            ].join(" ");
            g.append("path")
                .attr("d", pathVerticalBottom)
                .attr("fill","none")
                .attr("stroke", colors.text_color||"#333")
                .attr("stroke-width",1);
            
            // 5) 在中间放文字
            //   x 取 ( bracketX + bracketWidth + 一点偏移 )，也可取 bracketX + bracketWidth/2
            //   这里示例靠右一点 anchor = start
            g.append("text")
                .attr("x", bracketX + bracketWidth/2)
                .attr("y", midY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", typography.annotation.font_family)
                .style("font-size", typography.annotation.font_size)
                .style("fill", colors.text_color||"#333")
                .text(valueUnit? formatValue(val)+valueUnit : formatValue(val));
        }
    });
    
    // ---------- 10.3 添加y轴标签 ----------
    const lastDimension = dimensions[dimensions.length - 1];
    const lastBarY = yScale(lastDimension) + yScale.bandwidth();
    const yAxisLabel = dataColumns.length > 1 ? dataColumns[1].name : "";
    
    const yAxisLabelElement = svg.append("text")
        .attr("x", margin.left + iconRightPadding)
        .attr("y", margin.top + lastBarY + 40)
        .attr("text-anchor", "start")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .style("fill", colors.text_color || "#333")
        .text(yAxisLabel);
    
    const yAxisLabelWidth = yAxisLabelElement.node().getComputedTextLength();
    const yAxisLabelX = margin.left + iconRightPadding;
    const yAxisLabelY = margin.top + lastBarY + 40;
    
    // ---------- 10.4 添加图例 ----------
    const legendStartX = yAxisLabelX + yAxisLabelWidth + 200;
    const legendWidth = width - legendStartX - 20;
    const legendY = yAxisLabelY - 15;
    
    const legendG = svg.append("g")
        .attr("transform", `translate(${legendStartX}, ${legendY})`);
    
    legendG.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", legendWidth)
        .attr("height", 10)
        .attr("fill", "#f5f5f5")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1)
        .attr("rx", 3)
        .attr("ry", 3);
    
    const legendItemWidth = legendWidth / groups.length;
    const maxFontSize = 14; 
    let commonFontSize = maxFontSize;
    
    groups.forEach(group => {
        let textFits = false;
        let fontSize = maxFontSize;
        while (!textFits && fontSize > 6) {
            const textWidth = getTextWidth(
                group.toUpperCase(),
                typography.annotation.font_family,
                `${fontSize}px`,
                typography.annotation.font_weight
            );
            if (textWidth <= legendItemWidth * 0.9) {
                textFits = true;
            } else {
                fontSize -= 0.5;
            }
        }
        commonFontSize = Math.min(commonFontSize, fontSize);
    });
    
    groups.forEach((group, i) => {
        const itemX = i * legendItemWidth;
        
        legendG.append("rect")
            .attr("x", itemX)
            .attr("y", 0)
            .attr("width", legendItemWidth)
            .attr("height", 10)
            .attr("fill", getGroupColor(group));
        
        legendG.append("text")
            .attr("x", itemX + legendItemWidth / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .style("font-family", typography.annotation.font_family)
            .style("font-size", `${commonFontSize}px`)
            .style("font-weight", typography.annotation.font_weight)
            .style("fill", colors.text_color || "#333")
            .text(group.toUpperCase());
    });
    
    return svg.node();
}

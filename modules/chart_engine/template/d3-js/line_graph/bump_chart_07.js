/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Bump Chart",
    "chart_name": "bump_chart_07",
    "is_composite": false,
    "chart_for": "comparison",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [
        [4, 12],
        [0, "inf"],
        [3, 10]
    ],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": ["spacing"],
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



function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 获取颜色
    const getColor = (group) => {
        return colors.field && colors.field[group] ? colors.field[group] : (colors.other ? colors.other.primary : "#888");
    };
    
    // 帮助函数：将组名转换为CSS安全的类名
    const makeClassSafe = (str) => {
        return str.toString().replace(/[^a-z0-9]/gi, '_');
    };
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 设置尺寸和边距 - 右侧留出更多空间用于标签
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 180, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值和X值
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const xValues = [...new Set(chartData.map(d => d[xField]))].sort();
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表组
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, innerWidth);
    
    
    // 1. 计算每个x下各group的排名
    // 构建排名数据结构：{ group1: [{x, rank}], group2: ... }
    const rankData = {};
    xValues.forEach(x => {
        // 取出该x下所有group的数据
        const items = chartData.filter(d => d[xField] === x);
        // 按yField降序排序（y越大排名越高）
        items.sort((a, b) => b[yField] - a[yField]);
        items.forEach((d, i) => {
            if (!rankData[d[groupField]]) rankData[d[groupField]] = [];
            rankData[d[groupField]].push({
                x: d[xField],
                rank: i + 1, // 排名从1开始
                value: d[yField]
            });
        });
    });

    // 2. y轴比例尺：排名（1在顶部）
    const yScale = d3.scaleLinear()
        .domain([1, groups.length])
        .range([0, innerHeight]);

    // 计算y值的范围用于缩放正方形大小
    const yValues = chartData.map(d => d[yField]);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const sizeScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([10, 60]); // 正方形边长范围从10到60

    // 计算颜色亮度的函数
    const getLuminance = (color) => {
        const rgb = d3.color(color).rgb();
        return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    };

    // 3. 绘制线条
    groups.forEach(group => {
        // 处理特殊字符，确保选择器有效
        const safeGroupClass = makeClassSafe(group);
        const groupRanks = rankData[group];
        
        // 检查是否有数据
        if (groupRanks && groupRanks.length > 0) {
            g.append("path")
                .datum(groupRanks)
                .attr("fill", "none")
                .attr("stroke", getColor(group))
                .attr("stroke-width", 3)
                .attr("d", d3.line()
                    .x(d => xScale(parseDate(d.x)))
                    .y(d => yScale(d.rank))
                );
            
            // 绘制每个点的正方形
            g.selectAll(`.dot-${safeGroupClass}`)
                .data(groupRanks)
                .enter()
                .append("rect")
                .attr("class", `dot-${safeGroupClass}`)
                .attr("x", d => xScale(parseDate(d.x)) - sizeScale(d.value)/2)
                .attr("y", d => yScale(d.rank) - sizeScale(d.value)/2)
                .attr("width", d => sizeScale(d.value))
                .attr("height", d => sizeScale(d.value))
                .attr("fill", getColor(group))
                .attr("stroke", "#fff")
                .attr("stroke-width", 2);

            // 添加数值标签
            g.selectAll(`.label-${safeGroupClass}`)
                .data(groupRanks)
                .enter()
                .append("text")
                .attr("class", `label-${safeGroupClass}`)
                .attr("x", d => xScale(parseDate(d.x)))
                .attr("y", d => {
                    const size = sizeScale(d.value);
                    return size < 20 ? yScale(d.rank) - size/2 - 5 : yScale(d.rank);
                })
                .attr("text-anchor", "middle")
                .attr("dy", d => {
                    const size = sizeScale(d.value);
                    return size < 20 ? "0" : "0.35em";
                })
                .attr("font-size", "12px")
                .attr("fill", d => {
                    const size = sizeScale(d.value);
                    if (size < 20) {
                        return "#000"; // 小正方形外的标签使用黑色
                    } else {
                        // 大正方形内的标签根据背景亮度选择颜色
                        const luminance = getLuminance(getColor(group));
                        return luminance > 0.5 ? "#000" : "#fff";
                    }
                })
                .attr("font-weight", "bold")
                .text(d => Math.round(d.value));
        }
    });

    // 4. 绘制y轴标签（排名）
    const yAxisG = g.append("g");


    // 5. 绘制group标签和三角形标记
    // 首先计算所有group标签的宽度
    const tempText = g.append("text")
        .attr("font-size", 18)
        .attr("font-weight", "bold");
    
    const groupWidths = groups.map(group => {
        tempText.text(group);
        return tempText.node().getComputedTextLength();
    });
    tempText.remove();
    
    const maxGroupWidth = Math.max(...groupWidths);
    const triangleWidth = 10; // 三角形宽度
    const padding = 5; // 标签之间的间距

    // 计算三角形的位置（固定在图表左侧）
    const triangleX = -margin.left + 20;
    
    // 计算group标签的位置（左对齐，以最长的为基准）
    const groupX = triangleX - maxGroupWidth - padding;
    
    // 计算rank标签的位置（在group标签左侧）
    const rankX = groupX - 30; // rank标签固定宽度

    // 绘制三角形和标签
    groups.forEach((group, i) => {
        // 检查group是否有数据
        if (rankData[group] && rankData[group].length > 0) {
            const first = rankData[group][0];
            
            // 添加三角形标记（指向右侧）
            g.append("path")
                .attr("d", "M0,-5 L10,0 L0,5 Z")
                .attr("transform", `translate(${triangleX},${yScale(first.rank)})`)
                .attr("fill", getColor(group));
                
            // 添加group标签
            g.append("text")
                .attr("x", groupX)
                .attr("y", yScale(first.rank) + 5)
                .attr("text-anchor", "start")
                .attr("font-weight", "bold")
                .attr("font-size", 18)
                .attr("fill", getColor(group))
                .text(group);
                
            // 添加rank标签
            g.append("text")
                .attr("x", rankX)
                .attr("y", yScale(first.rank) + 5)
                .attr("text-anchor", "end")
                .attr("font-weight", "bold")
                .attr("font-size", 16)
                .text(i + 1);
        }
    });

    // 6. 在顶部添加时间标签，避免标签重叠
    
    // 创建临时文本元素，用于计算标签宽度
    const tempTimeLabel = g.append("text")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("opacity", 0);

    // 计算每个标签的宽度
    const labelWidths = xTicks.map(d => {
        tempTimeLabel.text(xFormat(d));
        return tempTimeLabel.node().getComputedTextLength();
    });
    
    tempTimeLabel.remove();
    
    // 确定最小标签间距
    const minLabelSpacing = 15; // 最小间距（像素）
    
    // 检测标签是否会重叠并减少数量
    function filterLabels(ticks, widths) {
        if (ticks.length <= 2) return ticks; // 如果只有2个或更少的标签，保留全部
        
        // 计算每个标签的左右边缘位置
        const positions = ticks.map((d, i) => {
            const center = xScale(d);
            const width = widths[i];
            return {
                tick: d,
                center: center,
                left: center - width/2,
                right: center + width/2,
                width: width
            };
        });
        
        // 初始设置所有标签为显示
        positions.forEach(p => p.show = true);
        
        // 从左到右检查标签重叠
        for (let i = 0; i < positions.length - 1; i++) {
            if (positions[i].show) {
                // 检查当前标签和下一个标签是否重叠
                for (let j = i + 1; j < positions.length; j++) {
                    if (positions[j].show && positions[i].right + minLabelSpacing > positions[j].left) {
                        // 重叠，隐藏间隔标签
                        if (j - i === 1) {
                            // 相邻标签重叠，保留第一个和最后一个，隐藏其他
                            if (i > 0 && i < positions.length - 1) {
                                positions[i].show = false;
                            } else if (j < positions.length - 1) {
                                positions[j].show = false;
                            }
                        } else {
                            // 非相邻标签重叠，隐藏中间标签
                            for (let k = i + 1; k < j; k++) {
                                positions[k].show = false;
                            }
                        }
                    }
                }
            }
        }
        
        // 至少确保第一个和最后一个标签显示
        if (positions.length > 0) {
            positions[0].show = true;
            positions[positions.length - 1].show = true;
        }
        
        // 返回要显示的标签
        return positions.filter(p => p.show).map(p => p.tick);
    }
    
    // 获取过滤后的标签
    const filteredTicks = filterLabels(xTicks, labelWidths);
    
    // 绘制过滤后的时间标签
    g.selectAll(".time-label")
        .data(filteredTicks)
        .enter()
        .append("text")
        .attr("class", "time-label")
        .attr("x", d => xScale(d))
        .attr("y", -50)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text(d => xFormat(d));

    return svg.node();
} 
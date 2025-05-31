// 解析日期
const parseDate = d => {
    if (d instanceof Date) return d;
    if (typeof d === 'number') return new Date(d, 0, 1);
    if (typeof d === 'string') {
        const parts = d.split('-');
        
        // YYYY-MM-DD 格式
        if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            return new Date(year, month, day);
        }
        
        // YYYY-MM 格式
        if (parts.length === 2) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            return new Date(year, month, 1);
        }
        
        // YYYY 格式
        if (parts.length === 1 && /^\d{4}$/.test(parts[0])) {
            const year = parseInt(parts[0]);
            return new Date(year, 0, 1);
        }
    }
    return new Date();
};

// 创建智能日期比例尺和刻度
const createXAxisScaleAndTicks = (data, xField, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
    // 解析所有日期
    const dates = data.map(d => parseDate(d[xField]));
    const xExtent = d3.extent(dates);
    const xRange = xExtent[1] - xExtent[0];
    const xPadding = xRange * padding;
    
    // 创建比例尺
    const xScale = d3.scaleTime()
        .domain([
            new Date(xExtent[0].getTime() - xPadding),
            new Date(xExtent[1].getTime() + xPadding)
        ])
        .range([rangeStart, rangeEnd]);
    
    // 计算日期跨度（毫秒）
    const timeSpan = xExtent[1] - xExtent[0];
    const daySpan = timeSpan / (1000 * 60 * 60 * 24);
    const monthSpan = daySpan / 30;
    const yearSpan = daySpan / 365;
    
    // 根据跨度选择合适的时间间隔
    let timeInterval;
    let formatFunction;
    
    if (yearSpan > 35) {
        // 超过35年，每10年一个刻度
        timeInterval = d3.timeYear.every(10);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 15) {
        // 超过15年，每5年一个刻度
        timeInterval = d3.timeYear.every(5);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 7) {
        // 超过7年，每2年一个刻度  
        timeInterval = d3.timeYear.every(2);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 2) {
        // 2-7年，每年一个刻度
        timeInterval = d3.timeYear.every(1);
        formatFunction = d => d3.timeFormat("%Y")(d);
    } else if (yearSpan > 1) {
        // 1-2年，每季度一个刻度
        timeInterval = d3.timeMonth.every(3);
        formatFunction = d => {
            const month = d.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            return `${d.getFullYear().toString().slice(-2)}Q${quarter}`;
        };
    } else if (monthSpan > 6) {
        // 6个月-1年，每月一个刻度
        timeInterval = d3.timeMonth.every(1);
        formatFunction = d => d3.timeFormat("%m %Y")(d);
    } else if (monthSpan > 2) {
        // 2-6个月，每周一个刻度
        timeInterval = d3.timeWeek.every(1);
        formatFunction = d => d3.timeFormat("%d %m")(d);
    } else {
        // 少于2个月，每天一个刻度或每几天一个刻度
        const dayInterval = Math.max(1, Math.ceil(daySpan / 10));
        timeInterval = d3.timeDay.every(dayInterval);
        formatFunction = d => d3.timeFormat("%d %m")(d);
    }
    
    // 生成刻度
    const xTicks = xScale.ticks(timeInterval);
    
    // 确保包含最后一个日期
    if (xTicks.length > 0 && xTicks[xTicks.length - 1] < xExtent[1]) {
        if (xTicks.length > 7) {
            xTicks.pop(); // 先移除当前最后一个刻度
        }
        xTicks.push(xExtent[1]); // 添加数据的最后一个日期作为刻度
    }
    
    return {
        xScale: xScale,
        xTicks: xTicks,
        xFormat: formatFunction,
        timeSpan: {
            days: daySpan,
            months: monthSpan,
            years: yearSpan
        }
    };
};


const createNumericalFormatter = (data, yField) => {
    const yExtent = d3.extent(data, d => d[yField]);
    const yRange = yExtent[1] - yExtent[0];
    const yPadding = yRange * 0.05;

    if (yRange > 1000000000) {
        return d => d3.format(".2f")(d / 1000000000) + "B";
    } else if (yRange > 1000000) {
        return d => d3.format(".2f")(d / 1000000) + "M";
    } else if (yRange > 1000) {
        return d => d3.format(".2f")(d / 1000) + "K";
    } else {
        return d => d3.format(".2f")(d);
    }
}



/**
 * 根据数据点数量计算需要显示标签的点的索引
 * @param {number} n - 数据点总数
 * @returns {number[]} - 需要显示标签的点的索引数组
 */
const sampleLabels = (n) => {
    // 少于10个点时显示所有标签
    if (n <= 10) {
        return Array.from({length: n}, (_, i) => i);
    }
    
    // 超过10个点时每隔 n/10 个点显示一个标签
    const step = Math.ceil(n / 10);
    const result = [];
    
    // 从0开始,每隔step个点取一个索引
    for (let i = 0; i < n; i += step) {
        result.push(i);
    }
    
    // 确保包含最后一个点
    if (result[result.length - 1] !== n - 1) {
        result.push(n - 1);
    }
    
    return result;
};


const temporalFilter = (data, field) => {
    // 把data中不是temporal的点删除
    return data.filter(d => {
        try {
            parseDate(d[field]);
            return true;
        } catch (e) {
            return false;
        }
    });
}


/**
 * 计算文本在指定字体大小下的实际渲染宽度
 * @param {string} text - 要测量的文本
 * @param {number} fontSize - 字体大小(px)
 * @returns {number} - 文本宽度(px)
 */
const getTextWidth = (text, fontSize) => {
    // 创建临时canvas用于测量
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // 设置字体
    context.font = `${fontSize}px Arial`;
    
    // 测量文本宽度
    const metrics = context.measureText(text);
    const width = metrics.width;
    
    // 删除canvas元素
    canvas.remove();
    
    return width;
};

/**
 * 智能排版图例，将多个图例元素自动排布成多行
 * @param {Object} g - D3 选择的 SVG 组元素，用于放置图例
 * @param {Array} groups - 组名数组
 * @param {Object} colors - 颜色对象，包含 field 属性
 * @param {Object} options - 配置选项
 * @param {number} options.maxWidth - 每行最大宽度
 * @param {number} options.x - 图例起始 x 坐标
 * @param {number} options.y - 图例起始 y 坐标
 * @param {number} options.itemHeight - 每个图例项的高度
 * @param {number} options.itemSpacing - 图例项之间的水平间距
 * @param {number} options.rowSpacing - 行之间的垂直间距
 * @param {number} options.symbolSize - 图例符号大小
 * @param {string} options.textColor - 文本颜色
 * @param {number} options.fontSize - 字体大小
 * @param {string} options.fontWeight - 字体粗细
 * @param {string} options.align - 对齐方式：'left', 'center', 'right'
 * @param {string} options.shape - 图例形状：'circle', 'rect', 'line'
 * @returns {Object} 包含图例尺寸信息的对象 {width, height}
 */
const layoutLegend = (g, groups, colors, options = {}) => {
    // 默认选项
    const defaults = {
        maxWidth: 500,
        x: 0,
        y: 0,
        itemHeight: 20,
        itemSpacing: 20,
        rowSpacing: 10,
        symbolSize: 10,
        textColor: "#333",
        fontSize: 12,
        fontWeight: "normal",
        align: "left",
        shape: "circle" // 默认形状为圆形
    };
    
    // 合并选项
    const opts = {...defaults, ...options};
    
    // 创建临时文本元素测量文本宽度
    const tempText = g.append("text")
        .attr("visibility", "hidden")
        .style("font-size", `${opts.fontSize}px`)
        .style("font-weight", opts.fontWeight);
    
    // 计算每个图例项的宽度
    const itemWidths = groups.map(group => {
        tempText.text(group);
        // 符号宽度 + 文本宽度 + 间距
        return opts.symbolSize * 2 + tempText.node().getComputedTextLength() + 5;
    });
    
    // 移除临时文本
    tempText.remove();
    
    // 排布图例项到多行
    const rows = [];
    let currentRow = [];
    let currentRowWidth = 0;
    
    itemWidths.forEach((width, i) => {
        // 如果当前行为空或添加此项后不超过最大宽度，则添加到当前行
        if (currentRow.length === 0 || currentRowWidth + width + opts.itemSpacing <= opts.maxWidth) {
            currentRow.push(i);
            currentRowWidth += width + (currentRow.length > 1 ? opts.itemSpacing : 0);
        } else {
            // 否则开始新行
            rows.push(currentRow);
            currentRow = [i];
            currentRowWidth = width;
        }
    });
    
    // 添加最后一行
    if (currentRow.length > 0) {
        rows.push(currentRow);
    }
    
    // 计算总高度和最大行宽
    const totalHeight = rows.length * opts.itemHeight + (rows.length - 1) * opts.rowSpacing;
    const maxRowWidth = Math.max(...rows.map(row => {
        return row.reduce((sum, i, idx) => {
            return sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0);
        }, 0);
    }));
    
    // 绘制图例
    rows.forEach((row, rowIndex) => {
        // 计算行起始位置（根据对齐方式）
        const rowWidth = row.reduce((sum, i, idx) => {
            return sum + itemWidths[i] + (idx > 0 ? opts.itemSpacing : 0);
        }, 0);
        
        let rowStartX;
        if (opts.align === "center") {
            rowStartX = opts.x + (opts.maxWidth - rowWidth) / 2;
        } else if (opts.align === "right") {
            rowStartX = opts.x + opts.maxWidth - rowWidth;
        } else {
            rowStartX = opts.x;
        }
        
        // 绘制当前行的图例项
        let currentX = rowStartX;
        row.forEach(i => {
            const group = groups[i];
            const color = colors.field && colors.field[group] 
                ? colors.field[group] 
                : d3.schemeCategory10[i % 10]; // 备用颜色
                
            const legendGroup = g.append("g")
                .attr("transform", `translate(${currentX}, ${opts.y + rowIndex * (opts.itemHeight + opts.rowSpacing)})`);
            
            // 绘制图例符号
            if (opts.shape === "circle") {
                legendGroup.append("circle")
                    .attr("cx", opts.symbolSize / 2)
                    .attr("cy", opts.itemHeight / 2)
                    .attr("r", opts.symbolSize / 2)
                    .attr("fill", color);
            } else if (opts.shape === "rect") {
                legendGroup.append("rect")
                    .attr("x", 0)
                    .attr("y", opts.itemHeight / 2 - opts.symbolSize / 2)
                    .attr("width", opts.symbolSize)
                    .attr("height", opts.symbolSize)
                    .attr("fill", color);
            } else if (opts.shape === "line") {
                legendGroup.append("line")
                    .attr("x1", 0)
                    .attr("y1", opts.itemHeight / 2)
                    .attr("x2", opts.symbolSize)
                    .attr("y2", opts.itemHeight / 2)
                    .attr("stroke", color)
                    .attr("stroke-width", 4);
            } else {
                // 默认为圆形
                legendGroup.append("circle")
                    .attr("cx", opts.symbolSize / 2)
                    .attr("cy", opts.itemHeight / 2)
                    .attr("r", opts.symbolSize / 2)
                    .attr("fill", color);
            }
            
            // 绘制图例文本
            legendGroup.append("text")
                .attr("x", opts.symbolSize * 1.5)
                .attr("y", opts.itemHeight / 2)
                .attr("dominant-baseline", "middle")
                .attr("fill", opts.textColor)
                .style("font-size", `${opts.fontSize}px`)
                .style("font-weight", opts.fontWeight)
                .text(group);
            
            // 更新 x 位置
            currentX += itemWidths[i] + opts.itemSpacing;
        });
    });
    
    // 返回图例尺寸信息
    return {
        width: maxRowWidth,
        height: totalHeight
    };
};

const formatValue = (value) => {
    if (value >= 1000000000) {
        return d3.format("~g")(value / 1000000000) + "B";
    } else if (value >= 1000000) {
        return d3.format("~g")(value / 1000000) + "M";
    } else if (value >= 1000) {
        return d3.format("~g")(value / 1000) + "K";
    } else {
        console.log("formatValue", value, d3.format("~g")(value));
        return d3.format("~g")(value);
    }
}
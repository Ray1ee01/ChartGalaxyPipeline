/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Stacked Area Chart",
    "chart_name": "stacked_area_chart_icons_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
    "required_fields_range": [[5, 50], [0, "inf"], [2, 10]],
    "required_fields_icons": ["group"],
    "required_other_icons": [],
    "required_fields_colors": ["group"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 600,
    "min_width": 800,
    "background": "dark",
    "icon_mark": "overlay",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // 提取数据
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors_dark || {};
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;
    
    // 获取唯一的组值并按平均值排序
    const groups = [...new Set(chartData.map(d => d[groupField]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartData.filter(d => d[groupField] === a), d => d[yField]);
            const avgB = d3.mean(chartData.filter(d => d[groupField] === b), d => d[yField]); 
            return avgA - avgB; // 从小到大排序
        });
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 20, right: 60, bottom: 40, left: 80 }; // 增加左边距为Y轴留出空间
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const { xScale, xTicks, xFormat, timeSpan } = createXAxisScaleAndTicks(chartData, xField, 0, chartWidth);
    
    // 为堆叠数据准备
    // 使用 d3.group
    const groupedData = d3.group(chartData, d => d[xField]);
    
    // 转换为堆叠格式
    const stackData = Array.from(groupedData, ([key, values]) => {
        const obj = { date: parseDate(key) };
        values.forEach(v => {
            obj[v[groupField]] = v[yField];
        });
        return obj;
    });
    
    // 确保所有组都有值（如果某些时间点缺少某组的数据，填充为0）
    stackData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) {
                d[group] = 0;
            }
        });
    });
    
    // 按日期排序
    stackData.sort((a, b) => a.date - b.date);
    
    // 创建堆叠生成器
    const stack = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);
    
    // 生成堆叠数据
    const stackedData = stack(stackData);
    
    // 创建y轴比例尺 (堆叠总和)
    const yMax = d3.max(stackedData[stackedData.length - 1], d => d[1]) * 1.1;
    const yScale = d3.scaleLinear()
        .domain([0, yMax])
        .range([chartHeight, 0]);
    
    // 添加Y轴
    const yTicks = yScale.ticks(5);
    
    // 添加网格线
    yTicks.forEach(tick => {
        g.append("line")
            .attr("x1", 0)
            .attr("y1", yScale(tick))
            .attr("x2", chartWidth)
            .attr("y2", yScale(tick))
            .attr("stroke", "#ffffff")
            .attr("stroke-opacity", 0.1);
    });
    
    // 添加刻度文本
    yTicks.forEach(tick => {
        g.append("text")
            .attr("x", -10)
            .attr("y", yScale(tick))
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .attr("fill", "#cccccc")
            .attr("font-size", "12px")
            .text(d3.format(".1s")(tick));
    });
    
    // 添加x轴刻度和标签
    xTicks.forEach((tick, i) => {
        // 添加刻度标签
        g.append("text")
            .attr("x", xScale(tick))
            .attr("y", chartHeight + 25)
            .attr("text-anchor", "start")
            .style("font-family", "Arial")
            .style("font-size", "16px")
            .style("fill", "#cccccc")
            .text(xFormat(tick));
    });
    
    // 创建面积生成器
    const area = d3.area()
        .x(d => xScale(d.data.date))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(d3.curveLinear); // 使用折线
    
    console.log("images: ", images);

    // 绘制堆叠面积图
    stackedData.forEach((d, i) => {
        const group = d.key;
        
        console.log("group: ", group);
        
        g.append("path")
            .datum(d)
            .attr("fill", colors.field[group])
            .attr("d", area);
            
        // 将x轴分成10像素宽的网格
        const gridSize = 10;
        const numGrids = Math.floor(chartWidth / gridSize);
        let gridWidths = [];
        
        // 计算每个网格位置对应的区域宽度
        for (let gridIdx = 0; gridIdx < numGrids; gridIdx++) {
            const gridX = gridIdx * gridSize;
            const gridDate = xScale.invert(gridX);
            
            // 找到插值的两个数据点
            let leftIdx = 0;
            let rightIdx = 0;
            
            for (let j = 0; j < d.length - 1; j++) {
                if (d[j].data.date <= gridDate && d[j + 1].data.date >= gridDate) {
                    leftIdx = j;
                    rightIdx = j + 1;
                    break;
                }
            }
            
            // 计算插值比例
            const leftDate = d[leftIdx].data.date;
            const rightDate = d[rightIdx].data.date;
            const ratio = (gridDate - leftDate) / (rightDate - leftDate);
            
            // 对上下边界进行插值
            const y0 = d3.interpolateNumber(d[leftIdx][0], d[rightIdx][0])(ratio);
            const y1 = d3.interpolateNumber(d[leftIdx][1], d[rightIdx][1])(ratio);
            
            gridWidths.push({
                gridIdx: gridIdx,
                gridX: gridX,
                dataIdx: leftIdx,
                y0: yScale(y0),
                y1: yScale(y1)
            });
        }
        
        // 计算每个网格及其前后5个网格的平均宽度
        let avgWidths = [];
        for (let i = 5; i < gridWidths.length - 5; i++) {
            let curY0 = gridWidths[i].y0;
            let curY1 = gridWidths[i].y1;

            let sum = curY0 - curY1;
            let count = 11;

            for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                if (gridWidths[j].y0 < curY0) {
                    curY0 = gridWidths[j].y0;
                }
                if (gridWidths[j].y1 > curY1) {
                    curY1 = gridWidths[j].y1;
                }
                sum += curY0 - curY1;
            }

            curY0 = gridWidths[i].y0;
            curY1 = gridWidths[i].y1;

            for (let j = i + 1; j <= Math.min(gridWidths.length - 1, i + 5); j++) {
                if (gridWidths[j].y0 < curY0) {
                    curY0 = gridWidths[j].y0;
                }
                if (gridWidths[j].y1 > curY1) {
                    curY1 = gridWidths[j].y1;
                }
                sum += curY0 - curY1;
            }
            
            avgWidths.push({
                gridIdx: gridWidths[i].gridIdx,
                gridX: gridWidths[i].gridX,
                avgWidth: sum / count,
                dataIdx: gridWidths[i].dataIdx
            });
        }
        
        // 找到平均宽度最大的网格
        let maxAvgWidth = 0;
        let bestGridIdx = 0;
        
        for (let i = avgWidths.length / 2; i < avgWidths.length - 1; i++) {
            const gain = avgWidths[i].avgWidth + 0.1 * i;
            if (gain > maxAvgWidth) {
                maxAvgWidth = gain;
                bestGridIdx = i;
            }
        }
        
        // 使用找到的最佳位置
        const bestGrid = avgWidths[bestGridIdx];
        const areaHeight = bestGrid.avgWidth;
        const minHeightForImage = 70; // 显示图像的最小高度
        
        // 计算标签位置
        const labelX = bestGrid.gridX;
        // 对labelX处的y0和y1进行插值计算
        const y0 = gridWidths[bestGridIdx].y0; // labelX处的上边界
        const y1 = gridWidths[bestGridIdx].y1; // labelX处的下边界
        let labelY = y0 + (y1 - y0) * 0.5; // 取中点位置

        console.log(`Group: ${group}, bestAvgWidth: ${maxAvgWidth}, at grid: ${bestGridIdx}, x: ${labelX}`);
        
        // 如果区域足够大且有图像，添加图像并调整标签位置
        if (areaHeight >= minHeightForImage && images.field && images.field[group]) {
            console.log("Can place image for group: ", group);
            const imgSize = 60;
            labelY += 25; // 标签下移20像素
            
            g.append("image")
                .attr("x", labelX - imgSize/2)
                .attr("y", labelY - imgSize - 5) // 放在文本上方
                .attr("width", imgSize)
                .attr("height", imgSize)
                .attr("xlink:href", images.field[group])
                .style("pointer-events", "none"); // 防止干扰鼠标事件
        }

        //添加组名标签
        g.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Arial")
            .style("font-size", "14px")
            .style("fill", "#ffffff")
            .style("opacity", 0.8)
            .text(group);
    });
    
    // 添加Y轴标题
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -chartHeight / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffffff")
        .style("font-size", "14px")
        .text(yField);
    
    return svg.node();
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Voronoi Treemap(Circle)",
    "chart_name": "voronoi_treemap_circle_01_dark",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[5, 40], [0, "inf"]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "dark",
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
    const colors = jsonData.colors_dark || { 
        text_color: "#000000", 
        other: { primary: "#4682B4", secondary: "#FF7F50" } 
    }; 
    const dataColumns = jsonData.data.columns || [];
    const images = jsonData.images || {};
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const categoryField = dataColumns[0].name;
    const valueField = dataColumns[1].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 准备数据
    const processedData = chartData.map(d => ({
        name: d[categoryField],
        weight: d[valueField]
    }));
    
    // 创建颜色比例尺
    const colorScale = d => {
        if (colors.field && colors.field[d]) {
            return colors.field[d];
        }
        const uniqueCategories = [...new Set(chartData.map(d => d[categoryField]))];
        return d3.schemeTableau10[uniqueCategories.indexOf(d) % 10];
    };
    
    // 计算圆形裁剪区域
    const radius = Math.min(chartWidth, chartHeight) / 2;
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;
    
    // 创建圆形裁剪多边形 - 使用多边形近似圆形
    const numPoints = 50;
    const clip = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        clip.push([
            centerX + radius * Math.cos(angle),
            centerY + radius * Math.sin(angle)
        ]);
    }
    
    // 创建 Voronoi Map 模拟
    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clip)
        .stop();
    
    // 运行模拟直到结束 - 限制迭代次数以避免超时
    let state = simulation.state();
    let iterations = 0;
    const maxIterations = 300; // 限制最大迭代次数
    
    while (!state.ended && iterations < maxIterations) {
        simulation.tick();
        state = simulation.state();
        iterations++;
    }
    
    // 获取最终的多边形
    const polygons = state.polygons;
    
    // 绘制多边形
    const cells = g.selectAll("g.cell")
        .data(polygons)
        .enter()
        .append("g")
        .attr("class", "cell");
    
    // 添加单元格
    cells.append("path")
        .attr("d", d => {
            return "M" + d.join("L") + "Z";
        })
        .attr("fill", d => {
            try {
                return colorScale(d.site.originalObject.data.originalData.name);
            } catch (e) {
                console.error("Error accessing color data:", e);
                return "#ccc"; // 默认颜色
            }
        })
        .attr("fill-opacity", 0.8)
        .attr("stroke", "none")
    
    // 添加文本标签
    cells.append("text")
        .attr("x", d => {
            try {
                return d3.polygonCentroid(d)[0];
            } catch (e) {
                console.error("Error calculating centroid:", e);
                return 0;
            }
        })
        .attr("y", d => {
            try {
                return d3.polygonCentroid(d)[1];
            } catch (e) {
                console.error("Error calculating centroid:", e);
                return 0;
            }
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => {
            try {
                return d.site.originalObject.data.originalData.name;
            } catch (e) {
                console.error("Error accessing name data:", e);
                return "";
            }
        })
        .each(function(d) {
            try {
                // 计算多边形的边界框
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                d.forEach(point => {
                    minX = Math.min(minX, point[0]);
                    minY = Math.min(minY, point[1]);
                    maxX = Math.max(maxX, point[0]);
                    maxY = Math.max(maxY, point[1]);
                });
                
                const boxWidth = maxX - minX;
                const boxHeight = maxY - minY;
                
                // 检查文本是否适合单元格
                const textWidth = this.getComputedTextLength();
                
                if (textWidth > boxWidth * 0.8 || boxHeight < 30) {
                    // 如果文本太长或单元格太小，缩小字体而不是隐藏
                    d3.select(this)
                        .attr("font-size", "10px")
                        .text(function() {
                            const origText = this.textContent;
                            // 如果文本超过10个字符且单元格很小，尝试换行
                            if (origText.length > 10 && boxHeight < 40) {
                                const midPoint = Math.floor(origText.length / 2);
                                // 找到最近的空格或标点符号
                                let breakPoint = midPoint;
                                const punctuation = [' ', '，', '。', '、', ',', '.'];
                                let minDistance = origText.length;
                                
                                for (let i = 0; i < origText.length; i++) {
                                    if (punctuation.includes(origText[i])) {
                                        const distance = Math.abs(i - midPoint);
                                        if (distance < minDistance) {
                                            minDistance = distance;
                                            breakPoint = i;
                                        }
                                    }
                                }
                                
                                // 如果找到合适的断点就换行，否则直接在中间换行
                                if (punctuation.includes(origText[breakPoint])) {
                                    return origText.substring(0, breakPoint + 1) + '\n' + origText.substring(breakPoint + 1);
                                } else {
                                    return origText.substring(0, midPoint) + '\n' + origText.substring(midPoint);
                                }
                            }
                            return origText;
                        })
                        .attr("dy", function() {
                            // 如果文本包含换行符，调整垂直位置
                            return this.textContent.includes('\n') ? "-0.5em" : "0";
                        });
                    
                    // 如果文本包含换行符，创建第二行
                    if (d3.select(this).text().includes('\n')) {
                        const lines = d3.select(this).text().split('\n');
                        d3.select(this).text(lines[0]);
                        
                        // 添加第二行
                        g.append("text")
                            .attr("x", d3.polygonCentroid(d)[0])
                            .attr("y", d3.polygonCentroid(d)[1])
                            .attr("text-anchor", "middle")
                            .attr("dominant-baseline", "middle")
                            .attr("fill", "#fff")
                            .attr("font-size", "10px")
                            .attr("font-weight", "bold")
                            .attr("dy", "1em")
                            .text(lines[1]);
                    }
                }
            } catch (e) {
                console.error("Error in text sizing:", e);
                // 即使出错也不隐藏文本，而是显示小号字体
                d3.select(this).attr("font-size", "8px");
            }
        });
    
    // 添加值标签
    const format = d3.format(",d");
    cells.append("text")
        .attr("x", d => {
            try {
                return d3.polygonCentroid(d)[0];
            } catch (e) {
                return 0;
            }
        })
        .attr("y", d => {
            try {
                // 根据分类标签是否换行来调整位置
                const name = d.site.originalObject.data.originalData.name;
                const offset = name.length > 10 ? 25 : 15;
                return d3.polygonCentroid(d)[1] + offset;
            } catch (e) {
                return 0;
            }
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("fill-opacity", 0.7)
        .attr("font-size", "14px")
        .text(d => {
            try {
                return format(d.site.originalObject.data.originalData.weight);
            } catch (e) {
                console.error("Error accessing weight data:", e);
                return "";
            }
        })
        .each(function(d) {
            try {
                // 计算多边形的边界框
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                d.forEach(point => {
                    minX = Math.min(minX, point[0]);
                    minY = Math.min(minY, point[1]);
                    maxX = Math.max(maxX, point[0]);
                    maxY = Math.max(maxY, point[1]);
                });
                
                const boxWidth = maxX - minX;
                const boxHeight = maxY - minY;
                
                // 检查文本是否适合单元格
                const textWidth = this.getComputedTextLength();
                
                if (textWidth > boxWidth * 0.8 || boxHeight < 40) {
                    // 如果单元格很小，缩小字体而不是隐藏文本
                    d3.select(this)
                        .attr("font-size", "8px")
                        .attr("fill-opacity", 0.9);
                }
            } catch (e) {
                console.error("Error in value sizing:", e);
                // 即使出错也不隐藏文本，而是显示小号字体
                d3.select(this).attr("font-size", "8px");
            }
        });
    
    return svg.node();
} 
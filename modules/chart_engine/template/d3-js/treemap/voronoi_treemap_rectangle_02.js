/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Voronoi Treemap(Rectangle)",
    "chart_name": "voronoi_treemap_rectangle_02",
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[3, 20], [0, "inf"]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "light",
    "icon_mark": "icon",
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
    
    // 定义裁剪多边形（矩形）
    const clip = [
        [0, 0],
        [0, chartHeight],
        [chartWidth, chartHeight],
        [chartWidth, 0]
    ];
    
    // 创建 Voronoi Map 模拟
    const simulation = d3.voronoiMapSimulation(processedData)
        .weight(d => d.weight)
        .clip(clip)
        .stop();
    
    // 运行模拟直到结束
    let state = simulation.state();
    while (!state.ended) {
        simulation.tick();
        state = simulation.state();
    }
    
    // 获取最终的多边形
    const polygons = state.polygons;
    
    // 定义纹理模式
    // 创建纹理定义
    const defs = svg.append("defs");
    
    // 创建几种不同的纹理图案
    const patternTypes = [
        { id: "pattern1", d: "M5,0 l5,10 l-10,0 z" }, // 三角形
        { id: "pattern2", d: "M0,0 l10,0 l0,10 l-10,0 z" }, // 方块
        { id: "pattern3", d: "M0,5 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0" }, // 圆圈
        { id: "pattern4", d: "M0,0 l5,5 l-5,5 z" }, // 另一种三角形
        { id: "pattern5", d: "M0,0 l5,10 l5,-10 z" }  // 菱形
    ];
    
    // 为每个类别创建唯一的纹理
    const uniqueCategories = [...new Set(chartData.map(d => d[categoryField]))];
    uniqueCategories.forEach((category, i) => {
        const color = colorScale(category);
        const patternType = patternTypes[i % patternTypes.length];
        
        // 创建纹理图案
        const pattern = defs.append("pattern")
            .attr("id", `pattern-${category.replace(/\s+/g, '-').toLowerCase()}`)
            .attr("width", 10)
            .attr("height", 10)
            .attr("patternUnits", "userSpaceOnUse")
            .attr("patternTransform", "rotate(45)");
        
        // 背景
        pattern.append("rect")
            .attr("width", 10)
            .attr("height", 10)
            .attr("fill", color)
            .attr("fill-opacity", 0.75);
        
        // 纹理元素
        pattern.append("path")
            .attr("d", patternType.d)
            .attr("fill", "white")
            .attr("fill-opacity", 0.2);
    });
    
    // 绘制多边形
    const cells = g.selectAll("g")
        .data(polygons)
        .enter()
        .append("g");
    
    // 添加单元格
    cells.append("path")
        .attr("d", d => {
            console.log(d.site.originalObject.data.originalData.name);
            return "M" + d.join("L") + "Z";
        })
        .attr("fill", d => {
            const categoryName = d.site.originalObject.data.originalData.name;
            return `url(#pattern-${categoryName.replace(/\s+/g, '-').toLowerCase()})`;
        })
        .attr("stroke", d => colorScale(d.site.originalObject.data.originalData.name))
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.5);
    
    // 为每个单元格添加工具提示
    const format = d3.format(",d");
    
    // 为足够大的区域添加图标
    cells.each(function(d) {
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
        const categoryValue = d.site.originalObject.data.originalData.name;
        
        // 检查区域是否足够大以添加图标（至少50x50）
        if (boxWidth >= 50 && boxHeight >= 50 && images.field && images.field[categoryValue]) {
            const iconSize = 32;
            const centerX = d3.polygonCentroid(d)[0];
            const centerY = d3.polygonCentroid(d)[1] - 15; // 稍微上移，为标签留出空间
            
            d3.select(this).append("image")
                .attr("xlink:href", images.field[categoryValue])
                .attr("x", centerX - iconSize/2)
                .attr("y", centerY - iconSize/2)
                .attr("width", iconSize)
                .attr("height", iconSize);
        }
    });
    
    // 添加文本标签
    cells.append("text")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1] + 20) // 下移标签，为图标留出空间
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(d => d.site.originalObject.data.originalData.name)
        .each(function(d) {
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
                // 如果文本太长或单元格太小，在文本下方添加暗色透明框
                // 创建一个新的g元素来包含背景框和文本
                const textGroup = d3.select(this.parentNode)
                    .append("g")
                    .raise(); // 将整个组提升到最上层
                
                // 添加背景框
                const padding = 4;
                textGroup.append("rect")
                    .attr("x", d3.polygonCentroid(d)[0] - textWidth/2 - padding)
                    .attr("y", d3.polygonCentroid(d)[1] - 10)
                    .attr("width", textWidth + padding * 2)
                    .attr("height", 35)
                    .attr("fill", "rgba(0,0,0,0.3)")
                    .attr("rx", 3);
                
                // 将原始文本移动到新组中
                d3.select(this).remove();
                textGroup.append("text")
                    .attr("x", d3.polygonCentroid(d)[0])
                    .attr("y", d3.polygonCentroid(d)[1])
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .attr("fill", "#fff")
                    .attr("font-size", "16px")
                    .attr("font-weight", "bold")
                    .text(d.site.originalObject.data.originalData.name);
            }
        });
    
    // 添加值标签
    cells.append("text")
        .attr("x", d => d3.polygonCentroid(d)[0])
        .attr("y", d => d3.polygonCentroid(d)[1] + 35) // 进一步下移值标签
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("fill-opacity", 0.7)
        .attr("font-size", "14px")
        .text(d => format(d.site.originalObject.data.originalData.weight))
        .each(function(d) {
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
                // 如果文本太长或单元格太小，隐藏它
                d3.select(this).style("display", "none");
            }
        });
    
    return svg.node();
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Alluvial Diagram",
    "chart_name": "alluvial_diagram_plain_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 10], [0, "inf"], [2, 10]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary"],
    "supported_effects": [],
    "min_height": 400,
    "min_width": 600,
    "background": "light",
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
    
    // 清空容器
    d3.select(containerSelector).html("");
    
    // 获取字段名
    const sourceField = dataColumns[0].name;
    const valueField = dataColumns[1].name;
    const targetField = dataColumns[2].name;
    
    // 设置尺寸和边距
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 140, right: 150, bottom: 140, left: 150 };
    
    // 创建图表区域
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // 创建SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    const g = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 计算类别总值
    const sourceTotals = {}, targetTotals = {};
    chartData.forEach(d => {
        sourceTotals[d[sourceField]] = (sourceTotals[d[sourceField]] || 0) + (+d[valueField]);
        targetTotals[d[targetField]] = (targetTotals[d[targetField]] || 0) + (+d[valueField]);
    });
    
    // 获取唯一类别
    const sourceCategories = [...new Set(chartData.map(d => d[sourceField]))];
    const targetCategories = [...new Set(chartData.map(d => d[targetField]))];
    
    // 颜色配置
    const primaryColor = colors.other?.primary || "#902d1f";
    const secondaryColor = colors.other?.secondary || "#2f6ae4";
    
    // 创建颜色比例尺
    const createColorScale = (baseColor, count) => {
        const lightColor = d3.color(baseColor).brighter(0.5);
        const darkColor = d3.color(baseColor).darker(0.5);
        return d3.scaleLinear().domain([0, count - 1]).range([lightColor, darkColor]).interpolate(d3.interpolateHcl);
    };
    
    const sourceColorScale = createColorScale(primaryColor, sourceCategories.length);
    const targetColorScale = createColorScale(secondaryColor, targetCategories.length);
    
    // 准备节点和链接数据
    const nodes = [
        ...sourceCategories.map((category, i) => ({
            id: category, name: category, type: "source", index: i, colorIndex: i, value: sourceTotals[category]
        })),
        ...targetCategories.map((category, i) => ({
            id: `target_${category}`, name: category, type: "target", 
            index: sourceCategories.length + i, colorIndex: i, value: targetTotals[category]
        }))
    ];
    
    const links = chartData.map(d => ({
        source: d[sourceField], target: `target_${d[targetField]}`, value: +d[valueField],
        sourceCategory: d[sourceField], targetCategory: d[targetField]
    }));
    
    // 创建并计算Sankey布局
    const sankey = d3.sankey()
        .nodeId(d => d.id)
        .nodeWidth(20)
        .nodePadding(10)
        .extent([[0, 0], [chartWidth, chartHeight]])
        .nodeSort((a, b) => {
            if ((a.type === "source" && b.type === "source") || (a.type === "target" && b.type === "target")) {
                return b.value - a.value; // 按值从大到小排序
            }
            return 0;
        });
    
    const { nodes: sankeyNodes, links: sankeyLinks } = sankey({
        nodes: nodes.map(d => Object.assign({}, d)),
        links: links.map(d => Object.assign({}, d))
    });
    
    // 更新节点颜色索引
    const updateColorIndex = (nodeType) => {
        sankeyNodes.filter(d => d.type === nodeType)
            .sort((a, b) => a.y0 - b.y0)
            .forEach((node, i) => { node.colorIndex = i; });
    };
    updateColorIndex("source");
    updateColorIndex("target");
    
    // 创建渐变定义
    const defs = svg.append("defs");
    sankeyLinks.forEach((link, i) => {
        const sourceNode = sankeyNodes.find(n => n.id === link.source.id);
        const targetNode = sankeyNodes.find(n => n.id === link.target.id);
        
        const sourceColor = sourceNode.type === "source" ? sourceColorScale(sourceNode.colorIndex) : targetColorScale(sourceNode.colorIndex);
        const targetColor = targetNode.type === "source" ? sourceColorScale(targetNode.colorIndex) : targetColorScale(targetNode.colorIndex);
        
        const gradientId = `link-gradient-${i}`;
        const gradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", link.source.x1).attr("y1", link.y0)
            .attr("x2", link.target.x0).attr("y2", link.y1);
        
        gradient.append("stop").attr("offset", "0%").attr("stop-color", sourceColor);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", targetColor);
        link.gradientId = gradientId;
    });
    
    // 绘制链接
    g.append("g").attr("class", "other")
        .selectAll("path").data(sankeyLinks).enter().append("path")
        .attr("class", "mark")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => `url(#${d.gradientId})`)
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("fill", "none")
        .attr("stroke-opacity", 0.7);
    
    // 绘制节点
    const node = g.append("g").attr("class", "other").selectAll("g").data(sankeyNodes).enter().append("g");
    
    // 添加节点矩形
    node.append("rect")
        .attr("class", "mark")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0).attr("width", d => d.x1 - d.x0)
        .attr("fill", d => d.type === "source" ? sourceColorScale(d.colorIndex) : targetColorScale(d.colorIndex));
    
    // 添加节点标签
    node.append("text")
        .attr("class", "label")
        .attr("x", d => d.type === "source" ? d.x0 - 8 : d.x1 + 8)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.type === "source" ? "end" : "start")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .text(d => `${d.name} (${d3.format(",")(d.value)})`)
        .attr("fill", d => {
            const baseColor = d.type === "source" ? sourceColorScale(d.colorIndex) : targetColorScale(d.colorIndex);
            return d3.color(baseColor).darker(0.8);
        });
    
    // 添加标题
    svg.append("text")
        .attr("class", "text")
        .attr("x", margin.left).attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px").attr("font-weight", "bold")
        .attr("fill", d3.color(primaryColor).darker(0.5))
        .text(dataColumns[0].label || sourceField);
    
    svg.append("text")
        .attr("class", "text")
        .attr("x", width - margin.right).attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px").attr("font-weight", "bold")
        .attr("fill", d3.color(secondaryColor).darker(0.5))
        .text(dataColumns[2].label || targetField);
    
    return svg.node();
} 
/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Radial Grouped Bar Chart",
    "chart_name": "radial_grouped_bar_plain_chart_03",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[3, 20], [0, 100], [2,2]],
    "required_fields_icons": [],
    "required_other_icons": [],
    "required_fields_colors": [],
    "required_other_colors": ["primary", "secondary", "background"],
    "supported_effects": ["gradient", "opacity"],
    "min_height": 600,
    "min_width": 800,
    "background": "light",
    "icon_mark": "none",
    "icon_label": "none",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    const jsonData = data;
    const chartData = jsonData.data.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    const dataColumns = jsonData.data.columns || [];

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

    // Clear container
    d3.select(containerSelector).html("");
    
    // Get field names
    const xField = dataColumns[0].name;
    const yField = dataColumns[1].name;
    const groupField = dataColumns[2].name;

    // 按groupField分组
    const groupedData = d3.group(chartData, d => d[groupField]);

    let min_x = d3.min(chartData, d => d[xField]);
    let max_x = d3.max(chartData, d => d[xField]);
    let min_y = d3.min(chartData, d => d[yField]);
    let max_y = d3.max(chartData, d => d[yField]);
    let y_range = max_y - min_y;
    min_y = min_y - y_range * 0.1;

    let n_data = 0;
    let group_names = [];
    // 遍历分组数据
    groupedData.forEach((group, groupName) => {
        // 按yField升序排序数据
        group.sort((a, b) => a[yField] - b[yField]);
        n_data = group.length;
        group_names.push(groupName);
    });
    
    // Set dimensions and margins
    const width = variables.width*2;
    const height = variables.height*2;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
    
    // Calculate center point and max radius
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(chartWidth, chartHeight) / 2;
    
    // Create a root group
    const g = svg.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`);

    // 绘制第一个radial bar chart
    let chartRadius = width / 4 - 50;
    let barPadding = 10;
    let nBars = n_data;
    let barWidth = chartRadius / nBars - barPadding;
    
    // group0 data
    const group0Data = groupedData.get(group_names[0]);
    let angle = d3.scaleLinear()
        .domain([min_y, max_y])
        .range([-Math.PI / 4, 3*Math.PI / 4]);

    group0Data.forEach((d, i) => {
        d.radius = (chartRadius-50) / nBars * i + barPadding + 50;
        d.angle = angle(d[yField]);
    });

    // 绘制group0的radial bar chart
    const group0Chart = g.append("g");
    let rAxis = group0Chart.append("g");
    rAxis.selectAll("path")
        .data(group0Data)
        .join(enter =>
            enter.append('path')
                .attr('d', d => {
                    const radius = d.radius + barWidth;
                    return d3.arc()({
                        innerRadius: radius,
                        outerRadius: radius + 1,
                        startAngle: -Math.PI / 4,
                        endAngle: 3 * Math.PI / 4
                    });
                })
                .attr('fill', 'none')
                .style('stroke', 'silver')
                .style('stroke-width', '1px')
        );

    let coord = (value, radius) => {
        let a = Math.PI / 4;
        let x = Math.cos(a) * radius;
        let y = Math.sin(a) * radius;
        return { x: x, y: y };
    }
    
    let arc = d3.arc()
        .innerRadius(d => d.radius)
        .outerRadius(d => d.radius + barWidth)
        .startAngle(-Math.PI / 4)
        .endAngle(d => d.angle)
        .cornerRadius(20);
    
    let bars = group0Chart.append('g');
    bars.selectAll('path')
        .data(group0Data)
        .join(enter => enter.append('path')
        .style('fill', (d, i) => {
            const colorScale = d3.scaleLinear()
                .domain([0, group0Data.length - 1])
                .range(['#335541','#e6e7a2']);
            return colorScale(i);
        })
        .attr('d', d => arc(d))
        .attr('stroke-linecap', 'round'));
    
    // 首先，为第一组添加路径和文本路径
    group0Data.forEach((d, i) => {
        // 创建一个用于文本的路径
        const textPathId = `textPath-group0-${i}`;
        
        // 创建一个看不见的路径用于定位文本
        const textPathAngle = d.angle;
        const textPathRadius = d.radius + barWidth / 2;
        let textContent = d[xField] + " / " + formatValue(d[yField]);
        let actual_length = textContent.length * 14
        let shift_angle = actual_length/textPathRadius/2
        // 创建一个弧形路径
        const textPath = group0Chart.append("path")
            .attr("id", textPathId)
            .attr("d", () => {
                return d3.arc()({
                    innerRadius: textPathRadius,
                    outerRadius: textPathRadius,
                    startAngle: 3*Math.PI/4 - shift_angle,  // 起始角度
                    endAngle: 3*Math.PI/4    // 结束角度
                });
            })
            .style("fill", "none")
            .style("stroke", "none");  // 让路径不可见
        
        // 添加沿路径的文本
        const text = group0Chart.append("text")
            .attr("dy", -5)  // 微调文本位置
            .attr("font-size", "14px")
            .attr("fill", "#333");
        
        text.append("textPath")
            .attr("xlink:href", `#${textPathId}`)
            .attr("startOffset", "75%")  // 控制文本开始的位置，50%表示中间
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(`${d[xField]} / ${formatValue(d[yField])}`);
    });

    // 首先，为第一组添加路径和文本路径
    group0Data.forEach((d, i) => {
        const text = group0Chart.append("text")
            .attr("x", () => {
                x = Math.cos(-3*Math.PI/4 + 0.03) * (d.radius + barWidth/2);
                return x;
            })
            .attr("y", () => {
                y = Math.sin(-3*Math.PI/4 + 0.03) * (d.radius + barWidth/2);
                return y;
            })
            .attr("fill", "#ffffff")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(i);
    });



    // 对称地绘制group1的radial bar chart
    angle = d3.scaleLinear()
        .domain([min_y, max_y])
        .range([3*Math.PI / 4, 7*Math.PI / 4]);

        
    const group1Data = groupedData.get(group_names[1]);
    group1Data.forEach((d, i) => {
        d.radius = (chartRadius-50) / nBars * i + barPadding + 50;
        d.angle = angle(d[yField]);
    });
    
    const group1Chart = g.append("g")
        .attr("transform", `translate(-120, -80)`);
    
    rAxis = group1Chart.append("g");
    rAxis.selectAll("path")
        .data(group1Data)
        .join(enter =>
            enter.append('path')
                .attr('d', d => {
                    const radius = d.radius + barWidth;
                    return d3.arc()({
                        innerRadius: radius,
                        outerRadius: radius + 1,
                        startAngle: 3 * Math.PI / 4,
                        endAngle: 7 * Math.PI / 4
                    });
                })
                .attr('fill', 'none')
                .style('stroke', 'silver')
                .style('stroke-width', '1px')
    );

    coord = (value, radius) => {
        let a = 5*Math.PI / 4;
        let x = Math.cos(a) * radius;
        let y = Math.sin(a) * radius;
        return { x: x, y: y };
    }
    
    arc = d3.arc()
        .innerRadius(d => d.radius)
        .outerRadius(d => d.radius + barWidth)
        .startAngle(3*Math.PI / 4)
        .endAngle(d => d.angle)
        .cornerRadius(20);
    
    bars = group1Chart.append('g');
    bars.selectAll('path')
        .data(group1Data)
        .join(enter => enter.append('path')
        .style('fill', (d, i) => {
            const colorScale = d3.scaleLinear()
                .domain([0, group1Data.length - 1])
                .range(['#335541','#e6e7a2']);
            return colorScale(i);
        })
        .attr('d', d => arc(d))
        .attr('stroke-linecap', 'round'));

    // 首先，为第一组添加路径和文本路径
    group1Data.forEach((d, i) => {
        const text = group1Chart.append("text")
            .attr("x", () => {
                x = Math.cos(Math.PI/4) * (d.radius + barWidth/2);
                return x;
            })
            .attr("y", () => {
                y = Math.sin(Math.PI/4) * (d.radius + barWidth/2);
                return y;
            })
            .attr("dx", -10)
            .attr("dy", 13)
            .attr("fill", "#ffffff")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(i);
    });
    

    // 首先，为第二组添加路径和文本路径
    group1Data.forEach((d, i) => {
        // 创建一个用于文本的路径
        const textPathId = `textPath-group1-${i}`;
        
        // 创建一个看不见的路径用于定位文本
        const textPathAngle = d.angle;
        const textPathRadius = d.radius + barWidth / 2;
        let textContent = d[xField] + " / " + formatValue(d[yField]);
        let actual_length = textContent.length * 14
        let shift_angle = actual_length/textPathRadius/2
        // 创建一个弧形路径
        const textPath = group1Chart.append("path")
            .attr("id", textPathId)
            .attr("d", () => {
                return d3.arc()({
                    innerRadius: textPathRadius,
                    outerRadius: textPathRadius,
                    startAngle: 7*Math.PI/4 - shift_angle,  // 起始角度
                    endAngle: 7*Math.PI/4    // 结束角度
                });
            })
            .style("fill", "none")
            .style("stroke", "none");  // 让路径不可见
        
        // 添加沿路径的文本
        const text = group1Chart.append("text")
            .attr("dy", -5)  // 微调文本位置
            .attr("font-size", "14px")
            .attr("fill", "#333");
        
        text.append("textPath")
            .attr("xlink:href", `#${textPathId}`)
            .attr("startOffset", "75%")  
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .text(`${d[xField]} / ${formatValue(d[yField])}`);
    });

    return svg.node();
}
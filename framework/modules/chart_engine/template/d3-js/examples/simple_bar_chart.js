/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Simple Bar Chart",
    "chart_name": "simple_bar_chart_d3",
    "is_composite": false,
    "required_fields": ["x", "y"],
    "required_fields_type": [["categorical"], ["numerical"]],
    "required_fields_range": [[2, 10], [0, 1000]],
    "required_fields_icons": ["x"],
    "required_other_icons": [],
    "required_fields_colors": ["x"],
    "required_other_colors": [],
    "supported_effects": ["shadow", "radius_corner"],
    "min_height": 300,
    "min_width": 400,
    "background": "no",
    "icon_mark": "overlay",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/

// Simple Bar Chart implementation using D3.js
function makeChart(containerSelector, data) {
    // Extract data from the json_data object
    const jsonData = data;
    const chartData = jsonData.data;
    const variables = jsonData.variables;
    const typography = jsonData.typography;
    const colors = jsonData.colors || {};
    
    // Clear any existing content
    d3.select(containerSelector).html("");
    
    // Set width and height based on variables
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 40, right: 20, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Extract axis fields
    const xField = variables.x_axis.field;
    const yField = variables.y_axis.field;
    
    // Create SVG inside the container
    const svg = d3.select(containerSelector)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("style", "max-width: 100%; height: auto;")
        .attr("xmlns", "http://www.w3.org/2000/svg");
    
    // Create chart group and apply margin
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Create scales
    const xScale = d3.scaleBand()
        .domain(chartData.map(d => d[xField]))
        .range([0, innerWidth])
        .padding(0.3);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
        .range([innerHeight, 0]);

    // Add shadow filter if needed
    if (variables.mark.has_shadow) {
        const defs = svg.append("defs");
        
        defs.append("filter")
            .attr("id", "shadow")
            .append("feDropShadow")
            .attr("dx", 0)
            .attr("dy", 2)
            .attr("stdDeviation", 2)
            .attr("flood-opacity", 0.3);
    }
    
    // Add gradient if needed
    if (variables.mark.has_gradient) {
        const defs = svg.select("defs").size() ? svg.select("defs") : svg.append("defs");
        
        const gradient = defs.append("linearGradient")
            .attr("id", "bar-gradient")
            .attr("gradientUnits", "userSpaceOnUse")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", innerHeight);
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", d3.rgb(variables.color.mark_color.range[0]).brighter(0.5));
        
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", variables.color.mark_color.range[0]);
    }
    
    // Get icons
    const icons = jsonData.images.field;
    
    // Draw bars
    g.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d[xField]))
        .attr("y", d => yScale(d[yField]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d[yField]))
        .attr("fill", d => colors.field[d[xField]])
        .attr("rx", variables.mark.has_rounded_corners ? 4 : 0)
        .attr("ry", variables.mark.has_rounded_corners ? 4 : 0)
        .style("stroke", variables.mark.has_stroke ? colors.stroke_color : "none")
        .style("stroke-width", variables.mark.has_stroke ? 1 : 0)
        .style("filter", variables.mark.has_shadow ? "url(#shadow)" : "none");
    
    // Always draw x-axis
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
    
    // Style the domain and ticks based on variables
    if (!variables.x_axis.has_domain) {
        xAxis.select(".domain").remove();
    }
    
    if (!variables.x_axis.has_tick) {
        xAxis.selectAll(".tick line").remove();
    }
    
    // Apply typography to x-axis labels
    xAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight)
        .attr("transform", "rotate(-45)")
        .attr("text-anchor", "end");
    
    // Always draw y-axis
    const yAxis = g.append("g")
        .call(d3.axisLeft(yScale))
    
    // Style the domain and ticks based on variables
    if (!variables.y_axis.has_domain) {
        yAxis.select(".domain").remove();
    }
    
    if (!variables.y_axis.has_tick) {
        yAxis.selectAll(".tick line").remove();
    }
    
    // Apply typography to y-axis labels
    yAxis.selectAll("text")
        .style("font-family", typography.label.font_family)
        .style("font-size", typography.label.font_size)
        .style("font-weight", typography.label.font_weight);
    
    // Add icons to x-axis
    chartData.forEach(d => {
        const xValue = d[xField];
        if (icons[xValue]) {
            g.append("image")
                .attr("x", xScale(xValue) + xScale.bandwidth() / 2 - 10)
                .attr("y", innerHeight + 25)
                .attr("width", 20)
                .attr("height", 20)
                .attr("xlink:href", icons[xValue]);
        }
    });
    
    return svg.node();
}
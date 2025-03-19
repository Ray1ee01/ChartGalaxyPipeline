/*
REQUIREMENTS_BEGIN
{
    "_comment": "这些属性的值由你对特定的图表进行定义，用于要求数据的格式。完成测试后填写。",
    "chart_type": "Grouped Bar Chart",
    "chart_name": "grouped_bar_chart_01",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": ["string", "number", "string"],
    "supported_effects": ["shadow", "gradient", "rounded_corners", "stroke", "spacing"],
    "required_data_points": [5, 100],
    "required_image": ["people"]
    "width": [500, 1e8],
    "height": [500, 800],
    "x_range": [2, 9]
}
REQUIREMENTS_END
*/
// Grouped Bar Chart implementation using D3.js
function makeChart(containerSelector, data) {
    // Extract data from the json_data object
    const jsonData = data;
    const chartData = jsonData.data;
    const variables = jsonData.variables;
    const constants = jsonData.constants;
    const typography = jsonData.typography;

    d3.select(containerSelector).html("");
    
    // Set width and height based on variables
    const width = variables.width;
    const height = variables.height;
    const margin = { top: 60, right: 100, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Extract axis fields
    const xField = variables.x_axis.field;
    const yField = variables.y_axis.field;
    const groupField = jsonData.data_columns.find(col => col.role === "group").name;
    
    // Get unique x values and groups
    const xValues = [...new Set(chartData.map(d => d[xField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    
    // Create color scale
    const colorScale = d3.scaleOrdinal()
      .domain(variables.color.mark_color.domain)
      .range(variables.color.mark_color.range);
    
    // Create SVG inside the chart-container div
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
      .domain(xValues)
      .range([0, innerWidth])
      .padding(0.2);
    
    const xGroupScale = d3.scaleBand()
      .domain(groups)
      .range([0, xScale.bandwidth()])
      .padding(variables.mark.has_spacing ? 0.1 : 0.05);
    
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
      .range([innerHeight, 0]);
    
    // Draw axes
    if (constants.has_x_axis) {
      const xAxis = g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .style("color", variables.x_axis.style.color)
        .style("opacity", variables.x_axis.style.opacity);
      
      // Style the domain and ticks
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
        .style("font-weight", typography.label.font_weight);
    }
    
    if (constants.has_y_axis) {
      const yAxis = g.append("g")
        .call(d3.axisLeft(yScale))
        .style("color", variables.y_axis.style.color)
        .style("opacity", variables.y_axis.style.opacity);
      
      // Style the domain and ticks
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
    }
    
    // Create gradient defs
    if (variables.mark.has_gradient) {
      const defs = svg.append("defs");
      groups.forEach(group => {
        const gradientId = `gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
        
        const gradient = defs.append("linearGradient")
          .attr("id", gradientId)
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", 0)
          .attr("y2", innerHeight);
        
        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", d3.rgb(colorScale(group)).brighter(0.5));
        
        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorScale(group));
      });
    }
    
    // Add shadow filter if needed
    if (variables.mark.has_shadow) {
      const defs = svg.select("defs").size() ? svg.select("defs") : svg.append("defs");
      
      defs.append("filter")
        .attr("id", "shadow")
        .append("feDropShadow")
        .attr("dx", 0)
        .attr("dy", 2)
        .attr("stdDeviation", 2)
        .attr("flood-opacity", 0.3);
    }
    
    // Create bars with effects
    const barGroups = g.selectAll(".bar-group")
      .data(xValues)
      .enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("transform", d => `translate(${xScale(d)},0)`);
    
    // Add bars for each group
    barGroups.selectAll(".bar")
      .data(d => {
        return groups.map(group => {
          const match = chartData.find(item => item[xField] === d && item[groupField] === group);
          return {
            x: d,
            group: group,
            value: match ? match[yField] : 0
          };
        });
      })
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => xGroupScale(d.group))
      .attr("y", d => yScale(d.value))
      .attr("width", xGroupScale.bandwidth())
      .attr("height", d => innerHeight - yScale(d.value))
      .attr("fill", d => {
        // Apply gradient if needed
        if (variables.mark.has_gradient) {
          const gradientId = `gradient-${d.group.replace(/\s+/g, '-').toLowerCase()}`;
          return `url(#${gradientId})`;
        } else {
          return colorScale(d.group);
        }
      })
      .attr("rx", variables.mark.has_rounded_corners ? 4 : 0)
      .attr("ry", variables.mark.has_rounded_corners ? 4 : 0)
      .style("stroke", variables.mark.has_stroke ? variables.color.stroke_color : "none")
      .style("stroke-width", variables.mark.has_stroke ? 1 : 0)
      .style("filter", variables.mark.has_shadow ? "url(#shadow)" : "none");
    
    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
    
    groups.forEach((group, i) => {
      const legendRow = legend.append("g")
        .attr("transform", `translate(0, ${i * 25})`);
      
      legendRow.append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", colorScale(group))
        .attr("rx", variables.mark.has_rounded_corners ? 2 : 0)
        .attr("ry", variables.mark.has_rounded_corners ? 2 : 0);
      
      legendRow.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text(group)
        .style("font-family", typography.annotation.font_family)
        .style("font-size", typography.annotation.font_size)
        .style("font-weight", typography.annotation.font_weight)
        .style("fill", variables.color.text_color);
    });
    
    return svg.node();
  } 
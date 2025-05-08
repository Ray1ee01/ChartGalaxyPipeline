/*
REQUIREMENTS_BEGIN
{
    "chart_type": "Vertical Group Bar Chart",
    "chart_name": "vertical_group_bar_chart_3",
    "required_fields": ["x", "y", "group"],
    "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
    "required_fields_range": [[2, 6], [0, "inf"], [2, 8]],
    "required_fields_icons": ["x"],
    "required_other_icons": ["primary"],
    "required_fields_colors": ["group"],
    "required_other_colors": ["primary"],
    "supported_effects": ["shadow", "gradient", "radius_corner"],
    "min_height": 400,
    "min_width": 400,
    "background": "no",
    "icon_mark": "none",
    "icon_label": "side",
    "has_x_axis": "yes",
    "has_y_axis": "yes"
}
REQUIREMENTS_END
*/
// Grouped Bar Chart implementation using D3.js
function makeChart(containerSelector, data) {
  // Extract data from the json_data object
  const jsonData = data;
  const chartData = jsonData.data.data
  const variables = jsonData.variables;
  const typography = jsonData.typography;
  const colors = jsonData.colors || {};
  const images = jsonData.images || { field: {}, other: {} };
  const dataColumns = jsonData.data.columns || [];

  d3.select(containerSelector).html("");
  
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
  
  // Set width and height based on variables
  const width = variables.width;
  const height = variables.height;
  const margin = { top: 60, right: 100, bottom: 60, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Extract axis fields based on data_columns order
  const xField = dataColumns[0].name;
  const yField = dataColumns[1].name;
  const groupField = dataColumns[2].name;
  const imageSize = 32;
  
  // 获取Y轴单位
  let yUnit = "";
  const yColumn = dataColumns.find(col => col.name === yField);
  if (yColumn && yColumn.unit && yColumn.unit !== "none") {
      yUnit = yColumn.unit;
  }
  
  // Get unique x values and groups
  const xValues = [...new Set(chartData.map(d => d[xField]))];
  const groupValues = [...new Set(chartData.map(d => d[groupField]))];
  
  // Create color scale using colors from json_data
  const getColor = (group) => {
      return colors.field && colors.field[group] ? colors.field[group] : colors.other.primary;
  };
  
  // Create SVG inside the chart-container div
  const svg = d3.select(containerSelector)
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("style", "max-width: 100%; height: auto;")
    .attr("xmlns", "http://www.w3.org/2000/svg");
  
  // Add title if it exists in variables
  if (variables.title && variables.title.text) {
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-family", typography.title.font_family)
        .style("font-size", typography.title.font_size)
        .style("font-weight", typography.title.font_weight)
        .style("fill", colors.text_color)
        .text(variables.title.text);
  }
  
  // Create chart group and apply margin
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
    
  // Create scales
  const xScale = d3.scaleBand()
    .domain(xValues)
    .range([0, innerWidth])
    .padding(0.2);
  
  const xGroupScale = d3.scaleBand()
    .domain(groupValues)
    .range([0, xScale.bandwidth()])
    .padding(variables.has_spacing ? 0.1 : 0.05);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d[yField]) * 1.1])
    .range([innerHeight, 0]);
  
  // Draw x-axis
  const xAxis = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .style("color", colors.text_color);
  
  // Apply typography to x-axis labels
  xAxis.selectAll("text")
    .attr("transform", "translate(0, 32)")
    .style("font-family", typography.label.font_family)
    .style("font-size", typography.label.font_size)
    .style("font-weight", typography.label.font_weight);
  
  // Add icons to x-axis if available
  xValues.forEach(value => {
    if (images.field && images.field[value]) {
      const xPos = xScale(value) + xScale.bandwidth() / 2;
      
      g.append("image")
        .attr("href", images.field[value])
        .attr("x", xPos - imageSize / 2)
        .attr("y", innerHeight + 5)
        .attr("width", imageSize)
        .attr("height", imageSize)
        .attr("preserveAspectRatio","xMidYMid meet")
        .attr("text-anchor", "middle");
    }
  });
  
  // Draw y-axis
  const yAxis = g.append("g")
    .call(d3.axisLeft(yScale)
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : '')))
    .style("color", colors.text_color);
  
  // Apply typography to y-axis labels
  yAxis.selectAll("text")
    .style("font-family", typography.label.font_family)
    .style("font-size", typography.label.font_size)
    .style("font-weight", typography.label.font_weight);
  
  // Create gradient defs if needed
  if (variables.has_gradient) {
    const defs = svg.append("defs");
    groupValues.forEach(group => {
      const gradientId = `gradient-${group.replace(/\s+/g, '-').toLowerCase()}`;
      const baseColor = getColor(group);
      
      const gradient = defs.append("linearGradient")
        .attr("id", gradientId)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerHeight);
      
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.rgb(baseColor).brighter(0.5));
      
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", baseColor);
    });
  }
  
  // Add shadow filter if needed
  if (variables.has_shadow) {
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
      return groupValues.map(group => {
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
      if (variables.has_gradient) {
        const gradientId = `gradient-${d.group.replace(/\s+/g, '-').toLowerCase()}`;
        return `url(#${gradientId})`;
      } else {
        return getColor(d.group);
      }
    })
    .attr("rx", variables.has_rounded_corners ? 4 : 0)
    .attr("ry", variables.has_rounded_corners ? 4 : 0)
    .style("stroke", variables.has_stroke ? colors.stroke_color : "none")
    .style("stroke-width", variables.has_stroke ? 1 : 0)
    .style("filter", variables.has_shadow ? "url(#shadow)" : "none")
    .on("mouseover", function(event, d) {
      d3.select(this)
        .transition()
        .duration(100)
        .attr("opacity", 0.8);
    })
    .on("mouseout", function(event, d) {
      d3.select(this)
        .transition()
        .duration(100)
        .attr("opacity", 1);
    });
  
  // Add data labels
  barGroups.selectAll(".label")
    .data(d => {
      return groupValues.map(group => {
        const match = chartData.find(item => item[xField] === d && item[groupField] === group);
        return {
          x: d,
          group: group,
          value: match ? match[yField] : 0
        };
      }).filter(d => d.value > 0); // Only add labels for bars with values
    })
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("x", d => xGroupScale(d.group) + xGroupScale.bandwidth() / 2)
    .attr("y", d => yScale(d.value) + 15)
    .attr("text-anchor", "middle")
    .style("font-family", typography.label.font_family)
    .style("font-size", "10px")
    .style("fill", "white")
    .style("pointer-events", "none")
    .text(d => formatValue(d.value) + (yUnit ? ` ${yUnit}` : ''));
  
  // Add legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
  
  groupValues.forEach((group, i) => {
    const legendRow = legend.append("g")
      .attr("transform", `translate(0, ${i * 25})`);
    
    legendRow.append("rect")
      .attr("width", 15)
      .attr("height", 15)
      .attr("fill", getColor(group))
      .attr("rx", variables.has_rounded_corners ? 2 : 0)
      .attr("ry", variables.has_rounded_corners ? 2 : 0);
    
    legendRow.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .text(group)
      .style("font-family", typography.label.font_family)
      .style("font-size", typography.label.font_size)
      .style("font-weight", typography.label.font_weight)
      .style("fill", colors.text_color);
  });
  
  return svg.node();
} 
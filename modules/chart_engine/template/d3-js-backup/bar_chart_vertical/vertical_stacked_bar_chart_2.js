/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Bar Chart",
  "chart_name": "vertical_stacked_bar_chart_2",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 12], [0, "inf"], [3, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";
    // const groupFieldUnit = groupFieldConfig && groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not used

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        dataLabelColor: '#FFFFFF', // Default for labels inside bars
        // Bar color function will be defined in Block 6 with access to `groups`
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but for compliance with "MUST NOT be appended to the document DOM", we use it as is.
        // This might be less accurate in some edge cases/browsers without rendering.
        // A common robust approach is to append to an off-screen part of the main SVG if available early.
        // However, sticking to the "in-memory" directive strictly.
        let width = 0;
        try {
             width = textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered SVG
            width = text.length * (parseFloat(fontSize) * 0.6); // Rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~s")(value).replace('G', 'B'); // Use 's' for SI, then replace G with B
        } else if (value >= 1000000) {
            return d3.format("~s")(value);
        } else if (value >= 1000) {
            return d3.format("~s")(value);
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendHeightEstimate = 60; // Estimated space for legend
    const chartMargins = {
        top: legendHeightEstimate, // Adjusted for legend above
        right: 30,
        bottom: 80, // For X-axis labels
        left: 40    // For potential Y-axis labels (though not rendered here)
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); // Sort for consistent color mapping

    const processedData = Array.from(d3.group(chartDataArray, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key };
        let total = 0;
        groups.forEach(group => {
            const sumVal = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
            obj[group] = sumVal;
            total += sumVal;
        });
        obj.total = total;
        return obj;
    });
    
    // Sort processedData by xFieldName if it's sortable (e.g. if x-axis represents time or ordered categories)
    // For now, assume order from d3.group is sufficient or data is pre-sorted.
    // If specific x-axis order is needed, it should be applied here.

    const stackGenerator = d3.stack()
        .keys(groups)
        .order(d3.stackOrderNone) // Keep original group order
        .offset(d3.stackOffsetNone);

    const stackedData = stackGenerator(processedData);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d[xFieldName]))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.total) || 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (rawColors.field && rawColors.field[group]) {
                return rawColors.field[group];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[i % rawColors.available_colors.length];
            }
            return d3.schemeCategory10[i % 10]; // Fallback to d3.schemeCategory10
        }));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickSize(0)
            .tickPadding(10))
        .call(g => g.select(".domain").remove());

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) { // Handle label rotation
            const labelText = String(d);
            const maxLabelWidth = xScale.bandwidth() * 1.2; // Allow slight overflow before rotation
            const estimatedWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (estimatedWidth > maxLabelWidth) {
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position above chart, adjust y

    const legendItemHeight = 20;
    const legendRectSize = 12;
    const legendSpacing = 5;
    let currentX = 0;
    const legendMaxWidth = innerWidth;

    const legendTitleText = groupFieldConfig?.label || groupFieldName;
    if (legendTitleText) {
        const legendTitle = legendGroup.append("text")
            .attr("class", "label")
            .attr("x", currentX)
            .attr("y", legendRectSize / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Use label font size for legend title
            .style("font-weight", "bold") // Make legend title bold
            .style("fill", fillStyle.textColor)
            .text(legendTitleText + ":");
        currentX += estimateTextWidth(legendTitle.text(), fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, "bold") + legendSpacing * 2;
    }


    groups.forEach((group, i) => {
        const itemText = String(group);
        const itemWidth = legendRectSize + legendSpacing + estimateTextWidth(itemText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);

        if (currentX + itemWidth > legendMaxWidth && i > 0) { // Basic wrapping, not implemented fully here
            // For a real wrap, would need to adjust y and reset currentX
            // Keeping it simple: items might overflow if too many for one line
        }

        const itemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        itemGroup.append("rect")
            .attr("class", "mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", colorScale(group));

        itemGroup.append("text")
            .attr("class", "label")
            .attr("x", legendRectSize + legendSpacing)
            .attr("y", legendRectSize / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(itemText);
        
        currentX += itemWidth + legendSpacing * 2;
    });
    
    // Center the legend content
    const legendWidth = currentX - legendSpacing * 2; // total width of legend items
    legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - 10})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barLayers = mainChartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer group-${d.key.replace(/\s+/g, '-').toLowerCase()}`) // Add class for group
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Pass key down for access
        .enter().append("rect")
        .attr("class", "mark")
        .attr("x", d => xScale(d.data[xFieldName]))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => {
            const h = yScale(d[0]) - yScale(d[1]);
            return h > 0 ? h : 0; // Ensure non-negative height
        })
        .attr("width", xScale.bandwidth());

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    barLayers.selectAll(".value") // Use class "value" for data labels
        .data(d => d.map(item => ({ ...item, key: d.key })))
        .enter().append("text")
        .attr("class", "value")
        .attr("x", d => xScale(d.data[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => {
            const barSegmentHeight = yScale(d[0]) - yScale(d[1]);
            return yScale(d[1]) + barSegmentHeight / 2;
        })
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", fillStyle.dataLabelColor)
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => {
            const value = d[1] - d[0];
            const barSegmentHeight = yScale(d[0]) - yScale(d[1]);
            const labelMinHeight = parseFloat(fillStyle.typography.annotationFontSize) * 1.2; // Approx height of text
            
            if (value > 0 && barSegmentHeight > labelMinHeight) {
                return formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            }
            return '';
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
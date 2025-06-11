/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Bar Chart",
  "chart_name": "vertical_stacked_bar_chart_1",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Prioritize data.colors, fallback to data.colors_dark
    const imagesInput = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";
    // const groupFieldUnit = groupFieldConfig && groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not used

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role: 'x')");
        if (!yFieldName) missingFields.push("y field (role: 'y')");
        if (!groupFieldName) missingFields.push("group field (role: 'group')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Default to white if not provided
        primaryAccent: (colorsInput.other && colorsInput.other.primary) || '#1f77b4',
        secondaryAccent: (colorsInput.other && colorsInput.other.secondary) || '#ff7f0e',
        labelOnBarColor: '#FFFFFF', // Color for text labels inside bars
        axisLineColor: '#888888', // Default for axis lines if they were to be drawn
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.fontFamily);
        textElement.setAttribute('font-size', fontProps.fontSize);
        textElement.setAttribute('font-weight', fontProps.fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in DOM.
        // However, per spec, it should not be appended to the document DOM.
        // For robustness without appending:
        // document.body.appendChild(svg); // Temporary append
        // const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Remove
        // return width;
        // For in-memory without DOM append:
        return textElement.getBBox().width; // This might be less reliable across all browsers without DOM attachment for complex CSS.
                                           // For D3 context, if an SVG is already on page, can use that.
                                           // Given constraints, this is the direct approach.
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendItemHeight = 20;
    const legendPadding = 10;
    const estimatedLegendHeight = legendItemHeight + 2 * legendPadding; // Simplified: assuming single line legend for now

    const chartMargins = {
        top: variables.marginTop || (estimatedLegendHeight + 20), // Adjusted for legend
        right: variables.marginRight || 30,
        bottom: variables.marginBottom || 80, // For X-axis labels
        left: variables.marginLeft || 40
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataInput.map(d => d[groupFieldName]))).sort(); // Sort for consistent color mapping

    const processedData = Array.from(d3.group(chartDataInput, d => d[xFieldName]), ([key, values]) => {
        const obj = { [xFieldName]: key }; // Use dynamic key for xField
        groups.forEach(group => {
            obj[group] = d3.sum(values.filter(d => d[groupFieldName] === group), d => +d[yFieldName]);
        });
        obj.total = d3.sum(values, d => +d[yFieldName]);
        return obj;
    });
    
    // Sort processedData by xFieldName if it's sortable (e.g. if x represents time periods that have a natural order)
    // For simplicity, assuming categorical x-axis values are already in a desired order or order doesn't matter beyond appearance.
    // If specific sorting is needed, it should be done here based on xFieldName values.

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
            if (colorsInput.field && colorsInput.field[group]) {
                return colorsInput.field[group];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[i % colorsInput.available_colors.length];
            }
            return d3.schemeCategory10[i % 10]; // Fallback to d3.schemeCategory10
        }));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    
    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10))
        .call(g => g.select(".domain").remove()); // Remove axis line

    // X-Axis label rotation logic
    let rotateXLabels = false;
    const maxLabelWidth = xScale.bandwidth() * 1.0; // Allow full bandwidth
    processedData.forEach(d => {
        const labelText = String(d[xFieldName]);
        const estimatedWidth = estimateTextWidth(labelText, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (estimatedWidth > maxLabelWidth) {
            rotateXLabels = true;
        }
    });

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("dx", rotateXLabels ? "-0.8em" : null)
        .attr("dy", rotateXLabels ? "0.15em" : null)
        .attr("transform", rotateXLabels ? "rotate(-45)" : null);

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${legendPadding})`); // Position above chart content area

    let currentX = 0;
    const legendRectSize = 12;
    const legendSpacing = 8;
    const legendTextPadding = 4;

    groups.forEach((groupName, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark")
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", colorScale(groupName));

        const textElement = legendItem.append("text")
            .attr("class", "label")
            .attr("x", legendRectSize + legendTextPadding)
            .attr("y", legendRectSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);
        
        currentX += legendRectSize + legendTextPadding + textElement.node().getBBox().width + legendSpacing;
    });
    
    // Center the legend if space allows
    const legendWidth = currentX - legendSpacing; // Remove last spacing
    if (legendWidth < innerWidth) {
        legendGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - legendWidth) / 2}, ${legendPadding + ( (chartMargins.top - legendPadding - legendPadding - legendItemHeight)/2 ) })`);
    } else {
         legendGroup.attr("transform", `translate(${chartMargins.left}, ${legendPadding + ( (chartMargins.top - legendPadding - legendPadding - legendItemHeight)/2 ) })`);
    }


    // Block 8: Main Data Visualization Rendering
    const barLayers = mainChartGroup.selectAll(".layer")
        .data(stackedData)
        .enter().append("g")
        .attr("class", d => `layer group-${d.key.replace(/\s+/g, '-')}`) // Class for group
        .style("fill", d => colorScale(d.key));

    barLayers.selectAll("rect")
        .data(d => d.map(s => ({ ...s, key: d.key }))) // Add key to segment data for access
        .enter().append("rect")
        .attr("class", "mark bar-segment")
        .attr("x", d => xScale(d.data[xFieldName]))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => Math.max(0, yScale(d[0]) - yScale(d[1]))) // Ensure non-negative height
        .attr("width", xScale.bandwidth());

    // Data labels on segments
    barLayers.selectAll(".segment-label")
        .data(d => d.map(s => ({ ...s, key: d.key })))
        .enter().append("text")
        .attr("class", "label value segment-label")
        .attr("x", d => xScale(d.data[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d[1]) + (yScale(d[0]) - yScale(d[1])) / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.labelOnBarColor)
        .text(d => {
            const segmentValue = d[1] - d[0];
            const segmentHeight = yScale(d[0]) - yScale(d[1]);
            // Only show label if segment height is sufficient and value is > 0
            const fontSizeNumeric = parseFloat(fillStyle.typography.annotationFontSize);
            return (segmentHeight > fontSizeNumeric && segmentValue > 0) ? formatValue(segmentValue) + (yFieldUnit ? ` ${yFieldUnit}` : '') : '';
        });

    // Total labels above bars
    mainChartGroup.selectAll(".total-label")
        .data(processedData)
        .enter().append("text")
        .attr("class", "label value total-label")
        .attr("x", d => xScale(d[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.total) - 5) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.total) + (yFieldUnit ? ` ${yFieldUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // (No additional enhancements beyond X-axis label rotation and legend placement logic)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
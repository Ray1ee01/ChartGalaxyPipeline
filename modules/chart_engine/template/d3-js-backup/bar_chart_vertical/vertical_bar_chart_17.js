/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_17",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xCol ? xCol.name : undefined;
    const valueFieldName = yCol ? yCol.name : undefined;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("categoryFieldName (derived from dataColumns role 'x')");
        if (!valueFieldName) missingFields.push("valueFieldName (derived from dataColumns role 'y')");
        
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const yFieldUnit = yCol && yCol.unit && yCol.unit !== "none" ? ` ${yCol.unit}` : "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            
            // Title and Annotation fonts are defined here for completeness per spec, though not used in this simplified chart
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        barColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#4682B4', // Default SteelBlue
        barLabelTextColor: '#FFFFFF', // Default white for text on bars, assuming bars are relatively dark
        axisTextColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly applied to SVG, but available
    };

    // In-memory text measurement utility (as required by III.2)
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // console.warn("Could not estimate text width for:", text, e); 
            // Silently fail or return 0 if estimation is not critical path
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 50,
        right: 30,
        bottom: 50, 
        left: 60  
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] 
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) 
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0));
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text").remove(); // Remove X-axis text labels as per original's visual output

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}${yFieldUnit}`).tickSize(0).tickPadding(10));
    
    yAxisGroup.select(".domain").remove();
    
    yAxisGroup.selectAll("text")
        .attr("class", "label axis-label") 
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.axisTextColor);

    // No gridlines are rendered.
    // No legend is rendered.
    // No main titles or subtitles are rendered.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElementsGroup = mainChartGroup.selectAll(".bar-element-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark-group") 
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    const barWidth = xScale.bandwidth();

    barElementsGroup.append("rect")
        .attr("class", "mark bar") 
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => Math.max(0, innerHeight - yScale(d.value))) // Ensure height is non-negative
        .attr("fill", fillStyle.barColor);

    barElementsGroup.append("text")
        .attr("class", "label data-label value") 
        .attr("x", barWidth / 2)
        .attr("y", d => yScale(d.value) - 5) 
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.barLabelTextColor) 
        .text(d => `${d.value}${yFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing
    // All complex visual effects (gradients, extended paths, shadows) from the original have been removed.
    // No annotations or special interactive elements are part of this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
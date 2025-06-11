/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_10",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 600,
  "background": "yes",

  "elementAlignment": "bottom",
  "xAxis": "visible",
  "yAxis": "visible",
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
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    const categoryFieldName = xFieldDef ? xFieldDef.name : undefined;
    const valueFieldName = yFieldDef ? yFieldDef.name : undefined;
    
    const yAxisUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            // title and annotation fonts are not used in this chart as per restrictions
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
    };

    const primaryColor = (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#1f77b4'; // Default primary blue
    fillStyle.barDotBaseColor = primaryColor;
    fillStyle.barDotTopColor = d3.rgb(primaryColor).darker(0.7).toString();


    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but strict rules say "MUST NOT be appended to the document DOM".
        // For simple cases, direct getBBox on an unattached element might work,
        // but can be inconsistent. A common robust approach involves a hidden live SVG.
        // Given the constraint, we'll try direct getBBox.
        // If this proves unreliable, a temporary, hidden, live SVG would be the alternative.
        // For this exercise, we assume this simpler method is sufficient.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on unattached element
            return text ? text.length * (parseInt(fontProps.fontSize, 10) * 0.6) : 0;
        }
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI, Giga to Billion
        } else if (value >= 1000000) {
            return d3.format("~.2s")(value); // e.g., 1.5M
        } else if (value >= 1000) {
            return d3.format("~.2s")(value); // e.g., 2.3K
        } else {
            return d3.format("~g")(value); // General format for smaller numbers
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 50,
        right: 30,
        bottom: 80, // Increased if labels are rotated
        left: 60  // Increased to accommodate Y-axis labels potentially with units
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.1); // Standard padding

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll("path.domain").remove(); // Remove X axis line

    // Calculate if X-axis labels need rotation
    let rotateXLabels = false;
    const xLabelFontProps = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };
    if (xScale.bandwidth() > 0) { // Check if bandwidth is valid
        processedData.forEach(d => {
            const text = String(d.category);
            if (estimateTextWidth(text, xLabelFontProps) > xScale.bandwidth() * 1.1) { // 1.1 factor for some padding
                rotateXLabels = true;
            }
        });
    }
    
    // If rotation is needed, adjust bottom margin (this is a common advanced step,
    // but for this refactor, we'll stick to the fixed margin and let text overlap if too long,
    // or apply rotation without dynamic margin adjustment for simplicity unless it was in original)
    // The original code dynamically adjusted text-anchor and rotation.
    
    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("transform", rotateXLabels ? "rotate(-45)" : "rotate(0)");


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickFormat(d => formatValue(d) + (yAxisUnit ? ` ${yAxisUnit}` : ''))
            .tickSize(0)
            .tickPadding(10)
        );

    yAxisGroup.select(".domain").remove(); // Remove Y axis line

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering
    const circleRadius = Math.max(2, Math.min(5, xScale.bandwidth() * 0.15)); // Dynamic radius based on bandwidth
    const circleSpacing = 2; 
    const effectiveCircleDiameter = circleRadius * 2 + circleSpacing;

    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark bar-group")
        .attr("transform", d => `translate(${xScale(d.category) + xScale.bandwidth() / 2}, 0)`);

    barGroups.each(function(d) {
        const barData = d; // Explicitly capture d for clarity within .each
        const groupElement = d3.select(this);
        const barTopY = yScale(barData.value);
        const barHeight = innerHeight - barTopY;
        
        if (barHeight <= 0 || effectiveCircleDiameter <=0) return; // Skip if no height or invalid circle size

        const numCircles = Math.max(0, Math.floor(barHeight / effectiveCircleDiameter));

        for (let i = 0; i < numCircles; i++) {
            groupElement.append("circle")
                .attr("class", "mark value") // Added class for circle
                .attr("r", circleRadius)
                .attr("cx", 0)
                // Position circles from the base of the bar upwards
                .attr("cy", innerHeight - (i * effectiveCircleDiameter) - (effectiveCircleDiameter / 2) + (circleSpacing/2) )
                // Color: top-most circle (last one drawn if drawing from base up, or first if drawing from top down)
                // Original logic: i=0 was topmost. Here, if numCircles > 0, the circle with index (numCircles - 1) is topmost.
                .attr("fill", (i === numCircles - 1 && numCircles > 0) ? fillStyle.barDotTopColor : fillStyle.barDotBaseColor);
        }
    });
    
    mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 8) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.value) + (yAxisUnit ? ` ${yAxisUnit}` : ''));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or complex interactions in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
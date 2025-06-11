/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 600,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal bar chart.
    // It expects data with categories (x-axis, vertical) and numerical values (y-axis, horizontal bars).

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Could be data.colors_dark for dark themes, assuming similar structure
    const images = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const categoryFieldUnit = dataColumns.find(col => col.role === "x")?.unit || "";
    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit || "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("category field (role: x)");
        if (!valueFieldName) missingFields.push("value field (role: y)");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Filter out data points with undefined/null essential values after identifying fields
    const chartDataArray = chartDataInput.filter(d =>
        d[categoryFieldName] != null && d[valueFieldName] != null && !isNaN(parseFloat(d[valueFieldName]))
    );
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimaryColor: (colors.other && colors.other.primary) || '#4682B4', // SteelBlue as a default
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // Not actively used for chart background itself, but available
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family || fillStyle.typography.labelFontFamily);
        tempTextElement.setAttribute('font-size', fontProps.font_size || fillStyle.typography.labelFontSize);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight || fillStyle.typography.labelFontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // No need to append tempSvg to DOM for getBBox to work on the text element
        const width = tempTextElement.getBBox().width;
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // General format for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Apply background to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const defaultIconWidth = 24; // Standardized icon size
    const defaultIconHeight = 24;
    const iconPadding = 5;

    let maxCategoryLabelWidth = 0;
    chartDataArray.forEach(d => {
        const categoryText = `${d[categoryFieldName]}${categoryFieldUnit && categoryFieldUnit !== "none" ? categoryFieldUnit : ""}`;
        const textWidth = estimateTextWidth(categoryText, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        });
        let iconSpace = 0;
        if (images.field && images.field[d[categoryFieldName]]) {
            iconSpace = defaultIconWidth + iconPadding;
        }
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, textWidth + iconSpace);
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const valueText = `${formatValue(d[valueFieldName])}${valueFieldUnit && valueFieldUnit !== "none" ? valueFieldUnit : ""}`;
        const textWidth = estimateTextWidth(valueText, {
            font_family: fillStyle.typography.annotationFontFamily,
            font_size: fillStyle.typography.annotationFontSize,
            font_weight: fillStyle.typography.annotationFontWeight
        });
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });

    const chartMargins = {
        top: 20,
        right: Math.max(20, maxValueLabelWidth + 10), // Space for value labels
        bottom: 20,
        left: Math.max(20, maxCategoryLabelWidth + 10) // Space for category labels and icons
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust container size or margins.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategories = sortedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2; // Standardized bar padding

    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxDataValue = d3.max(sortedData, d => +d[valueFieldName]);
    const minDataValue = d3.min(sortedData, d => +d[valueFieldName]);
    
    let xScaleDomainMin = 0;
    if (minDataValue < 0) { // Handle negative values if they exist
        xScaleDomainMin = minDataValue * 1.05; // Add 5% padding for negative values
    }
    
    const xScale = d3.scaleLinear()
        .domain([xScaleDomainMin, Math.max(0, maxDataValue) * 1.05]) // Add 5% padding to max, ensure max is at least 0
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend as per requirements.
    // Titles/subtitles are also removed.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    sortedData.forEach(d => {
        const categoryName = d[categoryFieldName];
        const value = +d[valueFieldName];

        const barY = yScale(categoryName);
        if (barY === undefined) { // Skip if category not in scale (should not happen with sortedCategories)
            console.warn(`Category ${categoryName} not found in yScale domain.`);
            return;
        }
        const barHeight = yScale.bandwidth();
        
        let barX, barWidth;
        if (value >= 0) {
            barX = xScale(0);
            barWidth = xScale(value) - xScale(0);
        } else {
            barX = xScale(value);
            barWidth = xScale(0) - xScale(value);
        }
        
        if (barWidth < 0) barWidth = 0; // Ensure non-negative width

        // Draw bar
        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", barX)
            .attr("y", barY)
            .attr("width", barWidth)
            .attr("height", barHeight)
            .attr("fill", fillStyle.barPrimaryColor);

        // Add category label and icon
        const labelYPosition = barY + barHeight / 2;
        const iconUrl = images.field && images.field[categoryName] ? images.field[categoryName] : null;
        
        let currentXPosition = -iconPadding; // Start from right edge of icon space

        if (iconUrl) {
            const iconSize = Math.min(defaultIconWidth, defaultIconHeight, barHeight * 0.8);
            mainChartGroup.append("image")
                .attr("class", "icon category-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", currentXPosition - iconSize)
                .attr("y", labelYPosition - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
            currentXPosition -= (iconSize + iconPadding);
        } else {
             // If no icon, shift text slightly to the right to align with where icon text would be
            currentXPosition -= iconPadding; // Small gap if no icon
        }
        
        const categoryText = `${categoryName}${categoryFieldUnit && categoryFieldUnit !== "none" ? categoryFieldUnit : ""}`;
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", currentXPosition)
            .attr("y", labelYPosition)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryText);

        // Add value label
        const valueText = `${formatValue(value)}${valueFieldUnit && valueFieldUnit !== "none" ? valueFieldUnit : ""}`;
        const valueLabelXOffset = 5;
        let valueLabelAnchor = "start";
        let valueLabelXPosition = xScale(value) + valueLabelXOffset;

        if (value < 0) {
            valueLabelAnchor = "end";
            valueLabelXPosition = xScale(value) - valueLabelXOffset;
        } else if (xScale(0) + barWidth < innerWidth - maxValueLabelWidth - valueLabelXOffset) { // Standard position
             valueLabelXPosition = xScale(0) + barWidth + valueLabelXOffset;
        } else { // If bar is too long, place label inside
            valueLabelAnchor = "end";
            valueLabelXPosition = xScale(0) + barWidth - valueLabelXOffset;
            // Potentially change text color here for contrast if inside, but keeping it simple for now
        }


        // Dynamic font size for value label, based on bar height but capped
        const dynamicAnnotationFontSize = Math.min(
            parseFloat(fillStyle.typography.annotationFontSize) * 1.5, // Max 150% of configured size
            Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize) * 0.8) // Min 80% or half bar height
        );

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", valueLabelXPosition)
            .attr("y", labelYPosition)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabelAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${dynamicAnnotationFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex interactions or post-processing in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
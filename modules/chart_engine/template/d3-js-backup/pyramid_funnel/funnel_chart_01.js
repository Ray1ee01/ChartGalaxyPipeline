/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Funnel Chart",
  "chart_name": "funnel_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function generates a Funnel Chart, visualizing stages in a process.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || (data.colors_dark || {});
    const images = data.images || {}; // Extracted as per spec, though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !valueColumn) {
        const missingRoles = [];
        if (!categoryColumn) missingRoles.push("role 'x' (category)");
        if (!valueColumn) missingRoles.push("role 'y' (value)");
        const errorMessage = `Critical chart config missing: dataColumns for ${missingRoles.join(' and ')} not found. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    if (chartDataArray.length === 0) {
        const infoMessage = "No data provided to render the chart.";
        console.warn(infoMessage);
         if (containerSelector) { // Display message in container
            d3.select(containerSelector).html(`<div style='color:grey; text-align:center; padding:20px;'>${infoMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    fillStyle.typography = {
        titleFontFamily: (typography.title && typography.title.font_family) || 'Arial, sans-serif',
        titleFontSize: (typography.title && typography.title.font_size) || '16px',
        titleFontWeight: (typography.title && typography.title.font_weight) || 'bold',
        labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
        labelFontSize: (typography.label && typography.label.font_size) || '12px',
        labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
        annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
        annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
        annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
    };

    fillStyle.textColor = colors.text_color || '#0f223b';
    fillStyle.chartBackground = colors.background_color || '#FFFFFF';
    fillStyle.defaultCategoryColor = '#CCCCCC'; // Fallback if no other color definition found
    fillStyle.defaultCategoricalPalette = d3.schemeCategory10; // Default palette

    fillStyle.getCategoryColor = (categoryValue, index) => {
        if (colors.field && colors.field[categoryValue]) {
            return colors.field[categoryValue];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        if (fillStyle.defaultCategoricalPalette && fillStyle.defaultCategoricalPalette.length > 0) {
            return fillStyle.defaultCategoricalPalette[index % fillStyle.defaultCategoricalPalette.length];
        }
        return fillStyle.defaultCategoryColor;
    };

    const estimateTextWidth = (text, fontProps) => {
        // In-memory text measurement utility
        if (!text || String(text).length === 0) return 0;
        const tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempTextElement.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempTextElement.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempTextElement.textContent = text;
        tempSvgForTextMeasurement.appendChild(tempTextElement);
        // Note: getBBox on unattached elements can be inconsistent. This adheres to "MUST NOT be appended to DOM".
        try {
            return tempTextElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements is problematic
            const fontSizePx = parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize, 10);
            return String(text).length * fontSizePx * 0.6; // Rough estimate
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; // Default width if not provided
    const containerHeight = variables.height || 600; // Default height if not provided

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 }; // Right margin accommodates labels
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "chart-content-group other"); // Class for the main group

    // Funnel specific layout calculations
    const maxFunnelWidth = innerWidth * 0.8; // Funnel uses 80% of available inner width
    const funnelChartHeight = innerHeight * 0.8; // Funnel uses 80% of available inner height

    // Block 5: Data Preprocessing & Transformation
    let processedChartData = chartDataArray
        .map(d => ({ ...d, [valueFieldName]: parseFloat(d[valueFieldName]) }))
        .filter(d => d[valueFieldName] !== null && !isNaN(d[valueFieldName]) && d[valueFieldName] >= 0);

    if (processedChartData.length === 0) {
        const infoMessage = "No valid data available after processing to render the chart.";
        console.warn(infoMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:grey; text-align:center; padding:20px;'>${infoMessage}</div>`);
        }
        return null;
    }
    
    const sortedChartData = [...processedChartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const totalValue = d3.sum(sortedChartData, d => d[valueFieldName]);

    if (totalValue === 0 && sortedChartData.length > 0) {
        const equalPercentage = 100 / sortedChartData.length;
        sortedChartData.forEach(d => {
            d.percentageValue = equalPercentage;
        });
    } else if (totalValue > 0) {
        sortedChartData.forEach(d => {
            d.percentageValue = (d[valueFieldName] / totalValue) * 100;
        });
    } else { // totalValue is < 0 (filtered out) or sortedChartData is empty (handled)
        sortedChartData.forEach(d => { d.percentageValue = 0; }); // Default to 0 if somehow missed
    }
    
    const sectionHeight = sortedChartData.length > 0 ? funnelChartHeight / sortedChartData.length : 0;
    const verticalCenteringOffset = (innerHeight - funnelChartHeight) / 2;

    // Block 6: Scale Definition & Configuration
    const funnelWidthScale = d3.scaleLinear()
        .domain([0, 100]) // Input domain is percentage
        .range([0, maxFunnelWidth]); // Output range is pixel width for funnel segments

    // Pre-calculate segment widths based on percentage
    const segmentScaledWidths = sortedChartData.map(d => funnelWidthScale(d.percentageValue));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend are part of this specific funnel chart design.

    // Block 8: Main Data Visualization Rendering
    sortedChartData.forEach((d, i) => {
        const categoryValue = d[categoryFieldName];
        const segmentColor = fillStyle.getCategoryColor(String(categoryValue), i);

        const topSegmentWidth = segmentScaledWidths[i];
        
        let bottomSegmentWidth;
        if (i < sortedChartData.length - 1) {
            bottomSegmentWidth = segmentScaledWidths[i + 1];
        } else {
            // For the last segment, its bottom width is 80% of its top width (original behavior)
            bottomSegmentWidth = topSegmentWidth * 0.8; 
        }

        const segmentYPosition = i * sectionHeight + verticalCenteringOffset;

        // Define points for the trapezoidal segment
        const polygonPoints = [
            [innerWidth / 2 - topSegmentWidth / 2, segmentYPosition], // Top-left
            [innerWidth / 2 + topSegmentWidth / 2, segmentYPosition], // Top-right
            [innerWidth / 2 + bottomSegmentWidth / 2, segmentYPosition + sectionHeight], // Bottom-right
            [innerWidth / 2 - bottomSegmentWidth / 2, segmentYPosition + sectionHeight]  // Bottom-left
        ];

        mainChartGroup.append("polygon")
            .attr("points", polygonPoints.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark"); // Standardized class for data marks

        // Add labels for each segment
        const labelText = `${categoryValue} ${Math.round(d.percentageValue)}%`;
        // Position label to the right of the segment's top edge
        const labelXPosition = innerWidth / 2 + topSegmentWidth / 2 + 10; // 10px padding
        const labelYPosition = segmentYPosition + sectionHeight / 2; // Vertically centered in segment

        mainChartGroup.append("text")
            .attr("x", labelXPosition)
            .attr("y", labelYPosition)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "start") // Align text start to the x position
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label") // Standardized class for labels
            .text(labelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or interactivity in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
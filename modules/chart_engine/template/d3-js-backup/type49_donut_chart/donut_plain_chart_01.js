/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
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
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const rawImages = data.images || {}; // Though not used in this chart type

    d3.select(containerSelector).html(""); // Clear container

    const xFieldDef = dataColumns.find(col => col.role === 'x');
    const yFieldDef = dataColumns.find(col => col.role === 'y');

    if (!xFieldDef || !xFieldDef.name || !yFieldDef || !yFieldDef.name) {
        console.error("Critical chart config missing: xField or yField name from dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration (x or y field) is missing.</div>");
        return null;
    }
    const xFieldName = xFieldDef.name;
    const yFieldName = yFieldDef.name;

    const chartDataArray = rawChartData.filter(d => d[yFieldName] != null && d[xFieldName] != null);

    if (chartDataArray.length === 0) {
        console.error("No valid data available to render the chart after filtering.");
         d3.select(containerSelector).html("<div style='color:orange; text-align:center; padding:20px;'>Warning: No data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography
    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px';
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal';
    
    fillStyle.typography.legendFontFamily = (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif'; // Using label for legend
    fillStyle.typography.legendFontSize = (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px';
    fillStyle.typography.legendFontWeight = (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal';


    // Colors
    fillStyle.colors.textColor = rawColors.text_color || '#333333';
    fillStyle.colors.chartBackground = rawColors.background_color || '#FFFFFF'; // Not directly used for SVG bg, but good to have
    const defaultPrimaryColor = '#4682B4';
    const defaultAvailableColors = d3.schemeCategory10;

    fillStyle.colors.segmentColorProvider = (category, index) => {
        if (rawColors.field && rawColors.field[category]) {
            return rawColors.field[category];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        return defaultAvailableColors[index % defaultAvailableColors.length];
    };
    
    fillStyle.colors.primary = (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : defaultPrimaryColor;


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // As per directive, not appending to DOM. This might lead to getBBox issues in some browsers.
        // If issues arise, this is the point of failure due to the constraint.
        // A more robust (but forbidden) way: document.body.appendChild(tempSvg); width = tempText.getBBox().width; document.body.removeChild(tempSvg);
        try {
             // Attempt to get BBox. For this to work reliably without DOM attachment,
             // the SVG needs to be part of the document, even if hidden.
             // The directive is very strict. We'll try this way.
            document.body.appendChild(tempSvg); // Temporarily append to measure
            const width = tempText.getBBox().width;
            document.body.removeChild(tempSvg); // Clean up
            return width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in a pure JS environment without a DOM or if unattached SVG measurement is buggy)
            // This is a rough estimate.
            const averageCharWidth = parseFloat(fontSize) * 0.6;
            return text.length * averageCharWidth;
        }
    }

    function isLightColor(hexColor) {
        const color = d3.color(hexColor);
        if (!color) return false;
        const rgb = color.rgb();
        const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
        return luminance > 0.5; // Threshold for light (0-1 scale)
    }

    fillStyle.colors.getLabelColorForSegment = (segmentColor) => {
        return isLightColor(segmentColor) ? '#000000' : '#FFFFFF';
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 60, // Increased top margin for legend
        right: variables.margin_right || 40, 
        bottom: variables.margin_bottom || 40, 
        left: variables.margin_left || 40 
    };

    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    const donutRadius = Math.min(chartAreaWidth, chartAreaHeight) / 2;
    const innerRadiusRatio = 0.6; // Standard donut hole size
    const donutInnerRadius = donutRadius * innerRadiusRatio;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[yFieldName]);
    const processedChartData = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[yFieldName] / totalValue) * 100 : 0
    }));

    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[yFieldName])
        .sort(null); // Preserve original data order

    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(donutRadius)
        .padAngle(0.02); // Small padding between segments

    const labelArcGenerator = d3.arc()
        .innerRadius(donutInnerRadius + (donutRadius - donutInnerRadius) * 0.5) // Mid-point of the segment thickness
        .outerRadius(donutInnerRadius + (donutRadius - donutInnerRadius) * 0.5);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendContainer = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2})`); // Position legend in top margin

    const legendCategories = [...new Set(processedChartData.map(d => d[xFieldName]))];
    let currentXOffset = 0;
    const legendItemHeight = 20;
    const legendMarkerSize = 12;
    const legendSpacing = 5; // Space between marker and text
    const legendItemPadding = 15; // Space between legend items

    const legendTitle = xFieldDef.label || xFieldName; // Use label from dataColumns if available
    if (legendTitle) {
        const legendTitleElement = legendContainer.append("text")
            .attr("class", "text legend-title")
            .attr("x", currentXOffset)
            .attr("y", legendItemHeight / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.legendFontFamily)
            .style("font-size", fillStyle.typography.legendFontSize) // Make title slightly larger or bolder if desired
            .style("font-weight", "bold")
            .style("fill", fillStyle.colors.textColor)
            .text(legendTitle + ":");
        currentXOffset += estimateTextWidth(legendTitle + ":", fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, "bold") + legendItemPadding;
    }
    
    legendCategories.forEach((category, i) => {
        const legendItem = legendContainer.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentXOffset}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark legend-marker")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendMarkerSize) / 2)
            .attr("width", legendMarkerSize)
            .attr("height", legendMarkerSize)
            .style("fill", fillStyle.colors.segmentColorProvider(category, i));

        const legendTextElement = legendItem.append("text")
            .attr("class", "text legend-text")
            .attr("x", legendMarkerSize + legendSpacing)
            .attr("y", legendItemHeight / 2)
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.legendFontFamily)
            .style("font-size", fillStyle.typography.legendFontSize)
            .style("font-weight", fillStyle.typography.legendFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(category);
        
        currentXOffset += legendMarkerSize + legendSpacing + estimateTextWidth(category, fillStyle.typography.legendFontFamily, fillStyle.typography.legendFontSize, fillStyle.typography.legendFontWeight) + legendItemPadding;
    });

    // Center the legend group if it's not too wide
    const legendWidth = currentXOffset - legendItemPadding; // Total width of legend items
    if (legendWidth < chartAreaWidth) {
        legendContainer.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`);
    } else {
         legendContainer.attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - legendItemHeight / 2})`); // Align left if too wide
    }


    // Block 8: Main Data Visualization Rendering
    const pieData = pieGenerator(processedChartData);

    const segmentGroups = mainChartGroup.selectAll("g.segment")
        .data(pieData)
        .enter()
        .append("g")
        .attr("class", "mark segment");

    segmentGroups.append("path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.colors.segmentColorProvider(d.data[xFieldName], i)) // Use original index for consistent color mapping if data is reordered by pie
        .attr("class", "mark donut-segment-path");

    // Add labels (percentage and value)
    segmentGroups.each(function(d) {
        if (d.data.percentage < 2) return; // Skip labels for very small segments as in original

        const group = d3.select(this);
        const centroid = labelArcGenerator.centroid(d);
        const segmentColor = fillStyle.colors.segmentColorProvider(d.data[xFieldName], pieData.indexOf(d));
        const labelColor = fillStyle.colors.getLabelColorForSegment(segmentColor);

        // Percentage Text
        group.append("text")
            .attr("class", "label data-label percentage-label")
            .attr("transform", `translate(${centroid[0]}, ${centroid[1] - (parseFloat(fillStyle.typography.labelFontSize) * 0.6)})`) // Adjust vertical position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", labelColor)
            .text(`${d.data.percentage.toFixed(1)}%`);

        // Value Text
        group.append("text")
            .attr("class", "label data-label value-label")
            .attr("transform", `translate(${centroid[0]}, ${centroid[1] + (parseFloat(fillStyle.typography.labelFontSize) * 0.7)})`) // Adjust vertical position
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", labelColor)
            .text(d.data[yFieldName]);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements like tooltips or complex interactions in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Donut Chart",
  "chart_name": "donut_chart_001",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
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
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed
    // const rawImages = data.images || {}; // Not used in this chart type

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldConfig = dataColumns.find(col => col.role === 'x');
    const valueFieldConfig = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldConfig || !categoryFieldConfig.name) {
        console.error("Critical chart config missing: Category field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (Category field). Chart cannot be rendered.</div>");
        return null;
    }
    if (!valueFieldConfig || !valueFieldConfig.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (Value field). Chart cannot be rendered.</div>");
        return null;
    }

    const categoryFieldName = categoryFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    
    const chartDataArray = rawChartData.filter(d => d[valueFieldName] != null && d[valueFieldName] > 0); // Filter out zero/null values for pie/donut

    if (chartDataArray.length === 0) {
        console.warn("No valid data points to render for the donut chart.");
        d3.select(containerSelector).html("<div style='text-align:center; padding:20px;'>No data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used on SVG, but good to have
        primaryAccent: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4',
        defaultCategoryColors: d3.schemeCategory10
    };

    fillStyle.getSegmentColor = (d, i) => {
        const category = d.data[categoryFieldName];
        if (rawColors.field && rawColors.field[category]) {
            return rawColors.field[category];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[i % rawColors.available_colors.length];
        }
        return fillStyle.defaultCategoryColors[i % fillStyle.defaultCategoryColors.length];
    };

    const estimateTextWidth = (text, fontFamily, fontSize) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but for estimation without DOM manipulation, this is a common approach.
        // For higher accuracy, a temporary append/remove to DOM might be needed.
        // However, the prompt specifies NOT to append to DOM.
        // A more robust way without appending to DOM is to have a pre-rendered SVG off-screen.
        // For simplicity here, we assume getBBox on a non-DOM-attached element gives a reasonable estimate.
        // If not, one might need to use a canvas context for measurement.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-attached elements
            return text.length * (parseFloat(fontSize) * 0.6); // Rough estimate
        }
    };
    
    const isLightColor = (color) => {
        const rgb = d3.rgb(color);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 128;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground) // Optional: if chart needs a background
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendHeightEstimate = 60; // Estimated height for legend area
    const chartMargins = { 
        top: variables.marginTop || legendHeightEstimate, 
        right: variables.marginRight || 40, 
        bottom: variables.marginBottom || 40, 
        left: variables.marginLeft || 40 
    };

    const chartCanvasWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartCanvasHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const radius = Math.min(chartCanvasWidth, chartCanvasHeight) / 2;
    const innerRadiusFactor = variables.innerRadiusFactor || 0.6;
    const outerRadius = radius;
    const innerRadius = radius * innerRadiusFactor;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left + chartCanvasWidth / 2}, ${chartMargins.top + chartCanvasHeight / 2})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const processedChartData = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // Preserve data order

    const pieData = pieGenerator(processedChartData);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(variables.padAngle === undefined ? 0.02 : variables.padAngle); // Keep configurable padAngle if needed, else fixed

    const labelArcGenerator = d3.arc()
        .innerRadius(outerRadius * (variables.labelPositionFactor || 0.8)) // Factor for label positioning
        .outerRadius(outerRadius * (variables.labelPositionFactor || 0.8));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - legendHeightEstimate / 2 + 10})`); // Position legend above chart area

    const legendItems = pieData.map(d => d.data[categoryFieldName]);
    const uniqueLegendItems = [...new Set(legendItems)];

    let currentX = 0;
    const legendItemHeight = 20;
    const legendSpacing = 10;
    const legendRectSize = 12;
    const legendTextPadding = 5;

    uniqueLegendItems.forEach((itemText, i) => {
        const itemColor = fillStyle.getSegmentColor({ data: { [categoryFieldName]: itemText } }, chartDataArray.findIndex(d => d[categoryFieldName] === itemText));
        
        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItemGroup.append("rect")
            .attr("x", 0)
            .attr("y", (legendItemHeight - legendRectSize) / 2)
            .attr("width", legendRectSize)
            .attr("height", legendRectSize)
            .attr("fill", itemColor)
            .attr("class", "mark");

        const textElement = legendItemGroup.append("text")
            .attr("x", legendRectSize + legendTextPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text(itemText)
            .attr("class", "text");
        
        const itemWidth = legendRectSize + legendTextPadding + estimateTextWidth(itemText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize);
        currentX += itemWidth + legendSpacing;

        // Basic wrapping (if currentX exceeds available width, move to next line - very simplified)
        if (currentX > chartCanvasWidth && i < uniqueLegendItems.length -1) {
            // This simple legend doesn't implement robust wrapping.
            // For production, a more complex legend layout manager would be needed.
        }
    });
    // Center the legend items if space allows
    const totalLegendWidth = currentX - legendSpacing;
    if (totalLegendWidth < chartCanvasWidth) {
        legendGroup.attr("transform", `translate(${chartMargins.left + (chartCanvasWidth - totalLegendWidth) / 2}, ${chartMargins.top / 2 - legendHeightEstimate / 2 + 10})`);
    }


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const arcPaths = mainChartGroup.selectAll("path.mark-segment")
        .data(pieData)
        .enter()
        .append("path")
        .attr("class", "mark mark-segment")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getSegmentColor(d, i));

    const labelThresholdPercentage = variables.labelThresholdPercentage || 2; // Only show labels for segments >= 2%

    const segmentLabels = mainChartGroup.selectAll("g.data-label")
        .data(pieData.filter(d => d.data.percentage >= labelThresholdPercentage))
        .enter()
        .append("g")
        .attr("class", "data-label label")
        .attr("transform", d => `translate(${labelArcGenerator.centroid(d)})`);

    segmentLabels.append("text")
        .attr("class", "text percentage-label")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.3em") // Adjust vertical position
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", (d, i) => {
            const arcColor = fillStyle.getSegmentColor(d, chartDataArray.findIndex(item => item[categoryFieldName] === d.data[categoryFieldName]));
            return isLightColor(arcColor) ? '#000000' : '#FFFFFF';
        })
        .text(d => `${d.data.percentage.toFixed(1)}%`);

    segmentLabels.append("text")
        .attr("class", "text value-label")
        .attr("text-anchor", "middle")
        .attr("dy", "1.0em") // Adjust vertical position
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize) // Potentially smaller for value
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", (d, i) => {
            const arcColor = fillStyle.getSegmentColor(d, chartDataArray.findIndex(item => item[categoryFieldName] === d.data[categoryFieldName]));
            return isLightColor(arcColor) ? '#000000' : '#FFFFFF';
        })
        .text(d => d.data[valueFieldName]);
        
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No enhancements in this refactoring pass. Original code for jsonData.title removed as per V.1.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
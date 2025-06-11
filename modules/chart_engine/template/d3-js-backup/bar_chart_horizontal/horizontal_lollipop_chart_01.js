/* REQUIREMENTS_BEGIN
{
  "chart_type": "Lollipop Chart",
  "chart_name": "horizontal_lollipop_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "yes",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_edge"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || (data.colors_dark || {});
    const inputImages = data.images || {};
    const inputDataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldColumn = inputDataColumns.find(col => col.role === "x");
    const valueFieldColumn = inputDataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryFieldColumn ? categoryFieldColumn.name : undefined;
    const valueFieldName = valueFieldColumn ? valueFieldColumn.name : undefined;
    
    const valueFieldUnit = (valueFieldColumn && valueFieldColumn.unit !== "none") ? valueFieldColumn.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryFieldName or valueFieldName derived from dataColumns is undefined. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration (category or value field) is missing.</div>");
        return null;
    }
    
    if (chartDataArray.length === 0) {
        d3.select(containerSelector).html("<div style='text-align:center; padding:20px;'>No data available to render the chart.</div>");
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (inputTypography.label && inputTypography.label.font_family) ? inputTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (inputTypography.label && inputTypography.label.font_size) ? inputTypography.label.font_size : '12px',
            labelFontWeight: (inputTypography.label && inputTypography.label.font_weight) ? inputTypography.label.font_weight : 'normal',
            annotationFontFamily: (inputTypography.annotation && inputTypography.annotation.font_family) ? inputTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (inputTypography.annotation && inputTypography.annotation.font_size) ? inputTypography.annotation.font_size : '10px',
            annotationFontWeight: (inputTypography.annotation && inputTypography.annotation.font_weight) ? inputTypography.annotation.font_weight : 'normal',
        },
        textColor: inputColors.text_color || '#0f223b',
        primaryColor: (inputColors.other && inputColors.other.primary) ? inputColors.other.primary : (inputColors.available_colors && inputColors.available_colors.length > 0 ? inputColors.available_colors[0] : '#1f77b4'),
        gridLineColor: '#e0e0e0',
        chartBackground: inputColors.background_color || '#FFFFFF',
        imageUrls: {
            field: (inputImages.field || {}),
            otherPrimary: (inputImages.other && inputImages.other.primary) ? inputImages.other.primary : null
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.style.fontFamily = fontProps.family || 'Arial, sans-serif';
        tempTextNode.style.fontSize = fontProps.size || '12px';
        tempTextNode.style.fontWeight = fontProps.weight || 'normal';
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        // Note: The SVG does not need to be appended to the DOM for getBBox to work on its children.
        const width = tempTextNode.getBBox().width;
        return width;
    }
    
    const formatValue = (value) => {
        let num = Number(value);
        if (isNaN(num)) return String(value); // Return as string if not a number

        if (Math.abs(num) >= 1000000000) {
            return d3.format("~.2s")(num).replace('G', 'B'); // Use 'B' for billion
        } else if (Math.abs(num) >= 1000000) {
            return d3.format("~.2s")(num); // d3.format handles M for million
        } else if (Math.abs(num) >= 1000) {
             return d3.format("~.2s")(num); // d3.format handles k for thousand
        }
        return d3.format("~g")(num); // General format for smaller numbers
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 30, // Reduced top margin as no main title
        right: 40,
        bottom: 50, // For X-axis labels
        left: 60  // For category labels (can be adjusted if max label width is known)
    };
    
    // Pre-calculate maximum category label width to adjust left margin
    let maxCategoryLabelWidth = 0;
    if (chartDataArray.length > 0) {
        chartDataArray.forEach(d => {
            const text = String(d[categoryFieldName] === null || d[categoryFieldName] === undefined ? "" : d[categoryFieldName]);
            const width = estimateTextWidth(text, {
                family: fillStyle.typography.labelFontFamily,
                size: fillStyle.typography.labelFontSize,
                weight: fillStyle.typography.labelFontWeight
            });
            if (width > maxCategoryLabelWidth) {
                maxCategoryLabelWidth = width;
            }
        });
    }
    // Adjust left margin if maxCategoryLabelWidth is significant, ensuring some base padding
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 20);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const processedData = [...chartDataArray].sort((a, b) => {
        const valA = +a[valueFieldName];
        const valB = +b[valueFieldName];
        return valB - valA; // Descending sort
    });
    
    const categories = processedData.map(d => String(d[categoryFieldName]));

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.3); // Increased padding for better separation

    const rowHeight = yScale.bandwidth();
    const barHeight = Math.max(rowHeight * 0.5, 10); // Lollipop "stick" part height relative to row, min 10px
    const iconRadius = barHeight; // Circle radius same as barHeight (effective diameter is 2*barHeight)
    const iconPadding = iconRadius / 4; // Padding around icon/circle

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => +d[valueFieldName]) * 1.1 || 10]) // Ensure domain max is at least 10 if data is all 0 or negative
        .range([0, innerWidth - (iconRadius + iconPadding * 2 + estimateTextWidth(formatValue(d3.max(processedData, d => +d[valueFieldName]) || 0) + valueFieldUnit, {size: fillStyle.typography.annotationFontSize, weight: fillStyle.typography.annotationFontWeight, family: fillStyle.typography.annotationFontFamily}) + 10)]);
        // The range ensures space for the circle, padding, and the value label.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const gridGroup = mainChartGroup.append("g")
        .attr("class", "grid grid-lines");

    const gridValues = xScale.ticks(5);
    gridValues.forEach(value => {
        gridGroup.append("line")
            .attr("class", "gridline")
            .attr("x1", xScale(value))
            .attr("y1", 0)
            .attr("x2", xScale(value))
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");
    });

    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => formatValue(d) + (valueFieldUnit && d !== 0 ? ` ${valueFieldUnit}` : '')); // Add unit to axis ticks

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").remove(); // No domain line

    xAxisGroup.selectAll(".tick text")
        .attr("class", "label axis-tick-label")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering
    const itemGroups = mainChartGroup.selectAll(".item-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "item-group")
        .attr("transform", d => `translate(0, ${yScale(String(d[categoryFieldName]))})`);

    itemGroups.each(function(d, i) {
        const group = d3.select(this);
        const category = String(d[categoryFieldName]);
        const value = +d[valueFieldName];
        
        const yPosCentered = rowHeight / 2; // Center elements vertically within the band
        const stickEndX = xScale(value >= 0 ? value : 0); // Stick ends at value, or 0 if negative

        // Lollipop Stick
        group.append("line")
            .attr("class", "mark stick")
            .attr("x1", xScale(0)) // Stick starts at 0
            .attr("y1", yPosCentered)
            .attr("x2", stickEndX)
            .attr("y2", yPosCentered)
            .attr("stroke", fillStyle.primaryColor)
            .attr("stroke-width", Math.max(barHeight / 2, 2)); // Stick thickness

        // Lollipop Head (Circle)
        const circleX = stickEndX;
        const circleY = yPosCentered;

        group.append("circle")
            .attr("class", "mark head")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", iconRadius)
            .attr("fill", fillStyle.primaryColor);

        // Icon on Circle
        const iconUrl = fillStyle.imageUrls.field[category] || fillStyle.imageUrls.otherPrimary;
        if (iconUrl) {
            const iconSize = iconRadius * 1.5; // Icon slightly larger than radius for visual effect
            group.append("image")
                .attr("class", "icon category-icon")
                .attr("x", circleX - iconSize / 2)
                .attr("y", circleY - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }

        // Category Label
        const categoryLabelText = category;
        // Place category label to the left of the chart, vertically centered in its band
        group.append("text")
            .attr("class", "label category-label")
            .attr("x", -10) // Position left of the main chart group origin (i.e., in margin)
            .attr("y", yPosCentered)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText);


        // Value Label
        const formattedValue = formatValue(value) + (valueFieldUnit ? ` ${valueFieldUnit}` : '');
        group.append("text")
            .attr("class", "value data-value-label")
            .attr("x", circleX + iconRadius + iconPadding * 2)
            .attr("y", circleY)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedValue);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
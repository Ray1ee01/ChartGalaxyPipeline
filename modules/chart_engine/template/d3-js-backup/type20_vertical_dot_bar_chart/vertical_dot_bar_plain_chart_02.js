/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Stacked Pictorial Chart",
  "chart_name": "vertical_stacked_pictorial_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 6], [1, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "bottom",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This chart renders vertical stacks of images, where the height of the stack
    // is determined by a numerical value associated with a category.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: Required field names for 'x' (category) or 'y' (value) roles are not defined in data.data.columns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing. Category or value field not defined.</div>");
        return null;
    }

    const categoryFieldUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x")?.unit || "" : "";
    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y")?.unit || "" : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        primaryColor: colorsConfig.other?.primary || '#FFBB33', // Fallback if images are missing and rects were to be used
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        images: {
            field: imagesConfig.field || {}
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Appending to body to ensure getBBox works, then removing immediately.
        // This is a common pattern, though not strictly "in-memory" without DOM interaction.
        // For true in-memory, a canvas context or more complex setup is needed.
        // Given D3 context, this is a practical approach for SVG text.
        document.body.appendChild(tempSvg);
        const width = tempTextElement.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Space for category labels above stacks
        right: 30,
        bottom: 60, // Space for value labels below stacks
        left: 30
    };

    let maxCategoryLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedCategory = categoryFieldUnit ? `${d[categoryFieldName]}${categoryFieldUnit}` : `${d[categoryFieldName]}`;
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(formattedCategory, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
    });
    
    // Adjust margins if labels are very wide (though less critical for top/bottom labels in vertical bars)
    // For this chart, category labels are above, value labels below, so left/right margins are less impacted by them.

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const displayValueField = `${valueFieldName}_displayCount`;
    const maxValueOriginal = d3.max(chartDataArray, d => Math.abs(+d[valueFieldName]));

    chartDataArray.forEach(d => {
        const originalValue = +d[valueFieldName];
        if (maxValueOriginal > 100) {
            d[displayValueField] = Math.max(1, Math.floor(originalValue / maxValueOriginal * 50));
        } else {
            d[displayValueField] = Math.max(1, Math.round(originalValue)); // Ensure at least 1 item if value > 0
        }
        if (originalValue === 0) d[displayValueField] = 0; // Handle zero values explicitly
    });

    const sortedData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategories = sortedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const columnPadding = 0.3;
    const xScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerWidth])
        .padding(columnPadding);

    const maxStackCount = d3.max(sortedData, d => d[displayValueField]) || 1;

    // Calculate item (image) size and spacing for stacks
    const defaultItemHeight = 20; // Default height of each item in the stack
    const defaultItemSpacing = 3;  // Default vertical spacing between items
    const groupSize = 5;          // Number of items before a larger gap
    const largerGroupSpacingFactor = 1.5; // Larger gap is 1.5x normal spacing

    // Calculate total "units" of height needed: items + normal_spacers + group_spacers
    let totalHeightUnits = 0;
    if (maxStackCount > 0) {
        totalHeightUnits = maxStackCount * defaultItemHeight; // height of all items
        totalHeightUnits += (maxStackCount - 1) * defaultItemSpacing; // height of normal spacers
        const numGroups = Math.ceil(maxStackCount / groupSize);
        if (numGroups > 1 && maxStackCount > groupSize) { // if more than one group exists
             // Add extra for group spacing, subtract normal spacing already counted
            totalHeightUnits += (numGroups -1) * (defaultItemSpacing * largerGroupSpacingFactor - defaultItemSpacing);
        }
    }
    totalHeightUnits = Math.max(totalHeightUnits, defaultItemHeight); // Ensure at least one item height

    let itemHeight, itemSpacing, actualLargerGroupSpacing;
    if (totalHeightUnits > innerHeight && innerHeight > 0) {
        const scaleFactor = innerHeight / totalHeightUnits;
        itemHeight = Math.max(2, defaultItemHeight * scaleFactor);
        itemSpacing = Math.max(1, defaultItemSpacing * scaleFactor);
    } else {
        itemHeight = defaultItemHeight;
        itemSpacing = defaultItemSpacing;
    }
    actualLargerGroupSpacing = itemSpacing * largerGroupSpacingFactor;


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No explicit axes or gridlines for this chart type based on original. Category/value labels serve as guides.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedCategories.forEach(category => {
        const dataPoint = sortedData.find(d => d[categoryFieldName] === category);
        if (!dataPoint) return;

        const columnWidth = xScale.bandwidth();
        const itemWidth = columnWidth * 0.8; // Image width is 80% of column band
        const itemX = xScale(category) + (columnWidth - itemWidth) / 2;
        const stackCount = dataPoint[displayValueField];
        const imageUrl = fillStyle.images.field[dataPoint[categoryFieldName]];

        const categoryGroup = mainChartGroup.append("g")
            .attr("class", "category-group");

        // Render stack of images (or items)
        let currentY = innerHeight; // Start from bottom
        for (let i = 0; i < stackCount; i++) {
            currentY -= itemHeight; // Position for current item

            if (imageUrl) {
                categoryGroup.append("image")
                    .attr("class", "mark")
                    .attr("x", itemX)
                    .attr("y", currentY)
                    .attr("width", itemWidth)
                    .attr("height", itemHeight)
                    .attr("xlink:href", imageUrl)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            } else {
                // Fallback: render a colored rectangle if image is missing
                // As per instructions, if image not found, typically don't render.
                // However, if a fallback is desired, it would be here:
                // categoryGroup.append("rect")
                //     .attr("class", "mark fallback")
                //     .attr("x", itemX)
                //     .attr("y", currentY)
                //     .attr("width", itemWidth)
                //     .attr("height", itemHeight)
                //     .style("fill", fillStyle.primaryColor);
            }
            
            if (i < stackCount - 1) { // If not the last item, add spacing
                if ((i + 1) % groupSize === 0) { // After every 'groupSize' items, add larger spacing
                    currentY -= actualLargerGroupSpacing;
                } else {
                    currentY -= itemSpacing;
                }
            }
        }

        // Add category labels (above the stack, or at the top if stack is short)
        const categoryLabelText = categoryFieldUnit ? `${dataPoint[categoryFieldName]}${categoryFieldUnit}` : `${dataPoint[categoryFieldName]}`;
        categoryGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", xScale(category) + columnWidth / 2)
            .attr("y", -10) // Position above the chart area top margin
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText);

        // Add value labels (below the stack)
        const valueLabelText = valueFieldUnit ? `${formatValue(dataPoint[valueFieldName])}${valueFieldUnit}` : `${formatValue(dataPoint[valueFieldName])}`;
        categoryGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", xScale(category) + columnWidth / 2)
            .attr("y", innerHeight + 20) // Position below the chart area
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueLabelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactoring beyond core chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
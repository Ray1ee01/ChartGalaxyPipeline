/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Image Stack Chart",
  "chart_name": "vertical_image_stack_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 6], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
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
    // This chart displays data as stacks of images, where the height of the stack
    // (number of images) represents a normalized value.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || {};
    const configImages = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);

    if (!xFieldDef || !xFieldDef.name || !yFieldDef || !yFieldDef.name) {
        const missingFields = [];
        if (!xFieldDef || !xFieldDef.name) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldDef || !yFieldDef.name) missingFields.push(`field with role '${yFieldRole}'`);
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    const xField = xFieldDef.name;
    const yField = yFieldDef.name;
    const processedYField = `_processed_${yField}`; // Internal field for normalized values

    const xUnit = (xFieldDef.unit && xFieldDef.unit !== "none") ? xFieldDef.unit : "";
    const yUnit = (yFieldDef.unit && yFieldDef.unit !== "none") ? yFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (configTypography.title && configTypography.title.font_family) ? configTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (configTypography.title && configTypography.title.font_size) ? configTypography.title.font_size : '16px',
            titleFontWeight: (configTypography.title && configTypography.title.font_weight) ? configTypography.title.font_weight : 'bold',
            labelFontFamily: (configTypography.label && configTypography.label.font_family) ? configTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (configTypography.label && configTypography.label.font_size) ? configTypography.label.font_size : '12px',
            labelFontWeight: (configTypography.label && configTypography.label.font_weight) ? configTypography.label.font_weight : 'normal',
            annotationFontFamily: (configTypography.annotation && configTypography.annotation.font_family) ? configTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (configTypography.annotation && configTypography.annotation.font_size) ? configTypography.annotation.font_size : '10px',
            annotationFontWeight: (configTypography.annotation && configTypography.annotation.font_weight) ? configTypography.annotation.font_weight : 'normal',
        },
        textColor: configColors.text_color || '#333333',
        primaryColor: (configColors.other && configColors.other.primary) ? configColors.other.primary : '#FFBB33', // Fallback, though images are primary visuals
        chartBackground: configColors.background_color || '#FFFFFF' // Not used directly by this chart, but good practice
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: The SVG element must be temporarily added to the DOM to getBBox to work reliably across browsers.
        // However, the prompt specifically says "MUST NOT be appended to the document DOM".
        // For most modern browsers, getBBox on an unattached SVG text element works. If issues arise, this is a point to revisit.
        // document.body.appendChild(tempSvg); // If needed for getBBox
        let width = 0;
        try {
             width = tempText.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails on unattached element
            console.warn("getBBox might have issues with unattached SVG in this browser for text width estimation.");
            // A simple character count based estimation as a last resort
            width = text.length * (parseInt(fontSize) * 0.6);
        }
        // tempSvg.remove(); // If it was appended
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Apply background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = {
        top: 90,    // Accommodates category labels above stacks
        right: 30,
        bottom: 40, // Accommodates value labels below stacks
        left: 100
    };

    // Calculate max label widths to adjust margins
    let maxCategoryLabelWidth = 0;
    const uniqueXCategories = [...new Set(chartDataArray.map(d => d[xField]))];
    uniqueXCategories.forEach(category => {
        const formattedCategory = xUnit ? `${category}${xUnit}` : `${category}`;
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(
            formattedCategory,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        ));
    });
    
    // For value labels, width depends on formatted value and x-band width, handled later.
    // The original code adjusted margin.left based on dimension labels and margin.right based on value labels.
    // Here, category labels are centered above columns, so margin.left isn't directly tied to their full width.
    // Value labels are also centered below columns.
    // Let's use a simpler approach for margins or refine if text overlap becomes an issue.
    // For now, the initial margins are kept, assuming they are generally sufficient.
    // If category labels were on the left (like a Y-axis), then margin.left adjustment would be critical.
    // chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 10); // Example if labels were on left

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedValue = yUnit ? `${formatValue(d[yField])}${yUnit}` : `${formatValue(d[yField])}`;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(
            formattedValue,
            fillStyle.typography.annotationFontFamily,
            fillStyle.typography.annotationFontSize,
            fillStyle.typography.annotationFontWeight
        ));
    });
    // Adjust right margin if value labels might overflow, though they are centered under bars.
    // This is more relevant if labels are strictly right-aligned.
    // chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Image stack height calculation parameters
    const defaultImageHeight = 30;
    const defaultImageSpacing = 5;
    const imageGroupSize = 5; // Stack images in groups of 5
    const largerGroupSpacing = 15; // Extra spacing after each group of 5 images

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataArray.map(d => ({ ...d })); // Shallow copy

    const maxRawYValue = d3.max(processedChartData, d => Math.abs(+d[yField]));
    processedChartData.forEach(d => {
        d[processedYField] = +d[yField]; // Use raw value by default
        if (maxRawYValue > 100) { // Normalization logic from original
            d[processedYField] = Math.max(1, Math.floor((+d[yField] / maxRawYValue) * 50));
        }
        d[processedYField] = Math.round(d[processedYField]); // Ensure integer count for images
    });

    const sortedData = [...processedChartData].sort((a, b) => b[yField] - a[yField]);
    const sortedXCategories = sortedData.map(d => d[xField]);
    
    const maxProcessedY = d3.max(sortedData, d => d[processedYField]) || 1; // Max number of images in a stack

    // Calculate actual image height and spacing to fit within innerHeight
    let actualImageHeight, actualImageSpacing, actualLargerGroupSpacing;
    const numGroupsForMaxStack = Math.ceil(maxProcessedY / imageGroupSize);
    const heightForOneImageAndSpacing = defaultImageHeight + defaultImageSpacing;
    
    // Calculate height needed for the tallest stack with default sizes
    let totalHeightNeededForMaxStack = 0;
    if (maxProcessedY > 0) {
        totalHeightNeededForMaxStack = (numGroupsForMaxStack -1) * largerGroupSpacing; // Inter-group spacing
        for (let g = 0; g < numGroupsForMaxStack; g++) {
            const imagesInThisGroup = (g === numGroupsForMaxStack - 1) ? (maxProcessedY - g * imageGroupSize) : imageGroupSize;
            totalHeightNeededForMaxStack += imagesInThisGroup * defaultImageHeight;
            if (imagesInThisGroup > 0) {
                 totalHeightNeededForMaxStack += (imagesInThisGroup - 1) * defaultImageSpacing; // Intra-group spacing
            }
        }
         // Remove last defaultImageSpacing if only one image in last group and it's the only group
        if (maxProcessedY > 0 && maxProcessedY <= imageGroupSize && numGroupsForMaxStack === 1) {
             // if only one image, no spacing. if multiple in one group, (count-1)*spacing
            if (maxProcessedY === 1) totalHeightNeededForMaxStack = defaultImageHeight;
            else totalHeightNeededForMaxStack = maxProcessedY * defaultImageHeight + (maxProcessedY - 1) * defaultImageSpacing;
        } else if (maxProcessedY > 0) {
            // If there are groups, the calculation is more complex.
            // The original calculation was:
            // const groupBaseHeight = groupSize * defaultBarHeight + (groupSize - 1) * defaultBarSpacing;
            // const requiredHeight = requiredGroups * groupBaseHeight + (requiredGroups - 1) * largerGroupSpacing;
            // This seems simpler and more robust:
            let requiredHeightCalc = 0;
            if (maxProcessedY > 0) {
                const numFullGroups = Math.floor((maxProcessedY-1) / imageGroupSize);
                const imagesInLastGroup = maxProcessedY - numFullGroups * imageGroupSize;
                
                requiredHeightCalc = maxProcessedY * defaultImageHeight + // total height of images
                                   (maxProcessedY - numGroupsForMaxStack) * defaultImageSpacing + // total intra-group spacing
                                   (numGroupsForMaxStack > 0 ? (numGroupsForMaxStack - 1) : 0) * largerGroupSpacing; // total inter-group spacing
            }
            totalHeightNeededForMaxStack = requiredHeightCalc;
        }
    }


    if (totalHeightNeededForMaxStack > innerHeight && maxProcessedY > 0) {
        const scaleFactor = innerHeight / totalHeightNeededForMaxStack;
        actualImageHeight = Math.max(3, Math.floor(defaultImageHeight * scaleFactor));
        actualImageSpacing = Math.max(1, Math.floor(defaultImageSpacing * scaleFactor));
        actualLargerGroupSpacing = Math.max(3, Math.floor(largerGroupSpacing * scaleFactor));
    } else {
        actualImageHeight = defaultImageHeight;
        actualImageSpacing = defaultImageSpacing;
        actualLargerGroupSpacing = largerGroupSpacing;
    }
    if (maxProcessedY === 0) { // Handle case with no images
        actualImageHeight = 0;
        actualImageSpacing = 0;
        actualLargerGroupSpacing = 0;
    }


    // Block 6: Scale Definition & Configuration
    const columnPadding = 0.3;
    const xScale = d3.scaleBand()
        .domain(sortedXCategories)
        .range([0, innerWidth])
        .padding(columnPadding);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No separate axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    sortedXCategories.forEach(category => {
        const dataPoint = sortedData.find(d => d[xField] === category);

        if (dataPoint) {
            const columnWidth = xScale.bandwidth();
            const imageStackWidth = columnWidth * 0.8; // Images are 80% of column width
            const imageX = xScale(category) + (columnWidth - imageStackWidth) / 2; // Center images in column

            const imageStackCount = dataPoint[processedYField];
            const imageUrl = configImages.field && configImages.field[dataPoint[xField]] ? configImages.field[dataPoint[xField]] : null;

            let currentY = 0; // Start stacking from the top of the column
            if (imageUrl) {
                for (let i = 0; i < imageStackCount; i++) {
                    mainChartGroup.append("image")
                        .attr("x", imageX)
                        .attr("y", currentY)
                        .attr("width", imageStackWidth)
                        .attr("height", actualImageHeight)
                        .attr("xlink:href", imageUrl)
                        .attr("class", "mark image");

                    currentY += actualImageHeight;
                    if ((i + 1) % imageGroupSize === 0 && i < imageStackCount - 1) { // After a full group, before last image
                        currentY += actualLargerGroupSpacing;
                    } else if (i < imageStackCount - 1) { // Between images within a group
                        currentY += actualImageSpacing;
                    }
                }
            }
            
            const lastImageBottomY = currentY; // Y position for labels below the stack

            // Add category label (acts as X-axis label)
            const formattedCategory = xUnit ? `${category}${xUnit}` : `${category}`;
            mainChartGroup.append("text")
                .attr("x", xScale(category) + columnWidth / 2)
                .attr("y", -10) // Position above the image stacks
                .attr("dy", "0em") // Adjust vertical alignment if needed
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label x-axis-label")
                .text(formattedCategory);

            // Add value label
            const formattedValue = yUnit ? `${formatValue(dataPoint[yField])}${yUnit}` : `${formatValue(dataPoint[yField])}`;
            mainChartGroup.append("text")
                .attr("x", xScale(category) + columnWidth / 2)
                .attr("y", lastImageBottomY + (imageStackCount > 0 ? 5 : 0)) // Position below stack, add padding
                .attr("dy", "0.71em") // Baseline adjustment
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .attr("class", "label value-label")
                .text(formattedValue);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
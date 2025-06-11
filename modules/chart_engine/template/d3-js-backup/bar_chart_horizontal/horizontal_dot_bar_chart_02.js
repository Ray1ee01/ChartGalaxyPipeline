/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Dot Bar Chart",
  "chart_name": "horizontal_dot_bar_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[5, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;

    if (!xField || !yField) {
        console.error("Critical chart config missing: xField or yField is not defined in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration (x or y field) is missing.</div>");
        }
        return null;
    }

    const xFieldUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x")?.unit || "" : "";
    const yFieldUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y")?.unit || "" : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px', // Base, will be dynamic
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#0F223B',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        imageUrls: imagesConfig.field || {},
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden';
        svg.style.position = 'absolute';
        document.body.appendChild(svg); // Needs to be in DOM for getBBox, but won't be visible

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        
        let width = 0;
        try {
             width = textElement.getBBox().width;
        } catch (e) {
            // console.warn("Could not measure text width for:", text, e);
        }
        
        document.body.removeChild(svg);
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
        return d3.format("~.2s")(value); // Use .2s for consistency and to handle small numbers better
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
        .style("background-color", fillStyle.chartBackground);

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 20,
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 20,
        left: variables.margin_left || 100
    };

    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const formattedDimension = xFieldUnit ? `${d[xField]}${xFieldUnit}` : `${d[xField]}`;
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(formattedDimension, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight));
    });
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 10);
    
    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const formattedVal = yFieldUnit ? `${formatValue(d[yField])}${yFieldUnit}` : `${formatValue(d[yField])}`;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(formattedVal, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight));
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15); // 10 for label, 5 for spacing

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartData = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy

    const maxValueInData = d3.max(chartData, d => Math.abs(Number(d[yField]))) || 0;
    const targetMaxUnits = variables.targetMaxUnits || 20; // Max number of visual units for the largest bar
    const unitValue = maxValueInData === 0 ? 1 : Math.ceil(maxValueInData / targetMaxUnits); // Value each unit represents

    chartData.forEach(d => {
        d.displayUnits = maxValueInData === 0 ? 0 : Math.max(0.01, Number(d[yField]) / unitValue); // Ensure very small values get a tiny representation
        if (Number(d[yField]) === 0) d.displayUnits = 0; // Explicitly zero for zero values
    });

    const sortedData = chartData.sort((a, b) => Number(b[yField]) - Number(a[yField]));
    const sortedCategories = sortedData.map(d => d[xField]);

    // Block 6: Scale Definition & Configuration
    const rowPadding = variables.has_spacing === false ? 0.1 : 0.3; // Default to spacing true
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(rowPadding);

    const imageNominalHeight = yScale.bandwidth() * (variables.imageHeightFactor || 0.7);
    const imageNominalWidth = variables.imageNominalWidth || imageNominalHeight; // Default to square-ish images
    const imageNominalSpacing = variables.imageNominalSpacing || Math.max(1, imageNominalWidth * 0.1); // 10% of width or 1px

    let actualImageWidth = imageNominalWidth;
    let actualImageSpacing = imageNominalSpacing;

    const maxDisplayUnitsVal = d3.max(sortedData, d => d.displayUnits) || 1;
    const unitsForLayout = Math.ceil(maxDisplayUnitsVal);

    if (unitsForLayout > 0) {
        const totalNominalWidthNeeded = unitsForLayout * imageNominalWidth + Math.max(0, unitsForLayout - 1) * imageNominalSpacing;
        if (totalNominalWidthNeeded > innerWidth && innerWidth > 0) {
            const scaleFactor = innerWidth / totalNominalWidthNeeded;
            actualImageWidth = imageNominalWidth * scaleFactor;
            actualImageSpacing = imageNominalSpacing * scaleFactor;
        }
    }
    actualImageWidth = Math.max(1, actualImageWidth); // Ensure min width
    actualImageSpacing = Math.max(0, actualImageSpacing); // Ensure non-negative spacing


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per original and simplification.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach((d, i) => {
        const category = d[xField];
        const categoryYPos = yScale(category);
        const bandHeight = yScale.bandwidth();
        const imageY = categoryYPos + (bandHeight - imageNominalHeight) / 2; // Vertically center image in its band allocation

        // Render Category Label
        const categoryLabelText = xFieldUnit ? `${category}${xFieldUnit}` : `${category}`;
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -5)
            .attr("y", categoryYPos + bandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText);

        const imageUrl = fillStyle.imageUrls[category];
        if (!imageUrl) {
            // console.warn(`Image URL not found for category: ${category}. Skipping rendering images for this row.`);
        }

        if (imageUrl && d.displayUnits > 0 && actualImageWidth > 0) {
            const numFullImages = Math.floor(d.displayUnits);
            const partialImageFactor = d.displayUnits - numFullImages;

            for (let j = 0; j < numFullImages; j++) {
                mainChartGroup.append("image")
                    .attr("class", "mark image-unit")
                    .attr("x", j * (actualImageWidth + actualImageSpacing))
                    .attr("y", imageY)
                    .attr("width", actualImageWidth)
                    .attr("height", imageNominalHeight) // Use nominal height, width was scaled
                    .attr("xlink:href", imageUrl)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }

            if (partialImageFactor > 0.001) { // Check for meaningful partial part
                const partialImageX = numFullImages * (actualImageWidth + actualImageSpacing);
                const clipPathId = `clip-path-${String(category).replace(/[\s\W]/g, '_')}-${i}`;

                defs.append("clipPath")
                    .attr("id", clipPathId)
                    .append("rect")
                    .attr("x", partialImageX) // Relative to mainChartGroup's coordinate system
                    .attr("y", imageY)
                    .attr("width", actualImageWidth * partialImageFactor)
                    .attr("height", imageNominalHeight);
                
                mainChartGroup.append("image")
                    .attr("class", "mark image-unit partial-image-unit")
                    .attr("x", partialImageX)
                    .attr("y", imageY)
                    .attr("width", actualImageWidth)
                    .attr("height", imageNominalHeight)
                    .attr("xlink:href", imageUrl)
                    .attr("clip-path", `url(#${clipPathId})`)
                    .attr("preserveAspectRatio", "xMidYMid meet");
            }
        }
        
        // Render Value Label
        const valueLabelXOffset = (Math.ceil(d.displayUnits) * actualImageWidth) + (Math.max(0, Math.ceil(d.displayUnits)-1) * actualImageSpacing) + 5;
        const dynamicFontSize = `${Math.max(8, imageNominalHeight * 0.6)}px`; // Ensure min font size
        const valueLabelText = yFieldUnit ? `${formatValue(d[yField])}${yFieldUnit}` : `${formatValue(d[yField])}`;
        
        mainChartGroup.append("text")
            .attr("class", "value data-label")
            .attr("x", valueLabelXOffset)
            .attr("y", categoryYPos + bandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", dynamicFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueLabelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed shadows, gradients, etc.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
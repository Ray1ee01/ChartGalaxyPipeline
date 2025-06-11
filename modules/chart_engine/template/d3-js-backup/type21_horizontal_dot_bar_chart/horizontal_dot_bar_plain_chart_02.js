/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Image Bar Chart",
  "chart_name": "refactored_horizontal_image_bar_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const dataColumns = data.data.columns || [];

    const rawTypography = data.typography || {};
    const typography = {
        title: { 
            font_family: (rawTypography.title && rawTypography.title.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.title && rawTypography.title.font_size) || "16px",
            font_weight: (rawTypography.title && rawTypography.title.font_weight) || "bold",
        },
        label: {
            font_family: (rawTypography.label && rawTypography.label.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.label && rawTypography.label.font_size) || "12px",
            font_weight: (rawTypography.label && rawTypography.label.font_weight) || "normal",
        },
        annotation: { 
            font_family: (rawTypography.annotation && rawTypography.annotation.font_family) || "Arial, sans-serif",
            font_size: (rawTypography.annotation && rawTypography.annotation.font_size) || "10px",
            font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) || "normal",
        }
    };

    const rawColors = data.colors || {};
    const colors = {
        text_color: rawColors.text_color || "#333333",
        primary: (rawColors.other && rawColors.other.primary) || "#1f77b4", 
        background_color: rawColors.background_color || "#FFFFFF",
        available_colors: rawColors.available_colors || d3.schemeCategory10
    };
    
    const images = data.images || { field: {}, other: {} };

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const categoryFieldUnit = (dataColumns.find(col => col.role === "x") || {}).unit || "";
    const valueFieldUnit = (dataColumns.find(col => col.role === "y") || {}).unit || "";


    if (!categoryFieldName || !valueFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colors.text_color,
        primaryAccent: colors.primary, 
        typography: {
            categoryLabelFontFamily: typography.label.font_family,
            categoryLabelFontSize: typography.label.font_size,
            categoryLabelFontWeight: typography.label.font_weight,
            valueLabelFontFamily: typography.annotation.font_family,
            valueLabelFontSize: typography.annotation.font_size, 
            valueLabelFontWeight: typography.annotation.font_weight,
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // No need to style tempSvg itself, only the text element
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.fontFamily);
        tempTextElement.setAttribute('font-size', fontProps.fontSize);
        tempTextElement.setAttribute('font-weight', fontProps.fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // No DOM append needed for getBBox on SVG text elements
        return tempTextElement.getBBox().width;
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B');
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        // For numbers less than 1000, show up to 2 decimal places if they exist, but not trailing zeros for whole numbers.
        // d3.format(",.2r") might not be ideal. Let's use a custom approach or d3.format("~g")
        if (Number.isInteger(value)) {
            return d3.format(",")(value);
        }
        return d3.format(",.2f")(value); // Show up to 2 decimal places for non-integers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root") // Standardized class
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = {
        top: 20, 
        right: 30,
        bottom: 20,
        left: 100 
    };

    let maxCategoryLabelWidth = 0;
    if (chartData.length > 0) {
        chartData.forEach(d => {
            const labelText = categoryFieldUnit && categoryFieldUnit !== "none" ? `${d[categoryFieldName]}${categoryFieldUnit}` : `${d[categoryFieldName]}`;
            maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(labelText || " ", { // Handle null/undefined labels
                fontFamily: fillStyle.typography.categoryLabelFontFamily,
                fontSize: fillStyle.typography.categoryLabelFontSize,
                fontWeight: fillStyle.typography.categoryLabelFontWeight
            }));
        });
    }
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 15);

    const maxValueForLabelEst = d3.max(chartData, d => +d[valueFieldName]);
    const exampleValueLabel = valueFieldUnit && valueFieldUnit !== "none" ? 
        `${formatValue(maxValueForLabelEst)}${valueFieldUnit}` : 
        `${formatValue(maxValueForLabelEst)}`;
    
    let maxValueLabelWidth = 0;
    if (chartData.length > 0) {
         maxValueLabelWidth = estimateTextWidth(exampleValueLabel || " ", { // Handle null/undefined labels
            fontFamily: fillStyle.typography.valueLabelFontFamily,
            fontSize: fillStyle.typography.valueLabelFontSize, 
            fontWeight: fillStyle.typography.valueLabelFontWeight
        });
    }
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Cannot render chart.");
         d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Chart dimensions too small for content.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const targetMaxImages = 35; 
    const maxValueInData = d3.max(chartData, d => Math.abs(+d[valueFieldName])) || 0;
    
    const unitPerImage = maxValueInData > 0 ? maxValueInData / targetMaxImages : 1; // Avoid division by zero if targetMaxImages is 0, or if maxValueInData is 0.
                                                                                // If maxValueInData is 0, unitPerImage doesn't really matter.
    const imageCountField = `${valueFieldName}_computed_image_count`;

    const processedData = chartData.map(d => {
        const val = +d[valueFieldName];
        return {
            ...d,
            [imageCountField]: val > 0 && unitPerImage > 0 ? Math.max(0.01, val / unitPerImage) : 0 
        };
    });

    const sortedData = [...processedData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedCategoryNames = sortedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategoryNames)
        .range([0, innerHeight])
        .padding(0.3); 

    const rowHeight = yScale.bandwidth();
    const imageHeight = rowHeight; 

    const actualMaxImagesToDraw = d3.max(sortedData, d => d[imageCountField]) || 1; 
    
    const imageSpacing = 4; 
    let imageWidth = (innerWidth - Math.max(0, (actualMaxImagesToDraw - 1)) * imageSpacing) / actualMaxImagesToDraw;
    imageWidth = Math.max(1, imageWidth); // Ensure minimum image width of 1px

    // Block 7: Chart Component Rendering (No explicit axes, gridlines, legend)

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    sortedData.forEach((d, index) => {
        const categoryValue = d[categoryFieldName];
        const numImagesTotal = d[imageCountField]; 
        const numFullImages = Math.floor(numImagesTotal);
        const partialImageFraction = numImagesTotal - numFullImages;
        
        const yPos = yScale(categoryValue);
        if (yPos === undefined || imageHeight <=0 || imageWidth <=0) { 
            return; // Skip if category not in scale or dimensions are non-positive
        }

        const categoryImageURL = images.field && images.field[categoryValue] ? images.field[categoryValue] : null;

        if (categoryImageURL) {
            for (let i = 0; i < numFullImages; i++) {
                mainChartGroup.append("image")
                    .attr("class", "mark image")
                    .attr("xlink:href", categoryImageURL)
                    .attr("x", i * (imageWidth + imageSpacing))
                    .attr("y", yPos)
                    .attr("width", imageWidth)
                    .attr("height", imageHeight);
            }

            if (partialImageFraction > 0.01) { 
                const partialImageX = numFullImages * (imageWidth + imageSpacing);
                const partialImageRenderWidth = imageWidth * partialImageFraction;

                const clipPathId = `clip-path-${String(categoryValue).replace(/[^a-zA-Z0-9_-]/g, '')}-${index}`;
                
                defs.append("clipPath")
                    .attr("id", clipPathId)
                    .append("rect")
                    .attr("x", 0) 
                    .attr("y", 0)
                    .attr("width", partialImageRenderWidth)
                    .attr("height", imageHeight);

                mainChartGroup.append("image")
                    .attr("class", "mark image partial")
                    .attr("xlink:href", categoryImageURL)
                    .attr("x", partialImageX)
                    .attr("y", yPos)
                    .attr("width", imageWidth) 
                    .attr("height", imageHeight)
                    .attr("clip-path", `url(#${clipPathId})`);
            }
        }

        const categoryLabelText = categoryFieldUnit && categoryFieldUnit !== "none" ? 
            `${categoryValue}${categoryFieldUnit}` : 
            `${categoryValue}`;
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -10) 
            .attr("y", yPos + imageHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryLabelText);
        
        const valueLabelText = valueFieldUnit && valueFieldUnit !== "none" ? 
            `${formatValue(d[valueFieldName])}${valueFieldUnit}` : 
            `${formatValue(d[valueFieldName])}`;
        
        const valueLabelXpos = (numImagesTotal * imageWidth) + Math.max(0, (numImagesTotal -1)) * imageSpacing + 5; 
        const dynamicValueLabelFontSize = Math.max(8, Math.min(parseFloat(fillStyle.typography.valueLabelFontSize), imageHeight * 0.6)) + 'px';

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", valueLabelXpos)
            .attr("y", yPos + imageHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-size", dynamicValueLabelFontSize)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(valueLabelText);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this simplified version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
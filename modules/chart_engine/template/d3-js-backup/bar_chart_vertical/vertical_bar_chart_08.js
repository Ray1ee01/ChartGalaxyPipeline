/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_08",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": ["x"],
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
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    if (!xFieldColumn || !xFieldColumn.name || !yFieldColumn || !yFieldColumn.name) {
        const missing = [];
        if (!xFieldColumn || !xFieldColumn.name) missing.push("x field definition");
        if (!yFieldColumn || !yFieldColumn.name) missing.push("y field definition");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldColumn.name;
    const yFieldName = yFieldColumn.name;
    const yFieldUnit = yFieldColumn.unit && yFieldColumn.unit !== "none" ? yFieldColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            // Title fonts are not used as per requirements, but kept for completeness if typography object is generic
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        primaryBarColor: (colorsInput.other && colorsInput.other.primary) || '#4682B4', // Default if no categorical mapping
        defaultCategoricalColors: d3.schemeCategory10, // Fallback for categorical colors
        getImageUrl: (category) => {
            if (imagesInput.field && imagesInput.field[category]) {
                return imagesInput.field[category];
            }
            // No general primary icon specified in requirements, so only field-based images.
            return null;
        },
        getBarColor: (category, index) => {
            if (colorsInput.field && colorsInput.field[category]) {
                return colorsInput.field[category];
            }
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[index % colorsInput.available_colors.length];
            }
            // Fallback to a default categorical scheme if specific field colors or available_colors are missing
            return fillStyle.defaultCategoricalColors[index % fillStyle.defaultCategoricalColors.length];
        }
    };

    const _canvasContext = document.createElement('canvas').getContext('2d');
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        _canvasContext.font = `${fontWeight || 'normal'} ${parseFloat(fontSize)}px ${fontFamily || 'Arial'}`;
        return _canvasContext.measureText(text).width;
    }
    
    const formatValue = (value) => {
        if (value == null || isNaN(value)) return ""; // Handle null or NaN gracefully
        if (value === 0) return "0";
        
        const absoluteValue = Math.abs(value);
        // For numbers less than 1000 (and not zero), show with appropriate precision.
        // d3.format(",.2~f") formats numbers like 123 as "123", 12.345 as "12.35", 12.3 as "12.3".
        if (absoluteValue < 1000 && absoluteValue !== 0) {
             return d3.format(",.2~f")(value);
        }
        // For 1000 and above, use SI prefixes with 2 significant digits.
        // Replace 'G' (Giga) with 'B' (Billions) if that's the desired representation.
        return d3.format("~.2s")(value).replace('G', 'B');
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root other"); // Added "other" as a general class for the root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconSize = 24; // Standard size for icons
    const iconPadding = 5; // Padding around icons / between elements
    const categoryLabelLineHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2; // Estimated line height for category labels
    const valueLabelOffset = 5; // Space above bar for value label
    
    const chartMargins = {
        top: parseFloat(fillStyle.typography.annotationFontSize) + valueLabelOffset + 10, // Space for value labels
        right: 20,
        bottom: categoryLabelLineHeight + iconSize + iconPadding + 20, // Space for category labels and icons
        left: 20
    };

    const innerWidth = Math.max(0, containerWidth - chartMargins.left - chartMargins.right);
    const innerHeight = Math.max(0, containerHeight - chartMargins.top - chartMargins.bottom);

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        xValue: d[xFieldName],
        yValue: +d[yFieldName] // Ensure yValue is numeric
    })).sort((a, b) => b.yValue - a.yValue); // Sort by yValue descending

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.xValue))
        .range([0, innerWidth])
        .padding(0.2);

    const yDataMax = d3.max(chartDataArray, d => d.yValue);
    const yDomainMax = (yDataMax != null && yDataMax > 0) ? yDataMax : 1; // Ensure domain is at least [0,1]
    
    const yScale = d3.scaleLinear()
        .domain([0, yDomainMax]) 
        .range([innerHeight, 0])
        .nice(); // Adjust domain to nice round values, also ensures domain[1] > domain[0]

    // Block 7: Chart Component Rendering (No explicit Axes, Gridlines, Legend, Main Titles/Subtitles)
    // This block is minimal as per requirements. Axes and Gridlines are not rendered.

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added "other"

    // Block 8: Main Data Visualization Rendering (Bars, Value Labels, Category Labels)
    const barElements = mainChartGroup.selectAll(".bar")
        .data(chartDataArray)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d.xValue))
        .attr("y", d => yScale(Math.max(0, d.yValue))) // Bars start from y-value, ensure non-negative
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, innerHeight - yScale(Math.max(0, d.yValue)))) // Height extends to baseline, ensure non-negative
        .attr("fill", (d, i) => fillStyle.getBarColor(String(d.xValue), i));

    // Value labels on top of bars
    mainChartGroup.selectAll(".value-text-label") // More specific class name
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value text") // Added "text"
        .attr("x", d => xScale(d.xValue) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(Math.max(0, d.yValue)) - valueLabelOffset) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => formatValue(d.yValue) + (yFieldUnit ? ` ${yFieldUnit}` : ''));

    // Category labels below bars
    const categoryLabelY = innerHeight + categoryLabelLineHeight * 0.8; // Position below chart area
    mainChartGroup.selectAll(".category-text-label") // More specific class name
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label category text") // Added "text"
        .attr("x", d => xScale(d.xValue) + xScale.bandwidth() / 2)
        .attr("y", categoryLabelY)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            const text = String(d.xValue);
            const maxWidth = xScale.bandwidth();
            let labelText = text;
            if (estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight) > maxWidth) {
                let truncated = "";
                // Iterate characters to build truncated string with ellipsis
                for (const char of text) {
                    if (estimateTextWidth(truncated + char + "...", fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight) > maxWidth) {
                        break;
                    }
                    truncated += char;
                }
                // Ensure ellipsis is added if truncation happened, handle edge cases
                if (truncated.length < text.length) {
                     labelText = truncated + "...";
                     // If even first char + "..." is too long, use first char only (or very short string)
                     if (truncated === "" && text.length > 0) {
                         labelText = text.substring(0,1) + ".."; 
                         if (estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight) > maxWidth) {
                            labelText = text.substring(0,1); // Fallback to just the first character
                         }
                     }
                } else {
                    labelText = truncated; // No truncation needed or text fits
                }
            }
            return labelText;
        });

    // Block 9: Optional Enhancements & Post-Processing (Icons)
    const iconY = categoryLabelY + iconPadding + (iconSize / 2); // Y-center for icons, below category labels
    
    mainChartGroup.selectAll(".icon-image-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "icon image other") // Group for icon, added "other"
        .attr("transform", d => `translate(${xScale(d.xValue) + xScale.bandwidth() / 2}, ${iconY})`)
        .each(function(d) { // `this` refers to the 'g' element
            const imageUrl = fillStyle.getImageUrl(String(d.xValue));
            if (imageUrl) {
                d3.select(this)
                  .append("image")
                  .attr("class", "icon image") // Class on image element itself
                  .attr("xlink:href", imageUrl)
                  .attr("x", -iconSize / 2) // Center image horizontally in the group
                  .attr("y", -iconSize / 2) // Center image vertically in the group
                  .attr("width", iconSize)
                  .attr("height", iconSize)
                  .attr("preserveAspectRatio", "xMidYMid meet");
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
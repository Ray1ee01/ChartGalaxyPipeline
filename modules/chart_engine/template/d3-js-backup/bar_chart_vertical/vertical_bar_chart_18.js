/* REQUIREMENTS_BEGIN
{
  "chart_type": "Perspective Vertical Bar Chart",
  "chart_name": "perspective_vertical_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartRawData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    if (!xFieldCol || !xFieldCol.name || !yFieldCol || !yFieldCol.name) {
        let missingFields = [];
        if (!xFieldCol || !xFieldCol.name) missingFields.push("x field definition (role: 'x')");
        if (!yFieldCol || !yFieldCol.name) missingFields.push("y field definition (role: 'y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = xFieldCol.name;
    const valueFieldName = yFieldCol.name;
    
    const yColUnit = yFieldCol.unit && yFieldCol.unit !== "none" ? yFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
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
        primaryBarColor: (colorsInput.other && colorsInput.other.primary) || '#D32F2F',
        textColor: colorsInput.text_color || '#333333',
        textColorOnPrimary: '#FFFFFF', 
        chartBackgroundColor: colorsInput.background_color || '#FFFFFF',
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const detachedContainer = d3.select(document.createElement("div"));
        const tempD3Svg = detachedContainer.append("svg");
        const tempD3Text = tempD3Svg.append("text")
            .attr("font-family", fontFamily)
            .attr("font-size", fontSize)
            .attr("font-weight", fontWeight)
            .text(text);
        const width = tempD3Text.node().getBBox().width;
        // No need to remove detachedContainer, it will be garbage collected.
        return width;
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: 50, 
        right: 30, 
        // Accommodate perspective elements (100 for extension, 50 for bottom rect) + 50 padding
        bottom: 100 + 50 + 50, 
        left: 40 
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Cannot render.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg} Adjust width/height variables.</div>`);
        }
        return null;
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added 'other' as a general group class

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartRawData.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure numeric
    }));

    const extensionHeight = 100; 
    const offsetStep = 50;       
    const midIndex = Math.floor(processedData.length / 2);

    processedData.forEach((d, i) => {
        d.offset = (i - midIndex) * offsetStep;
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Ensure domain max is at least 1 if data is empty or all 0
        .range([innerHeight, 0])
        .nice();

    const colorScale = (d, i) => {
        const baseColor = fillStyle.primaryBarColor;
        if (i === 0 && processedData.length > 1) {
            return d3.rgb(baseColor).darker(0.7).toString();
        }
        return baseColor;
    };

    // Block 7: Chart Component Rendering (Axes are visually 'none')
    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.selectAll(".bar-item-group") // More specific class name
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-item-group other") // Class for the group of elements for each bar
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    const barWidth = xScale.bandwidth();

    barElements.append("rect")
        .attr("class", "mark main-bar")
        .attr("x", 0)
        .attr("y", d => yScale(d.value))
        .attr("width", barWidth)
        .attr("height", d => Math.max(0, innerHeight - yScale(d.value)))
        .attr("fill", (d, i) => colorScale(d, i));

    barElements.append("path")
        .attr("class", "mark extended-path")
        .attr("d", d => {
            const topLeftX = 0;
            const topLeftY = innerHeight;
            const topRightX = barWidth;
            const topRightY = innerHeight;
            
            const pathPadding = xScale.padding();
            const pathTotalWidth = barWidth * (1 + pathPadding); // Replicating original logic structure
            const pathPaddingWidth = pathTotalWidth * pathPadding; // Replicating original logic structure
            const pathBottomWidth = pathTotalWidth + d.offset - pathPaddingWidth;

            const bottomRightX = topRightX + (pathBottomWidth - barWidth) / 2 + d.offset;
            const bottomRightY = innerHeight + extensionHeight;
            const bottomLeftX = topLeftX - (pathBottomWidth - barWidth) / 2 + d.offset;
            const bottomLeftY = innerHeight + extensionHeight;

            return `M ${topLeftX},${topLeftY} L ${topRightX},${topRightY} L ${bottomRightX},${bottomRightY} L ${bottomLeftX},${bottomLeftY} Z`;
        })
        .attr("fill", (d, i) => colorScale(d, i));

    const bottomRectHeight = 50;
    barElements.append("rect")
        .attr("class", "mark bottom-rect")
        .attr("x", d => {
            const pathPadding = xScale.padding();
            const pathTotalWidth = barWidth * (1 + pathPadding);
            const pathPaddingWidth = pathTotalWidth * pathPadding;
            const pathBottomWidth = pathTotalWidth + d.offset - pathPaddingWidth;
            return -((pathBottomWidth - barWidth) / 2) + d.offset;
        })
        .attr("y", innerHeight + extensionHeight)
        .attr("width", d => {
            const pathPadding = xScale.padding();
            const pathTotalWidth = barWidth * (1 + pathPadding);
            const pathPaddingWidth = pathTotalWidth * pathPadding;
            return pathTotalWidth + d.offset - pathPaddingWidth;
        })
        .attr("height", bottomRectHeight)
        .attr("fill", (d, i) => colorScale(d, i));

    barElements.each(function(d, i) {
        const group = d3.select(this);
        const imageUrl = imagesInput.field && imagesInput.field[d.category] ? imagesInput.field[d.category] : null;

        if (imageUrl) {
            const pathPadding = xScale.padding();
            const pathTotalWidth = barWidth * (1 + pathPadding);
            const pathPaddingWidth = pathTotalWidth * pathPadding;
            const imageWidth = pathTotalWidth + d.offset - pathPaddingWidth;
            const imageHeight = imageWidth; // Assumes square images

            if (imageWidth > 0) { // Only append if width is positive
                group.append("image")
                    .attr("class", "image bottom-image")
                    .attr("x", -((imageWidth - barWidth) / 2) + d.offset)
                    .attr("y", innerHeight + extensionHeight - imageHeight) 
                    .attr("width", imageWidth)
                    .attr("height", imageHeight)
                    .attr("xlink:href", imageUrl);
            }
        }
    });
    
    barElements.append("text")
        .attr("class", "label bottom-text")
        .attr("x", d => { 
            const pathPadding = xScale.padding();
            const pathTotalWidth = barWidth * (1 + pathPadding);
            const pathPaddingWidth = pathTotalWidth * pathPadding;
            const rectWidth = pathTotalWidth + d.offset - pathPaddingWidth;
            return -((rectWidth - barWidth) / 2) + d.offset + (rectWidth / 2);
        })
        .attr("y", innerHeight + extensionHeight + bottomRectHeight / 2)
        .style("fill", fillStyle.textColorOnPrimary)
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .each(function(d) {
            const textElement = d3.select(this);
            const textContent = String(d.category);
            
            const pathPadding = xScale.padding();
            const pathTotalWidth = barWidth * (1 + pathPadding);
            const pathPaddingWidth = pathTotalWidth * pathPadding;
            const maxWidth = (pathTotalWidth + d.offset - pathPaddingWidth) - 10; 

            if (maxWidth <=0) { // No space for text
                textElement.text("");
                return;
            }

            let currentFontSize = parseInt(fillStyle.typography.labelFontSize) || 12;
            textElement.style("font-size", `${currentFontSize}px`);
            
            let measuredWidth = estimateTextWidth(textContent, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

            while (measuredWidth > maxWidth && currentFontSize > 8) {
                currentFontSize -= 1;
                textElement.style("font-size", `${currentFontSize}px`);
                measuredWidth = estimateTextWidth(textContent, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
            }
            if (measuredWidth > maxWidth) {
                 textElement.text(""); // Ellipsis or empty if still too wide
            } else {
                 textElement.text(textContent);
            }
        });

    const labelBgWidth = 40;
    const labelBgHeight = 20;
    const labelVerticalOffset = 15; // Combined offset from bar top (original was 35 total to rect top)

    barElements.append("rect")
        .attr("class", "mark bar-top-label-bg")
        .attr("x", barWidth / 2 - labelBgWidth / 2)
        .attr("y", d => yScale(d.value) - labelBgHeight - labelVerticalOffset + 10) // Adjusted to match original visual y ~35
        .attr("width", labelBgWidth)
        .attr("height", labelBgHeight)
        .attr("fill", (d, i) => colorScale(d, i))
        .attr("rx", 4)
        .attr("ry", 4);

    barElements.append("text")
        .attr("class", "label bar-top-label-text")
        .attr("x", barWidth / 2)
        .attr("y", d => yScale(d.value) - (labelBgHeight / 2) - labelVerticalOffset + 10) // Adjusted for centering
        .style("fill", fillStyle.textColorOnPrimary)
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", parseInt(fillStyle.typography.labelFontSize) * 0.9 + 'px') // Slightly smaller for data values
        .style("font-weight", fillStyle.typography.labelFontWeight) 
        .text(d => `${d.value}${yColUnit ? ` ${yColUnit}` : ''}`);

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactored version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
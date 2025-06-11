/* REQUIREMENTS_BEGIN
{
  "chart_type": "Lollipop Chart",
  "chart_name": "lollipop_icon_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [1, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    let valueUnit = dataColumns.find(col => col.role === "y" && col.unit !== "none")?.unit || "";

    if (!dimensionField || !valueField) {
        console.error("Critical chart config missing: dimensionField or valueField from dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration (dimensionField or valueField) is missing.</div>");
        }
        return null;
    }

    d3.select(containerSelector).html("");

    const initialContainerWidth = variables.width || 800;
    let initialContainerHeight = variables.height || 600;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) || '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) || 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) || '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) || 'normal',
        },
        colors: {
            textColor: colors.text_color || '#333333',
            primary: (colors.other && colors.other.primary) || '#F7941D',
            gridLine: '#e0e0e0', // Default, could be from colors.other.secondary
            // background: colors.background_color || '#FFFFFF', // Not actively used here
        },
        // Images will be sourced directly from the `images` object: e.g., `images.field[dimensionName]`
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("In-memory estimateTextWidth failed. Using fallback.", e);
            width = text.length * (parseFloat(fontSize) * 0.6);
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value); // Use ~g for smaller numbers or if no suffix
    };

    // Block 5: Data Preprocessing & Transformation (executed early for layout calculation)
    const sortedDataArray = [...chartDataInput].sort((a, b) => b[valueField] - a[valueField]);
    const sortedDimensionNames = sortedDataArray.map(d => d[dimensionField]);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let finalContainerHeight = initialContainerHeight;
    if (sortedDimensionNames.length > 15) {
        const extraDimensions = sortedDimensionNames.length - 15;
        const heightAdjustmentFactor = 1 + (extraDimensions * 0.03);
        finalContainerHeight = Math.round(initialContainerHeight * heightAdjustmentFactor);
    }
    
    const chartMargins = { top: 20, right: 150, bottom: 50, left: 150 }; // Adjusted margins for labels
    // Ensure left margin can accommodate potentially long labels if they don't fit on the right
    // Max potential label width on left can be estimated or set to a generous fixed value for margin.
    // For simplicity, using a fixed generous margin. Right margin for value labels.

    const containerWidth = initialContainerWidth;
    const containerHeight = finalContainerHeight;

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Continue Block 4: Layout calculations dependent on final dimensions
    const rowHeight = innerHeight / sortedDimensionNames.length; // yScale.bandwidth() equivalent before scale definition
    const barVisualHeight = Math.max(rowHeight * 0.6, 10); // Height of the lollipop stick/area, min 10px
    const iconRadius = barVisualHeight / 2; // Circle radius based on visual height
    const iconPadding = iconRadius / 4; // Padding around icon/circle

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(1 - (barVisualHeight / rowHeight)); // Adjust padding to achieve barVisualHeight

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedDataArray, d => +d[valueField]) * 1.1 || 10]) // Ensure domain is at least 0-10
        .range([0, innerWidth - (iconRadius * 2 + iconPadding * 2)]); // Space for circle/icon at end

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const gridValues = xScale.ticks(5);
    mainChartGroup.selectAll(".gridline")
        .data(gridValues)
        .enter()
        .append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("y1", 0)
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.colors.gridLine)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3");

    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat(d => formatValue(d));

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").attr("stroke", "none");
    xAxisGroup.selectAll(".tick text")
        .attr("class", "value")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.colors.textColor);

    // Block 8: Main Data Visualization Rendering
    const lollipopGroups = mainChartGroup.selectAll(".lollipop-group")
        .data(sortedDataArray)
        .enter()
        .append("g")
        .attr("class", "lollipop-item-group")
        .attr("transform", d => `translate(0, ${yScale(d[dimensionField]) + yScale.bandwidth() / 2})`);

    lollipopGroups.append("line")
        .attr("class", "mark lollipop-stick")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => xScale(+d[valueField]))
        .attr("y2", 0)
        .attr("stroke", fillStyle.colors.primary)
        .attr("stroke-width", Math.max(2, barVisualHeight / 4)); // Thinner stick

    lollipopGroups.append("circle")
        .attr("class", "mark lollipop-circle")
        .attr("cx", d => xScale(+d[valueField]))
        .attr("cy", 0)
        .attr("r", iconRadius)
        .attr("fill", fillStyle.colors.primary);

    // Icons on circles
    lollipopGroups.each(function(d) {
        const group = d3.select(this);
        const dimensionName = d[dimensionField];
        if (images.field && images.field[dimensionName]) {
            const iconSize = iconRadius * 1.5; // Icon slightly larger than circle radius
            group.append("image")
                .attr("class", "image icon")
                .attr("x", xScale(+d[valueField]) - iconSize / 2)
                .attr("y", -iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", images.field[dimensionName]);
        }
    });
    
    // Dimension Labels
    lollipopGroups.append("text")
        .attr("class", "label dimension-label")
        .each(function(d) {
            const dimensionName = d[dimensionField];
            const textElement = d3.select(this);
            
            const labelText = dimensionName;
            const baseFontSize = parseFloat(fillStyle.typography.labelFontSize);
            let currentFontSize = fillStyle.typography.labelFontSize;

            const estimatedWidth = estimateTextWidth(
                labelText, 
                fillStyle.typography.labelFontFamily, 
                currentFontSize, 
                fillStyle.typography.labelFontWeight
            );

            const spaceToLeftOfStem = chartMargins.left - 10; // Available space in the left margin
            const circleXPos = xScale(+d[valueField]);
            const spaceToLeftOfCircle = circleXPos - iconRadius - 5; // Space available left of circle if label is there

            if (estimatedWidth < spaceToLeftOfStem) { // Prefer placing in left margin if it fits
                 textElement.attr("x", -10) // Place 10px from the start of the stem (in margin)
                           .attr("text-anchor", "end");
            } else if (estimatedWidth < spaceToLeftOfCircle) { // Else, try left of circle
                 textElement.attr("x", circleXPos - iconRadius - 5)
                           .attr("text-anchor", "end");
            } else { // Otherwise, place to the right of the circle
                textElement.attr("x", circleXPos + iconRadius + 5)
                           .attr("text-anchor", "start");
                // Optional: reduce font size if it was too long for other positions (original behavior)
                // For simplicity and adherence to "Configuration Simplification", this reduction is omitted here.
                // If critical, it could be added back, e.g., by scaling font size based on available space.
            }
        })
        .attr("y", 0) // Vertically centered due to group transform
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", function() { return d3.select(this).style('font-size') || fillStyle.typography.labelFontSize; }) // Use calculated or base
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => d[dimensionField]);

    // Value Labels
    lollipopGroups.append("text")
        .attr("class", "value data-value-label")
        .attr("x", d => xScale(+d[valueField]) + iconRadius + iconPadding)
        .attr("y", 0) // Vertically centered due to group transform
        .attr("dy", "0em") // Fine-tune vertical alignment if needed
        .attr("dominant-baseline", "middle")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", `${Math.min(16, Math.max(barVisualHeight * 0.45, parseFloat(fillStyle.typography.annotationFontSize)))}px`)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => {
            const formattedVal = formatValue(+d[valueField]);
            return valueUnit ? `${formattedVal} ${valueUnit}` : formattedVal;
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects, gradients, patterns, or shadows.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
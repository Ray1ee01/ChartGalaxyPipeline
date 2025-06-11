/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Stacked Bar Chart",
  "chart_name": "horizontal_stacked_bar_chart_6",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [2, 4]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const dataColumns = data.data?.columns || [];

    // Clear the container
    d3.select(containerSelector).html("");

    // Critical field name derivation
    const dimensionFieldRole = "x"; // Categorical dimension for Y-axis
    const valueFieldRole = "y";     // Numerical value for X-axis bar length
    const groupFieldRole = "group"; // Categorical group for stacking

    const dimensionColumn = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueColumn = dataColumns.find(col => col.role === valueFieldRole);
    const groupColumn = dataColumns.find(col => col.role === groupFieldRole);

    const dimensionField = dimensionColumn?.name;
    const valueField = valueColumn?.name;
    const groupField = groupColumn?.name;

    const missingFields = [];
    if (!dimensionField) missingFields.push(`field with role '${dimensionFieldRole}'`);
    if (!valueField) missingFields.push(`field with role '${valueFieldRole}'`);
    if (!groupField) missingFields.push(`field with role '${groupFieldRole}'`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const dimensionUnit = (dimensionColumn?.unit && dimensionColumn.unit !== "none") ? dimensionColumn.unit : "";
    const valueUnit = (valueColumn?.unit && valueColumn.unit !== "none") ? valueColumn.unit : "";
    const groupUnit = (groupColumn?.unit && groupColumn.unit !== "none") ? groupColumn.unit : "";


    // Block 2: Style Configuration & Helper Definitions
    const rawTypography = data.typography || {};
    const baseTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const finalTypography = {
        title: { ...baseTypography.title, ...(rawTypography.title || {}) },
        label: { ...baseTypography.label, ...(rawTypography.label || {}) },
        annotation: { ...baseTypography.annotation, ...(rawTypography.annotation || {}) }
    };

    const rawColors = data.colors || data.colors_dark || {};
    const fillStyle = {
        typography: {
            titleFontFamily: finalTypography.title.font_family,
            titleFontSize: finalTypography.title.font_size,
            titleFontWeight: finalTypography.title.font_weight,
            labelFontFamily: finalTypography.label.font_family,
            labelFontSize: finalTypography.label.font_size,
            labelFontWeight: finalTypography.label.font_weight,
            annotationFontFamily: finalTypography.annotation.font_family,
            annotationFontSize: finalTypography.annotation.font_size,
            annotationFontWeight: finalTypography.annotation.font_weight,
        },
        textColor: rawColors.text_color || "#333333",
        chartBackground: rawColors.background_color || "#FFFFFF", // Not used directly on SVG, but available
        defaultCategoricalColor: (index) => d3.schemeCategory10[index % d3.schemeCategory10.length],
        getBarColor: (groupName, groupIndex) => {
            if (rawColors.field && rawColors.field[groupName]) {
                return rawColors.field[groupName];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
            }
            return fillStyle.defaultCategoricalColor(groupIndex);
        }
    };

    const rawImages = data.images || {};
    fillStyle.getIconUrl = (itemName) => {
        if (rawImages.field && rawImages.field[itemName]) {
            return rawImages.field[itemName];
        }
        // No fallback to images.other.primary for field-specific icons unless specified
        return null;
    };
    
    function estimateTextWidth(text, fontSize = fillStyle.typography.labelFontSize, fontFamily = fillStyle.typography.labelFontFamily, fontWeight = fillStyle.typography.labelFontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px';
        tempSvg.style.height = '0px';
        
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        // Document append/remove is necessary for getBBox to work reliably in some environments,
        // but we try to avoid it if possible. For in-memory, it might not be needed if SVG is fully defined.
        // However, for robustness with varying browser SVG implementations for getBBox on non-rendered elements:
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground); // Optional: set background on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconSize = 24;
    const iconPadding = 8;
    const legendSquareSize = 12;
    const legendSpacing = 5;
    const legendItemHeight = parseFloat(fillStyle.typography.labelFontSize) + 5; // Approx height for one line legend
    
    let chartMargins = { top: 20 + legendItemHeight, right: 20, bottom: 30, left: 20 }; // Initial margins

    // Calculate max Y-axis label width (dimension labels + icons)
    let maxDimLabelWidth = 0;
    const tempDimensionsForWidthCalc = [...new Set(chartDataInput.map(d => d[dimensionField]))];
    tempDimensionsForWidthCalc.forEach(dim => {
        const labelText = dim + (dimensionUnit || "");
        let currentLabelWidth = estimateTextWidth(labelText, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight);
        if (fillStyle.getIconUrl(dim)) {
            currentLabelWidth += iconSize + iconPadding;
        }
        maxDimLabelWidth = Math.max(maxDimLabelWidth, currentLabelWidth);
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + 15); // Add some padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const allDimensions = [...new Set(chartDataInput.map(d => d[dimensionField]))];
    const allGroups = [...new Set(chartDataInput.map(d => d[groupField]))];

    // Filter out "Total Paid Leave" group as per original logic
    const displayGroups = allGroups.filter(g => g !== "Total Paid Leave");

    const dimensionTotals = {};
    allDimensions.forEach(dim => {
        dimensionTotals[dim] = 0;
        displayGroups.forEach(group => {
            const dataPoint = chartDataInput.find(d => d[dimensionField] === dim && d[groupField] === group);
            if (dataPoint && !isNaN(parseFloat(dataPoint[valueField]))) {
                dimensionTotals[dim] += +dataPoint[valueField];
            }
        });
    });

    const sortedDimensions = [...allDimensions].sort((a, b) => {
        const diff = dimensionTotals[b] - dimensionTotals[a];
        return diff !== 0 ? diff : a.localeCompare(b);
    });

    const pivotedData = sortedDimensions.map(dim => {
        const entry = { [dimensionField]: dim };
        displayGroups.forEach(group => {
            const dataPoint = chartDataInput.find(d => d[dimensionField] === dim && d[groupField] === group);
            const val = dataPoint ? parseFloat(dataPoint[valueField]) : 0;
            entry[group] = isNaN(val) ? 0 : val;
        });
        return entry;
    });

    const stack = d3.stack().keys(displayGroups);
    const stackedData = stack(pivotedData);
    
    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(0.3); // Padding between dimension bands

    const maxTotalValue = d3.max(pivotedData, d => d3.sum(displayGroups, group => d[group])) || 0;
    
    const xScale = d3.scaleLinear()
        .domain([0, maxTotalValue * 1.05]) // Add 5% padding to max value
        .range([0, innerWidth]);

    // Color scale is implicitly handled by fillStyle.getBarColor

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxis = d3.axisBottom(xScale)
        .ticks(Math.min(5, Math.max(2, Math.floor(innerWidth / 80)))) // Responsive ticks
        .tickSize(0)
        .tickPadding(10)
        .tickFormat(d => {
            const formatted = formatValue(d);
            if (valueUnit && valueUnit.length <= 3) { // Only add unit if short
                return `${formatted}${valueUnit}`;
            }
            return formatted;
        });

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top - legendItemHeight - 5})`);

    let currentX = 0;
    const legendItemMargin = 15;

    displayGroups.forEach((group, i) => {
        const groupLegend = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        groupLegend.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("width", legendSquareSize)
            .attr("height", legendSquareSize)
            .attr("fill", fillStyle.getBarColor(group, i));

        const legendTextContent = group + (groupUnit || "");
        const legendLabel = groupLegend.append("text")
            .attr("class", "label legend-label")
            .attr("x", legendSquareSize + legendSpacing)
            .attr("y", legendSquareSize / 2)
            .attr("dy", "0.35em")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(legendTextContent);
        
        const itemWidth = legendSquareSize + legendSpacing + legendLabel.node().getBBox().width;
        if (currentX + itemWidth > innerWidth && i > 0) { // Basic wrapping: if it overflows and not the first item
            // This is a very simple wrapping, real wrapping is more complex.
            // For this refactor, if it overflows significantly, it will just be cut off or look messy.
            // A more robust solution would calculate rows or adjust font size.
        }
        currentX += itemWidth + legendItemMargin;
    });


    // Block 8: Main Data Visualization Rendering
    const barVisualHeight = yScale.bandwidth() * 0.8; // Make bars take 80% of band height

    // Y-Axis Dimension Labels and Icons
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "y-axis-labels");

    sortedDimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const iconUrl = fillStyle.getIconUrl(dim);
        let textXPosition = -iconPadding;

        if (iconUrl) {
            yAxisLabelsGroup.append("image")
                .attr("class", "icon image dimension-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -(iconSize + iconPadding))
                .attr("y", yPos - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize);
            textXPosition = -(iconSize + iconPadding * 2);
        }
        
        yAxisLabelsGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", textXPosition)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dim + (dimensionUnit || ""));
    });

    // Stacked Bars
    mainChartGroup.selectAll(".stack-group")
        .data(stackedData)
        .join("g")
            .attr("class", d => `mark stack-group series-${d.key.replace(/\s+/g, '-').toLowerCase()}`)
            .attr("fill", (d, i) => fillStyle.getBarColor(d.key, displayGroups.indexOf(d.key)))
        .selectAll("rect")
        .data(d => d.map(item => ({ ...item, key: d.key }))) // Pass key for color context if needed later
        .join("rect")
            .attr("class", "mark bar-segment")
            .attr("x", d => xScale(d[0]))
            .attr("y", d => yScale(d.data[dimensionField]) + (yScale.bandwidth() - barVisualHeight) / 2)
            .attr("width", d => Math.max(0, xScale(d[1]) - xScale(d[0])))
            .attr("height", barVisualHeight);

    // Data Labels on Bars
    const dataLabelsGroup = mainChartGroup.append("g")
        .attr("class", "data-labels");

    stackedData.forEach((series, seriesIdx) => {
        const seriesColor = fillStyle.getBarColor(series.key, displayGroups.indexOf(series.key));
        series.forEach(d => { // d is [start, end], d.data is the pivoted item
            const value = d[1] - d[0];
            if (value === 0) return;

            const barWidthPx = xScale(d[1]) - xScale(d[0]);
            const barCenterX = xScale(d[0]) + barWidthPx / 2;
            const barCenterY = yScale(d.data[dimensionField]) + yScale.bandwidth() / 2;

            const formattedVal = formatValue(value);
            const labelFontSize = fillStyle.typography.annotationFontSize;
            const labelFontFamily = fillStyle.typography.annotationFontFamily;
            const labelFontWeight = fillStyle.typography.annotationFontWeight;

            const textWidth = estimateTextWidth(formattedVal, labelFontSize, labelFontFamily, labelFontWeight);

            if (barWidthPx > textWidth + 6) { // Check if text fits with some padding
                // Determine contrasting text color
                const bgColor = d3.color(seriesColor); // Use d3.color to parse
                const L = bgColor ? d3.hsl(bgColor).l : 0.5; // Calculate luminance
                const labelColor = L > 0.55 ? "#000000" : "#FFFFFF";


                dataLabelsGroup.append("text")
                    .attr("class", "label value data-label")
                    .attr("x", barCenterX)
                    .attr("y", barCenterY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .style("font-family", labelFontFamily)
                    .style("font-size", labelFontSize)
                    .style("font-weight", labelFontWeight)
                    .style("fill", labelColor)
                    .text(formattedVal);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // All complex visual effects (shadows, gradients, rounded corners) and alternating backgrounds removed.
    // Label collision logic simplified to "fit inside or omit".

    // Block 10: Cleanup & SVG Node Return
    // In-memory text measurement SVG is created and discarded within estimateTextWidth.
    return svgRoot.node();
}
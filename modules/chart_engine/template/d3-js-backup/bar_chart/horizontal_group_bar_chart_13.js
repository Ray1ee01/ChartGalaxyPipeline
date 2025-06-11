/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_13",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const inputTypography = data.typography || {};
    const inputColors = data.colors || {}; // Or data.colors_dark if theme switching is handled upstream
    const inputImages = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldDef || !valueFieldDef || !groupFieldDef) {
        console.error("Critical chart config missing: Roles for 'x', 'y', or 'group' not found in dataColumns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing (dimension, value, or group field). Cannot render.</div>");
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        console.error("Critical chart config missing: Field names for 'x', 'y', or 'group' are undefined. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing (field names). Cannot render.</div>");
        }
        return null;
    }
    
    const dimensionUnit = dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";
    // const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : ""; // Not typically used for group labels

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: inputTypography.title?.font_family || "Arial, sans-serif",
            titleFontSize: inputTypography.title?.font_size || "16px",
            titleFontWeight: inputTypography.title?.font_weight || "bold",
            labelFontFamily: inputTypography.label?.font_family || "Arial, sans-serif",
            labelFontSize: inputTypography.label?.font_size || "12px",
            labelFontWeight: inputTypography.label?.font_weight || "normal",
            annotationFontFamily: inputTypography.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: inputTypography.annotation?.font_size || "10px",
            annotationFontWeight: inputTypography.annotation?.font_weight || "normal",
        },
        textColor: inputColors.text_color || '#212529',
        backgroundColor: inputColors.background_color || '#FFFFFF',
        primaryAccent: inputColors.other?.primary || '#007bff',
        // categoryColors will be populated later by colorScale logic
    };
    
    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvgNode.style.visibility = 'hidden'; // Not strictly needed for non-DOM-attached
        // tempSvgNode.style.position = 'absolute'; // Not strictly needed
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontFamily);
        tempTextNode.setAttribute('font-size', fontSize);
        tempTextNode.setAttribute('font-weight', fontWeight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        // document.body.appendChild(tempSvgNode); // DO NOT DO THIS - per directive
        let width = 0;
        try {
            width = tempTextNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-attached elements
            // or for very simple text. This is a rough estimate.
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            width = text.length * avgCharWidth;
            console.warn("getBBox failed for text measurement, using fallback estimation.", e);
        }
        // tempSvgNode.remove(); // If it were attached
        return width;
    }

    function formatValue(value) {
        if (isNaN(value) || value === null) return "N/A";
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value); // Use ~g for general formatting, removes insignificant zeros
    }

    function wrapText(textSelection, textContent, maxWidth, lineHeightEm = 1.1) {
        textSelection.each(function() {
            const textD3 = d3.select(this);
            const words = textContent.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textD3.attr("x") || 0;
            const y = textD3.attr("y") || 0;
            // dy is relative to previous tspan or text y. For first line, it's from y.
            // For dominant-baseline="hanging", dy is fine.
            // For dominant-baseline="middle", need adjustment.
            // Assuming dominant-baseline is handled appropriately by caller or default.
            let tspan = textD3.text(null).append("tspan").attr("x", x).attr("dy", "0em");
            let lineCount = 0;

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = textD3.append("tspan").attr("x", x).attr("dy", lineHeightEm + "em").text(word);
                    lineCount++;
                }
            }
        });
    }
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20, // Reduced as no main title
        right: 30, // Initial, will be adjusted
        bottom: 60, // For legend
        left: 60  // Initial, will be adjusted
    };

    const dimensions = [...new Set(chartDataInput.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartDataInput.map(d => d[groupFieldName]))];

    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(
            labelText,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        ));
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + 15); // 10px padding from axis line + 5px safety

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const valueText = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : `${formatValue(d[valueFieldName])}`;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(
            valueText,
            fillStyle.typography.annotationFontSize,
            fillStyle.typography.annotationFontFamily,
            fillStyle.typography.annotationFontWeight
        ));
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // 5px padding from bar end + 5px safety

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is zero or negative. Cannot render chart.");
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("fill", "red")
            .text("Error: Not enough space to render the chart.");
        return svgRoot.node();
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    // Data is used as is, `dimensions` and `groups` already extracted.
    // No explicit sorting, original order is maintained.

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.2); // Padding between dimension groups

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataInput, d => +d[valueFieldName]) || 1])
        .range([0, innerWidth]);

    const groupColors = {};
    const defaultCategoricalColors = d3.schemeCategory10;
    groups.forEach((group, i) => {
        if (inputColors.field && inputColors.field[group]) {
            groupColors[group] = inputColors.field[group];
        } else if (inputColors.available_colors && inputColors.available_colors.length > 0) {
            groupColors[group] = inputColors.available_colors[i % inputColors.available_colors.length];
        } else {
            groupColors[group] = defaultCategoricalColors[i % defaultCategoricalColors.length];
        }
    });
    fillStyle.categoryColors = groupColors; // Store resolved colors

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map(g => fillStyle.categoryColors[g]));

    // Block 7: Chart Component Rendering (Legend)
    const legendG = svgRoot.append("g")
        .attr("class", "legend");

    let legendCurrentX = 0;
    const legendItemHeight = 20;
    const legendSwatchSize = 15;
    const legendSwatchTextGap = 5;
    const legendItemPadding = 15;

    groups.forEach((groupName) => {
        const legendItemGroup = legendG.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${legendCurrentX}, 0)`);

        legendItemGroup.append("rect")
            .attr("class", "mark")
            .attr("width", legendSwatchSize)
            .attr("height", legendSwatchSize)
            .style("fill", colorScale(groupName));

        const textWidth = estimateTextWidth(
            groupName,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );
        
        const legendTextEl = legendItemGroup.append("text")
            .attr("class", "label")
            .attr("x", legendSwatchSize + legendSwatchTextGap)
            .attr("y", legendSwatchSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .style("text-anchor", "start")
            .text(groupName);
        
        // Simple truncation if text is too long for a very compact legend (optional)
        // if (textWidth > 100) { // Example max width for a legend item text
        //    wrapText(legendTextEl, groupName, 100); 
        // }


        legendCurrentX += legendSwatchSize + legendSwatchTextGap + textWidth + legendItemPadding;
    });

    const legendTotalWidth = Math.max(0, legendCurrentX - legendItemPadding); // Remove last padding
    const legendX = (containerWidth - legendTotalWidth) / 2;
    const legendY = containerHeight - chartMargins.bottom / 2 - legendItemHeight / 2; // Center in bottom margin
    legendG.attr("transform", `translate(${legendX}, ${legendY})`);
    
    // No explicit X or Y axes or gridlines are drawn per simplification. Dimension labels act as Y-axis.

    // Block 8: Main Data Visualization Rendering
    dimensions.forEach(dimension => {
        const dimensionData = chartDataInput.filter(d => d[dimensionFieldName] === dimension);
        const barGroupY = yScale(dimension);
        const barGroupHeight = yScale.bandwidth(); // Total height for this dimension's bars

        // Dimension Label (acts as Y-axis category label)
        const labelTextContent = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", -10) // Position to the left of the chart area
            .attr("y", barGroupY + barGroupHeight / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(labelTextContent);

        if (dimensionData.length > 0) {
            const groupBarSlotHeight = barGroupHeight / groups.length; // Height for each group's bar slot
            const barPaddingInner = 0.1; // 10% padding top and bottom within the slot
            const groupBarActualHeight = groupBarSlotHeight * (1 - 2 * barPaddingInner);

            groups.forEach((group, groupIndex) => {
                const dataPoint = dimensionData.find(d => d[groupFieldName] === group);
                if (dataPoint) {
                    const value = parseFloat(dataPoint[valueFieldName]);
                    if (isNaN(value) || value === null) return; // Skip if no valid value

                    const barWidth = xScale(Math.max(0, value)); // Ensure non-negative width
                    const barY = barGroupY + (groupIndex * groupBarSlotHeight) + (groupBarSlotHeight * barPaddingInner);

                    mainChartGroup.append("rect")
                        .attr("class", `mark value group-${groupIndex}`)
                        .attr("x", 0)
                        .attr("y", barY)
                        .attr("width", barWidth)
                        .attr("height", Math.max(0, groupBarActualHeight))
                        .style("fill", colorScale(group));

                    // Value Label
                    const valueLabelText = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                    mainChartGroup.append("text")
                        .attr("class", "label value-label")
                        .attr("x", barWidth + 5) // Position to the right of the bar
                        .attr("y", barY + groupBarActualHeight / 2)
                        .attr("text-anchor", "start")
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.annotationFontFamily)
                        .style("font-size", fillStyle.typography.annotationFontSize)
                        .style("font-weight", fillStyle.typography.annotationFontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(valueLabelText);
                }
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements like annotations or interactions in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_10",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
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
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const config = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or use a theme switch if data.colors_dark is relevant
    const imagesInput = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const dimensionFieldUnit = dataColumns.find(col => col.role === "x")?.unit || "";
    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit || "";

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push("x-role field ('dimension')");
        if (!valueFieldName) missingFields.push("y-role field ('value')");
        if (!groupFieldName) missingFields.push("group-role field ('group')");
        
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyInput.title?.font_size || '16px',
            titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        axisGuideLineColor: '#CCCCCC', // Default, can be overridden by colors.other if a semantic token is defined
        valueLabelColorDefault: colorsInput.text_color || '#333333',
        valueLabelColorInside: '#FFFFFF',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Not used directly on SVG, but good to have
    };

    fillStyle.barColorProvider = (groupName) => {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            // Simple hash function to get a somewhat consistent color for a group name
            let hash = 0;
            for (let i = 0; i < groupName.length; i++) {
                hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % colorsInput.available_colors.length;
            return colorsInput.available_colors[index];
        }
        return colorsInput.other?.primary || '#3ca951'; // Default primary color
    };

    fillStyle.iconProvider = (dimensionValue) => {
        return imagesInput.field && imagesInput.field[dimensionValue] ? imagesInput.field[dimensionValue] : null;
    };
    
    function estimateTextWidth(text, fontProps) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        textElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        textElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        svg.appendChild(textElement);
        // Appending to body is more reliable for getBBox but forbidden by directives.
        // document.body.appendChild(svg); // Temporarily append
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg); // Clean up
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for Billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // General format for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: config.marginTop || 40,
        right: config.marginRight || 60,
        bottom: config.marginBottom || 30,
        left: config.marginLeft || 40 // Initial, will be recalculated
    };

    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;

    // Calculate max dimension label width
    const uniqueDimensionValues = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    let maxDimensionLabelWidth = 0;
    uniqueDimensionValues.forEach(dimValue => {
        const labelText = dimensionFieldUnit !== "none" && dimensionFieldUnit ? `${dimValue}${dimensionFieldUnit}` : `${dimValue}`;
        const width = estimateTextWidth(labelText, { 
            fontFamily: fillStyle.typography.labelFontFamily, 
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });
    
    const baseLeftPadding = 10;
    chartMargins.left = maxDimensionLabelWidth + iconPadding + iconWidth + iconPadding + baseLeftPadding;

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroupValues = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    const groupedData = {};
    uniqueGroupValues.forEach(group => {
        const groupItems = chartDataArray.filter(d => d[groupFieldName] === group);
        groupedData[group] = [...groupItems].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    });

    let totalBars = 0;
    uniqueGroupValues.forEach(group => {
        totalBars += groupedData[group].length;
    });
    const numGroups = uniqueGroupValues.length;

    const groupPaddingRatio = 0.15;
    const groupPadding = innerHeight * groupPaddingRatio / (numGroups > 1 ? (numGroups -1) : 1); // Avoid division by zero if only one group
    const totalGroupPadding = numGroups > 1 ? groupPadding * (numGroups - 1) : 0;
    
    const availableForBars = innerHeight - totalGroupPadding;
    
    const barPaddingRatio = 0.15;
    const idealBarUnitHeight = totalBars > 0 ? availableForBars / totalBars : 20; // Avoid division by zero
    
    let calculatedBarHeight = idealBarUnitHeight * (1 - barPaddingRatio);
    const barHeight = Math.min(Math.max(calculatedBarHeight, 5), 40); // Ensure min height for visibility
    const barPadding = totalBars > 1 ? idealBarUnitHeight - barHeight : 0;

    const groupHeights = {};
    const groupOffsets = {};
    let currentOffset = chartMargins.top;

    uniqueGroupValues.forEach(group => {
        const itemCount = groupedData[group].length;
        const groupHeight = itemCount * barHeight + (itemCount > 0 ? (itemCount - 1) * barPadding : 0);
        groupHeights[group] = groupHeight;
        groupOffsets[group] = currentOffset;
        currentOffset += groupHeight + (numGroups > 1 ? groupPadding : 0) ;
    });
    
    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (maxValue || 0) * 1.05]) // Handle case where maxValue might be 0 or undefined
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, 0)`);

    mainChartGroup.append("line")
        .attr("class", "other axis-guide-line")
        .attr("x1", 0)
        .attr("y1", chartMargins.top)
        .attr("x2", 0)
        .attr("y2", containerHeight - chartMargins.bottom)
        .attr("stroke", fillStyle.axisGuideLineColor)
        .attr("stroke-width", 3);

    // Render group labels (annotations)
    uniqueGroupValues.forEach(group => {
        const groupData = groupedData[group];
        if (groupData.length > 0) {
            const groupOffset = groupOffsets[group];
            const lastItemIndex = groupData.length - 1;
            const lastItemY = groupOffset + lastItemIndex * (barHeight + barPadding) + barHeight / 2;

            mainChartGroup.append("text")
                .attr("class", "label group-label")
                .attr("x", innerWidth + 5) // Position to the right of the bars
                .attr("y", lastItemY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group);
        }
    });

    // Block 8: Main Data Visualization Rendering
    uniqueGroupValues.forEach(group => {
        const groupDataItems = groupedData[group];
        const groupOffset = groupOffsets[group];
        const barColor = fillStyle.barColorProvider(group);

        groupDataItems.forEach((d, i) => {
            const yPos = groupOffset + i * (barHeight + barPadding);
            const barWidthValue = xScale(+d[valueFieldName]);
            
            // Bar
            mainChartGroup.append("rect")
                .attr("class", "mark bar")
                .attr("x", 0)
                .attr("y", yPos)
                .attr("width", barWidthValue > 0 ? barWidthValue : 0) // Ensure non-negative width
                .attr("height", barHeight)
                .attr("fill", barColor);
                // Removed rx, ry for simplification as per directive V.2 & V.3

            const dimensionValue = d[dimensionFieldName];
            
            // Dimension Icon
            const iconX = -iconWidth - iconPadding;
            const iconY = yPos + (barHeight - iconHeight) / 2;
            const iconUrl = fillStyle.iconProvider(dimensionValue);
            if (iconUrl) {
                mainChartGroup.append("image")
                    .attr("class", "icon dimension-icon")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl);
            }

            // Dimension Label
            const labelX = iconX - iconPadding;
            const labelY = yPos + barHeight / 2;
            const formattedDimension = dimensionFieldUnit !== "none" && dimensionFieldUnit ? 
                `${dimensionValue}${dimensionFieldUnit}` : 
                `${dimensionValue}`;

            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedDimension);

            // Value Label
            const formattedValueText = valueFieldUnit !== "none" && valueFieldUnit ?
                `${formatValue(d[valueFieldName])}${valueFieldUnit}` :
                `${formatValue(d[valueFieldName])}`;

            const valueLabelFontProps = {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize, // Using fixed size from typography
                fontWeight: fillStyle.typography.annotationFontWeight
            };
            const valueLabelWidth = estimateTextWidth(formattedValueText, valueLabelFontProps);
            const valueLabelPadding = 10;

            let valueLabelX, valueLabelAnchor, valueLabelFillColor;
            if (valueLabelWidth + valueLabelPadding < barWidthValue) { // Place inside
                valueLabelX = barWidthValue / 2;
                valueLabelAnchor = "middle";
                valueLabelFillColor = fillStyle.valueLabelColorInside;
            } else { // Place outside
                valueLabelX = barWidthValue + 5;
                valueLabelAnchor = "start";
                valueLabelFillColor = fillStyle.valueLabelColorDefault;
            }
            
            if (d[valueFieldName] !== null && d[valueFieldName] !== undefined) { // Only render if value exists
                mainChartGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("x", valueLabelX)
                    .attr("y", yPos + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", valueLabelAnchor)
                    .style("font-family", valueLabelFontProps.fontFamily)
                    .style("font-size", valueLabelFontProps.fontSize)
                    .style("font-weight", valueLabelFontProps.fontWeight)
                    .style("fill", valueLabelFillColor)
                    .text(formattedValueText);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed mouseover effects for simplification.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
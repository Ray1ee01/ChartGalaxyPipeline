/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 8], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const imagesInput = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldRole = "x";
    const valueFieldRole = "y";
    const groupFieldRole = "group";

    const dimensionFieldDef = dataColumns.find(col => col.role === dimensionFieldRole);
    const valueFieldDef = dataColumns.find(col => col.role === valueFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueFieldName = valueFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;

    const dimensionFieldUnit = dimensionFieldDef?.unit !== "none" ? dimensionFieldDef?.unit : "";
    const valueFieldUnit = valueFieldDef?.unit !== "none" ? valueFieldDef?.unit : "";
    // const groupFieldUnit = groupFieldDef?.unit !== "none" ? groupFieldDef?.unit : ""; // Not typically used for display

    if (!dimensionFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!dimensionFieldName) missingFields.push(`role '${dimensionFieldRole}'`);
        if (!valueFieldName) missingFields.push(`role '${valueFieldRole}'`);
        if (!groupFieldName) missingFields.push(`role '${groupFieldRole}'`);
        
        const errorMessage = `Critical chart config missing: field(s) for ${missingFields.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("padding", "10px")
                .html(errorMessage);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = typographyInput.title?.font_family || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = typographyInput.title?.font_size || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = typographyInput.title?.font_weight || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = typographyInput.label?.font_family || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = typographyInput.label?.font_size || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = typographyInput.label?.font_weight || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = typographyInput.annotation?.font_family || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = typographyInput.annotation?.font_size || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = typographyInput.annotation?.font_weight || defaultTypography.annotation.font_weight;

    // Color defaults & parsing
    fillStyle.textColor = colorsInput.text_color || '#333333';
    fillStyle.chartBackground = colorsInput.background_color || '#FFFFFF'; // Applied to SVG if needed, or container by user
    fillStyle.barValueLabelColor = '#FFFFFF'; // For text inside bars
    fillStyle.barValueLabelColorOutside = fillStyle.textColor;
    fillStyle.groupLabelBackgroundColor = '#F0F0F0'; // Default for group label background

    function getGroupColor(groupName, groupIndex) {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
        }
        const defaultScheme = d3.schemeCategory10;
        return defaultScheme[groupIndex % defaultScheme.length];
    }
    
    function estimateTextWidth(text, fontProps) {
        if (!text || text.length === 0) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox if element is properly defined
        return tempText.getBBox().width;
    }

    function estimateTextHeight(text, fontProps) {
        if (!text || text.length === 0) text = "Ag"; // Use placeholder for height estimation
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        return tempText.getBBox().height;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value); // Fallback for smaller numbers
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Defs for future use, e.g. patterns, though not used now.
    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 20,
        right: 80, // For value labels outside bars
        bottom: 30,
        left: 150  // Initial, will be adjusted
    };

    const uniqueDimensionNamesForLabelCalc = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    let maxDimensionWidth = 0;
    uniqueDimensionNamesForLabelCalc.forEach(dimName => {
        const width = estimateTextWidth(dimName, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize, // Use base label size for this calc
            font_weight: fillStyle.typography.labelFontWeight
        });
        if (width > maxDimensionWidth) maxDimensionWidth = width;
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimensionWidth + 15); // 10 for padding, 5 for safety

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const uniqueGroupNames = [...new Set(chartData.map(d => d[groupFieldName]))];

    const groupLabelFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: fillStyle.typography.labelFontSize,
        font_weight: "bold" // Group labels are typically bold
    };
    const groupTitleTextHeight = estimateTextHeight("Ag", groupLabelFontProps); // Estimate height of group title text
    const groupTitleHeight = groupTitleTextHeight + 10; // Add padding for the group title area
    const groupMargin = 20; // Space between groups

    const dimensionsPerGroup = {};
    let totalDimensionsCount = 0;
    uniqueGroupNames.forEach(groupName => {
        const groupData = chartData.filter(d => d[groupFieldName] === groupName);
        const groupDimensionNames = [...new Set(groupData.map(d => d[dimensionFieldName]))];
        dimensionsPerGroup[groupName] = groupDimensionNames.length;
        totalDimensionsCount += groupDimensionNames.length;
    });
    
    const totalGroupMargins = Math.max(0, (uniqueGroupNames.length - 1)) * groupMargin;
    const totalGroupTitlesHeight = uniqueGroupNames.length * groupTitleHeight;
    
    const availableBarSpace = innerHeight - totalGroupMargins - totalGroupTitlesHeight;
    const idealBarHeight = totalDimensionsCount > 0 ? availableBarSpace / totalDimensionsCount : 20; // Avoid division by zero
    const barPadding = idealBarHeight * 0.2; // Padding between bars within a group

    const groupPositions = {};
    let currentY = 0;
    uniqueGroupNames.forEach(groupName => {
        const numDimensionsInGroup = dimensionsPerGroup[groupName];
        const totalBarSpacingInGroup = Math.max(0, (numDimensionsInGroup - 1)) * barPadding;
        const totalBarsHeightInGroup = numDimensionsInGroup * idealBarHeight;
        const groupHeight = groupTitleHeight + totalBarsHeightInGroup + totalBarSpacingInGroup;

        groupPositions[groupName] = {
            startY: currentY,
            height: groupHeight,
            barHeight: idealBarHeight, // Actual height of one bar
            barPadding: barPadding,
            titleHeight: groupTitleHeight
        };
        currentY += groupHeight + groupMargin;
    });

    // Block 5: Data Preprocessing & Transformation
    // `uniqueGroupNames` and `dimensionsPerGroup` already calculated.
    // `chartData` is already in a usable array format.

    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartData, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue * 1.1 : 1]) // Ensure domain is at least [0,1] if maxValue is 0 or negative
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (Group Labels)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    uniqueGroupNames.forEach((groupName) => {
        const groupPos = groupPositions[groupName];
        const groupLabelY = groupPos.startY + groupPos.titleHeight / 2;

        const groupContainerG = mainChartGroup.append("g")
            .attr("class", "group-container")
            .attr("transform", `translate(0, ${groupPos.startY})`);

        // Group Label Background (simplified)
        const groupLabelTextWidth = estimateTextWidth(groupName, groupLabelFontProps);
        const rectPadding = { x: 6, y: 4 };
        const bgRectX = -chartMargins.left; // Align with the very left edge of the chart area
        const bgRectY = (groupPos.titleHeight - (groupTitleTextHeight + rectPadding.y * 2)) / 2; // Center background vertically in title area
        const bgRectWidth = groupLabelTextWidth + rectPadding.x * 2;
        const bgRectHeight = groupTitleTextHeight + rectPadding.y * 2;
        
        groupContainerG.append("rect")
            .attr("class", "group-label-background")
            .attr("x", bgRectX)
            .attr("y", bgRectY)
            .attr("width", bgRectWidth)
            .attr("height", bgRectHeight)
            .attr("fill", fillStyle.groupLabelBackgroundColor);

        // Group Label Text
        groupContainerG.append("text")
            .attr("class", "label group-label-text")
            .attr("x", bgRectX + rectPadding.x)
            .attr("y", groupPos.titleHeight / 2)
            .attr("dy", "0.35em") // Vertical centering
            .attr("text-anchor", "start")
            .style("font-family", groupLabelFontProps.font_family)
            .style("font-size", groupLabelFontProps.font_size)
            .style("font-weight", groupLabelFontProps.font_weight)
            .style("fill", fillStyle.textColor)
            .text(groupName);

        // Block 8: Main Data Visualization Rendering (Bars & Value Labels)
        // This is done within the group loop for context.
        const groupData = chartData.filter(d => d[groupFieldName] === groupName);
        const groupDimensionNames = [...new Set(groupData.map(d => d[dimensionFieldName]))]; // Maintain order from data for this group

        groupDimensionNames.forEach((dimName, dimIndex) => {
            const dataPoint = groupData.find(d => d[dimensionFieldName] === dimName);
            if (dataPoint) {
                const barBaseY = groupPos.titleHeight + dimIndex * (groupPos.barHeight + groupPos.barPadding);
                const barWidth = xScale(Math.max(0, +dataPoint[valueFieldName])); // Ensure width is not negative
                const barHeight = groupPos.barHeight;
                const barColor = getGroupColor(groupName, uniqueGroupNames.indexOf(groupName));

                // Bar
                groupContainerG.append("rect")
                    .attr("class", "mark bar")
                    .attr("x", 0)
                    .attr("y", barBaseY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", barColor);

                // Value Label
                let formattedValue = formatValue(+dataPoint[valueFieldName]);
                if (valueFieldUnit) {
                    formattedValue += valueFieldUnit;
                }
                
                const valueLabelEffectiveSize = Math.min(barHeight * 0.8, parseFloat(fillStyle.typography.annotationFontSize));
                const valueLabelFontProps = {
                    font_family: fillStyle.typography.annotationFontFamily,
                    font_size: `${valueLabelEffectiveSize}px`,
                    font_weight: fillStyle.typography.annotationFontWeight
                };
                const valueLabelTextWidth = estimateTextWidth(formattedValue, valueLabelFontProps);
                const valueLabelPadding = 5;

                const valueLabelTextElement = groupContainerG.append("text")
                    .attr("class", "value text value-label")
                    .attr("y", barBaseY + barHeight / 2)
                    .attr("dy", "0.35em")
                    .style("font-family", valueLabelFontProps.font_family)
                    .style("font-size", valueLabelFontProps.font_size)
                    .style("font-weight", valueLabelFontProps.font_weight)
                    .style("pointer-events", "none")
                    .text(formattedValue);

                if (barWidth < valueLabelTextWidth + valueLabelPadding * 2) { // Place outside
                    valueLabelTextElement
                        .attr("x", barWidth + valueLabelPadding)
                        .attr("text-anchor", "start")
                        .style("fill", fillStyle.barValueLabelColorOutside);
                } else { // Place inside
                    valueLabelTextElement
                        .attr("x", barWidth - valueLabelPadding)
                        .attr("text-anchor", "end")
                        .style("fill", fillStyle.barValueLabelColor);
                }

                // Block 9: Optional Enhancements & Post-Processing (Dimension Labels)
                // Rendered here for correct Y positioning relative to the bar
                const dimensionLabelEffectiveSize = Math.min(barHeight * 0.8, parseFloat(fillStyle.typography.labelFontSize));
                groupContainerG.append("text")
                    .attr("class", "label dimension-label")
                    .attr("x", -valueLabelPadding) // Position to the left of the bar start
                    .attr("y", barBaseY + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", `${dimensionLabelEffectiveSize}px`)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(dimName + (dimensionFieldUnit ? ` (${dimensionFieldUnit})` : ""));
            }
        });
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
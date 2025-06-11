/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const primaryGroupFieldConfig = dataColumns.find(col => col.role === "group");

    const criticalFields = {};
    if (dimensionFieldConfig) criticalFields.dimensionFieldName = dimensionFieldConfig.name;
    if (valueFieldConfig) criticalFields.valueFieldName = valueFieldConfig.name;
    if (primaryGroupFieldConfig) criticalFields.primaryGroupFieldName = primaryGroupFieldConfig.name;

    const missingFields = Object.entries(criticalFields)
        .filter(([key, value]) => value === undefined)
        .map(([key]) => key.replace("Name", ""));

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const { dimensionFieldName, valueFieldName, primaryGroupFieldName } = criticalFields;

    const dimensionUnit = dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSizeBase: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? parseFloat(typographyConfig.annotation.font_size) : 10, // For dynamic sizing
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not used for SVG background, but available
        axisLineColor: '#CCCCCC',
        defaultBarColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#3ca951',
        getBarColor: (group) => {
            if (colorsConfig.field && colorsConfig.field[group]) {
                return colorsConfig.field[group];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                // Simple hash function to pick a color based on group name
                let hash = 0;
                for (let i = 0; i < group.length; i++) {
                    hash = group.charCodeAt(i) + ((hash << 5) - hash);
                }
                return colorsConfig.available_colors[Math.abs(hash) % colorsConfig.available_colors.length];
            }
            return fillStyle.defaultBarColor;
        },
        valueLabelContrastColor: '#FFFFFF', // For labels inside bars
    };

    function estimateTextWidth(text, styleProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px'; // Ensure it doesn't affect layout
        tempSvg.style.height = '0px';

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (styleProps.fontFamily) tempText.style.fontFamily = styleProps.fontFamily;
        if (styleProps.fontSize) tempText.style.fontSize = styleProps.fontSize;
        if (styleProps.fontWeight) tempText.style.fontWeight = styleProps.fontWeight;
        tempText.textContent = text;

        tempSvg.appendChild(tempText);
        // Appending to body is necessary for getBBox to work reliably in some browsers,
        // but it should be extremely brief and removed immediately.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        // No viewBox, fixed dimensions as per requirements

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;
    const baseLeftPadding = 10;
    const baseRightPadding = 10; // For group labels

    const dimensionsForLabelCalc = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    let maxDimensionLabelWidth = 0;
    dimensionsForLabelCalc.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(formattedDim, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });
    
    const primaryGroupsForLabelCalc = [...new Set(chartDataArray.map(d => d[primaryGroupFieldName]))];
    let maxGroupNoteWidth = 0;
    primaryGroupsForLabelCalc.forEach(group => {
        const width = estimateTextWidth(group, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        if (width > maxGroupNoteWidth) maxGroupNoteWidth = width;
    });

    const chartMargins = {
        top: chartConfig.marginTop || 40,
        right: chartConfig.marginRight || Math.max(60, maxGroupNoteWidth + baseRightPadding + 20), // Ensure space for group labels
        bottom: chartConfig.marginBottom || 30,
        left: chartConfig.marginLeft || (maxDimensionLabelWidth + iconPadding + iconWidth + iconPadding + baseLeftPadding)
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, 0)`) // Top margin applied by group offsets
        .attr("class", "main-chart-group");

    // Bar and Group Layout
    const numPrimaryGroups = primaryGroupsForLabelCalc.length;
    let totalBars = chartDataArray.length;

    const groupPaddingRatio = 0.15;
    const groupPadding = innerHeight * groupPaddingRatio / (numPrimaryGroups > 1 ? (numPrimaryGroups +1) : 2 ); // Avoid division by zero if only one group

    const availableHeightForBarsAndPadding = innerHeight - (numPrimaryGroups > 1 ? groupPadding * (numPrimaryGroups - 1) : 0);
    
    const barPaddingRatio = 0.15;
    const idealBarUnitHeight = totalBars > 0 ? availableHeightForBarsAndPadding / totalBars : 20; // Default if no bars
    
    let calculatedBarHeight = idealBarUnitHeight * (1 - barPaddingRatio);
    const barHeight = Math.min(Math.max(5, calculatedBarHeight), 40); // Min height 5px, Max height 40px
    const barPadding = totalBars > 1 ? idealBarUnitHeight - barHeight : 0;


    // Block 5: Data Preprocessing & Transformation
    const uniquePrimaryGroups = [...new Set(chartDataArray.map(d => d[primaryGroupFieldName]))];
    
    const groupedData = {};
    uniquePrimaryGroups.forEach(group => {
        const groupItems = chartDataArray.filter(d => d[primaryGroupFieldName] === group);
        groupedData[group] = [...groupItems].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    });

    const groupHeights = {};
    const groupOffsets = {};
    let currentOffset = chartMargins.top;

    uniquePrimaryGroups.forEach(group => {
        const itemCount = groupedData[group] ? groupedData[group].length : 0;
        const groupContentHeight = itemCount * barHeight + (itemCount > 0 ? (itemCount - 1) * barPadding : 0);
        groupHeights[group] = groupContentHeight;
        groupOffsets[group] = currentOffset;
        currentOffset += groupContentHeight + groupPadding;
    });
    
    // Adjust total height if calculated content exceeds containerHeight (optional, good practice)
    const totalCalculatedHeight = currentOffset - groupPadding + chartMargins.bottom;
    if (totalCalculatedHeight > containerHeight && chartConfig.dynamicHeight !== false) {
        // This part is tricky with fixed SVG height. For now, we assume content fits.
        // If it overflows, it will be clipped by SVG boundary.
        // console.warn("Chart content might overflow available height.");
    }


    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (maxValue || 0) * 1.05]) // Handle empty data, add 5% padding
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    mainChartGroup.append("line")
        .attr("class", "axis y-axis-guide")
        .attr("x1", 0)
        .attr("y1", chartMargins.top)
        .attr("x2", 0)
        .attr("y2", containerHeight - chartMargins.bottom)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 3);

    // Block 8: Main Data Visualization Rendering
    uniquePrimaryGroups.forEach(groupName => {
        const currentGroupData = groupedData[groupName] || [];
        const groupOffsetY = groupOffsets[groupName];
        const groupColor = fillStyle.getBarColor(groupName);

        const groupG = mainChartGroup.append("g")
            .attr("class", `chart-group ${String(groupName).replace(/\s+/g, '-').toLowerCase()}`);

        // Render Group Label (Annotation)
        if (currentGroupData.length > 0) {
            const lastItemIndex = currentGroupData.length - 1;
            const lastItemYCenter = groupOffsetY + lastItemIndex * (barHeight + barPadding) + barHeight / 2;
            
            groupG.append("text")
                .attr("class", "label group-label")
                .attr("x", innerWidth + 10) // Position to the right of the bars
                .attr("y", lastItemYCenter)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(groupName);
        }

        currentGroupData.forEach((dataPoint, index) => {
            const yPos = groupOffsetY + index * (barHeight + barPadding);
            const barRenderWidth = xScale(+dataPoint[valueFieldName]);
            const itemG = groupG.append("g").attr("class", "chart-item");

            // Bar
            itemG.append("rect")
                .attr("class", "mark bar")
                .attr("x", 0)
                .attr("y", yPos)
                .attr("width", Math.max(0, barRenderWidth)) // Ensure non-negative width
                .attr("height", barHeight)
                .attr("fill", groupColor);
                // Removed rx, ry, and hover effects per requirements

            // Dimension Icon
            const dimensionValue = dataPoint[dimensionFieldName];
            const iconX = -iconWidth - iconPadding;
            const iconY = yPos + (barHeight - iconHeight) / 2;

            if (imagesConfig.field && imagesConfig.field[dimensionValue]) {
                itemG.append("image")
                    .attr("class", "icon dimension-icon")
                    .attr("x", iconX)
                    .attr("y", iconY)
                    .attr("width", iconWidth)
                    .attr("height", iconHeight)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", imagesConfig.field[dimensionValue]);
            }

            // Dimension Label
            const labelX = iconX - iconPadding;
            const labelY = yPos + barHeight / 2;
            const formattedDimension = dimensionUnit ? `${dimensionValue}${dimensionUnit}` : `${dimensionValue}`;

            itemG.append("text")
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
            const formattedValue = valueUnit ? `${formatValue(+dataPoint[valueFieldName])}${valueUnit}` : `${formatValue(+dataPoint[valueFieldName])}`;
            const valueLabelFontSize = `${Math.max(8, barHeight * 0.6)}px`; // Dynamic font size, min 8px
            
            const valueLabelTextWidth = estimateTextWidth(formattedValue, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: valueLabelFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight
            });

            const valueLabelPadding = 10; // 5px on each side if inside
            let valueLabelX, valueLabelAnchor, valueLabelFill;

            if (valueLabelTextWidth + valueLabelPadding < barRenderWidth) { // Fits inside
                valueLabelX = barRenderWidth / 2;
                valueLabelAnchor = "middle";
                valueLabelFill = fillStyle.valueLabelContrastColor;
            } else { // Place outside
                valueLabelX = barRenderWidth + 5;
                valueLabelAnchor = "start";
                valueLabelFill = fillStyle.textColor;
            }

            itemG.append("text")
                .attr("class", "label value-label")
                .attr("x", valueLabelX)
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", valueLabelAnchor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", valueLabelFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", valueLabelFill)
                .text(formattedValue);
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No enhancements specified beyond core rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
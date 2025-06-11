/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_11",
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

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // Original function name reference: horizontal_grouped_bar_chart_05

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    const chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const criticalValidationErrors = [];
    if (!xColumn) criticalValidationErrors.push("Column with role 'x'");
    if (!yColumn) criticalValidationErrors.push("Column with role 'y'");
    if (!groupColumn) criticalValidationErrors.push("Column with role 'group'");
    
    if (criticalValidationErrors.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${criticalValidationErrors.join(', ')}. Cannot render chart.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "sans-serif")
            .html(errorMsg);
        return null;
    }

    const dimensionFieldName = xColumn.name;
    const valueFieldName = yColumn.name;
    const primaryGroupFieldName = groupColumn.name;
    
    const dimensionUnit = (xColumn.unit && xColumn.unit !== "none") ? xColumn.unit : "";
    const valueUnit = (yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {}
    };

    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" }, // Not used per spec, but keep for completeness
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultTypographyStyles.label.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultTypographyStyles.label.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypographyStyles.label.font_weight;

    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypographyStyles.annotation.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypographyStyles.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypographyStyles.annotation.font_weight;

    const defaultColorValues = {
        text_color: "#333333",
        primary: "#3ca951", // Default for bars if specific group color/palette missing
        background_color: "#FFFFFF",
        available_colors: d3.schemeCategory10 
    };

    fillStyle.colors.textColor = colorsConfig.text_color || defaultColorValues.text_color;
    fillStyle.colors.backgroundColor = colorsConfig.background_color || defaultColorValues.background_color;
    fillStyle.colors.defaultBarColor = (colorsConfig.other && colorsConfig.other.primary) || defaultColorValues.primary;
    fillStyle.colors.colorPalette = (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) ? colorsConfig.available_colors : defaultColorValues.available_colors;
    fillStyle.colors.fieldMapping = colorsConfig.field || {};
    
    fillStyle.images.fieldMapping = imagesConfig.field || {};
    fillStyle.images.otherPrimary = (imagesConfig.other && imagesConfig.other.primary) || null;

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox works on SVG elements even if not in live DOM, as long as they are in an SVG structure.
        return tempText.getBBox().width;
    }

    const formatValue = (value) => { // Preserving original formatting logic
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;
    const baseLeftPadding = 10;

    let maxDimensionLabelWidth = 0;
    const uniqueDimensionNames = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    uniqueDimensionNames.forEach(dimName => {
        const formattedDim = dimensionUnit ? `${dimName}${dimensionUnit}` : `${dimName}`;
        const width = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxDimensionLabelWidth) maxDimensionLabelWidth = width;
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedVal = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : `${formatValue(d[valueFieldName])}`;
        // Estimate with annotation font size, actual rendering might use dynamic size
        const width = estimateTextWidth(formattedVal, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        if (width > maxValueLabelWidth) maxValueLabelWidth = width;
    });
    
    const legendSwatchSize = 15;
    const legendSwatchPadding = 5;
    const legendItemSpacing = 15;
    let totalLegendWidth = 0;
    const legendItemWidths = []; // To store individual item widths for precise spacing
    const uniquePrimaryGroupNames = [...new Set(chartDataArray.map(d => d[primaryGroupFieldName]))];

    uniquePrimaryGroupNames.forEach(group => {
        const textWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        const itemWidth = legendSwatchSize + legendSwatchPadding + textWidth;
        legendItemWidths.push(itemWidth); // Store width of swatch + padding + text
        totalLegendWidth += itemWidth + legendItemSpacing; // Add spacing between items
    });
    if (totalLegendWidth > 0 && uniquePrimaryGroupNames.length > 0) {
        totalLegendWidth -= legendItemSpacing; // Remove spacing after the last item
    } else {
        totalLegendWidth = 0; // Handle case of no groups / no legend
    }
    
    const legendAreaHeight = (uniquePrimaryGroupNames.length > 0) ? (legendSwatchSize + 20) : 0; // Height for legend area
    const legendTopPadding = (uniquePrimaryGroupNames.length > 0) ? 20 : 0; // Space above legend
    const legendBottomPadding = (uniquePrimaryGroupNames.length > 0) ? 20 : 0; // Space below legend

    const chartMargins = {
        top: legendTopPadding + legendAreaHeight + legendBottomPadding,
        right: maxValueLabelWidth + 20, 
        bottom: 30,
        left: baseLeftPadding + maxDimensionLabelWidth + iconPadding + iconWidth + iconPadding 
    };
    
    const innerWidth = Math.max(0, containerWidth - chartMargins.left - chartMargins.right);
    const innerHeight = Math.max(0, containerHeight - chartMargins.top - chartMargins.bottom);

    // Block 5: Data Preprocessing & Transformation
    const primaryGroups = uniquePrimaryGroupNames; 

    const groupedData = {};
    primaryGroups.forEach(group => {
        const groupItems = chartDataArray.filter(d => d[primaryGroupFieldName] === group);
        groupedData[group] = [...groupItems].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    });

    const groupColorMap = new Map();
    primaryGroups.forEach((group, i) => {
        let color = (fillStyle.colors.fieldMapping && fillStyle.colors.fieldMapping[group]) ||
                    (fillStyle.colors.colorPalette[i % fillStyle.colors.colorPalette.length]) ||
                    fillStyle.colors.defaultBarColor;
        groupColorMap.set(group, color);
    });

    let totalBarsInChart = 0;
    primaryGroups.forEach(group => {
        totalBarsInChart += groupedData[group].length;
    });
    
    const numGroups = primaryGroups.length;
    const groupPaddingRatio = 0.15; 
    const totalHeightForGroupGaps = (numGroups > 1 && innerHeight > 0) ? (innerHeight * groupPaddingRatio) : 0;
    const groupPaddingPerGap = (numGroups > 1 && totalHeightForGroupGaps > 0) ? totalHeightForGroupGaps / (numGroups - 1) : 0;

    const availableHeightForBarsAndIntraGroupPadding = Math.max(0, innerHeight - totalHeightForGroupGaps);
    
    const barPaddingRatio = 0.15; 
    const idealBarUnitHeight = (totalBarsInChart > 0 && availableHeightForBarsAndIntraGroupPadding > 0) ? availableHeightForBarsAndIntraGroupPadding / totalBarsInChart : 0;
    const barHeight = Math.max(1, idealBarUnitHeight * (1 - barPaddingRatio)); // Ensure min bar height
    const barPadding = idealBarUnitHeight * barPaddingRatio;

    const groupHeights = {};
    const groupYOffsets = {};
    let currentYOffset = 0;

    primaryGroups.forEach((group, groupIndex) => {
        const itemCount = groupedData[group].length;
        const groupContentHeight = itemCount * barHeight + (itemCount > 0 ? (itemCount - 1) * barPadding : 0);
        
        groupHeights[group] = groupContentHeight;
        groupYOffsets[group] = currentYOffset;
        
        currentYOffset += groupContentHeight + (groupIndex < numGroups - 1 ? groupPaddingPerGap : 0) ;
    });

    // Block 6: Scale Definition & Configuration
    const maxDataValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (maxDataValue !== undefined && maxDataValue > 0) ? maxDataValue * 1.05 : 1])
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (Legend)
    if (primaryGroups.length > 0 && totalLegendWidth > 0 && legendAreaHeight > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend other") // Using 'other' as a general class for the group
            .attr("transform", `translate(${(containerWidth - totalLegendWidth) / 2}, ${legendTopPadding + legendAreaHeight / 2})`);

        let currentLegendXOffset = 0;
        primaryGroups.forEach((group, i) => {
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item other")
                .attr("transform", `translate(${currentLegendXOffset}, 0)`);

            legendItem.append("rect")
                .attr("class", "mark legend-swatch")
                .attr("x", 0)
                .attr("y", -legendSwatchSize / 2)
                .attr("width", legendSwatchSize)
                .attr("height", legendSwatchSize)
                .attr("fill", groupColorMap.get(group));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendSwatchSize + legendSwatchPadding)
                .attr("y", 0)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(group);
            
            currentLegendXOffset += legendItemWidths[i] + legendItemSpacing;
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    if (innerHeight > 0 && innerWidth > 0) { // Only render if there's space
        primaryGroups.forEach(group => {
            const groupDataItems = groupedData[group];
            const currentGroupYPos = groupYOffsets[group];
            const groupColor = groupColorMap.get(group);

            groupDataItems.forEach((dataPoint, i) => {
                const barYPos = currentGroupYPos + i * (barHeight + barPadding);
                // Ensure barActualWidth is not NaN if data is bad or scale is ill-defined
                const rawValue = +dataPoint[valueFieldName];
                const barActualWidth = (rawValue !== undefined && !isNaN(rawValue) && xScale(rawValue) > 0) ? xScale(rawValue) : 0;
                
                if (barHeight > 0) { // Only draw bar if it has height
                    mainChartGroup.append("rect")
                        .attr("class", "mark bar")
                        .attr("x", 0)
                        .attr("y", barYPos)
                        .attr("width", barActualWidth)
                        .attr("height", barHeight)
                        .attr("fill", groupColor);
                }

                const dimensionValue = dataPoint[dimensionFieldName];
                const iconXPos = -iconWidth - iconPadding;
                const iconYPos = barYPos + (barHeight - iconHeight) / 2;
                
                const iconUrl = (fillStyle.images.fieldMapping && fillStyle.images.fieldMapping[dimensionValue]) || fillStyle.images.otherPrimary;
                if (iconUrl && barHeight >= iconHeight) { // Render icon if URL exists and bar is tall enough
                    mainChartGroup.append("image")
                        .attr("class", "image dimension-icon")
                        .attr("x", iconXPos)
                        .attr("y", iconYPos)
                        .attr("width", iconWidth)
                        .attr("height", iconHeight)
                        .attr("preserveAspectRatio", "xMidYMid meet")
                        .attr("xlink:href", iconUrl);
                }

                const dimensionLabelXPos = iconXPos - iconPadding;
                const dimensionLabelYPos = barYPos + barHeight / 2;
                const formattedDimensionText = dimensionUnit ? `${dimensionValue}${dimensionUnit}` : `${dimensionValue}`;

                mainChartGroup.append("text")
                    .attr("class", "label dimension-name")
                    .attr("x", dimensionLabelXPos)
                    .attr("y", dimensionLabelYPos)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize)
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.colors.textColor)
                    .text(formattedDimensionText);

                const formattedValueText = valueUnit ? `${formatValue(rawValue)}${valueUnit}` : `${formatValue(rawValue)}`;
                const valueLabelXPos = barActualWidth + 5; 
                
                mainChartGroup.append("text")
                    .attr("class", "value data-value")
                    .attr("x", valueLabelXPos)
                    .attr("y", barYPos + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${Math.max(6, barHeight * 0.7)}px`) // Dynamic font size, min 6px
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.colors.textColor)
                    .text(formattedValueText);
            });
        });
    }

    // Block 9: Optional Enhancements & Post-Processing
    // No interactive elements or complex post-processing in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
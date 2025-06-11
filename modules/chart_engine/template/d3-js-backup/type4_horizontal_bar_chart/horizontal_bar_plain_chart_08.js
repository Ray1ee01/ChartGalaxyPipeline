/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_08",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");

    if (!dimensionFieldConfig || !dimensionFieldConfig.name || !valueFieldConfig || !valueFieldConfig.name) {
        const errorMessage = "Critical chart config missing: Roles 'x' and/or 'y' not found in dataColumns or 'name' is missing. Cannot render chart.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    const dimensionFieldName = dimensionFieldConfig.name;
    const valueFieldName = valueFieldConfig.name;
    
    const dimensionUnit = (dimensionFieldConfig.unit && dimensionFieldConfig.unit !== "none") ? dimensionFieldConfig.unit : "";
    const valueUnit = (valueFieldConfig.unit && valueFieldConfig.unit !== "none") ? valueFieldConfig.unit : "";

    if (!chartDataArray || chartDataArray.length === 0) {
        const message = "No data provided to render the chart.";
        // console.warn(message); // Console warning can be noisy for valid empty states
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='padding:10px; color:#555;'>${message}</div>`);
        }
        return null; // Return SVG node even for empty message for consistency if required, else null
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || "Arial, sans-serif",
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || "16px",
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || "bold",
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || "Arial, sans-serif",
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || "12px",
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || "normal",
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || "Arial, sans-serif",
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || "10px",
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || "normal",
        },
        primaryBarColor: (colorsConfig.other && colorsConfig.other.primary) || "#882e2e",
        textColor: colorsConfig.text_color || "#333333",
        valueLabelColorInsideBar: (colorsConfig.other && colorsConfig.other.value_label_inside) || "#FFFFFF",
        dimensionLabelColorInsideBar: (colorsConfig.other && colorsConfig.other.dimension_label_inside) || "#FFFFFF",
        rankingCircleFill: (colorsConfig.other && colorsConfig.other.ranking_circle_fill) || "#000000",
        rankingCircleTextColor: (colorsConfig.other && colorsConfig.other.ranking_circle_text) || "#FFFFFF",
        iconBackgroundColor: (colorsConfig.other && colorsConfig.other.icon_background) || "#FFFFFF",
        chartBackground: colorsConfig.background_color || "transparent", // Default to transparent
    };

    function estimateTextWidth(text, styleProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Position absolutely and hide to prevent affecting layout or visibility
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.left = '-9999px'; // Further ensure it's off-screen
        tempSvg.style.top = '-9999px';
        
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (styleProps.font_family) textElement.setAttribute('font-family', styleProps.font_family);
        if (styleProps.font_size) textElement.setAttribute('font-size', styleProps.font_size);
        if (styleProps.font_weight) textElement.setAttribute('font-weight', styleProps.font_weight);
        textElement.textContent = text;
        
        tempSvg.appendChild(textElement);
        document.body.appendChild(tempSvg); // Required for getBBox to work accurately
        const width = textElement.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~s")(value);
        return d3.format("~g")(value); // Handles smaller numbers and decimals
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: chartConfig.marginTop || 20,
        right: chartConfig.marginRight || 60, // Adjusted for ranking circles
        bottom: chartConfig.marginBottom || 40,
        left: chartConfig.marginLeft || 20  // Adjusted if no y-axis labels
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 20 || innerHeight <= 20) { // Min practical drawing area
        const message = "Error: Chart dimensions are too small for the configured margins and content.";
        console.error(message);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${message}</div>`);
        return null;
    }
    
    const dimensionCount = new Set(chartDataArray.map(d => d[dimensionFieldName])).size;
    if (dimensionCount === 0 && chartDataArray.length > 0) { // Data exists but no unique dimensions
         d3.select(containerSelector).html("<div style='padding:10px; color:#555;'>Data found, but no unique dimension values to plot.</div>");
        return null;
    }
    if (dimensionCount === 0) { // Handles case where chartDataArray was not empty but yielded 0 dimensions
         d3.select(containerSelector).html("<div style='padding:10px; color:#555;'>No data to display.</div>");
        return null;
    }


    const fixedBarSpacing = chartConfig.barSpacing !== undefined ? chartConfig.barSpacing : 15;
    const MIN_BAR_HEIGHT = chartConfig.minBarHeight || 10; 
    const MAX_BAR_HEIGHT = chartConfig.maxBarHeight || 70;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    
    const dataValues = sortedData.map(d => +d[valueFieldName]);
    const minValue = d3.min(dataValues) || 0;
    const maxValue = d3.max(dataValues) || 0;

    let baseBarHeight = Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, 30)); 
    
    const barHeightScaleValue = (maxValue === minValue) ? minValue + 1 : maxValue;
    const barHeightScaleRange = (maxValue === minValue) ? 1 : 1.5; // Reduced max scale factor for less extreme variation
    const barHeightScale = d3.scaleLinear()
        .domain([minValue, barHeightScaleValue]) 
        .range([1, barHeightScaleRange]) 
        .clamp(true);

    let individualBarHeights = sortedData.map(d => {
        const scaledHeight = baseBarHeight * barHeightScale(+d[valueFieldName]);
        return Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, scaledHeight));
    });

    let totalBarHeightsSum = individualBarHeights.reduce((sum, h) => sum + h, 0);
    const totalPaddingNeeded = (dimensionCount > 1 ? dimensionCount -1 : 0) * fixedBarSpacing;
    let requiredInnerHeight = totalBarHeightsSum + totalPaddingNeeded;

    if (dimensionCount > 0 && requiredInnerHeight > innerHeight && totalBarHeightsSum > 0) {
        const availableSpaceForBars = innerHeight - totalPaddingNeeded;
        if (availableSpaceForBars > dimensionCount * (MIN_BAR_HEIGHT / 2)) { 
            const heightCorrectionFactor = availableSpaceForBars / totalBarHeightsSum;
            individualBarHeights = individualBarHeights.map(h => Math.max(MIN_BAR_HEIGHT / 2, h * heightCorrectionFactor));
        } else { 
            const minAllowedHeight = Math.max(1, availableSpaceForBars / dimensionCount); // At least 1px
            individualBarHeights = individualBarHeights.map(() => minAllowedHeight);
        }
    }
    
    const finalTotalBarHeightsSum = individualBarHeights.reduce((sum, h) => sum + h, 0);
    const finalTotalUsedHeight = finalTotalBarHeightsSum + ((dimensionCount > 1 ? dimensionCount -1 : 0) * fixedBarSpacing);
    const startYOffset = Math.max(0, (innerHeight - finalTotalUsedHeight) / 2);


    // Block 6: Scale Definition & Configuration
    const maxDomainValue = (maxValue === 0 && minValue === 0) ? 1 : maxValue; // Handle all zero case for domain
    const xScale = d3.scaleLinear()
        .domain([0, maxDomainValue * 1.05]) 
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 8: Main Data Visualization Rendering
    let currentY = startYOffset;
    const minDrawableBarHeight = d3.min(individualBarHeights.filter(h => h > 0));
    const uniformRankingCircleRadius = Math.max(8, (minDrawableBarHeight || MIN_BAR_HEIGHT) * 0.35);


    sortedData.forEach((d, index) => {
        const barValue = +d[valueFieldName];
        const dimensionName = String(d[dimensionFieldName]); // Ensure string
        const barHeight = individualBarHeights[index];

        if (barHeight <= 0.5) { // Skip rendering if bar height is effectively zero
            if (index < sortedData.length -1) currentY += fixedBarSpacing;
            return;
        }

        const barWidth = xScale(barValue);
        const barCenterY = barHeight / 2; // Relative to barGroup

        const barGroup = mainChartGroup.append("g")
            .attr("class", "bar-group mark") // Added mark class
            .attr("transform", `translate(0, ${currentY})`);

        barGroup.append("rect")
            .attr("class", "mark bar-rect") // More specific class
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", Math.max(0, barWidth)) 
            .attr("height", barHeight)
            .attr("fill", fillStyle.primaryBarColor);

        const iconSize = Math.max(5, barHeight * 0.7); // Min icon size
        const iconX = 5; // Reduced padding for icon
        const iconY = (barHeight - iconSize) / 2;

        const iconUrl = imagesConfig.field && imagesConfig.field[dimensionName] 
                        ? imagesConfig.field[dimensionName]
                        : (imagesConfig.other && imagesConfig.other.primary ? imagesConfig.other.primary : null);

        if (iconUrl) {
            barGroup.append("circle") 
                .attr("class", "icon-background other")
                .attr("cx", iconX + iconSize / 2)
                .attr("cy", iconY + iconSize / 2)
                .attr("r", iconSize / 2)
                .attr("fill", fillStyle.iconBackgroundColor);

            barGroup.append("image")
                .attr("class", "icon image")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
        
        const formattedValueText = valueUnit ? `${formatValue(barValue)}${valueUnit}` : formatValue(barValue);
        const valueTextStyle = { font_family: fillStyle.typography.annotationFontFamily, font_size: fillStyle.typography.annotationFontSize, font_weight: fillStyle.typography.annotationFontWeight };
        const dimensionTextStyle = { font_family: fillStyle.typography.labelFontFamily, font_size: fillStyle.typography.labelFontSize, font_weight: fillStyle.typography.labelFontWeight };

        const valueTextWidth = estimateTextWidth(formattedValueText, valueTextStyle);
        const dimensionTextDisplay = dimensionName + (dimensionUnit ? " " + dimensionUnit : "");
        const dimensionTextWidth = estimateTextWidth(dimensionTextDisplay, dimensionTextStyle);
        
        const iconOffset = (iconUrl ? iconX + iconSize : 0) + 5;
        const labelPadding = 10;
        const spaceForTwoLineLabel = Math.max(valueTextWidth, dimensionTextWidth) + labelPadding;
        const labelFitsInside = barWidth > iconOffset + spaceForTwoLineLabel + labelPadding;


        if (labelFitsInside) {
            barGroup.append("text")
                .attr("class", "label value-label text")
                .attr("x", barWidth - labelPadding)
                .attr("y", barCenterY - parseFloat(fillStyle.typography.annotationFontSize) * 0.1) 
                .attr("dy", "-0.2em") 
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", "bold") 
                .style("fill", fillStyle.valueLabelColorInsideBar)
                .text(formattedValueText);

            barGroup.append("text")
                .attr("class", "label dimension-label text")
                .attr("x", barWidth - labelPadding)
                .attr("y", barCenterY + parseFloat(fillStyle.typography.labelFontSize) * 0.1) 
                .attr("dy", "0.7em") 
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.dimensionLabelColorInsideBar)
                .text(dimensionTextDisplay);
        } else { 
            const spaceForIconAndValue = iconOffset + valueTextWidth + labelPadding;
            if (barWidth > spaceForIconAndValue) {
                 barGroup.append("text")
                    .attr("class", "label value-label text")
                    .attr("x", iconOffset)
                    .attr("y", barCenterY)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", "bold")
                    .style("fill", fillStyle.valueLabelColorInsideBar)
                    .text(formattedValueText);
            }
        }

        // Block 9: Optional Enhancements & Post-Processing
        const rankingCirclePadding = 5;
        const rankingCircleX = Math.max(0, barWidth) + rankingCirclePadding + uniformRankingCircleRadius;

        barGroup.append("circle")
            .attr("class", "mark ranking-circle-bg other")
            .attr("cx", rankingCircleX)
            .attr("cy", barCenterY)
            .attr("r", uniformRankingCircleRadius)
            .attr("fill", fillStyle.rankingCircleFill);

        barGroup.append("text")
            .attr("class", "text ranking-text")
            .attr("x", rankingCircleX)
            .attr("y", barCenterY)
            .attr("dy", "0.35em") 
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize) 
            .style("font-weight", "bold")
            .style("fill", fillStyle.rankingCircleTextColor)
            .text(index + 1);
        
        currentY += barHeight + fixedBarSpacing;
    });
    
    // Unit display for the entire chart (if applicable and configured)
    if (valueUnit && chartConfig.showOverallUnit !== false && sortedData.length > 0) {
        mainChartGroup.append("text")
            .attr("class", "label value-unit-label text")
            .attr("x", innerWidth) 
            .attr("y", startYOffset - (parseFloat(fillStyle.typography.annotationFontSize)/2) - 2) // Position above the first bar block
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`Values in ${valueUnit}`);
    }


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart_13",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [0, "inf"]],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldRole = "x";
    const valueField1Role = "y";
    const valueField2Role = "y2";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const dimensionFieldDef = getField(dimensionFieldRole);
    const valueField1Def = getField(valueField1Role);
    const valueField2Def = getField(valueField2Role);

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueField1Name = valueField1Def?.name;
    const valueField2Name = valueField2Def?.name;

    if (!dimensionFieldName || !valueField1Name || !valueField2Name) {
        const missingFields = [];
        if (!dimensionFieldName) missingFields.push(`role '${dimensionFieldRole}' ('${dimensionFieldDef?.name || "undefined"}')`);
        if (!valueField1Name) missingFields.push(`role '${valueField1Role}' ('${valueField1Def?.name || "undefined"}')`);
        if (!valueField2Name) missingFields.push(`role '${valueField2Role}' ('${valueField2Def?.name || "undefined"}')`);
        
        const errorMsg = `Critical chart config missing: Field names for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const valueUnit1 = valueField1Def?.unit === "none" ? "" : (valueField1Def?.unit || "");
    const valueUnit2 = valueField2Def?.unit === "none" ? "" : (valueField2Def?.unit || "");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    
    const defaultTypography = {
        label: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "500" },
        annotation: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }
    };

    fillStyle.typography = {
        labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || defaultTypography.label.font_family,
        labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || defaultTypography.label.font_size,
        labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || defaultTypography.label.font_weight,
        annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultTypography.annotation.font_family,
        annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultTypography.annotation.font_size,
        annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultTypography.annotation.font_weight,
    };

    const defaultColors = {
        primary: "#83C341",
        text: "#FFFFFF",
        background: "#0A3B39",
        iconBorder: "#CCCCCC"
    };
    
    fillStyle.primaryChartElementColor = (colorsConfig.other && colorsConfig.other.primary) || defaultColors.primary;
    fillStyle.textColor = colorsConfig.text_color || defaultColors.text;
    fillStyle.textColorLight = "#FFFFFF"; 
    fillStyle.chartBackground = colorsConfig.background_color || defaultColors.background;
    fillStyle.iconBorderColor = (colorsConfig.other && colorsConfig.other.icon_border) || defaultColors.iconBorder;

    fillStyle.dimensionIcons = imagesConfig.field || {};
    
    const BAR_OPACITY = 0.9;
    const CIRCLE_OPACITY = 0.6;
    const ICON_BORDER_WIDTH = 1.5; 
    const CONNECTOR_LINE_STROKE_WIDTH = 0.8;
    const DEFAULT_BAR_PADDING = 0.2;

    const tempSvgForTextMeasurement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    d3.select(tempSvgForTextMeasurement).style("position", "absolute").style("visibility", "hidden").style("top", "-9999px").style("left", "-9999px");
    document.body.appendChild(tempSvgForTextMeasurement); // Required for getBBox to work correctly in some browsers

    function measureText(text, fontProps, forcedFontSize = null) {
        if (!text) return 0;
        const textElement = d3.select(tempSvgForTextMeasurement).append("text")
            .attr('font-family', fontProps.fontFamily)
            .attr('font-size', forcedFontSize || fontProps.fontSize)
            .attr('font-weight', fontProps.fontWeight)
            .text(text);
        const width = textElement.node().getBBox().width;
        textElement.remove();
        return width;
    }
    
    const formatValue = (value) => {
        if (value == null || isNaN(Number(value))) return "";
        const numValue = Number(value);
        if (Math.abs(numValue) >= 1000000000) return d3.format("~.2s")(numValue).replace('G', 'B');
        if (Math.abs(numValue) >= 1000000) return d3.format("~.2s")(numValue);
        if (Math.abs(numValue) >= 1000) return d3.format("~.2s")(numValue);
        return d3.format("~g")(numValue);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    let containerWidth = parseFloat(chartConfig.width) || 800;
    let containerHeight = parseFloat(chartConfig.height) || 600;

    const preSortForHeight = [...chartDataArray].sort((a, b) => (Number(b[valueField1Name]) || 0) - (Number(a[valueField1Name]) || 0));
    if (preSortForHeight.length > 15) {
        const excessDimensions = preSortForHeight.length - 15;
        containerHeight = Math.round(containerHeight * (1 + excessDimensions * 0.03));
    }
    
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const clipPathId = "bar-clip-path-" + Date.now() + Math.random().toString(36).substr(2, 5);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 15, bottom: 30, left: 10 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const leftColumnRatio = 0.80;
    const barChartWidth = innerWidth * leftColumnRatio;
    const circleChartWidth = innerWidth * (1 - leftColumnRatio);

    svgRoot.append("defs")
        .append("clipPath")
        .attr("id", clipPathId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", barChartWidth)
        .attr("height", innerHeight);

    const barPadding = chartConfig.barPadding !== undefined ? parseFloat(chartConfig.barPadding) : DEFAULT_BAR_PADDING;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => (Number(b[valueField1Name]) || 0) - (Number(a[valueField1Name]) || 0));
    const sortedDimensions = sortedData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const maxVal1 = d3.max(sortedData, d => Number(d[valueField1Name]) || 0);
    const xScale = d3.scaleLinear()
        .domain([0, maxVal1 * 1.05])
        .range([0, barChartWidth]);

    const maxVal2 = d3.max(sortedData, d => Number(d[valueField2Name]) || 0);
    const bandWidth = yScale.bandwidth();
    const minRadius = Math.max(2, bandWidth * 0.20);
    const maxRadius = Math.min(bandWidth * 0.80, (circleChartWidth / 2) * 0.9);
    
    const radiusScale = d3.scaleSqrt()
        .domain([0, maxVal2])
        .range([minRadius, maxRadius > minRadius ? maxRadius : minRadius + 2]);

    const barHeightForIconScaling = bandWidth;
    const iconScaleFactor = barHeightForIconScaling < 35 ? 0.8 : 0.6;
    const calculatedFlagSize = Math.min(
        barHeightForIconScaling * 0.9,
        Math.max(10, Math.round(barHeightForIconScaling * iconScaleFactor))
    );
    const flagWidth = calculatedFlagSize;
    const flagHeight = calculatedFlagSize;

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other");
    
    // Block 8: Main Data Visualization Rendering
    sortedDimensions.forEach((dimensionValue, index) => {
        const dataPoint = sortedData.find(d => d[dimensionFieldName] === dimensionValue);
        if (!dataPoint) return;

        const val1 = Number(dataPoint[valueField1Name]) || 0;
        const val2 = Number(dataPoint[valueField2Name]) || 0;

        const barHeight = yScale.bandwidth();
        const yPos = yScale(dimensionValue);
        if (yPos === undefined || barHeight <=0) return;

        const centerY = yPos + barHeight / 2;
        const barWidthActual = xScale(val1 > 0 ? val1 : 0);
        const barEndRadius = barHeight / 2;

        const iconSize = flagWidth;
        const textPadding = 5;

        const dimensionLabelText = String(dimensionValue).toUpperCase();
        const value1LabelText = `${formatValue(val1)}${valueUnit1}`;
        
        const annotationBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
        const dynamicValueLabelFontSize = Math.min(20, Math.max(barHeight * 0.5, annotationBaseFontSize));
        const dynamicValueLabelFontSizePx = `${dynamicValueLabelFontSize}px`;

        const dimFontProps = { fontFamily: fillStyle.typography.labelFontFamily, fontSize: fillStyle.typography.labelFontSize, fontWeight: fillStyle.typography.labelFontWeight };
        const valFontProps = { fontFamily: fillStyle.typography.annotationFontFamily, fontSize: fillStyle.typography.annotationFontSize, fontWeight: fillStyle.typography.annotationFontWeight };

        const currentDimLabelWidth = measureText(dimensionLabelText, dimFontProps);
        const currentValue1LabelWidth = measureText(value1LabelText, valFontProps, dynamicValueLabelFontSizePx);

        const iconMinSpace = iconSize + textPadding;
        const totalIconDimSpace = iconMinSpace + currentDimLabelWidth + textPadding;
        const totalInsideSpace = totalIconDimSpace + currentValue1LabelWidth + textPadding * 2;

        let iconX, dimLabelX, value1LabelX;
        let dimLabelColor, value1LabelColor;
        let dimLabelAnchor, value1LabelAnchor;

        if (barWidthActual < iconMinSpace) {
            iconX = barWidthActual + textPadding;
            dimLabelX = iconX + iconSize + textPadding;
            value1LabelX = dimLabelX + currentDimLabelWidth + textPadding * 2;
            dimLabelColor = value1LabelColor = fillStyle.textColor;
            dimLabelAnchor = value1LabelAnchor = "start";
        } else if (barWidthActual < totalIconDimSpace) {
            iconX = textPadding;
            dimLabelX = barWidthActual + textPadding;
            value1LabelX = dimLabelX + currentDimLabelWidth + textPadding * 2;
            dimLabelColor = value1LabelColor = fillStyle.textColor;
            dimLabelAnchor = value1LabelAnchor = "start";
        } else {
            iconX = textPadding;
            dimLabelX = iconX + iconSize + textPadding;
            dimLabelColor = fillStyle.textColorLight;
            dimLabelAnchor = "start";
            if (barWidthActual >= totalInsideSpace) {
                value1LabelX = barWidthActual - textPadding;
                value1LabelColor = fillStyle.textColorLight;
                value1LabelAnchor = "end";
            } else {
                value1LabelX = barWidthActual + textPadding;
                value1LabelColor = fillStyle.textColor;
                value1LabelAnchor = "start";
            }
        }
        
        let lineStartX;
        if (value1LabelAnchor === "end") lineStartX = barWidthActual;
        else lineStartX = value1LabelX + currentValue1LabelWidth + textPadding;

        const itemGroup = mainChartGroup.append("g").attr("class", "item-group other");

        if (barWidthActual > 0) {
            itemGroup.append("path")
                .attr("class", "mark bar-mark")
                .attr("d", `M 0,${yPos} L ${barWidthActual - barEndRadius},${yPos} A ${barEndRadius},${barEndRadius} 0 0,1 ${barWidthActual},${centerY} A ${barEndRadius},${barEndRadius} 0 0,1 ${barWidthActual - barEndRadius},${yPos + barHeight} L 0,${yPos + barHeight} Z`)
                .attr("fill", fillStyle.primaryChartElementColor)
                .attr("opacity", BAR_OPACITY)
                .attr("clip-path", `url(#${clipPathId})`);
        }

        if (fillStyle.dimensionIcons[dimensionValue] && iconSize > 0) {
            const iconClipId = `icon-clip-${index}-${String(dimensionValue).replace(/[^a-zA-Z0-9]/g, '')}`;
            itemGroup.append("defs").append("clipPath").attr("id", iconClipId)
                .append("circle").attr("cx", flagWidth / 2).attr("cy", flagHeight / 2).attr("r", flagHeight / 2 * 0.95);
            
            const iconElementGroup = itemGroup.append("g")
                .attr("class", "icon dimension-icon image")
                .attr("transform", `translate(${iconX}, ${centerY - flagHeight / 2})`);
            iconElementGroup.append("circle").attr("cx", flagWidth / 2).attr("cy", flagHeight / 2).attr("r", flagHeight / 2)
                .attr("fill", "none").attr("stroke", fillStyle.iconBorderColor).attr("stroke-width", ICON_BORDER_WIDTH);
            iconElementGroup.append("image").attr("x", 0).attr("y", 0).attr("width", flagWidth).attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid slice").attr("xlink:href", fillStyle.dimensionIcons[dimensionValue])
                .attr("clip-path", `url(#${iconClipId})`);
        }
        
        itemGroup.append("text").attr("class", "label dimension-label text")
            .attr("x", dimLabelX).attr("y", centerY).attr("dy", "0.35em").attr("text-anchor", dimLabelAnchor)
            .style("font-family", dimFontProps.fontFamily).style("font-size", dimFontProps.fontSize)
            .style("font-weight", dimFontProps.fontWeight).style("fill", dimLabelColor).text(dimensionLabelText);

        itemGroup.append("text").attr("class", "label value-label bar-value-label text")
            .attr("x", value1LabelX).attr("y", centerY).attr("dy", "0.35em").attr("text-anchor", value1LabelAnchor)
            .style("font-family", valFontProps.fontFamily).style("font-size", dynamicValueLabelFontSizePx)
            .style("font-weight", valFontProps.fontWeight).style("fill", value1LabelColor).text(value1LabelText);

        const circleRadiusActual = radiusScale(val2 > 0 ? val2 : 0);
        const circleX = barChartWidth + circleChartWidth / 2;
        
        if (circleRadiusActual > 0.1) { // Render if radius is somewhat visible
            itemGroup.append("circle").attr("class", "mark circle-mark")
                .attr("cx", circleX).attr("cy", centerY).attr("r", circleRadiusActual)
                .attr("fill", fillStyle.primaryChartElementColor).attr("opacity", CIRCLE_OPACITY);

            const value2LabelText = `${formatValue(val2)}${valueUnit2}`;
            const dynamicCircleLabelFontSize = Math.min(16, Math.max(circleRadiusActual * 0.5, annotationBaseFontSize * 0.7));
            const dynamicCircleLabelFontSizePx = `${dynamicCircleLabelFontSize}px`;
            
            if (circleRadiusActual > 5 && measureText(value2LabelText, valFontProps, dynamicCircleLabelFontSizePx) < circleRadiusActual * 1.8) {
                 itemGroup.append("text").attr("class", "label value-label circle-value-label text")
                    .attr("x", circleX).attr("y", centerY).attr("dy", "0.35em").attr("text-anchor", "middle")
                    .style("font-family", valFontProps.fontFamily).style("font-size", dynamicCircleLabelFontSizePx)
                    .style("font-weight", valFontProps.fontWeight).style("fill", fillStyle.textColorLight).text(value2LabelText);
            }
        }

        const lineEndX = circleX - circleRadiusActual - textPadding / 2;
        if (lineStartX < lineEndX - 1 && barWidthActual > 0 && circleRadiusActual > 0.1) {
            itemGroup.append("line").attr("class", "mark connector-line other")
                .attr("x1", lineStartX).attr("y1", centerY).attr("x2", lineEndX).attr("y2", centerY)
                .attr("stroke", fillStyle.primaryChartElementColor).attr("stroke-width", CONNECTOR_LINE_STROKE_WIDTH).attr("opacity", 0.7);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None)

    // Block 10: Cleanup & SVG Node Return
    d3.select(tempSvgForTextMeasurement).remove();
    return svgRoot.node();
}
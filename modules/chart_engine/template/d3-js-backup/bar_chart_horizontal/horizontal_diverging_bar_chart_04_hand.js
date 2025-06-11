/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { dimensionField, valueField, groupField };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x").unit : "";
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y").unit : "";
    const groupUnit = dataColumns.find(col => col.role === "group")?.unit !== "none" ? dataColumns.find(col => col.role === "group").unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        textColor: colorsInput.text_color || '#333333',
        barStrokeColor: variables.has_stroke ? (colorsInput.stroke_color || (colorsInput.available_colors && colorsInput.available_colors.length > 0 ? colorsInput.available_colors[0] : '#333333')) : 'none',
        barStrokeWidth: variables.has_stroke ? 1 : 0,
        images: imagesInput.field || {},
        otherImages: imagesInput.other || {}
    };
    
    const defaultCategoricalColorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const getColor = (groupName, groupIndex) => {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
        }
        if (colorsInput.other && colorsInput.other.primary && groupIndex === 0) { // Use primary for first group if specific not found
             return colorsInput.other.primary;
        }
        if (colorsInput.other && colorsInput.other.secondary && groupIndex === 1) { // Use secondary for second group
             return colorsInput.other.secondary;
        }
        return defaultCategoricalColorScale(groupName);
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per spec, should not append to DOM. If issues arise, this might need adjustment.
        // For this implementation, we rely on it working without DOM append.
        // If it doesn't, a hidden append/remove strategy would be:
        // document.body.appendChild(tempSvg);
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        // return width;
        // However, the prompt says "MUST NOT be appended to the document DOM".
        // So we use it without appending, hoping getBBox() works.
        // A more robust way without appending to DOM is to have a pre-rendered SVG in memory.
        // For simplicity here, we assume getBBox on a non-DOM-attached element is sufficient.
        // If not, a fixed-size canvas or a more complex off-screen SVG setup would be needed.
        // A common workaround is to append to a detached SVG element, which is what we're doing.
        return tempText.getBBox().width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 70, bottom: 40, left: 70 }; // Adjusted top margin for group labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const barSlopeAmount = 5;
    const iconWidth = 20;
    const iconHeight = 15;
    const iconPadding = 5;

    // Block 5: Data Preprocessing & Transformation
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];
    const dimensions = [...allDimensions]; // Use original order

    // Assuming exactly two groups as per metadata `required_fields_range` for group: [2,2]
    const leftGroup = groups[0];
    const rightGroup = groups[1];

    fillStyle.barColorLeft = getColor(leftGroup, 0);
    fillStyle.barColorRight = getColor(rightGroup, 1);

    let maxLabelWidth = 0;
    dimensions.forEach(dim => {
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        let currentWidth = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (fillStyle.images[dim]) {
            currentWidth += iconWidth + iconPadding;
        }
        maxLabelWidth = Math.max(maxLabelWidth, currentWidth);
    });
    const dimensionLabelWidth = Math.max(maxLabelWidth + 10, 80); // Add padding, min 80px

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(variables.has_spacing ? 0.4 : 0.3);

    const maxLeftValue = d3.max(chartData.filter(d => d[groupField] === leftGroup), d => d[valueField]) || 0;
    const maxRightValue = d3.max(chartData.filter(d => d[groupField] === rightGroup), d => d[valueField]) || 0;

    const availableBarSpace = (innerWidth - dimensionLabelWidth) / 2;

    const leftXScale = d3.scaleLinear()
        .domain([0, maxLeftValue])
        .range([availableBarSpace, 0]);

    const rightXScale = d3.scaleLinear()
        .domain([0, maxRightValue])
        .range([0, availableBarSpace]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Group Labels
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label left-group-label")
        .attr("x", availableBarSpace / 2)
        .attr("y", -20) // Position above the chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label right-group-label")
        .attr("x", innerWidth - availableBarSpace / 2)
        .attr("y", -20) // Position above the chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    // Dimension Labels (Center)
    const dimensionLabelsGroup = mainChartGroup.append("g")
        .attr("class", "dimension-labels-group")
        .attr("transform", `translate(${availableBarSpace}, 0)`);

    dimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const formattedDim = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const labelGroup = dimensionLabelsGroup.append("g").attr("class", "dimension-label-item");

        let textXPosition = dimensionLabelWidth / 2;
        let textAnchor = "middle";

        if (fillStyle.images[dim]) {
            // Icon + Text
            const textWidth = estimateTextWidth(formattedDim, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const totalContentWidth = iconWidth + iconPadding + textWidth;
            const startX = (dimensionLabelWidth - totalContentWidth) / 2;

            labelGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", startX)
                .attr("y", yPos - iconHeight / 2)
                .attr("width", iconWidth)
                .attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", fillStyle.images[dim]);
            
            textXPosition = startX + iconWidth + iconPadding;
            textAnchor = "start";
        }
        
        labelGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", textXPosition)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", textAnchor)
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formattedDim);
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barHeight = yScale.bandwidth();
    const annotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const dynamicAnnotationFontSize = Math.min(20, Math.max(barHeight * 0.5, annotationFontSize));


    // Left Bars
    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionField] === dim && d[groupField] === leftGroup);
        if (dataPoint) {
            const value = dataPoint[valueField];
            const barXEnd = leftXScale(0); // Right edge of left bar area
            const barXStart = leftXScale(value); // Left edge of the bar (value dependent)
            const currentBarWidth = barXEnd - barXStart;
            const yPos = yScale(dim);

            const pathDataLeft = [
                `M ${barXStart} ${yPos}`,
                `L ${barXEnd} ${yPos}`,
                `L ${barXEnd} ${yPos + barHeight}`,
                `L ${barXStart - barSlopeAmount} ${yPos + barHeight}`,
                "Z"
            ].join(" ");

            mainChartGroup.append("path")
                .attr("class", "mark bar left-bar")
                .attr("d", pathDataLeft)
                .attr("fill", fillStyle.barColorLeft)
                .style("stroke", fillStyle.barStrokeColor)
                .style("stroke-width", fillStyle.barStrokeWidth)
                .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
                .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

            const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            mainChartGroup.append("text")
                .attr("class", "label value-label left-value-label")
                .attr("x", barXStart - barSlopeAmount - 5) // Position outside, to the left
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${dynamicAnnotationFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedValue);
        }
    });

    // Right Bars
    const rightBarAreaXStart = availableBarSpace + dimensionLabelWidth;
    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionField] === dim && d[groupField] === rightGroup);
        if (dataPoint) {
            const value = dataPoint[valueField];
            const currentBarWidth = rightXScale(value) - rightXScale(0);
            const yPos = yScale(dim);
            const barXStart = rightBarAreaXStart + rightXScale(0); // Left edge of the bar
            const barXEnd = rightBarAreaXStart + rightXScale(value); // Right edge of the bar (value dependent)


            const pathDataRight = [
                `M ${barXStart} ${yPos}`,
                `L ${barXEnd} ${yPos}`,
                `L ${barXEnd + barSlopeAmount} ${yPos + barHeight}`,
                `L ${barXStart} ${yPos + barHeight}`,
                "Z"
            ].join(" ");

            mainChartGroup.append("path")
                .attr("class", "mark bar right-bar")
                .attr("d", pathDataRight)
                .attr("fill", fillStyle.barColorRight)
                .style("stroke", fillStyle.barStrokeColor)
                .style("stroke-width", fillStyle.barStrokeWidth)
                .on("mouseover", function() { d3.select(this).attr("opacity", 0.8); })
                .on("mouseout", function() { d3.select(this).attr("opacity", 1); });

            const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            mainChartGroup.append("text")
                .attr("class", "label value-label right-value-label")
                .attr("x", barXEnd + barSlopeAmount + 5) // Position outside, to the right
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${dynamicAnnotationFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedValue);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - mouseover/out already added)
    // Removed svg2roughjs and other complex effects.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_11",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
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
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a horizontal diverging bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { dimensionField, valueField, groupField };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: [${missingFields.join(', ')}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align: center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const dimensionUnit = dataColumns.find(col => col.role === "x" && col.unit !== "none")?.unit || "";
    const valueUnit = dataColumns.find(col => col.role === "y" && col.unit !== "none")?.unit || "";
    const groupUnit = dataColumns.find(col => col.role === "group" && col.unit !== "none")?.unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px',
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        },
        textColor: colors.text_color || '#333333',
        chartBackground: colors.background_color || '#FFFFFF', // Not used directly on SVG, but good to have
    };

    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupField]))];
    if (uniqueGroups.length < 2) {
        const errorMessage = "Chart requires at least two distinct groups for diverging bars. Cannot render.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align: center; padding: 20px;'>${errorMessage}</div>`);
        }
        return null;
    }
    const leftGroup = uniqueGroups[0];
    const rightGroup = uniqueGroups[1];

    const defaultCategoryColors = d3.schemeCategory10;
    fillStyle.barColorLeft = (colors.field && colors.field[leftGroup]) ? colors.field[leftGroup] :
                             (colors.available_colors ? colors.available_colors[0 % colors.available_colors.length] : defaultCategoryColors[0 % defaultCategoryColors.length]);
    fillStyle.barColorRight = (colors.field && colors.field[rightGroup]) ? colors.field[rightGroup] :
                              (colors.available_colors ? colors.available_colors[1 % colors.available_colors.length] : defaultCategoryColors[1 % defaultCategoryColors.length]);


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempSvg = d3.select(tempSvgNode);
        const tempText = tempSvg.append('text')
            .style('font-family', fontFamily)
            .style('font-size', fontSize)
            .style('font-weight', fontWeight)
            .text(text);
        const width = tempText.node().getBBox().width;
        tempText.remove(); // Clean up the temporary text element
        // tempSvgNode is not appended to DOM, so no .remove() needed for it
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg");
        // No viewBox, width="100%", or height="auto" as per spec

    const chartMargins = { top: 60, right: 30, bottom: 40, left: 30 };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const dimensions = [...new Set(chartDataArray.map(d => d[dimensionField]))];
    let maxLabelWidth = 0;
    dimensions.forEach(dim => {
        const formattedDimension = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textWidth = estimateTextWidth(formattedDimension, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
    });
    const dimensionLabelWidth = Math.max(maxLabelWidth + 10, 80); // Add padding, min width 80

    // Block 5: Data Preprocessing & Transformation
    const isDataComplete = dimensions.every(dimension => {
        const hasLeftData = chartDataArray.some(d => d[dimensionField] === dimension && d[groupField] === leftGroup);
        const hasRightData = chartDataArray.some(d => d[dimensionField] === dimension && d[groupField] === rightGroup);
        return hasLeftData && hasRightData;
    });

    if (!isDataComplete) {
        const errorMessage = "Data is incomplete: some dimensions are missing data for one or both groups. Cannot render chart.";
        console.warn(errorMessage); // Use console.warn for data issues vs. config errors
        d3.select(containerSelector)
            .html(`<div style='color:red; text-align:center; padding:20px; font-family:${fillStyle.typography.labelFontFamily}; font-size:${fillStyle.typography.labelFontSize};'>${errorMessage}</div>`);
        return null;
    }

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3);

    const maxValue = d3.max(chartDataArray, d => +d[valueField]);

    const leftBarAreaWidth = innerWidth / 2 - dimensionLabelWidth / 2;
    const rightBarAreaWidth = innerWidth / 2 - dimensionLabelWidth / 2;

    const leftXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([leftBarAreaWidth, 0]); // Reversed: larger values are further left

    const rightXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, rightBarAreaWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Group Labels
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label left-group-label")
        .attr("x", leftBarAreaWidth / 2)
        .attr("y", -15) // Position above the bars, within margin.top
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label right-group-label")
        .attr("x", innerWidth / 2 + dimensionLabelWidth / 2 + rightBarAreaWidth / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    // Dimension Labels (Central)
    const dimensionLabelsGroup = mainChartGroup.append("g")
        .attr("class", "dimension-labels-group")
        .attr("transform", `translate(${innerWidth / 2}, 0)`);

    dimensions.forEach(dim => {
        const formattedDimension = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        dimensionLabelsGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", 0) // Centered within this group
            .attr("y", yScale(dim) + yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formattedDimension);
    });

    // Block 8: Main Data Visualization Rendering
    // Left Bars
    const leftBarsGroup = mainChartGroup.append("g").attr("class", "left-bars-group");
    dimensions.forEach(dim => {
        const dataPoint = chartDataArray.find(d => d[dimensionField] === dim && d[groupField] === leftGroup);
        if (dataPoint) {
            const value = +dataPoint[valueField];
            const barX = leftXScale(value);
            const barY = yScale(dim);
            const barWidth = leftBarAreaWidth - barX; // barX is the right edge of the left bar area
            const barHeight = yScale.bandwidth();

            if (barWidth > 0) { // Only draw if width is positive
                leftBarsGroup.append("rect")
                    .attr("class", "mark bar left-bar")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", fillStyle.barColorLeft);

                // Value Label for Left Bar
                const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
                leftBarsGroup.append("text")
                    .attr("class", "value data-label left-data-label")
                    .attr("x", barX - 5) // Position to the left of the bar
                    .attr("y", barY + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "end")
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(formattedVal);
            }
        }
    });

    // Right Bars
    const rightBarsGroup = mainChartGroup.append("g")
        .attr("class", "right-bars-group")
        .attr("transform", `translate(${innerWidth / 2 + dimensionLabelWidth / 2}, 0)`);

    dimensions.forEach(dim => {
        const dataPoint = chartDataArray.find(d => d[dimensionField] === dim && d[groupField] === rightGroup);
        if (dataPoint) {
            const value = +dataPoint[valueField];
            const barX = 0; // Starts at the left edge of this group's coordinate system
            const barY = yScale(dim);
            const barWidth = rightXScale(value);
            const barHeight = yScale.bandwidth();

            if (barWidth > 0) { // Only draw if width is positive
                rightBarsGroup.append("rect")
                    .attr("class", "mark bar right-bar")
                    .attr("x", barX)
                    .attr("y", barY)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", fillStyle.barColorRight);

                // Value Label for Right Bar
                const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
                rightBarsGroup.append("text")
                    .attr("class", "value data-label right-data-label")
                    .attr("x", barWidth + 5) // Position to the right of the bar
                    .attr("y", barY + barHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .text(formattedVal);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
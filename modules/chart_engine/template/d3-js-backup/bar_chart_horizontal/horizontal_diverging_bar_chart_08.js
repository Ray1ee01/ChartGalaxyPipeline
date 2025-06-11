/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_08",
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
  "background": "styled",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    const dimensionField = xFieldDef ? xFieldDef.name : undefined;
    const valueField = yFieldDef ? yFieldDef.name : undefined;
    const groupField = groupFieldDef ? groupFieldDef.name : undefined;

    let missingFields = [];
    if (!dimensionField) missingFields.push("x role (dimensionField)");
    if (!valueField) missingFields.push("y role (valueField)");
    if (!groupField) missingFields.push("group role (groupField)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionUnit = (xFieldDef && xFieldDef.unit !== "none") ? xFieldDef.unit : "";
    const valueUnit = (yFieldDef && yFieldDef.unit !== "none") ? yFieldDef.unit : "";
    const groupUnit = (groupFieldDef && groupFieldDef.unit !== "none") ? groupFieldDef.unit : "";
    
    const chartData = rawChartData.filter(d =>
        d[dimensionField] !== undefined && d[dimensionField] !== null &&
        d[valueField] !== undefined && d[valueField] !== null &&
        d[groupField] !== undefined && d[groupField] !== null
    );

    if (chartData.length === 0) {
        const errorMsg = `No valid data points found after filtering for required fields. Cannot render.`;
        console.warn(errorMsg); // Changed to warn as empty chart might be valid for empty data.
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='text-align:center; padding:20px;'>No data to display.</div>`);
        }
        // Depending on requirements, might return null or an empty SVG
        // For now, let's allow an empty chart to be drawn if that's the outcome of no data.
        // The subsequent checks (e.g., groups.length < 2) will handle specific data issues.
    }

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
        textColor: colorsInput.text_color || '#0f223b',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        alternatingRowBackground: (colorsInput.other && colorsInput.other.secondary && colorsInput.other.secondary !== colorsInput.background_color) ? colorsInput.other.secondary : '#f5f5f5',
        iconUrls: imagesInput.field || {},
        defaultCategoricalScheme: d3.schemeCategory10,
    };

    fillStyle.getColorForGroup = (groupName, index) => {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        const availableColors = colorsInput.available_colors || [];
        if (availableColors.length > 0) {
            return availableColors[index % availableColors.length];
        }
        return fillStyle.defaultCategoricalScheme[index % fillStyle.defaultCategoricalScheme.length];
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text || String(text).length === 0) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = String(text);
        tempSvg.appendChild(tempText);

        let width = 0;
        try {
            width = tempText.getBBox().width;
            if (width === 0 && String(text).length > 0) {
                const numChars = String(text).length;
                const estimatedCharWidth = parseFloat(fontSize.replace('px','')) * 0.6;
                return numChars * estimatedCharWidth;
            }
            return width;
        } catch (e) {
            const numChars = String(text).length;
            const estimatedCharWidth = parseFloat(fontSize.replace('px','')) * 0.6;
            return numChars * estimatedCharWidth;
        }
    }
    
    const formatValue = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return String(val); // Return original if not a number

        if (Math.abs(num) >= 1000000000) {
            return d3.format("~g")(num / 1000000000) + "B";
        } else if (Math.abs(num) >= 1000000) {
            return d3.format("~g")(num / 1000000) + "M";
        } else if (Math.abs(num) >= 1000) {
            return d3.format("~g")(num / 1000) + "K";
        } else {
            return d3.format("~g")(num);
        }
    };

    const flagWidth = variables.iconWidth || 20;
    const flagHeight = variables.iconHeight || 15;
    const flagPadding = variables.iconPadding || 5;

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 60, right: 70, bottom: 40, left: 70 };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 4: Core Chart Dimensions & Layout Calculation
    const showDimensionIcons = variables.showDimensionIcons !== undefined ? variables.showDimensionIcons : true;
    const showAlternatingRows = variables.showAlternatingRows !== undefined ? variables.showAlternatingRows : true;

    const allDimensionsForWidthCalc = [...new Set(chartData.map(d => d[dimensionField]))];
    let maxDimLabelTextWidth = 0;
    allDimensionsForWidthCalc.forEach(dim => {
        const dimText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const textWidth = estimateTextWidth(dimText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimLabelTextWidth = Math.max(maxDimLabelTextWidth, textWidth);
    });
    
    const centralLabelContentWidth = showDimensionIcons ? Math.max(maxDimLabelTextWidth, flagWidth) : maxDimLabelTextWidth;
    const centralLabelAreaWidth = Math.max(centralLabelContentWidth + 10, 60); // +10 for padding, min 60px

    // Block 5: Data Preprocessing & Transformation
    const allDimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    if (groups.length < 2 && chartData.length > 0) { // Check chartData.length to avoid error on initially empty data
        const errorMsg = "Need at least two groups for a diverging bar chart. Cannot render.";
        console.error(errorMsg);
        svgRoot.append("text").attr("class", "text error-message")
            .attr("x", containerWidth/2).attr("y", containerHeight/2)
            .attr("text-anchor", "middle").text(errorMsg).style("fill","red");
        return null;
    }
    if (chartData.length === 0) { // If still no data after group check (e.g. initial empty data passed group check)
        return svgRoot.node(); // Return empty SVG
    }


    const leftGroup = groups[0];
    const rightGroup = groups[1];
    fillStyle.leftBarColor = fillStyle.getColorForGroup(leftGroup, 0);
    fillStyle.rightBarColor = fillStyle.getColorForGroup(rightGroup, 1);

    const sortedDimensions = [...allDimensions].sort((a, b) => {
        const aData = chartData.find(d => d[dimensionField] === a && d[groupField] === leftGroup);
        const bData = chartData.find(d => d[dimensionField] === b && d[groupField] === leftGroup);
        const aValue = aData ? parseFloat(aData[valueField]) || 0 : 0;
        const bValue = bData ? parseFloat(bData[valueField]) || 0 : 0;
        return bValue - aValue;
    });

    // Block 6: Scale Definition & Configuration
    const yScalePaddingRatio = typeof variables.yScalePaddingRatio === 'number' ? variables.yScalePaddingRatio : 0.3;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(yScalePaddingRatio);

    const maxLeftVal = d3.max(chartData.filter(d => d[groupField] === leftGroup), d => parseFloat(d[valueField]));
    const maxRightVal = d3.max(chartData.filter(d => d[groupField] === rightGroup), d => parseFloat(d[valueField]));
    const maxValue = Math.max(0, maxLeftVal || 0, maxRightVal || 0, 1); // Ensure positive max, at least 1

    const barAreaWidth = Math.max((innerWidth - centralLabelAreaWidth) / 2, 0);

    const leftXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([barAreaWidth, 0]);

    const rightXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, barAreaWidth]);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    if (showAlternatingRows && fillStyle.alternatingRowBackground !== fillStyle.chartBackground) {
        const bandStep = yScale.step();
        const bandInnerPadding = bandStep * yScale.paddingInner();
        
        sortedDimensions.forEach((dim, i) => {
            if (i % 2 === 0) {
                mainChartGroup.append("rect")
                    .attr("class", "background other alternating-row")
                    .attr("x", -chartMargins.left)
                    .attr("y", yScale(dim) - bandInnerPadding / 2)
                    .attr("width", containerWidth)
                    .attr("height", yScale.bandwidth() + bandInnerPadding)
                    .attr("fill", fillStyle.alternatingRowBackground)
                    .attr("opacity", 0.6);
            }
        });
    }
    
    const groupLabelY = -15;
    const leftGroupLabelX = barAreaWidth;
    svgRoot.append("text")
        .attr("class", "label text group-label")
        .attr("x", chartMargins.left + leftGroupLabelX)
        .attr("y", chartMargins.top + groupLabelY)
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(groupUnit ? `${leftGroup}${groupUnit}` : leftGroup);

    const rightGroupLabelX = barAreaWidth + centralLabelAreaWidth;
     svgRoot.append("text")
        .attr("class", "label text group-label")
        .attr("x", chartMargins.left + rightGroupLabelX)
        .attr("y", chartMargins.top + groupLabelY)
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(groupUnit ? `${rightGroup}${groupUnit}` : rightGroup);

    const dimensionLabelsGroup = mainChartGroup.append("g")
        .attr("class", "dimension-labels-group other")
        .attr("transform", `translate(${barAreaWidth}, 0)`);

    sortedDimensions.forEach(dim => {
        const yPos = yScale(dim) + yScale.bandwidth() / 2;
        const dimText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        
        const labelItem = dimensionLabelsGroup.append("g").attr("class", "label dimension-item");

        if (showDimensionIcons && fillStyle.iconUrls[dim]) {
            // Text above icon
            labelItem.append("text")
                .attr("class", "text dimension-text")
                .attr("x", centralLabelAreaWidth / 2)
                .attr("y", yPos - flagHeight / 2 - flagPadding / 2) 
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimText);
            
            labelItem.append("image")
                .attr("class", "icon image dimension-icon")
                .attr("xlink:href", fillStyle.iconUrls[dim])
                .attr("x", centralLabelAreaWidth / 2 - flagWidth / 2)
                .attr("y", yPos + flagPadding / 2) 
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet");
        } else {
            labelItem.append("text")
                .attr("class", "text dimension-text")
                .attr("x", centralLabelAreaWidth / 2)
                .attr("y", yPos)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimText);
        }
    });

    // Block 8: Main Data Visualization Rendering
    const leftBarsGroup = mainChartGroup.append("g").attr("class", "left-bars-group mark");
    chartData.filter(d => d[groupField] === leftGroup).forEach(d => {
        const value = parseFloat(d[valueField]) || 0;
        if (value <= 0) return; 
        const barW = barAreaWidth - leftXScale(value);
        const xPos = leftXScale(value);
        const yCurrentPos = yScale(d[dimensionField]);

        if (yCurrentPos === undefined || barW <=0) return;

        leftBarsGroup.append("rect")
            .attr("class", "mark bar left-bar")
            .attr("x", xPos)
            .attr("y", yCurrentPos)
            .attr("width", barW)
            .attr("height", yScale.bandwidth())
            .attr("fill", fillStyle.leftBarColor)
            .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).style("opacity", 1); });

        const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
        leftBarsGroup.append("text")
            .attr("class", "label value value-label")
            .attr("x", xPos - 5)
            .attr("y", yCurrentPos + yScale.bandwidth() / 2)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "central")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedVal);
    });

    const rightBarsGroup = mainChartGroup.append("g")
        .attr("class", "right-bars-group mark")
        .attr("transform", `translate(${barAreaWidth + centralLabelAreaWidth}, 0)`);
    chartData.filter(d => d[groupField] === rightGroup).forEach(d => {
        const value = parseFloat(d[valueField]) || 0;
        if (value <= 0) return;
        const barW = rightXScale(value);
        const yCurrentPos = yScale(d[dimensionField]);

        if (yCurrentPos === undefined || barW <=0) return;

        rightBarsGroup.append("rect")
            .attr("class", "mark bar right-bar")
            .attr("x", 0)
            .attr("y", yCurrentPos)
            .attr("width", barW)
            .attr("height", yScale.bandwidth())
            .attr("fill", fillStyle.rightBarColor)
            .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).style("opacity", 1); });

        const formattedVal = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
        rightBarsGroup.append("text")
            .attr("class", "label value value-label")
            .attr("x", barW + 5)
            .attr("y", yCurrentPos + yScale.bandwidth() / 2)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "central")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedVal);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Hover effects are included with bar rendering.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
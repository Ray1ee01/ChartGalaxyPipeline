/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart type
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    let criticalConfigErrors = [];
    if (!dimensionFieldDef) criticalConfigErrors.push("definition for 'x' role field");
    if (!valueFieldDef) criticalConfigErrors.push("definition for 'y' role field");
    if (!groupFieldDef) criticalConfigErrors.push("definition for 'group' role field");

    if (criticalConfigErrors.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${criticalConfigErrors.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div").style("color", "red").html(errorMsg);
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!dimensionFieldName) criticalConfigErrors.push("'x' role field name");
    if (!valueFieldName) criticalConfigErrors.push("'y' role field name");
    if (!groupFieldName) criticalConfigErrors.push("'group' role field name");
    
    if (criticalConfigErrors.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${criticalConfigErrors.join(', ')} is undefined. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div").style("color", "red").html(errorMsg);
        return null;
    }

    const dimensionUnit = dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";
    const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            groupLabelFontFamily: rawTypography.title?.font_family || "Arial, sans-serif",
            groupLabelFontSize: rawTypography.title?.font_size || "16px",
            groupLabelFontWeight: rawTypography.title?.font_weight || "bold",
            categoryLabelFontFamily: rawTypography.label?.font_family || "Arial, sans-serif",
            categoryLabelFontSize: rawTypography.label?.font_size || "12px",
            categoryLabelFontWeight: rawTypography.label?.font_weight || "normal",
            valueLabelFontFamily: rawTypography.annotation?.font_family || "Arial, sans-serif",
            valueLabelFontSize: rawTypography.annotation?.font_size || "10px",
            valueLabelFontWeight: rawTypography.annotation?.font_weight || "normal",
        },
        colors: {
            textColor: rawColors.text_color || "#333333",
            backgroundColor: rawColors.background_color || "#FFFFFF",
            getGroupColor: (groupName, groupIndex) => {
                const defaultColors = d3.schemeCategory10;
                if (rawColors.field && rawColors.field[groupName]) {
                    return rawColors.field[groupName];
                }
                if (rawColors.available_colors && rawColors.available_colors.length > groupIndex) {
                    return rawColors.available_colors[groupIndex];
                }
                return defaultColors[groupIndex % defaultColors.length];
            }
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // getBBox should work on elements not in the rendering tree.
        return tempText.getBBox().width;
    }

    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight, lineHeight) {
        const words = text.split(/\s+/).reverse();
        let word;
        const lines = [];
        let currentLine = words.pop();
    
        while (words.length > 0 && currentLine !== undefined) {
            word = words.pop();
            if (word === undefined) break; 
            const testLine = currentLine + " " + word;
            const testWidth = estimateTextWidth(testLine, fontFamily, fontSize, fontWeight);
            if (testWidth < maxWidth) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        if (currentLine) lines.push(currentLine);
    
        // If still too wide (e.g. long single word or CJK text), character wrap
        if (lines.length === 1 && estimateTextWidth(lines[0], fontFamily, fontSize, fontWeight) > maxWidth) {
            const chars = lines[0].split('');
            lines.length = 0; // Clear lines array
            currentLine = "";
            for (let char of chars) {
                const testLine = currentLine + char;
                if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) < maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = char;
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        return lines;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~s")(value);
        return d3.format("~g")(value);
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.colors.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const groupLabelGapToChart = 15; // Space between group labels and main chart area
    const groupLabelPadding = { top: 20, bottom: groupLabelGapToChart };
    const chartMargins = { top: 0, right: 20, bottom: 40, left: 20 }; // top margin will be set dynamically

    let maxCategoryLabelWidth = 0;
    const tempDimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    tempDimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(labelText, fillStyle.typography.categoryLabelFontFamily, fillStyle.typography.categoryLabelFontSize, fillStyle.typography.categoryLabelFontWeight));
    });
    const categoryLabelAreaWidth = maxCategoryLabelWidth > 0 ? maxCategoryLabelWidth + 20 : 100; // Add padding, min width

    let maxLeftValueLabelWidth = 0;
    let maxRightValueLabelWidth = 0;
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (groups.length !== 2) {
        const errorMsg = `This chart requires exactly 2 groups. Found ${groups.length}. Cannot render.`;
        console.error(errorMsg);
        svgRoot.append("text").attr("x", 10).attr("y", 20).text(errorMsg).style("fill", "red");
        return svgRoot.node();
    }
    const leftGroup = groups[0];
    const rightGroup = groups[1];

    chartData.forEach(d => {
        const valueText = valueUnit ? `${formatValue(d[valueFieldName])}${valueUnit}` : formatValue(d[valueFieldName]);
        const width = estimateTextWidth(valueText, fillStyle.typography.valueLabelFontFamily, fillStyle.typography.valueLabelFontSize, fillStyle.typography.valueLabelFontWeight);
        if (d[groupFieldName] === leftGroup) {
            maxLeftValueLabelWidth = Math.max(maxLeftValueLabelWidth, width);
        } else {
            maxRightValueLabelWidth = Math.max(maxRightValueLabelWidth, width);
        }
    });
    const valueLabelPaddingHorizontal = 5; // Padding between value label and bar
    const leftValueLabelAreaWidth = maxLeftValueLabelWidth > 0 ? maxLeftValueLabelWidth + valueLabelPaddingHorizontal : 30;
    const rightValueLabelAreaWidth = maxRightValueLabelWidth > 0 ? maxRightValueLabelWidth + valueLabelPaddingHorizontal : 30;
    
    const groupLabelLineHeight = parseFloat(fillStyle.typography.groupLabelFontSize) * 1.2;
    const leftGroupLabelText = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    const rightGroupLabelText = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;

    const groupLabelAvailableWidth = (containerWidth - chartMargins.left - chartMargins.right - categoryLabelAreaWidth - 20) / 2; // 20 for gap between label areas
    
    const leftGroupWrapped = wrapText(leftGroupLabelText, groupLabelAvailableWidth, fillStyle.typography.groupLabelFontFamily, fillStyle.typography.groupLabelFontSize, fillStyle.typography.groupLabelFontWeight, groupLabelLineHeight);
    const rightGroupWrapped = wrapText(rightGroupLabelText, groupLabelAvailableWidth, fillStyle.typography.groupLabelFontFamily, fillStyle.typography.groupLabelFontSize, fillStyle.typography.groupLabelFontWeight, groupLabelLineHeight);
    
    const groupLabelsHeight = Math.max(leftGroupWrapped.length, rightGroupWrapped.length) * groupLabelLineHeight;
    chartMargins.top = groupLabelPadding.top + groupLabelsHeight + groupLabelPadding.bottom;

    const mainChartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const mainChartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barAreaWidthPerSide = (mainChartWidth - categoryLabelAreaWidth - leftValueLabelAreaWidth - rightValueLabelAreaWidth) / 2;

    if (barAreaWidthPerSide <= 0) {
        const errorMsg = "Not enough width to render chart elements after calculating label spaces. Adjust width or font sizes.";
        console.error(errorMsg);
        svgRoot.append("text").attr("x", 10).attr("y", containerHeight / 2).text(errorMsg).style("fill", "red").attr("class", "text error-message");
        return svgRoot.node();
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))]; // Keep original order
    const globalMaxValue = d3.max(chartData, d => Math.abs(d[valueFieldName]));

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, mainChartHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, globalMaxValue])
        .range([0, barAreaWidthPerSide]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Group Labels (Top of SVG, outside mainChartGroup for simpler y positioning)
    const leftGroupLabelG = svgRoot.append("g")
        .attr("class", "label group-label left-group-label")
        .attr("transform", `translate(${chartMargins.left}, ${groupLabelPadding.top})`);
    
    leftGroupWrapped.forEach((line, i) => {
        leftGroupLabelG.append("text")
            .attr("x", 0)
            .attr("y", i * groupLabelLineHeight)
            .attr("dy", "0.8em") // Approximation for baseline
            .style("font-family", fillStyle.typography.groupLabelFontFamily)
            .style("font-size", fillStyle.typography.groupLabelFontSize)
            .style("font-weight", fillStyle.typography.groupLabelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .attr("text-anchor", "start")
            .text(line);
    });

    const rightGroupLabelXPos = chartMargins.left + leftValueLabelAreaWidth + barAreaWidthPerSide + categoryLabelAreaWidth + barAreaWidthPerSide + rightValueLabelAreaWidth - groupLabelAvailableWidth;
    const rightGroupLabelG = svgRoot.append("g")
        .attr("class", "label group-label right-group-label")
        .attr("transform", `translate(${chartMargins.left + mainChartWidth - groupLabelAvailableWidth}, ${groupLabelPadding.top})`);

    rightGroupWrapped.forEach((line, i) => {
        rightGroupLabelG.append("text")
            .attr("x", groupLabelAvailableWidth) // x is relative to the group's transform
            .attr("y", i * groupLabelLineHeight)
            .attr("dy", "0.8em")
            .style("font-family", fillStyle.typography.groupLabelFontFamily)
            .style("font-size", fillStyle.typography.groupLabelFontSize)
            .style("font-weight", fillStyle.typography.groupLabelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .attr("text-anchor", "end")
            .text(line);
    });
    
    // Category Labels (Center of mainChartGroup)
    const categoryLabelsGroup = mainChartGroup.append("g")
        .attr("class", "category-labels-group")
        .attr("transform", `translate(${leftValueLabelAreaWidth + barAreaWidthPerSide}, 0)`);

    dimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        categoryLabelsGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", categoryLabelAreaWidth / 2)
            .attr("y", yScale(dim) + yScale.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.categoryLabelFontFamily)
            .style("font-size", fillStyle.typography.categoryLabelFontSize)
            .style("font-weight", fillStyle.typography.categoryLabelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(labelText);
    });

    // Block 8: Main Data Visualization Rendering
    // Left Bars and Value Labels
    const leftBarsGroup = mainChartGroup.append("g")
        .attr("class", "left-bars-group")
        .attr("transform", `translate(${leftValueLabelAreaWidth}, 0)`);

    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dim && d[groupFieldName] === leftGroup);
        if (dataPoint) {
            const val = Math.abs(dataPoint[valueFieldName]);
            leftBarsGroup.append("rect")
                .attr("class", "mark bar left-bar")
                .attr("x", barAreaWidthPerSide - xScale(val))
                .attr("y", yScale(dim))
                .attr("width", xScale(val))
                .attr("height", yScale.bandwidth())
                .style("fill", fillStyle.colors.getGroupColor(leftGroup, 0));

            const valueText = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : formatValue(dataPoint[valueFieldName]);
            const valueLabelFontSizeDynamic = Math.min(parseFloat(fillStyle.typography.valueLabelFontSize) * 1.5, Math.max(parseFloat(fillStyle.typography.valueLabelFontSize) * 0.8, yScale.bandwidth() * 0.5)) + 'px';

            mainChartGroup.append("text") // Position relative to mainChartGroup's origin
                .attr("class", "label value-label left-value-label")
                .attr("x", leftValueLabelAreaWidth - valueLabelPaddingHorizontal)
                .attr("y", yScale(dim) + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", valueLabelFontSizeDynamic)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(valueText);
        }
    });

    // Right Bars and Value Labels
    const rightBarsGroup = mainChartGroup.append("g")
        .attr("class", "right-bars-group")
        .attr("transform", `translate(${leftValueLabelAreaWidth + barAreaWidthPerSide + categoryLabelAreaWidth}, 0)`);

    dimensions.forEach(dim => {
        const dataPoint = chartData.find(d => d[dimensionFieldName] === dim && d[groupFieldName] === rightGroup);
        if (dataPoint) {
            const val = Math.abs(dataPoint[valueFieldName]);
            rightBarsGroup.append("rect")
                .attr("class", "mark bar right-bar")
                .attr("x", 0)
                .attr("y", yScale(dim))
                .attr("width", xScale(val))
                .attr("height", yScale.bandwidth())
                .style("fill", fillStyle.colors.getGroupColor(rightGroup, 1));
            
            const valueText = valueUnit ? `${formatValue(dataPoint[valueFieldName])}${valueUnit}` : formatValue(dataPoint[valueFieldName]);
            const valueLabelFontSizeDynamic = Math.min(parseFloat(fillStyle.typography.valueLabelFontSize) * 1.5, Math.max(parseFloat(fillStyle.typography.valueLabelFontSize) * 0.8, yScale.bandwidth() * 0.5)) + 'px';
            
            mainChartGroup.append("text") // Position relative to mainChartGroup's origin
                .attr("class", "label value-label right-value-label")
                .attr("x", leftValueLabelAreaWidth + barAreaWidthPerSide + categoryLabelAreaWidth + barAreaWidthPerSide + valueLabelPaddingHorizontal)
                .attr("y", yScale(dim) + yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.valueLabelFontFamily)
                .style("font-size", valueLabelFontSizeDynamic)
                .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(valueText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like complex interactions or annotations in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
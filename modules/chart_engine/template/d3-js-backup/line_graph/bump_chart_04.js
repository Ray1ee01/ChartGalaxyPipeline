/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_04",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prioritize dark theme colors
    // const imagesConfig = data.images || {}; // Not used in this chart

    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    const xFieldName = xColumn ? xColumn.name : undefined;
    const yFieldName = yColumn ? yColumn.name : undefined;
    const groupFieldName = groupColumn ? groupColumn.name : undefined;

    const missingFields = [];
    if (!xFieldName) missingFields.push("x field (role: 'x')");
    if (!yFieldName) missingFields.push("y field (role: 'y')");
    if (!groupFieldName) missingFields.push("group field (role: 'group')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {}
    };

    // Typography defaults
    const defaultLabelFont = { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "normal" };
    const defaultAnnotationFont = { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" };

    fillStyle.typography.labelFontFamily = (typographyConfig.label && typographyConfig.label.font_family) || defaultLabelFont.font_family;
    fillStyle.typography.labelFontSize = (typographyConfig.label && typographyConfig.label.font_size) || defaultLabelFont.font_size;
    fillStyle.typography.labelFontWeight = (typographyConfig.label && typographyConfig.label.font_weight) || defaultLabelFont.font_weight;

    fillStyle.typography.annotationFontFamily = (typographyConfig.annotation && typographyConfig.annotation.font_family) || defaultAnnotationFont.font_family;
    fillStyle.typography.annotationFontSize = (typographyConfig.annotation && typographyConfig.annotation.font_size) || defaultAnnotationFont.font_size;
    fillStyle.typography.annotationFontWeight = (typographyConfig.annotation && typographyConfig.annotation.font_weight) || defaultAnnotationFont.font_weight;
    
    // Color defaults (assuming dark theme from metadata)
    fillStyle.textColor = colorsConfig.text_color || "#FFFFFF";
    fillStyle.backgroundColor = colorsConfig.background_color || "#1E1E1E";
    fillStyle.defaultLineColor = (colorsConfig.other && colorsConfig.other.primary) || "#888888";
    fillStyle.dotStrokeColor = fillStyle.backgroundColor; // For contrast against lines/dots

    const getColorByGroup = (group, index, groupNames) => {
        if (colorsConfig.field && colorsConfig.field[group]) {
            return colorsConfig.field[group];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            const groupIndex = groupNames.indexOf(group); // Ensure consistent color mapping
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        return fillStyle.defaultLineColor;
    };

    const estimateTextWidth = (text, fontSize, fontFamily, fontWeight) => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to DOM is not required for getBBox if styles are set directly.
        // However, for getComputedTextLength, it might be more reliable if appended, but we aim to avoid it.
        // getBBox should work on unattached elements if attributes are set.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail or for very simple estimations
            return text.length * (parseInt(fontSize) / 2); 
        }
    };

    const parseDate = (dateString) => {
        if (dateString instanceof Date) return dateString;
        const parsed = new Date(dateString);
        return isNaN(parsed.getTime()) ? null : parsed;
    };
    
    const safeClassName = (name) => {
        return "group-" + (name || "").toString().replace(/[^a-zA-Z0-9_]/g, "-");
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 180, bottom: 60, left: 80 }; // Adjusted top for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))].sort();
    
    const uniqueParsedXDates = [...new Set(chartDataArray.map(d => parseDate(d[xFieldName])))]
        .filter(d => d !== null) // Filter out unparseable dates
        .sort((a, b) => a - b);

    if (uniqueParsedXDates.length === 0) {
        const errorMsg = "No valid date values found in the x-field.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }
    
    const rankData = {};
    groupNames.forEach(group => {
        rankData[group] = [];
    });

    uniqueParsedXDates.forEach(xDate => {
        const itemsAtX = chartDataArray.filter(d => {
            const currentDate = parseDate(d[xFieldName]);
            return currentDate && currentDate.getTime() === xDate.getTime();
        });

        const validItems = itemsAtX.filter(d => d[yFieldName] !== null && d[yFieldName] !== undefined && !isNaN(d[yFieldName]));
        validItems.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher yField = better rank

        validItems.forEach((d, i) => {
            if (d[groupFieldName] && rankData[d[groupFieldName]]) {
                rankData[d[groupFieldName]].push({
                    xDate: xDate,
                    originalX: d[xFieldName], // Keep original for potential display
                    rank: i + 1,
                    value: d[yFieldName]
                });
            }
        });
    });
    
    groupNames.forEach(group => {
        if (rankData[group]) {
            rankData[group].sort((a, b) => a.xDate - b.xDate); // Ensure data per group is sorted by date
        }
    });


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scalePoint()
        .domain(uniqueParsedXDates)
        .range([0, innerWidth])
        .padding(0.1); // Small padding so points are not at the very edge of axes if only two points

    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, groupNames.length)]) // Rank 1 at top
        .range([0, innerHeight]);

    const timeFormatForDisplay = d3.timeFormat("%b %Y"); // Example, can be made more dynamic

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Y-axis rank labels
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    for (let i = 1; i <= groupNames.length; i++) {
        yAxisLabelsGroup.append("text")
            .attr("class", "label axis-label y-axis-label")
            .attr("x", -10)
            .attr("y", yScale(i))
            .attr("dy", "0.32em") // Vertically center
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(i);
    }

    // X-axis time labels (top)
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis");
    
    let xTicksToDisplay = [...uniqueParsedXDates];
    if (uniqueParsedXDates.length > 1) { // Only try to reduce ticks if there's more than one
        const estimatedLabelWidths = uniqueParsedXDates.map(tick => 
            estimateTextWidth(
                timeFormatForDisplay(tick), 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontFamily,
                fillStyle.typography.labelFontWeight
            )
        );
        const minLabelSpacing = 10;
        const totalLabelWidth = estimatedLabelWidths.reduce((sum, width) => sum + width, 0) + (estimatedLabelWidths.length - 1) * minLabelSpacing;

        if (totalLabelWidth > innerWidth && estimatedLabelWidths.length > 2) {
            const avgLabelWidth = d3.mean(estimatedLabelWidths) || 50;
            let idealCount = Math.floor(innerWidth / (avgLabelWidth + minLabelSpacing));
            idealCount = Math.max(2, idealCount); // Ensure at least 2 ticks (start and end)

            if (idealCount < uniqueParsedXDates.length) {
                const newTicks = [uniqueParsedXDates[0]];
                const step = (uniqueParsedXDates.length - 1) / (idealCount - 1);
                for (let i = 1; i < idealCount - 1; i++) {
                    newTicks.push(uniqueParsedXDates[Math.round(i * step)]);
                }
                newTicks.push(uniqueParsedXDates[uniqueParsedXDates.length - 1]);
                xTicksToDisplay = [...new Set(newTicks)].sort((a,b) => a-b); // Deduplicate and sort
            }
        }
    }


    xTicksToDisplay.forEach(tickDate => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label axis-label x-axis-label")
            .attr("x", xScale(tickDate))
            .attr("y", -chartMargins.top / 2) // Position above the chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(timeFormatForDisplay(tickDate));
    });

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .defined(d => d.rank !== null && d.rank !== undefined && !isNaN(d.rank))
        .x(d => xScale(d.xDate))
        .y(d => yScale(d.rank))
        .curve(d3.curveCatmullRom.alpha(0.5));

    groupNames.forEach((group, groupIndex) => {
        const groupData = rankData[group];
        if (!groupData || groupData.length === 0) return;

        const groupColor = getColorByGroup(group, groupIndex, groupNames);
        const groupSpecificClass = safeClassName(group);

        // Lines
        if (groupData.length > 1) {
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", `mark line-mark ${groupSpecificClass}`)
                .attr("fill", "none")
                .attr("stroke", groupColor)
                .attr("stroke-width", 3)
                .attr("d", lineGenerator);
        }

        // Points (Circles)
        mainChartGroup.selectAll(`.point-mark.${groupSpecificClass}`)
            .data(groupData.filter(d => d.rank !== null && d.rank !== undefined && !isNaN(d.rank)))
            .enter()
            .append("circle")
            .attr("class", `mark point-mark ${groupSpecificClass}`)
            .attr("cx", d => xScale(d.xDate))
            .attr("cy", d => yScale(d.rank))
            .attr("r", 5)
            .attr("fill", groupColor)
            .attr("stroke", fillStyle.dotStrokeColor)
            .attr("stroke-width", 2);

        // Data Value Labels
        mainChartGroup.selectAll(`.data-label.${groupSpecificClass}`)
            .data(groupData.filter(d => d.rank !== null && d.rank !== undefined && !isNaN(d.rank)))
            .enter()
            .append("text")
            .attr("class", `label data-label ${groupSpecificClass}`)
            .attr("x", d => xScale(d.xDate))
            .attr("y", d => yScale(d.rank) - 10) // Position above the point
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(d => d.value);

        // Group Labels (Left and Right)
        const firstPoint = groupData[0];
        if (firstPoint && firstPoint.rank) {
            mainChartGroup.append("text")
                .attr("class", `label group-label ${groupSpecificClass}`)
                .attr("x", -chartMargins.left + 10) // Position in the left margin
                .attr("y", yScale(firstPoint.rank))
                .attr("dy", "0.32em")
                .attr("text-anchor", "start") // Changed from end to start for consistency with right
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold") // Keep bold for emphasis
                .attr("fill", groupColor)
                .text(group);
        }

        const lastPoint = groupData[groupData.length - 1];
        if (lastPoint && lastPoint.rank) {
            mainChartGroup.append("text")
                .attr("class", `label group-label ${groupSpecificClass}`)
                .attr("x", innerWidth + 10) // Position in the right margin
                .attr("y", yScale(lastPoint.rank))
                .attr("dy", "0.32em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", "bold") // Keep bold for emphasis
                .attr("fill", groupColor)
                .text(group);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements required for this chart type based on directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
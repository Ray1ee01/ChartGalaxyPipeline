/* REQUIREMENTS_BEGIN
{
  "chart_type": "Range Area Chart",
  "chart_name": "range_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 2]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // Assuming light theme, or dark theme handled by caller
    const imagesInput = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const xFieldObject = getField(xFieldRole);
    const yFieldObject = getField(yFieldRole);
    const groupFieldObject = getField(groupFieldRole);

    const xFieldName = xFieldObject?.name;
    const yFieldName = yFieldObject?.name;
    const groupFieldName = groupFieldObject?.name;

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    // Further validation: ensure chartDataInput is an array
    if (!Array.isArray(chartDataInput)) {
        const errorMsg = "Chart data is not an array. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: { // Example, not used for main title here
                font_family: typographyInput.title?.font_family || "Arial, sans-serif",
                font_size: typographyInput.title?.font_size || "16px",
                font_weight: typographyInput.title?.font_weight || "bold",
            },
            label: { // For axis titles, data labels
                font_family: typographyInput.label?.font_family || "Arial, sans-serif",
                font_size: typographyInput.label?.font_size || "12px",
                font_weight: typographyInput.label?.font_weight || "normal",
            },
            annotation: { // For axis tick labels
                font_family: typographyInput.annotation?.font_family || "Arial, sans-serif",
                font_size: typographyInput.annotation?.font_size || "10px",
                font_weight: typographyInput.annotation?.font_weight || "normal",
            },
            axisTitle: { // Custom for Y-axis title if needed, derived from label
                font_family: typographyInput.label?.font_family || "Arial, sans-serif",
                font_size: "14px", // Original used 14px
                font_weight: "bold", // Original used bold
            }
        },
        textColor: colorsInput.text_color || "#222222",
        axisLineColor: colorsInput.other?.axis_line || "#666666",
        gridLineColor: colorsInput.other?.grid_line || "#cccccc",
        areaFillColor: (colorsInput.available_colors && colorsInput.available_colors.length > 0) 
                       ? colorsInput.available_colors[0] 
                       : (colorsInput.other?.primary ? colorsInput.other.primary : "#ebbc48"),
        getGroupLineColor: (groupName, index, selectedGroupNames) => {
            if (colorsInput.field && colorsInput.field[groupName]) {
                return colorsInput.field[groupName];
            }
            // Fallback using primary/secondary if available for the two selected groups
            if (selectedGroupNames && selectedGroupNames.length === 2) {
                if (groupName === selectedGroupNames[0] && colorsInput.other?.primary) return colorsInput.other.primary;
                if (groupName === selectedGroupNames[1] && colorsInput.other?.secondary) return colorsInput.other.secondary;
            }
            // General fallback
            return (colorsInput.available_colors && colorsInput.available_colors.length > index)
                   ? colorsInput.available_colors[index % colorsInput.available_colors.length]
                   : d3.schemeCategory10[index % 10];
        },
        chartBackground: colorsInput.background_color || "transparent", // Use transparent if not specified
    };

    const parseDate = (d) => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1); // Assume year if number
        if (typeof d === 'string') {
            const parts = d.split('-');
            if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (parts.length === 2) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return new Date(parseInt(parts[0]), 0, 1);
        }
        // Try general parsing as a last resort, or return null if invalid
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? null : parsed;
    };
    
    const estimateTextWidth = (text, fontProps) => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontProps) {
            if (fontProps.font_family) textElement.setAttribute('font-family', fontProps.font_family);
            if (fontProps.font_size) textElement.setAttribute('font-size', fontProps.font_size);
            if (fontProps.font_weight) textElement.setAttribute('font-weight', fontProps.font_weight);
        }
        textElement.textContent = text;
        svg.appendChild(textElement); 
        // No need to append to DOM for getBBox to work on text elements
        const width = textElement.getBBox().width;
        return width;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root");

    if (fillStyle.chartBackground !== "transparent") {
        svgRoot.append("rect")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("fill", fillStyle.chartBackground);
    }
    
    const chartMargins = { top: 60, right: 60, bottom: 60, left: 120 }; // Increased left margin for labels

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]) // Ensure xField is Date object
    })).filter(d => d[xFieldName] !== null); // Filter out invalid dates

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points after date parsing. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const groupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groupNames.length < 2) {
        const errorMsg = `Chart requires at least two groups, found ${groupNames.length}. Cannot render range area.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const groupAverages = groupNames.map(group => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);
        const avg = d3.mean(groupData, d => d[yFieldName]);
        return { group, avg };
    }).sort((a, b) => b.avg - a.avg); // Sort descending by average

    const highestGroup = groupAverages[0].group;
    const lowestGroup = groupAverages[groupAverages.length - 1].group;
    const selectedGroupNames = [highestGroup, lowestGroup]; // Order matters for color assignment if using primary/secondary

    const group1DataSorted = chartDataArray
        .filter(d => d[groupFieldName] === highestGroup)
        .sort((a, b) => a[xFieldName] - b[xFieldName]);

    const group2DataSorted = chartDataArray
        .filter(d => d[groupFieldName] === lowestGroup)
        .sort((a, b) => a[xFieldName] - b[xFieldName]);

    // Create merged data for area, ensuring y-values are from highest and lowest groups correctly
    const areaDataCombined = [];
    const allDates = new Set([...group1DataSorted.map(d => d[xFieldName].getTime()), ...group2DataSorted.map(d => d[xFieldName].getTime())]);
    const sortedDates = Array.from(allDates).map(t => new Date(t)).sort((a,b) => a - b);

    sortedDates.forEach(date => {
        const g1Item = group1DataSorted.find(d => d[xFieldName].getTime() === date.getTime());
        const g2Item = group2DataSorted.find(d => d[xFieldName].getTime() === date.getTime());

        // Interpolate if one group is missing data for a date present in the other
        // For simplicity, this example only includes points where both groups have data or can be reasonably inferred.
        // A more robust solution might interpolate missing values.
        // The original code only used common dates. We will stick to that for now.
        if (g1Item && g2Item) {
             areaDataCombined.push({
                [xFieldName]: date,
                // Ensure group1Value is always the one from the 'highest' average group
                // and group2Value from the 'lowest' average group for consistent area rendering.
                group1Value: g1Item[yFieldName], 
                group2Value: g2Item[yFieldName]
            });
        }
    });


    // Block 6: Scale Definition & Configuration
    const xExtent = d3.extent(chartDataArray, d => d[xFieldName]);
    const xRange = xExtent[1] - xExtent[0];
    const xPadding = xRange === 0 ? 1000*60*60*24 : xRange * 0.05; // Add 1 day padding if single date

    const xScale = d3.scaleTime()
        .domain([new Date(xExtent[0].getTime() - xPadding), new Date(xExtent[1].getTime() + xPadding)])
        .range([0, chartWidth]);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yRange = yMax - yMin;
    const yPadding = yRange === 0 ? Math.abs(yMax * 0.1) || 1 : yRange * 0.1; // Add 10% or 1 unit padding

    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin - yPadding), yMax + yPadding]) // Ensure 0 is included if data is all positive
        .range([chartHeight, 0]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    // X-axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${chartHeight})`);
    
    xAxisGroup.append("line")
        .attr("x1", 0)
        .attr("x2", chartWidth)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    const timeSpan = xExtent[1] - xExtent[0];
    const yearSpan = timeSpan / (1000 * 60 * 60 * 24 * 365);
    let timeInterval, xTickFormat;

    if (yearSpan > 7) {
        timeInterval = d3.timeYear.every(Math.max(1, Math.floor(yearSpan / 7))); // Aim for ~7 ticks
        xTickFormat = d3.timeFormat("%Y");
    } else if (yearSpan > 2) {
        timeInterval = d3.timeYear.every(1);
        xTickFormat = d3.timeFormat("%Y");
    } else if (yearSpan > 0.5) { // More than 6 months
        timeInterval = d3.timeMonth.every(3);
        xTickFormat = d3.timeFormat("%b %Y");
    } else { // Less than 6 months
        timeInterval = d3.timeMonth.every(1);
        xTickFormat = d3.timeFormat("%b %d");
    }
    
    const xTicks = xScale.ticks(timeInterval);
    xAxisGroup.selectAll(".tick-label")
        .data(xTicks)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotation.font_family)
        .style("font-size", fillStyle.typography.annotation.font_size)
        .style("font-weight", fillStyle.typography.annotation.font_weight)
        .style("fill", fillStyle.textColor)
        .text(d => xTickFormat(d));

    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.append("line")
        .attr("y1", 0)
        .attr("y2", chartHeight)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    const yTicks = yScale.ticks(5); // Aim for 5 ticks
    yAxisGroup.selectAll(".tick-label")
        .data(yTicks)
        .enter()
        .append("text")
        .attr("class", "label y-axis-label")
        .attr("x", -10)
        .attr("y", d => yScale(d))
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.annotation.font_family)
        .style("font-size", fillStyle.typography.annotation.font_size)
        .style("font-weight", fillStyle.typography.annotation.font_weight)
        .style("fill", fillStyle.textColor)
        .text(d => d3.format(",.0f")(d));

    // Gridlines
    const gridlinesGroup = mainChartGroup.append("g").attr("class", "gridlines");
    gridlinesGroup.selectAll(".gridline")
        .data(yTicks.filter(d => d !== 0)) // Don't draw gridline on x-axis if y=0 is a tick
        .enter()
        .append("line")
        .attr("class", "gridline y-gridline")
        .attr("x1", 0)
        .attr("y1", d => yScale(d))
        .attr("x2", chartWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2"); // Subtle dash

    // Y-axis Title
    if (yFieldObject?.description || yFieldObject?.name) {
        const yAxisTitleGroup = mainChartGroup.append("g").attr("class", "axis-title y-axis-title");
        const minYear = d3.min(chartDataArray, d => d[xFieldName].getFullYear());
        const maxYear = d3.max(chartDataArray, d => d[xFieldName].getFullYear());
        const yearRangeStr = (minYear && maxYear && minYear !== maxYear) ? `${minYear}-${maxYear}` : (minYear || "");
        
        if (yFieldObject.description) {
            yAxisTitleGroup.append("text")
                .attr("class", "text y-axis-title-description")
                .attr("transform", "rotate(-90)")
                .attr("x", -chartHeight / 2) // Centered along the rotated axis
                .attr("y", -chartMargins.left + 30) // Position to the left of the axis
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.axisTitle.font_family)
                .style("font-size", fillStyle.typography.axisTitle.font_size)
                .style("font-weight", fillStyle.typography.axisTitle.font_weight)
                .style("fill", fillStyle.textColor)
                .text(`${yFieldObject.description} ${yearRangeStr}`.trim());
        }
        
        if (yFieldObject.name) {
             yAxisTitleGroup.append("text")
                .attr("class", "text y-axis-title-name")
                .attr("transform", "rotate(-90)")
                .attr("x", -chartHeight / 2)
                .attr("y", -chartMargins.left + (yFieldObject.description ? 50 : 30)) // Adjust based on presence of description
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", fillStyle.typography.label.font_weight)
                .style("fill", fillStyle.textColor)
                .text(`(${yFieldObject.name})`);
        }
    }

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]));

    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(d => yScale(d.group2Value)) // Value from 'lowest' average group
        .y1(d => yScale(d.group1Value)); // Value from 'highest' average group

    if (areaDataCombined.length > 0) {
        mainChartGroup.append("path")
            .datum(areaDataCombined)
            .attr("class", "mark area-range")
            .attr("fill", fillStyle.areaFillColor)
            .attr("d", areaGenerator);
    }
    
    const group1Color = fillStyle.getGroupLineColor(selectedGroupNames[0], 0, selectedGroupNames);
    const group2Color = fillStyle.getGroupLineColor(selectedGroupNames[1], 1, selectedGroupNames);

    if (group1DataSorted.length > 0) {
        mainChartGroup.append("path")
            .datum(group1DataSorted)
            .attr("class", "mark line group1-line")
            .attr("fill", "none")
            .attr("stroke", group1Color)
            .attr("stroke-width", 3)
            .attr("d", lineGenerator);
    }

    if (group2DataSorted.length > 0) {
        mainChartGroup.append("path")
            .datum(group2DataSorted)
            .attr("class", "mark line group2-line")
            .attr("fill", "none")
            .attr("stroke", group2Color)
            .attr("stroke-width", 3)
            .attr("d", lineGenerator);
    }

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const dataLabelsGroup = mainChartGroup.append("g").attr("class", "data-labels");

    // Group name labels (at start of lines)
    if (group1DataSorted.length > 0) {
        const firstPoint1 = group1DataSorted[0];
        dataLabelsGroup.append("text")
            .attr("class", "label group-name-label")
            .attr("x", xScale(firstPoint1[xFieldName])) // Position near the start of the line
            .attr("y", yScale(firstPoint1[yFieldName]))
            .attr("dx", -10) // Offset to the left
            .attr("dy", firstPoint1[yFieldName] > group2DataSorted[0]?.[yFieldName] ? -5 : 5) // Adjust dy based on relative position
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", "bold")
            .style("fill", group1Color)
            .text(selectedGroupNames[0]);
    }
    if (group2DataSorted.length > 0) {
        const firstPoint2 = group2DataSorted[0];
        dataLabelsGroup.append("text")
            .attr("class", "label group-name-label")
            .attr("x", xScale(firstPoint2[xFieldName]))
            .attr("y", yScale(firstPoint2[yFieldName]))
            .attr("dx", -10)
            .attr("dy", firstPoint2[yFieldName] > group1DataSorted[0]?.[yFieldName] ? -5 : 5)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", "bold")
            .style("fill", group2Color)
            .text(selectedGroupNames[1]);
    }
    
    // Value labels (start and end of lines)
    [group1DataSorted, group2DataSorted].forEach((groupData, index) => {
        if (groupData.length > 0) {
            const groupColor = index === 0 ? group1Color : group2Color;
            const firstPoint = groupData[0];
            const lastPoint = groupData[groupData.length - 1];

            // Start value
            dataLabelsGroup.append("text")
                .attr("class", "value data-value-label")
                .attr("x", xScale(firstPoint[xFieldName]))
                .attr("y", yScale(firstPoint[yFieldName]))
                .attr("dx", -5) // Small offset from line start
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", "bold")
                .style("fill", groupColor)
                .text(d3.format(",.0f")(firstPoint[yFieldName]));

            // End value
            dataLabelsGroup.append("text")
                .attr("class", "value data-value-label")
                .attr("x", xScale(lastPoint[xFieldName]))
                .attr("y", yScale(lastPoint[yFieldName]))
                .attr("dx", 5) // Small offset from line end
                .attr("text-anchor", "start")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.label.font_family)
                .style("font-size", fillStyle.typography.label.font_size)
                .style("font-weight", "bold")
                .style("fill", groupColor)
                .text(d3.format(",.0f")(lastPoint[yFieldName]));
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
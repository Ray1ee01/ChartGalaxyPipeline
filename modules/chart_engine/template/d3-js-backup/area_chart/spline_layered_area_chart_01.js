/* REQUIREMENTS_BEGIN
{
  "chart_type": "Layered Area Chart",
  "chart_name": "spline_layered_area_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 50], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "prominent",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prioritize dark theme colors if available
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xFieldColumn = dataColumns.find(col => col.role === 'x');
    const yFieldColumn = dataColumns.find(col => col.role === 'y');
    const groupFieldColumn = dataColumns.find(col => col.role === 'group');

    if (!xFieldColumn || !yFieldColumn || !groupFieldColumn) {
        const missing = [
            !xFieldColumn ? "x role" : null,
            !yFieldColumn ? "y role" : null,
            !groupFieldColumn ? "group role" : null
        ].filter(Boolean).join(', ');
        const errorMessage = `Critical chart config missing: column roles for [${missing}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMessage}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldColumn.name;
    const yFieldName = yFieldColumn.name;
    const groupFieldName = groupFieldColumn.name;

    d3.select(containerSelector).html("");

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
            valueFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif', // For data values in labels
            valueFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '20px', // Larger for values
            valueFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'bold',
        },
        textColor: colorsConfig.text_color || '#E0E0E0', // Default light text for darkish themes
        backgroundColor: colorsConfig.background_color || '#1E293B', // Default darkish background
        gridLineColor: (colorsConfig.other && colorsConfig.other.grid_line) || '#4A5568',
        axisLineColor: (colorsConfig.other && colorsConfig.other.axis_line) || '#718096',
        areaOpacity: variables.areaOpacity || 0.7,
        labelTextColor: (colorsConfig.other && colorsConfig.other.label_text_on_color) || '#FFFFFF', // For text on colored backgrounds
    };

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getGroupColor = (groupName, index) => {
        if (colorsConfig.field && colorsConfig.field[groupName]) {
            return colorsConfig.field[groupName];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontProps) {
        if (!text || typeof document === 'undefined') return 0; // Guard for non-browser environments
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family || 'Arial, sans-serif');
        textElement.setAttribute('font-size', fontProps.font_size || '12px');
        textElement.setAttribute('font-weight', fontProps.font_weight || 'normal');
        textElement.textContent = text;
        svg.appendChild(textElement);
        // No DOM append needed for getBBox in modern browsers if attributes are set
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // console.warn("Could not measure text width for:", text, e);
        }
        return width;
    }
    
    // Helper: Date parsing (assuming common ISO-like formats or actual Date objects)
    const parseDate = (dateStr) => {
        if (dateStr instanceof Date) return dateStr;
        // Attempt common formats; add more robust parsing if needed
        const formats = ["%Y-%m-%dT%H:%M:%S.%LZ", "%Y-%m-%dT%H:%M:%S%Z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"];
        for (const format of formats) {
            const parsed = d3.timeParse(format)(dateStr);
            if (parsed) return parsed;
        }
        return new Date(dateStr); // Fallback to native Date parser
    };


    // Helper: X-axis scale and ticks (adapted from original logic's needs)
    function createXAxisScaleAndTicksHelper(data, xAccessor, rangeMin, rangeMax) {
        const dates = data.map(xAccessor).filter(d => d instanceof Date && !isNaN(d)).sort(d3.ascending);
        if (dates.length === 0) {
            const now = new Date();
            const then = d3.timeDay.offset(now, 1);
            return {
                xScale: d3.scaleTime().domain([now, then]).range([rangeMin, rangeMax]),
                xTicks: [now, then],
                xFormat: d3.timeFormat("%b %d"),
                firstDate: now,
                lastDate: then
            };
        }
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];

        const xScale = d3.scaleTime().domain([firstDate, lastDate]).range([rangeMin, rangeMax]);

        const timeSpanDays = d3.timeDay.count(firstDate, lastDate);
        let tickCountTarget = Math.max(2, Math.min(7, Math.floor(rangeMax / 120))); // Aim for ~120px per tick

        let xTicks;
        let xFormat;

        if (timeSpanDays <= 0) {
             xTicks = xScale.ticks(2); xFormat = d3.timeFormat("%b %d %H:%M");
        } else if (timeSpanDays <= 2) {
            xTicks = xScale.ticks(d3.timeHour.every(Math.max(1, Math.ceil(timeSpanDays * 24 / tickCountTarget))));
            xFormat = d3.timeFormat("%H:%M");
        } else if (timeSpanDays <= 45) { // ~1.5 months
            xTicks = xScale.ticks(d3.timeDay.every(Math.max(1, Math.ceil(timeSpanDays / tickCountTarget))));
            xFormat = d3.timeFormat("%b %d");
        } else if (timeSpanDays <= 365 * 2) { // Up to 2 years
            xTicks = xScale.ticks(d3.timeMonth.every(Math.max(1, Math.ceil((timeSpanDays / 30) / tickCountTarget))));
            xFormat = d3.timeFormat("%b '%y");
        } else {
            xTicks = xScale.ticks(d3.timeYear.every(Math.max(1, Math.ceil((timeSpanDays / 365) / tickCountTarget))));
            xFormat = d3.timeFormat("%Y");
        }
        
        // Ensure xTicks are within the domain, d3.scaleTime.ticks() can sometimes go outside
        xTicks = xTicks.filter(tick => tick >= firstDate && tick <= lastDate);
        if (xTicks.length < 2 && dates.length >=2) { // Ensure at least two ticks if data exists
            xTicks = [firstDate, lastDate];
        }


        return { xScale, xTicks, xFormat, firstDate, lastDate };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 40,
        right: variables.margin_right || 80, // Increased for end-of-line labels
        bottom: variables.margin_bottom || 50,
        left: variables.margin_left || 70
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));
    
    if (processedChartData.length === 0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "16px")
            .attr("fill", fillStyle.textColor)
            .text("No valid data to display.");
        return svgRoot.node();
    }

    const groups = [...new Set(processedChartData.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const aLast = processedChartData.filter(d => d[groupFieldName] === a).sort((p1, p2) => d3.descending(p1[xFieldName], p2[xFieldName]))[0];
            const bLast = processedChartData.filter(d => d[groupFieldName] === b).sort((p1, p2) => d3.descending(p1[xFieldName], p2[xFieldName]))[0];
            if (!aLast || !bLast) return 0;
            return aLast[yFieldName] - bLast[yFieldName]; // Ascending sort by last Y value
        });

    // Block 6: Scale Definition & Configuration
    const { xScale, xTicks, xFormat, firstDate, lastDate } = createXAxisScaleAndTicksHelper(
        processedChartData,
        d => d[xFieldName],
        0,
        innerWidth
    );

    const yMax = d3.max(processedChartData, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, (yMax || 0) * 1.25]) // Add 25% headroom, handle yMax=0
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("transform", `translate(0, ${innerHeight})`)
        .attr("class", "axis x-axis");

    xAxisGroup.call(d3.axisBottom(xScale).ticks(xTicks.length > 0 ? xTicks : 5).tickFormat(xFormat))
        .selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .attr("class", "label");

    xAxisGroup.selectAll("path.domain, g.tick line")
        .attr("stroke", fillStyle.axisLineColor);
    
    // Vertical Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines vertical-gridlines")
        .selectAll("line")
        .data(xScale.ticks(xTicks.length > 0 ? xTicks : 5)) // Use scale.ticks() for grid consistency
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2,2");

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    yAxisGroup.call(d3.axisLeft(yScale).ticks(5).tickFormat(d => (d % 1 !== 0 && d !==0) ? d3.format(".1f")(d) : d3.format(".0f")(d) )) // Show 1 decimal for non-integers
        .selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .attr("class", "label");
        
    yAxisGroup.selectAll("path.domain, g.tick line")
        .attr("stroke", fillStyle.axisLineColor);

    // Horizontal Gridlines
    mainChartGroup.append("g")
        .attr("class", "gridlines horizontal-gridlines")
        .selectAll("line")
        .data(yScale.ticks(5))
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2,2");

    // Block 8: Main Data Visualization Rendering (Areas)
    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]))
        .curve(d3.curveMonotoneX);

    // Draw areas in reversed sorted order (group with highest last Y value at bottom)
    [...groups].reverse().forEach((group, index) => {
        const groupData = processedChartData.filter(d => d[groupFieldName] === group)
            .sort((a, b) => d3.ascending(a[xFieldName], b[xFieldName])); // Ensure data is sorted by xField for area path

        if (groupData.length > 1) { // Area needs at least 2 points
             mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", "mark area-mark")
                .attr("fill", fillStyle.getGroupColor(group, groups.indexOf(group))) // Use original index for consistent color
                .attr("opacity", fillStyle.areaOpacity)
                .attr("d", areaGenerator);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (End-of-line Labels, Last Date Annotation)
    // Last date annotation (original "last year annotation")
    if (lastDate && processedChartData.length > 0) {
        const lastDateX = xScale(lastDate);
        const annotationGroup = mainChartGroup.append("g").attr("class", "annotation last-date-annotation");

        annotationGroup.append("line")
            .attr("class", "mark annotation-line")
            .attr("x1", lastDateX)
            .attr("y1", 0)
            .attr("x2", lastDateX)
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.textColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3")
            .attr("opacity", 0.7);

        annotationGroup.append("text")
            .attr("class", "text annotation-text")
            .attr("x", lastDateX)
            .attr("y", -5) // Position above the chart area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .attr("fill", fillStyle.textColor)
            .text(xFormat(lastDate));
        
        annotationGroup.append("path") // Small triangle pointing down to the line
            .attr("class", "mark annotation-pointer")
            .attr("d", d3.symbol().type(d3.symbolTriangle).size(36))
            .attr("transform", `translate(${lastDateX}, ${-2}) rotate(180)`) // Position slightly above 0, point down
            .attr("fill", fillStyle.textColor);
    }

    // End-of-line labels
    let prevLabelYBase = null;
    const minLabelDistance = variables.minLabelDistance || 35; // px
    const labelGroup = mainChartGroup.append("g").attr("class", "data-labels-group");

    groups.forEach((group, groupIndex) => { // Iterate in original sorted order (lowest Y_last to highest Y_last)
        const groupData = processedChartData.filter(d => d[groupFieldName] === group)
            .sort((a, b) => d3.descending(a[xFieldName], b[xFieldName])); // Get last point by date

        if (groupData.length === 0) return;
        const lastPoint = groupData[0];
        
        const groupColor = fillStyle.getGroupColor(group, groupIndex);

        let labelXBase = xScale(lastPoint[xFieldName]) + 5; // Slight offset from line end
        let labelYBase = yScale(lastPoint[yFieldName]); // This is the y of the data point

        // Collision avoidance (pushes current label up if too close to previous)
        if (prevLabelYBase !== null && Math.abs(prevLabelYBase - labelYBase) < minLabelDistance) {
            labelYBase = prevLabelYBase - minLabelDistance;
        }
        prevLabelYBase = labelYBase;

        // Ensure labels stay within chart boundaries (top)
        labelYBase = Math.max(25, labelYBase); // Min 25px from top to fit text
        // Ensure labels stay within chart boundaries (bottom)
        labelYBase = Math.min(innerHeight - 15, labelYBase); // Min 15px from bottom

        const labelContentWidth = Math.max(
            estimateTextWidth(group, { font_family: fillStyle.typography.annotationFontFamily, font_size: fillStyle.typography.annotationFontSize }),
            estimateTextWidth(Math.round(lastPoint[yFieldName]).toString(), { font_family: fillStyle.typography.valueFontFamily, font_size: fillStyle.typography.valueFontSize, font_weight: fillStyle.typography.valueFontWeight })
        ) + 20; // Add padding

        const labelRectHeight = 40;
        const labelRectY = labelYBase - labelRectHeight / 2 - 5; // Center rect vertically around point, shift up slightly for triangle

        // Adjust X if label goes out of bounds
        if (labelXBase + labelContentWidth > innerWidth) {
            labelXBase = xScale(lastPoint[xFieldName]) - labelContentWidth - 5; // Place to the left
        }
        
        const singleLabelGroup = labelGroup.append("g").attr("class", "data-label single-label-group");

        singleLabelGroup.append("rect")
            .attr("class", "mark label-background")
            .attr("x", labelXBase)
            .attr("y", labelRectY)
            .attr("width", labelContentWidth)
            .attr("height", labelRectHeight)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", groupColor)
            .attr("opacity", 0.9);
        
        // Triangle pointing to the line end
        singleLabelGroup.append("path")
            .attr("class", "mark label-pointer")
            .attr("d", `M${labelXBase},${labelYBase} L${labelXBase-7},${labelYBase-5} L${labelXBase-7},${labelYBase+5} Z`) // Pointing left if rect is to the right
            .attr("fill", groupColor)
            .attr("opacity", 0.9)
            .attr("transform", (labelXBase < xScale(lastPoint[xFieldName])) ? `translate(${labelContentWidth + 7}, 0) scale(-1,1)`: ""); // Flip if rect is to the left

        singleLabelGroup.append("text") // Group name
            .attr("class", "text label-group-name")
            .attr("x", labelXBase + labelContentWidth / 2)
            .attr("y", labelRectY + 12) // Position within rect
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .attr("fill", fillStyle.labelTextColor)
            .text(group);

        singleLabelGroup.append("text") // Value
            .attr("class", "text label-value")
            .attr("x", labelXBase + labelContentWidth / 2)
            .attr("y", labelRectY + 30) // Position within rect
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.valueFontFamily)
            .style("font-size", fillStyle.typography.valueFontSize)
            .style("font-weight", fillStyle.typography.valueFontWeight)
            .attr("fill", fillStyle.labelTextColor)
            .text(Math.round(lastPoint[yFieldName]));
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
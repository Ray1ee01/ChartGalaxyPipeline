/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiple Stepped Line Graph",
  "chart_name": "small_multiple_step_line_graph_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || (data.colors_dark || {});
    const rawImages = data.images || {}; // Not used in this chart, but parsed per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container early

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");
    const groupColumn = dataColumns.find(col => col.role === "group");

    let missingConfigErrors = [];
    if (!xColumn) missingConfigErrors.push("x field definition (role: 'x')");
    if (!yColumn) missingConfigErrors.push("y field definition (role: 'y')");
    if (!groupColumn) missingConfigErrors.push("group field definition (role: 'group')");
    
    if (!variables.width || !variables.height) {
        missingConfigErrors.push("variables.width and variables.height");
    }


    if (missingConfigErrors.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingConfigErrors.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("font-family", "sans-serif")
                .html(errorMessage);
        }
        return null;
    }

    const xFieldName = xColumn.name;
    const yFieldName = yColumn.name;
    const groupFieldName = groupColumn.name;

    const chartDataArray = rawChartData.map(d => ({ ...d })); // Shallow copy

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#212529',
        backgroundColor: rawColors.background_color || '#FFFFFF',
        gridLineColor: (rawColors.other && rawColors.other.grid) ? rawColors.other.grid : (rawColors.text_color ? d3.color(rawColors.text_color).copy({opacity: 0.2}).toString() : '#e0e0e0'),
        axisLineColor: (rawColors.other && rawColors.other.axis) ? rawColors.other.axis : (rawColors.text_color ? d3.color(rawColors.text_color).copy({opacity: 0.4}).toString() : '#888888'),
        getGroupLineColor: (groupName, index) => {
            if (rawColors.field && rawColors.field[groupName]) {
                return rawColors.field[groupName];
            }
            const defaultCategoricalColors = d3.schemeCategory10;
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return defaultCategoricalColors[index % defaultCategoricalColors.length];
        }
    };

    function estimateTextWidth(text, fontProps) {
        const svgNamespace = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNamespace, 'svg');
        const textElement = document.createElementNS(svgNamespace, 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = fontProps.font_family || 'Arial, sans-serif';
        textElement.style.fontSize = fontProps.font_size || '12px';
        textElement.style.fontWeight = fontProps.font_weight || 'normal';
        tempSvg.appendChild(textElement);
        // Appending to the body and removing is more reliable for getBBox,
        // but strictly adhering to "MUST NOT be appended to the document DOM".
        try {
            return textElement.getBBox().width;
        } catch (e) {
            const fontSize = parseFloat(fontProps.font_size) || 12;
            return text.length * (fontSize * 0.6); // Fallback rough estimate
        }
    }
    
    const parseDateInternal = d => {
        if (d instanceof Date) return d;
        if (typeof d === 'number') return new Date(d, 0, 1); // Assume year if number
        if (typeof d === 'string') {
            const parts = d.split(/[-/]/); // Allow more delimiters
            if (parts.length === 3) { // YYYY-MM-DD or MM-DD-YYYY etc. D3's timeParse is better for this.
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            if (parts.length === 2) { // YYYY-MM
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            }
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) { // YYYY
                return new Date(parseInt(parts[0]), 0, 1);
            }
        }
        // Fallback or try d3.isoParse for more robust parsing
        const parsed = d3.isoParse(d);
        if (parsed) return parsed;
        return new Date(); // Fallback, might indicate bad data
    };

    const xAxisScaleAndTicksGenerator = (dateValues, xFieldNameForHelper, rangeStart = 0, rangeEnd = 100, padding = 0.05) => {
        const dates = dateValues.map(d => parseDateInternal(d[xFieldNameForHelper]));
        if (dates.some(d => isNaN(d.getTime()))) {
            console.error("Invalid dates found in data for x-axis.");
            // Provide a fallback scale to prevent crashing, though chart may be meaningless
            const fallbackScale = d3.scaleTime().domain([new Date(2000,0,1), new Date(2001,0,1)]).range([rangeStart, rangeEnd]);
            return {
                xScale: fallbackScale,
                xTicks: fallbackScale.ticks(5),
                xAxisTickFormat: d3.timeFormat("%Y"),
                timeSpan: { days: 365, months: 12, years: 1 }
            };
        }

        const xExtent = d3.extent(dates);
        if (!xExtent[0] || !xExtent[1]) { // Handle empty or single-point date arrays
             const fallbackDate = new Date();
             const fallbackScale = d3.scaleTime().domain([fallbackDate, d3.timeDay.offset(fallbackDate, 1)]).range([rangeStart, rangeEnd]);
             return {
                xScale: fallbackScale,
                xTicks: fallbackScale.ticks(2),
                xAxisTickFormat: d3.timeFormat("%Y-%m-%d"),
                timeSpan: { days: 1, months: 0, years: 0 }
            };
        }

        const xRangeMs = xExtent[1].getTime() - xExtent[0].getTime();
        const xPaddingMs = xRangeMs * padding;
        
        const xScale = d3.scaleTime()
            .domain([
                new Date(xExtent[0].getTime() - xPaddingMs),
                new Date(xExtent[1].getTime() + xPaddingMs)
            ])
            .range([rangeStart, rangeEnd]);
        
        const timeSpanMs = xExtent[1].getTime() - xExtent[0].getTime();
        const daySpan = timeSpanMs / (1000 * 60 * 60 * 24);
        const monthSpan = daySpan / 30.44; // Average days per month
        const yearSpan = daySpan / 365.25; // Average days per year
        
        let timeInterval;
        let formatFunction;
        
        if (yearSpan > 35) { timeInterval = d3.timeYear.every(10); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 15) { timeInterval = d3.timeYear.every(5); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 7) { timeInterval = d3.timeYear.every(2); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 2) { timeInterval = d3.timeYear.every(1); formatFunction = d3.timeFormat("%Y"); }
        else if (yearSpan > 1 || monthSpan > 9) { // Adjusted for ~1 year to quarterly
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => `${d3.timeFormat("'%y")(d)}Q${Math.floor(d.getMonth() / 3) + 1}`;
        } else if (monthSpan > 2) { timeInterval = d3.timeMonth.every(1); formatFunction = d3.timeFormat("%b %Y"); }
        else if (daySpan > 21) { // ~3 weeks to 2 months
             timeInterval = d3.timeWeek.every(1); formatFunction = d3.timeFormat("%d %b");
        } else {
            const dayTickInterval = Math.max(1, Math.ceil(daySpan / 7)); // Max 7 ticks for days
            timeInterval = d3.timeDay.every(dayTickInterval);
            formatFunction = d3.timeFormat("%d %b");
        }
        
        const xTicks = xScale.ticks(timeInterval);
        
        if (xTicks.length > 1 && xExtent[1] > xTicks[xTicks.length - 1]) {
            const lastTickX = xScale(xTicks[xTicks.length - 1]);
            const lastDataX = xScale(xExtent[1]);
            const minPixelDistance = estimateTextWidth(formatFunction(xExtent[1]), { font_size: fillStyle.typography.labelFontSize }) * 1.5;
            
            if (Math.abs(lastDataX - lastTickX) >= minPixelDistance) {
                xTicks.push(xExtent[1]);
            } else {
                 if (xScale(xExtent[1]) > xScale(xTicks[xTicks.length - 1])) { // Only replace if new date is later
                    xTicks[xTicks.length - 1] = xExtent[1];
                 }
            }
        } else if (xTicks.length === 0 && xExtent[0] && xExtent[1]) { // Ensure at least two ticks for a valid range
            xTicks.push(xExtent[0], xExtent[1]);
        } else if (xTicks.length === 1 && xExtent[0] && xExtent[1] && xExtent[0].getTime() !== xExtent[1].getTime()) {
            // If only one tick generated for a range, add start/end
            xTicks.splice(0, 1, xExtent[0], xExtent[1]);
        }


        return { xScale, xTicks, xAxisTickFormat: formatFunction, timeSpan: { days: daySpan, months: monthSpan, years: yearSpan } };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width);
    const containerHeight = parseFloat(variables.height);

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root"); // Added class

    const defs = svgRoot.append("defs"); // For potential future use (e.g. clipPaths)

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Overall margins for the small multiples grid
    
    const uniqueGroupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    const numGroups = uniqueGroupNames.length;

    const layoutCols = Math.min(numGroups, 2); // Max 2 columns
    const layoutRows = Math.ceil(numGroups / layoutCols);
    
    const subplotAllocatedWidth = (containerWidth - chartMargins.left - chartMargins.right) / layoutCols;
    const subplotAllocatedHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / layoutRows;
    
    const subplotInternalMargins = { top: 60, right: 30, bottom: 40, left: 50 }; // Margins within each subplot
    // Adjust right margin if only one column to give more space
    if (layoutCols === 1) subplotInternalMargins.right = 50;


    const subplotInnerWidth = subplotAllocatedWidth - subplotInternalMargins.left - subplotInternalMargins.right;
    const subplotInnerHeight = subplotAllocatedHeight - subplotInternalMargins.top - subplotInternalMargins.bottom;

    if (subplotInnerWidth <= 0 || subplotInnerHeight <= 0) {
        const errorMsg = "Calculated subplot dimensions are too small. Increase container size or reduce margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Dates are parsed on-the-fly by the xScale helper or line generator.
    // Ensure data is sorted by date for each group for correct line drawing
    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);
    groupedData.forEach(groupArr => {
        groupArr.sort((a, b) => parseDateInternal(a[xFieldName]) - parseDateInternal(b[xFieldName]));
    });


    // Block 6: Scale Definition & Configuration
    // Global X-scale (shared time domain across subplots)
    const { xScale, xTicks, xAxisTickFormat } = xAxisScaleAndTicksGenerator(
        chartDataArray, // Pass all data for global time extent
        xFieldName,
        0,
        subplotInnerWidth
    );
    // Y-scales are defined per subplot in Block 7.

    // Block 7: Chart Component Rendering (Axes, Gridlines, Subplot Titles)
    uniqueGroupNames.forEach((groupName, groupIndex) => {
        const currentGroupData = groupedData.get(groupName) || [];
        
        const currentSubplotCol = groupIndex % layoutCols;
        const currentSubplotRow = Math.floor(groupIndex / layoutCols);
        
        const currentSubplotX = chartMargins.left + currentSubplotCol * subplotAllocatedWidth;
        const currentSubplotY = chartMargins.top + currentSubplotRow * subplotAllocatedHeight;
        
        const subplotContainerGroup = svgRoot.append("g")
            .attr("class", "other subplot-container")
            .attr("transform", `translate(${currentSubplotX}, ${currentSubplotY})`);
            
        const subplotDrawingGroup = subplotContainerGroup.append("g")
            .attr("class", "other subplot-drawing-area")
            .attr("transform", `translate(${subplotInternalMargins.left}, ${subplotInternalMargins.top})`);

        // Subplot Title
        subplotContainerGroup.append("text")
            .attr("class", "label subplot-title")
            .attr("x", subplotInternalMargins.left) // Position relative to subplot container's drawing area start
            .attr("y", subplotInternalMargins.top / 2 + 5) // Vertically centered in top margin
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(groupName));

        // Y-Scale for this subplot
        const yMin = d3.min(currentGroupData, d => d[yFieldName]);
        const yMax = d3.max(currentGroupData, d => d[yFieldName]);
        
        const groupYMin = Math.min(0, (yMin || 0) * (yMin < 0 ? 1.1 : 0.9) ); // Add padding, ensure 0 is included
        const groupYMax = (yMax || 0) * 1.1; // Add padding

        const yScale = d3.scaleLinear()
            .domain([groupYMin, Math.max(groupYMax, groupYMin + 0.1)]) // Ensure domain has a range
            .range([subplotInnerHeight, 0])
            .nice(); // Adjust domain to round numbers

        // Y-Axis Gridlines & Ticks
        const yAxisTicks = yScale.ticks(4);
        yAxisTicks.forEach(tick => {
            subplotDrawingGroup.append("line")
                .attr("class", "gridline y-gridline")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);

            const yAxisLabelXPos = currentSubplotCol === layoutCols - 1 && layoutCols > 1 ? subplotInnerWidth + 6 : -6;
            const yAxisLabelAnchor = currentSubplotCol === layoutCols - 1 && layoutCols > 1 ? "start" : "end";
            
            subplotDrawingGroup.append("text")
                .attr("class", "value y-axis-label")
                .attr("x", yAxisLabelXPos)
                .attr("y", yScale(tick))
                .attr("text-anchor", yAxisLabelAnchor)
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(tick);
        });

        // X-Axis Gridlines & Ticks (using global xTicks)
        xTicks.forEach(tick => {
            subplotDrawingGroup.append("line")
                .attr("class", "gridline x-gridline")
                .attr("x1", xScale(tick))
                .attr("y1", 0)
                .attr("x2", xScale(tick))
                .attr("y2", subplotInnerHeight)
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);

            subplotDrawingGroup.append("text")
                .attr("class", "label x-axis-label")
                .attr("x", xScale(tick))
                .attr("y", subplotInnerHeight + 20) // Below plot area
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(xAxisTickFormat(tick));
        });
        
        // Y-Axis Line (at data edge)
        const yAxisLineXPos = currentSubplotCol === layoutCols - 1 && layoutCols > 1 ? subplotInnerWidth : 0;
        subplotDrawingGroup.append("line")
            .attr("class", "axis y-axis-line")
            .attr("x1", yAxisLineXPos)
            .attr("y1", 0)
            .attr("x2", yAxisLineXPos)
            .attr("y2", subplotInnerHeight)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        // X-Axis Line (at y=0, if visible)
        if (yScale.domain()[0] <= 0 && yScale.domain()[1] >=0) {
            subplotDrawingGroup.append("line")
                .attr("class", "axis x-axis-line")
                .attr("x1", 0)
                .attr("y1", yScale(0))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(0))
                .attr("stroke", fillStyle.axisLineColor)
                .attr("stroke-width", 1);
        }


        // Block 8: Main Data Visualization Rendering (Step Line)
        if (currentGroupData.length > 0) {
            const stepLineGenerator = d3.line()
                .x(d => xScale(parseDateInternal(d[xFieldName])))
                .y(d => yScale(d[yFieldName]))
                .curve(d3.curveStepAfter);

            subplotDrawingGroup.append("path")
                .datum(currentGroupData)
                .attr("class", "mark step-line")
                .attr("fill", "none")
                .attr("stroke", fillStyle.getGroupLineColor(String(groupName), groupIndex))
                .attr("stroke-width", 2.5)
                .attr("d", stepLineGenerator);

            // Block 9: Optional Enhancements & Post-Processing (Final Value Label)
            if (currentGroupData.length >= 1) { // Need at least 1 point for label, 2 for trend
                const lastPoint = currentGroupData[currentGroupData.length - 1];
                const secondLastPoint = currentGroupData.length >= 2 ? currentGroupData[currentGroupData.length - 2] : lastPoint;
                
                const isGoingDown = lastPoint[yFieldName] < secondLastPoint[yFieldName];
                const labelVerticalOffset = isGoingDown ? 15 : -8; // Adjusted offset
                
                // Adjust X offset if label is near the Y-axis on the right edge
                let labelHorizontalOffset = 0;
                if (currentSubplotCol === layoutCols - 1 && layoutCols > 1) {
                     // Estimate text width to avoid collision with Y axis labels
                     const textWidth = estimateTextWidth(String(lastPoint[yFieldName].toFixed(1)), { font_family: fillStyle.typography.annotationFontFamily, font_size: fillStyle.typography.annotationFontSize });
                     if (xScale(parseDateInternal(lastPoint[xFieldName])) + textWidth / 2 > subplotInnerWidth - 10) { // 10px buffer from edge
                        labelHorizontalOffset = - (textWidth / 2) - 5; // Shift left
                     }
                }


                subplotDrawingGroup.append("text")
                    .attr("class", "value data-label-final")
                    .attr("x", xScale(parseDateInternal(lastPoint[xFieldName])) + labelHorizontalOffset)
                    .attr("y", yScale(lastPoint[yFieldName]) + labelVerticalOffset)
                    .attr("text-anchor", labelHorizontalOffset === 0 ? "middle" : (labelHorizontalOffset < 0 ? "end" : "start"))
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(lastPoint[yFieldName].toFixed(1));
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
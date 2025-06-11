/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiple Step Line Graph",
  "chart_name": "small_multiple_step_line_graph_icons_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 30], ["-inf", "inf"], [2, 6]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
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
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const missingFields = [];
    if (!xFieldConfig) missingFields.push("x role");
    if (!yFieldConfig) missingFields.push("y role");
    if (!groupFieldConfig) missingFields.push("group role");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')} in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#333333',
        gridLineColor: colorsConfig.other && colorsConfig.other.grid_line ? colorsConfig.other.grid_line : '#e0e0e0',
        axisLineColor: colorsConfig.other && colorsConfig.other.axis_line ? colorsConfig.other.axis_line : '#999999',
        iconBorderColor: colorsConfig.other && colorsConfig.other.icon_border ? colorsConfig.other.icon_border : '#000000',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Default to white if not specified
        getLineColor: (groupValue) => {
            if (colorsConfig.field && colorsConfig.field[groupValue]) {
                return colorsConfig.field[groupValue];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
                const groupIndex = uniqueGroups.indexOf(groupValue);
                return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[0]; // Fallback default
        },
        typography: {
            titleFontFamily: typographyConfig.title && typographyConfig.title.font_family ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: typographyConfig.title && typographyConfig.title.font_size ? typographyConfig.title.font_size : '16px',
            titleFontWeight: typographyConfig.title && typographyConfig.title.font_weight ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: typographyConfig.label && typographyConfig.label.font_family ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: typographyConfig.label && typographyConfig.label.font_size ? typographyConfig.label.font_size : '12px',
            labelFontWeight: typographyConfig.label && typographyConfig.label.font_weight ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: typographyConfig.annotation && typographyConfig.annotation.font_family ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation && typographyConfig.annotation.font_size ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: typographyConfig.annotation && typographyConfig.annotation.font_weight ? typographyConfig.annotation.font_weight : 'normal',
        }
    };

    const parseDate = (dateValue) => {
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'number') return new Date(dateValue, 0, 1); // Assume year if number
        if (typeof dateValue === 'string') {
            const parts = dateValue.split(/[-/]/); // Allow / or -
            if (parts.length === 3) { // YYYY-MM-DD or MM-DD-YYYY etc. D3 will try to parse common formats
                return d3.timeParse("%Y-%m-%d")(dateValue) || d3.timeParse("%m/%d/%Y")(dateValue) || new Date(dateValue);
            }
            if (parts.length === 2) { // YYYY-MM
                return d3.timeParse("%Y-%m")(dateValue) || new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            }
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) { // YYYY
                return d3.timeParse("%Y")(dateValue) || new Date(parseInt(parts[0]), 0, 1);
            }
        }
        return new Date(dateValue); // Fallback to Date constructor
    };
    
    // In-memory text measurement utility (not actively used for layout in this chart, but required)
    const estimateTextWidth = (text, fontProps) => {
        const defaultFont = "12px Arial, sans-serif";
        const font = fontProps ? `${fontProps.font_weight || 'normal'} ${fontProps.font_size || '12px'} ${fontProps.font_family || 'Arial, sans-serif'}` : defaultFont;
        try {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textEl.setAttribute('style', `font: ${font};`);
            textEl.textContent = text;
            svg.appendChild(textEl);
            // Note: Appending to body and then removing is more reliable for getBBox,
            // but for estimation without DOM manipulation, this is a common approach.
            // For more accuracy, a temporary live SVG element is better.
            // However, the prompt specified NOT to append to DOM.
            // This might return 0 if not in DOM, depending on browser.
            // A more robust in-memory way might involve Canvas's measureText.
            // For simplicity and adherence to SVG-only context:
            if (typeof textEl.getBBox === 'function') {
                 return textEl.getBBox().width;
            }
            // Fallback for environments where getBBox on non-rendered element is problematic
            return text.length * (parseInt(fontProps.font_size || '12px', 10) * 0.6);
        } catch (e) {
            console.warn("estimateTextWidth failed:", e);
            return text.length * 7; // Rough fallback
        }
    };


    const createXAxisScaleAndTicksHelper = (allDates, rangeStart, rangeEnd, padding = 0.05) => {
        const xExtent = d3.extent(allDates);
        if (!xExtent[0] || !xExtent[1]) { // Handle empty or single-point date arrays
             const now = new Date();
             xExtent[0] = xExtent[0] || d3.timeYear.offset(now, -1);
             xExtent[1] = xExtent[1] || now;
        }
        
        const xRangeMs = xExtent[1].getTime() - xExtent[0].getTime();
        const xPaddingMs = xRangeMs * padding;
        
        const xScaleDomain = [
            new Date(xExtent[0].getTime() - xPaddingMs),
            new Date(xExtent[1].getTime() + xPaddingMs)
        ];

        const xScale = d3.scaleTime().domain(xScaleDomain).range([rangeStart, rangeEnd]);
        
        const timeSpanMs = xScaleDomain[1].getTime() - xScaleDomain[0].getTime();
        const daySpan = timeSpanMs / (1000 * 60 * 60 * 24);
        const monthSpan = daySpan / 30;
        const yearSpan = daySpan / 365;
        
        let timeInterval;
        let formatFunction;
        
        if (yearSpan > 35) {
            timeInterval = d3.timeYear.every(10); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 15) {
            timeInterval = d3.timeYear.every(5); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 7) {
            timeInterval = d3.timeYear.every(2); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 2) {
            timeInterval = d3.timeYear.every(1); formatFunction = d3.timeFormat("%Y");
        } else if (yearSpan > 1 || monthSpan > 9) { // Adjusted for clarity with Q format
            timeInterval = d3.timeMonth.every(3);
            formatFunction = d => {
                const m = d.getMonth();
                const q = Math.floor(m / 3) + 1;
                return `${d3.timeFormat("%y")(d)}Q${q}`;
            };
        } else if (monthSpan > 2) {
            timeInterval = d3.timeMonth.every(1); formatFunction = d3.timeFormat("%b %y");
        } else if (daySpan > 30) { // ~1 month to 2 months
             timeInterval = d3.timeWeek.every(1); formatFunction = d3.timeFormat("%d %b");
        } else {
            const dayTickInterval = Math.max(1, Math.ceil(daySpan / 7)); // Aim for about 7 ticks
            timeInterval = d3.timeDay.every(dayTickInterval);
            formatFunction = d3.timeFormat("%d %b");
        }
        
        let xTicks = xScale.ticks(timeInterval);
        
        // Ensure last data point is considered for ticks if space allows
        if (xTicks.length > 0 && xExtent[1] > xTicks[xTicks.length - 1]) {
            const lastTickScreen = xScale(xTicks[xTicks.length - 1]);
            const lastDataScreen = xScale(xExtent[1]);
            const minPixelDist = 40; // Min pixel distance for a new tick
            if (Math.abs(lastDataScreen - lastTickScreen) >= minPixelDist) {
                xTicks.push(xExtent[1]);
            } else if (xTicks.length > 1) { // Replace last tick if too close and not the only tick
                xTicks[xTicks.length - 1] = xExtent[1];
            } else if (xTicks.length === 1 && Math.abs(lastDataScreen - lastTickScreen) < minPixelDist/2) {
                 xTicks[0] = xExtent[1]; // If only one tick and very close, replace it
            }
        }
        if (xTicks.length === 0 && xExtent[0] && xExtent[1]) { // Ensure at least start and end if no ticks generated
            xTicks = [xExtent[0], xExtent[1]];
        }


        return { xScale, xTicks, xFormat: formatFunction };
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(chartConfig.width) || 800;
    const containerHeight = parseFloat(chartConfig.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Overall margins for the SVG

    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    const numGroups = groups.length;
    if (numGroups === 0) {
        svgRoot.append("text").attr("x", containerWidth/2).attr("y", containerHeight/2).attr("text-anchor", "middle").text("No data for groups.").attr("class", "label");
        return svgRoot.node();
    }

    const numCols = Math.min(numGroups, chartConfig.num_columns || 2); // Default to 2 columns
    const numRows = Math.ceil(numGroups / numCols);

    const subplotTotalWidth = (containerWidth - chartMargins.left - chartMargins.right) / numCols;
    const subplotTotalHeight = (containerHeight - chartMargins.top - chartMargins.bottom) / numRows;

    const subplotContentMargin = { top: 60, right: 20, bottom: 50, left: 50 }; // Margins within each subplot for content
    // Adjust left/right margins for Y-axis labels based on column position
    const subplotDynamicMargin = (colIndex) => ({
        ...subplotContentMargin,
        left: colIndex === 0 ? subplotContentMargin.left : 20, // Larger left margin for first column
        right: colIndex === numCols - 1 ? subplotContentMargin.right + 30 : 20, // Larger right margin for last column y-axis labels
    });


    // Block 5: Data Preprocessing & Transformation
    chartDataArray.forEach(d => {
        d.parsedDate = parseDate(d[xFieldName]);
        d[yFieldName] = parseFloat(d[yFieldName]); // Ensure Y is numeric
    });
    
    // Sort data by date for line generator
    chartDataArray.sort((a, b) => a.parsedDate - b.parsedDate);

    const allParsedDates = chartDataArray.map(d => d.parsedDate).filter(d => d instanceof Date && !isNaN(d));
    if (allParsedDates.length === 0) {
         svgRoot.append("text").attr("x", containerWidth/2).attr("y", containerHeight/2).attr("text-anchor", "middle").text("No valid date data.").attr("class", "label");
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    // Global X-scale logic will be applied per subplot, but using a consistent helper
    // Y-scales are per-subplot

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)

    groups.forEach((groupValue, i) => {
        const rowIndex = Math.floor(i / numCols);
        const colIndex = i % numCols;

        const currentSubplotMargin = subplotDynamicMargin(colIndex);
        const subplotInnerWidth = subplotTotalWidth - currentSubplotMargin.left - currentSubplotMargin.right;
        const subplotInnerHeight = subplotTotalHeight - currentSubplotMargin.top - currentSubplotMargin.bottom;

        const subplotXOffset = chartMargins.left + colIndex * subplotTotalWidth;
        const subplotYOffset = chartMargins.top + rowIndex * subplotTotalHeight;

        const subplotContainer = svgRoot.append("g")
            .attr("class", "subplot-container other")
            .attr("transform", `translate(${subplotXOffset}, ${subplotYOffset})`);

        const mainChartGroup = subplotContainer.append("g")
            .attr("class", "main-chart-group other")
            .attr("transform", `translate(${currentSubplotMargin.left}, ${currentSubplotMargin.top})`);

        const groupData = chartDataArray.filter(d => d[groupFieldName] === groupValue);
        if (groupData.length === 0) return; // Skip if no data for this group

        // Per-subplot X-Scale (using global date range but local width)
        const { xScale, xTicks, xFormat } = createXAxisScaleAndTicksHelper(allParsedDates, 0, subplotInnerWidth);

        // Per-subplot Y-Scale
        const yDataValues = groupData.map(d => d[yFieldName]).filter(v => !isNaN(v));
        let yMin = d3.min(yDataValues);
        let yMax = d3.max(yDataValues);

        if (yMin === undefined || yMax === undefined) { // Handle no valid y data for group
            yMin = 0; yMax = 1;
        } else {
            const yRange = yMax - yMin;
            yMin = Math.min(0, yMin - yRange * 0.1); // Ensure 0 is in view if data is positive, add padding
            yMax = yMax + yRange * 0.1;
            if (yMin === yMax) { // Handle single y-value case
                yMin -= 1;
                yMax += 1;
            }
        }
        
        const yScale = d3.scaleLinear()
            .domain([yMin, yMax])
            .range([subplotInnerHeight, 0])
            .nice();

        // Render Gridlines
        const yAxisTicks = yScale.ticks(4); // Suggest 4 ticks for Y
        yAxisTicks.forEach(tick => {
            mainChartGroup.append("line")
                .attr("class", "gridline y-gridline")
                .attr("x1", 0)
                .attr("y1", yScale(tick))
                .attr("x2", subplotInnerWidth)
                .attr("y2", yScale(tick))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);
        });

        xTicks.forEach(tick => {
            mainChartGroup.append("line")
                .attr("class", "gridline x-gridline")
                .attr("x1", xScale(tick))
                .attr("y1", 0)
                .attr("x2", xScale(tick))
                .attr("y2", subplotInnerHeight)
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);
        });

        // Render Axes lines
        // X-axis line (at y=0 if in domain, else at bottom)
        const xAxisLineYPos = (yScale.domain()[0] <= 0 && yScale.domain()[1] >=0) ? yScale(0) : subplotInnerHeight;
        mainChartGroup.append("line")
            .attr("class", "axis x-axis-line")
            .attr("x1", 0)
            .attr("y1", xAxisLineYPos)
            .attr("x2", subplotInnerWidth)
            .attr("y2", xAxisLineYPos)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        // Y-axis line (left or right based on column)
        const yAxisLineXPos = colIndex === numCols - 1 && numCols > 1 ? subplotInnerWidth : 0;
         mainChartGroup.append("line")
            .attr("class", "axis y-axis-line")
            .attr("x1", yAxisLineXPos)
            .attr("y1", 0)
            .attr("x2", yAxisLineXPos)
            .attr("y2", subplotInnerHeight)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);


        // Render Subplot Title (Group Name) & Icon
        const titleXBase = (imagesConfig.field && imagesConfig.field[groupValue]) ? 40 : 0;
        subplotContainer.append("text")
            .attr("class", "label subplot-title")
            .attr("x", currentSubplotMargin.left + titleXBase)
            .attr("y", currentSubplotMargin.top / 2 + 5) // Vertically center in top margin
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(String(groupValue));

        if (imagesConfig.field && imagesConfig.field[groupValue]) {
            const iconSize = 36;
            const iconPadding = 2;
            const maskId = `mask-subplot-icon-${i}`;
            
            defs.append("mask")
                .attr("id", maskId)
              .append("circle")
                .attr("cx", iconSize / 2)
                .attr("cy", iconSize / 2)
                .attr("r", (iconSize / 2) - (iconPadding/2)) // slightly smaller radius for mask
                .attr("fill", "white");

            const iconGroup = subplotContainer.append("g")
                .attr("class", "icon-group")
                .attr("transform", `translate(${currentSubplotMargin.left}, ${currentSubplotMargin.top / 2 - iconSize / 2})`);
            
            iconGroup.append("circle")
                .attr("class", "image icon-border")
                .attr("cx", iconSize / 2)
                .attr("cy", iconSize / 2)
                .attr("r", iconSize / 2)
                .attr("fill", "none")
                .attr("stroke", fillStyle.iconBorderColor)
                .attr("stroke-width", 1);

            iconGroup.append("image")
                .attr("class", "image icon-image")
                .attr("x", iconPadding)
                .attr("y", iconPadding)
                .attr("width", iconSize - 2 * iconPadding)
                .attr("height", iconSize - 2 * iconPadding)
                .attr("mask", `url(#${maskId})`)
                .attr("xlink:href", imagesConfig.field[groupValue]);
        }

        // Render Y-axis Ticks and Labels
        yAxisTicks.forEach(tick => {
            const isRightSideLabel = colIndex === numCols - 1 && numCols > 1;
            const labelXPos = isRightSideLabel ? subplotInnerWidth + 8 : -8;
            const textAnchor = isRightSideLabel ? "start" : "end";

            mainChartGroup.append("text")
                .attr("class", "value y-axis-label")
                .attr("x", labelXPos)
                .attr("y", yScale(tick))
                .attr("text-anchor", textAnchor)
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(tick.toLocaleString());
        });

        // Render X-axis Ticks and Labels
        xTicks.forEach(tick => {
            mainChartGroup.append("text")
                .attr("class", "label x-axis-label")
                .attr("x", xScale(tick))
                .attr("y", subplotInnerHeight + 20) // Position below axis line
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(xFormat(tick));
        });

        // Render Step Line
        const lineGenerator = d3.line()
            .x(d => xScale(d.parsedDate))
            .y(d => yScale(d[yFieldName]))
            .curve(d3.curveStepAfter)
            .defined(d => d.parsedDate instanceof Date && !isNaN(d.parsedDate) && typeof d[yFieldName] === 'number' && !isNaN(d[yFieldName]));


        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "mark step-line")
            .attr("fill", "none")
            .attr("stroke", fillStyle.getLineColor(groupValue))
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator);

        // Render Final Value Label
        if (groupData.length > 1) { // Need at least two points to determine trend
            const lastPoint = groupData[groupData.length - 1];
            const secondLastPoint = groupData[groupData.length - 2];

            if (lastPoint.parsedDate instanceof Date && !isNaN(lastPoint.parsedDate) && typeof lastPoint[yFieldName] === 'number' && !isNaN(lastPoint[yFieldName]) &&
                secondLastPoint.parsedDate instanceof Date && !isNaN(secondLastPoint.parsedDate) && typeof secondLastPoint[yFieldName] === 'number' && !isNaN(secondLastPoint[yFieldName])) {

                const isGoingDown = lastPoint[yFieldName] < secondLastPoint[yFieldName];
                const labelYOffset = isGoingDown ? 18 : -8; // Adjusted offset
                let labelX = xScale(lastPoint.parsedDate);
                
                // Adjust labelX to prevent overflow if it's the rightmost subplot
                const estimatedLabelWidth = estimateTextWidth(lastPoint[yFieldName].toFixed(1), fillStyle.typography);
                if (labelX + estimatedLabelWidth / 2 > subplotInnerWidth) {
                    labelX = subplotInnerWidth - estimatedLabelWidth / 2 - 5; // Pull back a bit
                }
                if (labelX - estimatedLabelWidth / 2 < 0) {
                    labelX = estimatedLabelWidth / 2 + 5; // Push forward a bit
                }


                mainChartGroup.append("text")
                    .attr("class", "value data-label-final")
                    .attr("x", labelX)
                    .attr("y", yScale(lastPoint[yFieldName]) + labelYOffset)
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily) // Using annotation for data labels
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
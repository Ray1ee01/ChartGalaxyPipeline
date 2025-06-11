/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[4, 12], [0, "inf"], [3, 10]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || (data.colors_dark || {});
    const imagesConfig = data.images || {}; // Not used in this chart, but parsed for consistency
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = dataColumns.find(col => col.role === 'x');
    const yFieldConfig = dataColumns.find(col => col.role === 'y');
    const groupFieldConfig = dataColumns.find(col => col.role === 'group');

    let errors = [];
    if (!xFieldConfig) errors.push("x field configuration");
    if (!yFieldConfig) errors.push("y field configuration");
    if (!groupFieldConfig) errors.push("group field configuration");

    if (errors.length > 0) {
        console.error(`Critical chart config missing: ${errors.join(', ')}. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: Critical chart configuration missing: ${errors.join(', ')}.</div>`);
        return null;
    }

    const xFieldName = xFieldConfig.name;
    const yFieldName = yFieldConfig.name;
    const groupFieldName = groupFieldConfig.name;

    if (rawChartData.length === 0) {
        console.warn("No data provided to chart.");
        d3.select(containerSelector).html("<div style='color:orange; font-family: sans-serif;'>Warning: No data provided.</div>");
        // return null; // Or render an empty chart structure
    }
    
    // Filter out data points with undefined/null critical fields
    const chartData = rawChartData.filter(d => 
        d[xFieldName] !== undefined && d[xFieldName] !== null &&
        d[yFieldName] !== undefined && d[yFieldName] !== null &&
        d[groupFieldName] !== undefined && d[groupFieldName] !== null
    );


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFont: {
                font_family: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
                font_size: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
                font_weight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            },
            labelFont: {
                font_family: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
                font_size: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
                font_weight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            },
            annotationFont: {
                font_family: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
                font_size: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
                font_weight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
            }
        },
        textColor: colorsConfig.text_color || '#0f223b',
        backgroundColor: colorsConfig.background_color || '#FFFFFF',
        defaultLineStrokeWidth: 3,
        defaultSquareStrokeColor: '#FFFFFF',
        defaultSquareStrokeWidth: 2,
        labelMinSpacing: 15, // For x-axis label filtering
    };

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getColor = (groupValue, index) => {
        if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupValue]) {
            return colorsConfig.field[groupFieldName][groupValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        if (colorsConfig.other && colorsConfig.other.primary) {
            return colorsConfig.other.primary;
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };
    
    // Helper to convert strings to CSS-safe class names
    const makeClassSafe = (str) => str.toString().replace(/[^a-zA-Z0-9_]/g, '_');

    // Helper for text color contrast
    const getLuminance = (colorStr) => {
        const color = d3.color(colorStr);
        if (!color) return 0; // Fallback for invalid color string
        const rgb = color.rgb();
        return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    };

    // Helper to parse date strings
    function parseDate(dateString) {
        if (dateString instanceof Date) return dateString;
        if (typeof dateString !== 'string' && typeof dateString !== 'number') return null;

        const s = String(dateString);
        let parsed;

        // Try common date formats
        const formats = [
            d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"), // ISO with milliseconds and Z
            d3.timeParse("%Y-%m-%dT%H:%M:%SZ"),   // ISO with Z
            d3.timeParse("%Y-%m-%d %H:%M:%S"),
            d3.timeParse("%Y-%m-%d"),
            d3.timeParse("%Y/%m/%d"),
            d3.timeParse("%m/%d/%Y"),
            d3.timeParse("%b %Y"),    // e.g., Jan 2023
            d3.timeParse("%B %Y"),   // e.g., January 2023
            d3.timeParse("%Y")       // e.g., 2023 (parses as Jan 1st)
        ];

        for (let fmt of formats) {
            parsed = fmt(s);
            if (parsed) return parsed;
        }
        
        // Try direct Date constructor (less reliable but a fallback)
        parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return parsed;

        console.warn(`Failed to parse date: "${dateString}"`);
        return null;
    }
    
    // In-memory text measurement utility (not strictly needed if using temporary DOM elements for measurement)
    // function estimateTextWidth(text, fontStyle) {
    //     const canvas = document.createElement("canvas");
    //     const context = canvas.getContext("2d");
    //     context.font = `${fontStyle.font_weight || 'normal'} ${fontStyle.font_size || '12px'} ${fontStyle.font_family || 'sans-serif'}`;
    //     return context.measureText(text).width;
    // }
    // Using SVG-based measurement as per original's approach with temp elements.

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
    const chartMargins = { top: 60, right: 180, bottom: 60, left: 100 }; // Adjusted left for potentially wider rank + group labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const uniqueGroupValues = [...new Set(chartData.map(d => d[groupFieldName]))].sort();
    
    const parsedXValues = [...new Set(chartData.map(d => parseDate(d[xFieldName])))]
        .filter(d => d !== null)
        .sort((a, b) => a - b);

    if (parsedXValues.length === 0 && chartData.length > 0) {
        console.error("Failed to parse any x-values. Cannot render chart.");
        d3.select(containerSelector).html("<div style='color:red; font-family: sans-serif;'>Error: No valid x-values found after parsing.</div>");
        return null;
    }
    if (parsedXValues.length === 0 && chartData.length === 0) {
         // Already handled by empty chartData warning, or render empty state
    }


    const rankData = {};
    parsedXValues.forEach(xDate => {
        const itemsAtX = chartData
            .filter(d => {
                const pDate = parseDate(d[xFieldName]);
                return pDate && pDate.getTime() === xDate.getTime();
            })
            .sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher yValue = better rank

        itemsAtX.forEach((d, i) => {
            const group = d[groupFieldName];
            if (!rankData[group]) rankData[group] = [];
            rankData[group].push({
                x: xDate,
                rank: i + 1, // Rank starts at 1
                value: +d[yFieldName],
                originalX: d[xFieldName] // Keep original x for display if needed
            });
        });
    });
    
    const allYValues = chartData.map(d => +d[yFieldName]).filter(v => !isNaN(v));
    const yMin = allYValues.length > 0 ? Math.min(...allYValues) : 0;
    const yMax = allYValues.length > 0 ? Math.max(...allYValues) : 1;


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scalePoint()
        .domain(parsedXValues)
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, uniqueGroupValues.length)]) // Ranks from 1 to number of groups
        .range([0, innerHeight]);

    const sizeScale = d3.scaleLinear()
        .domain([yMin, yMax === yMin ? yMin + 1 : yMax]) // Avoid division by zero if all values are same
        .range([10, Math.min(60, innerHeight / (Math.max(1, uniqueGroupValues.length) * 1.5) )]); // Square size range, ensure not too large

    const timeFormatForAxis = d3.timeFormat("%Y-%m-%d"); // Example, can be made more dynamic

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    
    // Y-axis rank labels and group names (acting as a custom y-axis/legend)
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis-labels");

    // Calculate max width for group names for alignment
    let maxGroupNameWidth = 0;
    const tempTextMeasure = svgRoot.append("text") // Use svgRoot for measurement before mainChartGroup might be fully laid out
        .style("font-family", fillStyle.typography.titleFont.font_family)
        .style("font-size", fillStyle.typography.titleFont.font_size)
        .style("font-weight", fillStyle.typography.titleFont.font_weight)
        .attr("opacity", 0); // Hidden

    uniqueGroupValues.forEach(group => {
        if (rankData[group] && rankData[group].length > 0) {
            tempTextMeasure.text(group);
            const w = tempTextMeasure.node().getBBox().width;
            if (w > maxGroupNameWidth) maxGroupNameWidth = w;
        }
    });
    tempTextMeasure.remove();

    const rankLabelWidth = 30; // Space for rank number
    const groupNamePadding = 5;
    const triangleMarkerWidth = 10;
    const triangleMarkerPadding = 5;

    // Positions from left edge of mainChartGroup (which is already translated by margin.left)
    const rankLabelX = -rankLabelWidth - groupNamePadding - maxGroupNameWidth - triangleMarkerPadding - triangleMarkerWidth;
    const groupNameX = rankLabelX + rankLabelWidth + groupNamePadding;
    const triangleX = groupNameX + maxGroupNameWidth + triangleMarkerPadding;


    uniqueGroupValues.forEach((group, i) => {
        if (rankData[group] && rankData[group].length > 0) {
            const firstDataPointForGroup = rankData[group][0]; // Use first point for initial Y position
            const yPos = yScale(firstDataPointForGroup.rank);
            const groupColor = fillStyle.getColor(group, i);

            // Rank number
            yAxisGroup.append("text")
                .attr("class", "label rank-label")
                .attr("x", rankLabelX + rankLabelWidth) // Text-anchor end
                .attr("y", yPos)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.titleFont.font_family)
                .style("font-size", fillStyle.typography.titleFont.font_size) 
                .style("font-weight", fillStyle.typography.titleFont.font_weight)
                .style("fill", fillStyle.textColor)
                .attr("text-anchor", "end")
                .text(i + 1); // Display 1-based index as rank context

            // Group name
            yAxisGroup.append("text")
                .attr("class", "label group-name-label")
                .attr("x", groupNameX)
                .attr("y", yPos)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.titleFont.font_family)
                .style("font-size", fillStyle.typography.titleFont.font_size)
                .style("font-weight", fillStyle.typography.titleFont.font_weight)
                .style("fill", groupColor)
                .attr("text-anchor", "start")
                .text(group);
            
            // Triangle marker
            yAxisGroup.append("path")
                .attr("class", "mark group-marker-triangle")
                .attr("d", "M0,-5 L10,0 L0,5 Z") // Pointing right
                .attr("transform", `translate(${triangleX},${yPos})`)
                .style("fill", groupColor);
        }
    });

    // X-axis time labels (at the top)
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis-labels")
        .attr("transform", `translate(0, ${-chartMargins.top / 2})`); // Position above chart

    let xTickValues = parsedXValues;
    if (parsedXValues.length > 2) { // Only filter if more than 2 ticks
        const tempTimeLabelMeasure = svgRoot.append("text")
            .style("font-family", fillStyle.typography.labelFont.font_family)
            .style("font-size", fillStyle.typography.labelFont.font_size)
            .style("font-weight", fillStyle.typography.labelFont.font_weight)
            .attr("opacity", 0);

        const labelWidths = xTickValues.map(d => {
            tempTimeLabelMeasure.text(timeFormatForAxis(d));
            return tempTimeLabelMeasure.node().getBBox().width;
        });
        tempTimeLabelMeasure.remove();

        const tickPositions = xTickValues.map((date, idx) => ({
            date: date,
            center: xScale(date),
            width: labelWidths[idx],
            show: true
        }));

        for (let i = 0; i < tickPositions.length - 1; i++) {
            if (tickPositions[i].show) {
                for (let j = i + 1; j < tickPositions.length; j++) {
                    if (tickPositions[j].show) {
                        const overlap = (tickPositions[i].center + tickPositions[i].width / 2 + fillStyle.labelMinSpacing) > (tickPositions[j].center - tickPositions[j].width / 2);
                        if (overlap) {
                           // A simple strategy: if an overlap, remove the one that is not an endpoint.
                           // If both are not endpoints, remove the later one (j).
                           // This is simpler than original's complex skip logic but aims for similar outcome.
                           if (j < tickPositions.length -1) { // if j is not the last, it can be hidden
                               tickPositions[j].show = false;
                           } else if (i > 0) { // if i is not the first, it can be hidden
                               tickPositions[i].show = false;
                           }
                           // If i=0 and j=last and they overlap, this simple logic might hide one.
                           // More robust: prioritize endpoints.
                        }
                    }
                }
            }
        }
        // Ensure first and last are shown if possible (if they exist)
        if(tickPositions.length > 0) tickPositions[0].show = true;
        if(tickPositions.length > 1) tickPositions[tickPositions.length-1].show = true;

        xTickValues = tickPositions.filter(p => p.show).map(p => p.date);
    }
    
    xAxisLabelsGroup.selectAll(".time-label")
        .data(xTickValues)
        .enter()
        .append("text")
        .attr("class", "label time-label")
        .attr("x", d => xScale(d))
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFont.font_family)
        .style("font-size", fillStyle.typography.labelFont.font_size)
        .style("font-weight", fillStyle.typography.labelFont.font_weight)
        .style("fill", fillStyle.textColor)
        .attr("text-anchor", "middle")
        .text(d => timeFormatForAxis(d));

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    uniqueGroupValues.forEach((group, i) => {
        const groupData = rankData[group];
        if (!groupData || groupData.length === 0) return;

        const groupColor = fillStyle.getColor(group, i);
        const safeGroupNameClass = makeClassSafe(group);

        // Draw lines
        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", `mark line series-${safeGroupNameClass}`)
            .style("fill", "none")
            .style("stroke", groupColor)
            .style("stroke-width", fillStyle.defaultLineStrokeWidth)
            .attr("d", d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.rank))
            );

        // Draw squares (nodes)
        mainChartGroup.selectAll(`.mark.square.series-${safeGroupNameClass}`)
            .data(groupData)
            .enter()
            .append("rect")
            .attr("class", d => `mark square series-${safeGroupNameClass} x-${makeClassSafe(d.originalX)}`)
            .attr("x", d => xScale(d.x) - sizeScale(d.value) / 2)
            .attr("y", d => yScale(d.rank) - sizeScale(d.value) / 2)
            .attr("width", d => Math.max(0, sizeScale(d.value))) // Ensure non-negative width/height
            .attr("height", d => Math.max(0, sizeScale(d.value)))
            .style("fill", groupColor)
            .style("stroke", fillStyle.defaultSquareStrokeColor)
            .style("stroke-width", fillStyle.defaultSquareStrokeWidth);

        // Draw value labels on/near squares
        mainChartGroup.selectAll(`.label.value-label.series-${safeGroupNameClass}`)
            .data(groupData)
            .enter()
            .append("text")
            .attr("class", d => `label value-label series-${safeGroupNameClass} x-${makeClassSafe(d.originalX)}`)
            .attr("x", d => xScale(d.x))
            .attr("y", d => {
                const squareSize = sizeScale(d.value);
                // If square is too small for text inside, place text above
                return squareSize < (parseFloat(fillStyle.typography.annotationFont.font_size) * 1.5) ? 
                       (yScale(d.rank) - squareSize / 2 - 5) : 
                       yScale(d.rank);
            })
            .attr("dy", d => {
                 const squareSize = sizeScale(d.value);
                 return squareSize < (parseFloat(fillStyle.typography.annotationFont.font_size) * 1.5) ? "0em" : "0.35em";
            })
            .style("font-family", fillStyle.typography.annotationFont.font_family)
            .style("font-size", fillStyle.typography.annotationFont.font_size)
            .style("font-weight", fillStyle.typography.annotationFont.font_weight)
            .style("fill", d => {
                const squareSize = sizeScale(d.value);
                if (squareSize < (parseFloat(fillStyle.typography.annotationFont.font_size) * 1.5)) {
                    return fillStyle.textColor; // Text outside, use default text color
                }
                return getLuminance(groupColor) > 0.5 ? '#000000' : '#FFFFFF'; // Contrast color for text inside
            })
            .attr("text-anchor", "middle")
            .text(d => Math.round(d.value));
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - not in this chart's scope based on original)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
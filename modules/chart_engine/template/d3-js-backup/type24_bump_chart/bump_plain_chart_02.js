/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_plain_chart_02",
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
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme, or use a theme variable
    const rawImages = data.images || {}; // Not used in this chart but parsed per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : null;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push(`role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: Field names for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Filter out data points with missing critical fields
    const chartData = rawChartData.filter(d => 
        d[xFieldName] !== undefined && d[xFieldName] !== null &&
        d[yFieldName] !== undefined && d[yFieldName] !== null &&
        d[groupFieldName] !== undefined && d[groupFieldName] !== null
    );
    
    if (chartData.length === 0) {
        const errorMsg = "No valid data points found after filtering for essential fields. Cannot render.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        seriesColors: {}, // To store resolved group colors
    };

    // Typography tokens
    fillStyle.typography.titleFontFamily = rawTypography.title && rawTypography.title.font_family ? rawTypography.title.font_family : 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = rawTypography.title && rawTypography.title.font_size ? rawTypography.title.font_size : '16px';
    fillStyle.typography.titleFontWeight = rawTypography.title && rawTypography.title.font_weight ? rawTypography.title.font_weight : 'bold';

    fillStyle.typography.labelFontFamily = rawTypography.label && rawTypography.label.font_family ? rawTypography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = rawTypography.label && rawTypography.label.font_size ? rawTypography.label.font_size : '12px';
    fillStyle.typography.labelFontWeight = rawTypography.label && rawTypography.label.font_weight ? rawTypography.label.font_weight : 'normal';
    
    // Annotation font style (not explicitly used but defined per spec)
    fillStyle.typography.annotationFontFamily = rawTypography.annotation && rawTypography.annotation.font_family ? rawTypography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = rawTypography.annotation && rawTypography.annotation.font_size ? rawTypography.annotation.font_size : '10px';
    fillStyle.typography.annotationFontWeight = rawTypography.annotation && rawTypography.annotation.font_weight ? rawTypography.annotation.font_weight : 'normal';

    // Color tokens
    fillStyle.textColor = rawColors.text_color || '#0f223b';
    fillStyle.chartBackground = rawColors.background_color || '#FFFFFF'; // Default to white if not specified
    fillStyle.markerStrokeColor = '#FFFFFF'; // For rect marker stroke

    const groups = [...new Set(chartData.map(d => d[groupFieldName]))].sort();
    const defaultCategoricalColor = d3.scaleOrdinal(d3.schemeCategory10);

    groups.forEach((group, i) => {
        if (rawColors.field && rawColors.field[group]) {
            fillStyle.seriesColors[group] = rawColors.field[group];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            fillStyle.seriesColors[group] = rawColors.available_colors[i % rawColors.available_colors.length];
        } else {
            fillStyle.seriesColors[group] = defaultCategoricalColor(group);
        }
    });

    const getSeriesColor = (group) => fillStyle.seriesColors[group] || '#888888';

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        // SVG must be in DOM for getBBox to work reliably with all font stylings in some browsers.
        // However, the spec says "MUST NOT be appended". We rely on getBBox on unattached element.
        // This works in modern browsers if attributes are set directly.
        // For complex CSS, it might be less accurate.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(textElement);
        // No need to append svg to body per spec.
        return textElement.getBBox().width;
    }
    
    // Helper: Convert string to CSS-safe class name
    const makeClassSafe = (str) => str.toString().replace(/[^a-zA-Z0-9_]/g, '_');

    // Helper: Calculate color luminance
    const getLuminance = (color) => {
        const rgb = d3.color(color).rgb();
        return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    };

    // Helper: Parse date strings (assuming standard formats parseable by new Date())
    const parseDate = (dateStr) => new Date(dateStr);

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground) // Apply background color
        .attr("class", "chart-svg-root");


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 30, left: 180 }; // Adjusted right margin, left margin for labels
    // Dynamic left margin calculation based on longest group label + rank + triangle
    let maxLeftLabelWidth = 0;
    if (groups.length > 0) {
        const tempRankText = "10."; // Estimate for rank text like "1." or "10."
        const rankWidth = estimateTextWidth(tempRankText, fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
        const triangleWidth = 10;
        const padding = 15; // Total padding around elements

        maxLeftLabelWidth = Math.max(...groups.map(group => {
            return estimateTextWidth(group, fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
        }));
        maxLeftLabelWidth += rankWidth + triangleWidth + padding * 3; // rank + group + triangle + paddings
        chartMargins.left = Math.max(chartMargins.left, maxLeftLabelWidth + 20); // Ensure enough space, +20 for buffer from edge
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const xValuesRaw = [...new Set(chartData.map(d => d[xFieldName]))];
    const xValuesParsed = xValuesRaw.map(parseDate).sort((a, b) => a - b);

    const rankData = {};
    xValuesParsed.forEach(dateObj => {
        const xValStr = dateObj.toISOString(); // Or a consistent string representation matching input
        // Find original string value for filtering, as direct date object comparison can be tricky
        const originalXValue = xValuesRaw.find(val => parseDate(val).getTime() === dateObj.getTime());

        const itemsAtX = chartData.filter(d => d[xFieldName] === originalXValue);
        itemsAtX.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher yField = better rank

        itemsAtX.forEach((d, i) => {
            const group = d[groupFieldName];
            if (!rankData[group]) rankData[group] = [];
            rankData[group].push({
                x: dateObj, // Use parsed Date object
                rank: i + 1,
                value: d[yFieldName]
            });
        });
    });
    
    groups.forEach(group => {
        if (rankData[group]) {
            rankData[group].sort((a,b) => a.x - b.x); // Ensure data per group is sorted by time
        }
    });


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(xValuesParsed))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, groups.length)]) // Rank 1 at top
        .range([0, innerHeight]);

    const yValues = chartData.map(d => d[yFieldName]);
    const yMin = d3.min(yValues) || 0;
    const yMax = d3.max(yValues) || 1;
    const markerSizeScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([10, 30]); // Adjusted marker size range for clarity [original was 10-60]

    // Block 7: Chart Component Rendering (Axes, Legend-like labels)
    // Top X-axis Time Labels
    const timeLabelFormat = d3.timeFormat("%b %d, '%y"); // Example: Jan 01, '23
    
    // Use all unique xValuesParsed as ticks initially
    let xTicksToDisplay = [...xValuesParsed]; 
    
    // Filter overlapping labels (adapted from original logic)
    const filterOverlappingXLabels = (ticks, scale, minSpacing) => {
        if (ticks.length <= 1) return ticks;

        const tickInfo = ticks.map(tick => {
            const text = timeLabelFormat(tick);
            const width = estimateTextWidth(text, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const pos = scale(tick);
            return { tick, text, width, pos, left: pos - width / 2, right: pos + width / 2, show: true };
        });

        for (let i = 0; i < tickInfo.length - 1; i++) {
            if (tickInfo[i].show) {
                for (let j = i + 1; j < tickInfo.length; j++) {
                    if (tickInfo[j].show && tickInfo[i].right + minSpacing > tickInfo[j].left) {
                        // Overlap: try to hide j, or if j is last, hide i (prefer endpoints)
                        if (j === tickInfo.length -1 && i > 0) {
                             tickInfo[i].show = false;
                        } else {
                             tickInfo[j].show = false;
                        }
                    }
                }
            }
        }
        // Ensure first and last are shown if possible (if they don't overlap each other)
        if (tickInfo.length > 1) {
            tickInfo[0].show = true;
            tickInfo[tickInfo.length - 1].show = true;
            if (tickInfo[0].right + minSpacing > tickInfo[tickInfo.length - 1].left && tickInfo.length > 2) {
                // If first and last overlap, and there are other ticks, one might need to be hidden
                // This simple filter might hide too many; a more complex one might be needed for dense ticks
            }
        } else if (tickInfo.length === 1) {
            tickInfo[0].show = true;
        }
        
        return tickInfo.filter(info => info.show).map(info => info.tick);
    };

    if (xValuesParsed.length > 2) { // Only filter if more than 2 ticks
         xTicksToDisplay = filterOverlappingXLabels(xValuesParsed, xScale, 10);
    }


    mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .selectAll(".x-axis-label")
        .data(xTicksToDisplay)
        .enter()
        .append("text")
        .attr("class", "label axis-label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", -chartMargins.top / 2) // Position above chart
        .attr("text-anchor", "middle")
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => timeLabelFormat(d));

    // Left Y-axis Group and Rank Labels
    const yAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .attr("transform", `translate(${-chartMargins.left + 10}, 0)`); // Position at the very left edge of SVG

    groups.forEach((group, i) => {
        const groupData = rankData[group];
        if (groupData && groupData.length > 0) {
            const firstDataPoint = groupData[0]; // Label based on initial rank

            const labelYPos = yScale(firstDataPoint.rank);
            const safeGroupClass = makeClassSafe(group);
            
            const seriesColor = getSeriesColor(group);

            // Rank Number
            yAxisLabelsGroup.append("text")
                .attr("class", `label rank-label series-${safeGroupClass}`)
                .attr("x", 0) // Relative to yAxisLabelsGroup
                .attr("y", labelYPos)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .attr("font-family", fillStyle.typography.titleFontFamily) // Using title for prominence
                .attr("font-size", fillStyle.typography.titleFontSize)
                .attr("font-weight", fillStyle.typography.titleFontWeight)
                .attr("fill", fillStyle.textColor)
                .text(firstDataPoint.rank);
            
            const rankTextWidth = estimateTextWidth(String(firstDataPoint.rank), fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
            const groupLabelXStart = rankTextWidth + 15; // Space after rank

            // Group Name
            yAxisLabelsGroup.append("text")
                .attr("class", `label group-label series-${safeGroupClass}`)
                .attr("x", groupLabelXStart) // Position after rank
                .attr("y", labelYPos)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .attr("font-family", fillStyle.typography.titleFontFamily)
                .attr("font-size", fillStyle.typography.titleFontSize)
                .attr("font-weight", fillStyle.typography.titleFontWeight)
                .attr("fill", seriesColor)
                .text(group);

            const groupTextWidth = estimateTextWidth(group, fillStyle.typography.titleFontFamily, fillStyle.typography.titleFontSize, fillStyle.typography.titleFontWeight);
            const triangleX = groupLabelXStart + groupTextWidth + 10; // Space after group name

            // Triangle Marker
            yAxisLabelsGroup.append("path")
                .attr("class", `mark group-marker series-${safeGroupClass}`)
                .attr("d", "M0,-5 L8,0 L0,5 Z") // Smaller triangle
                .attr("transform", `translate(${triangleX}, ${labelYPos})`)
                .attr("fill", seriesColor);
        }
    });

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.rank));

    groups.forEach(group => {
        const groupData = rankData[group];
        if (groupData && groupData.length > 0) {
            const safeGroupClass = makeClassSafe(group);
            const seriesColor = getSeriesColor(group);

            // Draw Line
            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", `mark line series-${safeGroupClass}`)
                .attr("fill", "none")
                .attr("stroke", seriesColor)
                .attr("stroke-width", 3)
                .attr("d", lineGenerator);

            // Draw Markers (Rects)
            mainChartGroup.selectAll(`.data-point.series-${safeGroupClass}`)
                .data(groupData)
                .enter()
                .append("rect")
                .attr("class", `mark data-point series-${safeGroupClass}`)
                .attr("x", d => xScale(d.x) - markerSizeScale(d.value) / 2)
                .attr("y", d => yScale(d.rank) - markerSizeScale(d.value) / 2)
                .attr("width", d => markerSizeScale(d.value))
                .attr("height", d => markerSizeScale(d.value))
                .attr("fill", seriesColor)
                .attr("stroke", fillStyle.markerStrokeColor)
                .attr("stroke-width", 2);

            // Draw Value Labels on Markers
            mainChartGroup.selectAll(`.value-label.series-${safeGroupClass}`)
                .data(groupData)
                .enter()
                .append("text")
                .attr("class", `label value-label series-${safeGroupClass}`)
                .attr("x", d => xScale(d.x))
                .attr("y", d => {
                    const size = markerSizeScale(d.value);
                    // If marker is small, place label above it
                    return size < 20 ? (yScale(d.rank) - size / 2 - 5) : yScale(d.rank);
                })
                .attr("text-anchor", "middle")
                .attr("dy", d => {
                    const size = markerSizeScale(d.value);
                    return size < 20 ? "0" : "0.35em"; // Adjust dy for inside/outside
                })
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("font-size", fillStyle.typography.labelFontSize)
                .attr("font-weight", "bold") // Value labels often bold
                .attr("fill", d => {
                    const size = markerSizeScale(d.value);
                    if (size < 20) {
                        return fillStyle.textColor; // Label outside, use general text color
                    } else {
                        // Label inside, choose contrasting color
                        return getLuminance(seriesColor) > 0.5 ? '#000000' : '#FFFFFF';
                    }
                })
                .text(d => Math.round(d.value));
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this simplified version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
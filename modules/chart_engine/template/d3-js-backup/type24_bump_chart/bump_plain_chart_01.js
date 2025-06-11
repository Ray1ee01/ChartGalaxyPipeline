/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_05",
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
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
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
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || (data.colors_dark || {});
    const configImages = data.images || {}; // Not used in this chart, but extracted per spec
    const configDataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldConfig = configDataColumns.find(col => col.role === "x");
    const yFieldConfig = configDataColumns.find(col => col.role === "y");
    const groupFieldConfig = configDataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x field" : null,
            !yFieldName ? "y field" : null,
            !groupFieldName ? "group field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields} role definition in dataColumns]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            axisLabelFontFamily: (configTypography.label && configTypography.label.font_family) ? configTypography.label.font_family : 'Arial, sans-serif',
            axisLabelFontSize: (configTypography.label && configTypography.label.font_size) ? configTypography.label.font_size : '14px',
            axisLabelFontWeight: (configTypography.label && configTypography.label.font_weight) ? configTypography.label.font_weight : 'normal',
            
            valueLabelFontFamily: (configTypography.label && configTypography.label.font_family) ? configTypography.label.font_family : 'Arial, sans-serif',
            valueLabelFontSize: (configTypography.label && configTypography.label.font_size) ? configTypography.label.font_size : '12px',
            valueLabelFontWeight: (configTypography.label && configTypography.label.font_weight) ? configTypography.label.font_weight : 'bold',

            groupLabelFontFamily: (configTypography.title && configTypography.title.font_family) ? configTypography.title.font_family : 'Arial, sans-serif', // Using title for larger group labels
            groupLabelFontSize: (configTypography.title && configTypography.title.font_size) ? configTypography.title.font_size : '18px',
            groupLabelFontWeight: (configTypography.title && configTypography.title.font_weight) ? configTypography.title.font_weight : 'bold',
        },
        textColor: configColors.text_color || '#0f223b',
        axisColor: configColors.text_color || '#555555',
        defaultGroupColors: configColors.available_colors || d3.schemeCategory10,
        getGroupColor: function(groupName, index) {
            if (configColors.field && configColors.field[groupFieldName] && configColors.field[groupFieldName][groupName]) {
                return configColors.field[groupFieldName][groupName];
            }
            if (configColors.other && configColors.other.primary && index === 0) { // Fallback for first item if primary exists
                 // return configColors.other.primary; // This might make all groups same color if not careful
            }
            return this.defaultGroupColors[index % this.defaultGroupColors.length];
        },
        lineStrokeWidth: 3,
        circleStrokeColor: configColors.background_color || '#FFFFFF',
        circleStrokeWidth: 2,
        chartBackground: configColors.background_color || '#FFFFFF',
    };

    // Helper: In-memory text measurement
    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontProps.fontFamily || 'Arial, sans-serif');
        textEl.setAttribute('font-size', fontProps.fontSize || '12px');
        textEl.setAttribute('font-weight', fontProps.fontWeight || 'normal');
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Document.body.appendChild(svg); // Temporarily append to get styles, then remove
        const width = textEl.getBBox().width;
        // Document.body.removeChild(svg);
        return width;
    };
    
    // Helper: Date parsing (assuming common ISO-like format or Date objects)
    const parseDate = (dateString) => {
        if (dateString instanceof Date) return dateString;
        // Attempt to parse common formats. For robustness, specify expected format or use a library.
        const formats = [
            d3.timeParse("%Y-%m-%dT%H:%M:%S.%LZ"),
            d3.timeParse("%Y-%m-%dT%H:%M:%S%Z"),
            d3.timeParse("%Y-%m-%d %H:%M:%S"),
            d3.timeParse("%Y-%m-%d"),
            d3.timeParse("%m/%d/%Y"),
            d3.timeParse("%Y/%m/%d")
        ];
        for (let format of formats) {
            const parsed = format(dateString);
            if (parsed) return parsed;
        }
        // Fallback for simple date strings that JS Date.parse might handle
        const timestamp = Date.parse(dateString);
        if (!isNaN(timestamp)) return new Date(timestamp);
        console.warn(`Could not parse date: ${dateString}`);
        return null; 
    };

    // Helper: Get color luminance
    const getLuminance = (color) => {
        const rgb = d3.color(color).rgb();
        return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Estimate max group label width for left margin
    const tempGroupsForWidth = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    let maxLeftLabelWidth = 0;
    if (tempGroupsForWidth.length > 0) {
         maxLeftLabelWidth = d3.max(tempGroupsForWidth, g => estimateTextWidth(g, {
            fontFamily: fillStyle.typography.groupLabelFontFamily,
            fontSize: fillStyle.typography.groupLabelFontSize,
            fontWeight: fillStyle.typography.groupLabelFontWeight
        })) || 100;
    }
    maxLeftLabelWidth += 40; // Add space for rank number and triangle indicator

    const chartMargins = {
        top: configVariables.margin_top || 60,
        right: configVariables.margin_right || 50, // Reduced right margin as labels are not on the right end of lines
        bottom: configVariables.margin_bottom || 40,
        left: configVariables.margin_left || Math.max(80, maxLeftLabelWidth) // Dynamic left margin
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataArray.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName]
    })).filter(d => d[xFieldName] !== null);


    const groups = [...new Set(processedChartData.map(d => d[groupFieldName]))].sort((a,b) => a.localeCompare(b)); // Sort groups for consistent color assignment
    const xValuesRaw = [...new Set(processedChartData.map(d => d[xFieldName].getTime()))].map(t => new Date(t));
    xValuesRaw.sort((a, b) => a - b); // Sort unique dates

    const fixedGroupPositions = {};
    groups.forEach((group, i) => {
        fixedGroupPositions[group] = i + 1;
    });

    const rankData = {};
    groups.forEach(group => { rankData[group] = []; });

    xValuesRaw.forEach(xDate => {
        const itemsAtX = processedChartData.filter(d => d[xFieldName].getTime() === xDate.getTime());
        itemsAtX.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher Y value = better rank

        const rankByGroupAtX = {};
        itemsAtX.forEach((d, i) => {
            rankByGroupAtX[d[groupFieldName]] = i + 1; // Rank from 1
        });

        groups.forEach(group => {
            const dataItem = itemsAtX.find(d => d[groupFieldName] === group);
            if (dataItem) {
                rankData[group].push({
                    x: xDate,
                    rank: rankByGroupAtX[group],
                    value: dataItem[yFieldName],
                    missing: false
                });
            } else {
                let nearestRank = null;
                const groupHistoricalData = rankData[group];
                if (groupHistoricalData && groupHistoricalData.length > 0) {
                    const lastValidPoint = [...groupHistoricalData].reverse().find(p => !p.missing);
                    if (lastValidPoint) {
                        nearestRank = lastValidPoint.rank;
                    }
                }
                if (nearestRank === null) {
                    nearestRank = fixedGroupPositions[group];
                }
                rankData[group].push({
                    x: xDate,
                    rank: nearestRank,
                    value: null,
                    missing: true
                });
            }
        });
    });

    groups.forEach(group => {
        rankData[group].sort((a, b) => a.x - b.x);
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(xValuesRaw))
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([1, Math.max(1, groups.length)]) // Domain from rank 1 to max number of groups
        .range([0, innerHeight]);

    const yValuesForRadius = processedChartData.map(d => d[yFieldName]).filter(d => d !== null && d !== undefined && !isNaN(d));
    const yMinRadius = yValuesForRadius.length > 0 ? d3.min(yValuesForRadius) : 0;
    const yMaxRadius = yValuesForRadius.length > 0 ? d3.max(yValuesForRadius) : 1; // Avoid 0 domain if only one value
    
    const radiusScale = d3.scaleLinear()
        .domain([yMinRadius, yMaxRadius])
        .range([configVariables.min_circle_radius || 5, configVariables.max_circle_radius || 20]);


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // X-Axis Time Labels (Top)
    const xTicks = xScale.ticks(configVariables.x_axis_ticks || (innerWidth / 100)); // Auto ticks or configurable
    const xTickFormat = d3.timeFormat(configVariables.x_axis_tick_format || "%b %d"); // e.g., "Jan 01"

    // Simplified tick optimization: filter out ticks that are too close
    const minTickSpacing = 70; // Minimum pixels between ticks
    let lastTickX = -Infinity;
    const optimizedXTicks = xTicks.filter(tick => {
        const tickX = xScale(tick);
        const labelWidth = estimateTextWidth(xTickFormat(tick), {
            fontFamily: fillStyle.typography.axisLabelFontFamily,
            fontSize: fillStyle.typography.axisLabelFontSize
        });
        if (tickX - lastTickX > minTickSpacing && tickX + labelWidth / 2 < innerWidth && tickX - labelWidth / 2 > 0) {
            lastTickX = tickX;
            return true;
        }
        return false;
    });
     if (optimizedXTicks.length < 2 && xTicks.length >=2) { // Ensure at least first and last if possible
        optimizedXTicks.length = 0;
        optimizedXTicks.push(xTicks[0]);
        if (xTicks.length > 1) optimizedXTicks.push(xTicks[xTicks.length-1]);
    }


    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis");
    optimizedXTicks.forEach(tick => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(tick))
            .attr("y", -chartMargins.top / 2) // Position above the chart
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize)
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.axisColor)
            .text(xTickFormat(tick));
    });

    // Y-Axis Group Labels, Rank Numbers, and Indicators (Left)
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis");
    const groupLabelX = - (chartMargins.left - 25); // Position for group text name
    const rankLabelX = groupLabelX - (estimateTextWidth("MM", {fontSize: fillStyle.typography.axisLabelFontSize}) + 10); // Position for rank number
    const indicatorX = - (chartMargins.left - 10); // Position for triangle indicator

    groups.forEach((group, i) => {
        const groupYPos = yScale(fixedGroupPositions[group]);
        const groupColor = fillStyle.getGroupColor(group, i);

        // Rank Number
        yAxisLabelsGroup.append("text")
            .attr("class", "label y-axis-label rank-label")
            .attr("x", rankLabelX)
            .attr("y", groupYPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.axisLabelFontFamily)
            .style("font-size", fillStyle.typography.axisLabelFontSize) // Smaller than group name
            .style("font-weight", fillStyle.typography.axisLabelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(i + 1);

        // Group Name
        yAxisLabelsGroup.append("text")
            .attr("class", "label y-axis-label group-label")
            .attr("x", groupLabelX)
            .attr("y", groupYPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.groupLabelFontFamily)
            .style("font-size", fillStyle.typography.groupLabelFontSize)
            .style("font-weight", fillStyle.typography.groupLabelFontWeight)
            .style("fill", groupColor)
            .text(group);
        
        // Triangle Indicator
        yAxisLabelsGroup.append("path")
            .attr("class", "mark indicator")
            .attr("d", "M0,-5 L8,0 L0,5 Z") // Triangle pointing right
            .attr("transform", `translate(${indicatorX}, ${groupYPos})`)
            .style("fill", groupColor);
    });


    // Block 8: Main Data Visualization Rendering
    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");
    const pointsGroup = mainChartGroup.append("g").attr("class", "points-group");
    const valueLabelsGroup = mainChartGroup.append("g").attr("class", "value-labels-group");

    groups.forEach((group, i) => {
        const groupData = rankData[group];
        const groupColor = fillStyle.getGroupColor(group, i);
        const safeGroupId = `group-${group.replace(/[^a-zA-Z0-9-_]/g, '_')}-${i}`;


        // Lines
        const lineGenerator = d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.rank))
            .defined(d => !d.missing);

        linesGroup.append("path")
            .datum(groupData)
            .attr("class", `mark line ${safeGroupId}`)
            .attr("fill", "none")
            .attr("stroke", groupColor)
            .attr("stroke-width", fillStyle.lineStrokeWidth)
            .attr("d", lineGenerator);

        // Circles (Points)
        pointsGroup.selectAll(`.mark.point.${safeGroupId}`)
            .data(groupData.filter(d => !d.missing))
            .enter()
            .append("circle")
            .attr("class", `mark point ${safeGroupId}`)
            .attr("cx", d => xScale(d.x))
            .attr("cy", d => yScale(d.rank))
            .attr("r", d => radiusScale(d.value))
            .style("fill", groupColor)
            .style("stroke", fillStyle.circleStrokeColor)
            .style("stroke-width", fillStyle.circleStrokeWidth);

        // Value Labels on/near Circles
        valueLabelsGroup.selectAll(`.label.value-label.${safeGroupId}`)
            .data(groupData.filter(d => !d.missing && d.value !== null))
            .enter()
            .append("text")
            .attr("class", `label value-label ${safeGroupId}`)
            .attr("x", d => xScale(d.x))
            .attr("y", d => {
                const radius = radiusScale(d.value);
                return radius < 10 ? yScale(d.rank) - radius - 5 : yScale(d.rank); // Above small circles
            })
            .attr("text-anchor", "middle")
            .attr("dy", d => {
                const radius = radiusScale(d.value);
                return radius < 10 ? "0" : "0.35em"; // Centered in large circles
            })
            .style("font-family", fillStyle.typography.valueLabelFontFamily)
            .style("font-size", fillStyle.typography.valueLabelFontSize)
            .style("font-weight", fillStyle.typography.valueLabelFontWeight)
            .style("fill", d => {
                const radius = radiusScale(d.value);
                if (radius < 10) {
                    return fillStyle.textColor; // Outside small circles
                } else {
                    return getLuminance(groupColor) > 0.5 ? '#000000' : '#FFFFFF'; // Contrast inside large circles
                }
            })
            .text(d => Math.round(d.value));
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No further enhancements specified for this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
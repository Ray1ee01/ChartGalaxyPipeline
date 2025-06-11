/* REQUIREMENTS_BEGIN
{
  "chart_type": "Bump Chart",
  "chart_name": "bump_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [
    [2, 12],
    [0, "inf"],
    [3, 10]
  ],
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
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const D3 = typeof d3 === 'undefined' ? null : d3; // Capture D3 if globally available.
    // For dark theme, use colors_dark, otherwise colors.
    // The metadata specifies "background": "dark", so colors_dark is prioritized.
    const inputColors = data.colors_dark || data.colors || {};
    const images = data.images || {}; // Not used in this chart but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const column = dataColumns.find(col => col.role === role);
        return column ? column.name : undefined;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    const criticalFields = { xFieldName, yFieldName, groupFieldName };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For image URLs if used
    };

    // Typography tokens
    const defaultFontFamily = 'Arial, sans-serif';
    const typographyTitle = typography.title || {};
    const typographyLabel = typography.label || {};
    const typographyAnnotation = typography.annotation || {};

    fillStyle.typography.axisTickText = {
        fontFamily: typographyLabel.font_family || defaultFontFamily,
        fontSize: typographyLabel.font_size || '14px',
        fontWeight: typographyLabel.font_weight || 'normal',
    };
    fillStyle.typography.groupLabelText = {
        fontFamily: typographyTitle.font_family || defaultFontFamily, // Group labels are prominent
        fontSize: typographyTitle.font_size || '16px', // Adjusted from original 18px to align with title token
        fontWeight: typographyTitle.font_weight || 'bold',
    };
    fillStyle.typography.valueLabelText = {
        fontFamily: typographyAnnotation.font_family || defaultFontFamily,
        fontSize: typographyAnnotation.font_size || '12px',
        fontWeight: typographyAnnotation.font_weight || 'normal',
    };

    // Color tokens
    fillStyle.backgroundColor = inputColors.background_color || '#1E1E1E'; // Dark default
    fillStyle.textColor = inputColors.text_color || '#FFFFFF'; // Light text for dark background
    fillStyle.lineStrokeWidth = 3;
    fillStyle.dotRadius = 5;
    fillStyle.dotBorderColor = fillStyle.backgroundColor; // Contrast with line/dot color
    fillStyle.dotStrokeWidth = 2;

    const defaultPrimaryColor = '#888888';
    const groupColorMap = new Map();
    const uniqueGroupsForColor = [...new Set(rawChartData.map(d => d[groupFieldName]))];

    uniqueGroupsForColor.forEach((group, i) => {
        let color;
        if (inputColors.field && inputColors.field[group]) {
            color = inputColors.field[group];
        } else if (inputColors.available_colors && inputColors.available_colors.length > 0) {
            color = inputColors.available_colors[i % inputColors.available_colors.length];
        } else if (inputColors.other && inputColors.other.primary) {
            color = inputColors.other.primary;
        } else {
            color = D3 && D3.schemeCategory10 ? D3.schemeCategory10[i % D3.schemeCategory10.length] : defaultPrimaryColor;
        }
        groupColorMap.set(group, color);
    });

    fillStyle.getGroupColor = (group) => groupColorMap.get(group) || defaultPrimaryColor;

    // Helper: In-memory text measurement (not actively used by this chart for layout, but included for compliance)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        if (!D3) return text.length * parseFloat(fontSize) * 0.6; // Very rough fallback if D3 not present for SVG
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Not appending to DOM
        const width = tempText.getBBox().width;
        return width;
    }

    // Helper: Date parsing
    const parseDate = d3.isoParse; // Assumes xField values are ISO 8601 date strings

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 180, bottom: 40, left: 100 }; // Adjusted margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartData = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]), // Parse dates early
        [yFieldName]: +d[yFieldName] // Ensure y is numeric
    }));

    const xValuesParsed = [...new Set(chartData.map(d => d[xFieldName]))].sort((a, b) => a - b);
    const groupNames = [...new Set(chartData.map(d => d[groupFieldName]))];

    const rankData = {};
    groupNames.forEach(g => rankData[g] = []);

    xValuesParsed.forEach(xVal => {
        const itemsAtX = chartData.filter(d => d[xFieldName].getTime() === xVal.getTime());
        itemsAtX.sort((a, b) => b[yFieldName] - a[yFieldName]); // Higher Y value = better rank

        itemsAtX.forEach((d, i) => {
            const group = d[groupFieldName];
            rankData[group].push({
                x: xVal,
                rank: i + 1, // Rank starts at 1
                value: d[yFieldName]
            });
        });
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scalePoint()
        .domain(xValuesParsed)
        .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
        .domain([1, groupNames.length > 0 ? groupNames.length : 1]) // Domain from 1 to number of groups
        .range([0, innerHeight]);

    const xAxisTickFormat = d3.timeFormat("%b %e"); // e.g., "Jan 5"

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)

    // Top X-axis time labels
    let xTickValues = xValuesParsed;
    if (xValuesParsed.length > Math.floor(innerWidth / 80)) { // Heuristic: one label per 80px
        const step = Math.ceil(xValuesParsed.length / Math.floor(innerWidth / 80));
        xTickValues = xValuesParsed.filter((_, i) => i % step === 0);
    }
    
    const xAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis x-axis-labels");
    xAxisLabelsGroup.selectAll(".x-axis-label")
        .data(xTickValues)
        .enter()
        .append("text")
        .attr("class", "label axis-label x-axis-label")
        .attr("x", d => xScale(d))
        .attr("y", -chartMargins.top / 2 + 5) // Position above chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.axisTickText.fontFamily)
        .style("font-size", fillStyle.typography.axisTickText.fontSize)
        .style("font-weight", fillStyle.typography.axisTickText.fontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => xAxisTickFormat(d));

    // Left and Right Group Labels (acting as Y-axis labels)
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis-labels");
    groupNames.forEach(group => {
        const groupPathData = rankData[group];
        if (groupPathData && groupPathData.length > 0) {
            // Left labels
            const firstPoint = groupPathData[0];
            yAxisLabelsGroup.append("text")
                .attr("class", "label group-label y-axis-label left")
                .attr("x", -10) // Position to the left of the chart area
                .attr("y", yScale(firstPoint.rank))
                .attr("dy", "0.32em") // Vertical alignment
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.groupLabelText.fontFamily)
                .style("font-size", fillStyle.typography.groupLabelText.fontSize)
                .style("font-weight", fillStyle.typography.groupLabelText.fontWeight)
                .attr("fill", fillStyle.getGroupColor(group)) // Use group color for label
                .text(group);

            // Right labels
            const lastPoint = groupPathData[groupPathData.length - 1];
            yAxisLabelsGroup.append("text")
                .attr("class", "label group-label y-axis-label right")
                .attr("x", innerWidth + 10) // Position to the right
                .attr("y", yScale(lastPoint.rank))
                .attr("dy", "0.32em")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.groupLabelText.fontFamily)
                .style("font-size", fillStyle.typography.groupLabelText.fontSize)
                .style("font-weight", fillStyle.typography.groupLabelText.fontWeight)
                .attr("fill", fillStyle.getGroupColor(group))
                .text(group);
        }
    });

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const linesGroup = mainChartGroup.append("g").attr("class", "lines-group");
    const dotsGroup = mainChartGroup.append("g").attr("class", "dots-group");
    const valueLabelsGroup = mainChartGroup.append("g").attr("class", "value-labels-group");

    const lineGenerator = d3.line()
        .x(d => xScale(d.x))
        .y(d => yScale(d.rank));

    groupNames.forEach(group => {
        const groupPathData = rankData[group];
        if (groupPathData && groupPathData.length > 0) {
            // Lines
            linesGroup.append("path")
                .datum(groupPathData)
                .attr("class", "mark line")
                .attr("fill", "none")
                .attr("stroke", fillStyle.getGroupColor(group))
                .attr("stroke-width", fillStyle.lineStrokeWidth)
                .attr("d", lineGenerator);

            // Dots
            dotsGroup.selectAll(`.dot-${group.replace(/\s+/g, '-')}`) // Unique class for selection if needed, though generic is fine
                .data(groupPathData)
                .enter()
                .append("circle")
                .attr("class", "mark dot")
                .attr("cx", d => xScale(d.x))
                .attr("cy", d => yScale(d.rank))
                .attr("r", fillStyle.dotRadius)
                .attr("fill", fillStyle.getGroupColor(group))
                .attr("stroke", fillStyle.dotBorderColor)
                .attr("stroke-width", fillStyle.dotStrokeWidth);

            // Value Labels
            valueLabelsGroup.selectAll(`.value-label-${group.replace(/\s+/g, '-')}`)
                .data(groupPathData)
                .enter()
                .append("text")
                .attr("class", "label value-label")
                .attr("x", d => xScale(d.x) + fillStyle.dotRadius + 5) // Offset from dot
                .attr("y", d => yScale(d.rank))
                .attr("dy", "-0.5em") // Position slightly above the dot's center line
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.valueLabelText.fontFamily)
                .style("font-size", fillStyle.typography.valueLabelText.fontSize)
                .style("font-weight", fillStyle.typography.valueLabelText.fontWeight)
                .attr("fill", fillStyle.textColor)
                .text(d => d.value.toLocaleString());
        }
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No specific enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stepped Line Graph",
  "chart_name": "stepped_line_graph_plain_chart_02",
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
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function renders a grouped stepped line chart.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assuming data.colors, not data.colors_dark unless specified
    const imagesConfig = data.images || {}; // Not used in this chart, but parsed for completeness
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

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push(`role: ${xFieldRole}`);
        if (!yFieldName) missingFields.push(`role: ${yFieldRole}`);
        if (!groupFieldName) missingFields.push(`role: ${groupFieldRole}`);
        
        const errorMessage = `Critical chart config missing: Field name(s) for role(s) [${missingFields.join(', ')}] not found in data.data.columns. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
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
        },
        textColor: colorsConfig.text_color || '#333333',
        axisLineColor: colorsConfig.other && colorsConfig.other.axis_line ? colorsConfig.other.axis_line : '#AAAAAA',
        gridLineColor: colorsConfig.other && colorsConfig.other.grid_line ? colorsConfig.other.grid_line : '#DDDDDD',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Not directly used for SVG background
        defaultLineColors: colorsConfig.available_colors || d3.schemeCategory10,
        fieldColors: colorsConfig.field || {},
        // images (example, not used in this chart)
        // iconPrimary: imagesConfig.other && imagesConfig.other.primary ? imagesConfig.other.primary : null,
    };

    const estimateTextWidth = (text, fontProps) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('style', `font-family: ${fontProps.fontFamily}; font-size: ${fontProps.fontSize}; font-weight: ${fontProps.fontWeight};`);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // For full reliability, it might be necessary to briefly append to DOM, measure, then remove.
        // However, the directive says "MUST NOT be appended to the document DOM".
        // Using getComputedTextLength if getBBox is problematic without DOM attachment.
        // For simplicity and adherence, assuming getBBox on an unattached element is sufficient for estimation.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements is problematic
            return text.length * (parseInt(fontProps.fontSize) || 12) * 0.6; 
        }
    };
    
    const parseDate = (dateValue) => {
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue === 'number') return new Date(dateValue, 0, 1); // Assume year if number
        if (typeof dateValue === 'string') {
            const parts = dateValue.split(/[-/]/);
            if (parts.length === 3) { // YYYY-MM-DD or YYYY/MM/DD
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
            if (parts.length === 2) { // YYYY-MM or YYYY/MM
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            }
            if (parts.length === 1 && /^\d{4}$/.test(parts[0])) { // YYYY
                return new Date(parseInt(parts[0]), 0, 1);
            }
        }
        // Fallback or error handling for unparseable dates
        // console.warn("Could not parse date:", dateValue);
        return new Date(); // Or return null and filter out such data points
    };

    const formatValueForAxis = (value) => {
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
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground === '#FFFFFF' ? 'transparent' : fillStyle.chartBackground); // Only set if not default white

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 50, left: 60 }; // Adjusted top for legend
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = rawChartData.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: +d[yFieldName] // Ensure y-value is numeric
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));

    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();
    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartDataArray, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yPaddingFactor = 0.1; // Reduced padding for a tighter fit
    const yRange = yMax - yMin;
    const yDomainMin = yMin - yRange * yPaddingFactor;
    const yDomainMax = yMax + yRange * yPaddingFactor;
    
    const yScale = d3.scaleLinear()
        .domain([yDomainMin === yDomainMax ? yDomainMin -1 : yDomainMin, yDomainMax === yDomainMin ? yDomainMax + 1 : yDomainMax]) // Handle single value case
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => fillStyle.fieldColors[group] || fillStyle.defaultLineColors[i % fillStyle.defaultLineColors.length]));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(formatValueForAxis));
    
    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.selectAll("line")
        .style("stroke", fillStyle.axisLineColor);
    yAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);

    // X-Axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y"))); // Simplified tick logic

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
        
    xAxisGroup.selectAll("line")
        .style("stroke", fillStyle.axisLineColor);
    xAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);

    // Gridlines (horizontal)
    mainChartGroup.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(""))
        .selectAll("line")
        .style("stroke", fillStyle.gridLineColor)
        .style("stroke-opacity", 0.7);
    mainChartGroup.select(".grid .domain").remove(); // Remove axis line from grid

    // Legend
    const legendItemHeight = 20;
    const legendSymbolSize = 10;
    const legendSpacing = 5;
    const legendPadding = 10;
    let currentX = 0;
    let currentY = -chartMargins.top + legendPadding; // Place above chart area

    const legendGroup = mainChartGroup.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${currentY})`);

    groups.forEach((groupName, i) => {
        const itemFontProps = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        };
        const textWidth = estimateTextWidth(groupName, itemFontProps);
        const itemWidth = legendSymbolSize + legendSpacing + textWidth + legendPadding;

        if (currentX + itemWidth > innerWidth && i > 0) {
            currentX = 0;
            currentY += legendItemHeight;
            // Re-adjust legend group if it wraps to new line (not done here for simplicity, assumes enough top margin)
        }

        const legendItemGroup = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`); // Y is relative to legendGroup

        legendItemGroup.append("line")
            .attr("class", "mark")
            .attr("x1", 0)
            .attr("y1", legendItemHeight / 2)
            .attr("x2", legendSymbolSize * 1.5) // Make line symbol longer
            .attr("y2", legendItemHeight / 2)
            .style("stroke", colorScale(groupName))
            .style("stroke-width", 3);

        legendItemGroup.append("text")
            .attr("class", "label")
            .attr("x", legendSymbolSize * 1.5 + legendSpacing)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .text(groupName)
            .style("font-family", itemFontProps.fontFamily)
            .style("font-size", itemFontProps.fontSize)
            .style("font-weight", itemFontProps.fontWeight)
            .style("fill", fillStyle.textColor);
        
        currentX += itemWidth;
    });
    // Adjust legend group's overall Y position if needed, e.g., based on its measured height.
    // For this refactor, keeping it simple with fixed top placement.

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]))
        .curve(d3.curveStepAfter);

    groupedData.forEach((values, group) => {
        const sortedValues = values.sort((a, b) => a[xFieldName] - b[xFieldName]);
        mainChartGroup.append("path")
            .datum(sortedValues)
            .attr("class", "mark line-series")
            .attr("fill", "none")
            .attr("stroke", colorScale(group))
            .attr("stroke-width", 3) // Standardized stroke width
            .attr("d", lineGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Data labels removed as per simplification directive (original placeLabelsDP was too complex).
    // If simple labels were required, they would be added here. For example, labels at the end of each line:
    /*
    groupedData.forEach((values, group) => {
        const sortedValues = values.sort((a, b) => a[xFieldName] - b[xFieldName]);
        if (sortedValues.length > 0) {
            const lastPoint = sortedValues[sortedValues.length - 1];
            mainChartGroup.append("text")
                .attr("class", "value data-label")
                .attr("x", xScale(lastPoint[xFieldName]) + 5)
                .attr("y", yScale(lastPoint[yFieldName]))
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("fill", colorScale(group))
                .text(formatValueForAxis(lastPoint[yFieldName]));
        }
    });
    */

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Bar Chart",
  "chart_name": "grouped_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["text_color", "background_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "none",
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
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via data.colors_dark
    const rawImages = data.images || {}; // Though not used in this chart, follow structure
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldUnit = xFieldDef && xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? ` ${yFieldDef.unit}` : ""; // Add space if unit exists

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultBarColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#4682B4', // SteelBlue as a generic default
        getBarColor: (groupValue, groupIndex, allGroups) => {
            if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][groupValue]) {
                return rawColors.field[groupFieldName][groupValue];
            }
            if (rawColors.field && rawColors.field[groupValue]) { // Fallback to groupValue as key directly in colors.field
                 return rawColors.field[groupValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
            }
            return d3.schemeCategory10[groupIndex % 10]; // Default D3 scheme
        }
    };

    function estimateTextWidth(text, fontProps = {}) {
        const { fontSize = fillStyle.typography.labelFontSize, fontFamily = fillStyle.typography.labelFontFamily, fontWeight = fillStyle.typography.labelFontWeight } = fontProps;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM manipulation.
        // For simple cases, this might suffice. If not, a temporary off-screen SVG in DOM is needed.
        // However, the prompt says "MUST NOT be appended to the document DOM".
        // A common workaround is to have a pre-rendered SVG element for measurement, or accept slight inaccuracies.
        // For this implementation, we'll assume getBBox on an unattached element is sufficient or an accepted limitation.
        // If not, one would typically use a canvas context:
        // const context = document.createElement('canvas').getContext('2d');
        // context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        // return context.measureText(text).width;
        // Using SVG getBBox as it's more common with D3.
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            return text.length * (parseInt(fontSize) * 0.6); // Rough estimate
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root-svg");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 }; // Adjusted left margin for potentially longer Y-axis labels
    if (variables.legend_position === 'top_right_horizontal') { // Example dynamic margin adjustment
        chartMargins.top = 80;
    }

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataProcessed = rawChartData.map(d => ({
        ...d,
        [yFieldName]: +d[yFieldName] // Ensure yField is numeric
    }));

    const categories = Array.from(new Set(chartDataProcessed.map(d => d[xFieldName]))).sort(); // Sort categories for consistent order
    const groupNames = Array.from(new Set(chartDataProcessed.map(d => d[groupFieldName]))).sort(); // Sort groups for consistent order

    // Nest data for grouped bars
    const nestedData = Array.from(
        d3.group(chartDataProcessed, d => d[xFieldName]), ([category, values]) => {
            const groupData = {};
            groupNames.forEach(group => { // Ensure all groups are present, even if with 0 value
                const item = values.find(v => v[groupFieldName] === group);
                groupData[group] = item ? item[yFieldName] : 0;
            });
            return { category, groups: groupData };
        }
    );
    // Ensure nestedData is sorted by the original category order if sorting was intended
     nestedData.sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.2); // Padding between category groups

    const groupScale = d3.scaleBand()
        .domain(groupNames)
        .range([0, xScale.bandwidth()])
        .padding(0.05); // Padding between bars within a group

    const yMax = d3.max(chartDataProcessed, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is at least [0,1]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) { // Rotate labels if they are too long
            const labelText = String(d);
            const availableWidth = xScale.bandwidth();
            const textWidth = estimateTextWidth(labelText, {
                fontSize: fillStyle.typography.labelFontSize,
                fontFamily: fillStyle.typography.labelFontFamily,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (textWidth > availableWidth * 0.9) { // 0.9 to give some buffer
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });
    xAxisGroup.select(".domain").style("stroke", fillStyle.textColor);


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + yFieldUnit).tickSize(0).tickPadding(10));

    yAxisGroup.selectAll("text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    yAxisGroup.select(".domain").style("stroke", fillStyle.textColor);


    // Legend
    const legendItemSize = 12;
    const legendSpacing = 5;
    const legendXOffset = chartMargins.left;
    const legendYOffset = 15; // Position from the top of the SVG, within margin area
    
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendXOffset}, ${legendYOffset})`);

    let currentX = 0;
    groupNames.forEach((groupName, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("class", "mark")
            .attr("width", legendItemSize)
            .attr("height", legendItemSize)
            .style("fill", fillStyle.getBarColor(groupName, i, groupNames));

        const textElement = legendItem.append("text")
            .attr("class", "label")
            .attr("x", legendItemSize + legendSpacing)
            .attr("y", legendItemSize / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);
        
        currentX += legendItemSize + legendSpacing + estimateTextWidth(groupName, {
            fontSize: fillStyle.typography.labelFontSize,
            fontFamily: fillStyle.typography.labelFontFamily,
            fontWeight: fillStyle.typography.labelFontWeight
        }) + (legendSpacing * 3); // Add more spacing between items
    });


    // Block 8: Main Data Visualization Rendering
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(nestedData)
        .enter().append("g")
        .attr("class", "category-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    categoryGroups.selectAll(".bar")
        .data(d => groupNames.map(groupName => ({ key: groupName, value: d.groups[groupName] || 0 })))
        .enter().append("rect")
        .attr("class", d => `mark bar group-${d.key.replace(/\s+/g, '-')}`) // Sanitize class name
        .attr("x", d => groupScale(d.key))
        .attr("y", d => yScale(d.value))
        .attr("width", groupScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .style("fill", (d, i, nodes) => {
            // Find the index of d.key within the global groupNames array
            const groupIndex = groupNames.indexOf(d.key);
            return fillStyle.getBarColor(d.key, groupIndex, groupNames);
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
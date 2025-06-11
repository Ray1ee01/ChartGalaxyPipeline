/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_grouped_bar_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Assuming dark theme preference if both exist, or just colors
    const images = data.images || {}; // Not used in this chart type, but extracted for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const xFieldName = xFieldConfig ? xFieldConfig.name : undefined;
    const yFieldName = yFieldConfig ? yFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    const xFieldUnit = xFieldConfig && xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const yFieldUnit = yFieldConfig && yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";
    // const groupFieldUnit = groupFieldConfig && groupFieldConfig.unit !== "none" ? groupFieldConfig.unit : ""; // Not typically used for display

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? "x role field" : null,
            !yFieldName ? "y role field" : null,
            !groupFieldName ? "group role field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultBarColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        getCategoryColor: (category) => {
            if (rawColors.field && rawColors.field[groupFieldName] && rawColors.field[groupFieldName][category]) {
                return rawColors.field[groupFieldName][category];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                // Simple hash function to pick a color based on category name
                let hash = 0;
                for (let i = 0; i < category.length; i++) {
                    hash = category.charCodeAt(i) + ((hash << 5) - hash);
                }
                return rawColors.available_colors[Math.abs(hash) % rawColors.available_colors.length];
            }
            return fillStyle.defaultBarColor;
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but the directive says "MUST NOT be appended to the document DOM".
        // This might lead to inaccuracies in some browsers/setups if not rendered.
        // For robust measurement, a hidden live SVG element is better.
        // However, adhering strictly to the "in-memory" directive:
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox is not available on non-rendered element
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            return text.length * avgCharWidth;
        }
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function wrapText(textElement, textContent, maxWidth, lineHeight = 1.1, verticalAlign = 'middle') {
        textElement.text(null); // Clear existing content
        const words = String(textContent).split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const x = textElement.attr("x") || 0; // Keep original x
        const initialY = parseFloat(textElement.attr("data-initial-y")) || parseFloat(textElement.attr("y")) || 0;
        
        let tspan = textElement.append("tspan").attr("x", x);
        const tspans = [tspan];

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = textElement.append("tspan").attr("x", x).text(word);
                tspans.push(tspan);
                lineNumber++;
            }
        }
        
        const numLines = tspans.length;
        let startDy;
        if (verticalAlign === 'middle') {
            startDy = -((numLines - 1) / 2) * lineHeight;
        } else if (verticalAlign === 'bottom') {
            startDy = -(numLines - 1) * lineHeight;
        } else { // top or default
            startDy = 0;
        }

        textElement.attr("y", initialY); // Reset y to its initial position before applying dy adjustments

        tspans.forEach((ts, i) => {
            ts.attr("dy", (i === 0 ? startDy : lineHeight) + "em");
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 30, right: 30, bottom: 70, left: 60 }; // Adjusted bottom for potentially wrapped labels
    if (chartData.length === 0) chartMargins.bottom = 30; // Less bottom margin if no data/axis

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartData.map(d => d[groupFieldName]))).sort(); // Sort for consistent order

    const processedData = Array.from(d3.group(chartData, d => d[xFieldName]), ([key, values]) => {
        const groupValues = {};
        groups.forEach(g => groupValues[g] = 0); // Initialize all groups with 0
        values.forEach(v => {
            groupValues[v[groupFieldName]] = +v[yFieldName];
        });
        return { category: key, groups: groupValues };
    });
    
    // Ensure consistent order of categories based on original data if possible, or sort them
    const xCategories = Array.from(new Set(chartData.map(d => d[xFieldName])));
    processedData.sort((a, b) => xCategories.indexOf(a.category) - xCategories.indexOf(b.category));


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

    const yMax = d3.max(chartData, d => +d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("data-initial-y", parseFloat(fillStyle.typography.labelFontSize) * 0.5) // Adjust for better positioning with wrapText
        .each(function (d) {
            const textElement = d3.select(this);
            wrapText(textElement, String(d) + (xFieldUnit ? ` (${xFieldUnit})` : ''), xScale.bandwidth(), 1.1, 'top');
        });
    
    xAxisGroup.select(".domain").remove();


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : '')).tickSize(0).tickPadding(10));

    yAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    
    yAxisGroup.select(".domain").remove();
    
    // No legend rendering as per simplification directives.

    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group-container")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-group-container")
        .attr("transform", d => `translate(${xScale(d.category)},0)`);

    groups.forEach((groupName, i) => {
        barGroups.append("rect")
            .attr("class", "mark bar")
            .attr("x", d => groupScale(groupName))
            .attr("y", d => yScale(d.groups[groupName] || 0))
            .attr("width", groupScale.bandwidth())
            .attr("height", d => innerHeight - yScale(d.groups[groupName] || 0))
            .attr("fill", fillStyle.getCategoryColor(groupName));

        barGroups.append("text")
            .attr("class", "label value-label")
            .attr("x", d => groupScale(groupName) + groupScale.bandwidth() / 2)
            .attr("data-initial-y", d => yScale(d.groups[groupName] || 0) - 5) // Position above the bar
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .each(function (d) {
                const value = d.groups[groupName] || 0;
                const labelText = formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
                const textElement = d3.select(this);
                // Value labels are typically short, wrapText might be overkill but can be used for consistency
                // For simplicity, direct text assignment if wrapping isn't strictly needed for single line values.
                // wrapText(textElement, labelText, groupScale.bandwidth(), 1, 'bottom');
                textElement.text(labelText); // Simpler for value labels
                 // Adjust y if text is too long and would overlap, or if it's 0
                if (textElement.node().getComputedTextLength() > groupScale.bandwidth() || value === 0) {
                    // If too long or value is 0, consider alternative placement or hiding.
                    // For now, just let it be. Could be improved with collision detection.
                }
                if (value === 0) { // If value is 0, place label slightly above baseline
                    textElement.attr("y", yScale(0) - 5);
                }

            });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects, gradients, shadows, or annotations as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
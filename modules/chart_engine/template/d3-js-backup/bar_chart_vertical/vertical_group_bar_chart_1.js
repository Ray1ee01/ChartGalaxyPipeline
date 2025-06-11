/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_group_bar_chart_1",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 20]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["background_color", "text_color", "primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "inside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const chartVariables = data.variables || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };
    const inputTypography = data.typography || {};

    // Color defaults
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: [...d3.schemeCategory10], // Default palette
        background_color: "#FFFFFF",
        text_color: "#333333"
    };
    const inputColors = data.colors || {};
    const colors = {
        field: { ...(inputColors.field || {}) }, // No default fields, rely on available_colors or specific mappings
        other: { ...defaultColors.other, ...(inputColors.other || {}) },
        available_colors: inputColors.available_colors && inputColors.available_colors.length > 0 ? [...inputColors.available_colors] : defaultColors.available_colors,
        background_color: inputColors.background_color || defaultColors.background_color,
        text_color: inputColors.text_color || defaultColors.text_color
    };
    
    const images = data.images || { field: {}, other: {} }; // Parse images, though not used in this chart

    // Clear the container
    d3.select(containerSelector).html("");

    // Extract field names from dataColumns
    const getFieldInfo = (role) => dataColumns.find(col => col.role === role);

    const xFieldDef = getFieldInfo("x");
    const yFieldDef = getFieldInfo("y");
    const groupFieldDef = getFieldInfo("group");

    const xFieldName = xFieldDef?.name;
    const yFieldName = yFieldDef?.name;
    const groupFieldName = groupFieldDef?.name;

    const xUnitName = (xFieldDef?.unit && xFieldDef.unit !== "none") ? xFieldDef.unit : "";
    const yUnitName = (yFieldDef?.unit && yFieldDef.unit !== "none") ? yFieldDef.unit : "";
    // const groupUnitName = (groupFieldDef?.unit && groupFieldDef.unit !== "none") ? groupFieldDef.unit : ""; // Not typically used for group labels

    // Critical Identifier Validation
    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x");
        if (!yFieldName) missingFields.push("y");
        if (!groupFieldName) missingFields.push("group");
        const errorMessage = `Critical chart config missing: Required field names (${missingFields.join(', ')}) not found in dataColumns. Cannot render chart.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: {
                font_family: (inputTypography.title && inputTypography.title.font_family) || defaultTypography.title.font_family,
                font_size: (inputTypography.title && inputTypography.title.font_size) || defaultTypography.title.font_size,
                font_weight: (inputTypography.title && inputTypography.title.font_weight) || defaultTypography.title.font_weight,
            },
            label: {
                font_family: (inputTypography.label && inputTypography.label.font_family) || defaultTypography.label.font_family,
                font_size: (inputTypography.label && inputTypography.label.font_size) || defaultTypography.label.font_size,
                font_weight: (inputTypography.label && inputTypography.label.font_weight) || defaultTypography.label.font_weight,
            },
            annotation: { // Not used in this chart, but defined for completeness
                font_family: (inputTypography.annotation && inputTypography.annotation.font_family) || defaultTypography.annotation.font_family,
                font_size: (inputTypography.annotation && inputTypography.annotation.font_size) || defaultTypography.annotation.font_size,
                font_weight: (inputTypography.annotation && inputTypography.annotation.font_weight) || defaultTypography.annotation.font_weight,
            }
        },
        textColor: colors.text_color,
        axisLineColor: colors.text_color, // Default axis line color to text color
        barDataLabelColor: '#FFFFFF', // Default for labels inside bars
        chartBackground: colors.background_color,
        groupColorMap: {} // To be populated in Block 5
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family);
        tempTextElement.setAttribute('font-size', fontProps.font_size);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // getBBox works on un-appended elements in modern browsers (e.g., Chrome)
        try {
            return tempTextElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work robustly
            let averageCharWidth = 7; // Rough estimate for 12px font
            if (fontProps.font_size) {
                averageCharWidth = parseInt(fontProps.font_size, 10) * 0.6;
            }
            return String(text).length * averageCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard B for billion
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // For smaller numbers or when no suffix needed
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartVariables.width || 800;
    const containerHeight = chartVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root"); // Added class for root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 30, // Reduced top margin as no title/legend
        right: 30,
        bottom: 80, // Keep space for X labels, potentially rotated
        left: 70   // Increased for Y labels with units
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groupNames = Array.from(new Set(chartDataArray.map(d => d[groupFieldName])));

    // Populate groupColorMap in fillStyle
    const defaultCategoricalPalette = colors.available_colors; // Use configured available_colors
    groupNames.forEach((group, index) => {
        if (colors.field && colors.field[group]) {
            fillStyle.groupColorMap[group] = colors.field[group];
        } else if (defaultCategoricalPalette && defaultCategoricalPalette.length > 0) {
            fillStyle.groupColorMap[group] = defaultCategoricalPalette[index % defaultCategoricalPalette.length];
        } else {
            // Fallback if no field mapping and no available_colors
            // Use primary/secondary for first two, then a hardcoded scheme
            if (index === 0 && colors.other.primary) fillStyle.groupColorMap[group] = colors.other.primary;
            else if (index === 1 && colors.other.secondary) fillStyle.groupColorMap[group] = colors.other.secondary;
            else fillStyle.groupColorMap[group] = d3.schemeCategory10[index % d3.schemeCategory10.length]; // Absolute fallback
        }
    });
    
    const groupedData = chartDataArray.reduce((acc, d) => {
        const category = d[xFieldName];
        const group = d[groupFieldName];
        const value = +d[yFieldName]; // Ensure numeric
        
        if (category == null) return acc; // Skip data with no category

        let existingCategory = acc.find(item => item.category === category);
        if (!existingCategory) {
            existingCategory = { category: category, groups: {} };
            acc.push(existingCategory);
        }
        existingCategory.groups[group] = isNaN(value) ? 0 : value; // Handle NaN values gracefully
        return acc;
    }, []);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(groupedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(groupNames)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([innerHeight, 0])
        .nice();

    // Calculate if rotation is needed for X-axis labels
    let rotateXLabels = false;
    if (xScale.domain().length > 0) {
        const maxAllowedXLabelWidth = xScale.bandwidth();
        for (const category of xScale.domain()) {
            const text = String(category) + (xUnitName ? ` ${xUnitName}` : '');
            const estimatedWidth = estimateTextWidth(text, fillStyle.typography.label);
            if (estimatedWidth > maxAllowedXLabelWidth) {
                rotateXLabels = true;
                break;
            }
        }
    }
    
    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));
    
    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("transform", rotateXLabels ? "rotate(-45) translate(-5,0)" : "rotate(0)") // Minor adjustment for rotated labels
        .text(d => d + (xUnitName ? ` ${xUnitName}` : '')); // Add unit to x-axis ticks if present

    xAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + (yUnitName ? ` ${yUnitName}` : '')).tickSize(0).tickPadding(10));
    
    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.textColor);
        
    yAxisGroup.select(".domain").remove(); // Remove Y-axis line as per original behavior (tick lines also removed)
    yAxisGroup.selectAll(".tick line").remove(); // Ensure no tick lines

    // No legend rendering as per simplification directives

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(groupedData)
        .enter()
        .append("g")
        .attr("class", d => `category-group mark value ${String(d.category).replace(/\s+/g, '-')}`) // Add class for category
        .attr("transform", d => `translate(${xScale(d.category)},0)`);

    categoryGroups.selectAll(".bar") // This selection will be empty initially for each categoryGroup
        .data(d => groupNames.map(groupName => ({ key: groupName, value: d.groups[groupName] || 0, category: d.category })))
        .enter()
        .append("rect")
        .attr("class", d => `mark bar value ${String(d.key).replace(/\s+/g, '-')}`) // Add class for group
        .attr("x", d => groupScale(d.key))
        .attr("y", d => yScale(d.value))
        .attr("width", groupScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", d => fillStyle.groupColorMap[d.key]);

    // Add data labels on bars
    categoryGroups.selectAll(".data-label") // This selection will be empty initially
        .data(d => groupNames.map(groupName => ({ key: groupName, value: d.groups[groupName] || 0, category: d.category })))
        .enter()
        .append("text")
        .attr("class", "label value data-label")
        .attr("x", d => groupScale(d.key) + groupScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) + 15) // Position inside the bar, near the top
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.label.font_family)
        .style("font-size", fillStyle.typography.label.font_size)
        .style("font-weight", fillStyle.typography.label.font_weight)
        .style("fill", fillStyle.barDataLabelColor)
        .text(d => {
            // Only show label if bar height is sufficient
            const barHeight = innerHeight - yScale(d.value);
            const textHeight = parseInt(fillStyle.typography.label.font_size, 10);
            return barHeight > textHeight + 5 ? (formatValue(d.value) + (yUnitName ? ` ${yUnitName}` : '')) : "";
        });
        
    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, gradients, shadows, or optional enhancements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
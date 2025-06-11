/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Vertical Bar Chart",
  "chart_name": "grouped_vertical_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 4], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary", "background_color", "text_color"],
  "min_height": 600,
  "min_width": 800,
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
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Could be data.colors_dark for dark themes, assuming light for now
    const imagesConfig = data.images || {}; // Not used in this chart, but good practice
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const groupField = dataColumns.find(col => col.role === "group")?.name;

    if (!xField || !yField || !groupField) {
        const missingFields = [];
        if (!xField) missingFields.push("x field (role: 'x')");
        if (!yField) missingFields.push("y field (role: 'y')");
        if (!groupField) missingFields.push("group field (role: 'group')");
        
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        }
        return null;
    }
    
    const yFieldUnit = dataColumns.find(col => col.role === "y" && col.unit !== "none")?.unit || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        primaryColor: colorsConfig.other?.primary || '#1f77b4',
        secondaryColor: colorsConfig.other?.secondary || '#ff7f0e',
        axisLineColor: colorsConfig.text_color || '#333333', // Default for axis lines if they were visible
    };
    
    // Color mapping for groups
    const groupColorMap = {};
    const uniqueGroupsForColor = Array.from(new Set(chartDataArray.map(d => d[groupField])));
    if (colorsConfig.field && colorsConfig.field[groupField]) {
        uniqueGroupsForColor.forEach(groupVal => {
            groupColorMap[groupVal] = colorsConfig.field[groupField][groupVal] || fillStyle.primaryColor;
        });
    } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
        uniqueGroupsForColor.forEach((groupVal, i) => {
            groupColorMap[groupVal] = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        });
    } else {
        // Fallback to primary/secondary if only two groups, then d3.schemeCategory10
        if (uniqueGroupsForColor.length === 1) {
            groupColorMap[uniqueGroupsForColor[0]] = fillStyle.primaryColor;
        } else if (uniqueGroupsForColor.length === 2) {
            groupColorMap[uniqueGroupsForColor[0]] = fillStyle.primaryColor;
            groupColorMap[uniqueGroupsForColor[1]] = fillStyle.secondaryColor;
        } else {
            const defaultScheme = d3.schemeCategory10;
            uniqueGroupsForColor.forEach((groupVal, i) => {
                groupColorMap[groupVal] = defaultScheme[i % defaultScheme.length];
            });
        }
    }
    fillStyle.groupColors = groupColorMap;


    function estimateTextWidth(text, fontProps = {}) {
        const {
            fontFamily = fillStyle.typography.labelFontFamily,
            fontSize = fillStyle.typography.labelFontSize,
            fontWeight = fillStyle.typography.labelFontWeight
        } = fontProps;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but per spec, an in-memory SVG should not be appended to DOM.
        // For simplicity and adherence, using direct getBBox. May be less accurate.
        // If high accuracy is needed, a temporary append/remove to DOM is better.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback or error handling if getBBox fails (e.g. in a headless environment without proper SVG support)
            console.warn("estimateTextWidth getBBox failed:", e);
            width = text.length * (parseInt(fontSize, 10) * 0.6); // Rough estimate
        }
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 };
    if (chartConfig.marginTop) chartMargins.top = chartConfig.marginTop;
    if (chartConfig.marginRight) chartMargins.right = chartConfig.marginRight;
    if (chartConfig.marginBottom) chartMargins.bottom = chartConfig.marginBottom;
    if (chartConfig.marginLeft) chartMargins.left = chartConfig.marginLeft;
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataArray.map(d => d[groupField]))).sort(); // Sort for consistent order

    const processedData = Array.from(d3.group(chartDataArray, d => d[xField]), ([category, values]) => {
        const groupValues = {};
        groups.forEach(g => groupValues[g] = 0); // Initialize all groups for each category
        values.forEach(v => {
            groupValues[v[groupField]] = +v[yField];
        });
        return { category, groups: groupValues };
    });
    
    // Ensure consistent order of categories based on first appearance in original data
    const xCategories = Array.from(new Set(chartDataArray.map(d => d[xField])));
    processedData.sort((a, b) => xCategories.indexOf(a.category) - xCategories.indexOf(b.category));


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3); // Padding between x-axis groups

    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, xScale.bandwidth()])
        .padding(0.05); // Padding between bars within a group

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[yField]) || 10]) // Ensure domain is at least 0-10
        .range([innerHeight, 0])
        .nice();

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map(g => fillStyle.groupColors[g] || fillStyle.primaryColor));


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label")
        .each(function(d) { // Rotate labels if they are too long
            const labelText = String(d);
            const labelWidth = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (labelWidth > xScale.bandwidth()) {
                d3.select(this)
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                d3.select(this).style("text-anchor", "middle");
            }
        });
    
    xAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);


    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${formatValue(d)}${yFieldUnit ? ` ${yFieldUnit}` : ''}`).tickSize(0).tickPadding(10));

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label");
        
    yAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);
    
    // No legend rendering as per requirements.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barCategoryGroups = mainChartGroup.selectAll(".bar-category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-category-group")
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    barCategoryGroups.selectAll(".bar-element")
        .data(d => groups.map(groupName => ({ category: d.category, group: groupName, value: d.groups[groupName] || 0 })))
        .enter()
        .append("rect")
        .attr("class", "mark bar-element")
        .attr("x", d => groupScale(d.group))
        .attr("y", d => yScale(d.value))
        .attr("width", groupScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d.value))
        .attr("fill", d => colorScale(d.group));

    // Value labels on bars
    barCategoryGroups.selectAll(".value-label-on-bar")
        .data(d => groups.map(groupName => ({ category: d.category, group: groupName, value: d.groups[groupName] || 0 })))
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => groupScale(d.group) + groupScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position 5px above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily) // Smaller font for value labels
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => (d.value > 0 ? formatValue(d.value) : "")); // Show label only if value > 0

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
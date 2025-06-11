/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Group Bar Chart",
  "chart_name": "vertical_group_bar_chart_9",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 6], [0, 100], [3, 4]],
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
    const chartRawData = data.data.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {};
    const imagesInput = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xField = dataColumns.find(col => col.role === xFieldRole)?.name;
    const yField = dataColumns.find(col => col.role === yFieldRole)?.name;
    const groupField = dataColumns.find(col => col.role === groupFieldRole)?.name;
    
    const yUnit = dataColumns.find(col => col.role === yFieldRole && col.unit !== "none")?.unit || "";
    const groupFieldLabel = dataColumns.find(col => col.role === groupFieldRole)?.label || groupField;


    const criticalFields = { xField, yField, groupField };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} field name(s) not found for role(s) ${missingFields.map(f => criticalFields[f] === xField ? xFieldRole : (criticalFields[f] === yField ? yFieldRole : groupFieldRole)).join(', ')}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: ${errorMessage}</div>`);
        return null;
    }
    
    if (!chartRawData || chartRawData.length === 0) {
        const errorMessage = "No data provided to render the chart.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:orange; font-family: sans-serif; padding: 10px;'>Warning: ${errorMessage}</div>`);
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyInput.title?.font_size || '16px',
            titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        colors: {
            textColor: colorsInput.text_color || '#333333',
            backgroundColor: colorsInput.background_color || '#FFFFFF',
            primaryColor: colorsInput.other?.primary || '#1f77b4', // Default primary
            secondaryColor: colorsInput.other?.secondary || '#ff7f0e', // Default secondary
            // getGroupColor will be defined after uniqueGroupCategories is known, or uniqueGroupCategories passed.
            // For now, define structure and it will be populated/used later.
        }
    };
    
    function estimateTextWidth(text, styleArgs = {}) {
        const { fontFamily, fontSize, fontWeight } = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight,
            ...styleArgs
        };

        if (!text) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            return tempText.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return text.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "N/A";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    const sanitizeClassName = (name) => {
        return name ? String(name).replace(/[^a-zA-Z0-9-_]/g, '_') : '';
    };
    
    // Block 5: Data Preprocessing & Transformation (Moved earlier to define uniqueGroupCategories for color scale)
    const uniqueXCategories = Array.from(new Set(chartRawData.map(d => d[xField])));
    const uniqueGroupCategories = Array.from(new Set(chartRawData.map(d => d[groupField])));

    fillStyle.colors.getGroupColor = (groupName) => {
        if (colorsInput.field && colorsInput.field[groupName] !== undefined) {
            return colorsInput.field[groupName];
        }
        const groupIndex = uniqueGroupCategories.indexOf(groupName);
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0 && groupIndex !== -1) {
            return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
        }
        const defaultScheme = d3.schemeCategory10;
        if (groupIndex !== -1) {
            return defaultScheme[groupIndex % defaultScheme.length];
        }
        return '#CCCCCC'; // Last resort default
    };

    const processedData = uniqueXCategories.map(category => {
        const categoryData = { category: category, groups: {} };
        uniqueGroupCategories.forEach(group => {
            const point = chartRawData.find(d => d[xField] === category && d[groupField] === group);
            categoryData.groups[group] = point ? +point[yField] : 0; // Ensure numeric, default to 0
        });
        return categoryData;
    });


    // Block 4: Core Chart Dimensions & Layout Calculation
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const chartMargins = { top: 60, right: 30, bottom: 80, left: 70 }; // Increased top for legend, left for y-axis labels
    
    // Adjust bottom margin if x-axis labels might be long and rotated
    let potentialMaxXLabelHeight = estimateTextWidth(" ΑγQy ", fillStyle.typography.label) * Math.sin(45 * Math.PI/180) + 10; // Rough estimate for rotated label height
    if (potentialMaxXLabelHeight > chartMargins.bottom - 20) { // 20 for axis line and padding
         chartMargins.bottom = potentialMaxXLabelHeight + 20;
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMessage = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Check container size and margins.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: ${errorMessage}</div>`);
        return null;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("class", "chart-svg-root");

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(uniqueXCategories)
        .range([0, innerWidth])
        .padding(0.3); // Padding between category groups

    const groupScale = d3.scaleBand()
        .domain(uniqueGroupCategories)
        .range([0, xScale.bandwidth()])
        .padding(0.1); // Padding between bars within a group

    const yMax = d3.max(chartRawData, d => +d[yField]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 10]) // Ensure domain is at least 0-10 if max is 0 or negative
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    
    // X-axis
    let rotateXLabels = false;
    const maxAllowedLabelWidth = xScale.bandwidth();
    if (maxAllowedLabelWidth > 0) {
        for (const category of uniqueXCategories) {
            const estimatedWidth = estimateTextWidth(String(category), fillStyle.typography.label);
            if (estimatedWidth > maxAllowedLabelWidth) {
                rotateXLabels = true;
                break;
            }
        }
    }
    if (rotateXLabels && chartMargins.bottom < 70) { // If rotation needed and margin not already large
        // This recalculation is tricky here. Better to estimate need for rotation earlier.
        // For now, we assume initial bottom margin calculation was sufficient.
    }


    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("dx", rotateXLabels ? "-0.7em" : null)
        .attr("dy", rotateXLabels ? "0.15em" : null)
        .attr("transform", rotateXLabels ? "rotate(-45)" : null);
    
    xAxisGroup.select(".domain").style("stroke", fillStyle.colors.textColor);

    // Y-axis
    const yAxis = d3.axisLeft(yScale)
        .ticks(Math.max(2, Math.min(10, Math.floor(innerHeight / 40)))) // Responsive ticks
        .tickFormat(d => formatValue(d) + (yUnit ? ` ${yUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor);
        
    yAxisGroup.select(".domain").style("stroke", fillStyle.colors.textColor);


    // Legend
    function renderLegend(legendContainer, groupCategories, groupFieldLabelText, fs, options = {}) {
        legendContainer.selectAll("*").remove();
        const { itemHeight = 20, itemSpacing = 5, symbolSize = 12, legendYOffset = 0, legendXOffset = 0, maxLegendWidth = innerWidth } = options;

        const legendLabelStyle = fs.typography.label;
        const textColor = fs.colors.textColor;
        let currentX = legendXOffset;
        let currentY = legendYOffset;

        if (groupFieldLabelText) {
            const titleElement = legendContainer.append("text")
                .attr("class", "text legend-title")
                .attr("x", currentX)
                .attr("y", currentY + itemHeight / 2)
                .attr("dy", "0.35em")
                .style("font-family", legendLabelStyle.font_family)
                .style("font-size", legendLabelStyle.font_size)
                .style("font-weight", "bold")
                .style("fill", textColor)
                .text(groupFieldLabelText + ":");
            
            const titleWidth = estimateTextWidth(groupFieldLabelText + ":", { ...legendLabelStyle, fontWeight: "bold" });
            currentX += titleWidth + 10; // 10px padding after title
        }

        groupCategories.forEach((groupName) => {
            const itemText = String(groupName);
            const itemWidth = symbolSize + itemSpacing + estimateTextWidth(itemText, legendLabelStyle) + 15; // 15 for padding to next

            if (currentX + itemWidth > maxLegendWidth && currentX > legendXOffset) { // Wrap if too wide, but only if not the first item on line
                currentX = legendXOffset;
                currentY += itemHeight;
                 if (groupFieldLabelText && legendXOffset === 0) { // If wrapped and there was a title, indent subsequent lines
                    currentX += estimateTextWidth("  ", legendLabelStyle); // Indent a bit
                }
            }

            const legendItem = legendContainer.append("g")
                .attr("class", `legend-item legend-item-${sanitizeClassName(groupName)}`)
                .attr("transform", `translate(${currentX}, ${currentY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-symbol")
                .attr("x", 0)
                .attr("y", (itemHeight - symbolSize) / 2)
                .attr("width", symbolSize)
                .attr("height", symbolSize)
                .style("fill", fs.colors.getGroupColor(groupName));

            legendItem.append("text")
                .attr("class", "text legend-label")
                .attr("x", symbolSize + itemSpacing)
                .attr("y", itemHeight / 2)
                .attr("dy", "0.35em")
                .style("font-family", legendLabelStyle.font_family)
                .style("font-size", legendLabelStyle.font_size)
                .style("font-weight", legendLabelStyle.font_weight)
                .style("fill", textColor)
                .text(itemText);
            
            currentX += itemWidth;
        });
    }

    if (uniqueGroupCategories.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${chartMargins.left}, 20)`); // Position legend within top margin area
        renderLegend(legendGroup, uniqueGroupCategories, groupFieldLabel, fillStyle, {maxLegendWidth: innerWidth});
    }


    // Block 8: Main Data Visualization Rendering
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", d => `category-group category-${sanitizeClassName(d.category)}`)
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    const barElements = categoryGroups.selectAll(".mark.bar")
        .data(d => uniqueGroupCategories.map(groupName => ({
            category: d.category,
            group: groupName,
            value: d.groups[groupName] === undefined || d.groups[groupName] === null ? 0 : d.groups[groupName] // Handle undefined/null explicitly
        })))
        .enter()
        .append("rect")
        .attr("class", d => `mark bar group-${sanitizeClassName(d.group)}`)
        .attr("x", d => groupScale(d.group))
        .attr("y", d => yScale(Math.max(0, d.value))) // Ensure y is not above baseline for 0 or negative
        .attr("width", groupScale.bandwidth())
        .attr("height", d => {
            const val = d.value === undefined || d.value === null ? 0 : d.value;
            return Math.abs(yScale(val) - yScale(0)); // Height from baseline
        })
        .attr("fill", d => fillStyle.colors.getGroupColor(d.group));

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or icons in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
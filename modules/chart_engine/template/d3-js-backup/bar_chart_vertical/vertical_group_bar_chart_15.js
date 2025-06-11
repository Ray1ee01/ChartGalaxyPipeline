/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Group Bar Chart",
  "chart_name": "vertical_group_bar_chart_15",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 6], [0, 100], [3, 4]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "secondary"],
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Could be data.colors_dark for dark themes, adapt if needed
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getField = (role) => dataColumns.find(col => col.role === role);

    const xFieldDef = getField(xFieldRole);
    const yFieldDef = getField(yFieldRole);
    const groupFieldDef = getField(groupFieldRole);

    const categoryFieldName = xFieldDef ? xFieldDef.name : undefined;
    const valueFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        let missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    if (chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        images: {} // For potential image URLs
    };

    // Typography
    fillStyle.typography.defaultFontFamily = 'Arial, sans-serif';
    fillStyle.typography.defaultFontSize = '12px';
    fillStyle.typography.defaultFontWeight = 'normal';

    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : fillStyle.typography.defaultFontFamily;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : fillStyle.typography.defaultFontSize;
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : fillStyle.typography.defaultFontWeight;
    
    // Colors
    fillStyle.textColor = rawColors.text_color || '#333333';
    fillStyle.chartBackground = rawColors.background_color || '#FFFFFF'; // Default to white
    fillStyle.decoratorColor1 = (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#d28686'; // For ellipse and first triangle
    fillStyle.decoratorColor2 = (rawColors.other && rawColors.other.secondary) ? rawColors.other.secondary : '#444444'; // For second triangle (darker)

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontProps = {}) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.textContent = text;
        textElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        textElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        textElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but per spec, avoid DOM manipulation.
        // For simple cases, direct getBBox on unattached element might work, but can be inconsistent.
        // A robust way without appending to visible DOM:
        // svg.style.visibility = 'hidden'; svg.style.position = 'absolute'; document.body.appendChild(svg);
        // const width = textElement.getBBox().width; document.body.removeChild(svg); return width;
        // Given constraints, we'll use the simpler approach, assuming it's sufficient.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on unattached elements
            return text.length * (parseInt(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        }
    }

    // Helper: Value formatting
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard SI prefix
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format(",")(value); // Default to comma-separated for smaller numbers
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const chartMargins = {
        top: variables.margin_top || 70, // Increased top margin for legend
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 80,
        left: variables.margin_left || 60 // Increased left margin for Y-axis labels
    };
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); // Sort for consistent legend order

    const processedData = chartDataArray.reduce((acc, d) => {
        const category = d[categoryFieldName];
        const group = d[groupFieldName];
        const value = +d[valueFieldName]; // Ensure numeric
        
        let existingCategory = acc.find(item => item.category === category);
        if (!existingCategory) {
            existingCategory = { category: category, groups: {} };
            groups.forEach(g => existingCategory.groups[g] = 0); // Initialize all groups for consistent structure
            acc.push(existingCategory);
        }
        existingCategory.groups[group] = value;
        return acc;
    }, []);
    
    // Sort processedData by categoryFieldName if it's part of dataColumns and has a sort order
    // For now, assume original order or sort alphabetically if needed.
    // processedData.sort((a, b) => d3.ascending(a.category, b.category));


    // Bar colors
    const groupColorMapping = {};
    const defaultCategoricalColors = d3.schemeCategory10;
    let colorIndex = 0;
    groups.forEach(group => {
        if (rawColors.field && rawColors.field[group]) {
            groupColorMapping[group] = rawColors.field[group];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            groupColorMapping[group] = rawColors.available_colors[colorIndex % rawColors.available_colors.length];
            colorIndex++;
        } else {
            groupColorMapping[group] = defaultCategoricalColors[colorIndex % defaultCategoricalColors.length];
            colorIndex++;
        }
    });
    fillStyle.barCategoryColors = groupColorMapping;
    fillStyle.defaultCategoryColor = defaultCategoricalColors[0];


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, xScale.bandwidth()])
        .padding(0.05); // Small padding between bars in a group

    const yMax = d3.max(chartDataArray, d => +d[valueFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    
    // X-axis
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);
    
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    xAxisGroup.call(xAxis)
        .selectAll("text")
        .attr("class", "text label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) { // Calculate rotation based on available space
            const tickText = d3.select(this);
            const textContent = tickText.text();
            const textWidth = estimateTextWidth(textContent, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (textWidth > xScale.bandwidth() * 0.9) { // Heuristic for when to rotate
                tickText.style("text-anchor", "end")
                        .attr("dx", "-.8em")
                        .attr("dy", ".15em")
                        .attr("transform", "rotate(-45)");
            } else {
                tickText.style("text-anchor", "middle");
            }
        });
    xAxisGroup.select(".domain").style("stroke", fillStyle.textColor);

    // Y-axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis");

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${formatValue(d)}${yFieldUnit ? ` ${yFieldUnit}` : ''}`)
        .tickSize(0)
        .tickPadding(10);
        
    yAxisGroup.call(yAxis)
        .selectAll("text")
        .attr("class", "text label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
    yAxisGroup.select(".domain").style("stroke", fillStyle.textColor);

    // Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend other") // 'other' for the group itself
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2 - 10})`); // Position in top margin

    let currentX = 0;
    const legendItemHeight = 20;
    const legendPadding = 5;
    const swatchSize = 12;

    groups.forEach((groupName, i) => {
        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item other")
            .attr("transform", `translate(${currentX}, 0)`);

        legendItem.append("rect")
            .attr("x", 0)
            .attr("y", (legendItemHeight - swatchSize) / 2)
            .attr("width", swatchSize)
            .attr("height", swatchSize)
            .attr("class", "mark")
            .style("fill", fillStyle.barCategoryColors[groupName] || fillStyle.defaultCategoryColor);

        const legendText = legendItem.append("text")
            .attr("x", swatchSize + legendPadding)
            .attr("y", legendItemHeight / 2)
            .attr("dy", "0.35em") // Vertical alignment
            .attr("class", "text label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize) // Use label size for legend
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(groupName);
        
        const textWidth = estimateTextWidth(groupName, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        });
        currentX += swatchSize + legendPadding + textWidth + legendPadding * 3; // Add more spacing
    });


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barGroups = mainChartGroup.selectAll(".bar-category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "bar-category-group other") // 'other' for grouping element
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    groups.forEach(group => {
        barGroups.append("rect")
            .attr("class", "mark value") // 'mark' and 'value' for data element
            .attr("x", d => groupScale(group))
            .attr("y", d => yScale(d.groups[group] || 0))
            .attr("width", groupScale.bandwidth())
            .attr("height", d => Math.max(0, innerHeight - yScale(d.groups[group] || 0))) // Ensure non-negative height
            .style("fill", d => fillStyle.barCategoryColors[group] || fillStyle.defaultCategoryColor);

        // Decorative ellipse on top of bar
        barGroups.append("ellipse")
            .attr("class", "mark other decorative-ellipse") // 'mark' as it's part of the bar, 'other' for styling context
            .attr("cx", d => groupScale(group) + groupScale.bandwidth() / 2)
            .attr("cy", d => yScale(d.groups[group] || 0))
            .attr("rx", groupScale.bandwidth() / 2)
            .attr("ry", 4) // Fixed height for ellipse
            .style("fill", fillStyle.decoratorColor1)
            .style("stroke", "none");

        // Decorative triangles at the bottom
        const triangleBaseWidth = groupScale.bandwidth();
        const largeTriangleHeight = triangleBaseWidth * 0.5; // Adjusted proportion
        const smallTriangleRatio = 0.5;

        // Large triangle
        barGroups.append("path")
            .attr("class", "mark other decorative-triangle-large")
            .attr("d", d => {
                const x = groupScale(group);
                const y = innerHeight; // Base of the chart
                return `M ${x} ${y} 
                        L ${x + triangleBaseWidth} ${y} 
                        L ${x + triangleBaseWidth / 2} ${y + largeTriangleHeight} Z`;
            })
            .style("fill", fillStyle.decoratorColor1);
        
        // Small triangle
        barGroups.append("path")
            .attr("class", "mark other decorative-triangle-small")
            .attr("d", d => {
                const x = groupScale(group) + triangleBaseWidth * (1 - smallTriangleRatio) / 2;
                const y = innerHeight + largeTriangleHeight * (1 - smallTriangleRatio); // Position relative to large triangle
                return `M ${x} ${y} 
                        L ${x + triangleBaseWidth * smallTriangleRatio} ${y} 
                        L ${x + (triangleBaseWidth * smallTriangleRatio) / 2} ${y + largeTriangleHeight * smallTriangleRatio} Z`;
            })
            .style("fill", fillStyle.decoratorColor2);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No additional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
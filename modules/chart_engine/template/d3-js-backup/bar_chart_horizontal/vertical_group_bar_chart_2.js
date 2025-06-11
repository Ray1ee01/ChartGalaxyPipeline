/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Group Bar Chart",
  "chart_name": "vertical_group_bar_chart_14",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 4], [0, "inf"], [2, 2]],
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
    const chartDataArray = data.data.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assumes data.colors for light theme, or data.colors_dark if specified
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldConfig = dataColumns.find(col => col.role === xFieldRole);
    const yFieldConfig = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldConfig = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldConfig?.name;
    const yFieldName = yFieldConfig?.name;
    const groupFieldName = groupFieldConfig?.name;

    let xFieldUnit = xFieldConfig?.unit !== "none" ? xFieldConfig?.unit : "";
    let yFieldUnit = yFieldConfig?.unit !== "none" ? yFieldConfig?.unit : "";
    // let groupFieldUnit = groupFieldConfig?.unit !== "none" ? groupFieldConfig?.unit : ""; // Not used

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push("x field (role: 'x')");
        if (!yFieldName) missingFields.push("y field (role: 'y')");
        if (!groupFieldName) missingFields.push("group field (role: 'group')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF',
        groupColors: {}
    };

    const estimateTextWidth = (text, fontSize = '12px', fontFamily = 'Arial, sans-serif', fontWeight = 'normal') => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in DOM.
        // For this implementation, we avoid DOM append for pure in-memory calculation.
        // document.body.appendChild(svg);
        const width = textElement.getBBox().width;
        // document.body.removeChild(svg);
        return width;
    };
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 60 };
    if (variables.dynamic_margins) { // Example of a variable that might adjust margins
        // This section could adjust margins based on label lengths, legend size etc.
        // For this refactor, keeping it simple.
    }
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName])));

    // Populate fillStyle.groupColors
    groups.forEach((group, index) => {
        if (colors.field && colors.field[groupFieldName] && colors.field[groupFieldName][group]) {
            fillStyle.groupColors[group] = colors.field[groupFieldName][group];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            fillStyle.groupColors[group] = colors.available_colors[index % colors.available_colors.length];
        } else {
            // Fallback to colors.other.primary/secondary for the first two groups if available
            if (index === 0) {
                fillStyle.groupColors[group] = colors.other?.primary || '#1f77b4'; // Default primary
            } else if (index === 1) {
                fillStyle.groupColors[group] = colors.other?.secondary || '#ff7f0e'; // Default secondary
            } else {
                // Cycle through a small set of defaults for more than 2 groups if no other colors provided
                const defaultColorCycle = ['#2ca02c', '#d62728', '#9467bd', '#8c564b'];
                fillStyle.groupColors[group] = defaultColorCycle[(index - 2) % defaultColorCycle.length];
            }
        }
    });
    
    const processedData = chartDataArray.reduce((acc, d) => {
        const category = d[xFieldName];
        const group = d[groupFieldName];
        const value = +d[yFieldName];
        
        let existingCategory = acc.find(item => item.category === category);
        if (!existingCategory) {
            existingCategory = { category: category, groups: {} };
            groups.forEach(g => existingCategory.groups[g] = 0); // Initialize all groups for consistent structure
            acc.push(existingCategory);
        }
        existingCategory.groups[group] = value;
        return acc;
    }, []);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.4);

    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, xScale.bandwidth()])
        .padding(0.05); // Small padding between bars in a group

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => +d[yFieldName]) || 10]) // Ensure domain is at least 0-10
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
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
        .each(function() {
            const textElement = d3.select(this);
            const textContent = textElement.text();
            const estimatedWidth = estimateTextWidth(
                textContent, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontWeight
            );
            if (estimatedWidth > xScale.bandwidth() * 0.9) { // Allow some tolerance
                textElement
                    .style("text-anchor", "end")
                    .attr("dx", "-.8em")
                    .attr("dy", ".15em")
                    .attr("transform", "rotate(-45)");
            } else {
                textElement.style("text-anchor", "middle");
            }
        });
    xAxisGroup.select(".domain").style("stroke", fillStyle.textColor);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : '')).tickSize(0).tickPadding(10));

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label");
    yAxisGroup.select(".domain").style("stroke", fillStyle.textColor);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barCategoryGroups = mainChartGroup.selectAll(".bar-category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "mark bar-category-group")
        .attr("transform", d => `translate(${xScale(d.category)},0)`);

    const reversedGroups = [...groups].reverse(); // To control drawing order for skewed effect

    reversedGroups.forEach(groupKey => {
        barCategoryGroups.append("path")
            .attr("class", "mark value bar")
            .attr("d", d => {
                const xPos = groupScale(groupKey) - groupScale.bandwidth() * 0.2;
                const yPos = yScale(d.groups[groupKey] || 0);
                const barWidth = groupScale.bandwidth() * 1.8;
                const barHeight = innerHeight - yScale(d.groups[groupKey] || 0);
                const skewOffset = barWidth * 0.25;

                if (barHeight <= 0) return ""; // Avoid drawing zero-height or negative bars

                return `
                    M ${xPos} ${yPos}
                    L ${xPos + barWidth} ${yPos + (barHeight > skewOffset ? skewOffset : 0)} 
                    L ${xPos + barWidth} ${yPos + barHeight}
                    L ${xPos} ${yPos + barHeight - (barHeight > skewOffset ? skewOffset : 0)}
                    Z
                `;
            })
            .attr("fill", fillStyle.groupColors[groupKey]);

        // Value labels
        barCategoryGroups.append("text")
            .attr("class", "label value data-label")
            .attr("x", d => groupScale(groupKey) + groupScale.bandwidth() * 0.7) // Centered on the skewed bar
            .attr("y", d => yScale(d.groups[groupKey] || 0) - 8)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily) // Using annotation for data labels
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => {
                const val = d.groups[groupKey] || 0;
                if (val === 0 && (yScale(val) > innerHeight - 20)) return ""; // Don't show label if bar is too small or zero
                return formatValue(val) + (yFieldUnit ? `${yFieldUnit}` : '');
            });
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
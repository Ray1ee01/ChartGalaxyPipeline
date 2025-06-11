/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldConfig = dataColumns.find(col => col.role === "x");
    const yFieldConfig = dataColumns.find(col => col.role === "y");

    if (!xFieldConfig || !xFieldConfig.name) {
        console.error("Critical chart config missing: X-axis field name (role 'x'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (X-axis field name not defined in data.data.columns with role 'x').</div>");
        return null;
    }
    if (!yFieldConfig || !yFieldConfig.name) {
        console.error("Critical chart config missing: Y-axis field name (role 'y'). Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Y-axis field name not defined in data.data.columns with role 'y').</div>");
        return null;
    }

    const categoryFieldName = xFieldConfig.name;
    const valueFieldName = yFieldConfig.name;
    const categoryFieldUnit = xFieldConfig.unit !== "none" ? xFieldConfig.unit : "";
    const valueFieldUnit = yFieldConfig.unit !== "none" ? yFieldConfig.unit : "";

    if (!chartDataArray || chartDataArray.length === 0) {
        console.warn("Chart data is empty. Rendering an empty chart area.");
        // Optionally, render a message in the container
        // d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No data available to display.</div>");
        // return null; // Or proceed to render an empty chart structure
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        barPrimaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1d6b64',
        valueLabelColorInside: '#FFFFFF', // Standard white for text inside bars
        iconBorderColor: '#000000',
        chartBackground: colorsConfig.background_color || '#FFFFFF' // Not directly used for chart background, but for consistency
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        document.body.appendChild(tempSvg); // Needs to be in DOM for getBBox to work reliably
        const width = tempTextElement.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    let baseContainerHeight = chartConfig.height || 600;

    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const containerHeight = uniqueCategories.length > 15
        ? baseContainerHeight * (1 + (uniqueCategories.length - 15) * 0.03)
        : baseContainerHeight;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const defs = svgRoot.append("defs");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const rankingNumberWidth = 25; // Approx width for "XX."
    const iconSize = 30; // Fixed icon size
    const iconPadding = 7;

    let maxCategoryLabelWidth = 0;
    uniqueCategories.forEach(cat => {
        const formattedCategory = categoryFieldUnit ? `${cat}${categoryFieldUnit}` : `${cat}`;
        const width = estimateTextWidth(formattedCategory, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxCategoryLabelWidth) maxCategoryLabelWidth = width;
    });

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const value = +d[valueFieldName];
        const formattedVal = `${formatValue(value)}${valueFieldUnit}`;
        const width = estimateTextWidth(formattedVal, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        if (width > maxValueLabelWidth) maxValueLabelWidth = width;
    });
    
    const chartMargins = {
        top: 20, // Reduced as no main title
        right: Math.max(20, maxValueLabelWidth + 10), // Space for value labels outside bars
        bottom: 20,
        left: Math.max(40, rankingNumberWidth + maxCategoryLabelWidth + iconSize + iconPadding * 2) // Space for rank, label, icon
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated inner dimensions are not positive. Check container size and margins.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Chart dimensions are too small to render.</div>");
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataArray].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    const sortedCategories = sortedChartData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(0.2); // Fixed padding

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedChartData, d => +d[valueFieldName]) * 1.05 || 1]) // Ensure domain max is at least 1
        .range([0, innerWidth]);

    const minVal = d3.min(sortedChartData, d => +d[valueFieldName]);
    const maxVal = d3.max(sortedChartData, d => +d[valueFieldName]);
    
    const colorScale = d3.scaleLinear()
        .domain([minVal || 0, maxVal || 1]) // Handle cases with single data point or all same values
        .range([d3.rgb(fillStyle.barPrimaryColor).brighter(0.5), d3.rgb(fillStyle.barPrimaryColor).darker(0.5)]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // No axes or gridlines as per original and requirements.

    // Block 8: Main Data Visualization Rendering
    sortedChartData.forEach((d, i) => {
        const category = d[categoryFieldName];
        const value = +d[valueFieldName];
        const barY = yScale(category);

        if (barY === undefined) { // Skip if category not in scale (e.g. after filtering/empty)
            console.warn(`Category "${category}" not found in yScale domain. Skipping bar.`);
            return;
        }

        const barHeight = yScale.bandwidth();
        const barWidth = xScale(value);
        const barColor = (sortedChartData.length > 1 && minVal !== maxVal) ? colorScale(value) : fillStyle.barPrimaryColor;

        mainChartGroup.append("rect")
            .attr("class", "mark bar")
            .attr("x", 0)
            .attr("y", barY)
            .attr("width", Math.max(0, barWidth)) // Ensure width is not negative
            .attr("height", barHeight)
            .attr("fill", barColor);

        // Value Label
        const formattedValueText = `${formatValue(value)}${valueFieldUnit}`;
        const valueLabelWidth = estimateTextWidth(formattedValueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        const textFitsInside = barWidth > valueLabelWidth + 10; // 10px padding

        mainChartGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", textFitsInside ? barWidth - 5 : barWidth + 5)
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", textFitsInside ? "end" : "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", textFitsInside ? fillStyle.valueLabelColorInside : fillStyle.textColor)
            .text(formattedValueText);

        // Category Label, Rank, Icon (Block 9 elements rendered here for locality with bar)
        const iconXPosition = -iconSize - iconPadding;
        const categoryLabelXPosition = iconXPosition - iconPadding; // To the left of icon
        const rankXPosition = categoryLabelXPosition - maxCategoryLabelWidth - iconPadding;


        // Rank Number
        mainChartGroup.append("text")
            .attr("class", "label rank-label")
            .attr("x", rankXPosition + maxCategoryLabelWidth) // Effectively rankXPosition, but align to right of its allocated space
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${i + 1}.`);
            
        // Category Label
        const formattedCategoryText = categoryFieldUnit ? `${category}${categoryFieldUnit}` : `${category}`;
        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", categoryLabelXPosition)
            .attr("y", barY + barHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedCategoryText);

        // Icon (Part of Block 9 logic, placed here for grouping with bar elements)
        const iconUrl = imagesConfig.field && imagesConfig.field[category] ? imagesConfig.field[category] : null;
        if (iconUrl) {
            const clipId = `clip-icon-${categoryFieldName}-${i}`;
            const iconDisplaySize = Math.min(barHeight * 0.8, iconSize); // Ensure icon fits bar height
            const clipRadius = (iconDisplaySize / 2) * 0.9; // Slightly smaller for border visibility

            defs.append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", iconDisplaySize / 2)
                .attr("cy", iconDisplaySize / 2)
                .attr("r", clipRadius);

            const iconGroup = mainChartGroup.append("g")
                .attr("class", "icon-group")
                .attr("transform", `translate(${iconXPosition}, ${barY + (barHeight - iconDisplaySize) / 2})`);

            iconGroup.append("circle") // Border
                .attr("class", "icon-border other")
                .attr("cx", iconDisplaySize / 2)
                .attr("cy", iconDisplaySize / 2)
                .attr("r", clipRadius + 0.5) // Border slightly larger than clip
                .attr("fill", "none")
                .attr("stroke", fillStyle.iconBorderColor)
                .attr("stroke-width", 0.5);

            iconGroup.append("image")
                .attr("class", "icon category-icon image")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", iconDisplaySize)
                .attr("height", iconDisplaySize)
                .attr("xlink:href", iconUrl)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("clip-path", `url(#${clipId})`);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Icon rendering logic is integrated into Block 8 for better data binding context.
    // No other enhancements like complex interactions are required.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
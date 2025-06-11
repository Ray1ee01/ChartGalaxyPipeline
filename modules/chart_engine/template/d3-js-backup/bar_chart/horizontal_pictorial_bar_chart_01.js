/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data ? data.data.data : []; // Actual data points array
    const config = data.variables || {};  // Chart-specific settings
    const userTypography = data.typography || {};
    const userColors = data.colors || (data.colors_dark || {}); // Allow for dark theme colors
    const images = data.images || {};
    const dataColumns = data.data ? data.data.columns || [] : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldCol = dataColumns.find(col => col.role === "x");
    const valueFieldCol = dataColumns.find(col => col.role === "y");

    let missingFieldsMessages = [];
    if (!categoryFieldCol) missingFieldsMessages.push("column with role 'x'");
    if (!valueFieldCol) missingFieldsMessages.push("column with role 'y'");
    
    const categoryFieldName = categoryFieldCol ? categoryFieldCol.name : undefined;
    const valueFieldName = valueFieldCol ? valueFieldCol.name : undefined;

    if (!categoryFieldName) missingFieldsMessages.push("name for 'x'-role column");
    if (!valueFieldName) missingFieldsMessages.push("name for 'y'-role column");
    
    // Remove duplicates, e.g. if col is missing, its name will also be missing.
    missingFieldsMessages = [...new Set(missingFieldsMessages)];


    if (missingFieldsMessages.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFieldsMessages.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>Error: ${errorMsg}</div>`);
        }
        return null;
    }

    const categoryUnit = categoryFieldCol && categoryFieldCol.unit !== "none" ? categoryFieldCol.unit : "";
    const valueUnit = valueFieldCol && valueFieldCol.unit !== "none" ? valueFieldCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    const defaultFontStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (userTypography.title && userTypography.title.font_family) || defaultFontStyles.title.font_family;
    fillStyle.typography.titleFontSize = (userTypography.title && userTypography.title.font_size) || defaultFontStyles.title.font_size;
    fillStyle.typography.titleFontWeight = (userTypography.title && userTypography.title.font_weight) || defaultFontStyles.title.font_weight;
    fillStyle.typography.labelFontFamily = (userTypography.label && userTypography.label.font_family) || defaultFontStyles.label.font_family;
    fillStyle.typography.labelFontSize = (userTypography.label && userTypography.label.font_size) || defaultFontStyles.label.font_size;
    fillStyle.typography.labelFontWeight = (userTypography.label && userTypography.label.font_weight) || defaultFontStyles.label.font_weight;
    fillStyle.typography.annotationFontFamily = (userTypography.annotation && userTypography.annotation.font_family) || defaultFontStyles.annotation.font_family;
    fillStyle.typography.annotationFontSize = (userTypography.annotation && userTypography.annotation.font_size) || defaultFontStyles.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (userTypography.annotation && userTypography.annotation.font_weight) || defaultFontStyles.annotation.font_weight;
    
    const defaultColors = {
        text_color: '#0f223b',
        primary: '#1f77b4',
        secondary: '#ff7f0e',
        background_color: '#FFFFFF',
        available_colors: d3.schemeCategory10
    };

    fillStyle.textColor = userColors.text_color || defaultColors.text_color;
    fillStyle.chartBackground = userColors.background_color || defaultColors.background_color;
    fillStyle.primaryAccent = (userColors.other && userColors.other.primary) || defaultColors.primary;
    fillStyle.secondaryAccent = (userColors.other && userColors.other.secondary) || defaultColors.secondary;
    
    // This utility is defined as per requirements but not actively used by this specific chart's rendering logic.
    // If it were used (e.g., for dynamic label truncation or margin calculation), its accuracy under the strict
    // "MUST NOT be appended to the document DOM" constraint for its temporary SVG would be critical.
    function estimateTextWidth(text, fontProps) {
        if (text === null || typeof text === 'undefined' || String(text).length === 0) return 0;
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontProps.font_family || defaultFontStyles.label.font_family);
        tempTextElement.setAttribute('font-size', fontProps.font_size || defaultFontStyles.label.font_size);
        tempTextElement.setAttribute('font-weight', fontProps.font_weight || defaultFontStyles.label.font_weight);
        tempTextElement.textContent = String(text);
        
        // The temporary SVG is not appended to the main document DOM, as per requirements.
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.appendChild(tempTextElement);

        let width = 0;
        try {
            // getBBox on an element not attached to the DOM (or not rendered) might return 0 or throw.
            width = tempTextElement.getBBox().width;
            if (width === 0 && String(text).length > 0) {
                // Fallback for environments where getBBox on detached returns 0.
                // getComputedTextLength is sometimes more forgiving for text nodes.
                if (typeof tempTextElement.getComputedTextLength === 'function') {
                    width = tempTextElement.getComputedTextLength();
                }
                // If still 0, use a rough heuristic as a last resort.
                if (width === 0 && String(text).length > 0) {
                    const fontSizePx = parseFloat(fontProps.font_size || defaultFontStyles.label.font_size) || 12;
                    width = String(text).length * fontSizePx * 0.6; // Heuristic
                }
            }
        } catch (e) {
            // console.warn("estimateTextWidth failed:", e);
            const fontSizePx = parseFloat(fontProps.font_size || defaultFontStyles.label.font_size) || 12;
            width = String(text).length * fontSizePx * 0.6; // Heuristic on error
        }
        return width;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink") // Required for xlink:href
        .style("background-color", fillStyle.chartBackground); // Apply background color to SVG

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 30, bottom: 80, left: 40 }; // Original margins
    // Adjust left margin based on longest Y-axis label dynamically if needed (not done in original, complex)
    // For now, using fixed margins. If Y-axis labels are too long, they might get cut.
    // A more robust solution would use estimateTextWidth for Y-axis labels to adjust chartMargins.left.
    // This chart's original left margin was 40. Let's make it a bit more generous if Y labels are long.
    // However, for strict adherence, if not in original, don't add complex dynamic margin logic now.
    // The original used a fixed left margin of 40. Let's increase it slightly as a fixed value for safety.
    chartMargins.left = config.dynamicLeftMargin ? 120 : 60; // Example of a configurable larger margin
                                                            // For this refactor, stick to original if not specified
    chartMargins.left = 40; // Reverting to original fixed value.

    // If Y-axis labels are very long, they might need more space.
    // This simple chart doesn't dynamically adjust margins for labels.
    // We can estimate max label width and adjust, but that's an enhancement.
    // For now, keep original margins.
    // const maxCategoryLabelWidth = d3.max(chartDataInput, d => estimateTextWidth(d[categoryFieldName], {font_family: fillStyle.typography.labelFontFamily, font_size: fillStyle.typography.labelFontSize, font_weight: fillStyle.typography.labelFontWeight}));
    // chartMargins.left = Math.max(chartMargins.left, (maxCategoryLabelWidth || 0) + 10);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName],
        icon: images.field && images.field[d[categoryFieldName]] ? images.field[d[categoryFieldName]] : null
    }))
    .filter(d => d.icon) // Only include data points that have an icon URL
    .sort((a, b) => b.value - a.value); // Sort by value descending

    if (chartDataArray.length === 0) {
        const errorMsg = "No data available to render after filtering for icons or initial data is empty.";
        console.warn(errorMsg);
        mainChartGroup.append("text")
            .attr("class", "text error-message")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text(images.field ? "No data with valid images." : "No data provided.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartDataArray, d => d.value) || 0]) // Add || 0 for robustness with empty/all-zero data
        .range([0, innerWidth])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const yAxisGenerator = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10); // Space between tick and label

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);

    yAxisGroup.select(".domain").remove(); // Remove axis line

    yAxisGroup.selectAll("text")
        .attr("class", "text axis-label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    // X-axis is "none" as per metadata, so it's not rendered.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const imageBarElements = mainChartGroup.selectAll(".image-bar")
        .data(chartDataArray)
        .enter()
        .append("image")
        .attr("class", "mark image-bar")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("height", yScale.bandwidth())
        .attr("width", d => xScale(d.value))
        .attr("preserveAspectRatio", "none") // Stretch image to fill bar dimensions
        .attr("xlink:href", d => d.icon);

    const valueLabelElements = mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("x", d => xScale(d.value) + 5) // Position 5px to the right of the bar
        .attr("dy", ".35em") // Vertical alignment
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start") // Align text start to the x position
        .text(d => `${d.value}${valueUnit ? ` ${valueUnit}` : ''}`);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
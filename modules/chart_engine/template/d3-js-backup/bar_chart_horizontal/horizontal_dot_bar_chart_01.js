/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Dot Bar Chart",
  "chart_name": "horizontal_dot_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {}; // Not used in this chart, but parsed for consistency
    const dataColumnsInput = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldRole = "x";
    const valueFieldRole = "y";

    const categoryColumn = dataColumnsInput.find(col => col.role === categoryFieldRole);
    const valueColumn = dataColumnsInput.find(col => col.role === valueFieldRole);

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field name (role 'x') not found in data.data.columns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (category field).</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field name (role 'y') not found in data.data.columns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (value field).</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;
    const categoryFieldUnit = categoryColumn.unit && categoryColumn.unit !== "none" ? categoryColumn.unit : "";
    const valueFieldUnit = valueColumn.unit && valueColumn.unit !== "none" ? valueColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'normal',
        },
        colors: {
            textColor: colorsInput.text_color || '#333333',
            primaryDotColor: (colorsInput.other && colorsInput.other.primary) || '#FFBB33', // Default orange-yellow
            chartBackground: colorsInput.background_color || '#FFFFFF',
        },
        images: {} // Placeholder for images if they were used
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden';
        svg.style.position = 'absolute';
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        document.body.appendChild(svg); // Needs to be in DOM for getBBox to work reliably cross-browser
        const width = textElement.getBBox().width;
        document.body.removeChild(svg);
        return width;
    }

    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.colors.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 30, bottom: 20, left: 100 }; // Initial margins

    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const labelText = `${d[categoryFieldName]}${categoryFieldUnit}`;
        const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        if (width > maxCategoryLabelWidth) {
            maxCategoryLabelWidth = width;
        }
    });
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 15); // 15 for padding

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const labelText = `${formatValue(d[valueFieldName])}${valueFieldUnit}`;
        const width = estimateTextWidth(labelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        if (width > maxValueLabelWidth) {
            maxValueLabelWidth = width;
        }
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15); // 15 for padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const dotRadius = 4;
    const dotDiameter = dotRadius * 2;
    const dotPadding = 2; // Horizontal space between dots

    // Block 5: Data Preprocessing & Transformation
    let processedChartData = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy

    const displayValueField = `${valueFieldName}_displayCount`;
    const maxValueInData = d3.max(processedChartData, d => +d[valueFieldName]);

    processedChartData.forEach(d => {
        const originalValue = +d[valueFieldName];
        if (maxValueInData > 100) {
            d[displayValueField] = Math.max(1, Math.floor(originalValue / maxValueInData * 50));
        } else {
            d[displayValueField] = Math.max(0, Math.round(originalValue)); // Use original value, rounded, if all are <=100
        }
    });
    
    const sortedData = processedChartData.sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const categories = sortedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.3);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No explicit axes, gridlines, or legend for this chart type as per requirements.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const rowGroups = mainChartGroup.selectAll(".row-group")
        .data(sortedData, d => d[categoryFieldName])
        .join("g")
        .attr("class", "row-group")
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    // Category Labels
    rowGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", -10) // Position to the left of the y-axis line (implicit)
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => `${d[categoryFieldName]}${categoryFieldUnit}`);

    // Dots (Circles)
    rowGroups.each(function(d_row) {
        const numDots = d_row[displayValueField];
        const dotGroup = d3.select(this).append("g").attr("class", "dots-group");
        for (let i = 0; i < numDots; i++) {
            dotGroup.append("circle")
                .attr("class", "mark dot-mark")
                .attr("cx", i * (dotDiameter + dotPadding) + dotRadius)
                .attr("cy", yScale.bandwidth() / 2)
                .attr("r", dotRadius)
                .style("fill", fillStyle.colors.primaryDotColor);
        }
    });

    // Value Labels
    rowGroups.append("text")
        .attr("class", "value value-label")
        .attr("x", d => {
            const numDots = d[displayValueField];
            return numDots * (dotDiameter + dotPadding) + dotRadius + 5; // Position after the last dot + padding
        })
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => `${formatValue(d[valueFieldName])}${valueFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements like annotations or complex interactions in this refactor.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
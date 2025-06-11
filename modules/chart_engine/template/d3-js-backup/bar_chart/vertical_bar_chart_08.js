/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // This function creates a vertical bar chart.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data;
    const chartData = chartConfig.data && chartConfig.data.data ? chartConfig.data.data : [];
    const variables = chartConfig.variables || {};
    const typographyConfig = chartConfig.typography || {};
    const colorsConfig = chartConfig.colors || chartConfig.colors_dark || {}; // Assuming colors_dark is an alternative
    const imagesConfig = chartConfig.images || {};
    const dataColumns = chartConfig.data && chartConfig.data.columns ? chartConfig.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    if (!xColumn || !yColumn) {
        const missing = [];
        if (!xColumn) missing.push("x field");
        if (!yColumn) missing.push("y field");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const xField = xColumn.name;
    const yField = yColumn.name;
    const yUnit = (yColumn.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'bold',
        },
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        textColor: colorsConfig.text_color || '#0f223b',
        primaryAccent: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4',
        axisLineColor: '#e0e0e0',
        defaultBarColor: '#cccccc',
    };

    fillStyle.getBarColor = (categoryValue, index) => {
        if (colorsConfig.field && colorsConfig.field[categoryValue]) {
            return colorsConfig.field[categoryValue];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return fillStyle.primaryAccent;
    };

    fillStyle.getIconUrl = (categoryValue) => {
        if (imagesConfig.field && imagesConfig.field[categoryValue]) {
            return imagesConfig.field[categoryValue];
        }
        if (imagesConfig.other && imagesConfig.other.primary) { // Fallback to a generic primary icon if specified
            return imagesConfig.other.primary;
        }
        return null;
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if SVG is fully defined,
        // but some browsers might be more reliable if it's briefly in DOM.
        // However, per spec, it should work off-DOM. For strict adherence to "MUST NOT be appended":
        // document.body.appendChild(tempSvg); // Not appending to DOM as per directive
        const width = tempText.getBBox().width;
        // tempSvg.remove(); // if appended
        return width;
    }
    
    const formatValue = (value) => {
        if (value === null || value === undefined) return "";
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More robust abbreviation
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // General format for smaller numbers
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
    const iconHeight = 24;
    const iconPadding = 6;
    const xAxisLabelHeight = parseFloat(fillStyle.typography.labelFontSize) + 5; // Approx height for one line
    const xAxisLinePadding = 10;
    const valueLabelOffset = 20; // Space above bars for value labels

    const chartMargins = {
        top: valueLabelOffset + 10, // Space for value labels
        right: 20,
        bottom: xAxisLabelHeight + iconHeight + iconPadding + xAxisLinePadding + 10, // For x-labels, icons, line
        left: 40 // Minimal left margin
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartData.map(d => ({
        xValue: d[xField],
        yValue: +d[yField] || 0 // Ensure yValue is a number, default to 0 if parsing fails
    })).sort((a, b) => b.yValue - a.yValue); // Sort descending by yValue

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.xValue))
        .range([0, innerWidth])
        .padding(0.2);

    const yMax = d3.max(processedData, d => d.yValue);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 10]) // Add 10% headroom, or use 10 if max is 0
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // X-axis line (minimal axis representation)
    mainChartGroup.append("line")
        .attr("class", "axis x-axis-line")
        .attr("x1", 0)
        .attr("y1", innerHeight + xAxisLinePadding / 2)
        .attr("x2", innerWidth)
        .attr("y2", innerHeight + xAxisLinePadding / 2)
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d.xValue))
        .attr("y", d => yScale(d.yValue))
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.max(0, innerHeight - yScale(d.yValue))) // Ensure non-negative height
        .attr("fill", (d, i) => fillStyle.getBarColor(d.xValue, i));

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)

    // Value labels (Annotations)
    mainChartGroup.selectAll(".value-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label value")
        .attr("x", d => xScale(d.xValue) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.yValue) - 5) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${formatValue(d.yValue)}${yUnit}`);

    // X-Axis Dimension Labels
    const xLabelsGroup = mainChartGroup.append("g")
        .attr("class", "x-axis-labels-group")
        .attr("transform", `translate(0, ${innerHeight + xAxisLinePadding + (parseFloat(fillStyle.typography.labelFontSize) * 0.71)})`); // Position below the line

    xLabelsGroup.selectAll(".x-axis-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d.xValue) + xScale.bandwidth() / 2)
        .attr("y", 0) // Relative to xLabelsGroup
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            const labelText = String(d.xValue);
            const availableWidth = xScale.bandwidth();
            // Simple truncation if label is too long
            if (availableWidth <=0) return "";
            let textWidth = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.labelFontFamily,
                fontSize: fillStyle.typography.labelFontSize,
                fontWeight: fillStyle.typography.labelFontWeight
            });
            if (textWidth > availableWidth) {
                let truncatedText = labelText;
                while (textWidth > availableWidth && truncatedText.length > 0) {
                    truncatedText = truncatedText.slice(0, -1);
                     textWidth = estimateTextWidth(truncatedText + "...", {
                        fontFamily: fillStyle.typography.labelFontFamily,
                        fontSize: fillStyle.typography.labelFontSize,
                        fontWeight: fillStyle.typography.labelFontWeight
                    });
                }
                return truncatedText.length > 1 ? truncatedText + "..." : ""; // Avoid just "..."
            }
            return labelText;
        });

    // Icons
    const iconsGroup = mainChartGroup.append("g")
        .attr("class", "icons-group")
        .attr("transform", `translate(0, ${innerHeight + xAxisLinePadding + xAxisLabelHeight + iconPadding})`); // Position below x-labels

    iconsGroup.selectAll(".icon-image")
        .data(processedData)
        .enter()
        .filter(d => fillStyle.getIconUrl(d.xValue) !== null) // Only create image if URL exists
        .append("image")
        .attr("class", "icon image")
        .attr("xlink:href", d => fillStyle.getIconUrl(d.xValue))
        .attr("x", d => xScale(d.xValue) + xScale.bandwidth() / 2 - iconHeight / 2)
        .attr("y", 0) // Relative to iconsGroup
        .attr("width", iconHeight)
        .attr("height", iconHeight)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
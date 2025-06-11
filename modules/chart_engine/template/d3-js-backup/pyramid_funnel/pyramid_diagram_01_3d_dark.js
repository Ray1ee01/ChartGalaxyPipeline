/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Diagram",
  "chart_name": "pyramid_diagram_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawVariables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {}; // Accommodate dark theme colors if provided
    const rawImages = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === "x");
    const valueColumn = dataColumns.find(col => col.role === "y");

    if (!categoryColumn || !valueColumn) {
        const missing = [];
        if (!categoryColumn) missing.push("x-role column");
        if (!valueColumn) missing.push("y-role column");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    if (chartDataArray.length === 0) {
        d3.select(containerSelector).html("<div style='color:grey; font-family: sans-serif;'>No data to display.</div>");
        return null;
    }
    
    // Filter out data points with invalid or non-numeric values for the value field
    chartDataArray = chartDataArray.filter(d => typeof d[valueFieldName] === 'number' && !isNaN(d[valueFieldName]));


    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        field: {},
        other: { primary: "#4682B4", secondary: "#FF7F50" },
        available_colors: [...d3.schemeCategory10],
        background_color: "#FFFFFF",
        text_color: "#333333"
    };
    
    const effectiveColors = {
        field: rawColors.field || defaultColors.field,
        other: { ...defaultColors.other, ...(rawColors.other || {}) },
        available_colors: rawColors.available_colors && rawColors.available_colors.length > 0 ? rawColors.available_colors : defaultColors.available_colors,
        background_color: rawColors.background_color || defaultColors.background_color,
        text_color: rawColors.text_color || defaultColors.text_color
    };

    const fillStyle = {
        chartBackground: effectiveColors.background_color,
        textColor: effectiveColors.text_color,
        labelColor: effectiveColors.text_color,
        segmentLabelColor: '#FFFFFF', // Default for labels inside segments
        connectorLineColor: '#CCCCCC',
        typography: {
            title: {
                font_family: (rawTypography.title && rawTypography.title.font_family) || defaultTypography.title.font_family,
                font_size: (rawTypography.title && rawTypography.title.font_size) || defaultTypography.title.font_size,
                font_weight: (rawTypography.title && rawTypography.title.font_weight) || defaultTypography.title.font_weight,
            },
            label: { // Used for category labels and data labels in this chart
                font_family: (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family,
                font_size: (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size,
                font_weight: (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight,
            },
            annotation: {
                font_family: (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family,
                font_size: (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size,
                font_weight: (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight,
            }
        },
        getSegmentColor: (categoryName, index) => {
            if (effectiveColors.field && effectiveColors.field[categoryName]) {
                return effectiveColors.field[categoryName];
            }
            if (effectiveColors.available_colors && effectiveColors.available_colors.length > 0) {
                return effectiveColors.available_colors[index % effectiveColors.available_colors.length];
            }
            const scheme = d3.schemeCategory10; // Default scheme
            return scheme[index % scheme.length];
        }
    };

    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const { font_family, font_size, font_weight } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', font_family);
        tempText.setAttribute('font-size', font_size);
        tempText.setAttribute('font-weight', font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // No need to append to DOM for getBBox to work
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail
            const size = parseInt(font_size, 10) || 12;
            return text.length * size * 0.6; // Rough estimate
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = rawVariables.width || 800;
    const containerHeight = rawVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "pyramid-chart-svg")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 40, right: 40, bottom: 40, left: 160 }; // Adjusted right margin

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const pyramidMaxWidth = innerWidth * 0.7; // Max width of the pyramid base
    const pyramidMaxHeight = innerHeight * 0.9; // Max height of the pyramid

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);
    if (totalValue === 0 && sortedData.length > 0) { // Handle case where all values are zero
        d3.select(containerSelector).html("<div style='color:grey; font-family: sans-serif;'>All data values are zero. Cannot render pyramid.</div>");
        return null;
    }


    let currentPyramidY = 0;
    const pyramidSegments = sortedData.map(d => {
        const value = d[valueFieldName];
        const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
        const segmentHeight = totalValue > 0 ? (value / totalValue) * pyramidMaxHeight : (pyramidMaxHeight / sortedData.length);


        const yBottom = currentPyramidY;
        const yTop = currentPyramidY + segmentHeight;

        // Width decreases linearly from base (y=0) to tip (y=pyramidMaxHeight)
        const widthBottom = pyramidMaxWidth * (1 - yBottom / pyramidMaxHeight);
        const widthTop = pyramidMaxWidth * (1 - yTop / pyramidMaxHeight);
        
        currentPyramidY = yTop;

        return {
            data: d,
            value: value,
            percent: percent,
            yBottom: yBottom,
            yTop: yTop,
            widthBottom: Math.max(0, widthBottom), // Ensure non-negative width
            widthTop: Math.max(0, widthTop)        // Ensure non-negative width
        };
    });

    const verticalOffset = (innerHeight - pyramidMaxHeight) / 2; // To center pyramid vertically

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales needed for this specific pyramid geometry calculation.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const categoryLabelsGroup = mainChartGroup.append("g")
        .attr("class", "category-labels-group");

    pyramidSegments.forEach((segment, i) => {
        const labelY = (segment.yTop + segment.yBottom) / 2 + verticalOffset;
        const segmentMidHeight = (segment.yTop + segment.yBottom) / 2;
        const segmentMidWidth = (segment.widthTop + segment.widthBottom) / 2;
        
        // Category labels (left side)
        categoryLabelsGroup.append("text")
            .attr("class", "label category-label text")
            .attr("x", -20)
            .attr("y", labelY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .style("fill", fillStyle.labelColor)
            .text(segment.data[categoryFieldName]);

        // Connector lines
        categoryLabelsGroup.append("line")
            .attr("class", "other connector-line")
            .attr("x1", -15)
            .attr("y1", labelY)
            .attr("x2", innerWidth / 2 - segmentMidWidth / 2 - 5) // Connect to mid-height edge of segment
            .attr("y2", labelY)
            .style("stroke", fillStyle.connectorLineColor)
            .style("stroke-width", 1)
            .style("stroke-dasharray", "2,2");
    });

    // Block 8: Main Data Visualization Rendering
    const segmentsGroup = mainChartGroup.append("g")
        .attr("class", "segments-group");

    pyramidSegments.forEach((segment, i) => {
        const points = [
            [innerWidth / 2 - segment.widthTop / 2, segment.yTop + verticalOffset],
            [innerWidth / 2 + segment.widthTop / 2, segment.yTop + verticalOffset],
            [innerWidth / 2 + segment.widthBottom / 2, segment.yBottom + verticalOffset],
            [innerWidth / 2 - segment.widthBottom / 2, segment.yBottom + verticalOffset]
        ];

        segmentsGroup.append("polygon")
            .attr("class", "mark pyramid-segment")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .style("fill", fillStyle.getSegmentColor(segment.data[categoryFieldName], i));

        // Data labels (value and percentage, inside segments)
        const labelText = `${segment.value} (${segment.percent.toFixed(1)}%)`;
        const textElement = segmentsGroup.append("text")
            .attr("class", "label value-label text")
            .attr("x", innerWidth / 2)
            .attr("y", (segment.yTop + segment.yBottom) / 2 + verticalOffset)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.label.font_family)
            .style("font-size", fillStyle.typography.label.font_size)
            .style("font-weight", fillStyle.typography.label.font_weight)
            .style("fill", fillStyle.segmentLabelColor)
            .text(labelText);
        
        // Hide label if it doesn't fit
        const labelWidth = estimateTextWidth(labelText, fillStyle.typography.label);
        const segmentHeight = segment.yTop - segment.yBottom;
        const narrowestWidth = Math.min(segment.widthTop, segment.widthBottom);

        if (labelWidth > narrowestWidth * 0.9 || parseInt(fillStyle.typography.label.font_size) > segmentHeight * 0.8) {
            textElement.style("display", "none");
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
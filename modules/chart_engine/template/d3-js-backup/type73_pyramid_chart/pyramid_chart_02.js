/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Chart",
  "chart_name": "pyramid_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {}; // Not used, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name || !valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Category (x) or Value (y) field name not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing. Category or Value field not defined.</div>");
        return null;
    }
    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    const chartDataArray = chartDataInput.filter(d =>
        d[categoryFieldName] != null &&
        d[valueFieldName] != null &&
        typeof d[valueFieldName] === 'number' &&
        !isNaN(d[valueFieldName]) &&
        d[valueFieldName] >= 0 // Values for pyramid should be non-negative
    );

    if (chartDataArray.length === 0) {
        console.warn("No valid data available to render the pyramid chart after filtering.");
        d3.select(containerSelector).html("<div style='text-align:center; padding: 20px;'>No data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || 'bold',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        segmentColor: (categoryName, index) => {
            if (colorsConfig.field && colorsConfig.field[categoryName]) {
                return colorsConfig.field[categoryName];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };

    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily || fillStyle.typography.labelFontFamily);
        textElement.setAttribute('font-size', fontSize || fillStyle.typography.labelFontSize);
        textElement.setAttribute('font-weight', fontWeight || fillStyle.typography.labelFontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        try {
            return textElement.getBBox().width;
        } catch (e) {
            return (text || '').length * (parseInt(fontSize || fillStyle.typography.labelFontSize, 10) * 0.6);
        }
    }

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
        .attr("class", "chart-svg-root other"); // Standard class

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 40,
        right: variables.margin_right || 120,
        bottom: variables.margin_bottom || 40,
        left: variables.margin_left || 60
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check chart dimensions and margins.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Chart dimensions result in non-positive drawing area.</div>");
        return null;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Standard class

    const pyramidProportionWidth = typeof variables.pyramid_proportion_width === 'number' ? variables.pyramid_proportion_width : 0.6;
    const pyramidProportionHeight = typeof variables.pyramid_proportion_height === 'number' ? variables.pyramid_proportion_height : 0.6;

    const maxPyramidWidth = innerWidth * pyramidProportionWidth;
    const basePyramidHeight = innerHeight * pyramidProportionHeight; // Height of the solid pyramid material

    const segmentGap = typeof variables.segment_gap === 'number' ? variables.segment_gap : 5;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartDataArray].sort((a, b) => a[valueFieldName] - b[valueFieldName]);

    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);

    sortedData.forEach(d => {
        d.percent = totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0;
    });

    const pyramidSections = [];
    let currentPyramidHeightAccumulator = 0; // Tracks height within the 'solid' pyramid model

    if (basePyramidHeight > 0 && maxPyramidWidth > 0) { // Only calculate if pyramid can be formed
        const totalArea = maxPyramidWidth * basePyramidHeight / 2;
        sortedData.forEach((d) => {
            const areaRatio = d.percent / 100;
            const sectionArea = totalArea * areaRatio;

            const bottomPositionRatio = currentPyramidHeightAccumulator / basePyramidHeight;
            const currentSegmentBaseWidth = maxPyramidWidth * bottomPositionRatio;

            const a_quad = maxPyramidWidth / (2 * basePyramidHeight);
            const b_quad = currentSegmentBaseWidth;
            const c_quad = -2 * sectionArea;

            let h_segment = 0;
            if (a_quad === 0) { // Should not happen if basePyramidHeight > 0
                h_segment = (b_quad > 0) ? (sectionArea / b_quad) : 0;
            } else {
                const discriminant = b_quad * b_quad - 4 * a_quad * c_quad;
                if (discriminant >= 0) {
                    h_segment = (-b_quad + Math.sqrt(discriminant)) / (2 * a_quad);
                }
            }
            
            h_segment = Math.max(0, Math.min(h_segment, basePyramidHeight - currentPyramidHeightAccumulator));
            if (isNaN(h_segment)) h_segment = 0;

            const nextPyramidHeightAccumulator = currentPyramidHeightAccumulator + h_segment;
            const topPositionRatio = nextPyramidHeightAccumulator / basePyramidHeight;
            const currentSegmentTopWidth = maxPyramidWidth * topPositionRatio;

            pyramidSections.push({
                data: d,
                segmentBaseY: currentPyramidHeightAccumulator,
                segmentTopY: nextPyramidHeightAccumulator,
                segmentBaseWidth: currentSegmentBaseWidth,
                segmentTopWidth: currentSegmentTopWidth,
            });
            currentPyramidHeightAccumulator = nextPyramidHeightAccumulator;
        });
    }
    
    const actualCalculatedPyramidHeight = currentPyramidHeightAccumulator; // Sum of h_segments

    // Vertical offset centers the 'solid' part; gaps expand from this.
    const verticalOffset = (innerHeight - actualCalculatedPyramidHeight) / 2;

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales for positioning pyramid segments.

    // Block 7: Chart Component Rendering
    // No axes, gridlines, or legend for this chart.

    // Block 8: Main Data Visualization Rendering
    pyramidSections.forEach((section, i) => {
        const d = section.data;
        const color = fillStyle.segmentColor(d[categoryFieldName], i);
        const gapOffset = i * segmentGap;

        const yPosBase = section.segmentBaseY + verticalOffset + gapOffset;
        const yPosTop = section.segmentTopY + verticalOffset + gapOffset;

        const points = [
            [innerWidth / 2 - section.segmentBaseWidth / 2, yPosBase],
            [innerWidth / 2 + section.segmentBaseWidth / 2, yPosBase],
            [innerWidth / 2 + section.segmentTopWidth / 2, yPosTop],
            [innerWidth / 2 - section.segmentTopWidth / 2, yPosTop]
        ];

        mainChartGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color)
            .attr("class", "mark pyramid-segment");

        const labelY = (yPosBase + yPosTop) / 2;
        const labelX = innerWidth / 2 + Math.max(section.segmentBaseWidth, section.segmentTopWidth) / 2 + 10;
        const labelText = `${d[categoryFieldName]} ${Math.round(d.percent)}%`;

        mainChartGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(labelText)
            .attr("class", "label data-label");
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Not applicable.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
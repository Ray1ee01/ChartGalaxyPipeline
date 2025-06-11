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
  "required_other_colors": [],
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
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming light theme, or data.colors_dark if specified
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !valueColumn) {
        const missing = [];
        if (!categoryColumn) missing.push("role 'x'");
        if (!valueColumn) missing.push("role 'y'");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')} in dataColumns. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 12px;'>${errorMessage}</div>`);
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colors.background_color || '#FFFFFF',
        textColor: colors.text_color || '#333333',
        labelTextColor: colors.text_color || '#333333', // For category labels on the left
        dataLabelTextColor: '#FFFFFF', // Default for labels inside segments, assuming segments are relatively dark
        connectorLineColor: '#CCCCCC', // Softer color for connector lines
        defaultSegmentColor: '#4682B4', // Default if no other color source is found
        typography: {
            categoryLabel: {
                font_family: typography.label?.font_family || 'Arial, sans-serif',
                font_size: typography.label?.font_size || '12px',
                font_weight: typography.label?.font_weight || 'bold',
            },
            dataLabel: {
                font_family: typography.label?.font_family || 'Arial, sans-serif',
                font_size: typography.label?.font_size || '12px',
                font_weight: typography.label?.font_weight || 'bold',
            }
        }
    };

    // In-memory text measurement utility
    function estimateTextWidth(text, fontProps) {
        if (!text || !fontProps) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontProps.font_family);
        textElement.setAttribute('font-size', fontProps.font_size);
        textElement.setAttribute('font-weight', fontProps.font_weight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Must not be appended to DOM. getBBox on in-memory SVG.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail.
            const fontSizeNumeric = parseFloat(fontProps.font_size);
            width = text.length * fontSizeNumeric * 0.6; // Heuristic
            // console.warn("estimateTextWidth: getBBox failed, using heuristic.", e);
        }
        return width;
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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 160 }; // Keep original margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxPyramidWidth = innerWidth * 0.7; // Pyramid width relative to innerWidth
    const pyramidHeight = innerHeight * 0.9; // Pyramid height relative to innerHeight
    const verticalOffset = (innerHeight - pyramidHeight) / 2; // For vertical centering

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);

    const pyramidSections = [];
    let currentPyramidHeightAccumulator = 0; // Accumulates from bottom up

    sortedData.forEach(d => {
        const value = d[valueFieldName];
        const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
        const sectionHeight = totalValue > 0 ? (value / totalValue) * pyramidHeight : 0;

        const yBase = currentPyramidHeightAccumulator; // Bottom of the current segment
        const yTop = currentPyramidHeightAccumulator + sectionHeight; // Top of the current segment

        // Position relative to the pyramid's own height (0 at base, 1 at apex)
        const basePositionRatio = yBase / pyramidHeight;
        const topPositionRatio = yTop / pyramidHeight;

        // Width decreases linearly from base to apex
        const segmentBaseWidth = maxPyramidWidth * (1 - basePositionRatio);
        const segmentTopWidth = maxPyramidWidth * (1 - topPositionRatio);
        
        pyramidSections.push({
            data: d,
            value: value,
            percent: percent,
            yBaseSVG: pyramidHeight - yTop, // SVG Y-coordinate for top line of segment
            yTopSVG: pyramidHeight - yBase, // SVG Y-coordinate for bottom line of segment
            baseWidth: segmentBaseWidth,
            topWidth: segmentTopWidth,
            height: sectionHeight
        });
        currentPyramidHeightAccumulator += sectionHeight;
    });
    // After this, pyramidSections are ordered from largest (bottom) to smallest (top)
    // but their yBaseSVG and yTopSVG are calculated for top-down SVG rendering.
    // Let's adjust y-coordinates to be relative to the top of the pyramid area.
    // The previous calculation was correct for SVG: yBaseSVG is higher on screen (smaller value) than yTopSVG.
    // Let's rename for clarity: segmentY_logicalTop, segmentY_logicalBottom
    // And then add verticalOffset.
    
    const finalPyramidSections = pyramidSections.map(s => ({
        ...s,
        // yBaseSVG was top line of segment, yTopSVG was bottom line of segment
        // This means yBaseSVG < yTopSVG.
        // Add verticalOffset to position the whole pyramid block
        actualTopY: s.yBaseSVG + verticalOffset,
        actualBottomY: s.yTopSVG + verticalOffset,
    }));


    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales for positioning; calculations are direct.
    // Color mapping is handled in Block 8.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Category Labels (left of pyramid)
    finalPyramidSections.forEach((section, i) => {
        const categoryName = section.data[categoryFieldName];
        const labelY = (section.actualTopY + section.actualBottomY) / 2;

        mainChartGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", -15) // Position to the left of the pyramid center
            .attr("y", labelY)
            .attr("text-anchor", "end")
            .attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", fillStyle.typography.categoryLabel.font_size)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .style("fill", fillStyle.labelTextColor)
            .text(categoryName);

        // Connector lines
        const segmentVisualLeftEdge = (innerWidth / 2) - ( (section.baseWidth + section.topWidth) / 2 / 2 ); // Approx left edge of trapezoid center
        mainChartGroup.append("line")
            .attr("class", "other connector-line")
            .attr("x1", -10)
            .attr("y1", labelY)
            .attr("x2", (innerWidth / 2) - (Math.max(section.baseWidth, section.topWidth) / 2) - 5) // Connect to left of segment
            .attr("y2", labelY)
            .attr("stroke", fillStyle.connectorLineColor)
            .attr("stroke-width", 1);
    });


    // Block 8: Main Data Visualization Rendering
    finalPyramidSections.forEach((section, i) => {
        const categoryName = section.data[categoryFieldName];
        
        const segmentColor = (colors.field && colors.field[categoryName]) ? 
                             colors.field[categoryName] : 
                             (colors.available_colors ? 
                              colors.available_colors[i % colors.available_colors.length] : 
                              d3.schemeCategory10[i % 10]);


        // Pyramid Segment (Trapezoid)
        const points = [
            [(innerWidth / 2) - (section.topWidth / 2), section.actualTopY],    // Top-left
            [(innerWidth / 2) + (section.topWidth / 2), section.actualTopY],    // Top-right
            [(innerWidth / 2) + (section.baseWidth / 2), section.actualBottomY], // Bottom-right
            [(innerWidth / 2) - (section.baseWidth / 2), section.actualBottomY]  // Bottom-left
        ];

        mainChartGroup.append("polygon")
            .attr("class", "mark pyramid-segment")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .style("fill", segmentColor);

        // Data Labels (inside segments)
        const labelText = `${section.value} (${section.percent.toFixed(1)}%)`;
        const labelY = (section.actualTopY + section.actualBottomY) / 2;
        const labelX = innerWidth / 2;
        
        // Only render label if segment height is sufficient
        const segmentRenderedHeight = section.actualBottomY - section.actualTopY;
        const estLabelHeight = parseFloat(fillStyle.typography.dataLabel.font_size);

        if (segmentRenderedHeight > estLabelHeight * 1.2) { // Add some padding
             mainChartGroup.append("text")
                .attr("class", "label data-label")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.dataLabel.font_family)
                .style("font-size", fillStyle.typography.dataLabel.font_size)
                .style("font-weight", fillStyle.typography.dataLabel.font_weight)
                .style("fill", fillStyle.dataLabelTextColor)
                .text(labelText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements like annotations or complex interactions in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
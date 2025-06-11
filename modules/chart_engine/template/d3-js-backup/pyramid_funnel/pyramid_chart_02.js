/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Chart",
  "chart_name": "pyramid_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, 100]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",            // One of: left | center | right | top | bottom
  "xAxis": "none",                        // One of: visible | minimal | none
  "yAxis": "none",                        // One of: visible | minimal | none
  "gridLineType": "none",                // One of: subtle | prominent | none
  "legend": "none",                       // One of: normal | compact | detailed | none
  "dataLabelPosition": "outside",            // One of: outside | inside | center_element | auto | none
  "artisticStyle": "clean",               // One of: clean | hand_drawn | gradient_gloss | shadow
  "valueSortDirection": "ascending",           // One of: ascending | descending | none
  "iconographyUsage": "none"              // One of: none | categorical_markers_overlay_internal | categorical_markers_overlay_edge | element_replacement | background_contextual | adjacent_indicator
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming data.colors is the chosen palette
    const images = data.images || {}; // Parsed per spec, though not used in this chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("Field with role 'x'");
        if (!valueFieldName) missingFields.push("Field with role 'y'");
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            // Default title font properties (not used by this chart for main title)
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            // Default annotation font properties (not used by this chart)
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF', // Default to white background
        defaultCategoryColors: d3.schemeCategory10, // Default color scheme
        getCategoryColor: (categoryValue, index) => {
            if (colors.field && colors.field[categoryValue]) {
                return colors.field[categoryValue];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return fillStyle.defaultCategoryColors[index % fillStyle.defaultCategoryColors.length];
        }
    };

    // In-memory text measurement utility
    function estimateTextWidth(text, fontOverride = {}) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        
        const fontFamily = fontOverride.fontFamily || fillStyle.typography.labelFontFamily;
        const fontSize = fontOverride.fontSize || fillStyle.typography.labelFontSize;
        const fontWeight = fontOverride.fontWeight || fillStyle.typography.labelFontWeight;

        tempText.style.fontFamily = fontFamily;
        tempText.style.fontSize = fontSize;
        tempText.style.fontWeight = fontWeight;
        tempText.textContent = text;
        
        // Append to the in-memory SVG. Do not append tempSvg to the document DOM.
        tempSvg.appendChild(tempText); 
        
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail or be inaccurate without DOM attachment
            const sizePart = String(fontSize).match(/\d+/);
            const numSize = sizePart ? parseInt(sizePart[0], 10) : 12;
            return text ? text.length * (numSize * 0.6) : 0; // Approximation
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; // Default width if not provided
    const containerHeight = variables.height || 600; // Default height if not provided

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Constants for pyramid geometry and layout
    const PYRAMID_MAX_WIDTH_RATIO = 0.6; // Proportion of innerWidth for pyramid base at its widest
    const PYRAMID_GEOMETRIC_HEIGHT_RATIO = 0.6; // Proportion of innerHeight for the sum of geometric segment heights
    const LABEL_OFFSET_X = 10; // Horizontal distance from pyramid edge to label text
    const SEGMENT_GAP = 5; // Vertical gap between pyramid segments

    const maxPyramidBaseWidth = innerWidth * PYRAMID_MAX_WIDTH_RATIO;
    const pyramidGeometricHeightTarget = innerHeight * PYRAMID_GEOMETRIC_HEIGHT_RATIO;
    const pyramidCenterX = innerWidth / 2;

    // Block 5: Data Preprocessing & Transformation
    // Clone and sort data: smallest value at the top of the pyramid (ascending sort)
    const sortedData = [...chartDataArray].sort((a, b) => a[valueFieldName] - b[valueFieldName]);

    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);

    sortedData.forEach(d => {
        d.percent = totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100;
    });
    
    const sections = [];
    if (totalValue > 0 && pyramidGeometricHeightTarget > 0 && maxPyramidBaseWidth > 0 && sortedData.length > 0) {
        let currentHeightFromApex = 0; // Tracks the Y position from the apex for the current segment's top
        const totalPyramidArea = (maxPyramidBaseWidth * pyramidGeometricHeightTarget) / 2;

        sortedData.forEach(d => {
            const areaRatioForSegment = d.percent / 100;
            const targetSectionArea = totalPyramidArea * areaRatioForSegment;

            // Width at the current segment's top (closer to apex)
            const segmentUpperWidth = maxPyramidBaseWidth * (currentHeightFromApex / pyramidGeometricHeightTarget);

            // Quadratic equation to find segment height 'h': A*h^2 + B*h + C = 0
            // A = maxPyramidBaseWidth / (2 * pyramidGeometricHeightTarget)
            // B = segmentUpperWidth (width at the top of the current trapezoid)
            // C = -2 * targetSectionArea
            const coeffA = maxPyramidBaseWidth / (2 * pyramidGeometricHeightTarget);
            const coeffB = segmentUpperWidth;
            const coeffC = -2 * targetSectionArea;

            let segmentHeight = 0;
            if (Math.abs(coeffA) < 1e-9) { // If effectively a rectangle or if pyramidGeometricHeightTarget is huge
                if (Math.abs(coeffB) > 1e-9) segmentHeight = -coeffC / coeffB; // Linear case: B*h + C = 0
            } else {
                const discriminant = coeffB * coeffB - 4 * coeffA * coeffC;
                if (discriminant >= 0) {
                    segmentHeight = (-coeffB + Math.sqrt(discriminant)) / (2 * coeffA); // Positive root for height
                }
            }
            segmentHeight = Math.max(0, segmentHeight); // Ensure height is not negative or NaN

            const segmentLowerWidth = maxPyramidBaseWidth * ((currentHeightFromApex + segmentHeight) / pyramidGeometricHeightTarget);
            
            sections.push({
                dataItem: d, // Original data item
                upperYRelToApex: currentHeightFromApex, // Y-coordinate of segment's top relative to apex
                lowerYRelToApex: currentHeightFromApex + segmentHeight, // Y-coordinate of segment's bottom relative to apex
                upperEdgeWidth: segmentUpperWidth, // Width at upperYRelToApex
                lowerEdgeWidth: segmentLowerWidth,  // Width at lowerYRelToApex
            });
            currentHeightFromApex += segmentHeight;
        });
    }
    
    const actualCalculatedGeometricHeight = sections.length > 0 ? sections[sections.length - 1].lowerYRelToApex : 0;
    const numberOfGaps = sections.length > 1 ? sections.length - 1 : 0;
    const totalPyramidVisualHeight = actualCalculatedGeometricHeight + (numberOfGaps * SEGMENT_GAP);
    const verticalCenteringOffset = (innerHeight - totalPyramidVisualHeight) / 2;

    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales (e.g., for axes) are needed. Color mapping is handled by fillStyle.getCategoryColor.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // This chart does not render axes, gridlines, or a legend.

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other chart-render-group") // Standardized class
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    sections.forEach((section, i) => {
        const d = section.dataItem;
        const categoryValue = d[categoryFieldName];
        const segmentColor = fillStyle.getCategoryColor(categoryValue, i);

        // Calculate absolute Y positions for drawing the segment
        const yPositionBase = verticalCenteringOffset + i * SEGMENT_GAP;
        const segmentDrawUpperY = yPositionBase + section.upperYRelToApex;
        const segmentDrawLowerY = yPositionBase + section.lowerYRelToApex;

        // Ensure widths are non-negative
        const upperW = Math.max(0, section.upperEdgeWidth);
        const lowerW = Math.max(0, section.lowerEdgeWidth);

        // Only draw if segment has positive height and some width
        if (segmentDrawLowerY > segmentDrawUpperY && (upperW > 0 || lowerW > 0)) {
            const polygonPoints = [
                [pyramidCenterX - upperW / 2, segmentDrawUpperY],
                [pyramidCenterX + upperW / 2, segmentDrawUpperY],
                [pyramidCenterX + lowerW / 2, segmentDrawLowerY],
                [pyramidCenterX - lowerW / 2, segmentDrawLowerY]
            ].map(p => p.join(",")).join(" ");

            mainChartGroup.append("polygon")
                .attr("class", "mark pyramid-segment")
                .attr("points", polygonPoints)
                .attr("fill", segmentColor);
        }
        
        // Add data labels
        const labelY = yPositionBase + (section.upperYRelToApex + section.lowerYRelToApex) / 2;
        // Position label to the right of the wider part of the segment
        const labelX = pyramidCenterX + Math.max(upperW, lowerW) / 2 + LABEL_OFFSET_X; 

        mainChartGroup.append("text")
            .attr("class", "label data-label")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "start") // Align text to start from labelX
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(`${categoryValue} ${Math.round(d.percent)}%`);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements or post-processing steps for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
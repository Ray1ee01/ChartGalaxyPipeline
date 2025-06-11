/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Chart",
  "chart_name": "pyramid_chart_01_dark",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "dark",

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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || data.colors || {}; // Prefer dark, then light, then empty
    const images = data.images || {}; // Parsed, though not used in this specific chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !valueColumn) {
        const errorMessage = "Critical chart config missing: Roles 'x' or 'y' not found in dataColumns. Cannot render.";
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>Error: ${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = "Critical chart config missing: Field names for 'x' or 'y' roles are undefined. Cannot render.";
        console.error(errorMessage);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>Error: ${errorMessage}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        textColor: colors.text_color || "#FFFFFF", // Default light text for dark themes
        backgroundColor: colors.background_color || "#121212", // Default dark background
    };

    // Typography tokens
    fillStyle.typography.titleFontFamily = (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif';
    fillStyle.typography.titleFontSize = (typography.title && typography.title.font_size) ? typography.title.font_size : '16px';
    fillStyle.typography.titleFontWeight = (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold';
    
    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '14px';
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold';

    fillStyle.typography.annotationFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px';
    fillStyle.typography.annotationFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal';

    // In-memory text measurement utility
    function estimateTextWidth(text, fontStyle) {
        const font = fontStyle || `${fillStyle.typography.labelFontSize} ${fillStyle.typography.labelFontFamily}`;
        try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            context.font = font;
            const metrics = context.measureText(text);
            return metrics.width;
        } catch (e) {
            // Fallback for environments where canvas is not available or measureText fails
            const fontSize = parseFloat(font) || 12;
            return text.length * fontSize * 0.6; // Basic estimation
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
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 40,
        right: variables.margin_right || 120, // Accommodate labels
        bottom: variables.margin_bottom || 40,
        left: variables.margin_left || 60
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const processedChartData = chartDataInput
        .map(d => ({
            ...d,
            [valueFieldName]: parseFloat(d[valueFieldName]) // Ensure value is numeric
        }))
        .filter(d => d[categoryFieldName] != null && !isNaN(d[valueFieldName]) && d[valueFieldName] >= 0); // Filter invalid/negative values
    
    if (processedChartData.length === 0) {
        const errorMessage = "No valid data available to render the chart after processing.";
        console.warn(errorMessage); // Warn, as it's a data issue
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>Warning: ${errorMessage}</div>`);
        }
        return null;
    }

    const sortedData = [...processedChartData].sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const totalValue = d3.sum(sortedData, d => d[valueFieldName]);

    if (totalValue === 0) {
        const errorMessage = "Total value of data is zero. Cannot render pyramid segments based on proportion.";
        console.warn(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>Warning: ${errorMessage}</div>`);
        }
        return null;
    }

    sortedData.forEach(d => {
        d.percent = (d[valueFieldName] / totalValue) * 100;
    });

    const maxPyramidVisualWidth = innerWidth * (variables.pyramid_width_ratio || 0.6);
    const pyramidTargetRenderHeight = innerHeight * (variables.pyramid_height_ratio || 0.6); // Target visual height of the pyramid
    const totalPyramidConceptualArea = maxPyramidVisualWidth * pyramidTargetRenderHeight / 2;

    let accumulatedPyramidHeight = 0;
    const pyramidSections = [];

    sortedData.forEach(d => {
        if (d.percent <= 0) return; // Skip zero or negative percent segments

        const sectionTargetArea = totalPyramidConceptualArea * (d.percent / 100);
        const currentSectionBaseWidth = (accumulatedPyramidHeight / pyramidTargetRenderHeight) * maxPyramidVisualWidth;

        // Quadratic equation coefficients from original logic: A*h^2 + B*h + C = 0
        // A = maxPyramidVisualWidth / (2 * pyramidTargetRenderHeight)
        // B = currentSectionBaseWidth
        // C = -2 * sectionTargetArea
        const quadA = maxPyramidVisualWidth / (2 * pyramidTargetRenderHeight);
        const quadB = currentSectionBaseWidth;
        const quadC = -2 * sectionTargetArea; 
        
        let segmentHeight = 0;
        const discriminant = quadB * quadB - 4 * quadA * quadC;

        if (discriminant >= 0) {
            if (quadA !== 0) {
                segmentHeight = (-quadB + Math.sqrt(discriminant)) / (2 * quadA);
            } else if (quadB !== 0) { // Linear case: B*h + C = 0 => B*h = 2*sectionTargetArea
                segmentHeight = (2 * sectionTargetArea) / quadB;
            } else { // Both A and B are zero, implies C should be zero (sectionTargetArea is zero)
                segmentHeight = 0;
            }
        } else {
            // Discriminant is negative, no real solution for h. This indicates an issue.
            // Fallback: proportional height based on remaining total height (crude)
            console.warn("Pyramid segment height calculation resulted in negative discriminant for data:", d);
            segmentHeight = pyramidTargetRenderHeight * (d.percent / 100); 
        }
        
        segmentHeight = Math.max(0, segmentHeight); // Ensure height is not negative

        const segmentTopWidth = ((accumulatedPyramidHeight + segmentHeight) / pyramidTargetRenderHeight) * maxPyramidVisualWidth;

        pyramidSections.push({
            data: d,
            yBaseGeometric: accumulatedPyramidHeight, // Y from apex for this segment's base
            yTopGeometric: accumulatedPyramidHeight + segmentHeight, // Y from apex for this segment's top
            widthAtBase: currentSectionBaseWidth,
            widthAtTop: segmentTopWidth,
        });
        accumulatedPyramidHeight += segmentHeight;
    });
    
    // Normalize heights if accumulated height doesn't match target render height
    if (accumulatedPyramidHeight > 0 && Math.abs(accumulatedPyramidHeight - pyramidTargetRenderHeight) > 1e-6) { // Check with tolerance
        const scaleFactor = pyramidTargetRenderHeight / accumulatedPyramidHeight;
        pyramidSections.forEach(sec => {
            sec.yBaseGeometric *= scaleFactor;
            sec.yTopGeometric *= scaleFactor;
            // Recalculate widths based on scaled Y positions
            sec.widthAtBase = (sec.yBaseGeometric / pyramidTargetRenderHeight) * maxPyramidVisualWidth;
            sec.widthAtTop = (sec.yTopGeometric / pyramidTargetRenderHeight) * maxPyramidVisualWidth;
        });
    }

    // Block 6: Scale Definition & Configuration - Not applicable (no D3 scales for axes)

    // Block 7: Chart Component Rendering - Not applicable (no axes, gridlines, legend)

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Class 'other' for main group

    const verticalCenteringOffset = (innerHeight - pyramidTargetRenderHeight) / 2;

    // Block 8: Main Data Visualization Rendering
    pyramidSections.forEach((section, i) => {
        const datum = section.data;
        const categoryValue = datum[categoryFieldName];

        let segmentColor;
        if (colors.field && colors.field[categoryValue]) {
            segmentColor = colors.field[categoryValue];
        } else if (colors.available_colors && colors.available_colors.length > 0) {
            segmentColor = colors.available_colors[i % colors.available_colors.length];
        } else {
            const defaultScheme = d3.schemeCategory10; // Default color scheme
            segmentColor = defaultScheme[i % defaultScheme.length];
        }

        const points = [
            [innerWidth / 2 - section.widthAtTop / 2, section.yTopGeometric + verticalCenteringOffset],
            [innerWidth / 2 + section.widthAtTop / 2, section.yTopGeometric + verticalCenteringOffset],
            [innerWidth / 2 + section.widthAtBase / 2, section.yBaseGeometric + verticalCenteringOffset],
            [innerWidth / 2 - section.widthAtBase / 2, section.yBaseGeometric + verticalCenteringOffset]
        ];

        mainChartGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark pyramid-segment");

        const labelYPosition = (section.yBaseGeometric + section.yTopGeometric) / 2 + verticalCenteringOffset;
        const labelXPosition = innerWidth / 2 + Math.max(section.widthAtBase, section.widthAtTop) / 2 + 10; // 10px padding

        mainChartGroup.append("text")
            .attr("x", labelXPosition)
            .attr("y", labelYPosition)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label data-label")
            .text(`${categoryValue} ${Math.round(datum.percent)}%`);
    });

    // Block 9: Optional Enhancements & Post-Processing - None for this chart

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
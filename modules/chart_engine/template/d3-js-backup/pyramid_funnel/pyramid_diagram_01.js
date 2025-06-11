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
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const Ccolors = data.colors || {}; // Renamed to avoid conflict with d3.colors
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data?.columns || [];

    const container = d3.select(containerSelector);
    container.html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("field with role 'x'");
        if (!valueFieldName) missingFields.push("field with role 'y'");
        
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(' and ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            try {
                const el = d3.select(containerSelector);
                if (!el.empty()) {
                     el.html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: ${errorMsg}</div>`);
                } else {
                    // console.error("Container selector found no element during error reporting.");
                }
            } catch (e) {
                // console.error("Error trying to update container selector with error message:", e);
            }
        }
        return null;
    }
    
    if (chartDataInput.length === 0) {
        // console.log("No data provided to chart.");
        // Optionally render a message or just an empty SVG
        // For now, will proceed and likely render an empty chart area
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.dataLabelFontFamily = (typography.label && typography.label.font_family) || defaultTypographyStyles.label.font_family;
    fillStyle.typography.dataLabelFontSize = (typography.label && typography.label.font_size) || '14px'; // Specific to this chart's label style
    fillStyle.typography.dataLabelFontWeight = (typography.label && typography.label.font_weight) || 'bold'; // Specific to this chart's label style

    fillStyle.dataLabelColor = Ccolors.data_label_on_color || '#FFFFFF'; // Color for text on pyramid segments
    fillStyle.textColor = Ccolors.text_color || '#333333'; // General text color (not used directly by pyramid labels here)
    fillStyle.chartBackground = Ccolors.background_color || '#FFFFFF';
    fillStyle.labelRectBackground = 'rgba(0, 0, 0, 0.3)'; // For label readability enhancement

    fillStyle.getSegmentColor = (categoryName, index) => {
        if (Ccolors.field && Ccolors.field[categoryName]) {
            return Ccolors.field[categoryName];
        }
        if (Ccolors.available_colors && Ccolors.available_colors.length > 0) {
            return Ccolors.available_colors[index % Ccolors.available_colors.length];
        }
        const scheme = d3.schemeCategory10; // Default scheme
        return scheme[index % scheme.length];
    };
    
    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const { fontFamily, fontSize, fontWeight, fontStyle } = fontProps;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        if (fontStyle) tempText.setAttribute('font-style', fontStyle);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but strictly per spec, use in-memory. This might be less accurate.
        // For higher accuracy if issues arise:
        // document.body.appendChild(tempSvg);
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        // return width;
        // Using direct measure on non-DOM element (less reliable but per spec):
         try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on non-DOM element
            // console.warn("getBBox on in-memory SVG failed, using approximate measure.");
            return text.length * (parseInt(fontSize) || 10) * 0.6; 
        }
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = container.append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 }; // Preserved from original
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Pyramid specific dimensions - preserved from original scaling
    const maxPyramidBaseWidth = innerWidth * 0.6; 
    const totalPyramidHeight = innerHeight * 0.6;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); // Deep copy for manipulation

    // Sort data by value (smallest at the top of the pyramid)
    chartDataArray.sort((a, b) => (a[valueFieldName] || 0) - (b[valueFieldName] || 0));

    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName] || 0);

    const sectionGeometry = [];
    if (totalValue > 0 && totalPyramidHeight > 0 && maxPyramidBaseWidth > 0) {
        let currentYOffsetFromApex = 0; // Tracks the Y position from the pyramid's apex
        const totalPyramidArea = (maxPyramidBaseWidth * totalPyramidHeight) / 2;

        chartDataArray.forEach(d => {
            const value = d[valueFieldName] || 0;
            if (value <= 0) return; // Skip zero or negative value segments

            const segmentAreaProportion = value / totalValue;
            const segmentTargetArea = segmentAreaProportion * totalPyramidArea;

            // Width of the trapezoid's top base (or current bottom of pyramid being built)
            const topBaseWidth = maxPyramidBaseWidth * (currentYOffsetFromApex / totalPyramidHeight);

            // Quadratic equation to find segment height 'h': A*h^2 + B*h + C = 0
            // A = maxPyramidBaseWidth / (2 * totalPyramidHeight)
            // B = topBaseWidth
            // C = -2 * segmentTargetArea
            const quadA = maxPyramidBaseWidth / (2 * totalPyramidHeight);
            const quadB = topBaseWidth;
            const quadC = -2 * segmentTargetArea;

            let segmentHeight = 0;
            if (Math.abs(quadA) < 1e-9) { // If essentially a rectangle (e.g. maxPyramidBaseWidth is 0, or totalPyramidHeight is huge)
                if (Math.abs(quadB) > 1e-9) {
                    segmentHeight = -quadC / quadB; // Simplified: area = base * height
                }
            } else {
                const discriminant = quadB * quadB - 4 * quadA * quadC;
                if (discriminant >= 0) {
                    segmentHeight = (-quadB + Math.sqrt(discriminant)) / (2 * quadA);
                }
            }
            
            if (segmentHeight <= 0 || !isFinite(segmentHeight)) {
                 // console.warn("Calculated segment height is invalid for data:", d);
                 segmentHeight = 0; // Prevent issues, effectively skipping this segment visually
            }


            const bottomYOffsetFromApex = currentYOffsetFromApex + segmentHeight;
            const bottomBaseWidth = maxPyramidBaseWidth * (bottomYOffsetFromApex / totalPyramidHeight);

            sectionGeometry.push({
                data: d,
                yTop: currentYOffsetFromApex,
                yBottom: bottomYOffsetFromApex,
                widthTop: topBaseWidth,
                widthBottom: bottomBaseWidth,
                height: segmentHeight
            });
            currentYOffsetFromApex += segmentHeight;
        });
    }
    
    // Adjust totalPyramidHeight to actual rendered height if segments didn't fill it
    const actualRenderedPyramidHeight = d3.sum(sectionGeometry, s => s.height);
    const verticalCenteringOffset = (innerHeight - actualRenderedPyramidHeight) / 2;

    // Block 6: Scale Definition & Configuration
    // Scales are implicitly handled by the geometric calculations in Block 5.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart.

    // Block 8: Main Data Visualization Rendering
    const pyramidSegmentsGroup = mainChartGroup.append("g").attr("class", "pyramid-segments");

    sectionGeometry.forEach((section, i) => {
        const segmentData = section.data;
        const segmentColor = fillStyle.getSegmentColor(segmentData[categoryFieldName], i);

        // Define polygon points for the trapezoidal segment
        // Points are relative to mainChartGroup
        const points = [
            [innerWidth / 2 - section.widthTop / 2, section.yTop + verticalCenteringOffset],
            [innerWidth / 2 + section.widthTop / 2, section.yTop + verticalCenteringOffset],
            [innerWidth / 2 + section.widthBottom / 2, section.yBottom + verticalCenteringOffset],
            [innerWidth / 2 - section.widthBottom / 2, section.yBottom + verticalCenteringOffset]
        ];

        pyramidSegmentsGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark pyramid-segment");

        // Add data labels
        const labelX = innerWidth / 2;
        const labelY = (section.yTop + section.yBottom) / 2 + verticalCenteringOffset;
        
        const labelText = String(segmentData[categoryFieldName]);
        const avgSegmentWidth = (section.widthTop + section.widthBottom) / 2;
        const estimatedTextWidth = estimateTextWidth(labelText, {
            fontFamily: fillStyle.typography.dataLabelFontFamily,
            fontSize: fillStyle.typography.dataLabelFontSize,
            fontWeight: fillStyle.typography.dataLabelFontWeight
        });

        const textPadding = 20; // Padding for label background rect

        // Optional: Add a background rect for better label readability if text is too wide
        if (section.height > parseInt(fillStyle.typography.dataLabelFontSize) * 0.8 && // Only if segment is tall enough
            (estimatedTextWidth + textPadding > avgSegmentWidth && avgSegmentWidth > 0)) { 
            pyramidSegmentsGroup.append("rect")
                .attr("class", "label-background other")
                .attr("x", labelX - (estimatedTextWidth + textPadding) / 2)
                .attr("y", labelY - (parseInt(fillStyle.typography.dataLabelFontSize) * 0.5 + textPadding * 0.25)) // Adjust based on font size
                .attr("width", estimatedTextWidth + textPadding)
                .attr("height", parseInt(fillStyle.typography.dataLabelFontSize) + textPadding * 0.5)
                .attr("fill", fillStyle.labelRectBackground)
                .attr("rx", 5)
                .attr("ry", 5);
        }
        
        if (section.height > parseInt(fillStyle.typography.dataLabelFontSize) * 0.5) { // Only draw label if segment is somewhat tall
            pyramidSegmentsGroup.append("text")
                .attr("class", "label data-label")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.dataLabelFontFamily)
                .style("font-size", fillStyle.typography.dataLabelFontSize)
                .style("font-weight", fillStyle.typography.dataLabelFontWeight)
                .attr("fill", fillStyle.dataLabelColor)
                .text(labelText);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Label background rects are handled in Block 8.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
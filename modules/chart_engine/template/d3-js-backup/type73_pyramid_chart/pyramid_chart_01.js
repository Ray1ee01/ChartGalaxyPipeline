/* REQUIREMENTS_BEGIN
{
  "chart_type": "Pyramid Chart",
  "chart_name": "pyramid_plain_chart_01",
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
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed as data.colors_dark
    const images = data.images || {}; // Not used in this chart, but good practice to extract
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !valueColumn) {
        const missing = [];
        if (!categoryColumn) missing.push("category field (role 'x')");
        if (!valueColumn) missing.push("value field (role 'y')");
        const errorMessage = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMessage);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px', // Original used 14px, standardizing to 12px as per typography object structure.
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold',
        },
        textColor: colors.text_color || '#0f223b',
        chartBackground: colors.background_color || '#FFFFFF', // Not directly used to set SVG bg, but available
        defaultScheme: d3.schemeCategory10 
    };

    fillStyle.getColor = (category, index) => {
        if (colors.field && colors.field[categoryFieldName] && colors.field[categoryFieldName][category]) {
            return colors.field[categoryFieldName][category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            return colors.available_colors[index % colors.available_colors.length];
        }
        return fillStyle.defaultScheme[index % fillStyle.defaultScheme.length];
    };
    
    // In-memory text measurement utility (not strictly used for layout in this chart, but good practice)
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const tempTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tempTextElement.setAttribute("font-weight", fontWeight);
        tempTextElement.setAttribute("font-size", fontSize);
        tempTextElement.setAttribute("font-family", fontFamily);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // No need to append to DOM for getBBox
        const width = tempTextElement.getBBox().width;
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
        .style("background-color", fillStyle.chartBackground); // Optional: set background color on SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 150, bottom: 40, left: 60 }; // Increased right margin for labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Pyramid dimensions (smaller than chart area to leave space)
    const maxPyramidWidth = innerWidth * 0.6; 
    const pyramidTotalHeight = innerHeight * 0.9; 

    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataInput].sort((a, b) => a[valueFieldName] - b[valueFieldName]); // Smallest value at the top

    const totalValue = d3.sum(sortedChartData, d => d[valueFieldName]);
    if (totalValue === 0) {
        const errorMessage = "Total value is zero, cannot render pyramid chart.";
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMessage}</div>`);
        return null;
    }

    let cumulativeHeight = 0; // Tracks the y-position from the apex of the pyramid
    const pyramidSections = [];

    sortedChartData.forEach(d => {
        d.percent = (d[valueFieldName] / totalValue) * 100;
        
        const sectionAreaRatio = d.percent / 100;
        // Total area of the conceptual triangle from which the pyramid is formed
        const conceptualTotalTriangleArea = (maxPyramidWidth * pyramidTotalHeight) / 2;
        const sectionArea = conceptualTotalTriangleArea * sectionAreaRatio;

        // Width at the current cumulative height (top of the current segment)
        // Linear interpolation: width = maxPyramidWidth * (1 - y/pyramidTotalHeight) if apex is at y=0
        // Or width = maxPyramidWidth * (y/pyramidTotalHeight) if apex at y=0 and base at y=pyramidTotalHeight
        // Since we build from top (y=0) downwards:
        const segmentTopWidth = maxPyramidWidth * (cumulativeHeight / pyramidTotalHeight);

        // Quadratic equation to find segment height 'h':
        // A*h^2 + B*h + C = 0
        // A = maxPyramidWidth / (2 * pyramidTotalHeight)
        // B = segmentTopWidth (width at the top of this segment)
        // C = -sectionArea (negative because area is positive)
        // Note: The original formula used `2 * sectionArea`. Let's re-derive.
        // Area of trapezoid = ((base1 + base2) / 2) * h
        // base1 = segmentTopWidth = maxPyramidWidth * (cumulativeHeight / pyramidTotalHeight)
        // base2 = segmentBottomWidth = maxPyramidWidth * ((cumulativeHeight + h) / pyramidTotalHeight)
        // sectionArea = ( (maxPyramidWidth * (cumulativeHeight/pyramidTotalHeight)) + (maxPyramidWidth * ((cumulativeHeight+h)/pyramidTotalHeight)) ) / 2 * h
        // sectionArea = (maxPyramidWidth/pyramidTotalHeight) * (cumulativeHeight + cumulativeHeight + h) / 2 * h
        // sectionArea = (maxPyramidWidth/(2*pyramidTotalHeight)) * (2*cumulativeHeight + h) * h
        // sectionArea = (maxPyramidWidth/(2*pyramidTotalHeight)) * (2*cumulativeHeight*h + h^2)
        // (maxPyramidWidth/(2*pyramidTotalHeight)) * h^2 + (maxPyramidWidth*cumulativeHeight/pyramidTotalHeight) * h - sectionArea = 0
        // A = maxPyramidWidth / (2 * pyramidTotalHeight)
        // B = maxPyramidWidth * cumulativeHeight / pyramidTotalHeight  (this is segmentTopWidth)
        // C = -sectionArea
        
        const A_coeff = maxPyramidWidth / (2 * pyramidTotalHeight);
        const B_coeff = segmentTopWidth; // Which is maxPyramidWidth * cumulativeHeight / pyramidTotalHeight
        const C_coeff = -sectionArea;

        let segmentHeight;
        if (A_coeff === 0) { // This would happen if pyramidTotalHeight is infinite, or maxPyramidWidth is 0. Should not occur with valid inputs.
            if (B_coeff === 0) { // If both A and B are zero, implies no change in width, so it's a rectangle.
                 segmentHeight = sectionArea / B_coeff; // This case is problematic if B_coeff is also 0.
            } else {
                 segmentHeight = -C_coeff / B_coeff; // Linear equation: B*h + C = 0
            }
        } else {
            const discriminant = B_coeff * B_coeff - 4 * A_coeff * C_coeff;
            if (discriminant < 0) {
                // This can happen if sectionArea is too large for the given geometry or due to precision issues.
                // Fallback: distribute remaining height proportionally if it's the last segment, or use a small default.
                console.warn("Pyramid segment calculation resulted in negative discriminant. Data or proportions might be challenging.", d);
                segmentHeight = Math.max(1, pyramidTotalHeight * (d.percent / 100)); // Simplified proportional height
            } else {
                 segmentHeight = (-B_coeff + Math.sqrt(discriminant)) / (2 * A_coeff);
            }
        }
        
        // Ensure segmentHeight is not excessively large, especially for the last segment
        if (cumulativeHeight + segmentHeight > pyramidTotalHeight * 1.01 && sortedChartData.indexOf(d) < sortedChartData.length -1) { // Allow slight overshoot for last
             segmentHeight = pyramidTotalHeight - cumulativeHeight;
        }
         segmentHeight = Math.max(0, segmentHeight); // Ensure non-negative height


        const segmentBottomY = cumulativeHeight + segmentHeight;
        const segmentBottomWidth = maxPyramidWidth * (segmentBottomY / pyramidTotalHeight);
        
        pyramidSections.push({
            data: d,
            y_top: cumulativeHeight,         // Y-coordinate of the top edge of the segment
            y_bottom: segmentBottomY,        // Y-coordinate of the bottom edge of the segment
            width_top: segmentTopWidth,      // Width of the top edge
            width_bottom: segmentBottomWidth // Width of the bottom edge
        });
        
        cumulativeHeight = segmentBottomY;
    });

    // Adjust last segment to fill remaining pyramid height if there's a small discrepancy
    if (pyramidSections.length > 0) {
        const lastSection = pyramidSections[pyramidSections.length - 1];
        const heightError = pyramidTotalHeight - lastSection.y_bottom;
        if (Math.abs(heightError) > 0.01) { // Tolerance for floating point errors
            lastSection.y_bottom = pyramidTotalHeight;
            lastSection.width_bottom = maxPyramidWidth * (lastSection.y_bottom / pyramidTotalHeight);
        }
    }


    // Block 6: Scale Definition & Configuration
    // No explicit D3 scales for axes in this chart. Geometry is calculated directly.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this pyramid chart.

    // Block 8: Main Data Visualization Rendering
    const verticalOffset = (innerHeight - pyramidTotalHeight) / 2; // To center the pyramid vertically

    pyramidSections.forEach((section, i) => {
        const d = section.data;
        const color = fillStyle.getColor(d[categoryFieldName], i);

        // Define polygon points for the trapezoidal segment
        // (x,y) coordinates:
        // Top-left: (center - width_top/2, y_top)
        // Top-right: (center + width_top/2, y_top)
        // Bottom-right: (center + width_bottom/2, y_bottom)
        // Bottom-left: (center - width_bottom/2, y_bottom)
        const points = [
            [innerWidth / 2 - section.width_top / 2, section.y_top + verticalOffset],
            [innerWidth / 2 + section.width_top / 2, section.y_top + verticalOffset],
            [innerWidth / 2 + section.width_bottom / 2, section.y_bottom + verticalOffset],
            [innerWidth / 2 - section.width_bottom / 2, section.y_bottom + verticalOffset]
        ];

        mainChartGroup.append("polygon")
            .attr("points", points.map(p => p.join(",")).join(" "))
            .attr("fill", color)
            .attr("class", "mark");

        // Add labels
        const labelY = (section.y_top + section.y_bottom) / 2 + verticalOffset;
        // Place label to the right of the widest part of the segment (which is section.width_bottom)
        const labelX = innerWidth / 2 + section.width_bottom / 2 + 10; 

        mainChartGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .attr("class", "label")
            .text(`${d[categoryFieldName]} ${Math.round(d.percent)}%`);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
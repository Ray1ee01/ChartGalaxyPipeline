/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radar Line Chart",
  "chart_name": "radar_line_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data;
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors_dark || {}; // Using colors_dark as per original
    const images = data.images || {}; // Not used in this chart, but parsed as per spec
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === 'x');
    const valueFieldDef = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldDef || !valueFieldDef) {
        const missing = [];
        if (!categoryFieldDef) missing.push("x-role column");
        if (!valueFieldDef) missing.push("y-role column");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "Chart data is missing or empty. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : "#1f77b4",
        gridLineColor: (colors.other && colors.other.grid) ? colors.other.grid : "#BBBBBB", // Assuming #bbb from original
        dataPointStrokeColor: colors.background_color || "#333333", // Points stroke against chart background
        chartBackground: colors.background_color || "#333333", // Default dark background
        textColor: colors.text_color || "#FFFFFF",
        textOnPrimaryColor: "#FFFFFF", // Assuming primary is dark enough for white text
    };

    fillStyle.typography = {
        titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
        titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
        titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
        labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
        labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
        annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
    };
    
    // Helper function for text width estimation (in-memory)
    function estimateTextWidth(text, fontSize, fontFamily, fontWeight) {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but spec says not to.
        // For simple cases, this might work. If not, a temporary append/remove to DOM is needed.
        // However, the spec explicitly says "MUST NOT be appended to the document DOM".
        // Using a simplified approach that might be less accurate but adheres to the constraint.
        // A more robust way without DOM append would involve complex canvas measurement or known char widths.
        // For now, we'll assume getBBox on an unattached element gives a reasonable estimate.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails (e.g. jsdom)
            return text.length * (parseFloat(fontSize) * 0.6); // Rough estimate
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
        .style("background-color", fillStyle.chartBackground); // Optional: set SVG background

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 }; // Kept from original, could be configurable
    const chartInnerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartInnerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(chartInnerWidth, chartInnerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "other chart-content-group")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataInput.map(d => d[categoryFieldName]))];
    if (categories.length < 3) {
         const errorMsg = "Radar chart requires at least 3 categories. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const allValues = chartDataInput.map(d => d[valueFieldName]);
    const minValue = Math.min(0, d3.min(allValues) || 0); // Ensure 0 is included if all positive
    const maxValue = d3.max(allValues) || 0;
    
    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Distributes points, avoids overlap of first/last

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue * 1.2]) // *1.2 for headroom
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const ticks = radiusScale.ticks(5);

    // Concentric circles (grid lines)
    mainChartGroup.selectAll(".circle-gridline")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "gridline circle-gridline")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    // Radial axis lines
    mainChartGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", (d) => radiusScale(maxValue * 1.2) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", (d) => radiusScale(maxValue * 1.2) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    // Category labels
    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Angle relative to 3 o'clock
            if (Math.abs(angle - Math.PI / 2) < 0.01 || Math.abs(angle - 3 * Math.PI / 2) < 0.01) return "middle"; // Top or bottom
            return (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? "end" : "start"; // Left or right side
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
             if (Math.abs(angle) < 0.01 || Math.abs(angle - Math.PI) < 0.01) return "middle"; // Horizontal alignment
            return (angle > 0 && angle < Math.PI) ? "hanging" : "auto"; // Adjust for top/bottom hemisphere
        })
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    // Tick value labels (along one axis, typically vertical)
    mainChartGroup.selectAll(".tick-label")
        .data(ticks.filter(tick => tick !== 0)) // Don't label origin if 0
        .enter()
        .append("text")
        .attr("class", "label tick-label")
        .attr("x", 5) // Offset from the axis line
        .attr("y", d => -radiusScale(d)) // Position along the upward vertical axis
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    // Block 8: Main Data Visualization Rendering
    const radarLineGenerator = () => {
        const points = categories.map(cat => {
            const pointData = chartDataInput.find(item => item[categoryFieldName] === cat);
            const value = pointData ? pointData[valueFieldName] : 0; // Default to 0 if data missing for a category
            const angle = angleScale(cat) - Math.PI / 2; // Adjust for 12 o'clock start
            const r = radiusScale(value);
            return [r * Math.cos(angle), r * Math.sin(angle)];
        });
        return d3.line()(points) + "Z"; // Close the path
    };

    mainChartGroup.append("path")
        .attr("class", "mark radar-area")
        .attr("d", radarLineGenerator())
        .attr("fill", fillStyle.primaryColor)
        .attr("fill-opacity", 0.2) // Kept from original visual style
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", 2) // Original was 6, reducing for typical line chart look
        .attr("stroke-linejoin", "miter");

    // Data points
    categories.forEach((cat, index) => {
        const pointData = chartDataInput.find(item => item[categoryFieldName] === cat);
        if (pointData) {
            const value = pointData[valueFieldName];
            const angle = angleScale(cat) - Math.PI / 2;
            const r = radiusScale(value);
            const cx = r * Math.cos(angle);
            const cy = r * Math.sin(angle);

            mainChartGroup.append("circle")
                .attr("class", "mark data-point")
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", 4) // Original was 6, reducing slightly
                .attr("fill", fillStyle.primaryColor)
                .attr("stroke", fillStyle.dataPointStrokeColor) // Contrast with primaryColor and background
                .attr("stroke-width", 2); // Original was 3

            // Block 9: Optional Enhancements & Post-Processing (Value Labels)
            const labelText = value.toString();
            const textWidth = estimateTextWidth(labelText, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontWeight
            );
            
            let textX = (r + 15) * Math.cos(angle); // Base position
            let textY = (r + 15) * Math.sin(angle); // Base position

            // Specific adjustment for the first data point's label (often at 12 o'clock)
            // This was in the original, attempting to preserve its intent (likely avoiding overlap)
            if (index === 0 && Math.abs(angle) < 0.01) { // If it's the point at 12 o'clock
                 textX = cx; // Center horizontally with the point
                 textY = cy - 15; // Position above the point
            } else {
                // General adjustments for other points to push labels slightly away
                const offset = 15;
                textX = (r + offset + textWidth / 2 * Math.abs(Math.cos(angle))) * Math.cos(angle);
                textY = (r + offset + parseFloat(fillStyle.typography.labelFontSize) / 2 * Math.abs(Math.sin(angle))) * Math.sin(angle);
            }
            
            // Value label background
            mainChartGroup.append("rect")
                .attr("class", "other value-label-background")
                .attr("x", textX - textWidth / 2 - 4)
                .attr("y", textY - parseFloat(fillStyle.typography.labelFontSize) / 2 - 4)
                .attr("width", textWidth + 8)
                .attr("height", parseFloat(fillStyle.typography.labelFontSize) + 8)
                .attr("fill", fillStyle.primaryColor)
                .attr("rx", 3);

            // Value label text
            mainChartGroup.append("text")
                .attr("class", "label value-label")
                .attr("x", textX)
                .attr("y", textY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textOnPrimaryColor)
                .attr("font-family", fillStyle.typography.labelFontFamily)
                .attr("font-size", fillStyle.typography.labelFontSize)
                .attr("font-weight", fillStyle.typography.labelFontWeight)
                .text(labelText);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
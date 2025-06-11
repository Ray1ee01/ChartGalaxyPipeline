/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Circular Bar Chart",
  "chart_name": "grouped_circular_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
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
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "element_replacement"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || (data.colors_dark || {});
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryColumn = dataColumns.find(col => col.role === 'x');
    const valueColumn = dataColumns.find(col => col.role === 'y');

    if (!categoryColumn || !categoryColumn.name) {
        console.error("Critical chart config missing: Category field name (role 'x') not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (Category field 'x').</div>");
        return null;
    }
    if (!valueColumn || !valueColumn.name) {
        console.error("Critical chart config missing: Value field name (role 'y') not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (Value field 'y').</div>");
        return null;
    }

    const categoryFieldName = categoryColumn.name;
    const valueFieldName = valueColumn.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
        },
        colors: {
            textColor: colorsInput.text_color || '#333333',
            segmentStrokeColor: '#FFFFFF', // Fixed as per original styling
            defaultSegmentColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#CCCCCC',
        },
        images: {}, // Will be populated by a function if needed, or accessed directly
    };

    fillStyle.colors.getSegmentColor = (category, index) => {
        if (colorsInput.field && colorsInput.field[category]) {
            return colorsInput.field[category];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            return colorsInput.available_colors[index % colorsInput.available_colors.length];
        }
        return fillStyle.colors.defaultSegmentColor;
    };

    fillStyle.images.getSegmentImageURL = (category) => {
        if (imagesInput.field && imagesInput.field[category]) {
            return imagesInput.field[category];
        }
        // No general fallback like imagesInput.other.primary for segments in this design
        return null;
    };

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document body not strictly needed for getBBox if SVG has intrinsic dimensions, but safer for some browsers if styles are complex.
        // However, for simple text, direct measurement is fine.
        // document.body.appendChild(tempSvg); // Not appending to DOM as per requirement
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment (e.g. JSDOM without layout)
            return text.length * (parseFloat(fontProps.fontSize || fillStyle.typography.labelFontSize) * 0.6);
        } finally {
            // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg); // Not needed
        }
    }
    
    function getTextAnchorForAngle(angle) {
        // Normalize angle to be between 0 and 2*PI
        angle = angle % (2 * Math.PI);
        if (angle < 0) angle += 2 * Math.PI;

        if (angle > Math.PI * 0.875 && angle < Math.PI * 1.125) return "middle"; // Bottom
        if (angle > Math.PI * 1.875 || angle < Math.PI * 0.125) return "middle"; // Top
        if (angle > Math.PI * 0.125 && angle < Math.PI * 0.875) return "start";  // Right side
        if (angle > Math.PI * 1.125 && angle < Math.PI * 1.875) return "end";    // Left side
        return "middle";
    }

    function calculateLabelPosition(arcData, outerRadius, labelOffset) {
        const angle = (arcData.startAngle + arcData.endAngle) / 2;
        const effectiveRadius = outerRadius + labelOffset;
        const x = Math.sin(angle) * effectiveRadius;
        const y = -Math.cos(angle) * effectiveRadius;
        return [x, y];
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
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const margin = { top: 20, right: 20, bottom: 20, left: 20 }; // Adjusted for labels
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = containerHeight - margin.top - margin.bottom;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    const donutOuterRadius = Math.min(chartWidth, chartHeight) / 2 * 0.8; // Max radius, with some padding for labels
    const donutInnerRadius = donutOuterRadius * 0.5; // Inner radius relative to outer
    const labelOffset = 25; // Distance of labels from outer edge of donut

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    const defs = mainChartGroup.append("defs");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataInput, d => d[valueFieldName]);
    const chartDataProcessed = chartDataInput.map(d => ({
        ...d,
        percentage: totalValue === 0 ? 0 : (d[valueFieldName] / totalValue) * 100
    }));

    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null); // Keep original data order

    const arcsData = pieGenerator(chartDataProcessed);

    // Block 6: Scale Definition & Configuration
    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(donutOuterRadius)
        .padAngle(0.01) // Small padAngle for visual separation if stroke is not enough
        .cornerRadius(5); // Fixed corner radius as per original visual

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per requirements.

    // Block 8: Main Data Visualization Rendering
    const sliceGroups = mainChartGroup.selectAll(".slice-group")
        .data(arcsData)
        .enter()
        .append("g")
        .attr("class", (d, i) => `slice-group slice-group-${i}`);

    sliceGroups.each(function(d, i) {
        const sliceGroup = d3.select(this);
        const category = d.data[categoryFieldName];
        const segmentColor = fillStyle.colors.getSegmentColor(category, i);
        const segmentImageURL = fillStyle.images.getSegmentImageURL(category);

        // Append colored path as fallback or base
        sliceGroup.append("path")
            .attr("d", arcGenerator(d))
            .attr("fill", segmentColor)
            .attr("stroke", fillStyle.colors.segmentStrokeColor)
            .attr("stroke-width", 2)
            .attr("class", "mark segment-path");

        // Append image if URL exists
        if (segmentImageURL) {
            const clipId = `segment-clip-${i}`;
            defs.append("clipPath")
                .attr("id", clipId)
                .append("path")
                .attr("d", arcGenerator(d));

            sliceGroup.append("image")
                .attr("xlink:href", segmentImageURL)
                .attr("clip-path", `url(#${clipId})`)
                .attr("x", -donutOuterRadius) // Center image to cover the whole donut area
                .attr("y", -donutOuterRadius)
                .attr("width", donutOuterRadius * 2)
                .attr("height", donutOuterRadius * 2)
                .attr("preserveAspectRatio", "xMidYMid slice") // Ensure image covers, might crop
                .attr("class", "image segment-image");
        }

        // Add labels (category and percentage)
        if (d.data.percentage > 0) { // Only add labels for non-zero segments
            const [labelX, labelY] = calculateLabelPosition(d, donutOuterRadius, labelOffset);
            const textAngle = (d.startAngle + d.endAngle) / 2;
            const textAnchor = getTextAnchorForAngle(textAngle);
            
            const labelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);

            sliceGroup.append("text")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("dy", d.data.percentage < 2 ? `0.35em` : `-0.1em`) // Adjust dy for single/double line
                .attr("text-anchor", textAnchor)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .attr("class", "label category-label")
                .text(category);

            if (d.data.percentage >= 2) { // Show percentage if significant
                 sliceGroup.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY)
                    .attr("dy", `${labelFontSizePx * 0.9}px`) // Position second line below first
                    .attr("text-anchor", textAnchor)
                    .style("font-family", fillStyle.typography.labelFontFamily)
                    .style("font-size", fillStyle.typography.labelFontSize) // Can use smaller size if needed
                    .style("font-weight", fillStyle.typography.labelFontWeight)
                    .style("fill", fillStyle.colors.textColor)
                    .attr("class", "value percentage-label")
                    .text(`${d.data.percentage.toFixed(1)}%`);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements)
    // No additional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
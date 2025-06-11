/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Donut Chart",
  "chart_name": "semicircle_donut_chart_05_d3",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x-role field");
        if (!valueFieldName) missingFields.push("y-role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }

    const chartDataArray = chartDataInput.filter(d => d[valueFieldName] != null && d[categoryFieldName] != null);

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points to render the chart.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal',
        },
        textColor: colorsConfig.text_color || '#333333',
        segmentStrokeColor: '#FFFFFF', // Default stroke for segments
        defaultSegmentColors: d3.schemeCategory10,
        getSegmentColor: (category, index) => {
            if (colorsConfig.field && colorsConfig.field[category]) {
                return colorsConfig.field[category];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
            }
            return fillStyle.defaultSegmentColors[index % fillStyle.defaultSegmentColors.length];
        },
        getSegmentImage: (category) => {
            return imagesConfig.field && imagesConfig.field[category] ? imagesConfig.field[category] : null;
        },
        backgroundColor: colorsConfig.background_color || 'transparent' // Changed from #FFFFFF to transparent for flexibility
    };

    let _textMeasureSVG; // For memoizing the SVG element
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight = 'normal') {
        if (!text) return 0;
        if (typeof document === 'undefined') return text.length * parseFloat(fontSize) * 0.6; // Fallback for non-browser env

        if (!_textMeasureSVG) {
            _textMeasureSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            // Styles to ensure it's not visible and doesn't affect layout,
            // though it won't be added to the main DOM.
            _textMeasureSVG.style.position = 'absolute';
            _textMeasureSVG.style.visibility = 'hidden';
            _textMeasureSVG.style.width = '0px';
            _textMeasureSVG.style.height = '0px';
        }
        
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        
        _textMeasureSVG.appendChild(textNode);
        // Note: This relies on the browser's ability to calculate BBox for an unattached element.
        // For full reliability, appending to a hidden part of the DOM is safer, but violates constraint.
        // This implementation adheres strictly to "MUST NOT be appended to the document DOM".
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on detached node
            console.warn("getBBox on detached node failed, using approximate text width.", e);
            width = text.length * parseFloat(fontSize) * 0.6; // Rough approximation
        }
        _textMeasureSVG.removeChild(textNode);
        return width;
    }

    function fitTextToWidth(text, baseFontSizeStr, fontWeight, fontFamily, maxWidth) {
        let currentFontSize = parseFloat(baseFontSizeStr);
        const minFontSize = 8; // Minimum practical font size
        let fittedText = text;

        // Attempt 1: Check with original font size
        let textWidth = estimateTextWidth(fittedText, fontFamily, `${currentFontSize}px`, fontWeight);

        // Attempt 2: Shrink font size if too wide
        if (textWidth > maxWidth && currentFontSize > minFontSize) {
            const newFontSize = Math.max(minFontSize, currentFontSize * (maxWidth / textWidth));
            const testWidthShrunk = estimateTextWidth(fittedText, fontFamily, `${newFontSize}px`, fontWeight);
            if (testWidthShrunk <= maxWidth) {
                currentFontSize = newFontSize;
                textWidth = testWidthShrunk;
            } else { // If even shrunk font is too wide, use min font size for truncation calc
                 currentFontSize = minFontSize;
                 textWidth = estimateTextWidth(fittedText, fontFamily, `${currentFontSize}px`, fontWeight);
            }
        }
        
        // Attempt 3: Truncate if still too wide (or was already too wide for min font)
        if (textWidth > maxWidth) {
            let charCount = fittedText.length;
            while (charCount > 0) {
                charCount--;
                fittedText = text.substring(0, charCount) + (charCount < text.length && charCount > 0 ? "..." : "");
                if (charCount === 0) fittedText = "..."; // Ensure ellipsis if completely truncated
                textWidth = estimateTextWidth(fittedText, fontFamily, `${currentFontSize}px`, fontWeight);
                if (textWidth <= maxWidth || charCount === 0) break;
            }
             if (charCount === 0 && textWidth > maxWidth) fittedText = ""; // Cannot fit anything
        }

        return { text: fittedText, fontSize: `${currentFontSize}px` };
    }
    
    function calculateLabelPosition(d, outerRadius, offset = 30) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const labelRadius = outerRadius + offset;
        return [
            Math.sin(angle) * labelRadius,
            -Math.cos(angle) * labelRadius 
        ];
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
        .style("background-color", fillStyle.backgroundColor)
        .attr("class", "chart-svg-root");

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Adjusted for labels
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2; // Center Y for semicircle base

    // Max radius calculation needs to consider space for external labels
    // Effective height for semicircle is containerHeight - centerY (if base is at bottom)
    // Or, if centered, then it's containerHeight.
    // The original code centers the semicircle donut at height/2.
    // So, maxRadius is based on min(width/2, height/2) effectively.
    // Let's ensure labels have space.
    const drawableWidth = containerWidth - chartMargins.left - chartMargins.right;
    const drawableHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    // For a semicircle, radius is more constrained by width, or by height if it's a tall semicircle.
    // Since it's centered at H/2, radius is min(W/2, H/2) after label space.
    // Max radius for the donut itself, labels will be outside this.
    const labelOffsetForRadius = 60; // Approximate space needed for external labels
    const maxRadius = Math.min(drawableWidth / 2, drawableHeight) - labelOffsetForRadius;
    
    mainChartGroup.attr("transform", `translate(${centerX}, ${centerY})`);
    
    const innerRadiusFactor = 0.5;
    const innerRadius = maxRadius * innerRadiusFactor;

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const dataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) // Preserve original data order
        .startAngle(-Math.PI / 2) // -90 degrees (top)
        .endAngle(Math.PI / 2);   // 90 degrees (bottom)

    const arcGenerator = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(maxRadius)
        .padAngle(0.02); // Small padding between segments

    const sectorsData = pieGenerator(dataWithPercentages);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per simplification.
    const defs = mainChartGroup.append("defs");

    // Block 8: Main Data Visualization Rendering
    const segmentGroups = mainChartGroup.selectAll(".segment-group")
        .data(sectorsData)
        .join("g")
        .attr("class", "segment-group");

    segmentGroups.each(function(d, i) {
        const segmentGroup = d3.select(this);
        const category = d.data[categoryFieldName];

        // Render segment path
        segmentGroup.append("path")
            .attr("d", arcGenerator(d))
            .attr("fill", fillStyle.getSegmentColor(category, i))
            .attr("stroke", fillStyle.segmentStrokeColor)
            .attr("stroke-width", 2)
            .attr("class", "mark segment");

        // Render image inside segment (if available)
        const imageUrl = fillStyle.getSegmentImage(category);
        if (imageUrl) {
            const clipId = `clip-segment-${i}`;
            defs.append("clipPath")
                .attr("id", clipId)
                .append("path")
                .attr("d", arcGenerator(d));

            const segmentCentroid = arcGenerator.centroid(d);
            
            // Calculate a reasonable size for the image within the segment
            const angleSpan = d.endAngle - d.startAngle;
            const avgRadius = (innerRadius + maxRadius) / 2;
            // Approximate width of segment at its average radius
            let imageSize = Math.min(angleSpan * avgRadius * 0.8, maxRadius - innerRadius); 
            imageSize = Math.max(10, imageSize); // Ensure a minimum size

            segmentGroup.append("image")
                .attr("xlink:href", imageUrl)
                .attr("clip-path", `url(#${clipId})`)
                .attr("x", segmentCentroid[0] - imageSize / 2)
                .attr("y", segmentCentroid[1] - imageSize / 2)
                .attr("width", imageSize)
                .attr("height", imageSize)
                .attr("class", "image segment-image");
        }

        // Render external labels (category and percentage)
        if (d.data.percentage > 0) { // Only show labels for non-zero segments
            const [labelX, labelY] = calculateLabelPosition(d, maxRadius, 20); // 20px offset from outer radius

            // Determine max width for labels based on proximity to chart edge or other labels
            // This is a heuristic; more complex label collision detection is out of scope here.
            // Max width could be related to distance from center or a fixed portion of chart radius.
            const availableSpaceForLabel = Math.max(30, maxRadius * 0.3); // Heuristic for label width

            const categoryTextRaw = String(d.data[categoryFieldName]);
            const percentageTextRaw = d.data.percentage >= 0.1 ? `${d.data.percentage.toFixed(1)}%` : '';

            const fittedCategory = fitTextToWidth(
                categoryTextRaw,
                fillStyle.typography.labelFontSize,
                fillStyle.typography.labelFontWeight,
                fillStyle.typography.labelFontFamily,
                availableSpaceForLabel
            );

            const fittedPercentage = fitTextToWidth(
                percentageTextRaw,
                fillStyle.typography.annotationFontSize, // Use annotation for potentially smaller percentage
                fillStyle.typography.annotationFontWeight,
                fillStyle.typography.annotationFontFamily,
                availableSpaceForLabel
            );
            
            const textAnchor = (d.startAngle + d.endAngle) / 2 < 0 ? "end" : "start"; // Basic left/right anchor

            segmentGroup.append("text")
                .attr("x", labelX)
                .attr("y", labelY - (parseFloat(fittedPercentage.fontSize) / 2 + 2)) // Position category above percentage
                .attr("dy", "0.35em")
                .attr("text-anchor", textAnchor)
                .style("fill", fillStyle.textColor)
                .style("font-family", fittedCategory.fontFamily || fillStyle.typography.labelFontFamily)
                .style("font-size", fittedCategory.fontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .attr("class", "label data-label category-label")
                .text(fittedCategory.text);

            if (fittedPercentage.text) {
                segmentGroup.append("text")
                    .attr("x", labelX)
                    .attr("y", labelY + (parseFloat(fittedCategory.fontSize) / 2 + 2)) // Position percentage below category
                    .attr("dy", "0.35em")
                    .attr("text-anchor", textAnchor)
                    .style("fill", fillStyle.textColor)
                    .style("font-family", fittedPercentage.fontFamily || fillStyle.typography.annotationFontFamily)
                    .style("font-size", fittedPercentage.fontSize)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .attr("class", "label data-label percentage-label")
                    .text(fittedPercentage.text);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No additional enhancements like tooltips or complex interactions in this refactoring.
    // Main title/subtitle rendering is disallowed.

    // Block 10: Cleanup & SVG Node Return
    // _textMeasureSVG is not part of the main DOM, so no cleanup needed for it here.
    return svgRoot.node();
}
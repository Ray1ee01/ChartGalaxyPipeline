/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_24",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 10], [0, 100]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldColumn = dataColumns.find(col => col.role === "x");
    const yFieldColumn = dataColumns.find(col => col.role === "y");

    if (!xFieldColumn || !xFieldColumn.name) {
        console.error("Critical chart config missing: X-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: X-axis field name ('x' role) is not configured in data.data.columns.</div>");
        return null;
    }
    if (!yFieldColumn || !yFieldColumn.name) {
        console.error("Critical chart config missing: Y-axis field name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Y-axis field name ('y' role) is not configured in data.data.columns.</div>");
        return null;
    }

    const categoryFieldName = xFieldColumn.name;
    const valueFieldName = yFieldColumn.name;
    const yFieldUnit = yFieldColumn.unit && yFieldColumn.unit !== "none" ? yFieldColumn.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '12px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'bold',
        },
        primaryBarColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#73D2C7',
        textColor: colorsConfig.text_color || '#333333',
        chartBackground: colorsConfig.background_color || '#FFFFFF', // Default to white background
        iconUrls: imagesConfig.field || {} // URLs for icons mapped by field value
    };

    const _canvas = document.createElement('canvas');
    const _ctx = _canvas.getContext('2d');
    function estimateTextWidth(text, fontFamily, fontSizeString, fontWeight) {
        _ctx.font = `${fontWeight || 'normal'} ${fontSizeString} ${fontFamily || 'Arial'}`;
        return _ctx.measureText(text).width;
    }

    function formatValue(value) {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
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
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 150, left: 30 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b.value - a.value); // Sort by value descending

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.0); // Gaussian curves are adjacent

    const yMaxValue = d3.max(chartDataArray, d => d.value);
    const yScale = d3.scaleLinear()
        .domain([0, yMaxValue > 0 ? yMaxValue * 1.1 : 1]) // Add 10% headroom, handle all zero values
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (Axes, Gridlines, Legend - Not applicable for this chart)
    // No explicit axes, gridlines, or legend as per simplified design. 
    // Category labels (Block 8) serve as X-axis markings. Value labels (Block 8) provide Y-values.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Gaussian curve path generator helper
    function getGaussianPath(d, barCurrentWidth) {
        const x_start = xScale(d.category); // xScale is available in this scope
        const y_top = yScale(d.value);     // yScale is available in this scope
        const bar_height = Math.max(0, innerHeight - y_top);

        if (bar_height <= 0) return ""; // No path for zero or negative height

        const x_center = x_start + barCurrentWidth / 2;
        const y_bottom = innerHeight; // Base of the curve
        const half_width = barCurrentWidth / 2;
        // Sigma chosen so that curve is mostly contained within barCurrentWidth
        const sigma = half_width / 3.2; 
        const samples = 30; // Number of points to sample for the curve
        
        const points = [];
        const step = (half_width * 2) / samples;

        function gaussianPointValue(x, s = 1) { // Gaussian function
            return Math.exp(-(x * x) / (2 * s * s));
        }

        for (let i = 0; i <= samples; i++) {
            const t = -half_width + i * step; // Current position relative to center
            const x_point = x_center + t;
            const gauss_value = gaussianPointValue(t, sigma);
            const y_point = y_bottom - (bar_height * gauss_value); // Modulate height by Gaussian
            points.push({ x: x_point, y: y_point });
        }
        
        const areaGenerator = d3.area()
            .x(p => p.x)
            .y0(y_bottom) // Flat bottom line
            .y1(p => p.y) // Curved top line
            .curve(d3.curveBasis); // Smooth the curve
        
        return areaGenerator(points);
    }
    
    // Render bars (Gaussian curves)
    mainChartGroup.selectAll(".bar-mark")
        .data(chartDataArray)
        .enter()
        .append("path")
        .attr("class", "mark bar-mark") // Standardized class
        .attr("d", d => getGaussianPath(d, xScale.bandwidth()))
        .attr("fill", fillStyle.primaryBarColor);

    // Render value labels on top of bars
    const defaultAnnotationNumFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const minAnnotationNumFontSize = 6; // Smallest allowed font size for value labels

    mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label") // Standardized class
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position 5px above the bar's scaled top
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d.value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            const textElement = d3.select(this);
            let currentFontSize = defaultAnnotationNumFontSize;
            
            if (xScale.bandwidth() > 0) { // Ensure bar width is positive
                const textWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
                const maxWidth = xScale.bandwidth() * 1.1; // Allow slight overflow
                if (textWidth > maxWidth) {
                    currentFontSize = Math.max(minAnnotationNumFontSize, Math.floor(currentFontSize * (maxWidth / textWidth)));
                }
            }
            textElement.style("font-size", `${currentFontSize}px`).text(valueText);
        });

    // X-Axis Category Labels (Dimension Labels) - with font size adjustment and wrapping
    const defaultLabelNumFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const minLabelNumFontSize = 8; 
    const labelFontFamily = fillStyle.typography.labelFontFamily;
    const labelFontWeight = fillStyle.typography.labelFontWeight;
    const lineHeightFactor = 1.2; // For multi-line labels
    
    let finalUniformLabelFontSize = defaultLabelNumFontSize; // Start with default
    // First pass: determine a uniform font size for all category labels if reduction is needed
    if (xScale.bandwidth() > 0 && chartDataArray.length > 0) {
        let maxReductionRatio = 1;
        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const textWidth = estimateTextWidth(labelText, labelFontFamily, `${defaultLabelNumFontSize}px`, labelFontWeight);
            const ratio = textWidth / xScale.bandwidth();
            if (ratio > maxReductionRatio) {
                maxReductionRatio = ratio;
            }
        });

        if (maxReductionRatio > 1) { // If any label is too wide at default size
            finalUniformLabelFontSize = Math.max(minLabelNumFontSize, Math.floor(defaultLabelNumFontSize / maxReductionRatio));
        }
    }
    
    // Second pass: determine max lines needed with the (potentially reduced) uniform font size
    let maxLinesNeeded = 1;
    if (xScale.bandwidth() > 0 && chartDataArray.length > 0) {
        chartDataArray.forEach(d => {
            const labelText = String(d.category);
            const textWidthAtFinalSize = estimateTextWidth(labelText, labelFontFamily, `${finalUniformLabelFontSize}px`, labelFontWeight);
            let currentLabelLines = 1;
            if (textWidthAtFinalSize > xScale.bandwidth()) { // If label still too wide, it needs wrapping
                // Simplified line counting logic (assuming character wrapping if word wrapping fails)
                currentLabelLines = Math.ceil(textWidthAtFinalSize / xScale.bandwidth());
            }
            if (currentLabelLines > maxLinesNeeded) maxLinesNeeded = currentLabelLines;
        });
    }

    const categoryLabelStartY = innerHeight + 20; // Y position for the first line of category labels
    const categoryLabelLineHeight = finalUniformLabelFontSize * lineHeightFactor;

    mainChartGroup.selectAll(".category-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label category-label x-axis-label") // Standardized class
        .attr("text-anchor", "middle")
        .style("font-family", labelFontFamily)
        .style("font-size", `${finalUniformLabelFontSize}px`)
        .style("font-weight", labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const labelText = String(d.category);
            const textElement = d3.select(this);
            const xPos = xScale(d.category) + xScale.bandwidth() / 2;
            const availableWidth = xScale.bandwidth();
            
            const textWidth = estimateTextWidth(labelText, labelFontFamily, `${finalUniformLabelFontSize}px`, labelFontWeight);

            if (textWidth > availableWidth && availableWidth > 0) { // Needs wrapping
                let lines = [];
                let currentLine = '';
                // Try word wrapping first
                const words = labelText.split(/\s+/);
                let wordWrapSuccess = false;
                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, labelFontFamily, `${finalUniformLabelFontSize}px`, labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine);
                            currentLine = words[i];
                            // Check if single word itself is too long
                            if (estimateTextWidth(currentLine, labelFontFamily, `${finalUniformLabelFontSize}px`, labelFontWeight) > availableWidth) {
                                wordWrapSuccess = false; break; // Fallback to char wrap
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine !== '') { lines.push(currentLine); wordWrapSuccess = true; }
                }
                
                // Fallback to character wrapping if word wrap failed or not applicable
                if (!wordWrapSuccess) {
                    lines = []; currentLine = '';
                    const chars = labelText.split('');
                    for (let i = 0; i < chars.length; i++) {
                        const testChar = chars[i];
                        if (estimateTextWidth(currentLine + testChar, labelFontFamily, `${finalUniformLabelFontSize}px`, labelFontWeight) > availableWidth && currentLine !== '') {
                            lines.push(currentLine);
                            currentLine = testChar;
                        } else {
                            currentLine += testChar;
                        }
                    }
                    if (currentLine !== '') lines.push(currentLine);
                }

                lines.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", categoryLabelStartY + i * categoryLabelLineHeight)
                        .attr("dy", "0.71em") // Adjust for vertical alignment of tspan
                        .text(line);
                });
            } else { // No wrapping needed
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", categoryLabelStartY)
                   .attr("dy", "0.71em")
                   .text(labelText);
            }
        });

    // Block 9: Optional Enhancements & Post-Processing (Icons)
    const iconSize = 24;
    // Calculate Y position for icons based on max lines of wrapped labels
    const labelBlockHeight = maxLinesNeeded * categoryLabelLineHeight;
    const iconYPosition = categoryLabelStartY + labelBlockHeight - (categoryLabelLineHeight / 2) + (iconSize / 2) + 5; // 5px spacing below last line of text center

    mainChartGroup.selectAll(".icon-image")
        .data(chartDataArray)
        .enter()
        .append("image")
        .attr("class", "image icon-image") // Standardized class
        .attr("xlink:href", d => fillStyle.iconUrls[d.category] || null)
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2 - iconSize / 2)
        .attr("y", iconYPosition - iconSize / 2) // Center icon vertically at calculated Y
        .attr("width", iconSize)
        .attr("height", iconSize)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .each(function(d) { // Remove image node if href is null (no image for category)
            if (!fillStyle.iconUrls[d.category]) {
                d3.select(this).remove();
            }
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
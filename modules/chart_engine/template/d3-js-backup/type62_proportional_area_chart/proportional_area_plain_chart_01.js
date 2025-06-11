/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart",
  "chart_name": "proportional_area_plain_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
  "dataLabelPosition": "center_element",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear the container

    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Not used in this chart, but extracted per directive
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const xFieldName = xColumn ? xColumn.name : undefined;
    const yFieldName = yColumn ? yColumn.name : undefined;
    const yFieldUnit = yColumn && yColumn.unit && yColumn.unit !== "none" ? yColumn.unit : "";

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role='x')");
        if (!yFieldName) missingFields.push("y field (role='y')");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    const processedChartData = chartData.filter(d => d[yFieldName] != null && +d[yFieldName] > 0);

    if (processedChartData.length === 0) {
        d3.select(containerSelector).html("<div style='font-family: sans-serif; padding: 10px;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
    };

    // Typography
    fillStyle.typography.annotationFontFamily = (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif';
    fillStyle.typography.annotationFontSize = (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px';
    fillStyle.typography.annotationFontWeight = (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold';

    fillStyle.typography.labelFontFamily = (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif';
    fillStyle.typography.labelFontSize = (typography.label && typography.label.font_size) ? typography.label.font_size : '11px';
    fillStyle.typography.labelFontWeight = (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal';

    // Colors
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Not directly used for SVG background, but available
    fillStyle.textColor = colors.text_color || '#333333'; // General text color default
    fillStyle.circleStrokeColor = '#FFFFFF'; // Specific design choice for this chart
    fillStyle.defaultCategoryColor = '#CCCCCC';
    
    const defaultColorPalette = d3.schemeCategory10;
    fillStyle.availableColors = colors.available_colors || defaultColorPalette;

    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if styles are applied directly,
        // but some browsers might be more consistent if it's briefly in a document fragment or similar.
        // For simplicity and to avoid DOM flashes, we'll try without appending to body.
        // If issues arise, one might need to append to a temporary, non-visible part of the DOM.
        document.body.appendChild(tempSvg); // Required for getBBox to work reliably
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    // Helper: Calculate color brightness (0-1)
    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default to medium brightness if color is undefined
        let r, g, b;
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (match) { [, r, g, b] = match.map(Number); } else { return 0.5; }
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) { [, r, g, b] = match.map(Number); } else { return 0.5; }
        } else if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length !== 6) return 0.5;
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return 0.5; // Unknown format
        }
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }

    // Helper: Get contrasting text color
    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Threshold can be adjusted
    }

    // Helper: Calculate chord length
    function getChordLength(radius, distanceFromCenter) {
        if (Math.abs(distanceFromCenter) >= radius) return 0;
        return 2 * Math.sqrt(radius * radius - distanceFromCenter * distanceFromCenter);
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg");
        // No viewBox, no preserveAspectRatio, no % widths/heights

    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxTotalCircleArea = innerWidth * innerHeight * 0.5; // 50% of drawing area
    const minRadius = 5;
    const maxRadius = Math.min(innerWidth, innerHeight) / 3; // Max radius relative to drawing area

    const TOP_PROTECTED_AREA = variables.topProtectedArea !== undefined ? variables.topProtectedArea : 30; // Internal simulation boundary

    // Block 5: Data Preprocessing & Transformation
    // Initial radius scale (pre-adjustment)
    const tempRadiusScale = d3.scaleSqrt()
        .domain([0, d3.max(processedChartData, d => +d[yFieldName])])
        .range([minRadius, maxRadius * 0.8]); // Use 80% of maxRadius initially

    let nodes = processedChartData.map((d, i) => {
        const value = +d[yFieldName];
        const radius = Math.max(minRadius, tempRadiusScale(value)); // Ensure minRadius
        const category = d[xFieldName];
        return {
            id: category != null ? String(category) : `__node_${i}__`,
            value: value,
            radius: radius,
            area: Math.PI * radius * radius,
            category: category,
            originalData: d
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.radius = Math.max(minRadius, node.radius); // Re-ensure minRadius after scaling
            node.area = Math.PI * node.radius * node.radius;
        });
        nodes.sort((a, b) => b.radius - a.radius); // Re-sort after radius adjustment
    }
    
    // Force simulation
    const simulation = d3.forceSimulation(nodes)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", d3.forceCollide().radius(d => d.radius + 1).strength(0.95)) // +1 for a little padding
        .force("radial", d3.forceRadial(Math.min(innerWidth, innerHeight) * 0.3, innerWidth / 2, innerHeight / 2).strength(0.1))
        .stop();

    if (nodes.length > 0) {
        nodes[0].fx = innerWidth / 2;
        nodes[0].fy = innerHeight / 2;
    }
    if (nodes.length > 1) {
        const angleStep = 2 * Math.PI / (nodes.length -1); // For remaining nodes
        let spiralRadiusStep = Math.min(innerWidth, innerHeight) * 0.15;
        let currentSpiralRadius = spiralRadiusStep;
        for (let i = 1; i < nodes.length; i++) {
            const angle = (i-1) * angleStep; // Start angle from 0 for (i-1)
            nodes[i].x = innerWidth / 2 + currentSpiralRadius * Math.cos(angle);
            nodes[i].y = innerHeight / 2 + currentSpiralRadius * Math.sin(angle);
            if (i % 5 === 0) { // Expand spiral every 5 nodes
                currentSpiralRadius += spiralRadiusStep;
            }
        }
    }
    
    const NUM_ITERATIONS = 200;
    for (let i = 0; i < NUM_ITERATIONS; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) { // If node is not fixed
                d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
            }
            if (!d.fy) { // If node is not fixed
                 // Ensure y is within innerHeight, respecting TOP_PROTECTED_AREA from the top of innerHeight
                d.y = Math.max(TOP_PROTECTED_AREA + d.radius, Math.min(innerHeight - d.radius, d.y));
            }
        });
    }


    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(nodes.map(d => d.category))];
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueCategories)
        .range(uniqueCategories.map((cat, i) => {
            if (colors.field && colors.field[cat]) {
                return colors.field[cat];
            }
            return fillStyle.availableColors[i % fillStyle.availableColors.length];
        }));
    
    nodes.forEach(node => {
        node.color = colorScale(node.category);
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for axes, gridlines, or legend in this chart type.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "chart-group");

    const nodeGroups = mainChartGroup.selectAll("g.mark-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "mark-group")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeGroups.append("circle")
        .attr("class", "mark")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.circleStrokeColor)
        .attr("stroke-width", 1.5);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const baseLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    
    const minAcceptableFontSize = 8;
    const minRadiusForCategoryLabel = 10; // Circle must be at least this big for category label
    const fontSizeToRadiusRatio = 0.38; // Heuristic: font size scales with radius
    const maxAllowedFontSize = 28;
    const categoryLineHeightFactor = 0.3; // Multiplier for line height (0.3 means 1.3em line height)

    nodeGroups.each(function(d_node) {
        const groupElement = d3.select(this);
        const radius = d_node.radius;
        const valueText = `${d_node.value}${yFieldUnit}`;
        const categoryText = (d_node.id && d_node.id.startsWith("__node_")) ? "" : String(d_node.category);
        
        const adaptiveTextColor = getTextColorForBackground(d_node.color);

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                radius * fontSizeToRadiusRatio,
                (baseAnnotationFontSize + baseLabelFontSize) / 2, // Average of configured sizes
                maxAllowedFontSize
            )
        );

        let valueFits, categoryFitsOverall;
        let categoryLines = []; // To store wrapped lines for category

        // Iteratively adjust font size
        while (currentFontSize >= minAcceptableFontSize) {
            const estValueY = categoryText ? currentFontSize * 0.55 : 0; // Simplified Y for value
            const estCategoryY = categoryText ? -currentFontSize * 0.55 : 0; // Simplified Y for category

            const valueWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
            const maxValueWidth = getChordLength(radius, Math.abs(estValueY)) * 0.9; // 90% of chord length
            valueFits = valueWidth <= maxValueWidth;

            categoryFitsOverall = !categoryText; // If no category text, it fits
            if (categoryText) {
                categoryLines = []; // Reset lines
                const categoryInitialWidth = estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                const maxCategoryWidthAtLine0 = getChordLength(radius, Math.abs(estCategoryY)) * 0.90;

                if (categoryInitialWidth <= maxCategoryWidthAtLine0) {
                    categoryLines.push(categoryText);
                    categoryFitsOverall = true;
                } else { // Try to wrap category text
                    const words = categoryText.split(/\s+/);
                    let currentLine = "";
                    let fitsWithWrapping = true;

                    if (words.length <=1 && categoryText.length > 0) { // Try char wrapping for single long word
                        const chars = categoryText.split('');
                        let tempLine = '';
                        for (let k=0; k < chars.length; k++) {
                            const testCharLine = tempLine + chars[k];
                            const currentLineYOffset = estCategoryY + (categoryLines.length * currentFontSize * (1 + categoryLineHeightFactor));
                            const maxWThisLine = getChordLength(radius, Math.abs(currentLineYOffset)) * 0.90;
                            if (estimateTextWidth(testCharLine, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) <= maxWThisLine || tempLine.length === 0) {
                                tempLine += chars[k];
                            } else {
                                categoryLines.push(tempLine);
                                tempLine = chars[k];
                                if (categoryLines.length * currentFontSize * (1 + categoryLineHeightFactor) > radius * 1.8) { // Too many lines
                                    fitsWithWrapping = false; break;
                                }
                            }
                        }
                        if (fitsWithWrapping && tempLine) categoryLines.push(tempLine);

                    } else { // Word wrapping
                        for (let k = 0; k < words.length; k++) {
                            const testLine = currentLine ? `${currentLine} ${words[k]}` : words[k];
                            const currentLineYOffset = estCategoryY + (categoryLines.length * currentFontSize * (1 + categoryLineHeightFactor));
                            const maxWThisLine = getChordLength(radius, Math.abs(currentLineYOffset)) * 0.90;

                            if (estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) <= maxWThisLine) {
                                currentLine = testLine;
                            } else {
                                if (currentLine) categoryLines.push(currentLine);
                                currentLine = words[k];
                                // Check if the new word itself is too long for a new line
                                if (estimateTextWidth(currentLine, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > maxWThisLine) {
                                     fitsWithWrapping = false; break; // Single word too long
                                }
                                if (categoryLines.length * currentFontSize * (1 + categoryLineHeightFactor) > radius * 1.8) { // Too many lines
                                    fitsWithWrapping = false; break;
                                }
                            }
                        }
                        if (fitsWithWrapping && currentLine) categoryLines.push(currentLine);
                    }
                    categoryFitsOverall = fitsWithWrapping && categoryLines.length > 0 && categoryLines.length <=3; // Max 3 lines for category
                }
            }
            
            if (valueFits && categoryFitsOverall) break; // Both fit
            currentFontSize -= 1; // Reduce font size and retry
        }
        
        const finalFontSize = currentFontSize;
        const showValue = valueFits && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryText && categoryFitsOverall && finalFontSize >= minAcceptableFontSize && radius >= minRadiusForCategoryLabel;

        let valueY = 0;
        let categoryStartY = 0;
        const categoryTotalHeight = categoryLines.length * finalFontSize * (1 + categoryLineHeightFactor) - (categoryLines.length > 0 ? finalFontSize * categoryLineHeightFactor : 0) ; // Total height of category block

        if (showValue && showCategory) {
            const totalTextHeight = categoryTotalHeight + finalFontSize + (finalFontSize * 0.2); // cat + val + small gap
            categoryStartY = -totalTextHeight / 2;
            valueY = categoryStartY + categoryTotalHeight + (finalFontSize * 0.2);
        } else if (showValue) {
            valueY = 0; // Centered vertically
        } else if (showCategory) {
            categoryStartY = -categoryTotalHeight / 2;
        }

        if (showValue) {
            groupElement.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", valueY)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valueText);
        }

        if (showCategory) {
            const categoryLabelGroup = groupElement.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", categoryStartY) // Initial Y for the first line
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none");

            categoryLines.forEach((line, i) => {
                categoryLabelGroup.append("tspan")
                    .attr("x", 0)
                    .attr("dy", i === 0 ? 0 : `${1 + categoryLineHeightFactor}em`) // Relative dy for subsequent lines
                    .text(line);
            });
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
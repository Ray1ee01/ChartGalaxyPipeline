/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_06",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
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
    const rawData = data.data || {};
    let chartData = rawData.data || [];
    const dataColumns = rawData.columns || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed via colors_dark
    const images = data.images || {}; // Not used in this chart, but parsed for completeness

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const xField = xColumn?.name;
    const yField = yColumn?.name;
    const yUnit = (yColumn?.unit && yColumn.unit !== "none") ? yColumn.unit : "";

    let criticalMissingFields = [];
    if (!xField) criticalMissingFields.push("xField (role: 'x')");
    if (!yField) criticalMissingFields.push("yField (role: 'y')");

    if (criticalMissingFields.length > 0) {
        console.error(`Critical chart config missing: ${criticalMissingFields.join(', ')}. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (${criticalMissingFields.join(', ')}).</div>`);
        }
        return null;
    }

    d3.select(containerSelector).html(""); // Clear the container

    chartData = chartData.filter(d => d[yField] != null && +d[yField] > 0);
    if (chartData.length === 0) {
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='text-align:center; padding: 20px;'>No valid data to display.</div>");
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {},
        images: {} // For potential future use or consistency
    };

    // Default typography
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }, // For category labels
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" } // For value labels
    };

    fillStyle.typography.categoryLabelFontFamily = (typography.label && typography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.categoryLabelFontSize = (typography.label && typography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.categoryLabelFontWeight = (typography.label && typography.label.font_weight) || defaultTypography.label.font_weight;

    fillStyle.typography.dataValueFontFamily = (typography.annotation && typography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.dataValueFontSize = (typography.annotation && typography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.dataValueFontWeight = (typography.annotation && typography.annotation.font_weight) || defaultTypography.annotation.font_weight;
    
    // Default colors
    const defaultColors = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };

    fillStyle.colors.textColor = colors.text_color || defaultColors.text_color;
    fillStyle.colors.chartBackground = colors.background_color || defaultColors.background_color; // Not directly used for SVG bg
    fillStyle.colors.defaultCategoricalScheme = colors.available_colors || defaultColors.available_colors;
    
    function getCategoryColor(categoryName, index) {
        if (colors.field && colors.field[categoryName]) {
            return colors.field[categoryName];
        }
        return fillStyle.colors.defaultCategoricalScheme[index % fillStyle.colors.defaultCategoricalScheme.length];
    }

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Temporarily append to measure
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            console.warn("estimateTextWidth getBBox failed, using fallback:", e);
            width = text.length * (parseFloat(fontSize) * 0.6); // Crude fallback
        }
        // tempSvg.remove();
        return width;
    }
    
    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default to medium brightness if color is undefined
        let r, g, b;
        if (colorStr.startsWith('rgba')) {
            const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
            if (!match) return 0.5;
            r = parseInt(match[1]); g = parseInt(match[2]); b = parseInt(match[3]);
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (!match) return 0.5;
            r = parseInt(match[1]); g = parseInt(match[2]); b = parseInt(match[3]);
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

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Prefer black on light, white on dark
    }

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
        .attr("class", "proportional-area-chart-svg");
        // No viewBox, no preserveAspectRatio as per requirements

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.margin_top || 30, right: variables.margin_right || 20, bottom: variables.margin_bottom || 30, left: variables.margin_left || 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const maxTotalCircleArea = innerWidth * innerHeight * 0.5;
    const minRadius = variables.min_radius || 5;
    const maxRadius = variables.max_radius || innerHeight / 3;
    const TOP_PROTECTED_AREA = variables.top_protected_area || 10; // Reduced as no titles

    // Block 5: Data Preprocessing & Transformation
    const uniqueCategories = [...new Set(chartData.map(d => d[xField]))];
    
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(chartData, d => +d[yField])])
        .range([minRadius, maxRadius * 0.8]); // Initial max radius slightly less to allow for adjustment

    let nodes = chartData.map((d, i) => {
        const value = +d[yField];
        const radius = radiusScale(value);
        const categoryName = String(d[xField] != null ? d[xField] : `__${i}__`);
        return {
            id: categoryName,
            value: value,
            radius: radius,
            area: Math.PI * radius * radius,
            color: getCategoryColor(String(d[xField]), uniqueCategories.indexOf(d[xField])),
            rawDataPoint: d
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalCircleArea) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }
    
    // Block 6: Scale Definition & Configuration
    // (Radius scale already defined and used in Block 5)
    // (Color scale logic embedded in getCategoryColor and node mapping)

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type as per original and simplification.

    // Block 8: Main Data Visualization Rendering (Force Simulation & Circles)
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.05))
        .force("charge", d3.forceManyBody().strength(-10))
        .force("collide", d3.forceCollide().radius(d => d.radius - 5).strength(0.9)) // Allow slight overlap
        .stop();

    const centralCircleRadius = Math.min(innerWidth, innerHeight) * 0.25;

    if (nodes.length > 0) {
        const totalAngle = 2 * Math.PI;
        const angleStep = totalAngle / nodes.length;
        for (let i = 0; i < nodes.length; i++) {
            const angle = i * angleStep;
            const node = nodes[i];
            const distance = centralCircleRadius + node.radius + 10;
            node.x = innerWidth / 2 + distance * Math.cos(angle);
            node.y = innerHeight / 2 + distance * Math.sin(angle);
            if (i < nodes.length / 3) { // Fix larger nodes
                node.fx = node.x;
                node.fy = node.y;
            }
        }
    }

    simulation.nodes(nodes);

    const MIN_ITERATIONS = variables.simulation_iterations || 200;
    for (let i = 0; i < MIN_ITERATIONS; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) { // If node is not fixed
                // Custom force to keep nodes in a ring
                const dx = d.x - innerWidth / 2;
                const dy = d.y - innerHeight / 2;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const targetDistance = centralCircleRadius + d.radius + 10; // Target distance from center
                const factor = 0.1; // Strength of pull towards target distance
                
                if (Math.abs(currentDistance - targetDistance) > d.radius * 0.2) {
                     const angleToCenter = Math.atan2(dy, dx);
                     d.x = innerWidth/2 + (currentDistance * (1 - factor) + targetDistance * factor) * Math.cos(angleToCenter);
                     d.y = innerHeight/2 + (currentDistance * (1 - factor) + targetDistance * factor) * Math.sin(angleToCenter);
                }

                // Boundary constraints
                d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
                d.y = Math.max(TOP_PROTECTED_AREA + d.radius, Math.min(innerHeight - d.radius, d.y));
            }
        });
    }

    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "node-group mark") // Added 'mark' class for the group
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeGroups.append("circle")
        .attr("class", "mark data-circle")
        .attr("r", d => d.radius)
        .style("fill", d => d.color)
        .style("stroke", "#fff") // Hardcoded white stroke for contrast
        .style("stroke-width", 1.0);

    // Block 9: Optional Enhancements & Post-Processing (Text Labels)
    const minAcceptableFontSize = variables.min_label_font_size || 8;
    const minRadiusForCategoryLabel = variables.min_radius_for_category_label || 5;
    const fontSizeScaleFactor = variables.label_font_size_scale_factor || 0.38;
    const maxLabelFontSize = variables.max_label_font_size || 28;
    const categoryLabelLineHeightFactor = variables.category_label_line_height_factor || 0.3; // Factor for dy in tspan
    const allowCategoryLabelWrapping = variables.allow_category_label_wrapping !== undefined ? variables.allow_category_label_wrapping : true;

    nodeGroups.each(function(d_node) { // d_node is an element from the 'nodes' array
        const groupElement = d3.select(this);
        const circleRadius = d_node.radius;
        const valueText = `${d_node.value}${yUnit}`;
        let categoryText = d_node.id.startsWith("__") ? "" : d_node.id;
        
        const adaptiveTextColor = getTextColorForBackground(d_node.color);

        let currentFontSizeNum = Math.max(
            minAcceptableFontSize,
            Math.min(
                circleRadius * fontSizeScaleFactor,
                (parseFloat(fillStyle.typography.dataValueFontSize) + parseFloat(fillStyle.typography.categoryLabelFontSize)) / 2,
                maxLabelFontSize
            )
        );

        let valueTextWidth, categoryTextWidth, categoryLines, categoryLabelHeight, shouldWrapCategory;
        let valueFits, categoryFits, categoryMaxWidthForLine, valueMaxWidthForLine;

        const catFontFamily = fillStyle.typography.categoryLabelFontFamily;
        const catFontWeight = fillStyle.typography.categoryLabelFontWeight;
        const valFontFamily = fillStyle.typography.dataValueFontFamily;
        const valFontWeight = fillStyle.typography.dataValueFontWeight;

        while (currentFontSizeNum >= minAcceptableFontSize) {
            let currentFontSizePx = `${currentFontSizeNum}px`;
            valueTextWidth = estimateTextWidth(valueText, valFontFamily, currentFontSizePx, valFontWeight);
            categoryTextWidth = categoryText ? estimateTextWidth(categoryText, catFontFamily, currentFontSizePx, catFontWeight) : 0;
            
            categoryLines = 1;
            categoryLabelHeight = currentFontSizeNum;
            shouldWrapCategory = false;

            const estimatedCategoryY = categoryText ? -currentFontSizeNum * 0.55 : 0;
            const estimatedValueY = categoryText ? currentFontSizeNum * 0.55 : 0;

            valueMaxWidthForLine = getChordLength(circleRadius, Math.abs(estimatedValueY)) * 0.9;
            categoryMaxWidthForLine = categoryText ? getChordLength(circleRadius, Math.abs(estimatedCategoryY)) * 0.9 : 0;
            
            valueFits = valueTextWidth <= valueMaxWidthForLine;
            categoryFits = !categoryText || categoryTextWidth <= categoryMaxWidthForLine;

            if (categoryText && !categoryFits && allowCategoryLabelWrapping && currentFontSizeNum >= (variables.min_font_size_for_wrapping || 10)) {
                shouldWrapCategory = true;
                const words = categoryText.split(/\s+/);
                let linesArray = [];
                let currentLineArray = [];
                let tempLineText;
                let fitsWithWrapping = true;

                const processTokens = (tokens) => {
                    while (tokens.length > 0) {
                        const token = tokens.shift();
                        currentLineArray.push(token);
                        tempLineText = currentLineArray.join(words.length > 1 ? " " : "");
                        // Max width for current potential line (approximate, could refine if y changes significantly per line)
                        const maxWidthForThisLine = getChordLength(circleRadius, Math.abs(estimatedCategoryY + (linesArray.length * currentFontSizeNum * (1 + categoryLabelLineHeightFactor)))) * 0.9;

                        if (estimateTextWidth(tempLineText, catFontFamily, currentFontSizePx, catFontWeight) > maxWidthForThisLine) {
                            if (currentLineArray.length > 1) { // Word/char caused overflow
                                currentLineArray.pop(); // Remove the word/char that caused overflow
                                linesArray.push(currentLineArray.join(words.length > 1 ? " " : ""));
                                currentLineArray = [token]; // Start new line with this word/char
                            } else { // Single word/char is too long
                                linesArray.push(token); // Add it anyway (or could truncate)
                                currentLineArray = [];
                            }
                        }
                        if ((linesArray.length + 1) * currentFontSizeNum * (1 + categoryLabelLineHeightFactor) > circleRadius * 1.8) { // Check total height
                            fitsWithWrapping = false; break;
                        }
                    }
                    if (fitsWithWrapping && currentLineArray.length > 0) linesArray.push(currentLineArray.join(words.length > 1 ? " " : ""));
                };
                
                if (words.length <= 1 && categoryText.length > 0) { // Single word or no spaces, try char wrapping
                    processTokens(categoryText.split(''));
                } else { // Word wrapping
                    processTokens(words);
                }

                if (fitsWithWrapping && linesArray.length > 0) {
                    categoryLines = linesArray.length;
                    categoryLabelHeight = categoryLines * currentFontSizeNum * (1 + categoryLabelLineHeightFactor) - (currentFontSizeNum * categoryLabelLineHeightFactor); // Adjusted height
                    categoryFits = true;
                } else {
                    categoryFits = false; shouldWrapCategory = false;
                }
            } else if (categoryText && !categoryFits) {
                shouldWrapCategory = false;
            }

            if (valueFits && categoryFits) break;
            currentFontSizeNum -= 1;
        }

        const finalFontSizePx = `${currentFontSizeNum}px`;
        const showValue = valueTextWidth <= valueMaxWidthForLine && currentFontSizeNum >= minAcceptableFontSize;
        const showCategory = categoryText && currentFontSizeNum >= minAcceptableFontSize && 
                             (categoryTextWidth <= categoryMaxWidthForLine || shouldWrapCategory) && 
                             circleRadius >= minRadiusForCategoryLabel;

        let finalValueY = 0, finalCategoryY = 0;
        if (showValue && showCategory) {
            const totalHeight = categoryLabelHeight + currentFontSizeNum + (currentFontSizeNum * categoryLabelLineHeightFactor * 0.5); // cat height + val height + spacing
            const startY = -totalHeight / 2;
            finalCategoryY = startY;
            finalValueY = startY + categoryLabelHeight + (currentFontSizeNum * categoryLabelLineHeightFactor * 0.5);
        } else if (showValue) {
            finalValueY = -currentFontSizeNum / 2; // Center vertically considering hanging baseline
        } else if (showCategory) {
            finalCategoryY = -categoryLabelHeight / 2; // Center multi-line block
        }
        
        if (showValue) {
            groupElement.append("text")
                .attr("class", "value data-value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", finalFontSizePx)
                .style("font-weight", valFontWeight)
                .style("font-family", valFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valueText);
        }

        if (showCategory) {
            const categoryLabelElement = groupElement.append("text")
                .attr("class", "label category-name-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-size", finalFontSizePx)
                .style("font-weight", catFontWeight)
                .style("font-family", catFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none");

            if (shouldWrapCategory) {
                const wordsForWrapping = categoryText.split(/\s+/);
                let currentLineTokens = [];
                let tspanLineNumber = 0;
                let tspanElement = categoryLabelElement.append("tspan").attr("x", 0).attr("dy", 0);

                const processTspanTokens = (tokens) => {
                    while (tokens.length > 0) {
                        const token = tokens.shift();
                        currentLineTokens.push(token);
                        const testLineText = currentLineTokens.join(wordsForWrapping.length > 1 ? " " : "");
                        const maxWidthForTspanLine = getChordLength(circleRadius, Math.abs(finalCategoryY + (tspanLineNumber * currentFontSizeNum * (1 + categoryLabelLineHeightFactor)) + currentFontSizeNum * 0.5 /* approx center of line */ )) * 0.9;

                        if (estimateTextWidth(testLineText, catFontFamily, finalFontSizePx, catFontWeight) > maxWidthForTspanLine) {
                            if (currentLineTokens.length > 1) {
                                currentLineTokens.pop();
                                tspanElement.text(currentLineTokens.join(wordsForWrapping.length > 1 ? " " : ""));
                                tspanLineNumber++;
                                currentLineTokens = [token];
                                tspanElement = categoryLabelElement.append("tspan")
                                    .attr("x", 0)
                                    .attr("dy", `${1 + categoryLabelLineHeightFactor}em`)
                                    .text(token);
                            } else { // Single token too long
                                tspanElement.text(token); // Render it and move to next line if more tokens
                                if (tokens.length > 0) { // If there are more tokens, start a new line
                                     tspanLineNumber++;
                                     currentLineTokens = [];
                                     tspanElement = categoryLabelElement.append("tspan")
                                        .attr("x", 0)
                                        .attr("dy", `${1 + categoryLabelLineHeightFactor}em`);
                                } else { // No more tokens
                                    currentLineTokens = []; // Clear for safety
                                }
                            }
                        } else {
                            tspanElement.text(testLineText);
                        }
                    }
                    if (currentLineTokens.length > 0 && tspanElement.text() !== currentLineTokens.join(wordsForWrapping.length > 1 ? " " : "")) {
                         // This case might happen if the loop finishes with content in currentLineTokens not yet set to the last tspan
                         // However, the logic above should handle setting the text in each iteration.
                         // If not, ensure the last tspan has the remaining text.
                         tspanElement.text(currentLineTokens.join(wordsForWrapping.length > 1 ? " " : ""));
                    }
                };
                
                if (wordsForWrapping.length <= 1 && categoryText.length > 0) {
                    processTspanTokens(categoryText.split(''));
                } else {
                    processTspanTokens(wordsForWrapping);
                }

            } else {
                categoryLabelElement.text(categoryText);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart",
  "chart_name": "proportional_area_chart_other_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
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
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming light theme preference if both exist
    const images = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y")?.unit ?? "";

    if (!categoryFieldName || !valueFieldName) {
        const errorMessage = `Critical chart config missing: ${!categoryFieldName ? "x-field name " : ""}${!valueFieldName ? "y-field name" : ""}. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMessage}</div>`);
        return null;
    }

    let chartDataArray = chartDataInput.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: {}
    };

    // Typography
    fillStyle.typography.valueFontFamily = typography.annotation?.font_family || 'Arial, sans-serif';
    fillStyle.typography.valueFontSizeBase = parseFloat(typography.annotation?.font_size || '12');
    fillStyle.typography.valueFontWeight = typography.annotation?.font_weight || 'bold';

    fillStyle.typography.categoryFontFamily = typography.label?.font_family || 'Arial, sans-serif';
    fillStyle.typography.categoryFontSizeBase = parseFloat(typography.label?.font_size || '11');
    fillStyle.typography.categoryFontWeight = typography.label?.font_weight || 'normal';
    
    fillStyle.textColor = colors.text_color || '#FFFFFF'; // Default to white for placing on colored shapes
    fillStyle.chartBackground = colors.background_color || '#FFFFFF'; // Not directly used for chart background, but good to have

    // Colors
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const defaultColorPalette = d3.schemeTableau10;

    fillStyle.colors.getDropletColor = (category) => {
        if (colors.field && colors.field[category]) {
            return colors.field[category];
        }
        if (colors.available_colors && colors.available_colors.length > 0) {
            const catIndex = uniqueCategories.indexOf(category);
            return colors.available_colors[catIndex % colors.available_colors.length];
        }
        const catIndex = uniqueCategories.indexOf(category);
        return defaultColorPalette[catIndex % defaultColorPalette.length];
    };
    fillStyle.colors.dropletStroke = '#FFFFFF';


    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but per spec, must not append to DOM. This might be less accurate.
        // For truly accurate measurement without DOM append, canvas is better, but spec asks for SVG.
        try {
            return textEl.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM
            return text.length * parseFloat(fontSize) * 0.6; // Rough estimate
        }
    }

    function createDropPath(radius) {
        const scale = radius * 2 / 960; // Original path assumed to be ~960 units wide/high
        // Path centered around (0,0) after scaling
        // Original path: M505.328 61.552S191.472 464.832 191.856 632.944c0.416 181.296 149.408 327.84 319.168 327.392 169.744-0.464 322.192-147.824 321.776-329.12-0.416-173.744-327.472-569.664-327.472-569.664z
        // Centering offset for original path (approx. 512, 512)
        const ox = 512, oy = 512;
        return `
            M${(505.328 - ox) * scale} ${(61.552 - oy) * scale}
            S${(191.472 - ox) * scale} ${(464.832 - oy) * scale} ${(191.856 - ox) * scale} ${(632.944 - oy) * scale}
            c${0.416 * scale} ${181.296 * scale} ${149.408 * scale} ${327.84 * scale} ${319.168 * scale} ${327.392 * scale}
            c${169.744 * scale} ${-0.464 * scale} ${322.192 * scale} ${-147.824 * scale} ${321.776 * scale} ${-329.12 * scale}
            c${-0.416 * scale} ${-173.744 * scale} ${-327.472 * scale} ${-569.664 * scale} ${-327.472 * scale} ${-569.664 * scale}
            z
        `;
    }

    function getColorBrightness(colorStr) {
        let r, g, b;
        if (colorStr.startsWith('#')) {
            let hex = colorStr.substring(1);
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (!match) return 0.5; // Default brightness
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        } else {
            return 0.5; // Unknown format
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255; // Perceived brightness
    }

    function getAdaptiveTextColor(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Standard contrast choices
    }
    
    function getChordLength(radius, distanceFromCenterY) {
        const maxHeight = radius * 2;
        if (Math.abs(distanceFromCenterY) >= maxHeight / 2) return 0;
        const normalizedY = distanceFromCenterY / (maxHeight / 2); // -1 (top) to 1 (bottom)
        let widthRatio;
        if (normalizedY < -0.5) widthRatio = 0.1 + 0.3 * (1 + normalizedY);
        else if (normalizedY < 0) widthRatio = 0.4 + 0.3 * (1 + normalizedY * 2);
        else widthRatio = 0.7 + 0.2 * (1 - Math.pow(normalizedY, 2));
        return radius * 2 * widthRatio;
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 600;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "proportional-area-chart-svg");
    
    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Reduced margins as no titles/axes
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const maxTotalCircleArea = innerWidth * innerHeight * 0.5;
    const minRadius = 5;
    const maxRadius = Math.min(innerWidth, innerHeight) / 3;

    // Block 5: Data Preprocessing & Transformation
    const radiusScaleInitial = d3.scaleSqrt()
        .domain([0, d3.max(chartDataArray, d => +d[valueFieldName]) || 1]) // Ensure domain max is at least 1
        .range([minRadius, maxRadius * 0.8]);

    let nodes = chartDataArray.map((d, i) => {
        const val = +d[valueFieldName];
        const r = radiusScaleInitial(val);
        return {
            id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__${i}__`,
            value: val,
            radius: r,
            area: Math.PI * r * r,
            color: fillStyle.colors.getDropletColor(d[categoryFieldName]),
            originalData: d
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodes, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodes.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }
    
    // Force Simulation
    const simulation = d3.forceSimulation()
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", d3.forceCollide().radius(d => d.radius + 2).strength(0.95)) // +2 for a bit of spacing
        .force("radial", d3.forceRadial(Math.min(innerWidth, innerHeight) * 0.3, innerWidth / 2, innerHeight / 2).strength(0.1))
        .stop();

    if (nodes.length > 0) {
        nodes[0].fx = innerWidth / 2;
        nodes[0].fy = innerHeight / 2;
    }
    if (nodes.length > 1) {
        const angleStep = 2 * Math.PI / (nodes.length - 1);
        let radiusStep = Math.min(innerWidth, innerHeight) * 0.15;
        let currentSpiralRadius = radiusStep;
        for (let i = 1; i < nodes.length; i++) {
            const angle = i * angleStep;
            nodes[i].x = innerWidth / 2 + currentSpiralRadius * Math.cos(angle);
            nodes[i].y = innerHeight / 2 + currentSpiralRadius * Math.sin(angle);
            if (i % 5 === 0) currentSpiralRadius += radiusStep;
        }
    }

    simulation.nodes(nodes);
    const numIterations = 200;
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodes.forEach(d => {
            if (!d.fx) d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
            if (!d.fy) d.y = Math.max(d.radius, Math.min(innerHeight - d.radius, d.y));
        });
    }

    // Block 6: Scale Definition & Configuration
    // `radiusScaleInitial` already defined in Block 5 for preprocessing.
    // `colorScale` is effectively `fillStyle.colors.getDropletColor`.

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodes, d => d.id)
        .join("g")
        .attr("class", "node-group")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeGroups.append("path")
        .attr("class", "mark droplet-path")
        .attr("d", d => createDropPath(d.radius))
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.colors.dropletStroke)
        .attr("stroke-width", 0.8);

    // Text rendering logic
    const minAcceptableFontSize = 8;
    const minRadiusForCategoryLabel = 5;
    const fontSizeScaleFactor = 0.38;
    const maxFontSize = 28;
    const categoryLineHeightFactor = 0.3; // For tspan dy

    nodeGroups.each(function(dNode) {
        const groupElement = d3.select(this);
        const r = dNode.radius;
        const valueText = `${dNode.value}${valueFieldUnit}`;
        let categoryText = dNode.id.startsWith("__") ? "" : dNode.id;
        
        const adaptiveTextColor = getAdaptiveTextColor(dNode.color);

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                r * fontSizeScaleFactor,
                (fillStyle.typography.valueFontSizeBase + fillStyle.typography.categoryFontSizeBase) / 2,
                maxFontSize
            )
        );

        let valueWidth, categoryWidth, categoryLines = 1, categoryLabelHeight = currentFontSize, shouldWrapCategory = false;
        const verticalTextOffset = r * 0.15; // Shift text slightly up due to droplet shape
        
        let estimatedCategoryY = categoryText ? -currentFontSize * 0.55 - verticalTextOffset : -verticalTextOffset;
        let estimatedValueY = categoryText ? currentFontSize * 0.55 - verticalTextOffset : -verticalTextOffset;


        while (currentFontSize >= minAcceptableFontSize) {
            valueWidth = estimateTextWidth(valueText, fillStyle.typography.valueFontFamily, `${currentFontSize}px`, fillStyle.typography.valueFontWeight);
            categoryWidth = categoryText ? estimateTextWidth(categoryText, fillStyle.typography.categoryFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryFontWeight) : 0;
            
            const valueMaxWidth = getChordLength(r, Math.abs(estimatedValueY)) * 0.9;
            const categoryMaxWidthAtPos = categoryText ? getChordLength(r, Math.abs(estimatedCategoryY)) * 0.9 : 0;

            const valueFits = valueWidth <= valueMaxWidth;
            let categoryFits = !categoryText || categoryWidth <= categoryMaxWidthAtPos;
            shouldWrapCategory = false;

            if (categoryText && !categoryFits && currentFontSize >= fillStyle.typography.categoryFontSizeBase * 0.8) { // Allow wrapping if font not too small
                 // Simplified wrapping check - assume 2 lines max for brevity in this refactor
                 // A more robust solution would fully simulate wrapping as in original
                const words = categoryText.split(/\s+/);
                if (words.length > 1 || categoryText.length > 10) { // Heuristic for when to attempt wrap check
                    shouldWrapCategory = true;
                    // Check if roughly half the text fits
                    const halfText = categoryText.substring(0, Math.ceil(categoryText.length / 2));
                    const halfWidth = estimateTextWidth(halfText, fillStyle.typography.categoryFontFamily, `${currentFontSize}px`, fillStyle.typography.categoryFontWeight);
                    if (halfWidth <= categoryMaxWidthAtPos) {
                        categoryLines = 2; // Assume it wraps to 2 lines
                        categoryLabelHeight = categoryLines * currentFontSize * (1 + categoryLineHeightFactor);
                        categoryFits = true; 
                        if (categoryLabelHeight > r * 1.8) categoryFits = false; // Too tall
                    } else {
                        shouldWrapCategory = false; // Can't even fit half
                    }
                }
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
        
        const finalFontSize = currentFontSize;
        const showValue = finalFontSize >= minAcceptableFontSize && valueWidth <= getChordLength(r, Math.abs(estimatedValueY)) * 0.9;
        const showCategory = categoryText && r >= minRadiusForCategoryLabel && finalFontSize >= minAcceptableFontSize &&
                             (categoryWidth <= getChordLength(r, Math.abs(estimatedCategoryY)) * 0.9 || shouldWrapCategory);


        let finalValueY = 0, finalCategoryY = 0;
        if (showValue && showCategory) {
            const totalHeight = categoryLabelHeight + finalFontSize + finalFontSize * categoryLineHeightFactor;
            const startY = -totalHeight / 2 - verticalTextOffset;
            finalCategoryY = startY;
            finalValueY = startY + categoryLabelHeight + finalFontSize * categoryLineHeightFactor;
        } else if (showValue) {
            finalValueY = -verticalTextOffset;
        } else if (showCategory) {
            finalCategoryY = -categoryLabelHeight / 2 - verticalTextOffset;
        }

        if (showValue) {
            groupElement.append("text")
                .attr("class", "value label") // Combined class for simplicity
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-family", fillStyle.typography.valueFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.valueFontWeight)
                .style("fill", adaptiveTextColor)
                .text(valueText);
        }

        if (showCategory) {
            const categoryLabelElement = groupElement.append("text")
                .attr("class", "category label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-family", fillStyle.typography.categoryFontFamily)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.categoryFontWeight)
                .style("fill", adaptiveTextColor);

            if (shouldWrapCategory) {
                // Simplified tspan logic for 2 lines max
                const words = categoryText.split(/\s+/);
                let line1 = "", line2 = "";
                const categoryMaxWidthAtPos = getChordLength(r, Math.abs(finalCategoryY + finalFontSize * (1 + categoryLineHeightFactor) * 0)) * 0.9;


                if (words.length <=1 && categoryText.length > 0) { // Character based split
                    let splitPoint = Math.ceil(categoryText.length / 2);
                    while(splitPoint > 0 && estimateTextWidth(categoryText.substring(0,splitPoint), fillStyle.typography.categoryFontFamily, `${finalFontSize}px`, fillStyle.typography.categoryFontWeight) > categoryMaxWidthAtPos) {
                        splitPoint--;
                    }
                     if (splitPoint === 0 && categoryText.length > 0) splitPoint = 1; // Ensure at least one char on first line if possible
                    line1 = categoryText.substring(0, splitPoint);
                    line2 = categoryText.substring(splitPoint);
                } else { // Word based split
                    let currentLine = "";
                    for(let k=0; k < words.length; k++){
                        const testLine = currentLine ? currentLine + " " + words[k] : words[k];
                        if(estimateTextWidth(testLine, fillStyle.typography.categoryFontFamily, `${finalFontSize}px`, fillStyle.typography.categoryFontWeight) <= categoryMaxWidthAtPos){
                            currentLine = testLine;
                        } else {
                            if(currentLine){ // Current line had content
                                line1 = currentLine;
                                line2 = words.slice(k).join(" ");
                            } else { // First word itself is too long
                                line1 = words[k]; // Put it on line 1 anyway
                                line2 = words.slice(k+1).join(" ");
                            }
                            break;
                        }
                    }
                    if(!line1 && currentLine) line1 = currentLine; // All words fit on one line (within wrap logic)
                }
                
                categoryLabelElement.append("tspan")
                    .attr("x", 0)
                    .attr("dy", 0)
                    .text(line1.trim());
                if (line2.trim()) {
                    categoryLabelElement.append("tspan")
                        .attr("x", 0)
                        .attr("dy", `${1 + categoryLineHeightFactor}em`)
                        .text(line2.trim());
                }

            } else {
                categoryLabelElement.text(categoryText);
            }
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this refactored version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
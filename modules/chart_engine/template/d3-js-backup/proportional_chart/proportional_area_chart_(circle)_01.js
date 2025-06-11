/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle Packing)",
  "chart_name": "proportional_area_chart_circle_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, 20], [0, "inf"]],
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
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawData = data.data || {};
    const chartData = (rawData.data || []).map(d => ({...d})); // Shallow copy to prevent modifying original data
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; // Assuming data.colors, not data.colors_dark
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = rawData.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldName = (dataColumns.find(col => col.role === "x") || {}).name;
    const valueFieldName = (dataColumns.find(col => col.role === "y") || {}).name;
    const valueFieldUnitObj = dataColumns.find(col => col.role === "y") || {};
    const valueFieldUnit = valueFieldUnitObj.unit === "none" || !valueFieldUnitObj.unit ? "" : valueFieldUnitObj.unit;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("padding", "10px")
            .html(errorMsg);
        return null;
    }

    const-filteredChartData = chartData.filter(d => d[valueFieldName] !== null && d[valueFieldName] !== undefined && !isNaN(parseFloat(d[valueFieldName])) && +d[valueFieldName] > 0);

    if (filteredChartData.length === 0) {
        d3.select(containerSelector).append("div")
            .style("padding", "10px")
            .html("No valid data to display after filtering for positive values.");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '11px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
        },
        textColor: colors.text_color || '#000000', // Default text color
        textLightColor: '#FFFFFF', // For dark backgrounds
        textDarkColor: '#000000',  // For light backgrounds
        chartBackground: colors.background_color || '#FFFFFF',
        circleStrokeColor: '#FFFFFF',
        defaultPrimaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        defaultAvailableColors: colors.available_colors || d3.schemeTableau10,
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // getBBox on an unattached SVG text element is generally supported in modern browsers.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-attached elements
            // console.warn("estimateTextWidth using getBBox failed, falling back to canvas measureText:", e);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight || 'normal'} ${fontSize} ${fontFamily}`;
            width = context.measureText(text).width;
        }
        return width;
    }

    function getColorBrightness(colorStr) {
        if (!colorStr) return 0.5; // Default for invalid color
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

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? fillStyle.textDarkColor : fillStyle.textLightColor;
    }

    function getChordLength(radius, distanceFromCenter) {
        if (Math.abs(distanceFromCenter) >= radius) return 0;
        return 2 * Math.sqrt(radius * radius - distanceFromCenter * distanceFromCenter);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxTotalCircleArea = innerWidth * innerHeight * 0.5;
    const minRadius = 5;
    const maxRadius = Math.min(innerWidth, innerHeight) / 3;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const valueScale = d3.scaleSqrt() // Temporary scale for initial radius calculation
        .domain([0, d3.max(filteredChartData, d => +d[valueFieldName]) || 1]) // Ensure domain max is at least 1
        .range([minRadius, maxRadius * 0.8]); // *0.8 as in original

    let nodesData = filteredChartData.map((d, i) => {
        const value = +d[valueFieldName];
        const radius = valueScale(value);
        return {
            id: d[categoryFieldName] != null ? String(d[categoryFieldName]) : `__node_${i}__`,
            value: value,
            radius: Math.max(minRadius, radius), // Ensure minRadius
            area: Math.PI * Math.pow(Math.max(minRadius, radius), 2),
            color: null, // To be assigned by colorScale
            originalData: d
        };
    }).sort((a, b) => b.value - a.value); // Sort by value (desc) for layout stability

    const initialTotalArea = d3.sum(nodesData, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodesData.forEach(node => {
            node.radius *= areaRatio;
            node.radius = Math.max(minRadius, node.radius); // Re-check minRadius after scaling
            node.area = Math.PI * node.radius * node.radius;
        });
    }
    
    // Block 6: Scale Definition & Configuration
    const uniqueCategories = [...new Set(nodesData.map(d => d.id.startsWith("__node_") ? d.id : d.originalData[categoryFieldName]))];
    
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueCategories)
        .range(uniqueCategories.map((cat, i) => {
            if (colors.field && colors.field[cat]) {
                return colors.field[cat];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[i % colors.available_colors.length];
            }
            return fillStyle.defaultAvailableColors[i % fillStyle.defaultAvailableColors.length];
        }));

    nodesData.forEach(node => {
        node.color = colorScale(node.id.startsWith("__node_") ? node.id : node.originalData[categoryFieldName]);
    });


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart type.

    // Block 8: Main Data Visualization Rendering (Force Simulation & Circles)
    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.02))
        .force("charge", d3.forceManyBody().strength(-15))
        .force("collide", d3.forceCollide().radius(d => d.radius + 1).strength(0.95)) // +1 for a little padding
        .force("radial", d3.forceRadial(Math.min(innerWidth, innerHeight) * 0.3, innerWidth / 2, innerHeight / 2).strength(0.1))
        .stop();

    if (nodesData.length > 0) {
        nodesData[0].fx = innerWidth / 2;
        nodesData[0].fy = innerHeight / 2;
    }
    if (nodesData.length > 1) {
        const angleStep = 2 * Math.PI / (nodesData.length -1); // Exclude the centered one
        let currentSpiralRadius = Math.min(innerWidth, innerHeight) * 0.15;
        const radiusStepIncrement = currentSpiralRadius / 5; // Increment spiral radius

        for (let i = 1; i < nodesData.length; i++) {
            if (nodesData[i].fx === undefined) { // Only if not fixed
                const angle = i * angleStep;
                nodesData[i].x = innerWidth / 2 + currentSpiralRadius * Math.cos(angle);
                nodesData[i].y = innerHeight / 2 + currentSpiralRadius * Math.sin(angle);
                if (i % 5 === 0) { // Increase spiral radius periodically
                    currentSpiralRadius += radiusStepIncrement;
                }
            }
        }
    }
    
    const numIterations = 200;
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodesData.forEach(d => {
            if (!d.fx) d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
            if (!d.fy) d.y = Math.max(d.radius, Math.min(innerHeight - d.radius, d.y));
        });
    }

    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "node-group mark")
        .attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);

    nodeGroups.append("circle")
        .attr("class", "mark data-circle")
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", fillStyle.circleStrokeColor)
        .attr("stroke-width", 1.5);

    // Block 9: Optional Enhancements & Post-Processing (Labels)
    const minAcceptableFontSize = 8;
    const minRadiusForCategoryLabel = 10;
    const fontSizeToRadiusRatio = 0.38;
    const maxLabelFontSize = 28;
    const labelLineHeightFactor = 1.3; // (1 + 0.3 from original)

    const parsedAnnotationBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize) || 12;
    const parsedLabelBaseFontSize = parseFloat(fillStyle.typography.labelFontSize) || 11;

    nodeGroups.each(function(dNode) {
        const groupElement = d3.select(this);
        const radius = dNode.radius;
        const valueText = `${dNode.value}${valueFieldUnit}`;
        const categoryText = dNode.id.startsWith("__node_") ? "" : String(dNode.originalData[categoryFieldName]);
        
        const adaptiveTextColor = getTextColorForBackground(dNode.color);

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                radius * fontSizeToRadiusRatio,
                (parsedAnnotationBaseFontSize + parsedLabelBaseFontSize) / 2,
                maxLabelFontSize
            )
        );

        let valueTextWidth, categoryTextWidth, categoryLines = 1, categoryLabelHeight = currentFontSize, attemptWrapCategory = false;

        while (currentFontSize >= minAcceptableFontSize) {
            valueTextWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
            categoryTextWidth = categoryText ? estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) : 0;
            
            const estimatedCategoryY = categoryText ? -currentFontSize * 0.55 : 0;
            const estimatedValueY = categoryText ? currentFontSize * 0.55 : 0;

            const valueMaxWidth = getChordLength(radius, Math.abs(estimatedValueY)) * 0.9;
            let categoryMaxWidth = categoryText ? getChordLength(radius, Math.abs(estimatedCategoryY)) * 0.9 : 0;

            let valueFits = valueTextWidth <= valueMaxWidth;
            let categoryFits = !categoryText || categoryTextWidth <= categoryMaxWidth;
            attemptWrapCategory = false;

            if (categoryText && !categoryFits && radius >= minRadiusForCategoryLabel && currentFontSize >= minAcceptableFontSize + 2) { // +2 to allow some room for wrapping reducing effective width per line
                attemptWrapCategory = true;
                const words = categoryText.split(/\s+/);
                let lines = [];
                let currentLineArray = [];
                let tempTextWidthFunc = (txt) => estimateTextWidth(txt, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

                if (words.length <= 1 && categoryText.length > 5) { // Character wrapping for long single words
                    const chars = categoryText.split('');
                    let currentSegment = '';
                    for (const char of chars) {
                        if (tempTextWidthFunc(currentSegment + char) > categoryMaxWidth && currentSegment) {
                            lines.push(currentSegment);
                            currentSegment = char;
                        } else {
                            currentSegment += char;
                        }
                    }
                    if (currentSegment) lines.push(currentSegment);
                } else { // Word wrapping
                     for (const word of words) {
                        currentLineArray.push(word);
                        if (tempTextWidthFunc(currentLineArray.join(" ")) > categoryMaxWidth && currentLineArray.length > 1) {
                            currentLineArray.pop();
                            lines.push(currentLineArray.join(" "));
                            currentLineArray = [word];
                        }
                    }
                    if (currentLineArray.length > 0) lines.push(currentLineArray.join(" "));
                }
                
                categoryLines = lines.length;
                categoryLabelHeight = categoryLines * currentFontSize * labelLineHeightFactor - (currentFontSize * (labelLineHeightFactor - 1)); // Adjusted height
                
                // Check if wrapped text fits vertically
                if (categoryLabelHeight + currentFontSize * labelLineHeightFactor > radius * 1.8) { // Total height check
                    categoryFits = false; attemptWrapCategory = false;
                } else {
                    categoryFits = true; // Assume wrapping makes it fit horizontally for now
                }
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }
        
        const finalFontSize = currentFontSize;
        const showValue = finalFontSize >= minAcceptableFontSize && valueTextWidth <= getChordLength(radius, Math.abs(categoryText ? finalFontSize * 0.55 : 0)) * 0.9;
        const showCategory = categoryText && radius >= minRadiusForCategoryLabel && finalFontSize >= minAcceptableFontSize && 
                             (categoryTextWidth <= getChordLength(radius, Math.abs(-finalFontSize * 0.55)) * 0.9 || attemptWrapCategory);


        let finalValueY = 0;
        let finalCategoryY = 0;

        if (showValue && showCategory) {
            const totalHeight = categoryLabelHeight + finalFontSize + (finalFontSize * (labelLineHeightFactor -1) / 2) ; // Cat height + Val height + small gap
            const startY = -totalHeight / 2;
            finalCategoryY = startY;
            finalValueY = startY + categoryLabelHeight + (finalFontSize * (labelLineHeightFactor-1) /2) ;
        } else if (showValue) {
            finalValueY = -finalFontSize / 2 + finalFontSize * 0.1; // Adjust for dominant-baseline middle
        } else if (showCategory) {
            finalCategoryY = -categoryLabelHeight / 2;
        }


        if (showValue) {
            groupElement.append("text")
                .attr("class", "label value-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalValueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valueText);
        }

        if (showCategory) {
            const categoryLabelElement = groupElement.append("text")
                .attr("class", "label category-label")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "hanging")
                .attr("y", finalCategoryY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none");

            if (attemptWrapCategory) {
                const words = categoryText.split(/\s+/);
                let currentLineArray = [];
                let lineNumber = 0;
                let tspanYOffset = 0;
                let tempTextWidthFunc = (txt) => estimateTextWidth(txt, fillStyle.typography.labelFontFamily, `${finalFontSize}px`, fillStyle.typography.labelFontWeight);
                
                let linesToRender = [];
                if (words.length <= 1 && categoryText.length > 5) { // Re-do wrapping for actual rendering
                    const chars = categoryText.split('');
                    let currentSegment = '';
                    for (const char of chars) {
                         const currentLineMaxWidth = getChordLength(radius, Math.abs(finalCategoryY + tspanYOffset + (finalFontSize/2) )) * 0.9;
                        if (tempTextWidthFunc(currentSegment + char) > currentLineMaxWidth && currentSegment) {
                            linesToRender.push(currentSegment);
                            currentSegment = char;
                        } else {
                            currentSegment += char;
                        }
                    }
                    if (currentSegment) linesToRender.push(currentSegment);
                } else {
                    for (const word of words) {
                        currentLineArray.push(word);
                        const currentLineMaxWidth = getChordLength(radius, Math.abs(finalCategoryY + tspanYOffset + (finalFontSize/2) )) * 0.9;
                        if (tempTextWidthFunc(currentLineArray.join(" ")) > currentLineMaxWidth && currentLineArray.length > 1) {
                            currentLineArray.pop();
                            linesToRender.push(currentLineArray.join(" "));
                            currentLineArray = [word];
                        }
                    }
                    if (currentLineArray.length > 0) linesToRender.push(currentLineArray.join(" "));
                }

                linesToRender.forEach((lineText, idx) => {
                    categoryLabelElement.append("tspan")
                        .attr("x", 0)
                        .attr("dy", idx === 0 ? 0 : `${finalFontSize * labelLineHeightFactor}px`)
                        .text(lineText);
                    if (idx > 0) tspanYOffset += finalFontSize * labelLineHeightFactor;
                });

            } else {
                categoryLabelElement.text(categoryText);
            }
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
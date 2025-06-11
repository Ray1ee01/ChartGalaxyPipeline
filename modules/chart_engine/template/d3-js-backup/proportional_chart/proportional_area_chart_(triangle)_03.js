/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Triangle)",
  "chart_name": "proportional_area_chart_triangle_03",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external.

    // Block 1: Configuration Parsing & Validation
    const chartDataRaw = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const variables = data.variables || {};
    const typographyData = data.typography || {};
    const colorsData = data.colors || data.colors_dark || {}; 
    const imagesData = data.images || {};

    d3.select(containerSelector).html(""); 

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const yUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : (dataColumns.find(col => col.role === "y")?.unit || "");

    if (!xField || !yField) {
        const missingFields = [];
        if (!xField) missingFields.push("xField (role='x')");
        if (!yField) missingFields.push("yField (role='y')");
        const errorMessage = `Critical chart config missing: ${missingFields.join(', ')} not found in dataColumns. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const chartDataArray = chartDataRaw.filter(d => d[yField] != null && !isNaN(parseFloat(d[yField])) && parseFloat(d[yField]) > 0);

    if (!chartDataArray.length) {
        d3.select(containerSelector).html("<div style='color:grey; padding:10px;'>No valid data to display (values for yField must be > 0).</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyData.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyData.title?.font_size || '16px',
            titleFontWeight: typographyData.title?.font_weight || 'bold',
            labelFontFamily: typographyData.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyData.label?.font_size || '12px',
            labelFontWeight: typographyData.label?.font_weight || 'normal',
            annotationFontFamily: typographyData.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyData.annotation?.font_size || '10px',
            annotationFontWeight: typographyData.annotation?.font_weight || 'normal',
        },
        textColor: colorsData.text_color || '#333333',
        chartBackground: colorsData.background_color || '#FFFFFF',
        defaultCategoryColor: '#CCCCCC', 
        connectorLineColor: '#666666',
        externalLabelColor: '#000000',
        externalLabelBackgroundColor: 'rgba(255, 255, 255, 0.85)',
        externalLabelStrokeColor: '#CCCCCC',
        triangleStrokeColor: '#FFFFFF', 
    };
    
    function getCategoryColor(categoryKey, index) {
        if (colorsData.field && colorsData.field[categoryKey]) {
            return colorsData.field[categoryKey];
        }
        if (colorsData.available_colors && colorsData.available_colors.length > 0) {
            return colorsData.available_colors[index % colorsData.available_colors.length];
        }
        return d3.schemeCategory10[index % d3.schemeCategory10.length] || fillStyle.defaultCategoryColor;
    }

    function getCategoryImage(categoryKey) {
        if (imagesData.field && imagesData.field[categoryKey]) {
            return imagesData.field[categoryKey];
        }
        return null;
    }
    
    let estimateTextWidthMemo = {};
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const key = `${text}-${fontFamily}-${fontSize}-${fontWeight}`;
        if (estimateTextWidthMemo[key] !== undefined) {
            return estimateTextWidthMemo[key];
        }
        if (!text || String(text).trim() === "") { // Handle empty or whitespace-only strings
             estimateTextWidthMemo[key] = 0;
             return 0;
        }

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Hide the SVG element to prevent it from briefly appearing or affecting layout
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = '0px';
        svg.style.height = '0px';

        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        svg.appendChild(textElement);
        
        // Append to body for reliable getBBox, then remove immediately.
        // This is a common robust way, though the prompt preferred not to append.
        // However, for accuracy, this is often necessary.
        document.body.appendChild(svg);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6; 
            width = text.length * avgCharWidth;
            // console.warn("estimateTextWidth using approximation due to getBBox issue.", e);
        }
        document.body.removeChild(svg);

        estimateTextWidthMemo[key] = width;
        return width;
    }

    function getTriangleWidthAtHeight(side, totalTriangleHeight, distanceFromTriangleTop) {
        if (distanceFromTriangleTop < 0 || distanceFromTriangleTop > totalTriangleHeight) {
            return 0;
        }
        const baseWidth = side;
        const widthRatio = distanceFromTriangleTop / totalTriangleHeight;
        return baseWidth * widthRatio;
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
    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const forceSimulationSteps = variables.forceSimulationSteps || 300;
    const forceCollideStrength = variables.forceCollideStrength || 0.8;
    const forceCenterStrength = variables.forceCenterStrength || 0.1;
    const forceCollideRadiusPadding = variables.forceCollideRadiusPadding || 8; 

    const minRadius = variables.minRadius || 20; 
    const maxRadius = variables.maxRadius || Math.min(innerWidth, innerHeight) / 4.5; 
    const minSideForInnerLabel = variables.minSideForInnerLabel || 70; 

    // Block 5: Data Preprocessing & Transformation
    const yValues = chartDataArray.map(d => +d[yField]);
    const dataMinY = d3.min(yValues) || 0;
    const dataMaxY = d3.max(yValues) || 1; 

    const radiusScale = d3.scaleLinear()
        .domain([dataMinY, dataMaxY === dataMinY ? dataMinY + 1 : dataMaxY]) 
        .range([minRadius, maxRadius]);

    const nodesData = chartDataArray.map((d, i) => ({
        id: d[xField] != null ? String(d[xField]) : `__${i}__`,
        val: +d[yField],
        r: radiusScale(+d[yField]),
        color: getCategoryColor(String(d[xField]), i),
        icon: getCategoryImage(String(d[xField])),
        raw: d,
        x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.5, // Start closer to center
        y: innerHeight / 2 + (Math.random() - 0.5) * innerHeight * 0.5
    })).sort((a, b) => b.r - a.r); 

    nodesData.forEach((d, i) => {
        d.zIndex = nodesData.length - 1 - i; 
    });
    
    const simulation = d3.forceSimulation(nodesData)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(forceCenterStrength))
        .force("collide", d3.forceCollide(d => {
            const side = d.r * 2;
            const baseRadius = d.r + forceCollideRadiusPadding;
            return side < minSideForInnerLabel ? baseRadius * 1.8 : baseRadius * 1.1; 
        }).strength(forceCollideStrength))
        .force("x", d3.forceX(innerWidth / 2).strength(0.03))
        .force("y", d3.forceY(innerHeight / 2).strength(0.03))
        .stop();

    for (let i = 0; i < forceSimulationSteps; ++i) {
        simulation.tick();
    }

    nodesData.forEach(d => {
        const boundaryPadding = d.r * 1.1; 
        d.x = Math.max(boundaryPadding, Math.min(innerWidth - boundaryPadding, d.x));
        d.y = Math.max(boundaryPadding, Math.min(innerHeight - boundaryPadding, d.y));
    });

    // Block 6: Scale Definition & Configuration
    // radiusScale defined in Block 5.

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    const minAcceptableFontSize = 8;
    const categoryLabelLineHeightFactor = 1.2; 
    const internalPaddingFactor = 0.08; 

    const nodeGroups = mainChartGroup.selectAll("g.mark")
        .data(nodesData, d => d.id)
        .join("g")
        .attr("class", "mark")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .sort((a, b) => a.zIndex - b.zIndex); 

    nodeGroups.each(function(dNode) {
        const group = d3.select(this);
        const side = dNode.r * 2;
        const triangleHeight = side * Math.sqrt(3) / 2;
        const valueText = `${dNode.val}${yUnit}`;
        let categoryText = dNode.id.startsWith("__") ? "" : dNode.id; 

        group.append("path")
            .attr("class", "mark") 
            .attr("d", d3.line()([
                [0, -triangleHeight * 2/3],      
                [-side/2, triangleHeight * 1/3], 
                [side/2, triangleHeight * 1/3]   
            ])()) 
            .attr("fill", dNode.color)
            .attr("stroke", fillStyle.triangleStrokeColor)
            .attr("stroke-width", 1.5);

        let useExternalLabel = side < minSideForInnerLabel;

        if (!useExternalLabel) {
            const iconSizeMax = side * 0.35;
            const iconSizeMin = Math.min(15, iconSizeMax); // Icon can be small
            let iconActualSize = 0;
            if (dNode.icon) {
                iconActualSize = Math.max(iconSizeMin, Math.min(iconSizeMax, side * 0.3));
            }

            const targetCatFontSize = parseFloat(fillStyle.typography.labelFontSize);
            const targetValFontSize = parseFloat(fillStyle.typography.annotationFontSize);
            
            let currentInternalFontSize = Math.min(targetCatFontSize, targetValFontSize, side * 0.15, 16); 
            currentInternalFontSize = Math.max(minAcceptableFontSize, currentInternalFontSize);

            let catLines = [];
            let valWidth = 0, totalTextHeight = 0;
            let iconHeightWithPadding = 0, catTextHeightWithPadding = 0, valTextHeightWithPadding = 0;

            let fitsInternally = false;
            for (let fs = currentInternalFontSize; fs >= minAcceptableFontSize; fs -=1) {
                iconHeightWithPadding = 0; catTextHeightWithPadding = 0; valTextHeightWithPadding = 0; totalTextHeight = 0;
                let currentIconSize = iconActualSize;

                if (dNode.icon && currentIconSize > 0) {
                    const iconCenterY = -triangleHeight * 0.5 + (internalPaddingFactor * triangleHeight) + currentIconSize / 2;
                    const iconYDistanceFromTop = (triangleHeight * 2/3) + iconCenterY;
                    const availableWidthForIcon = getTriangleWidthAtHeight(side, triangleHeight, iconYDistanceFromTop) * 0.9;
                    
                    if (currentIconSize > availableWidthForIcon) currentIconSize = availableWidthForIcon;
                    if (currentIconSize >= iconSizeMin) {
                         iconHeightWithPadding = currentIconSize + (internalPaddingFactor * triangleHeight * 0.5);
                    } else {
                        currentIconSize = 0; // Icon too small to display
                    }
                }
                totalTextHeight += iconHeightWithPadding;

                if (categoryText) {
                    const catFont = { family: fillStyle.typography.labelFontFamily, size: fs, weight: fillStyle.typography.labelFontWeight };
                    const catTextPotentialHeight = fs * categoryLabelLineHeightFactor; // Height of one line
                    const catY = -triangleHeight * 0.5 + totalTextHeight + (internalPaddingFactor * triangleHeight * 0.5);
                    const catYDistanceFromTop = (triangleHeight * 2/3) + catY + (catTextPotentialHeight / 2); 
                    const availableWidthForCat = getTriangleWidthAtHeight(side, triangleHeight, catYDistanceFromTop) * 0.85;
                    
                    catLines = wrapText(categoryText, availableWidthForCat, catFont.family, catFont.size, catFont.weight, 2); // Max 2 lines for category
                    if (catLines.length > 0) {
                        catTextHeightWithPadding = (catLines.length * fs * categoryLabelLineHeightFactor) + (internalPaddingFactor * triangleHeight * 0.5);
                        totalTextHeight += catTextHeightWithPadding;
                    } else {
                        catLines = []; 
                    }
                }
                
                const valFont = { family: fillStyle.typography.annotationFontFamily, size: fs, weight: fillStyle.typography.annotationFontWeight };
                valWidth = estimateTextWidth(valueText, valFont.family, valFont.size, valFont.weight);
                const valY = -triangleHeight * 0.5 + totalTextHeight + (internalPaddingFactor * triangleHeight * 0.5);
                const valYDistanceFromTop = (triangleHeight * 2/3) + valY + (fs / 2); 
                const availableWidthForVal = getTriangleWidthAtHeight(side, triangleHeight, valYDistanceFromTop) * 0.85;

                if (valWidth <= availableWidthForVal) {
                    valTextHeightWithPadding = fs; // Height of value text itself
                    totalTextHeight += valTextHeightWithPadding;
                } else {
                    continue; 
                }

                if (totalTextHeight < triangleHeight * 0.75) { 
                    currentInternalFontSize = fs;
                    iconActualSize = currentIconSize; // Update final icon size
                    fitsInternally = true;
                    break; 
                }
            }
            if (!fitsInternally) useExternalLabel = true;

            if (fitsInternally) {
                let currentY = -totalTextHeight / 2; 

                if (dNode.icon && iconActualSize >= iconSizeMin) {
                    group.append("image")
                        .attr("class", "image")
                        .attr("xlink:href", dNode.icon)
                        .attr("width", iconActualSize)
                        .attr("height", iconActualSize)
                        .attr("x", -iconActualSize / 2)
                        .attr("y", currentY)
                        .attr("preserveAspectRatio", "xMidYMid meet");
                    currentY += iconHeightWithPadding;
                }

                if (categoryText && catLines.length > 0) {
                    const catFont = { family: fillStyle.typography.labelFontFamily, size: currentInternalFontSize, weight: fillStyle.typography.labelFontWeight };
                    const catLabelGroup = group.append("text")
                        .attr("class", "label category-label")
                        .attr("text-anchor", "middle")
                        .style("font-family", catFont.family)
                        .style("font-size", `${catFont.size}px`)
                        .style("font-weight", catFont.weight)
                        .style("fill", fillStyle.textColor);
                    
                    const catLineHeight = catFont.size * categoryLabelLineHeightFactor;
                    let catTextStartY = currentY + catFont.size * 0.8; // Adjust for first line dy
                    if (catLines.length > 1) { // Center multi-line text block
                        catTextStartY -= (catLines.length -1) * catLineHeight / 2;
                    }

                    catLines.forEach((line, i) => {
                        catLabelGroup.append("tspan")
                            .attr("x", 0)
                            .attr("y", catTextStartY + (i * catLineHeight))
                            .text(line);
                    });
                    currentY += catTextHeightWithPadding;
                }
                
                const valFont = { family: fillStyle.typography.annotationFontFamily, size: currentInternalFontSize, weight: fillStyle.typography.annotationFontWeight };
                group.append("text")
                    .attr("class", "label value-label")
                    .attr("text-anchor", "middle")
                    .attr("y", currentY + valFont.size * 0.8) 
                    .style("font-family", valFont.family)
                    .style("font-size", `${valFont.size}px`)
                    .style("font-weight", valFont.weight)
                    .style("fill", fillStyle.textColor)
                    .text(valueText);
            }
        }

        if (useExternalLabel) {
            const externalLabelFontSize = Math.max(minAcceptableFontSize, Math.min(parseFloat(fillStyle.typography.annotationFontSize), side / 5.5, 12));
            const catFont = { family: fillStyle.typography.labelFontFamily, size: externalLabelFontSize, weight: fillStyle.typography.labelFontWeight };
            const valFont = { family: fillStyle.typography.annotationFontFamily, size: externalLabelFontSize, weight: fillStyle.typography.annotationFontWeight };

            const labelYOffset = triangleHeight * 1/3 + 8; 
            const extLineHeight = externalLabelFontSize * 1.2;
            
            let labelElements = [];
            if (categoryText) labelElements.push({text: categoryText, font: catFont, class: "category-label"});
            labelElements.push({text: valueText, font: valFont, class: "value-label"});

            const totalLabelHeight = labelElements.length * extLineHeight - (extLineHeight - externalLabelFontSize) * (labelElements.length > 0 ? 1 : 0);
            const maxExtWidth = d3.max(labelElements, el => estimateTextWidth(el.text, el.font.family, el.font.size, el.font.weight)) || 0;

            if (maxExtWidth > 0) { // Only draw connector and background if there's text
                group.append("line")
                    .attr("class", "other") // Standard class for connector
                    .attr("x1", 0).attr("y1", triangleHeight * 1/3)
                    .attr("x2", 0).attr("y2", labelYOffset - 2)
                    .attr("stroke", fillStyle.connectorLineColor)
                    .attr("stroke-width", 1);

                 group.append("rect")
                    .attr("class", "other") // Standard class for background
                    .attr("x", -maxExtWidth / 2 - 5)
                    .attr("y", labelYOffset - externalLabelFontSize * 0.2 - 2) 
                    .attr("width", maxExtWidth + 10)
                    .attr("height", totalLabelHeight + 4)
                    .attr("rx", 3).attr("ry", 3)
                    .attr("fill", fillStyle.externalLabelBackgroundColor)
                    .attr("stroke", fillStyle.externalLabelStrokeColor)
                    .attr("stroke-width", 0.5);
            }

            let currentLabelY = labelYOffset + externalLabelFontSize * 0.8; // Start Y for first line
            labelElements.forEach(el => {
                if (el.text) { // Ensure text is not empty
                    group.append("text")
                        .attr("class", `label ${el.class}`)
                        .attr("text-anchor", "middle")
                        .attr("y", currentLabelY)
                        .style("font-family", el.font.family)
                        .style("font-size", `${el.font.size}px`)
                        .style("font-weight", el.font.weight)
                        .style("fill", fillStyle.externalLabelColor)
                        .text(el.text);
                    currentLabelY += extLineHeight;
                }
            });
            
            if (dNode.icon && side > 30) { 
                let iconSize = Math.min(side * 0.5, 30); 
                iconSize = Math.max(15, iconSize); 
                 const iconCenterY = 0; 
                 const iconYDistanceFromTop = triangleHeight * 2/3 + iconCenterY;
                 const availableWidthForIcon = getTriangleWidthAtHeight(side, triangleHeight, iconYDistanceFromTop) * 0.9;
                 iconSize = Math.min(iconSize, availableWidthForIcon);

                if (iconSize >= 15) {
                    group.append("image")
                        .attr("class", "image")
                        .attr("xlink:href", dNode.icon)
                        .attr("width", iconSize)
                        .attr("height", iconSize)
                        .attr("x", -iconSize / 2)
                        .attr("y", -iconSize / 2 - triangleHeight * 0.1) // Shift icon slightly up for better balance
                        .attr("preserveAspectRatio", "xMidYMid meet");
                }
            }
        }
    });
    
    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight, maxLines = Infinity) {
        if (!text || String(text).trim() === "") return [];
        const words = text.split(/\s+/).filter(w => w !== "");
        
        let lines = [];
        if (words.length === 0) { // Text might be non-space characters only
            if (estimateTextWidth(text, fontFamily, fontSize, fontWeight) <= maxWidth) {
                lines.push(text);
            } else { // Character wrap if single block of text is too long
                let currentWordLine = "";
                for (let char of text) {
                    if (estimateTextWidth(currentWordLine + char, fontFamily, fontSize, fontWeight) <= maxWidth) {
                        currentWordLine += char;
                    } else {
                        if (lines.length < maxLines -1) lines.push(currentWordLine); else if (lines.length === maxLines -1) { lines.push(currentWordLine + '...'); return lines; } else return lines;
                        currentWordLine = char;
                    }
                }
                if (currentWordLine && lines.length < maxLines) lines.push(currentWordLine);
            }
            return lines;
        }

        let currentLine = words[0];
        if (estimateTextWidth(currentLine, fontFamily, fontSize, fontWeight) > maxWidth) { // First word too long
            let currentWordLine = "";
            for (let char of currentLine) {
                if (estimateTextWidth(currentWordLine + char, fontFamily, fontSize, fontWeight) <= maxWidth) {
                    currentWordLine += char;
                } else {
                    if (lines.length < maxLines -1) lines.push(currentWordLine); else if (lines.length === maxLines -1) { lines.push(currentWordLine + '...'); return lines; } else return lines;
                    currentWordLine = char;
                }
            }
            if (currentWordLine && lines.length < maxLines) lines.push(currentWordLine);
            currentLine = ""; // First word handled
        }
    
        for (let i = 1; i < words.length; i++) {
            if (lines.length >= maxLines) break;
            let testLine = currentLine ? currentLine + " " + words[i] : words[i];
            if (estimateTextWidth(testLine, fontFamily, fontSize, fontWeight) <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                     if (lines.length < maxLines -1) lines.push(currentLine); else if (lines.length === maxLines -1) { lines.push(currentLine + '...'); break; }
                }
                currentLine = words[i];
                if (estimateTextWidth(currentLine, fontFamily, fontSize, fontWeight) > maxWidth) { // New word itself is too long
                    let currentWordLine = "";
                    for (let char of currentLine) {
                        if (estimateTextWidth(currentWordLine + char, fontFamily, fontSize, fontWeight) <= maxWidth) {
                            currentWordLine += char;
                        } else {
                           if (lines.length < maxLines -1) lines.push(currentWordLine); else if (lines.length === maxLines -1) { lines.push(currentWordLine + '...'); return lines; } else return lines;
                            currentWordLine = char;
                        }
                    }
                    if (currentWordLine && lines.length < maxLines) lines.push(currentWordLine);
                    currentLine = ""; 
                }
            }
        }
        if (currentLine && lines.length < maxLines) lines.push(currentLine);
        else if (currentLine && lines.length === maxLines -1 && estimateTextWidth(currentLine, fontFamily, fontSize, fontWeight) > 0) {
            // Ellipsis for the last allowed line if it's too long
            let tempLine = "";
            for(let char of currentLine) {
                if (estimateTextWidth(tempLine + char + "...", fontFamily, fontSize, fontWeight) <= maxWidth) {
                    tempLine += char;
                } else {
                    break;
                }
            }
            lines.push(tempLine + (tempLine.length < currentLine.length ? "..." : ""));
        }
        return lines.filter(l => l.trim() !== "");
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (None for this refactor)

    // Block 10: Cleanup & SVG Node Return
    estimateTextWidthMemo = {}; 
    return svgRoot.node();
}
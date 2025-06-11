/* REQUIREMENTS_BEGIN
{
  "chart_type": "Proportional Area Chart (Circle)",
  "chart_name": "proportional_area_chart_circle_01",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xColumn ? xColumn.name : undefined;
    const valueFieldName = yColumn ? yColumn.name : undefined;
    const valueFieldUnit = (yColumn?.unit === "none" || !yColumn?.unit) ? "" : yColumn.unit;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red;'>${errorMsg}</div>`);
        return null;
    }

    const processedChartData = chartData.filter(d => d[valueFieldName] != null && +d[valueFieldName] > 0);

    if (!processedChartData.length) {
        d3.select(containerSelector).html("<div style='color:grey;'>No valid data to display.</div>");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '16px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '11px', // Adjusted default from 12px
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '12px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'bold',
        },
        textColor: colors.text_color || '#000000', // Default to black for general text
        chartBackground: colors.background_color || '#FFFFFF',
        defaultCategoryColors: d3.schemeCategory10,
        getCategoryColor: function(categoryName, index) {
            if (colors.field && colors.field[categoryFieldName] && colors.field[categoryFieldName][categoryName]) {
                return colors.field[categoryFieldName][categoryName];
            }
            if (colors.available_colors && colors.available_colors.length > 0) {
                return colors.available_colors[index % colors.available_colors.length];
            }
            return this.defaultCategoryColors[index % this.defaultCategoryColors.length];
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox,
        // but trying to adhere to "MUST NOT be appended to the document DOM".
        // This might be less accurate for some browsers/setups if not in DOM.
        // A common workaround is to append, measure, remove, but let's try without first.
        // If issues, a hidden live SVG element is an alternative.
        // For this implementation, we assume getBBox on a non-DOM SVG text element is sufficient.
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails on non-DOM element
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
            return context.measureText(text).width;
        }
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
            if (!match) return 0.5; // Default if parse fails
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        } else {
            return 0.5; // Default for unknown color formats
        }
        return (r * 299 + g * 587 + b * 114) / 1000 / 255; // Luma calculation
    }

    function getTextColorForBackground(backgroundColor) {
        const brightness = getColorBrightness(backgroundColor);
        return brightness > 0.6 ? '#000000' : '#FFFFFF'; // Dark text on light bg, light text on dark bg
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    const chartMargins = { top: 20, right: 20, bottom: 20, left: 20 }; // Simplified margins

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const maxTotalCircleArea = innerWidth * innerHeight * 0.6; // Allow more area usage
    const minRadius = 5;
    const maxRadius = Math.min(innerWidth, innerHeight) / 3;

    // Block 5: Data Preprocessing & Transformation
    const valueExtent = d3.extent(processedChartData, d => +d[valueFieldName]);
    const radiusScale = d3.scaleSqrt()
        .domain([0, valueExtent[1] > 0 ? valueExtent[1] : 1]) // Ensure domain max is > 0
        .range([minRadius, maxRadius * 0.8]);

    const uniqueCategories = [...new Set(processedChartData.map(d => d[categoryFieldName]))];

    let nodesDataArray = processedChartData.map((d, i) => {
        const value = +d[valueFieldName];
        const r = radiusScale(value);
        const category = d[categoryFieldName];
        const categoryIndex = uniqueCategories.indexOf(category);
        return {
            id: String(category != null ? category : `__${i}__`),
            value: value,
            radius: r,
            area: Math.PI * r * r,
            color: fillStyle.getCategoryColor(category, categoryIndex),
            originalData: d
        };
    }).sort((a, b) => b.radius - a.radius);

    const initialTotalArea = d3.sum(nodesDataArray, d => d.area);
    if (initialTotalArea > maxTotalCircleArea && initialTotalArea > 0) {
        const areaRatio = Math.sqrt(maxTotalCircleArea / initialTotalArea);
        nodesDataArray.forEach(node => {
            node.radius *= areaRatio;
            node.area = Math.PI * node.radius * node.radius;
        });
    }
    // Ensure radii are not below minRadius after scaling
    nodesDataArray.forEach(node => {
        node.radius = Math.max(node.radius, minRadius);
    });


    const simulation = d3.forceSimulation(nodesDataArray)
        .force("center", d3.forceCenter(innerWidth / 2, innerHeight / 2).strength(0.03))
        .force("charge", d3.forceManyBody().strength(-20)) // Slightly stronger repulsion
        .force("collide", d3.forceCollide().radius(d => d.radius + 2).strength(0.9)) // Add small padding to collision
        .force("x", d3.forceX(innerWidth / 2).strength(0.02)) // Weakly pull towards horizontal center
        .force("y", d3.forceY(innerHeight / 2).strength(0.02)) // Weakly pull towards vertical center
        .stop();

    // Initial positions (helps convergence)
    if (nodesDataArray.length > 0) {
        nodesDataArray[0].fx = innerWidth / 2;
        nodesDataArray[0].fy = innerHeight / 2;
    }
    if (nodesDataArray.length > 1) {
        const angleStep = 2 * Math.PI / (nodesDataArray.length -1);
        let currentSpiralRadius = Math.min(innerWidth, innerHeight) * 0.1;
        const radiusStepIncrement = Math.min(innerWidth, innerHeight) * 0.05;

        for (let i = 1; i < nodesDataArray.length; i++) {
            if (nodesDataArray[i].fx === undefined) { // Only if not already fixed (e.g. the first one)
                const angle = i * angleStep;
                nodesDataArray[i].x = innerWidth / 2 + currentSpiralRadius * Math.cos(angle);
                nodesDataArray[i].y = innerHeight / 2 + currentSpiralRadius * Math.sin(angle);
                if (i % 8 === 0) { // Increase radius less frequently for tighter packing initially
                    currentSpiralRadius += radiusStepIncrement;
                }
            }
        }
    }
    
    const numIterations = 250; // Increased iterations for better packing
    for (let i = 0; i < numIterations; ++i) {
        simulation.tick();
        nodesDataArray.forEach(d => {
            if (!d.fx) d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
            if (!d.fy) d.y = Math.max(d.radius, Math.min(innerHeight - d.radius, d.y));
        });
    }
    if (nodesDataArray.length > 0 && nodesDataArray[0].fx !== undefined) { // unfix the first node after initial placement
        nodesDataArray[0].fx = null;
        nodesDataArray[0].fy = null;
        // Run a few more ticks after unfixing
        for (let i = 0; i < 50; ++i) {
            simulation.tick();
            nodesDataArray.forEach(d => {
                if (!d.fx) d.x = Math.max(d.radius, Math.min(innerWidth - d.radius, d.x));
                if (!d.fy) d.y = Math.max(d.radius, Math.min(innerHeight - d.radius, d.y));
            });
        }
    }


    // Block 6: Scale Definition & Configuration
    // Color scale is handled by fillStyle.getCategoryColor
    // Radius scale is already defined (radiusScale)

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this chart type.

    // Block 8: Main Data Visualization Rendering
    const nodeGroups = mainChartGroup.selectAll("g.node-group")
        .data(nodesDataArray, d => d.id)
        .join("g")
        .attr("class", d => `node-group mark value ${d.id.replace(/\s+/g, '-')}`) // Added value class, sanitized ID
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodeGroups.append("circle")
        .attr("class", "data-circle mark") // Added mark class
        .attr("r", d => d.radius)
        .attr("fill", d => d.color)
        .attr("stroke", d => getColorBrightness(d.color) > 0.8 ? "#CCCCCC" : "#FFFFFF") // Light border for dark circles, darker for very light
        .attr("stroke-width", 1);

    // Text rendering
    const minAcceptableFontSize = 8;
    const minRadiusForCategoryLabel = 10; // Slightly increased
    const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const baseLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);
    const categoryLineHeightFactor = 1.2; // em units for tspan dy

    nodeGroups.each(function(dNode) {
        const group = d3.select(this);
        const radius = dNode.radius;
        const valueText = `${dNode.value}${valueFieldUnit}`;
        let categoryText = dNode.id.startsWith("__") ? "" : dNode.id;

        const adaptiveTextColor = getTextColorForBackground(dNode.color);

        let currentFontSize = Math.max(
            minAcceptableFontSize,
            Math.min(
                radius * 0.35, // Scale factor for font size based on radius
                (baseAnnotationFontSize + baseLabelFontSize) / 2, // Average of configured sizes
                24 // Absolute max font size
            )
        );

        let valueFits = false;
        let categoryFits = false;
        let categoryLines = [];

        while (currentFontSize >= minAcceptableFontSize) {
            const valueTextWidth = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, `${currentFontSize}px`, fillStyle.typography.annotationFontWeight);
            const valueMaxAllowedWidth = getChordLength(radius, currentFontSize * 0.5) * 0.9; // Value text slightly offset
            valueFits = valueTextWidth <= valueMaxAllowedWidth;

            if (categoryText) {
                // Try to fit category text, possibly wrapped
                const categoryMaxAllowedWidthUnwrapped = getChordLength(radius, -currentFontSize * 0.5) * 0.9; // Category text slightly offset upwards
                const categoryTextWidthUnwrapped = estimateTextWidth(categoryText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);

                if (categoryTextWidthUnwrapped <= categoryMaxAllowedWidthUnwrapped) {
                    categoryFits = true;
                    categoryLines = [categoryText];
                } else { // Try wrapping
                    const words = categoryText.split(/\s+/);
                    let tempLines = [];
                    let currentLine = "";
                    let maxLineWidth = 0;
                    
                    for (const word of words) {
                        const testLine = currentLine ? `${currentLine} ${word}` : word;
                        const testLineWidth = estimateTextWidth(testLine, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                        const currentLineYOffset = - (tempLines.length * currentFontSize * categoryLineHeightFactor) - (currentFontSize * 0.5);
                        const maxAllowedWidthForThisLine = getChordLength(radius, currentLineYOffset) * 0.9;

                        if (testLineWidth <= maxAllowedWidthForThisLine) {
                            currentLine = testLine;
                        } else {
                            if (currentLine) tempLines.push(currentLine);
                            currentLine = word;
                            // Check if the new word itself is too long for a new line
                            const singleWordWidth = estimateTextWidth(word, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                            const nextLineYOffset = - (tempLines.length * currentFontSize * categoryLineHeightFactor) - (currentFontSize * 0.5);
                            const maxAllowedWidthForNextLine = getChordLength(radius, nextLineYOffset) * 0.9;
                            if (singleWordWidth > maxAllowedWidthForNextLine && tempLines.length > 0) { // Cannot fit this word
                                tempLines = []; // Wrapping failed
                                break;
                            }
                        }
                    }
                    if (currentLine) tempLines.push(currentLine);

                    if (tempLines.length > 0) {
                        const totalHeight = tempLines.length * currentFontSize * categoryLineHeightFactor;
                        if (totalHeight < radius * 1.5) { // Check if total height is reasonable
                             categoryFits = true;
                             categoryLines = tempLines;
                        } else {
                            categoryFits = false;
                            categoryLines = [];
                        }
                    } else {
                        categoryFits = false;
                        categoryLines = [];
                    }
                }
            } else {
                categoryFits = true; // No category text to fit
            }

            if (valueFits && categoryFits) break;
            currentFontSize -= 1;
        }

        const finalFontSize = currentFontSize;
        const showValue = valueFits && finalFontSize >= minAcceptableFontSize;
        const showCategory = categoryText && categoryFits && finalFontSize >= minAcceptableFontSize && radius >= minRadiusForCategoryLabel;

        let valueY = 0;
        let categoryStartY = 0;

        if (showValue && showCategory) {
            const totalCategoryHeight = categoryLines.length * finalFontSize * categoryLineHeightFactor;
            const gap = finalFontSize * 0.2;
            valueY = (totalCategoryHeight / 2 + gap + finalFontSize / 2) * 0.5; // Center value text below category block
            categoryStartY = - (totalCategoryHeight / 2 + gap + finalFontSize / 2) * 0.5 + (finalFontSize * (categoryLineHeightFactor -1))/2; // Center category block above value
        } else if (showValue) {
            valueY = 0; // Center vertically
        } else if (showCategory) {
            const totalCategoryHeight = categoryLines.length * finalFontSize * categoryLineHeightFactor;
            categoryStartY = -totalCategoryHeight / 2 + (finalFontSize * categoryLineHeightFactor * 0.8) /2; // Center block, adjust for dominant-baseline
        }


        if (showValue) {
            group.append("text")
                .attr("class", "value text")
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("y", valueY)
                .style("font-size", `${finalFontSize}px`)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none")
                .text(valueText);
        }

        if (showCategory) {
            const categoryLabel = group.append("text")
                .attr("class", "label text") // Changed from category-label to label
                .attr("text-anchor", "middle")
                .style("font-size", `${finalFontSize}px`)
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", adaptiveTextColor)
                .style("pointer-events", "none");

            categoryLines.forEach((line, i) => {
                categoryLabel.append("tspan")
                    .attr("x", 0)
                    .attr("y", categoryStartY + (i * finalFontSize * categoryLineHeightFactor))
                    .attr("dy", i === 0 ? `${finalFontSize * 0.35}px` : `${finalFontSize * categoryLineHeightFactor * 0.9}px`) // Adjust dy for first line and subsequent
                    .text(line);
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    const tooltip = mainChartGroup.append("g")
        .attr("class", "chart-tooltip other") // Added 'other' class
        .style("visibility", "hidden")
        .style("pointer-events", "none");

    const tooltipRect = tooltip.append("rect")
        .attr("rx", 3)
        .attr("ry", 3)
        .style("fill", "rgba(0,0,0,0.75)")
        .style("stroke", "white")
        .style("stroke-width", "0.5px");

    const tooltipText = tooltip.append("text")
        .attr("class", "text")
        .style("fill", "white")
        .style("font-size", fillStyle.typography.annotationFontSize) // Use annotation font size for tooltip
        .style("font-family", fillStyle.typography.annotationFontFamily);

    nodeGroups
        .on("mouseover", function(event, dNode) {
            d3.select(this).select(".data-circle").attr("opacity", 0.7);
            tooltip.style("visibility", "visible");
            const textContent = `${dNode.id}: ${dNode.value}${valueFieldUnit}`;
            tooltipText.text(textContent);

            const padding = 8;
            const textBBox = tooltipText.node().getBBox();
            tooltipRect
                .attr("x", textBBox.x - padding / 2)
                .attr("y", textBBox.y - padding / 2)
                .attr("width", textBBox.width + padding)
                .attr("height", textBBox.height + padding);
            
            // Position tooltip
            let x = dNode.x + dNode.radius + 10;
            let y = dNode.y;
            if (x + textBBox.width + padding > innerWidth) {
                x = dNode.x - dNode.radius - 10 - (textBBox.width + padding);
            }
            if (y + textBBox.height + padding > innerHeight) {
                y = innerHeight - (textBBox.height + padding);
            }
            if (y < 0) {
                y = 0;
            }
            tooltip.attr("transform", `translate(${x}, ${y})`);

        })
        .on("mouseout", function() {
            d3.select(this).select(".data-circle").attr("opacity", 1);
            tooltip.style("visibility", "hidden");
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
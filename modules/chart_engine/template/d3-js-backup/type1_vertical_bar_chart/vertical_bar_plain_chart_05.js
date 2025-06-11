/* REQUIREMENTS_BEGIN
{
  "chart_type": "Gaussian Bar Chart",
  "chart_name": "gaussian_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[1, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "background_color", "text_color"],
  "min_height": 400,
  "min_width": 400,
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
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xColumn = dataColumns.find(col => col.role === "x");
    const yColumn = dataColumns.find(col => col.role === "y");

    if (!xColumn || !xColumn.name) {
        const errorMsg = "Critical chart config missing: x-axis field name from dataColumns. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    if (!yColumn || !yColumn.name) {
        const errorMsg = "Critical chart config missing: y-axis field name from dataColumns. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldName = xColumn.name;
    const yFieldName = yColumn.name;
    const yFieldUnit = (yColumn.unit && yColumn.unit !== "none") ? ` ${yColumn.unit}` : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimary: (colorsInput.other && colorsInput.other.primary) || '#73D2C7',
        chartBackground: colorsInput.background_color || '#FFFFFF',
        textColor: colorsInput.text_color || '#333333',
        typography: {
            title: {
                fontFamily: (typographyInput.title && typographyInput.title.font_family) || 'Arial, sans-serif',
                fontSize: (typographyInput.title && typographyInput.title.font_size) || '18px',
                fontWeight: (typographyInput.title && typographyInput.title.font_weight) || 'bold',
            },
            label: {
                fontFamily: (typographyInput.label && typographyInput.label.font_family) || 'Arial, sans-serif',
                fontSize: (typographyInput.label && typographyInput.label.font_size) || '12px',
                fontWeight: (typographyInput.label && typographyInput.label.font_weight) || 'normal',
            },
            annotation: {
                fontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || 'Arial, sans-serif',
                fontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || '12px',
                fontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || 'bold',
            }
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const sText = String(text);
        if (!sText || sText.trim() === "") return 0;
        
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = sText;
        tempSvg.appendChild(textNode);
        
        try {
            const bbox = textNode.getBBox();
            if (bbox.width > 0) return bbox.width;
            const avgCharWidth = parseFloat(fontSize) * 0.6; 
            return sText.length * avgCharWidth;
        } catch (e) {
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return sText.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function getGaussianPath(d, xScale, yScale, innerHeight, currentXFieldName, currentYFieldName) {
        const x_start = xScale(d[currentXFieldName]);
        const y_top = yScale(d[currentYFieldName]);
        const bar_width = xScale.bandwidth();
        const bar_height = Math.max(0, innerHeight - y_top);

        if (bar_height <= 0 || bar_width <= 0) return "";

        const x_center = x_start + bar_width / 2;
        const y_bottom = innerHeight;
        const half_bar_width = bar_width / 2;
        const sigma = half_bar_width / 3.2; 
        const samples = 50;

        function gaussian(x, s = 1) {
            return Math.exp(-(x * x) / (2 * s * s));
        }

        const points = [];
        const step = (half_bar_width * 2) / samples;

        for (let i = 0; i <= samples; i++) {
            const t = -half_bar_width + i * step;
            const x_point = x_center + t;
            const gauss_value = gaussian(t, sigma);
            const y_point = y_bottom - (bar_height * gauss_value); 
            points.push({ x: x_point, y: y_point });
        }
        
        const areaGenerator = d3.area()
            .x(p => p.x)
            .y0(y_bottom)
            .y1(p => p.y)
            .curve(d3.curveBasis);

        return areaGenerator(points);
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

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 60,
        right: variables.margin_right || 30,
        bottom: variables.margin_bottom || 150,
        left: variables.margin_left || 60
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = chartDataInput.map(d => ({
        [xFieldName]: d[xFieldName],
        [yFieldName]: +d[yFieldName]
    })).sort((a, b) => b[yFieldName] - a[yFieldName]);

    if (chartDataArray.length === 0 || innerWidth <=0 || innerHeight <=0) {
        mainChartGroup.append("text")
            .attr("x", innerWidth > 0 ? innerWidth / 2 : containerWidth / 2 - chartMargins.left)
            .attr("y", innerHeight > 0 ? innerHeight / 2 : containerHeight / 2 - chartMargins.top)
            .attr("text-anchor", "middle")
            .attr("class", "label no-data-label")
            .style("font-family", fillStyle.typography.label.fontFamily)
            .style("font-size", fillStyle.typography.label.fontSize)
            .style("fill", fillStyle.textColor)
            .text(innerWidth <=0 || innerHeight <=0 ? "Insufficient space to render chart." : "No data available to display.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(chartDataArray.map(d => d[xFieldName]))
        .range([0, innerWidth])
        .padding(0);

    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax * 1.1 : 1])
        .range([innerHeight, 0]);

    // Block 7: Chart Component Rendering (X-Axis Category Labels)
    const baseLabelFontSize = parseFloat(fillStyle.typography.label.fontSize);
    const minLabelFontSize = 8;
    const labelFontFamily = fillStyle.typography.label.fontFamily;
    const labelFontWeight = fillStyle.typography.label.fontWeight;
    const lineHeightFactor = 1.2;
    
    let finalLabelFontSize = baseLabelFontSize;
    let maxLinesNeeded = 1;
    const currentBarWidth = xScale.bandwidth();

    if (currentBarWidth > 0) {
        let maxTextToWidthRatio = 1;
        chartDataArray.forEach(d => {
            const labelText = String(d[xFieldName]);
            const textWidth = estimateTextWidth(labelText, labelFontFamily, baseLabelFontSize, labelFontWeight);
            const ratio = textWidth / currentBarWidth;
            if (ratio > maxTextToWidthRatio) {
                maxTextToWidthRatio = ratio;
            }
        });

        if (maxTextToWidthRatio > 1) {
            finalLabelFontSize = Math.max(minLabelFontSize, Math.floor(baseLabelFontSize / maxTextToWidthRatio));
        }

        chartDataArray.forEach(d => {
            const labelText = String(d[xFieldName]);
            const textWidth = estimateTextWidth(labelText, labelFontFamily, finalLabelFontSize, labelFontWeight);
            
            if (textWidth > currentBarWidth) {
                const words = labelText.split(/\s+/);
                let currentLine = '';
                let linesCount = 1;
                let wordWrapSuccess = false;

                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth && currentLine !== '') {
                            linesCount++;
                            currentLine = words[i];
                            if (estimateTextWidth(currentLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth) {
                                wordWrapSuccess = false; break;
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                    if (currentLine !== '') wordWrapSuccess = true;
                }

                if (words.length <= 1 || !wordWrapSuccess) {
                    linesCount = 1; currentLine = '';
                    const chars = labelText.split('');
                    for (let i = 0; i < chars.length; i++) {
                        const testCharLine = currentLine + chars[i];
                        if (estimateTextWidth(testCharLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth && currentLine !== '') {
                            linesCount++;
                            currentLine = chars[i];
                        } else {
                            currentLine = testCharLine;
                        }
                    }
                }
                if (linesCount > maxLinesNeeded) maxLinesNeeded = linesCount;
            }
        });
    } else { // currentBarWidth is 0 or less
        finalLabelFontSize = minLabelFontSize; // Use min if no width
        maxLinesNeeded = 1;
    }
    
    const labelStartY = innerHeight + 20; 
    const actualLabelLineHeight = finalLabelFontSize * lineHeightFactor;

    mainChartGroup.selectAll(".x-axis-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("text-anchor", "middle")
        .style("font-family", labelFontFamily)
        .style("font-size", `${finalLabelFontSize}px`)
        .style("font-weight", labelFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const labelText = String(d[xFieldName]);
            const textElement = d3.select(this);
            const xPos = xScale(d[xFieldName]) + xScale.bandwidth() / 2;
            
            const textWidth = estimateTextWidth(labelText, labelFontFamily, finalLabelFontSize, labelFontWeight);

            if (textWidth > currentBarWidth && currentBarWidth > 0) {
                let linesToRender = [];
                let currentLine = '';
                let wordWrapSuccess = false;
                const words = labelText.split(/\s+/);

                if (words.length > 1) {
                    for (let i = 0; i < words.length; i++) {
                        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
                        if (estimateTextWidth(testLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth && currentLine !== '') {
                            linesToRender.push(currentLine);
                            currentLine = words[i];
                            if (estimateTextWidth(currentLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth) {
                                wordWrapSuccess = false; break;
                            }
                        } else { currentLine = testLine; }
                    }
                    if (currentLine !== '') { linesToRender.push(currentLine); wordWrapSuccess = true; }
                }
                
                if (words.length <= 1 || !wordWrapSuccess) {
                    linesToRender = []; currentLine = '';
                    const chars = labelText.split('');
                    for (let i = 0; i < chars.length; i++) {
                        const testCharLine = currentLine + chars[i];
                        if (estimateTextWidth(testCharLine, labelFontFamily, finalLabelFontSize, labelFontWeight) > currentBarWidth && currentLine !== '') {
                            linesToRender.push(currentLine); currentLine = chars[i];
                        } else { currentLine = testCharLine; }
                    }
                    if (currentLine !== '') linesToRender.push(currentLine);
                }
                
                linesToRender = linesToRender.slice(0, maxLinesNeeded);

                linesToRender.forEach((line, i) => {
                    textElement.append("tspan")
                        .attr("x", xPos)
                        .attr("y", labelStartY + i * actualLabelLineHeight)
                        .attr("dy", "0.71em")
                        .text(line);
                });
            } else {
                textElement.append("tspan")
                   .attr("x", xPos)
                   .attr("y", labelStartY)
                   .attr("dy", "0.71em")
                   .text(labelText);
            }
        });

    // Block 8: Main Data Visualization Rendering
    mainChartGroup.selectAll(".bar-mark")
        .data(chartDataArray)
        .enter()
        .append("path")
        .attr("class", "mark bar-mark")
        .attr("d", d => getGaussianPath(d, xScale, yScale, innerHeight, xFieldName, yFieldName))
        .attr("fill", fillStyle.barPrimary);

    const baseAnnotationFontSize = parseFloat(fillStyle.typography.annotation.fontSize);
    const minAnnotationFontSize = 6;
    const annotationFontFamily = fillStyle.typography.annotation.fontFamily;
    const annotationFontWeight = fillStyle.typography.annotation.fontWeight;

    mainChartGroup.selectAll(".value-label")
        .data(chartDataArray)
        .enter()
        .append("text")
        .attr("class", "label value-label")
        .attr("x", d => xScale(d[xFieldName]) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d[yFieldName]) - 5)
        .attr("text-anchor", "middle")
        .style("font-family", annotationFontFamily)
        .style("font-weight", annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .each(function(d) {
            const valueText = formatValue(d[yFieldName]) + yFieldUnit;
            const maxWidth = xScale.bandwidth() > 0 ? xScale.bandwidth() * 1.1 : innerWidth * 0.1; // Fallback maxWidth
            let finalValueFontSize = baseAnnotationFontSize;

            if (maxWidth > 0) {
                const textWidth = estimateTextWidth(valueText, annotationFontFamily, baseAnnotationFontSize, annotationFontWeight);
                if (textWidth > maxWidth) {
                    finalValueFontSize = Math.max(minAnnotationFontSize, Math.floor(baseAnnotationFontSize * (maxWidth / textWidth)));
                }
            } else {
                finalValueFontSize = minAnnotationFontSize;
            }
            d3.select(this)
                .style("font-size", `${finalValueFontSize}px`)
                .text(valueText);
        });

    // Block 9: Optional Enhancements & Post-Processing
    const labelBlockBottomY = labelStartY + (maxLinesNeeded -1) * actualLabelLineHeight + finalLabelFontSize;
    const iconSize = 24;
    const iconPaddingTop = 8;
    const iconCenterY = labelBlockBottomY + iconPaddingTop + iconSize / 2;

    mainChartGroup.selectAll(".x-axis-icon")
        .data(chartDataArray)
        .enter()
        .append("image")
        .attr("class", "image icon x-axis-icon")
        .attr("xlink:href", d => (imagesInput.field && imagesInput.field[d[xFieldName]]) ? imagesInput.field[d[xFieldName]] : null)
        .attr("x", d => xScale(d[xFieldName]) + xScale.bandwidth() / 2 - iconSize / 2)
        .attr("y", iconCenterY - iconSize / 2)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("display", function(d) { // Use function for `this` context if needed, but not here
             return (imagesInput.field && imagesInput.field[d[xFieldName]]) ? null : "none";
        });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
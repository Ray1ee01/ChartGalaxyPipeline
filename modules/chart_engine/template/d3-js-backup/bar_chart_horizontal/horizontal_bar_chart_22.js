/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart with Proportional Element",
  "chart_name": "horizontal_bar_chart_22",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
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
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END
*/
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const config = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueField1Def = dataColumns.find(col => col.role === "y");
    const valueField2Def = dataColumns.find(col => col.role === "y2");

    const dimensionFieldName = dimensionFieldDef?.name;
    const valueField1Name = valueField1Def?.name;
    const valueField2Name = valueField2Def?.name;

    const missingFields = [];
    if (!dimensionFieldName) missingFields.push("dimension field (role: x)");
    if (!valueField1Name) missingFields.push("value field 1 (role: y)");
    if (!valueField2Name) missingFields.push("value field 2 (role: y2)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }

    const value1Unit = (valueField1Def?.unit && valueField1Def.unit !== "none") ? valueField1Def.unit : "";
    const value2Unit = (valueField2Def?.unit && valueField2Def.unit !== "none") ? valueField2Def.unit : "";
    
    const columnTitle1Text = valueField1Def?.name || "";
    const columnTitle2Text = valueField2Def?.name || "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) ? typographyConfig.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyConfig.title && typographyConfig.title.font_size) ? typographyConfig.title.font_size : '16px',
            titleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) ? typographyConfig.title.font_weight : 'bold',
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        backgroundColor: colorsConfig.background_color || '#FFFFFF',
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#1f77b4', // Default primary
        defaultCategoryColors: colorsConfig.available_colors || ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"], // d3.schemeCategory10
        getCategoryColor: function(categoryValue, index) {
            if (colorsConfig.field && colorsConfig.field[categoryValue]) {
                return colorsConfig.field[categoryValue];
            }
            return this.defaultCategoryColors[index % this.defaultCategoryColors.length];
        },
        getImageUrl: function(categoryValue) {
            if (imagesConfig.field && imagesConfig.field[categoryValue]) {
                return imagesConfig.field[categoryValue];
            }
            // No fallback to imagesConfig.other.primary for individual items unless specified
            return null;
        }
    };
    
    function estimateTextWidth(text, fontConfig) {
        if (!text || String(text).trim().length === 0) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempText = document.createElementNS(svgNS, 'text');
        tempText.style.fontFamily = fontConfig.fontFamily;
        tempText.style.fontSize = fontConfig.fontSize;
        tempText.style.fontWeight = fontConfig.fontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        const width = tempText.getBBox().width;
        return width;
    }

    function getWrappedLines(textContent, availableWidth, fontConfig, estimateFn) {
        const words = (textContent || "").trim().toUpperCase().split(/\s+/).filter(w => w !== "");
        const lines = [];
        const fontSizeValue = parseFloat(fontConfig.fontSize);
        const lineHeight = fontSizeValue * 1.2; 

        if (words.length === 0) {
            return { linesArray: [], numLines: 0, lineHeight: lineHeight };
        }

        let currentLine = words[0];
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + " " + word;
            if (estimateFn(testLine, fontConfig) > availableWidth && currentLine !== "") {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine !== "") {
            lines.push(currentLine);
        }
        return { linesArray: lines, numLines: lines.length, lineHeight: lineHeight };
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup
    const containerWidth = config.width || 800;
    const containerHeight = config.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-svg-root")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const iconWidth = 30;
    const iconHeight = 30;
    const textPadding = 5;
    const labelGap = 10;

    const chartMargins = {
        top: 100, // For column titles and separator line
        right: 5,
        bottom: 40,
        left: iconWidth + textPadding + 10 // Space for icon, its padding, and a bit more buffer
    };
    
    const leftColumnRatio = config.left_column_ratio !== undefined ? config.left_column_ratio : 0.85; // Allow configuration
    const rightColumnRatio = 1 - leftColumnRatio;

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const barChartWidth = innerWidth * leftColumnRatio;
    const proportionalElementChartWidth = innerWidth * rightColumnRatio;
    
    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataArray].sort((a, b) => +b[valueField1Name] - +a[valueField1Name]);
    const sortedDimensionValues = sortedChartData.map(d => d[dimensionFieldName]);

    // Block 6: Scale Definition & Configuration
    const barPadding = config.bar_padding !== undefined ? config.bar_padding : 0.2; // Allow configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionValues)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedChartData, d => +d[valueField1Name]) * 1.05 || 1])
        .range([0, barChartWidth]);

    const maxValue2 = d3.max(sortedChartData, d => +d[valueField2Name]);
    const bandWidth = yScale.bandwidth();
    const minSideLength = bandWidth > 0 ? bandWidth * 0.1 : 5; // Ensure minSideLength is positive
    const maxSideLength = bandWidth > 0 ? Math.min(bandWidth * 1.0, proportionalElementChartWidth * 0.8) : Math.max(5, proportionalElementChartWidth * 0.8);
    
    const proportionalElementSideScale = d3.scaleSqrt()
        .domain([0, maxValue2 || 1])
        .range([minSideLength, maxSideLength]);

    // Block 7: Chart Component Rendering (Column Titles, Separator Line)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const columnTitleFontConfig = { 
        fontFamily: fillStyle.typography.titleFontFamily, 
        fontSize: fillStyle.typography.titleFontSize, 
        fontWeight: fillStyle.typography.titleFontWeight 
    };
    const titleBottomPadding = 10;
    const separatorLineYPosition = chartMargins.top - titleBottomPadding - (parseFloat(columnTitleFontConfig.fontSize)*0.2); // Adjusted Y for line
    const titlesYBaseline = separatorLineYPosition - titleBottomPadding;


    if (columnTitle1Text) {
        const leftTitleAvailableWidth = barChartWidth * 0.95;
        const leftTitleXPos = chartMargins.left;
        const wrappedLeftTitle = getWrappedLines(columnTitle1Text, leftTitleAvailableWidth, columnTitleFontConfig, estimateTextWidth);
        
        if (wrappedLeftTitle.numLines > 0) {
            const initialYLeft = titlesYBaseline - (wrappedLeftTitle.numLines - 1) * wrappedLeftTitle.lineHeight;
            const leftTitleSvgText = svgRoot.append("text")
                .attr("class", "text column-title left-column-title")
                .attr("x", leftTitleXPos)
                .attr("y", initialYLeft)
                .attr("text-anchor", "start")
                .style("font-family", columnTitleFontConfig.fontFamily)
                .style("font-size", columnTitleFontConfig.fontSize)
                .style("font-weight", columnTitleFontConfig.fontWeight)
                .style("fill", fillStyle.textColor);

            wrappedLeftTitle.linesArray.forEach((line, i) => {
                leftTitleSvgText.append("tspan")
                    .attr("x", leftTitleXPos)
                    .attr("dy", i === 0 ? 0 : wrappedLeftTitle.lineHeight)
                    .text(line);
            });
        }
    }

    if (columnTitle2Text) {
        const rightTitleAvailableWidth = proportionalElementChartWidth * 0.95;
        const rightTitleXPos = containerWidth - chartMargins.right;
        const wrappedRightTitle = getWrappedLines(columnTitle2Text, rightTitleAvailableWidth, columnTitleFontConfig, estimateTextWidth);

        if (wrappedRightTitle.numLines > 0) {
            const initialYRight = titlesYBaseline - (wrappedRightTitle.numLines - 1) * wrappedRightTitle.lineHeight;
            const rightTitleSvgText = svgRoot.append("text")
                .attr("class", "text column-title right-column-title")
                .attr("x", rightTitleXPos)
                .attr("y", initialYRight)
                .attr("text-anchor", "end")
                .style("font-family", columnTitleFontConfig.fontFamily)
                .style("font-size", columnTitleFontConfig.fontSize)
                .style("font-weight", columnTitleFontConfig.fontWeight)
                .style("fill", fillStyle.textColor);

            wrappedRightTitle.linesArray.forEach((line, i) => {
                rightTitleSvgText.append("tspan")
                    .attr("x", rightTitleXPos)
                    .attr("dy", i === 0 ? 0 : wrappedRightTitle.lineHeight)
                    .text(line);
            });
        }
    }
    
    svgRoot.append("line")
        .attr("class", "other separator-line")
        .attr("x1", chartMargins.left)
        .attr("y1", separatorLineYPosition)
        .attr("x2", containerWidth - chartMargins.right)
        .attr("y2", separatorLineYPosition)
        .attr("stroke", fillStyle.textColor)
        .attr("stroke-width", 1.5);

    // Block 8: Main Data Visualization Rendering
    const dataLabelFontConfig = {
        fontFamily: fillStyle.typography.labelFontFamily,
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };

    sortedChartData.forEach((dataPoint, index) => {
        const dimensionValue = dataPoint[dimensionFieldName];
        const currentBarHeight = yScale.bandwidth(); // Use currentBarHeight for clarity
        const yPos = yScale(dimensionValue);

        if (typeof yPos === 'undefined' || currentBarHeight === undefined || currentBarHeight <= 0) {
            console.warn(`Skipping dimension due to invalid yPos or barHeight: ${dimensionValue}`);
            return;
        }
        
        const centerY = yPos + currentBarHeight / 2;
        const value1 = +dataPoint[valueField1Name];
        const value2 = +dataPoint[valueField2Name];
        const barWidthValue = xScale(value1);
        const categoryColor = fillStyle.getCategoryColor(String(dimensionValue), index);

        const iconGroup = mainChartGroup.append("g")
            .attr("class", "icon-group")
            .attr("transform", `translate(${-(iconWidth + textPadding)}, ${centerY - iconHeight / 2})`);
        
        const imageUrl = fillStyle.getImageUrl(String(dimensionValue));
        if (imageUrl) {
            iconGroup.append("image")
                .attr("class", "icon")
                .attr("x", 0).attr("y", 0)
                .attr("width", iconWidth).attr("height", iconHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", imageUrl);
        } else {
            iconGroup.append("rect")
                .attr("class", "icon placeholder-icon")
                .attr("width", iconWidth * 0.8).attr("height", iconHeight * 0.8)
                .attr("x", iconWidth * 0.1).attr("y", iconHeight * 0.1)
                .attr("fill", categoryColor).attr("opacity", 0.6);
        }

        const radius = currentBarHeight / 2;
        const arcStartX = Math.max(0, barWidthValue - radius);
        if (barWidthValue > 0) { // Only draw bar if width is positive
            mainChartGroup.append("path")
                .attr("class", "mark bar")
                .attr("d", `M 0,${yPos} 
                           L ${arcStartX},${yPos} 
                           A ${radius},${radius} 0 0,1 ${barWidthValue},${centerY} 
                           A ${radius},${radius} 0 0,1 ${arcStartX},${yPos + currentBarHeight} 
                           L 0,${yPos + currentBarHeight} 
                           Z`)
                .attr("fill", categoryColor);
        }


        const dimensionLabelText = String(dimensionValue).toUpperCase();
        const formattedValue1Text = `${formatValue(value1)}${value1Unit}`;
        const dimensionLabelWidth = estimateTextWidth(dimensionLabelText, dataLabelFontConfig);
        const value1LabelWidth = estimateTextWidth(formattedValue1Text, dataLabelFontConfig);

        const canDimFitInside = barWidthValue >= dimensionLabelWidth + 2 * textPadding;
        const canValueAlsoFitInside = barWidthValue >= textPadding + dimensionLabelWidth + textPadding + value1LabelWidth + textPadding;

        if (canDimFitInside) {
            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", textPadding).attr("y", centerY).attr("dy", "0.35em")
                .attr("text-anchor", "start").style("fill", "#FFFFFF")
                .style("font-family", dataLabelFontConfig.fontFamily).style("font-size", dataLabelFontConfig.fontSize)
                .style("font-weight", dataLabelFontConfig.fontWeight).text(dimensionLabelText);

            mainChartGroup.append("text")
                .attr("class", "label value-label value1-label")
                .attr("x", canValueAlsoFitInside ? barWidthValue - textPadding : barWidthValue + textPadding)
                .attr("y", centerY).attr("dy", "0.35em")
                .attr("text-anchor", canValueAlsoFitInside ? "end" : "start")
                .style("fill", canValueAlsoFitInside ? "#FFFFFF" : fillStyle.textColor)
                .style("font-family", dataLabelFontConfig.fontFamily).style("font-size", dataLabelFontConfig.fontSize)
                .style("font-weight", dataLabelFontConfig.fontWeight).text(formattedValue1Text);
        } else {
            const externalDimLabel = mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", barWidthValue + textPadding).attr("y", centerY).attr("dy", "0.35em")
                .attr("text-anchor", "start").style("fill", fillStyle.textColor)
                .style("font-family", dataLabelFontConfig.fontFamily).style("font-size", dataLabelFontConfig.fontSize)
                .style("font-weight", dataLabelFontConfig.fontWeight).text(dimensionLabelText);
            
            const externalDimLabelRenderedWidth = externalDimLabel.node().getBBox().width;
            
            mainChartGroup.append("text")
                .attr("class", "label value-label value1-label")
                .attr("x", barWidthValue + textPadding + externalDimLabelRenderedWidth + labelGap)
                .attr("y", centerY).attr("dy", "0.35em")
                .attr("text-anchor", "start").style("fill", fillStyle.textColor)
                .style("font-family", dataLabelFontConfig.fontFamily).style("font-size", dataLabelFontConfig.fontSize)
                .style("font-weight", dataLabelFontConfig.fontWeight).text(formattedValue1Text);
        }

        const sideLength = proportionalElementSideScale(value2);
        const squareX = barChartWidth + proportionalElementChartWidth / 2 - sideLength / 2;
        const squareY = yPos + currentBarHeight / 2 - sideLength / 2;

        if (sideLength > 0) { // Only draw square if sideLength is positive
            mainChartGroup.append("rect")
                .attr("class", "mark proportional-element")
                .attr("x", squareX).attr("y", squareY)
                .attr("width", sideLength).attr("height", sideLength)
                .attr("fill", categoryColor);
        }
            
        const formattedValue2Text = `${formatValue(value2)}${value2Unit}`;
        const value2LabelWidth = estimateTextWidth(formattedValue2Text, dataLabelFontConfig);
        const textFitsInSquare = sideLength > value2LabelWidth + 2 * textPadding;
        
        mainChartGroup.append("text")
            .attr("class", "label value-label value2-label")
            .attr("x", squareX + sideLength / 2)
            .attr("y", textFitsInSquare ? squareY + sideLength / 2 : squareY - textPadding / 2) // Adjusted Y for outside
            .attr("dy", textFitsInSquare ? "0.35em" : "-0.1em") // Adjusted dy for outside
            .attr("text-anchor", "middle")
            .style("fill", textFitsInSquare ? "#FFFFFF" : categoryColor)
            .style("font-family", dataLabelFontConfig.fontFamily).style("font-size", dataLabelFontConfig.fontSize)
            .style("font-weight", dataLabelFontConfig.fontWeight).text(formattedValue2Text);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
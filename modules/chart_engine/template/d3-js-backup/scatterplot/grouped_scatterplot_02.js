/* REQUIREMENTS_BEGIN
{
  "chart_type": "Grouped Dot Chart",
  "chart_name": "grouped_scatterplot_02",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data?.data || [];
    const variables = data.variables || {};
    const sourceTypography = data.typography || {};
    const sourceColors = data.colors || {}; // Handles both data.colors and data.colors_dark if logic outside provides one
    const sourceImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const categoryFieldLabel = dataColumns.find(col => col.role === "x")?.label || categoryFieldName;
    const valueFieldLabel = dataColumns.find(col => col.role === "y")?.label || valueFieldName;
    const groupFieldLabel = dataColumns.find(col => col.role === "group")?.label || groupFieldName;


    const missingFields = [];
    if (!categoryFieldName) missingFields.push("Category field (role: 'x') name");
    if (!valueFieldName) missingFields.push("Value field (role: 'y') name");
    if (!groupFieldName) missingFields.push("Group field (role: 'group') name");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).append("div")
                .style("color", "red")
                .style("font-family", "sans-serif") // Basic styling for error message
                .html(errorMsg);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        icons: {} // Not directly populated here, but getIconUrl uses sourceImages
    };

    const defaultTypographyStyles = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.labelFontFamily = (sourceTypography.label && sourceTypography.label.font_family) ? sourceTypography.label.font_family : defaultTypographyStyles.label.font_family;
    fillStyle.typography.labelFontSize = (sourceTypography.label && sourceTypography.label.font_size) ? sourceTypography.label.font_size : defaultTypographyStyles.label.font_size;
    fillStyle.typography.labelFontWeight = (sourceTypography.label && sourceTypography.label.font_weight) ? sourceTypography.label.font_weight : defaultTypographyStyles.label.font_weight;

    // Annotation typography (if used by a specific chart type)
    fillStyle.typography.annotationFontFamily = (sourceTypography.annotation && sourceTypography.annotation.font_family) ? sourceTypography.annotation.font_family : defaultTypographyStyles.annotation.font_family;
    fillStyle.typography.annotationFontSize = (sourceTypography.annotation && sourceTypography.annotation.font_size) ? sourceTypography.annotation.font_size : defaultTypographyStyles.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (sourceTypography.annotation && sourceTypography.annotation.font_weight) ? sourceTypography.annotation.font_weight : defaultTypographyStyles.annotation.font_weight;
    
    // Title typography (used for axis titles, legend titles)
    fillStyle.typography.titleFontFamily = (sourceTypography.title && sourceTypography.title.font_family) ? sourceTypography.title.font_family : defaultTypographyStyles.title.font_family;
    fillStyle.typography.titleFontSize = (sourceTypography.title && sourceTypography.title.font_size) ? sourceTypography.title.font_size : defaultTypographyStyles.title.font_size;
    fillStyle.typography.titleFontWeight = (sourceTypography.title && sourceTypography.title.font_weight) ? sourceTypography.title.font_weight : defaultTypographyStyles.title.font_weight;


    fillStyle.textColor = sourceColors.text_color || '#0F223B';
    fillStyle.gridLineColor = sourceColors.other?.gridLine || '#E0E0E0'; // Assuming 'gridLine' key in 'other'
    fillStyle.chartBackground = sourceColors.background_color || '#FFFFFF';

    const defaultCategoricalColors = d3.schemeCategory10;
    fillStyle.getCategoryColor = (groupName, index) => {
        if (sourceColors.field && sourceColors.field[groupName]) {
            return sourceColors.field[groupName];
        }
        if (sourceColors.available_colors && sourceColors.available_colors.length > 0) {
            return sourceColors.available_colors[index % sourceColors.available_colors.length];
        }
        return defaultCategoricalColors[index % defaultCategoricalColors.length];
    };
    
    fillStyle.getIconUrl = (itemName) => (sourceImages.field && sourceImages.field[itemName]) ? sourceImages.field[itemName] : null;


    function estimateTextWidthSVG(text, fontFamily, fontSize, fontWeight) {
        if (!text || String(text).trim().length === 0) return 0;
        const svgNS = 'http://www.w3.org/2000/svg';
        // Per prompt: "This temporary SVG MUST NOT be appended to the document DOM."
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const tempTextElement = document.createElementNS(svgNS, 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = String(text); // Ensure text is a string
        tempSvg.appendChild(tempTextElement);
        
        try {
            // Note: getBBox on unattached elements can be unreliable or return 0 in some browsers/environments.
            // This implementation adheres strictly to the "MUST NOT be appended to the document DOM" constraint.
            const width = tempTextElement.getBBox().width;
            return width;
        } catch (e) {
            // console.warn("estimateTextWidthSVG: getBBox failed for unattached element.", e);
            // Fallback for environments where getBBox fails or returns 0 for non-empty text
            const parsedFontSize = parseFloat(fontSize);
            const charWidthEstimate = (parsedFontSize && !isNaN(parsedFontSize)) ? parsedFontSize * 0.6 : 12 * 0.6; // Default to 12px if fontSize is invalid
            return String(text).length * charWidthEstimate;
        }
    }

    function wrapText(text, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!text) return [];
        const words = String(text).split(/\s+/).filter(d => d.length > 0);
        if (words.length === 0) return [];
        
        const lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = estimateTextWidthSVG(currentLine + " " + word, fontFamily, fontSize, fontWeight);
            if (width < maxWidth && maxWidth > 0) { // Ensure maxWidth is positive
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
    
    function breakLongWord(word, maxWidth, fontFamily, fontSize, fontWeight) {
        if (!word) return [];
        const characters = String(word).split('');
        const lines = [];
        let currentLine = '';
        
        for (let char of characters) {
            const testLine = currentLine + char;
            const width = estimateTextWidthSVG(testLine, fontFamily, fontSize, fontWeight);
            if (width < maxWidth && maxWidth > 0) { // Ensure maxWidth is positive
                currentLine = testLine;
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = char; 
                if (estimateTextWidthSVG(currentLine, fontFamily, fontSize, fontWeight) > maxWidth && maxWidth > 0) {
                    lines.push(currentLine); 
                    currentLine = ''; 
                }
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    function formatLargeNumber(value) {
        if (value === null || value === undefined || isNaN(Number(value))) return '0';
        const numValue = Number(value);
        const sign = numValue < 0 ? '-' : '';
        const absValue = Math.abs(numValue);
        
        if (absValue >= 1e9) return sign + (absValue / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (absValue >= 1e6) return sign + (absValue / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (absValue >= 1e3) return sign + (absValue / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        if (absValue !== 0 && absValue < 1 && absValue > -1) return sign + absValue.toFixed(3).replace(/\.?0+$/, ''); // Handle small decimals
        return sign + Math.round(absValue).toString(); // Round other numbers to whole
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800; // Default width if not provided
    const containerHeight = variables.height || 600; // Default height if not provided

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    // Initial margins, may be adjusted based on label sizes
    let chartMargins = { top: 75, right: 30, bottom: 70, left: 30 }; 

    // --- X-axis needs for margin calculation ---
    const tempMaxValueForDomain = d3.max(chartDataArray, d => +d[valueFieldName]) || 0;
    const tempMinValueForDomain = d3.min(chartDataArray, d => +d[valueFieldName]) || 0;
    // Ensure domain starts at 0 unless there are negative values
    const domainStart = tempMinValueForDomain < 0 ? tempMinValueForDomain : 0; 

    const tempXScaleForTicks = d3.scaleLinear().domain([domainStart, tempMaxValueForDomain]).nice();
    const xAxisTickValues = tempXScaleForTicks.ticks(5); // Suggest 5 ticks

    let maxXAxisLabelHeight = 0;
    if (xAxisTickValues.length > 0) {
        maxXAxisLabelHeight = parseFloat(fillStyle.typography.labelFontSize) * 1.2; // Approx height of one line
    }
    const xAxisTitleHeight = parseFloat(fillStyle.typography.titleFontSize) * 1.5; // Approx height for axis title
    const xAxisPadding = 15;
    chartMargins.bottom = Math.max(chartMargins.bottom, maxXAxisLabelHeight + xAxisTitleHeight + xAxisPadding);

    let maxXAxisTickLabelWidth = 0;
    if (xAxisTickValues.length > 0) {
        xAxisTickValues.forEach(tick => {
            const formattedTickText = formatLargeNumber(tick);
            const textWidth = estimateTextWidthSVG(
                formattedTickText, 
                fillStyle.typography.labelFontFamily, 
                fillStyle.typography.labelFontSize, 
                fillStyle.typography.labelFontWeight
            );
            maxXAxisTickLabelWidth = Math.max(maxXAxisTickLabelWidth, textWidth);
        });
    }
    // Adjust right margin for the last tick label, if it's wide
    chartMargins.right = Math.max(chartMargins.right, (maxXAxisTickLabelWidth / 2) + 10);


    // --- Y-axis needs for margin calculation ---
    const uniqueCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const iconPadding = 5;
    let maxYAxisDynamicLabelWidth = 0;

    // Estimate icon size based on a preliminary band height
    let preliminaryInnerHeightForIconEst = containerHeight - chartMargins.top - chartMargins.bottom;
    preliminaryInnerHeightForIconEst = Math.max(preliminaryInnerHeightForIconEst, 50); // Min height
    let preliminaryYScaleForIconEst = d3.scaleBand().domain(uniqueCategories).range([0, preliminaryInnerHeightForIconEst]).padding(0.1);
    let estIconHeight = preliminaryYScaleForIconEst.bandwidth() > 0 ? preliminaryYScaleForIconEst.bandwidth() * 0.6 : 20;
    estIconHeight = Math.max(10, Math.min(estIconHeight, 30)); // Constrain icon height
    let estIconWidth = estIconHeight * 1.33; // Assuming 4:3 aspect ratio

    const maxYAxisLabelAllowedSpace = containerWidth * 0.25; // Max 25% of width for Y labels
    const minDynamicFontSizeForYLabels = 8;
    const baseDynamicFontSizeForYLabels = parseFloat(fillStyle.typography.labelFontSize);
    
    const yLabelsRenderInfo = {}; // Store calculated rendering info for Y labels

    uniqueCategories.forEach(cat => {
        const iconUrl = fillStyle.getIconUrl(cat);
        const hasIcon = !!iconUrl;
        const iconSpaceForLabel = hasIcon ? estIconWidth + iconPadding : 0;
        
        const availableWidthForText = Math.max(10, maxYAxisLabelAllowedSpace - iconSpaceForLabel);

        const initialLabelWidth = estimateTextWidthSVG(cat, fillStyle.typography.labelFontFamily, `${baseDynamicFontSizeForYLabels}px`, fillStyle.typography.labelFontWeight);
        
        let currentFontSize = baseDynamicFontSizeForYLabels;
        let currentLines = [String(cat)]; // Ensure string
        let needsAdjustment = false;

        if (initialLabelWidth > availableWidthForText) {
            needsAdjustment = true;
            // Try reducing font size
            const scaleFactor = availableWidthForText / initialLabelWidth;
            currentFontSize = Math.max(minDynamicFontSizeForYLabels, baseDynamicFontSizeForYLabels * scaleFactor * 0.95); // Add buffer

            // Try wrapping with new font size
            const widthAtNewSize = estimateTextWidthSVG(cat, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
            if (widthAtNewSize > availableWidthForText) {
                 if (String(cat).includes(" ")) {
                    currentLines = wrapText(cat, availableWidthForText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                 }
                 if (currentLines.length === 1 && estimateTextWidthSVG(currentLines[0], fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight) > availableWidthForText) {
                    currentLines = breakLongWord(cat, availableWidthForText, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
                 }
            } else {
                currentLines = [String(cat)]; // String(cat) was fine with new font size
            }
        }
        
        yLabelsRenderInfo[cat] = {
            fontSize: currentFontSize,
            lines: currentLines,
            needsAdjustment: needsAdjustment || currentLines.length > 1
        };

        let maxTextLineWidthForThisCat = 0;
        currentLines.forEach(line => {
            const lineWidth = estimateTextWidthSVG(line, fillStyle.typography.labelFontFamily, `${currentFontSize}px`, fillStyle.typography.labelFontWeight);
            maxTextLineWidthForThisCat = Math.max(maxTextLineWidthForThisCat, lineWidth);
        });
        
        const totalRequiredWidthForThisCat = iconSpaceForLabel + maxTextLineWidthForThisCat;
        maxYAxisDynamicLabelWidth = Math.max(maxYAxisDynamicLabelWidth, totalRequiredWidthForThisCat);
    });

    const yAxisPadding = 20; // Padding to the left of Y-axis labels
    chartMargins.left = Math.max(chartMargins.left, maxYAxisDynamicLabelWidth + yAxisPadding);
    
    // Final inner dimensions
    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Ensure innerWidth and innerHeight are not negative or too small
    if (innerWidth < 50) {
        innerWidth = 50;
        chartMargins.right = Math.max(10, containerWidth - chartMargins.left - innerWidth);
        innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    }
    if (innerHeight < 50) {
        innerHeight = 50;
        chartMargins.bottom = Math.max(10, containerHeight - chartMargins.top - innerHeight);
        innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    }

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    // `uniqueCategories` already calculated in Block 4
    const uniqueGroups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(uniqueCategories)
        .range([0, innerHeight])
        .padding(0.2); // Increased padding slightly for visual separation

    const xScale = d3.scaleLinear()
        .domain(tempXScaleForTicks.domain()) // Use domain from temp scale (includes .nice())
        .range([0, innerWidth]);

    const colorScale = d3.scaleOrdinal()
        .domain(uniqueGroups)
        .range(uniqueGroups.map((group, i) => fillStyle.getCategoryColor(group, i)));

    const pointRadius = Math.max(3, Math.min(yScale.bandwidth() * 0.2, 8));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    // --- X-axis ---
    const xAxisGenerator = d3.axisBottom(xScale)
        .ticks(xAxisTickValues.length > 0 ? xAxisTickValues : 5) // Use calculated ticks or default
        .tickFormat(d => formatLargeNumber(d))
        .tickSizeOuter(0)
        .tickPadding(8);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxisGenerator);

    xAxisGroup.select(".domain").remove(); // Remove axis line
    xAxisGroup.selectAll(".tick line").remove(); // Remove tick lines
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label tick-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    mainChartGroup.append("text")
        .attr("class", "label axis-title x-axis-title")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + chartMargins.bottom - (parseFloat(fillStyle.typography.titleFontSize) * 0.5) ) 
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.titleFontFamily) 
        .style("font-size", fillStyle.typography.titleFontSize)
        .style("font-weight", fillStyle.typography.titleFontWeight) 
        .style("fill", fillStyle.textColor)
        .text(valueFieldLabel);

    // --- Gridlines ---
    const gridLinePadding = 5; // How much grid lines extend beyond the first/last category center
    const yTopGridPos = uniqueCategories.length > 0 ? yScale(uniqueCategories[0]) + yScale.bandwidth() / 2 : 0;
    const yBottomGridPos = uniqueCategories.length > 0 ? yScale(uniqueCategories[uniqueCategories.length - 1]) + yScale.bandwidth() / 2 : innerHeight;

    mainChartGroup.append("g")
        .attr("class", "grid vertical-grid")
        .selectAll("line.gridline") // More specific selector
        .data(xScale.ticks(xAxisTickValues.length > 0 ? xAxisTickValues.length : 5)) // Match X-axis ticks
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", yTopGridPos - gridLinePadding)
        .attr("y2", yBottomGridPos + gridLinePadding)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.7);

    mainChartGroup.append("g")
        .attr("class", "grid horizontal-grid")
        .selectAll("line.gridline")
        .data(uniqueCategories)
        .enter().append("line")
        .attr("class", "gridline")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d) + yScale.bandwidth() / 2)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-opacity", 0.7);

    // --- Y-axis Labels & Icons ---
    const yAxisLabelsGroup = mainChartGroup.append("g").attr("class", "axis y-axis custom-labels");
    uniqueCategories.forEach(cat => {
        const yPosCenter = yScale(cat) + yScale.bandwidth() / 2;
        const iconUrl = fillStyle.getIconUrl(cat);
        const hasIcon = !!iconUrl;
        
        const actualIconHeight = estIconHeight; 
        const actualIconWidth = estIconWidth;

        const labelInfo = yLabelsRenderInfo[cat];
        const lineCount = labelInfo.lines.length;
        const currentLabelFontSize = labelInfo.fontSize;
        const lineHeight = currentLabelFontSize * 1.2; // Standard line height factor
        const totalTextBlockHeight = lineHeight * lineCount - (lineCount > 0 ? (currentLabelFontSize * 0.2) : 0) ; // Adjust for multi-line spacing
        
        const labelXOffset = hasIcon ? -(actualIconWidth + iconPadding + 5) : -8; // Increased padding from axis line

        const categoryElementGroup = yAxisLabelsGroup.append("g").attr("class", "y-axis-category-group");

        if (hasIcon) {
            categoryElementGroup.append("image")
                .attr("class", "icon y-axis-icon")
                .attr("xlink:href", iconUrl)
                .attr("x", -(actualIconWidth + iconPadding)) // Position icon to the left
                .attr("y", yPosCenter - actualIconHeight / 2) // Vertically center icon
                .attr("width", actualIconWidth)
                .attr("height", actualIconHeight);
        }
        
        const textElementGroup = categoryElementGroup.append("g").attr("class", "label-group");
        // Calculate start Y for text block to be centered
        const textBlockStartY = yPosCenter - totalTextBlockHeight / 2 + (lineHeight / 2) - (currentLabelFontSize * 0.1); // Fine-tune vertical alignment

        labelInfo.lines.forEach((line, i) => {
            textElementGroup.append("text")
                .attr("class", "label y-axis-label")
                .attr("x", labelXOffset)
                .attr("y", textBlockStartY + (i * lineHeight))
                .attr("text-anchor", "end") // Right-align text
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${currentLabelFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(line);
        });
    });

    // --- Legend ---
    if (uniqueGroups.length > 0) {
        const legendConfig = {
            fontSize: parseFloat(fillStyle.typography.labelFontSize),
            minFontSize: 9,
            markRadius: pointRadius > 5 ? 5 : Math.max(3, pointRadius),
            itemPadding: 5, // Padding between mark and text
            columnPadding: 15, // Padding between legend items
            rowPadding: 8, // Padding between legend rows
            titleFontSize: parseFloat(fillStyle.typography.titleFontSize),
            titleFontWeight: fillStyle.typography.titleFontWeight,
        };

        let legendItemsData = [];
        let totalLegendWidthUnscaled = 0;

        uniqueGroups.forEach(group => {
            const text = String(group);
            const textWidth = estimateTextWidthSVG(text, fillStyle.typography.labelFontFamily, `${legendConfig.fontSize}px`, fillStyle.typography.labelFontWeight);
            const itemWidth = (legendConfig.markRadius * 2) + legendConfig.itemPadding + textWidth;
            legendItemsData.push({ group: text, textWidth, itemWidth });
            totalLegendWidthUnscaled += itemWidth + legendConfig.columnPadding;
        });
        if (legendItemsData.length > 0) totalLegendWidthUnscaled -= legendConfig.columnPadding;

        const maxAllowedLegendWidth = innerWidth * 0.95; // Legend can take up to 95% of inner chart width
        let finalLegendFontSize = legendConfig.fontSize;
        let finalMarkRadius = legendConfig.markRadius;

        if (totalLegendWidthUnscaled > maxAllowedLegendWidth) {
            const scaleFactor = maxAllowedLegendWidth / totalLegendWidthUnscaled;
            finalLegendFontSize = Math.max(legendConfig.minFontSize, legendConfig.fontSize * scaleFactor * 0.9); // Add buffer
            finalMarkRadius = Math.max(legendConfig.markRadius * 0.6, legendConfig.markRadius * scaleFactor * 0.9);
            
            legendItemsData.forEach(item => { // Recalculate widths with new font size
                item.textWidth = estimateTextWidthSVG(item.group, fillStyle.typography.labelFontFamily, `${finalLegendFontSize}px`, fillStyle.typography.labelFontWeight);
                item.itemWidth = (finalMarkRadius * 2) + legendConfig.itemPadding + item.textWidth;
            });
        }
        
        const legendTitleText = groupFieldLabel || "Legend"; // Fallback legend title
        const legendTitleWidth = estimateTextWidthSVG(legendTitleText, fillStyle.typography.titleFontFamily, `${legendConfig.titleFontSize}px`, legendConfig.titleFontWeight);

        const legendContainerGroup = svgRoot.append("g")
            .attr("class", "legend chart-legend");
            // Position will be set after calculating total legend width/height

        const legendTitleElement = legendContainerGroup.append("text")
            .attr("class", "label legend-title")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.titleFontFamily)
            .style("font-size", `${legendConfig.titleFontSize}px`)
            .style("font-weight", legendConfig.titleFontWeight)
            .style("fill", fillStyle.textColor)
            .text(legendTitleText);
        
        const legendItemsRenderGroup = legendContainerGroup.append("g").attr("class", "legend-items");
        let currentX = 0;
        let currentY = 0; // Relative Y for items within their group
        const legendItemLineHeight = finalLegendFontSize + legendConfig.rowPadding;

        legendItemsData.forEach((item, index) => {
            const itemGroup = legendItemsRenderGroup.append("g")
                .attr("class", "legend-item");

            itemGroup.append("circle")
                .attr("class", "mark legend-mark")
                .attr("cx", finalMarkRadius)
                .attr("cy", finalLegendFontSize / 2 - finalMarkRadius / 2) // Align mark with text baseline
                .attr("r", finalMarkRadius)
                .attr("fill", colorScale(item.group));

            itemGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", (finalMarkRadius * 2) + legendConfig.itemPadding)
                .attr("y", finalLegendFontSize / 2) // Align text baseline
                .attr("dominant-baseline", "middle")
                .attr("text-anchor", "start")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${finalLegendFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(item.group);
            
            const currentItemBBox = itemGroup.node().getBBox();
            if (index > 0 && (currentX + currentItemBBox.width + legendConfig.columnPadding) > maxAllowedLegendWidth) {
                currentX = 0;
                currentY += legendItemLineHeight;
            }
            itemGroup.attr("transform", `translate(${currentX}, ${currentY})`);
            currentX += currentItemBBox.width + legendConfig.columnPadding;
        });
        
        // Position the legend
        const legendItemsBBox = legendItemsRenderGroup.node().getBBox();
        const legendTitleBBox = legendTitleElement.node().getBBox();
        
        const totalLegendHeight = Math.max(legendTitleBBox.height, legendItemsBBox.height); // If title and items are side-by-side
        // Or if title is above: legendTitleBBox.height + (items exist ? rowPadding : 0) + legendItemsBBox.height
        
        // Simple horizontal layout: Title then Items
        legendTitleElement.attr("transform", `translate(0, ${totalLegendHeight / 2 - legendTitleBBox.height / 2})`); // Center title vertically
        legendItemsRenderGroup.attr("transform", `translate(${legendTitleWidth + (legendItemsData.length > 0 ? legendConfig.columnPadding : 0)}, ${totalLegendHeight / 2 - legendItemsBBox.height / 2})`); // Center items vertically
        
        const finalLegendBBox = legendContainerGroup.node().getBBox();
        const legendX = chartMargins.left + (innerWidth - finalLegendBBox.width) / 2; // Center legend horizontally in plot area
        const legendY = chartMargins.top / 2 - finalLegendBBox.height / 2; // Center in top margin
        legendContainerGroup.attr("transform", `translate(${legendX}, ${legendY})`);
    }


    // Block 8: Main Data Visualization Rendering
    mainChartGroup.append("g")
        .attr("class", "data-points scatter-points")
        .selectAll("circle.data-point") // More specific selector
        .data(chartDataArray)
        .enter()
        .append("circle")
        .attr("class", "mark data-point")
        .attr("cx", d => xScale(+d[valueFieldName]))
        .attr("cy", d => yScale(d[categoryFieldName]) + yScale.bandwidth() / 2)
        .attr("r", pointRadius)
        .attr("fill", d => colorScale(d[groupFieldName]));

    // Block 9: Optional Enhancements & Post-Processing
    // (No specific enhancements in this chart beyond core elements)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
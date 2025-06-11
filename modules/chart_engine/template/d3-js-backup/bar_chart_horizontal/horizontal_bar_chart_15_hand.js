/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart With Circle",
  "chart_name": "horizontal_bar_chart_15",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 15], [0, "inf"], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "detailed",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && Array.isArray(data.data.data) ? data.data.data : (Array.isArray(data.data) ? data.data : []);
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueField1Config = dataColumns.find(col => col.role === "y");
    const valueField2Config = dataColumns.find(col => col.role === "y2");

    const dimensionFieldName = dimensionFieldConfig?.name;
    const valueField1Name = valueField1Config?.name;
    const valueField2Name = valueField2Config?.name;

    if (!dimensionFieldName || !valueField1Name || !valueField2Name) {
        const missingFields = [
            !dimensionFieldName ? "x role field" : null,
            !valueField1Name ? "y role field" : null,
            !valueField2Name ? "y2 role field" : null
        ].filter(Boolean).join(", ");
        const errorMessage = `Critical chart config missing: [${missingFields}]. Cannot render.`;
        console.error(errorMessage);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMessage}</div>`);
        return null;
    }

    const valueUnit1 = valueField1Config?.unit === "none" ? "" : (valueField1Config?.unit || "");
    const valueUnit2 = valueField2Config?.unit === "none" ? "" : (valueField2Config?.unit || "");
    
    const columnTitle1 = valueField1Config?.name || "Value 1";
    const columnTitle2 = valueField2Config?.name || "Value 2";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barColor: colorsConfig.other?.primary || "#4269d0",
        circleColor: colorsConfig.other?.secondary || "#6cc5b0",
        textColor: colorsConfig.text_color || "#000000",
        chartBackground: colorsConfig.background_color || "#FFFFFF",
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyConfig.title?.font_size || "16px", // Not used for main titles, but for legend-like titles
            titleFontWeight: typographyConfig.title?.font_weight || "bold",
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        }
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('width', '0');
        tempSvg.setAttribute('height', '0');
        // Note: Appending to body and then removing is more reliable for getComputedTextLength/getBBox
        // but per spec, strictly in-memory. getBBox should work.
        // document.body.appendChild(tempSvg); 

        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        
        let width = 0;
        try {
            width = tempTextElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail without DOM attachment
            width = text.length * (parseInt(fontProps.fontSize) * 0.6); 
        }
        // tempSvg.remove(); // If appended to body
        return width;
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function wrapText(d3TextSelection, text, maxWidth, lineHeightEm) {
        d3TextSelection.each(function() {
            const textElement = d3.select(this);
            const words = text.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textElement.attr("x");
            const y = textElement.attr("y");
            const dy = parseFloat(textElement.attr("dy") || 0);
            
            let tspan = textElement.text(null).append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = textElement.append("tspan")
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", (++lineNumber * lineHeightEm) + dy + "em")
                        .text(word);
                }
            }
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 20, bottom: 30, left: 20 }; // Adjusted top for legend-titles

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const sortedData = [...chartDataInput].sort((a, b) => +b[valueField1Name] - +a[valueField1Name]);
    const sortedDimensions = sortedData.map(d => d[dimensionFieldName]);

    const tempFontProps = { 
        fontFamily: fillStyle.typography.labelFontFamily, 
        fontSize: fillStyle.typography.labelFontSize,
        fontWeight: fillStyle.typography.labelFontWeight
    };
    const maxLabelWidth = Math.max(...sortedDimensions.map(d => estimateTextWidth(String(d).toUpperCase(), tempFontProps)), 0);
    const maxValueWidth = Math.max(...sortedData.map(d => estimateTextWidth(`${formatValue(+d[valueField1Name])}${valueUnit1}`, tempFontProps)), 0);
    const maxValue2Width = Math.max(...sortedData.map(d => estimateTextWidth(`${formatValue(+d[valueField2Name])}${valueUnit2}`, tempFontProps)), 0); // Though used for centered labels, good to know

    const barPadding = 0.2;
    const itemCount = sortedDimensions.length || 1;
    
    let barHeight = (innerHeight / itemCount) * (1 - barPadding);
    const MAX_BAR_HEIGHT = 80; 
    barHeight = Math.min(barHeight, MAX_BAR_HEIGHT);
    const actualBarHeight = barHeight; // yScale.bandwidth() will be this

    const flagHeight = Math.min(40, actualBarHeight * 0.8); 
    const flagWidth = flagHeight; 
    const flagMargin = 8;
    const textIconGap = 8;
    const valueLabelGap = 5;

    const leftContentWidth = maxLabelWidth + flagWidth + flagMargin + textIconGap;
    chartMargins.left = Math.max(chartMargins.left, leftContentWidth + 10); // Ensure space for labels and icons

    // Recalculate innerWidth with potentially updated chartMargins.left
    const currentInnerWidth = containerWidth - chartMargins.left - chartMargins.right;

    const barChartRatio = 0.75; 
    const circleChartRatio = 0.25;

    const barChartMaxWidth = currentInnerWidth * barChartRatio - maxValueWidth - valueLabelGap;
    const circleChartPartWidth = currentInnerWidth * circleChartRatio;
    
    const maxCircleDiameter = Math.min(circleChartPartWidth * 0.7, actualBarHeight * 1.2);


    // Block 5: Data Preprocessing & Transformation
    // (Sorting already done in Block 4 for label measurement, data is in `sortedData`)

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);
    // const actualBarHeight = yScale.bandwidth(); // This would be more accurate if height wasn't fixed by MAX_BAR_HEIGHT logic before scale definition

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField1Name]) || 1]) // Ensure domain is at least 1
        .range([0, barChartMaxWidth]);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(sortedData, d => +d[valueField2Name]) || 1])
        .range([Math.min(5, actualBarHeight * 0.1), maxCircleDiameter / 2]);

    // Block 7: Chart Component Rendering (Legend-like Column Titles)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top / 2})`); // Position above chart

    const legendItemHeight = 20;
    const legendSwatchSize = 14;
    const legendTextOffsetX = legendSwatchSize + 5;
    const legendTitleFont = {
        fontFamily: fillStyle.typography.titleFontFamily,
        fontSize: fillStyle.typography.titleFontSize,
        fontWeight: fillStyle.typography.titleFontWeight,
    };

    // Left legend item (for bars)
    const leftLegend = legendGroup.append("g").attr("class", "legend-item");
    leftLegend.append("rect")
        .attr("x", 0)
        .attr("y", (legendItemHeight - legendSwatchSize) / 2)
        .attr("width", legendSwatchSize)
        .attr("height", legendSwatchSize)
        .attr("fill", fillStyle.barColor)
        .attr("class", "mark");

    const leftLegendText = leftLegend.append("text")
        .attr("x", legendTextOffsetX)
        .attr("y", legendItemHeight / 2)
        .attr("dy", "0.35em")
        .style("font-family", legendTitleFont.fontFamily)
        .style("font-size", legendTitleFont.fontSize)
        .style("font-weight", legendTitleFont.fontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label")
        .text(columnTitle1);
    
    // Wrap left legend text if necessary (estimate available width)
    const legendAreaWidth = currentInnerWidth / 2 - legendTextOffsetX - 10; // Approximate width for each legend item
    wrapText(leftLegendText, columnTitle1, legendAreaWidth, 1.2);


    // Right legend item (for circles)
    // Position it to the right half of the chart's content area
    const rightLegendXPosition = currentInnerWidth / 2 + 10;
    const rightLegend = legendGroup.append("g")
        .attr("class", "legend-item")
        .attr("transform", `translate(${rightLegendXPosition}, 0)`);

    rightLegend.append("circle")
        .attr("cx", legendSwatchSize / 2)
        .attr("cy", legendItemHeight / 2)
        .attr("r", legendSwatchSize / 2)
        .attr("fill", fillStyle.circleColor)
        .attr("class", "mark");

    rightLegend.append("text")
        .attr("x", legendTextOffsetX)
        .attr("y", legendItemHeight / 2)
        .attr("dy", "0.35em")
        .style("font-family", legendTitleFont.fontFamily)
        .style("font-size", legendTitleFont.fontSize)
        .style("font-weight", legendTitleFont.fontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label")
        .text(columnTitle2);
        // No wrap for right, assuming it's shorter or layout handles it.

    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const itemsGroup = mainChartGroup.selectAll(".chart-item")
        .data(sortedData)
        .enter()
        .append("g")
        .attr("class", "chart-item")
        .attr("transform", d => `translate(0, ${yScale(d[dimensionFieldName])})`);

    // Dimension Labels (e.g., Country Name)
    itemsGroup.append("text")
        .attr("class", "label dimension-label")
        .attr("x", -flagWidth - flagMargin - textIconGap)
        .attr("y", actualBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => String(d[dimensionFieldName]).toUpperCase());

    // Icons
    itemsGroup.each(function(d) {
        const group = d3.select(this);
        const iconUrl = imagesConfig.field && imagesConfig.field[d[dimensionFieldName]] 
                        ? imagesConfig.field[d[dimensionFieldName]] 
                        : (imagesConfig.other?.default || null);
        if (iconUrl) {
            group.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", -flagWidth - flagMargin)
                .attr("y", (actualBarHeight - flagHeight) / 2)
                .attr("width", flagWidth)
                .attr("height", flagHeight)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
    });
    
    // Bars
    itemsGroup.append("rect")
        .attr("class", "mark bar-mark")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => xScale(+d[valueField1Name]))
        .attr("height", actualBarHeight)
        .attr("fill", fillStyle.barColor);

    // Bar Value Labels
    itemsGroup.append("text")
        .attr("class", "value bar-value-label")
        .attr("x", d => xScale(+d[valueField1Name]) + valueLabelGap)
        .attr("y", actualBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${formatValue(+d[valueField1Name])}${valueUnit1}`);

    // Circles
    const circleXPosition = barChartMaxWidth + maxValueWidth + valueLabelGap + circleChartPartWidth / 2;
    itemsGroup.append("circle")
        .attr("class", "mark circle-mark")
        .attr("cx", circleXPosition)
        .attr("cy", actualBarHeight / 2)
        .attr("r", d => radiusScale(+d[valueField2Name]))
        .attr("fill", fillStyle.circleColor)
        .attr("opacity", 0.8);

    // Circle Value Labels
    itemsGroup.append("text")
        .attr("class", "value circle-value-label")
        .attr("x", circleXPosition)
        .attr("y", actualBarHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", d => { // Adjust font size if circle is too small
            const r = radiusScale(+d[valueField2Name]);
            return r < 10 ? "8px" : fillStyle.typography.labelFontSize;
        })
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${formatValue(+d[valueField2Name])}${valueUnit2}`);

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - None in this refactor beyond core)
    // Removed svg2roughjs logic.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart With Circle",
  "chart_name": "vertical_bar_chart_02",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "minimal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data?.columns || [];
    let chartDataArray = data.data?.data || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xField = dataColumns.find(col => col.role === "x")?.name;
    const yField = dataColumns.find(col => col.role === "y")?.name;
    const y2Field = dataColumns.find(col => col.role === "y2")?.name; // Percentage field

    if (!xField || !yField || !y2Field) {
        const missingFields = [
            !xField ? "x role field" : null,
            !yField ? "y role field" : null,
            !y2Field ? "y2 role field" : null
        ].filter(Boolean).join(", ");

        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing for fields: ${missingFields}. Chart cannot be rendered.</div>`);
        return null;
    }

    const yFieldUnit = dataColumns.find(col => col.role === "y")?.unit === "none" ? "" :
                       dataColumns.find(col => col.role === "y")?.unit || "";
    const y2FieldUnit = dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" :
                        dataColumns.find(col => col.role === "y2")?.unit || "%";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        },
        textColor: colorsConfig.text_color || "#0f223b",
        barColor: colorsConfig.other?.primary || "#FF9F55",
        indicatorColor: colorsConfig.other?.secondary || "#8BDB24",
        valueLabelTextColor: "#FFFFFF", // Specific for labels on bars
        chartBackground: colorsConfig.background_color || "#FFFFFF" // Not directly applied to SVG background, but available
    };

    function estimateTextWidth(text, fontProps) {
        const defaultFont = {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        };
        const mergedProps = { ...defaultFont, ...fontProps };
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', mergedProps.fontFamily);
        tempText.setAttribute('font-size', mergedProps.fontSize);
        tempText.setAttribute('font-weight', mergedProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: Appending to body and then removing is more reliable for getBBox if not using getComputedTextLength
        // but for in-memory estimation, this is the typical approach.
        // For more accuracy with getBBox without DOM append:
        // document.body.appendChild(tempSvg);
        // const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        // return width;
        // Using a simpler approach for now, acknowledging potential inaccuracies without DOM append for getBBox.
        // A common alternative is to use canvas measureText or rely on getComputedTextLength for elements in DOM.
        // For this template, we'll assume a basic getBBox call on an unattached element.
        try {
            return tempText.getBBox().width;
        } catch (e) { // Fallback if getBBox fails on unattached element in some environments
            return text.length * (parseFloat(mergedProps.fontSize) * 0.6); // Heuristic
        }
    }
    
    function formatValue(value) {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
    }

    function calculateFontSize(text, maxWidth, baseFontSizePx = 12, minFontSizePx = 10, fontWeight = fillStyle.typography.labelFontWeight, fontFamily = fillStyle.typography.labelFontFamily) {
        if (!text || typeof text !== 'string' || !maxWidth || maxWidth <= 0) {
            return Math.max(minFontSizePx, baseFontSizePx);
        }
        let fontSize = baseFontSizePx;
        let textWidth = estimateTextWidth(text, { fontSize: `${fontSize}px`, fontWeight, fontFamily });

        while (textWidth > maxWidth && fontSize > minFontSizePx) {
            fontSize -= 1;
            textWidth = estimateTextWidth(text, { fontSize: `${fontSize}px`, fontWeight, fontFamily });
        }
        return Math.max(fontSize, minFontSizePx);
    }

    function wrapText(textElement, textContent, maxWidth, lineHeight = 1.1, alignment = 'middle') {
        const words = textContent.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const initialX = parseFloat(textElement.attr("x")) || 0;
        const currentFontSize = textElement.style("font-size");
        const currentFontFamily = textElement.style("font-family");
        const currentFontWeight = textElement.style("font-weight");

        textElement.text(null);
        let tspans = [];

        if (words.length > 1) {
            let currentLineArray = [];
            while (word = words.pop()) {
                currentLineArray.push(word);
                if (estimateTextWidth(currentLineArray.join(" "), { fontSize: currentFontSize, fontFamily: currentFontFamily, fontWeight: currentFontWeight }) > maxWidth && currentLineArray.length > 1) {
                    currentLineArray.pop();
                    tspans.push(currentLineArray.join(" "));
                    currentLineArray = [word];
                    lineNumber++;
                }
            }
            if (currentLineArray.length > 0) {
                tspans.push(currentLineArray.join(" "));
            }
        } else { // Single word or no spaces, try character wrapping
            const chars = textContent.split('');
            let currentLineChars = '';
            for (let i = 0; i < chars.length; i++) {
                const nextLineChars = currentLineChars + chars[i];
                if (estimateTextWidth(nextLineChars, { fontSize: currentFontSize, fontFamily: currentFontFamily, fontWeight: currentFontWeight }) > maxWidth && currentLineChars.length > 0) {
                    tspans.push(currentLineChars);
                    currentLineChars = chars[i];
                    lineNumber++;
                } else {
                    currentLineChars = nextLineChars;
                }
            }
            if (currentLineChars.length > 0) {
                tspans.push(currentLineChars);
            }
        }
        
        const totalLines = tspans.length;
        let startDy = 0;
        if (alignment === 'middle') {
            startDy = -((totalLines - 1) * lineHeight / 2);
        } else if (alignment === 'bottom') {
             startDy = -( (totalLines -1) * lineHeight);
        }

        tspans.forEach((lineText, i) => {
            textElement.append("tspan")
                .attr("class", "text-line")
                .attr("x", initialX)
                .attr("dy", (i === 0 ? startDy : lineHeight) + "em")
                .text(lineText);
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(chartConfig.width) || 800;
    const containerHeight = parseFloat(chartConfig.height) || 500;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground); // Optional: set background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 80, right: 30, bottom: 80, left: 40 }; // Increased bottom for potentially wrapped labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 5: Data Preprocessing & Transformation
    // chartDataArray is already prepared. Ensure values are numbers.
    chartDataArray.forEach(d => {
        d[yField] = +d[yField];
        d[y2Field] = +d[y2Field];
    });
    
    const categories = chartDataArray.map(d => d[xField]);
    const minPercentage = d3.min(chartDataArray, d => d[y2Field]) || 0;
    const maxPercentage = d3.max(chartDataArray, d => d[y2Field]) || 0;

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.2); // Fixed padding

    const yMax = d3.max(chartDataArray, d => d[yField]) || 0;
    const yScale = d3.scaleLinear()
        .domain([0, yMax * 1.2]) // Add 20% headroom
        .range([innerHeight, 0]);

    const minCircleRadius = Math.max(5, xScale.bandwidth() / 10); // Ensure min radius is not too small
    const maxCircleRadius = xScale.bandwidth() / 3;
    const minArea = Math.PI * Math.pow(minCircleRadius, 2);
    const maxArea = Math.PI * Math.pow(maxCircleRadius, 2);
    
    const areaScale = d3.scaleLinear()
        .domain([minPercentage, maxPercentage])
        .range([minArea, maxArea]);
    if (minPercentage === maxPercentage) { // Handle case where all percentages are the same
        areaScale.range([(minArea + maxArea) / 2, (minArea + maxArea) / 2]);
    }


    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // X-Axis Labels
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`);

    const baseFontSizeForXAxis = parseFloat(fillStyle.typography.labelFontSize);
    const labelMaxWidth = xScale.bandwidth() * 0.95;

    xAxisGroup.selectAll(".x-axis-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label x-axis-label")
        .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
        .attr("y", chartMargins.bottom / 3) // Position below the chart area, adjust as needed
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => d.toString())
        .each(function(d) {
            const textElement = d3.select(this);
            const determinedFontSize = calculateFontSize(d.toString(), labelMaxWidth, baseFontSizeForXAxis, 8, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
            textElement.style("font-size", `${determinedFontSize}px`);
            if (estimateTextWidth(d.toString(), { fontSize: `${determinedFontSize}px`, fontWeight: fillStyle.typography.labelFontWeight, fontFamily: fillStyle.typography.labelFontFamily }) > labelMaxWidth) {
                wrapText(textElement, d.toString(), labelMaxWidth, 1.1, 'top');
            }
        });

    // Legend for Percentage Circle
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${chartMargins.left + innerWidth / 2}, ${chartMargins.top / 2})`); // Position above chart

    legendGroup.append("circle")
        .attr("class", "mark legend-mark")
        .attr("cx", -15) // Adjusted for centering
        .attr("cy", 0)
        .attr("r", 8)
        .attr("fill", fillStyle.indicatorColor);

    const legendTextElement = legendGroup.append("text")
        .attr("class", "label legend-label")
        .attr("x", 0) // Adjusted for centering
        .attr("y", 0)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(y2Field);
    
    const legendTextWidth = estimateTextWidth(y2Field, {fontSize: fillStyle.typography.labelFontSize, fontFamily: fillStyle.typography.labelFontFamily, fontWeight: fillStyle.typography.labelFontWeight});
    const legendTotalWidth = 15 (circle offset) + 8 (circle radius) + 5 (spacing) + legendTextWidth;
    legendGroup.attr("transform", `translate(${chartMargins.left + (innerWidth - legendTotalWidth) / 2 + 15 + 8 + 5}, ${chartMargins.top / 2.5})`);


    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${xScale(d[xField])}, 0)`);

    barGroups.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", d => yScale(d[yField]))
        .attr("width", xScale.bandwidth())
        .attr("height", d => innerHeight - yScale(d[yField]))
        .attr("fill", fillStyle.barColor);

    // Value Labels (at bottom of bars)
    barGroups.append("text")
        .attr("class", "value value-label-on-bar")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", innerHeight - 5) // Position near bottom of chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-weight", "bold") // Often bold for emphasis
        .style("fill", fillStyle.valueLabelTextColor)
        .text(d => `${formatValue(d[yField])}${yFieldUnit ? " " + yFieldUnit : ""}`)
        .each(function(d) {
            const textContent = `${formatValue(d[yField])}${yFieldUnit ? " " + yFieldUnit : ""}`;
            const valueLabelMaxWidth = xScale.bandwidth() * 0.9;
            const baseSize = parseFloat(fillStyle.typography.annotationFontSize) || 10;
            const fontSize = calculateFontSize(textContent, valueLabelMaxWidth, baseSize, 8, "bold", fillStyle.typography.labelFontFamily);
            d3.select(this).style("font-size", `${fontSize}px`);
            if (estimateTextWidth(textContent, {fontSize: `${fontSize}px`, fontWeight: "bold", fontFamily: fillStyle.typography.labelFontFamily}) > valueLabelMaxWidth) {
                wrapText(d3.select(this), textContent, valueLabelMaxWidth, 1.0, 'bottom');
            }
        });
        
    // Percentage Circles
    barGroups.append("circle")
        .attr("class", "mark indicator-circle")
        .attr("cx", xScale.bandwidth() / 2)
        .attr("cy", d => yScale(d[yField])) // Center at the top of the bar
        .attr("r", d => {
            const area = areaScale(d[y2Field]);
            return area > 0 ? Math.sqrt(area / Math.PI) : 0; // Ensure radius is not NaN for area 0
        })
        .attr("fill", fillStyle.indicatorColor);

    // Percentage Labels (above circles)
    barGroups.append("text")
        .attr("class", "value percentage-label")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", d => {
            const area = areaScale(d[y2Field]);
            const radius = area > 0 ? Math.sqrt(area / Math.PI) : 0;
            return yScale(d[yField]) - radius - 5; // Position above the circle
        })
        .attr("text-anchor", "middle")
        .attr("dy", "-0.1em") // Fine-tune vertical alignment
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize) // Typically smaller
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${formatValue(d[y2Field])}${y2FieldUnit}`)
        .each(function(d) {
            const textContent = `${formatValue(d[y2Field])}${y2FieldUnit}`;
            const percentageLabelMaxWidth = xScale.bandwidth() * 1.1; // Can be slightly wider
            const baseSize = parseFloat(fillStyle.typography.annotationFontSize) || 10;
            const fontSize = calculateFontSize(textContent, percentageLabelMaxWidth, baseSize, 8, fillStyle.typography.labelFontWeight, fillStyle.typography.labelFontFamily);
            d3.select(this).style("font-size", `${fontSize}px`);
             if (estimateTextWidth(textContent, {fontSize: `${fontSize}px`, fontWeight: fillStyle.typography.labelFontWeight, fontFamily: fillStyle.typography.labelFontFamily}) > percentageLabelMaxWidth) {
                wrapText(d3.select(this), textContent, percentageLabelMaxWidth, 1.0, 'middle');
            }
        });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
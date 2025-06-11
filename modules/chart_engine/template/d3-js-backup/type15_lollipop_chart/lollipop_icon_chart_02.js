/* REQUIREMENTS_BEGIN
{
  "chart_type": "Lollipop Chart",
  "chart_name": "lollipop_icon_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 12], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "visible",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */
function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const valueFieldUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y")?.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    if (!chartDataArray || chartDataArray.length === 0) {
        const errorMsg = "No data provided to render the chart.";
        console.error(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typographyConfig.title?.font_size || '16px',
            titleFontWeight: typographyConfig.title?.font_weight || 'bold',
            labelFontFamily: typographyConfig.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyConfig.label?.font_size || '12px',
            labelFontWeight: typographyConfig.label?.font_weight || 'normal',
            annotationFontFamily: typographyConfig.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyConfig.annotation?.font_size || '10px',
            annotationFontWeight: typographyConfig.annotation?.font_weight || 'normal'
        },
        textColor: colorsConfig.text_color || '#333333',
        primaryColor: (colorsConfig.other && colorsConfig.other.primary) ? colorsConfig.other.primary : '#F7941D',
        gridLineColor: '#e0e0e0',
        backgroundColor: colorsConfig.background_color || '#FFFFFF' // Not used for chart bg, but good to have
    };
    
    // In-memory text measurement utility
    const estimateTextWidth = (text, fontProps) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.style.fontFamily = fontProps.fontFamily || fillStyle.typography.labelFontFamily;
        tempTextElement.style.fontSize = fontProps.fontSize || fillStyle.typography.labelFontSize;
        tempTextElement.style.fontWeight = fontProps.fontWeight || fillStyle.typography.labelFontWeight;
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // Note: Appending to body and then removing is more reliable for getBBox, but trying without first.
        // If issues, uncomment: document.body.appendChild(tempSvg);
        const width = tempTextElement.getBBox().width;
        // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        return width;
    };

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value).replace('M', 'M');
        if (value >= 1000) return d3.format("~.2s")(value).replace('k', 'K');
        return d3.format("~g")(value);
    };
    
    function wrapText(d3TextSelection, text, maxWidth, lineHeightEm = 1.1, verticalAnchor = 'middle') {
        d3TextSelection.each(function() {
            const textElement = d3.select(this);
            const words = text.toString().split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textElement.attr("x");
            const y = textElement.attr("y"); // y is baseline for first tspan
            
            textElement.text(null); // Clear existing text
            let tspans = [];

            // Try word-based wrapping first
            if (words.length > 1 || text.includes(' ')) {
                let currentLineWords = [];
                while (word = words.pop()) {
                    currentLineWords.push(word);
                    const testTspan = textElement.append("tspan").text(currentLineWords.join(" "));
                    if (testTspan.node().getComputedTextLength() > maxWidth && currentLineWords.length > 1) {
                        currentLineWords.pop(); // remove last word
                        tspans.push(currentLineWords.join(" "));
                        currentLineWords = [word]; // new line starts with this word
                    }
                    testTspan.remove();
                }
                if (currentLineWords.length > 0) {
                    tspans.push(currentLineWords.join(" "));
                }
            } else { // Character-based wrapping if no spaces or single long word
                const chars = text.toString().split('');
                let currentLineChars = '';
                for (let i = 0; i < chars.length; i++) {
                    const testLine = currentLineChars + chars[i];
                    const testTspan = textElement.append("tspan").text(testLine);
                    if (testTspan.node().getComputedTextLength() > maxWidth && currentLineChars.length > 0) {
                        tspans.push(currentLineChars);
                        currentLineChars = chars[i];
                    } else {
                        currentLineChars = testLine;
                    }
                    testTspan.remove();
                }
                if (currentLineChars.length > 0) {
                    tspans.push(currentLineChars);
                }
            }

            const numLines = tspans.length;
            let startDy;
            if (verticalAnchor === 'middle') {
                startDy = -((numLines - 1) / 2) * lineHeightEm + "em";
            } else if (verticalAnchor === 'bottom') {
                 startDy = -(numLines - 1) * lineHeightEm + "em";
            } else { // top or default
                startDy = "0em"; 
            }

            tspans.forEach((lineText, i) => {
                textElement.append("tspan")
                    .attr("x", x)
                    .attr("dy", i === 0 ? startDy : lineHeightEm + "em")
                    .text(lineText);
            });
        });
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(chartConfig.width) || 800;
    const containerHeight = parseFloat(chartConfig.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        // Removed viewBox and responsive styles as per requirements

    const chartMargins = { top: 40, right: 60, bottom: 90, left: 60 };
    // Adjust bottom margin if category labels are long or need more space
    const maxDimLabelHeightEstimate = (parseInt(fillStyle.typography.labelFontSize) || 12) * 2.5; // Estimate 2 lines max + padding
    chartMargins.bottom = Math.max(chartMargins.bottom, maxDimLabelHeightEstimate + 20);


    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataArray.map(d => ({
        ...d,
        [valueFieldName]: +d[valueFieldName] // Ensure value is numeric
    })).sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    
    const categories = processedData.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(0.2);

    const columnWidth = xScale.bandwidth();
    const lollipopStickWidth = Math.max(2, Math.min(10, columnWidth * 0.1)); // Thinner stick
    const lollipopHeadRadius = Math.max(5, Math.min(20, columnWidth * 0.3));
    const iconSize = lollipopHeadRadius * 1.5; // Icon slightly larger than head

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d[valueFieldName]) * 1.1 || 10]) // Ensure domain is at least 0-10
        .range([innerHeight - (lollipopHeadRadius * 2), 0]); // Adjust range for head radius

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Y-Axis Gridlines
    mainChartGroup.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat("")
        )
        .selectAll("line")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-dasharray", "3,3");
    mainChartGroup.select(".grid .domain").remove();

    // Y-Axis
    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickSize(0).tickPadding(8).tickFormat(d => formatValue(d)));
        
    yAxisGroup.select(".domain").remove(); // No axis line
    yAxisGroup.selectAll(".tick text")
        .attr("class", "label axis-label")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lollipopGroup = mainChartGroup.selectAll(".lollipop-item")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "lollipop-item mark")
        .attr("transform", d => `translate(${xScale(d[categoryFieldName]) + xScale.bandwidth() / 2}, 0)`);

    // Lollipop Sticks
    lollipopGroup.append("line")
        .attr("class", "mark lollipop-stick")
        .attr("x1", 0)
        .attr("y1", innerHeight)
        .attr("x2", 0)
        .attr("y2", d => yScale(d[valueFieldName]))
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", lollipopStickWidth);

    // Lollipop Heads (Circles)
    lollipopGroup.append("circle")
        .attr("class", "mark lollipop-head")
        .attr("cx", 0)
        .attr("cy", d => yScale(d[valueFieldName]))
        .attr("r", lollipopHeadRadius)
        .attr("fill", fillStyle.primaryColor);

    // Icons on Lollipop Heads
    lollipopGroup.each(function(d) {
        const group = d3.select(this);
        const categoryValue = d[categoryFieldName];
        if (imagesConfig.field && imagesConfig.field[categoryValue]) {
            group.append("image")
                .attr("class", "image icon lollipop-icon")
                .attr("xlink:href", imagesConfig.field[categoryValue])
                .attr("x", -iconSize / 2)
                .attr("y", d => yScale(d[valueFieldName]) - iconSize / 2)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });
    
    // Value Labels (above lollipop head)
    lollipopGroup.append("text")
        .attr("class", "value data-label")
        .attr("x", 0)
        .attr("y", d => yScale(d[valueFieldName]) - lollipopHeadRadius - 5) // Position above head
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            const formatted = formatValue(d[valueFieldName]);
            return valueFieldUnit ? `${formatted} ${valueFieldUnit}` : formatted;
        })
        .each(function(d) {
            const labelText = valueFieldUnit ? `${formatValue(d[valueFieldName])} ${valueFieldUnit}` : formatValue(d[valueFieldName]);
            // Simple check for value label width, can be enhanced with wrapText if needed
            const textWidth = estimateTextWidth(labelText, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight
            });
            if (textWidth > xScale.bandwidth() * 1.2) { // If wider than band * 1.2
                 // Attempt to wrap value labels if they are too wide
                 // This is a simplified approach; more robust wrapping might be needed
                 d3.select(this).call(wrapText, labelText, xScale.bandwidth() * 1.2, 1.1, 'bottom');
            }
        });


    // Category Labels (at the bottom)
    const categoryLabelGroup = mainChartGroup.append("g").attr("class", "category-labels");
    processedData.forEach(d => {
        const category = d[categoryFieldName];
        const xPos = xScale(category) + xScale.bandwidth() / 2;
        
        const label = categoryLabelGroup.append("text")
            .attr("class", "label category-label")
            .attr("x", xPos)
            .attr("y", innerHeight + (parseInt(fillStyle.typography.labelFontSize) || 12) * 1.2) // Position below chart
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(category);

        // Apply wrapping to category labels
        const labelMaxWidth = xScale.bandwidth() * 1.5; // Allow some overflow but wrap if too much
        label.call(wrapText, category.toString(), labelMaxWidth, 1.1, 'top');
    });


    // Block 9: Optional Enhancements & Post-Processing
    // No complex effects, gradients, or shadows as per requirements.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
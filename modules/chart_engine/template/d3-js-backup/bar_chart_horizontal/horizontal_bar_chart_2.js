/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_2",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {}; // Parsed but not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    const categoryFieldName = categoryFieldDef ? categoryFieldDef.name : undefined;
    const valueFieldName = valueFieldDef ? valueFieldDef.name : undefined;
    
    let missingFields = [];
    if (!categoryFieldName) missingFields.push("category field (role: 'x')");
    if (!valueFieldName) missingFields.push("value field (role: 'y')");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }

    // const categoryFieldUnit = categoryFieldDef && categoryFieldDef.unit !== "none" ? categoryFieldDef.unit : ""; // Typically unused for categories
    const valueFieldUnit = valueFieldDef && valueFieldDef.unit !== "none" ? ` ${valueFieldDef.unit}` : "";


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            // titleFontFamily: typographyInput.title?.font_family || 'Arial, sans-serif', // Titles not rendered
            // titleFontSize: typographyInput.title?.font_size || '16px',
            // titleFontWeight: typographyInput.title?.font_weight || 'bold',
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            // annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif', // Annotations not rendered
            // annotationFontSize: typographyInput.annotation?.font_size || '10px',
            // annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        barPrimary: colorsInput.other?.primary || '#D32F2F', // Default red
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF', // Default white background for SVG
    };
    fillStyle.barHighlight = d3.rgb(fillStyle.barPrimary).brighter(0.8).toString();

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Appending to body and removing is more reliable but forbidden by directives.
        // document.body.appendChild(tempSvg); 
        let width = 0;
        try {
            width = textNode.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth failed for text:", text, e);
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Very rough fallback
            width = String(text).length * avgCharWidth;
        }
        // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More robust large number formatting
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
             return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value); // For smaller numbers or when no suffix is needed
    };

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
    const chartMargins = {
        top: 20, // Reduced, no main title
        right: 20, // Initial, will be adjusted
        bottom: 20, // Reduced, no x-axis labels / title
        left: 10   // Initial, will be adjusted
    };
    
    let maxCategoryLabelWidth = 0;
    if (chartDataInput.length > 0) {
        chartDataInput.forEach(d => {
            const labelText = String(d[categoryFieldName] || "");
            const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (width > maxCategoryLabelWidth) {
                maxCategoryLabelWidth = width;
            }
        });
    }
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + 15); // Add padding

    let maxValueLabelWidth = 0;
    if (chartDataInput.length > 0) {
        const maxValue = d3.max(chartDataInput, d => +d[valueFieldName]);
        if (maxValue !== undefined) {
            const labelText = formatValue(maxValue) + valueFieldUnit;
            const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            maxValueLabelWidth = width;
        }
    }
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 10); // Add padding

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Adjust margins, container size, or font sizes.";
        console.error(errorMsg);
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", "sans-serif")
            .style("fill", "red")
            .text("Error: Chart dimensions too small.");
        return svgRoot.node();
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        category: d[categoryFieldName],
        value: +d[valueFieldName]
    })).filter(d => d.category != null && !isNaN(d.value) && isFinite(d.value));

    if (processedData.length === 0) {
        console.warn("No valid data available to render the chart after processing.");
        mainChartGroup.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("fill", fillStyle.textColor)
            .text("No data to display.");
        return svgRoot.node();
    }
    
    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerHeight])
        .padding(0.3);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 1]) // Ensure domain is at least [0,1]
        .range([0, innerWidth])
        .nice();

    const colorScale = (d, i) => {
        if (variables.highlightLastBar !== false && i === processedData.length - 1) { // Allow disabling highlight via variables
            return fillStyle.barHighlight;
        }
        return fillStyle.barPrimary;
    };

    // Block 7: Chart Component Rendering (Axes - NO Main Titles/Subtitles)
    const xAxisGenerator = d3.axisBottom(xScale)
        .ticks(Math.max(2, Math.min(Math.floor(innerWidth / 80), 5)))
        .tickFormat(d => formatValue(d) + valueFieldUnit)
        .tickSize(0)
        .tickPadding(10);

    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxisGenerator);
    
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll("text").remove(); // Per original logic and metadata "xAxis: none"

    const yAxisGenerator = d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10); 

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxisGenerator);
        
    yAxisGroup.selectAll("text")
        .attr("class", "label y-axis-label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "end");
    
    // yAxisGroup.select(".domain").remove(); // Keep domain line for Y-axis unless "minimal" strictly means no domain

    // Block 8: Main Data Visualization Rendering
    const barElements = mainChartGroup.selectAll(".bar-mark")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar-mark")
        .attr("y", d => yScale(d.category))
        .attr("x", 0)
        .attr("width", d => Math.max(0, xScale(d.value)))
        .attr("height", yScale.bandwidth())
        .attr("fill", (d, i) => colorScale(d, i));

    const dataLabels = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.value) + 5)
        .attr("y", d => yScale(d.category) + yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "start")
        .text(d => formatValue(d.value) + valueFieldUnit);

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this version)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
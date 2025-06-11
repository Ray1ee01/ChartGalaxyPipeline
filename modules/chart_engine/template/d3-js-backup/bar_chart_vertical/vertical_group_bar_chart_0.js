/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Grouped Bar Chart",
  "chart_name": "vertical_grouped_bar_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["text_color", "background_color"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {}; // Though not used in this specific chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const xFieldName = xFieldDef ? xFieldDef.name : undefined;
    const yFieldName = yFieldDef ? yFieldDef.name : undefined;
    const groupFieldName = groupFieldDef ? groupFieldDef.name : undefined;

    const xFieldUnit = xFieldDef && xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const yFieldUnit = yFieldDef && yFieldDef.unit !== "none" ? yFieldDef.unit : "";
    // const groupFieldUnit = groupFieldDef && groupFieldDef.unit !== "none" ? groupFieldDef.unit : ""; // Not used

    if (!xFieldName || !yFieldName || !groupFieldName) {
        let missingFields = [];
        if (!xFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!yFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 12px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const chartDataArray = rawChartData;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {},
        colors: rawColors, // Store raw colors for direct access if needed
        images: rawImages  // Store raw images
    };

    // Typography defaults
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography.titleFontFamily = (rawTypography.title && rawTypography.title.font_family) || defaultTypography.title.font_family;
    fillStyle.typography.titleFontSize = (rawTypography.title && rawTypography.title.font_size) || defaultTypography.title.font_size;
    fillStyle.typography.titleFontWeight = (rawTypography.title && rawTypography.title.font_weight) || defaultTypography.title.font_weight;

    fillStyle.typography.labelFontFamily = (rawTypography.label && rawTypography.label.font_family) || defaultTypography.label.font_family;
    fillStyle.typography.labelFontSize = (rawTypography.label && rawTypography.label.font_size) || defaultTypography.label.font_size;
    fillStyle.typography.labelFontWeight = (rawTypography.label && rawTypography.label.font_weight) || defaultTypography.label.font_weight;
    
    fillStyle.typography.annotationFontFamily = (rawTypography.annotation && rawTypography.annotation.font_family) || defaultTypography.annotation.font_family;
    fillStyle.typography.annotationFontSize = (rawTypography.annotation && rawTypography.annotation.font_size) || defaultTypography.annotation.font_size;
    fillStyle.typography.annotationFontWeight = (rawTypography.annotation && rawTypography.annotation.font_weight) || defaultTypography.annotation.font_weight;

    // Color defaults & definitions
    const defaultTextColor = '#0f223b';
    const defaultBackgroundColor = '#FFFFFF';
    const defaultCategoricalPalette = d3.schemeCategory10;

    fillStyle.textColor = fillStyle.colors.text_color || defaultTextColor;
    fillStyle.backgroundColor = fillStyle.colors.background_color || defaultBackgroundColor;
    
    fillStyle.getGroupColor = (groupName, groupIndex) => {
        if (fillStyle.colors.field && fillStyle.colors.field[groupName]) {
            return fillStyle.colors.field[groupName];
        }
        if (fillStyle.colors.available_colors && fillStyle.colors.available_colors.length > 0) {
            return fillStyle.colors.available_colors[groupIndex % fillStyle.colors.available_colors.length];
        }
        return defaultCategoricalPalette[groupIndex % defaultCategoricalPalette.length];
    };
    
    // Helper: In-memory text measurement
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontFamily);
        textNode.setAttribute('font-size', fontSize);
        textNode.setAttribute('font-weight', fontWeight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // No need to append to DOM for getBBox on <text>
        return textNode.getBBox().width;
    }

    // Helper: Value formatting
    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "N/A";
        if (value >= 1000000000) return d3.format("~.2s")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.2s")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.2s")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Helper: Text wrapping (adapted from original)
    function wrapText(textElement, str, maxWidth, lineHeight = 1.1, verticalAlignment = 'middle') {
        if (!str || typeof str !== 'string') str = "";
        const words = str.split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        
        const initialY = parseFloat(textElement.attr("data-initial-y") || textElement.attr("y") || 0);
        const initialX = parseFloat(textElement.attr("x") || 0);

        textElement.text(null); // Clear existing content
        let tspansContent = [];

        if (words.length === 1 && words[0] === "") { // Handle empty string
             // do nothing, effectively an empty text element
        } else if (words.length > 1 || (words.length === 1 && words[0] !== "")) {
            let currentLine = [];
            while (word = words.pop()) {
                currentLine.push(word);
                const tempTspan = textElement.append("tspan").text(currentLine.join(" ")); // Measure
                const textWidth = tempTspan.node().getComputedTextLength();
                tempTspan.remove();

                if (textWidth > maxWidth && currentLine.length > 1) {
                    currentLine.pop(); // Remove last word
                    tspansContent.push(currentLine.join(" "));
                    currentLine = [word]; // New line starts with this word
                    lineNumber++;
                }
            }
            if (currentLine.length > 0) {
                tspansContent.push(currentLine.join(" "));
            }
        }
        
        // If any line is still too long (e.g. single long word), try character wrapping
        let finalTspansContent = [];
        tspansContent.forEach(lineText => {
            const tempTspan = textElement.append("tspan").text(lineText);
            const textWidth = tempTspan.node().getComputedTextLength();
            tempTspan.remove();

            if (textWidth > maxWidth) {
                let currentSubLine = "";
                for (let char of lineText) {
                    const tempSubTspan = textElement.append("tspan").text(currentSubLine + char);
                    const subLineWidth = tempSubTspan.node().getComputedTextLength();
                    tempSubTspan.remove();
                    if (subLineWidth > maxWidth && currentSubLine.length > 0) {
                        finalTspansContent.push(currentSubLine);
                        currentSubLine = char;
                    } else {
                        currentSubLine += char;
                    }
                }
                if (currentSubLine.length > 0) finalTspansContent.push(currentSubLine);
            } else {
                finalTspansContent.push(lineText);
            }
        });
        tspansContent = finalTspansContent;


        const totalLines = tspansContent.length;
        let startDyOffset = 0;
        textElement.attr("y", initialY); // Reset Y to initial value for tspans

        if (verticalAlignment === 'middle') {
            startDyOffset = -( (totalLines - 1) * lineHeight / 2);
        } else if (verticalAlignment === 'bottom') {
            startDyOffset = -( (totalLines - 1) * lineHeight);
        } // 'top' alignment is startDyOffset = 0 (implicit)

        tspansContent.forEach((lineText, i) => {
            textElement.append("tspan")
                .attr("x", initialX) 
                .attr("dy", (i === 0 ? startDyOffset : lineHeight) + "em")
                .text(lineText);
        });
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(variables.width) || 800;
    const containerHeight = parseFloat(variables.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor); // Apply background to SVG root

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 50, // Adjusted for potential data labels on top
        right: 30,
        bottom: 80, // For X-axis labels
        left: 60  // For Y-axis labels
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort(); // Sort for consistent color mapping

    const processedData = chartDataArray.reduce((acc, d) => {
        const category = d[xFieldName];
        const group = d[groupFieldName];
        const value = +d[yFieldName];

        let existingCategory = acc.find(item => item.category === category);
        if (existingCategory) {
            existingCategory.groups[group] = value;
        } else {
            const newCategory = { category: category, groups: {} };
            groups.forEach(g => newCategory.groups[g] = 0); // Initialize all groups for consistent structure
            newCategory.groups[group] = value;
            acc.push(newCategory);
        }
        return acc;
    }, []);
    
    // Ensure categories are sorted if xFieldName is sortable, or maintain original order
    // For now, using order from data. If specific sort order is needed, it should be handled here.


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);

    const groupScale = d3.scaleBand()
        .domain(groups)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

    const yMax = d3.max(chartDataArray, d => +d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([0, yMax > 0 ? yMax : 1]) // Ensure domain is not [0,0]
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(10));

    xAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", "middle")
        .attr("data-initial-y", parseFloat(fillStyle.typography.labelFontSize) * 0.5) // Adjust for vertical alignment
        .each(function(d) {
            wrapText(d3.select(this), String(d), xScale.bandwidth(), 1.1, 'top');
        });
    xAxisGroup.select(".domain").remove(); // Remove x-axis line if desired, or style it

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : '')).tickSize(0).tickPadding(10));

    yAxisGroup.selectAll(".tick text")
        .attr("class", "label")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);
        
    yAxisGroup.select(".domain").remove(); // Remove Y-axis line

    // No Legend as per requirements

    // Block 8: Main Data Visualization Rendering
    const categoryGroups = mainChartGroup.selectAll(".category-group")
        .data(processedData)
        .enter()
        .append("g")
        .attr("class", "other category-group") // "other" for grouping, or more specific
        .attr("transform", d => `translate(${xScale(d.category)}, 0)`);

    groups.forEach((groupName, groupIndex) => {
        categoryGroups.append("rect")
            .attr("class", "mark bar") // Added "bar" for more specific styling if needed
            .attr("x", d => groupScale(groupName))
            .attr("y", d => yScale(d.groups[groupName] || 0))
            .attr("width", groupScale.bandwidth())
            .attr("height", d => innerHeight - yScale(d.groups[groupName] || 0))
            .attr("fill", fillStyle.getGroupColor(groupName, groupIndex));

        // Data labels on bars
        categoryGroups.append("text")
            .attr("class", "label data-label") // Added "data-label"
            .attr("x", d => groupScale(groupName) + groupScale.bandwidth() / 2)
            .attr("data-initial-y", d => yScale(d.groups[groupName] || 0) - 5) // Position above bar
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColor)
            .text(d => {
                const value = d.groups[groupName] || 0;
                return formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
            })
            .each(function(d) {
                // Simple hide if text too wide, wrapText could be used for more complex labels
                const textWidth = this.getBBox().width;
                if (textWidth > groupScale.bandwidth() + 10) { // Allow some overflow
                    d3.select(this).text(""); // Hide if too wide
                }
                 // Or use wrapText for data labels if multi-line is desired:
                 // const value = d.groups[groupName] || 0;
                 // const labelText = formatValue(value) + (yFieldUnit ? ` ${yFieldUnit}` : '');
                 // wrapText(d3.select(this), labelText, groupScale.bandwidth(), 1.0, 'bottom');
            });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., Annotations, Icons, Interactive Elements - not in this chart)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
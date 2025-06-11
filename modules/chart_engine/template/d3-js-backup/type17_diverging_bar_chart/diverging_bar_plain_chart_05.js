/* REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Bar Chart",
  "chart_name": "diverging_bar_plain_chart_05",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
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
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    // const imagesConfig = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");
    const groupFieldDef = dataColumns.find(col => col.role === "group");

    if (!dimensionFieldDef || !valueFieldDef || !groupFieldDef) {
        const missing = [
            !dimensionFieldDef ? '"x" role' : null,
            !valueFieldDef ? '"y" role' : null,
            !groupFieldDef ? '"group" role' : null,
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: data columns for roles ${missing} not found. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align: center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    const dimensionUnit = dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";
    const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : "";

    const allDimensions = [...new Set(chartDataArray.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    if (groups.length < 2) {
        const errorMsg = "Critical chart config missing: at least two groups are required for a diverging bar chart. Cannot render.";
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align: center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    const leftGroup = groups[0];
    const rightGroup = groups[1];

    const dimensions = [...allDimensions]; // Use original order

    const isDataComplete = dimensions.every(dimension => {
        const hasLeftData = chartDataArray.some(d => d[dimensionFieldName] === dimension && d[groupFieldName] === leftGroup);
        const hasRightData = chartDataArray.some(d => d[dimensionFieldName] === dimension && d[groupFieldName] === rightGroup);
        return hasLeftData && hasRightData;
    });

    if (!isDataComplete) {
        const errorMsg = "Data integrity issue: Not all dimensions have data for both required groups. Cannot render chart.";
        console.error(errorMsg);
        d3.select(containerSelector)
            .html("") // Clear previous errors if any
            .append("div")
            .attr("class", "error-message")
            .style("color", "orange")
            .style("text-align", "center")
            .style("padding", "20px")
            .style("font-family", typographyConfig.label?.font_family || "Arial, sans-serif")
            .style("font-size", typographyConfig.label?.font_size || "12px")
            .html(errorMsg);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyConfig.title?.font_size || "16px",
            titleFontWeight: typographyConfig.title?.font_weight || "bold",
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        },
        textColor: colorsConfig.text_color || "#333333",
        chartBackground: colorsConfig.background_color || "transparent", // Default to transparent
        groupColors: {},
    };

    groups.forEach((group, i) => {
        if (colorsConfig.field && colorsConfig.field[group]) {
            fillStyle.groupColors[group] = colorsConfig.field[group];
        } else if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            fillStyle.groupColors[group] = colorsConfig.available_colors[i % colorsConfig.available_colors.length];
        } else {
            fillStyle.groupColors[group] = d3.schemeCategory10[i % 10];
        }
    });
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvgNode.style.visibility = 'hidden';
        tempSvgNode.style.position = 'absolute';
        // No need to append to DOM for getBBox if attributes are set correctly on text element
        
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontFamily);
        tempTextNode.setAttribute('font-size', fontSize);
        tempTextNode.setAttribute('font-weight', fontWeight);
        tempTextNode.textContent = text;
        
        tempSvgNode.appendChild(tempTextNode);
        // Appending to body temporarily to ensure getBBox works reliably in all browsers
        document.body.appendChild(tempSvgNode);
        const width = tempTextNode.getBBox().width;
        document.body.removeChild(tempSvgNode);
        
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        } else {
            return d3.format("~g")(value);
        }
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
    const chartMargins = { top: 60, right: 30, bottom: 40, left: 30 }; // Adjusted top margin for group labels
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    // const centerX = chartMargins.left + innerWidth / 2; // Not directly used, but good for context

    let maxLabelWidth = 0;
    dimensions.forEach(dimension => {
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        const textWidth = estimateTextWidth(
            formattedDimension,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontSize,
            fillStyle.typography.labelFontWeight
        );
        maxLabelWidth = Math.max(maxLabelWidth, textWidth);
    });
    const dimensionLabelWidth = Math.max(maxLabelWidth + 10, 80); // Add padding, min 80px

    // Block 5: Data Preprocessing & Transformation
    // (Most relevant data like `dimensions`, `leftGroup`, `rightGroup` already prepared in Block 1)

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3);

    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);

    const leftXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([innerWidth / 2 - dimensionLabelWidth / 2, 0]);

    const rightXScale = d3.scaleLinear()
        .domain([0, maxValue])
        .range([0, innerWidth / 2 - dimensionLabelWidth / 2]);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map(g => fillStyle.groupColors[g]));

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`);

    // Group Labels (Top)
    const formattedLeftGroup = groupUnit ? `${leftGroup}${groupUnit}` : `${leftGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label")
        .attr("x", innerWidth / 4)
        .attr("y", -20) // Position above the chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedLeftGroup);

    const formattedRightGroup = groupUnit ? `${rightGroup}${groupUnit}` : `${rightGroup}`;
    mainChartGroup.append("text")
        .attr("class", "label group-label")
        .attr("x", innerWidth * 3 / 4)
        .attr("y", -20) // Position above the chart area
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(formattedRightGroup);

    // Dimension Labels (Center)
    dimensions.forEach(dimension => {
        const yPos = yScale(dimension) + yScale.bandwidth() / 2;
        const formattedDimension = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", innerWidth / 2)
            .attr("y", yPos)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .text(formattedDimension);
    });

    // Block 8: Main Data Visualization Rendering
    // Left Bars
    dimensions.forEach(dimension => {
        const dataPoint = chartDataArray.find(d =>
            d[dimensionFieldName] === dimension && d[groupFieldName] === leftGroup
        );

        if (dataPoint) {
            const value = +dataPoint[valueFieldName];
            const barWidth = innerWidth / 2 - dimensionLabelWidth / 2 - leftXScale(value);
            const yPos = yScale(dimension);
            const barHeight = yScale.bandwidth();
            const radius = barHeight / 2;
            
            const xStart = leftXScale(value); // Leftmost X of the bar
            const xEnd = xStart + barWidth;   // Rightmost X of the bar (towards center)

            let pathDataLeft = "";
            if (barWidth > 0) {
                if (barWidth < radius) { // Bar is shorter than its potential radius (half-circle)
                    pathDataLeft = `M ${xEnd},${yPos} L ${xEnd},${yPos + barHeight} A ${barWidth},${radius} 0 0 1 ${xEnd},${yPos} Z`;
                } else { // Bar is long enough for full radius
                    pathDataLeft = `M ${xEnd},${yPos} L ${xEnd},${yPos + barHeight} L ${xStart + radius},${yPos + barHeight} A ${radius},${radius} 0 0 1 ${xStart + radius},${yPos} Z`;
                }
            }
            
            if (pathDataLeft) {
                mainChartGroup.append("path")
                    .attr("class", "mark value bar left-bar")
                    .attr("d", pathDataLeft)
                    .attr("fill", colorScale(leftGroup));
            }

            const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            const annotationFontSize = Math.min(20, Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize)));

            mainChartGroup.append("text")
                .attr("class", "label value data-label")
                .attr("x", leftXScale(value) - 10)
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${annotationFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedValue);
        }
    });

    // Right Bars
    dimensions.forEach(dimension => {
        const dataPoint = chartDataArray.find(d =>
            d[dimensionFieldName] === dimension && d[groupFieldName] === rightGroup
        );

        if (dataPoint) {
            const value = +dataPoint[valueFieldName];
            const barWidth = rightXScale(value);
            const yPos = yScale(dimension);
            const barHeight = yScale.bandwidth();
            const radius = barHeight / 2;

            const barStartX = innerWidth / 2 + dimensionLabelWidth / 2; // Leftmost X of the bar (from center)
            const barEndX = barStartX + barWidth; // Rightmost X of the bar

            let pathDataRight = "";
            if (barWidth > 0) {
                if (barWidth < radius) { // Bar is shorter than its potential radius
                    pathDataRight = `M ${barStartX},${yPos} A ${barWidth},${radius} 0 0 1 ${barStartX},${yPos + barHeight} Z`;
                } else { // Bar is long enough for full radius
                    pathDataRight = `M ${barStartX},${yPos} H ${barEndX - radius} A ${radius},${radius} 0 0 1 ${barEndX - radius},${yPos + barHeight} H ${barStartX} Z`;
                }
            }

            if (pathDataRight) {
                mainChartGroup.append("path")
                    .attr("class", "mark value bar right-bar")
                    .attr("d", pathDataRight)
                    .attr("fill", colorScale(rightGroup));
            }

            const formattedValue = valueUnit ? `${formatValue(value)}${valueUnit}` : formatValue(value);
            const annotationFontSize = Math.min(20, Math.max(barHeight * 0.5, parseFloat(fillStyle.typography.annotationFontSize)));
            
            mainChartGroup.append("text")
                .attr("class", "label value data-label")
                .attr("x", barStartX + barWidth + 10)
                .attr("y", yPos + barHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .style("fill", fillStyle.textColor)
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", `${annotationFontSize}px`)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedValue);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (e.g., tooltips, simple hover effects if desired - original hover removed for simplicity)
    // Simple hover effect (optional, can be removed if too complex)
    mainChartGroup.selectAll(".bar")
        .on("mouseover", function() {
            d3.select(this).style("opacity", 0.8);
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
        });


    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Vertical Bar Chart",
  "chart_name": "vertical_bar_chart_15",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["none"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary", "text_color", "background_color"],
  "min_height": 600,
  "min_width": 800,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "visible",
  "yAxis": "visible",
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
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");

    const xFieldName = xCol ? xCol.name : undefined;
    const yFieldName = yCol ? yCol.name : undefined;

    if (!xFieldName || !yFieldName) {
        const missingFields = [];
        if (!xFieldName) missingFields.push("x field (role 'x')");
        if (!yFieldName) missingFields.push("y field (role 'y')");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    const xFieldUnit = xCol && xCol.unit !== "none" ? xCol.unit : ""; // Not directly used in output, but extracted
    const yFieldUnit = yCol && yCol.unit !== "none" ? yCol.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const defaultColors = {
        text_color: "#0f223b",
        background_color: "#FFFFFF",
        other: {
            primary: "#1f77b4",
            secondary: "#ff7f0e" 
        },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"] // d3.schemeCategory10
    };

    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) || defaultTypography.title.font_family,
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) || defaultTypography.title.font_size,
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) || defaultTypography.title.font_weight,
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) || defaultTypography.label.font_family,
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) || defaultTypography.label.font_size,
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypography.label.font_weight,
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypography.annotation.font_family,
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypography.annotation.font_size,
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypography.annotation.font_weight,
        },
        textColor: colorsInput.text_color || defaultColors.text_color,
        chartBackground: colorsInput.background_color || defaultColors.background_color,
        barPrimary: (colorsInput.other && colorsInput.other.primary) || defaultColors.other.primary,
        // Images are not used in this chart, but this shows how they would be handled:
        // iconPrimary: (imagesInput.other && imagesInput.other.primary) || null,
    };
    fillStyle.axisLineColor = fillStyle.textColor; // Default axis line color

    function estimateTextWidth(text, fontProps) {
        if (!text) return 0;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontProps.font_weight || 'normal'} ${fontProps.font_size || '12px'} ${fontProps.font_family || 'Arial, sans-serif'}`;
        return context.measureText(text).width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return ""; // Handle null or NaN gracefully
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~g")(value / 1000) + "K";
        }
        return d3.format("~g")(value);
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
    const chartMargins = { top: 30, right: 30, bottom: 80, left: 60 }; // Adjusted left margin for potentially longer y-axis labels
    if (variables.dynamic_margins) { // Example of a variable that might affect margins
        chartMargins.bottom = variables.dynamic_margins.bottom || chartMargins.bottom;
    }


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const processedData = chartDataInput.map(d => ({
        category: String(d[xFieldName]), // Ensure category is a string
        value: +d[yFieldName]    // Ensure value is a number
    }));

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(processedData.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) || 0]) // Ensure domain starts at 0, handle empty data
        .range([innerHeight, 0])
        .nice();

    const colorAccessor = (dataPoint) => {
        const categoryValue = dataPoint.category;
        if (colorsInput.field && colorsInput.field[xFieldName] && colorsInput.field[xFieldName][categoryValue]) {
            return colorsInput.field[xFieldName][categoryValue];
        }
        if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            const uniqueCategories = xScale.domain(); // Use domain from scale for consistent indexing
            const catIndex = uniqueCategories.indexOf(categoryValue);
            if (catIndex !== -1) {
                return colorsInput.available_colors[catIndex % colorsInput.available_colors.length];
            }
        }
        return fillStyle.barPrimary;
    };

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    let rotateXLabels = false;
    const xAxisLabelFontProps = {
        font_family: fillStyle.typography.labelFontFamily,
        font_size: fillStyle.typography.labelFontSize,
        font_weight: fillStyle.typography.labelFontWeight
    };

    if (xScale.domain().length > 0 && xScale.bandwidth() > 0) {
        const maxXLabelWidthAllowed = xScale.bandwidth();
        for (const category of xScale.domain()) {
            const text = String(category);
            const estimatedWidth = estimateTextWidth(text, xAxisLabelFontProps);
            if (estimatedWidth > maxXLabelWidthAllowed) {
                rotateXLabels = true;
                break;
            }
        }
    }
    
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(xAxis);

    xAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .style("text-anchor", rotateXLabels ? "end" : "middle")
        .attr("dx", rotateXLabels ? "-0.8em" : "0em")
        .attr("dy", rotateXLabels ? "0.15em" : "0.71em") // Adjust dy for normal and rotated
        .attr("transform", rotateXLabels ? "rotate(-45)" : "rotate(0)");
    
    xAxisGroup.select(".domain").style("stroke", fillStyle.axisLineColor);


    const yAxis = d3.axisLeft(yScale)
        .ticks(Math.max(2, Math.min(10, Math.floor(innerHeight / 40)))) // Dynamic ticks based on height
        .tickFormat(d => formatValue(d) + (yFieldUnit ? ` ${yFieldUnit}` : ''))
        .tickSize(0)
        .tickPadding(10);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(yAxis);

    yAxisGroup.selectAll("text")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor);

    yAxisGroup.select(".domain").remove(); // Remove Y-axis line as per original styling

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const barElements = mainChartGroup.selectAll(".bar")
        .data(processedData)
        .enter()
        .append("rect")
        .attr("class", "mark bar")
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(Math.max(0, d.value))) // Ensure y is not above baseline for 0 or negative values
        .attr("width", xScale.bandwidth())
        .attr("height", d => Math.abs(yScale(0) - yScale(d.value))) // Ensure height is positive
        .attr("fill", d => colorAccessor(d));

    const dataLabelElements = mainChartGroup.selectAll(".data-label")
        .data(processedData)
        .enter()
        .append("text")
        .attr("class", "label data-label")
        .attr("x", d => xScale(d.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.value) - 5) // Position above the bar
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => {
            const formatted = formatValue(d.value);
            return formatted + (yFieldUnit && formatted ? ` ${yFieldUnit}` : '');
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
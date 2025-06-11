/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_plain_chart_06",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "right",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
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
    const colorsInput = data.colors || (data.colors_dark || {});
    const imagesInput = data.images || {}; // Though not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Category field name).</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (Value field name).</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const categoryFieldUnit = categoryFieldDef.unit !== "none" ? categoryFieldDef.unit : "";
    const valueFieldUnit = valueFieldDef.unit !== "none" ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        barPrimary: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : "#E74C3C",
        textColor: colorsInput.text_color || "#333333",
        valueLabelColorInside: "#FFFFFF", // Contrast for labels inside bars
        chartBackground: colorsInput.background_color || "#FFFFFF", // Not directly used on SVG, but good to have
    };
    fillStyle.valueLabelColorOutside = fillStyle.textColor; // Default to general text color

    fillStyle.typography = {
        titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
        titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
        titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
        labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
        labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
        labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
        annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
        annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
        annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.setAttribute('width', '0');
        tempSvg.setAttribute('height', '0');
        // Note: Appending to body and then removing is more reliable for getBBox across browsers
        // but per spec, should not be appended to DOM. For most modern browsers, in-memory works.
        // If issues arise, a temporary append/remove to document.body might be needed.
        // document.body.appendChild(tempSvg); 

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.fontFamily);
        tempText.setAttribute('font-size', fontProps.fontSize);
        tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Could not measure text width for:", text, e);
            width = text ? text.length * (parseFloat(fontProps.fontSize) || 12) * 0.6 : 0; // Fallback
        }
        
        // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        return width;
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) {
            return d3.format("~.2s")(value).replace('G', 'B'); // More standard for Billions
        } else if (Math.abs(value) >= 1000000) {
            return d3.format("~.2s")(value);
        } else if (Math.abs(value) >= 1000) {
            return d3.format("~.2s")(value);
        }
        return d3.format("~g")(value);
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const baseHeight = variables.height || 600;
    
    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", baseHeight) // Initial height, may be adjusted
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartDataArray = [...chartDataInput].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const categories = chartDataArray.map(d => d[categoryFieldName]);

    const adjustedHeight = categories.length > 15 
        ? baseHeight * (1 + (categories.length - 15) * 0.03) 
        : baseHeight;
    
    svgRoot.attr("height", adjustedHeight); // Update height if adjusted

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const formattedVal = `${formatValue(d[valueFieldName])}${valueFieldUnit}`;
        const width = estimateTextWidth(formattedVal, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        if (width > maxValueLabelWidth) {
            maxValueLabelWidth = width;
        }
    });
    
    const chartMargins = {
        top: 30, // Reduced top margin as no main title
        right: 20, 
        bottom: 30,
        left: 10 + maxValueLabelWidth + 10 // Space for value labels if outside bar + padding
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = adjustedHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    // Sorting already done for 'categories' and 'chartDataArray'

    const minValue = d3.min(chartDataArray, d => +d[valueFieldName]);
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const hasNegativeValues = minValue < 0;

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(0.25); // Standardized padding

    const xScale = d3.scaleLinear()
        .domain([
            hasNegativeValues ? Math.min(minValue * 1.1, 0) : 0, 
            Math.max(maxValue * 1.1, 0)
        ])
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes or gridlines for this specific chart style.
    // No legend.

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barGroups.append("rect")
        .attr("class", "mark bar")
        .attr("x", d => {
            const value = +d[valueFieldName];
            const barW = Math.abs(xScale(value) - xScale(0));
            return value >= 0 ? innerWidth - barW : innerWidth - barW; // Right alignment logic
        })
        .attr("y", 0)
        .attr("width", d => Math.abs(xScale(+d[valueFieldName]) - xScale(0)))
        .attr("height", yScale.bandwidth())
        .attr("fill", fillStyle.barPrimary);

    // Value Labels
    barGroups.append("text")
        .attr("class", "value data-label")
        .each(function(d) {
            const value = +d[valueFieldName];
            const barWidth = Math.abs(xScale(value) - xScale(0));
            const formattedText = `${formatValue(value)}${valueFieldUnit}`;
            
            const textWidth = estimateTextWidth(formattedText, {
                fontFamily: fillStyle.typography.annotationFontFamily,
                fontSize: fillStyle.typography.annotationFontSize,
                fontWeight: fillStyle.typography.annotationFontWeight
            });

            const labelFitsInside = textWidth + 10 < barWidth; // 10px padding

            d3.select(this)
                .attr("y", yScale.bandwidth() / 2)
                .attr("dy", "0.35em")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .text(formattedText);

            if (labelFitsInside) {
                d3.select(this)
                    .attr("x", (value >= 0 ? innerWidth - barWidth : innerWidth - barWidth) + 5) // Inside, left
                    .attr("text-anchor", "start")
                    .style("fill", fillStyle.valueLabelColorInside);
            } else {
                 d3.select(this)
                    .attr("x", (value >= 0 ? innerWidth - barWidth : innerWidth - barWidth) - 5) // Outside, left
                    .attr("text-anchor", "end")
                    .style("fill", fillStyle.valueLabelColorOutside);
            }
        });

    // Category Labels
    barGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", innerWidth) // Right aligned with the chart edge
        .attr("y", -yScale.bandwidth() / 6) // Positioned above the bar slightly
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => `${d[categoryFieldName]}${categoryFieldUnit}`);

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
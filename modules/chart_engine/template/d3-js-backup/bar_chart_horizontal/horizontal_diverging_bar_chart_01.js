/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], ["-inf", "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary", "secondary"],
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
  "valueSortDirection": "ascending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {}; 
    const images = data.images || {}; // Not used in this chart type but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!dimensionFieldDef || !dimensionFieldDef.name) {
        console.error("Critical chart config missing: Dimension field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Dimension field (role 'x') configuration is missing.</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Value field (role 'y') configuration is missing.</div>");
        return null;
    }

    const categoryFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '12px',
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'normal',
            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '10px',
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        positiveBarColor: (colors.other && colors.other.primary) || (colors.available_colors && colors.available_colors[0]) || '#4682B4', // Default positive color
        negativeBarColor: (colors.other && colors.other.secondary) || (colors.available_colors && colors.available_colors.length > 1 && colors.available_colors[1]) || '#FF6347', // Default negative color
        textColor: colors.text_color || '#333333',
        axisLineColor: colors.text_color || '#333333', 
        chartBackground: colors.background_color || '#FFFFFF',
    };

    function estimateTextWidth(text, fontProps) {
        const tempSvgForEstimation = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // Style to ensure it's not visible and doesn't affect layout if accidentally rendered (though it won't be)
        tempSvgForEstimation.style.position = 'absolute';
        tempSvgForEstimation.style.visibility = 'hidden';
        tempSvgForEstimation.style.width = '0px';
        tempSvgForEstimation.style.height = '0px';

        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        if (fontProps.fontFamily) tempTextElement.setAttribute('font-family', fontProps.fontFamily);
        if (fontProps.fontSize) tempTextElement.setAttribute('font-size', fontProps.fontSize);
        if (fontProps.fontWeight) tempTextElement.setAttribute('font-weight', fontProps.fontWeight);
        tempTextElement.textContent = text || "";
        
        tempSvgForEstimation.appendChild(tempTextElement);
        // Per strict instructions, not appending to DOM. getBBox on unattached elements can be unreliable.
        let width = 0;
        try {
             // Forcing a reflow MIGHT help in some engines, but it's hacky and not guaranteed.
             // tempTextElement.getComputedTextLength(); // Try this first
            width = tempTextElement.getBBox().width;
            if (width === 0 && (text || "").length > 0) {
                 // If getBBox returns 0 for non-empty string, it's likely unreliable.
                 // Fallback to a crude estimation.
                 const avgCharWidth = parseFloat(fontProps.fontSize) * 0.6; // Very rough estimate
                 width = (text || "").length * avgCharWidth;
            }
        } catch (e) {
            console.warn("Could not measure text width using detached SVG for: " + text, e);
            const avgCharWidth = parseFloat(fontProps.fontSize) * 0.6; 
            width = (text || "").length * avgCharWidth;
        }
        return width;
    }
    
    const valueUnitSuffix = valueFieldDef.unit && valueFieldDef.unit.toLowerCase() !== "none" ? valueFieldDef.unit : "";
    const formatValue = (valInput) => {
        const value = Number(valInput);
        if (isNaN(value)) return String(valInput); // Return original if not a number

        let numPart;
        if (Math.abs(value) >= 1000000000) {
            numPart = d3.format("~g")(value / 1000000000) + "B";
        } else if (Math.abs(value) >= 1000000) {
            numPart = d3.format("~g")(value / 1000000) + "M";
        } else if (Math.abs(value) >= 1000) {
            numPart = d3.format("~g")(value / 1000) + "K";
        } else {
            numPart = d3.format("~g")(value);
        }
        return valueUnitSuffix ? numPart + " " + valueUnitSuffix : numPart;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root") // Standardized class
        .style("background-color", fillStyle.chartBackground)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxDimensionLabelWidth = 0;
    chartDataInput.forEach(d => {
        const text = d[categoryFieldName] || "";
        maxDimensionLabelWidth = Math.max(maxDimensionLabelWidth, estimateTextWidth(text, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
    });

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const value = d[valueFieldName];
        const formattedText = formatValue(value); // Use the chart's formatter
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(formattedText, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }));
    });
    
    const labelPadding = 5; 
    const valuePadding = 5; 

    const chartMargins = {
        top: 20, // Minimal top/bottom margin
        right: maxValueLabelWidth + valuePadding,
        bottom: 20,
        left: maxValueLabelWidth + valuePadding
    };

    // Ensure innerWidth and innerHeight are not negative
    const innerWidth = Math.max(0, containerWidth - chartMargins.left - chartMargins.right);
    const innerHeight = Math.max(0, containerHeight - chartMargins.top - chartMargins.bottom);

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); 
    chartDataArray.sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const sortedDimensions = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(0.25); 

    const minVal = d3.min(chartDataArray, d => d[valueFieldName]) || 0;
    const maxVal = d3.max(chartDataArray, d => d[valueFieldName]) || 0;
    const maxAbsValue = Math.max(Math.abs(minVal), Math.abs(maxVal));

    const xScale = d3.scaleLinear()
        .domain(maxAbsValue === 0 ? [-1, 1] : [-maxAbsValue, maxAbsValue]) // Handle all zero data case for domain
        .range([0, innerWidth])
        .nice(); 

    const centerLineX = xScale(0);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    if (innerWidth > 0 && innerHeight > 0) { // Only render if space is available
        mainChartGroup.append("line")
            .attr("class", "axis center-axis")
            .attr("x1", centerLineX)
            .attr("y1", 0)
            .attr("x2", centerLineX)
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1)
            .style("opacity", 0.7);

        // Block 8: Main Data Visualization Rendering
        const barGroups = mainChartGroup.selectAll(".bar-group")
            .data(chartDataArray)
            .enter()
            .append("g")
            .attr("class", "bar-group") // Class for the group of elements per data point
            .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName]) || 0})`); // Fallback for yScale if category not found

        barGroups.append("rect")
            .attr("class", "mark bar")
            .attr("y", 0)
            .attr("height", yScale.bandwidth())
            .attr("x", d => (d[valueFieldName] >= 0 ? centerLineX : xScale(d[valueFieldName])))
            .attr("width", d => Math.abs(xScale(d[valueFieldName]) - centerLineX))
            .attr("fill", d => (d[valueFieldName] >= 0 ? fillStyle.positiveBarColor : fillStyle.negativeBarColor));

        // Dimension Labels
        barGroups.append("text")
            .attr("class", "label dimension-label")
            .attr("y", yScale.bandwidth() / 2)
            .attr("dy", "0.35em") // Vertical centering
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(d => d[categoryFieldName])
            .attr("x", d => (d[valueFieldName] >= 0 ? centerLineX - labelPadding : centerLineX + labelPadding))
            .attr("text-anchor", d => (d[valueFieldName] >= 0 ? "end" : "start"));
        
        // Value Labels
        barGroups.append("text")
            .attr("class", "value data-label")
            .attr("y", yScale.bandwidth() / 2)
            .attr("dy", "0.35em") // Vertical centering
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .attr("fill", fillStyle.textColor)
            .text(d => formatValue(d[valueFieldName]))
            .attr("x", d => {
                const barEnd = xScale(d[valueFieldName]);
                return d[valueFieldName] >= 0 ? barEnd + valuePadding : barEnd - valuePadding;
            })
            .attr("text-anchor", d => (d[valueFieldName] >= 0 ? "start" : "end"));
    } else {
        mainChartGroup.append("text")
            .attr("class", "text error-text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .text("Insufficient space to render chart.")
            .style("fill", fillStyle.textColor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize);
    }


    // Block 9: Optional Enhancements & Post-Processing
    // None for this chart after simplification.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Diverging Bar Chart",
  "chart_name": "diverging_bar_plain_chart_01",
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

  "elementAlignment": "none",
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
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || {};
    // const images = data.images || {}; // Parsed but not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldDef = dataColumns.find(col => col.role === "x");
    const yFieldDef = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldDef ? xFieldDef.name : undefined;
    const valueFieldName = yFieldDef ? yFieldDef.name : undefined;
    const valueFieldUnit = yFieldDef && yFieldDef.unit && yFieldDef.unit !== "none" ? yFieldDef.unit : "";

    if (!categoryFieldName || !valueFieldName) {
        console.error("Critical chart config missing: categoryField or valueField name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (field names for x or y role).</div>");
        return null;
    }
    
    if (!Array.isArray(chartDataInput) || chartDataInput.length === 0) {
        console.error("Chart data is empty or not an array. Cannot render.");
        d3.select(containerSelector).html("<div style='color:orange; padding:10px;'>Notice: No data provided to render the chart.</div>");
        return null;
    }


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
        colors: {
            positiveBar: (colors.other && colors.other.primary) ? colors.other.primary : (colors.available_colors && colors.available_colors.length > 0 ? colors.available_colors[0] : '#4682B4'),
            negativeBar: (colors.other && colors.other.secondary) ? colors.other.secondary : (colors.available_colors && colors.available_colors.length > 1 ? colors.available_colors[1] : '#CD5C5C'), // Default changed for better contrast
            textColor: colors.text_color || '#333333',
            axisLine: colors.text_color || '#888888', 
            chartBackground: colors.background_color || 'transparent', // Default to transparent background
        }
    };

    function estimateTextWidth(text, styleConfig) {
        const tempTextNode = d3.create("svg:text")
            .style("font-family", styleConfig.fontFamily)
            .style("font-size", styleConfig.fontSize)
            .style("font-weight", styleConfig.fontWeight)
            .text(text)
            .node();
        
        let width = 0;
        try {
            width = tempTextNode.getComputedTextLength();
            if (width === 0 && text && String(text).length > 0) {
                width = String(text).length * (parseFloat(styleConfig.fontSize) * 0.6); // Basic fallback
            }
        } catch (e) {
            width = String(text).length * (parseFloat(styleConfig.fontSize) * 0.6); // Basic fallback
        }
        return width;
    }
    
    const formatValue = (value) => {
        let num = Number(value);
        if (isNaN(num)) return String(value); 

        const absNum = Math.abs(num);

        if (absNum >= 1000000000) {
            return d3.format("~g")(num / 1000000000) + "B";
        } else if (absNum >= 1000000) {
            return d3.format("~g")(num / 1000000) + "M";
        } else if (absNum >= 1000) {
            return d3.format("~g")(num / 1000) + "K";
        }
        return d3.format("~g")(num);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.colors.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxCategoryLabelWidth = 0;
    chartDataInput.forEach(d => {
        const text = String(d[categoryFieldName] === null || typeof d[categoryFieldName] === 'undefined' ? "" : d[categoryFieldName]);
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(text, {
            fontFamily: fillStyle.typography.labelFontFamily,
            fontSize: fillStyle.typography.labelFontSize,
            fontWeight: fillStyle.typography.labelFontWeight
        }));
    });

    let maxValueLabelWidth = 0;
    chartDataInput.forEach(d => {
        const value = d[valueFieldName];
        const formattedText = (value >= 0 ? "+" : "") + formatValue(value) + valueFieldUnit;
        maxValueLabelWidth = Math.max(maxValueLabelWidth, estimateTextWidth(formattedText, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        }));
    });
    
    const categoryLabelPadding = 8; // Increased padding slightly
    const valueLabelPadding = 5;
    const barPaddingCoefficient = 0.25;

    const chartMargins = {
        top: 20, 
        right: maxValueLabelWidth + valueLabelPadding,
        bottom: 20, 
        left: maxValueLabelWidth + valueLabelPadding 
    };
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= maxCategoryLabelWidth + 2 * categoryLabelPadding || innerHeight <= 0) { // Check if space for category labels too
        // console.error("Calculated innerWidth or innerHeight is too small for content. Cannot render chart effectively.");
        svgRoot.append("text").text("Chart dimensions too small for content.")
            .attr("x", 10).attr("y", 20).attr("fill", "red")
            .attr("class", "text error-message");
        return svgRoot.node();
    }
    
    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); 
    chartDataArray.forEach(d => { // Ensure value field is numeric
        d[valueFieldName] = parseFloat(d[valueFieldName]);
    });
    chartDataArray.sort((a, b) => a[valueFieldName] - b[valueFieldName]);
    const sortedCategories = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(barPaddingCoefficient);

    const minValue = d3.min(chartDataArray, d => d[valueFieldName]);
    const maxValue = d3.max(chartDataArray, d => d[valueFieldName]);
    
    const xScale = d3.scaleLinear()
        .domain([Math.min(0, minValue), Math.max(0, maxValue)])
        .range([0, innerWidth])
        .nice(); 

    const centerLineX = xScale(0);

    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added 'other' as a general group class

    mainChartGroup.append("line")
        .attr("class", "axis center-axis-line")
        .attr("x1", centerLineX)
        .attr("y1", 0)
        .attr("x2", centerLineX)
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.colors.axisLine)
        .attr("stroke-width", 1)
        .style("opacity", 0.7);

    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray)
        .enter()
        .append("g")
        .attr("class", "bar-group other") // Added 'other'
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barGroups.append("rect")
        .attr("class", d => d[valueFieldName] >= 0 ? "mark positive-bar" : "mark negative-bar")
        .attr("y", 0)
        .attr("height", yScale.bandwidth())
        .attr("x", d => (d[valueFieldName] >= 0 ? centerLineX : xScale(d[valueFieldName])))
        .attr("width", d => Math.abs(xScale(d[valueFieldName]) - centerLineX)) // Use Math.abs for safety
        .attr("fill", d => (d[valueFieldName] >= 0 ? fillStyle.colors.positiveBar : fillStyle.colors.negativeBar));

    // Category Labels (Dimension Labels)
    barGroups.append("text")
        .attr("class", "label category-label")
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("x", d => (d[valueFieldName] >= 0 ? centerLineX - categoryLabelPadding : centerLineX + categoryLabelPadding))
        .attr("text-anchor", d => (d[valueFieldName] >= 0 ? "end" : "start"))
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => d[categoryFieldName]);

    // Value Labels (Annotation Labels)
    barGroups.append("text")
        .attr("class", "value data-value-label") // Changed class to 'value'
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("x", d => (d[valueFieldName] >= 0 ? xScale(d[valueFieldName]) + valueLabelPadding : xScale(d[valueFieldName]) - valueLabelPadding))
        .attr("text-anchor", d => (d[valueFieldName] >= 0 ? "start" : "end"))
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(d => {
            const val = d[valueFieldName];
            return (val >= 0 ? "+" : "") + formatValue(val) + valueFieldUnit;
        });
        
    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_clean",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 300,
  "min_width": 300,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is external)

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; 
    // const imagesInput = data.images || {}; // Parsed but not used in this chart type

    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name) {
        console.error("Critical chart config missing: Category field (role 'x') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (Category field name).</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; text-align:center; padding: 20px;'>Error: Critical chart configuration missing (Value field name).</div>");
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const categoryFieldUnit = (categoryFieldDef.unit && categoryFieldDef.unit !== "none") ? categoryFieldDef.unit : "";
    const valueFieldUnit = (valueFieldDef.unit && valueFieldDef.unit !== "none") ? valueFieldDef.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        barPrimaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#0099ff',
        textColor: colorsInput.text_color || '#333333',
        chartBackground: colorsInput.background_color || '#FFFFFF',
    };

    function estimateTextWidth(text, fontProps) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px';
        tempSvg.style.height = '0px';

        const tempText = document.createElementNS(svgNS, 'text');
        if (fontProps.fontFamily) tempText.setAttribute('font-family', fontProps.fontFamily);
        if (fontProps.fontSize) tempText.setAttribute('font-size', fontProps.fontSize);
        if (fontProps.fontWeight) tempText.setAttribute('font-weight', fontProps.fontWeight);
        tempText.textContent = text;
        
        tempSvg.appendChild(tempText);
        document.body.appendChild(tempSvg);
        
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("Could not get BBox for text estimation", e);
            width = (text ? text.length : 0) * (parseFloat(fontProps.fontSize) || 10) * 0.6; // Rough fallback
        }
        
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => { // Preserving original formatting logic for B/M/K
        if (value >= 1000000000) {
            return d3.format("~g")(value / 1000000000) + "B";
        } else if (value >= 1000000) {
            return d3.format("~g")(value / 1000000) + "M";
        } else if (value >= 1000) {
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
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let maxValueLabelWidth = 0;
    if (chartDataInput.length > 0) {
        // Find a representative long value for width estimation
        const sampleDataPoint = chartDataInput.reduce((maxObj, currentObj) => 
            (+currentObj[valueFieldName] > +maxObj[valueFieldName] ? currentObj : maxObj), chartDataInput[0]
        );
        const sampleValue = +sampleDataPoint[valueFieldName];
        const formattedSampleValue = valueFieldUnit ? `${formatValue(sampleValue)}${valueFieldUnit}` : `${formatValue(sampleValue)}`;
        maxValueLabelWidth = estimateTextWidth(formattedSampleValue, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: fillStyle.typography.annotationFontSize,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
    }
    
    const chartMargins = {
        top: 20,
        right: Math.max(20, maxValueLabelWidth + 15), // Space for value label + padding
        bottom: parseFloat(fillStyle.typography.labelFontSize.replace('px','')) + 20, // Space for category label below last bar + padding
        left: 20
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated inner dimensions are not positive. Cannot render chart.");
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("fill", fillStyle.textColor)
            .text("Chart dimensions too small to render.");
        return svgRoot.node();
    }
    
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const chartDataArray = [...chartDataInput].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    const sortedCategories = chartDataArray.map(d => d[categoryFieldName]);

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedCategories)
        .range([0, innerHeight])
        .padding(0.4); 

    const xMax = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (xMax > 0 ? xMax : (chartDataArray.length > 0 ? xMax : 1)) * 1.05]) // Ensure valid domain, 5% buffer
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // Not applicable for this chart style.

    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(chartDataArray, d => d[categoryFieldName]) // Key function for object constancy
        .enter()
        .append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(0, ${yScale(d[categoryFieldName])})`);

    barGroups.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => Math.max(0, xScale(+d[valueFieldName]))) // Ensure width is not negative
        .attr("height", yScale.bandwidth())
        .attr("fill", fillStyle.barPrimaryColor);

    const labelVerticalOffset = yScale.bandwidth() + 5; // 5px below the bar

    barGroups.append("text")
        .attr("class", "label category-label")
        .attr("x", 0) 
        .attr("y", labelVerticalOffset)
        .attr("dy", "0.71em") 
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => categoryFieldUnit ? `${d[categoryFieldName]}${categoryFieldUnit}` : d[categoryFieldName]);

    barGroups.append("text")
        .attr("class", "value data-label")
        .attr("x", d => Math.max(0, xScale(+d[valueFieldName])) + 5) // 5px to the right of the bar
        .attr("y", yScale.bandwidth() / 2)
        .attr("dy", "0.35em") 
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .text(d => valueFieldUnit ? `${formatValue(+d[valueFieldName])}${valueFieldUnit}` : formatValue(+d[valueFieldName]));
        
    // Block 9: Optional Enhancements & Post-Processing
    // No specific enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
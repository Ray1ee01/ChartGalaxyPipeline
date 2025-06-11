/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Composite Bar and Area Chart",
  "chart_name": "horizontal_bar_chart_27",
  "is_composite": true,
  "required_fields": ["x", "y", "y2"],
  "hierarchy": ["x"],
  "required_fields_type": [["categorical"],["numerical"],["numerical"]],
  "required_fields_range": [[2, 30], [0, "inf"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary","secondary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
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
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // or data.colors_dark for dark themes if specified
    const images = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionField = dataColumns.find(col => col.role === "x")?.name;
    const valueField1 = dataColumns.find(col => col.role === "y")?.name;
    const valueField2 = dataColumns.find(col => col.role === "y2")?.name;

    if (!dimensionField || !valueField1 || !valueField2) {
        const missingFields = [
            !dimensionField ? "x role field" : null,
            !valueField1 ? "y role field" : null,
            !valueField2 ? "y2 role field" : null
        ].filter(Boolean).join(", ");
        
        console.error(`Critical chart config missing: [${missingFields}]. Cannot render.`);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>Error: Critical chart configuration missing (${missingFields}). Cannot render chart.</div>`);
        }
        return null;
    }

    const valueUnit1 = (dataColumns.find(col => col.role === "y")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y")?.unit) || "";
    const valueUnit2 = (dataColumns.find(col => col.role === "y2")?.unit === "none" ? "" : dataColumns.find(col => col.role === "y2")?.unit) || "";
    
    const columnTitle1 = dataColumns.find(col => col.role === "y")?.label || valueField1;
    const columnTitle2 = dataColumns.find(col => col.role === "y2")?.label || valueField2;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) || 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) || '16px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) || 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
        },
        textColor: rawColors.text_color || '#0f223b',
        chartBackground: rawColors.background_color || '#FFFFFF',
        primaryColor: (rawColors.other && rawColors.other.primary) || '#1f77b4',
        secondaryColor: (rawColors.other && rawColors.other.secondary) || '#ff7f0e',
        getBarColor: (dimensionValue) => {
            if (rawColors.field && rawColors.field[dimensionValue]) {
                return rawColors.field[dimensionValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                // Simple hash function to pick a color, or use index if categories are known
                let hash = 0;
                for (let i = 0; i < dimensionValue.length; i++) {
                    hash = dimensionValue.charCodeAt(i) + ((hash << 5) - hash);
                }
                return rawColors.available_colors[Math.abs(hash) % rawColors.available_colors.length];
            }
            return fillStyle.secondaryColor; // Fallback
        },
        getStrokeColor: (dimensionValue) => {
            const baseColor = fillStyle.getBarColor(dimensionValue);
            return d3.rgb(baseColor).brighter(1).toString(); // Make slightly brighter for stroke
        }
    };

    function estimateTextWidth(text, fontConfig) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.position = 'absolute';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontConfig.fontFamily || fillStyle.typography.labelFontFamily);
        tempText.setAttribute('font-size', fontConfig.fontSize || fillStyle.typography.labelFontSize);
        tempText.setAttribute('font-weight', fontConfig.fontWeight || fillStyle.typography.labelFontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Appending to body to ensure getBBox works, then removing immediately.
        // This is a common workaround for getBBox in detached elements.
        document.body.appendChild(tempSvg);
        const width = tempText.getBBox().width;
        document.body.removeChild(tempSvg);
        return width;
    }
    
    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (value >= 1000000) return d3.format("~.2s")(value);
        if (value >= 1000) return d3.format("~.2s")(value);
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
        .style("background-color", fillStyle.chartBackground)
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 60, // Space for column titles
        right: 20,
        bottom: 30,
        left: 10 // Initial, will be adjusted
    };
    
    const textPadding = 5;
    const minFontSize = 10;
    const defaultDimLabelFontSize = parseFloat(fillStyle.typography.labelFontSize);

    let maxDimLabelWidth = 0;
    if (chartData.length > 0) {
        chartData.forEach(d => {
            const labelText = String(d[dimensionField]).toUpperCase();
            const width = estimateTextWidth(labelText, { 
                fontFamily: fillStyle.typography.labelFontFamily, 
                fontSize: `${defaultDimLabelFontSize}px`, 
                fontWeight: fillStyle.typography.labelFontWeight 
            });
            if (width > maxDimLabelWidth) maxDimLabelWidth = width;
        });
    }
    
    const maxAllowedLabelSpace = containerWidth * 0.25;
    let finalDimLabelFontSize = defaultDimLabelFontSize;

    if (maxDimLabelWidth > maxAllowedLabelSpace) {
        const scaleFactor = maxAllowedLabelSpace / maxDimLabelWidth;
        finalDimLabelFontSize = Math.max(minFontSize, defaultDimLabelFontSize * scaleFactor);
        
        maxDimLabelWidth = 0; // Recalculate with new font size
        chartData.forEach(d => {
            const labelText = String(d[dimensionField]).toUpperCase();
            const width = estimateTextWidth(labelText, { 
                fontFamily: fillStyle.typography.labelFontFamily, 
                fontSize: `${finalDimLabelFontSize}px`, 
                fontWeight: fillStyle.typography.labelFontWeight 
            });
            if (width > maxDimLabelWidth) maxDimLabelWidth = width;
        });
    }
    
    chartMargins.left = maxDimLabelWidth + textPadding + 10; // Add some buffer

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const squareAreaRatio = 0.25; 
    const barAreaRatio = 1 - squareAreaRatio;
    const squareAreaWidth = innerWidth * squareAreaRatio;
    const barAreaWidth = innerWidth * barAreaRatio;

    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => d3.descending(+a[valueField1], +b[valueField1]));
    const sortedDimensions = sortedData.map(d => d[dimensionField]);

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.2;
    const yScale = d3.scaleBand()
        .domain(sortedDimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const barHeight = yScale.bandwidth();
    const valueLabelBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
    const barValueLabelFontSize = Math.min(20, Math.max(barHeight * 0.5, valueLabelBaseFontSize));

    let maxValue1LabelWidth = 0;
    sortedData.forEach(d => {
        const text = `${formatValue(+d[valueField1])}${valueUnit1}`;
        const width = estimateTextWidth(text, {
            fontFamily: fillStyle.typography.annotationFontFamily,
            fontSize: `${barValueLabelFontSize}px`,
            fontWeight: fillStyle.typography.annotationFontWeight
        });
        if (width > maxValue1LabelWidth) maxValue1LabelWidth = width;
    });
    
    const availableBarWidth = Math.max(0, barAreaWidth - maxValue1LabelWidth - textPadding);
    
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueField1]) || 1]) // Ensure domain is at least 1 to avoid issues with empty data
        .range([0, availableBarWidth]);

    const maxValue2 = d3.max(sortedData, d => +d[valueField2]) || 1;
    const minSide = barHeight * 0.1;
    const maxSide = Math.min(barHeight * 1.8, squareAreaWidth * 0.8); // Ensure square fits in its area
    
    const sideScale = d3.scaleSqrt()
        .domain([0, maxValue2])
        .range([minSide, maxSide]);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Column Title for Bar Area
    mainChartGroup.append("text")
        .attr("x", squareAreaWidth + barAreaWidth) 
        .attr("y", -15) // Position above the chart content
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label text column-title")
        .text(columnTitle1);

    // Column Title for Square Area
    mainChartGroup.append("text")
        .attr("x", squareAreaWidth / 2)
        .attr("y", -15) // Position above the chart content
        .attr("text-anchor", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label text column-title")
        .text(columnTitle2);

    // Block 8: Main Data Visualization Rendering
    const itemGroups = mainChartGroup.selectAll(".item-group")
        .data(sortedData, d => d[dimensionField])
        .enter()
        .append("g")
        .attr("class", "item-group")
        .attr("transform", d => `translate(0, ${yScale(d[dimensionField])})`);

    // Dimension Labels
    itemGroups.append("text")
        .attr("x", -textPadding)
        .attr("y", barHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", `${finalDimLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "label dimension-label")
        .text(d => String(d[dimensionField]).toUpperCase());

    // Squares (for valueField2)
    const squareGroup = itemGroups.append("g").attr("class", "square-group");

    squareGroup.append("rect")
        .attr("x", d => (squareAreaWidth / 2) - (sideScale(+d[valueField2]) / 2))
        .attr("y", d => (barHeight / 2) - (sideScale(+d[valueField2]) / 2))
        .attr("width", d => sideScale(+d[valueField2]))
        .attr("height", d => sideScale(+d[valueField2]))
        .attr("fill", fillStyle.primaryColor)
        .attr("opacity", 0.8)
        .attr("stroke", d3.rgb(fillStyle.primaryColor).darker(0.5))
        .attr("stroke-width", 1)
        .attr("class", "mark square-mark");

    // Square Value Labels
    squareGroup.each(function(d) {
        const group = d3.select(this);
        const currentSquareSide = sideScale(+d[valueField2]);
        const formattedValue = `${formatValue(+d[valueField2])}${valueUnit2}`;
        
        const squareLabelFontSize = Math.min(
            parseFloat(fillStyle.typography.annotationFontSize) * 1.6, // Max size
            Math.max(parseFloat(fillStyle.typography.annotationFontSize) * 0.8, Math.min(barHeight * 0.5, currentSquareSide * 0.6))
        );

        let labelFill, labelX, labelY, labelAnchor, labelDy;
        const labelPositionThreshold = barHeight * 0.3;

        if (currentSquareSide >= labelPositionThreshold && estimateTextWidth(formattedValue, {fontSize: `${squareLabelFontSize}px`}) < currentSquareSide * 0.9) {
            labelFill = d3.hsl(fillStyle.primaryColor).l > 0.5 ? '#000000' : '#FFFFFF'; // Contrast
            labelX = squareAreaWidth / 2;
            labelY = barHeight / 2;
            labelAnchor = "middle";
            labelDy = "0.35em";
        } else {
            labelFill = fillStyle.textColor;
            labelX = squareAreaWidth / 2;
            labelY = (barHeight / 2) - (currentSquareSide / 2) - textPadding; // Above square
            labelAnchor = "middle";
            labelDy = "0em"; 
        }
        
        group.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dy", labelDy)
            .attr("text-anchor", labelAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${squareLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", labelFill)
            .attr("class", "value text square-value-label")
            .text(formattedValue);
    });
    
    // Bars (for valueField1)
    const barGroup = itemGroups.append("g").attr("class", "bar-group");

    barGroup.append("rect")
        .attr("x", d => squareAreaWidth + barAreaWidth - xScale(+d[valueField1]))
        .attr("y", 0)
        .attr("width", d => Math.max(0, xScale(+d[valueField1])))
        .attr("height", barHeight)
        .attr("fill", d => fillStyle.getBarColor(d[dimensionField]))
        .attr("stroke", d => fillStyle.getStrokeColor(d[dimensionField]))
        .attr("stroke-width", 1)
        // .attr("rx", barHeight / 8) // Removed for V.2 (no complex effects)
        // .attr("ry", barHeight / 8) // Removed for V.2
        .attr("opacity", 0.9)
        .attr("class", "mark bar-mark");

    // Bar Value Labels
    barGroup.append("text")
        .attr("x", d => squareAreaWidth + barAreaWidth - xScale(+d[valueField1]) - textPadding)
        .attr("y", barHeight / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .style("font-family", fillStyle.typography.annotationFontFamily)
        .style("font-size", `${barValueLabelFontSize}px`)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .attr("class", "value text bar-value-label")
        .text(d => `${formatValue(+d[valueField1])}${valueUnit1}`);

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_29",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
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
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || data.colors_dark || {}; // Prefer data.colors, then data.colors_dark
    const imagesInput = data.images || {};
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!dimensionFieldDef || !dimensionFieldDef.name) {
        console.error("Critical chart config missing: Dimension field (role 'x') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Dimension field 'x').</div>");
        return null;
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Value field (role 'y') name not found in dataColumns. Cannot render.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Critical chart configuration missing (Value field 'y').</div>");
        return null;
    }

    const dimensionFieldName = dimensionFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    const dimensionUnit = dimensionFieldDef.unit && dimensionFieldDef.unit !== "none" ? dimensionFieldDef.unit : "";
    const valueUnit = valueFieldDef.unit && valueFieldDef.unit !== "none" ? ` ${valueFieldDef.unit}` : ""; // Add space if unit exists

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typographyInput.title && typographyInput.title.font_family) ? typographyInput.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typographyInput.title && typographyInput.title.font_size) ? typographyInput.title.font_size : '16px',
            titleFontWeight: (typographyInput.title && typographyInput.title.font_weight) ? typographyInput.title.font_weight : 'bold',
            labelFontFamily: (typographyInput.label && typographyInput.label.font_family) ? typographyInput.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyInput.label && typographyInput.label.font_size) ? typographyInput.label.font_size : '12px',
            labelFontWeight: (typographyInput.label && typographyInput.label.font_weight) ? typographyInput.label.font_weight : 'normal',
            annotationFontFamily: (typographyInput.annotation && typographyInput.annotation.font_family) ? typographyInput.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyInput.annotation && typographyInput.annotation.font_size) ? typographyInput.annotation.font_size : '10px',
            annotationFontWeight: (typographyInput.annotation && typographyInput.annotation.font_weight) ? typographyInput.annotation.font_weight : 'normal',
        },
        barPrimaryColor: (colorsInput.other && colorsInput.other.primary) ? colorsInput.other.primary : '#1f77b4',
        textColor: colorsInput.text_color || '#0f223b',
        labelColorInsideBar: '#FFFFFF',
        iconBackgroundColor: '#FFFFFF', // Retained from original design for icon visibility
        chartBackground: colorsInput.background_color || '#FFFFFF',
        iconUrls: imagesInput.field || {},
    };

    // Helper function for text width estimation, uses svgRoot (defined later)
    // This function will be called after svgRoot is initialized.
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!svgRoot) {
             // This case should ideally not be hit if calls are ordered correctly.
            console.warn("estimateTextWidth called before svgRoot is initialized. Using crude fallback.");
            return text.length * (parseInt(fontSize, 10) * 0.5); // Crude fallback
        }
        const tempText = svgRoot.append("text")
            .attr("class", "temp-text-measurement")
            .style("font-family", fontFamily)
            .style("font-size", fontSize)
            .style("font-weight", fontWeight)
            .style("opacity", 0) // Make it invisible during measurement
            .attr("x", -9999) // Position off-screen
            .attr("y", -9999)
            .text(text);
        
        let width = 0;
        try {
            const bbox = tempText.node().getBBox();
            width = bbox.width;
        } catch (e) {
            console.warn("Could not estimate text width using svgRoot for: ", text, e);
            width = text.length * (parseInt(fontSize, 10) * 0.5); // Crude fallback
        }
        tempText.remove();
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~.1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~.1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~.1f")(value / 1000) + "K";
        return d3.format("~g")(value); // For values less than 1000
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: variables.margin_top || 20,
        right: variables.margin_right || 20, // Minimal initial, will be expanded
        bottom: variables.margin_bottom || 30,
        left: variables.margin_left || 40 // Space for icons at the start of bars
    };
    
    let maxDimLabelWidth = 0;
    if (chartData.length > 0) {
        const uniqueDimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
        uniqueDimensions.forEach(dim => {
            const labelText = `${dim}${dimensionUnit}`; // Dimension name + unit
            const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            if (width > maxDimLabelWidth) maxDimLabelWidth = width;
        });
    }
    
    // Estimate max value label width (assuming it's outside)
    let maxValueLabelWidth = 0;
    if (chartData.length > 0) {
        const maxValue = d3.max(chartData, d => +d[valueFieldName]);
        if (maxValue !== undefined) {
             const formattedMaxValue = `${formatValue(maxValue)}${valueUnit}`;
             maxValueLabelWidth = estimateTextWidth(formattedMaxValue, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        }
    }
    
    // Adjust right margin: space for (potentially external) value label + dimension label + padding
    const labelSpacing = 10; // Space between value label and dimension label if both outside
    const endPadding = 15;   // Padding at the very end of the chart
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + labelSpacing + maxDimLabelWidth + endPadding);


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        console.error("Calculated innerWidth or innerHeight is not positive. Check container dimensions and margins.");
        d3.select(containerSelector).html("<div style='color:red; padding:10px;'>Error: Chart drawing area is too small.</div>");
        return null;
    }
    
    // Block 5: Data Preprocessing & Transformation
    const sortedData = [...chartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);
    const sortedDimensionNames = sortedData.map(d => d[dimensionFieldName]);
    
    if (sortedData.length === 0) {
        // svgRoot.append("text") // No data message
        //     .attr("x", containerWidth / 2)
        //     .attr("y", containerHeight / 2)
        //     .attr("text-anchor", "middle")
        //     .style("font-family", fillStyle.typography.labelFontFamily)
        //     .style("font-size", fillStyle.typography.labelFontSize)
        //     .text("No data available.");
        return svgRoot.node(); // Return empty SVG or SVG with message
    }

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(0.25); // A bit more padding than 0.2 for visual separation

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => +d[valueFieldName]) * 1.05])
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering
    // No explicit axes, gridlines, or legend in this chart type.

    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    // Block 8: Main Data Visualization Rendering
    const barGroups = mainChartGroup.selectAll(".bar-group")
        .data(sortedData, d => d[dimensionFieldName]) // Key function for object constancy
        .enter()
        .append("g")
        .attr("class", d => `bar-group mark-container ${dimensionFieldName}-${String(d[dimensionFieldName]).replace(/\s+/g, '-')}`) // Class for dimension
        .attr("transform", d => `translate(0, ${yScale(d[dimensionFieldName])})`);

    const barBandHeight = yScale.bandwidth();

    barGroups.append("rect")
        .attr("class", "mark bar")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", d => Math.max(0, xScale(+d[valueFieldName])))
        .attr("height", barBandHeight)
        .attr("fill", fillStyle.barPrimaryColor);

    const iconSize = Math.min(barBandHeight * 0.8, 30); // Cap icon size
    const iconXOffset = barBandHeight * 0.1; 
    const iconYOffset = (barBandHeight - iconSize) / 2;

    barGroups.each(function(d) {
        const group = d3.select(this);
        const dimensionValue = d[dimensionFieldName];
        const iconUrl = fillStyle.iconUrls[dimensionValue];

        if (iconUrl) {
            group.append("circle")
                .attr("class", "icon-background other") // 'other' class as it's a decorative element
                .attr("cx", iconXOffset + iconSize / 2)
                .attr("cy", iconYOffset + iconSize / 2)
                .attr("r", iconSize / 2)
                .attr("fill", fillStyle.iconBackgroundColor);

            group.append("image")
                .attr("class", "icon image")
                .attr("x", iconXOffset)
                .attr("y", iconYOffset)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        }
    });
    
    barGroups.each(function(d, i) {
        const group = d3.select(this);
        const barWidthVal = +d[valueFieldName];
        const barPixelWidth = Math.max(0, xScale(barWidthVal));
        
        const valueLabelText = `${formatValue(barWidthVal)}${valueUnit}`;
        const valueLabelWidth = estimateTextWidth(valueLabelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        
        const spaceForIcon = (fillStyle.iconUrls[d[dimensionFieldName]] ? iconXOffset + iconSize : 0) + 5; // 5px padding after icon
        const labelFitsInside = valueLabelWidth + 10 < barPixelWidth - spaceForIcon;

        const valueLabelX = labelFitsInside ? barPixelWidth - 5 : barPixelWidth + 5;
        const valueLabelAnchor = labelFitsInside ? "end" : "start";
        const valueLabelColor = labelFitsInside ? fillStyle.labelColorInsideBar : fillStyle.textColor;

        // Value Label
        group.append("text")
            .attr("class", "label value-label")
            .attr("x", valueLabelX)
            .attr("y", barBandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", valueLabelAnchor)
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", valueLabelColor)
            .text(valueLabelText);

        // Dimension Label
        const dimensionLabelText = `${d[dimensionFieldName]}${dimensionUnit}`;
        const dimensionLabelX = barPixelWidth + (labelFitsInside ? 5 : valueLabelWidth + labelSpacing);
        
        group.append("text")
            .attr("class", "label dimension-label")
            .attr("x", dimensionLabelX)
            .attr("y", barBandHeight / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(dimensionLabelText);

        // Unit Label for the first bar (if valueUnit exists and is not just a space)
        if (i === 0 && valueUnit.trim()) {
            group.append("text")
                .attr("class", "label unit-label other") // 'other' as it's a general chart info
                .attr("x", barPixelWidth) 
                .attr("y", -5) // Slightly above the first bar
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", fillStyle.textColor)
                .text(`(${valueUnit.trim()})`);
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No interactive elements like tooltips or hover effects in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
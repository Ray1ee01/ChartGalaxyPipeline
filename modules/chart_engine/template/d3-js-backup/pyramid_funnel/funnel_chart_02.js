/* REQUIREMENTS_BEGIN
{
  "chart_type": "Funnel Chart",
  "chart_name": "funnel_chart_02",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [["all"], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
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
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */



function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const rawChartData = data.data && data.data.data ? data.data.data : [];
    const configVariables = data.variables || {};
    const configTypography = data.typography || {};
    const configColors = data.colors || data.colors_dark || {}; // Assuming colors_dark is an alternative
    const configImages = data.images || {}; // Not used in this chart
    const configDataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = configDataColumns.find(col => col.role === "x");
    const valueFieldDef = configDataColumns.find(col => col.role === "y");

    let missingFields = [];
    if (!categoryFieldDef || !categoryFieldDef.name) {
        missingFields.push("category field (role 'x')");
    }
    if (!valueFieldDef || !valueFieldDef.name) {
        missingFields.push("value field (role 'y')");
    }

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    // Block 2: Style Configuration & Helper Definitions
    const DEFAULT_TYPOGRAPHY = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "14px", font_weight: "bold" }, // Matched original label style
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    const DEFAULT_COLORS = {
        field: {},
        other: { primary: "#1f77b4", secondary: "#ff7f0e" },
        available_colors: d3.schemeCategory10.slice(),
        background_color: "#FFFFFF",
        text_color: "#0f223b"
    };
    
    const fillStyle = {
        typography: {
            labelFontFamily: (configTypography.label && configTypography.label.font_family) ? configTypography.label.font_family : DEFAULT_TYPOGRAPHY.label.font_family,
            labelFontSize: (configTypography.label && configTypography.label.font_size) ? configTypography.label.font_size : DEFAULT_TYPOGRAPHY.label.font_size,
            labelFontWeight: (configTypography.label && configTypography.label.font_weight) ? configTypography.label.font_weight : DEFAULT_TYPOGRAPHY.label.font_weight,
        },
        textColor: configColors.text_color || DEFAULT_COLORS.text_color,
        backgroundColor: configColors.background_color || DEFAULT_COLORS.background_color,
        getSegmentColor: (categoryValue, index) => {
            if (configColors.field && configColors.field[categoryValue]) {
                return configColors.field[categoryValue];
            }
            if (configColors.available_colors && configColors.available_colors.length > 0) {
                return configColors.available_colors[index % configColors.available_colors.length];
            }
            return DEFAULT_COLORS.available_colors[index % DEFAULT_COLORS.available_colors.length];
        }
    };

    // Helper function to estimate text width (not used in this chart, provided as per template)
    function estimateTextWidth(text, fontProps) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontProps.font_family);
        tempText.setAttribute('font-size', fontProps.font_size);
        tempText.setAttribute('font-weight', fontProps.font_weight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Note: getBBox on an unattached SVG element can be unreliable.
        // A more robust method might involve temporary DOM attachment or canvas-based measurement.
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements fails
            const canvas = estimateTextWidth.canvas || (estimateTextWidth.canvas = document.createElement("canvas"));
            const context = canvas.getContext("2d");
            context.font = `${fontProps.font_weight} ${fontProps.font_size} ${fontProps.font_family}`;
            width = context.measureText(text).width;
        }
        return width;
    }

    const SEGMENT_GAP_Y = 5; // Vertical gap between funnel segments, as in original

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.backgroundColor) // Apply background color to SVG root
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 40, right: 120, bottom: 40, left: 60 }; // Original margins
    
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Funnel specific layout calculations (as per original logic)
    const maxFunnelWidth = innerWidth * 0.8; // Max width of the top segment
    const funnelHeightVisualBase = innerHeight * 0.8; // Base height for segment height calculation

    // Block 5: Data Preprocessing & Transformation
    // Ensure values are numeric, filter out invalid data points
    const processedChartData = rawChartData
        .map(d => ({
            ...d,
            [valueFieldName]: parseFloat(d[valueFieldName])
        }))
        .filter(d => d[categoryFieldName] != null && !isNaN(d[valueFieldName]) && d[valueFieldName] >= 0);


    if (processedChartData.length === 0) {
        const errorMsg = "No valid data available to render the chart after processing.";
        console.warn(errorMsg);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:orange; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const chartDataArray = [...processedChartData].sort((a, b) => b[valueFieldName] - a[valueFieldName]);

    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);

    chartDataArray.forEach(d => {
        d.percent = totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0;
    });
    
    const numSegments = chartDataArray.length;
    if (numSegments === 0) {
        // Handled by processedChartData.length check above, but good to be explicit
        return null; 
    }

    // Height of each segment polygon (as per original logic)
    const segmentPolygonHeight = funnelHeightVisualBase / numSegments; 

    // Block 6: Scale Definition & Configuration
    const funnelWidthScale = d3.scaleLinear()
        .domain([0, 100]) // Percentages
        .range([0, maxFunnelWidth]); // Pixel width

    const segmentWidths = chartDataArray.map(d => funnelWidthScale(d.percent));

    // Vertical centering offset (as per original logic, centers the `funnelHeightVisualBase`)
    const verticalCenteringOffset = (innerHeight - funnelHeightVisualBase) / 2;

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    // No axes, gridlines, or legend for this funnel chart.

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    chartDataArray.forEach((d, i) => {
        const segmentColor = fillStyle.getSegmentColor(d[categoryFieldName], i);
        
        const topWidth = segmentWidths[i];
        const bottomWidth = (i < numSegments - 1) 
            ? segmentWidths[i + 1] 
            : topWidth * 0.8; // Last segment's bottom is 80% of its top

        // Y-coordinate calculation preserving original visual behavior with SEGMENT_GAP_Y
        const segmentYTop = i * segmentPolygonHeight + verticalCenteringOffset + (SEGMENT_GAP_Y * i);
        
        const polygonPoints = [
            [innerWidth / 2 - topWidth / 2, segmentYTop],
            [innerWidth / 2 + topWidth / 2, segmentYTop],
            [innerWidth / 2 + bottomWidth / 2, segmentYTop + segmentPolygonHeight],
            [innerWidth / 2 - bottomWidth / 2, segmentYTop + segmentPolygonHeight]
        ];

        mainChartGroup.append("polygon")
            .attr("points", polygonPoints.map(p => p.join(",")).join(" "))
            .attr("fill", segmentColor)
            .attr("class", "mark funnel-segment");

        // Add labels
        const labelX = innerWidth / 2 + topWidth / 2 + 10; // Position to the right of the segment
        const labelY = segmentYTop + segmentPolygonHeight / 2;
        
        mainChartGroup.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("dominant-baseline", "middle")
            .attr("font-family", fillStyle.typography.labelFontFamily)
            .attr("font-size", fillStyle.typography.labelFontSize)
            .attr("font-weight", fillStyle.typography.labelFontWeight)
            .attr("fill", fillStyle.textColor)
            .attr("class", "label data-label")
            .text(`${d[categoryFieldName]} ${Math.round(d.percent)}%`);
    });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
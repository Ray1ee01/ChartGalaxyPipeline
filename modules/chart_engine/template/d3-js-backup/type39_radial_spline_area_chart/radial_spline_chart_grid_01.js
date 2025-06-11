/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Spline Chart",
  "chart_name": "radial_spline_chart_grid_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[3, 12], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": [],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",
  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "none",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed in colors_dark
    const images = data.images || {}; // Parsed, though not used in this specific chart
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldCol = dataColumns.find(col => col.role === "x");
    const yFieldCol = dataColumns.find(col => col.role === "y");

    const categoryFieldName = xFieldCol?.name;
    const valueFieldName = yFieldCol?.name;

    if (!categoryFieldName || !valueFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role field");
        if (!valueFieldName) missingFields.push("y role field");
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const svgNS = 'http://www.w3.org/2000/svg';
        const tempSvg = document.createElementNS(svgNS, 'svg');
        const textElement = document.createElementNS(svgNS, 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Note: getBBox on non-rendered element behavior can vary.
        // For this directive, we assume it works without DOM attachment.
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might not work reliably
            const numChars = text ? text.length : 0;
            const size = parseFloat(fontSize) || 12; // Default to 12px if fontSize is invalid
            width = numChars * size * 0.6; // Very rough approximation
        }
        return width;
    };
    
    const fillStyle = {
        typography: {
            titleFontFamily: typography.title?.font_family || 'Arial, sans-serif',
            titleFontSize: typography.title?.font_size || '16px',
            titleFontWeight: typography.title?.font_weight || 'bold',
            labelFontFamily: typography.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typography.label?.font_size || '12px',
            labelFontWeight: typography.label?.font_weight || 'normal',
            annotationFontFamily: typography.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typography.annotation?.font_size || '10px',
            annotationFontWeight: typography.annotation?.font_weight || 'normal',
        },
        textColor: colors.text_color || '#0F223B',
        secondaryTextColor: colors.other?.secondary_text || '#555555',
        primaryAccent: colors.other?.primary || '#1f77b4',
        gridLineColor: colors.other?.grid_line || '#CCCCCC',
        chartBackground: colors.background_color || '#FFFFFF',
        dataPointStroke: '#FFFFFF', // Typically white for contrast on colored points
        valueLabelText: colors.other?.text_on_primary || '#FFFFFF', // Text color for labels on primaryAccent background
    };
    fillStyle.valueLabelBackground = fillStyle.primaryAccent; // Background for value labels is the primary accent color

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-root");

    svgRoot.append("rect")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("fill", fillStyle.chartBackground)
        .attr("class", "background-rect other");
        
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = variables.margin || { top: 50, right: 50, bottom: 50, left: 50 };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    mainChartGroup.attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    const allValues = chartData.map(d => parseFloat(d[valueFieldName])).filter(v => !isNaN(v));
    
    // Radial charts typically don't show negative values well by distance from center.
    // Assuming non-negative values as per required_fields_range [0, "inf"] for 'y'.
    const minValue = 0; 
    const maxValue = d3.max(allValues) || 0;

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Distributes points evenly, not overlapping first/last

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue * 1.2]) // Add 20% headroom to max value
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const ticks = radiusScale.ticks(5);

    mainChartGroup.selectAll(".grid-line.circle-grid")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "grid-line circle-grid other")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    mainChartGroup.selectAll(".grid-line.radial-grid")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "grid-line radial-grid other")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radius * Math.cos(angleScale(d) - Math.PI / 2)) // -PI/2 to start at top
        .attr("y2", d => radius * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    mainChartGroup.selectAll(".label.category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label text")
        .attr("x", d => (radius + 20) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (radius + 20) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // Use unrotated angle for this logic
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) return "middle";
            return angle > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1) return "middle";
            return angle < Math.PI ? "hanging" : "auto";
        })
        .attr("fill", fillStyle.textColor)
        .attr("font-family", fillStyle.typography.labelFontFamily)
        .attr("font-size", fillStyle.typography.labelFontSize)
        .attr("font-weight", fillStyle.typography.labelFontWeight === 'bold' ? 'bold' : 'normal') // Original used bold, respect config or make it default
        .text(d => d);

    mainChartGroup.selectAll(".label.tick-label")
        .data(ticks.filter(d => d > minValue)) // Don't label origin tick if it's 0 and values start from 0
        .enter()
        .append("text")
        .attr("class", "label tick-label text")
        .attr("x", 5) // Offset slightly from the axis line
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.secondaryTextColor)
        .attr("font-family", fillStyle.typography.annotationFontFamily)
        .attr("font-size", fillStyle.typography.annotationFontSize)
        .attr("font-weight", fillStyle.typography.annotationFontWeight)
        .text(d => d);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineGenerator = () => {
        const points = categories.map(cat => {
            const pointData = chartData.find(item => item[categoryFieldName] === cat);
            const value = pointData ? parseFloat(pointData[valueFieldName]) : 0;
            const angle = angleScale(cat) - Math.PI / 2;
            const distance = radiusScale(isNaN(value) ? 0 : value);
            return [distance * Math.cos(angle), distance * Math.sin(angle)];
        });
        return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(points);
    };

    mainChartGroup.append("path")
        .attr("class", "mark data-line")
        .attr("d", lineGenerator())
        .attr("fill", "none") // No fill for the area, solid colors only for line
        .attr("stroke", fillStyle.primaryAccent)
        .attr("stroke-width", 3); // Original used 6, can be configured if needed

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    categories.forEach((cat, index) => {
        const pointData = chartData.find(item => item[categoryFieldName] === cat);
        if (pointData) {
            const value = parseFloat(pointData[valueFieldName]);
            if (isNaN(value)) return;

            const angle = angleScale(cat) - Math.PI / 2;
            const distance = radiusScale(value);

            mainChartGroup.append("circle")
                .attr("class", "mark data-point")
                .attr("cx", distance * Math.cos(angle))
                .attr("cy", distance * Math.sin(angle))
                .attr("r", 5) // Original used 6
                .attr("fill", fillStyle.primaryAccent)
                .attr("stroke", fillStyle.dataPointStroke)
                .attr("stroke-width", 2); // Original used 3

            // Value labels for data points
            const labelText = value.toString();
            const textWidth = estimateTextWidth(
                labelText, 
                fillStyle.typography.annotationFontFamily, 
                fillStyle.typography.annotationFontSize, 
                fillStyle.typography.annotationFontWeight
            );
            
            // Preserving original specific positioning tweak for the first label
            const labelOffsetAmount = 15; // General offset from point
            let textX = (distance + labelOffsetAmount) * Math.cos(angle);
            let textY = (distance + labelOffsetAmount) * Math.sin(angle);

            if (index === 0) { // Special adjustment for the first data point's label (top-most point)
                 textX = (distance + labelOffsetAmount) * Math.cos(angle); // Centered horizontally
                 textY = (distance + labelOffsetAmount + 5) * Math.sin(angle); // Slightly more offset vertically
            }
            
            const padding = { x: 4, y: 2 };
            const rectWidth = textWidth + 2 * padding.x;
            const rectHeight = parseFloat(fillStyle.typography.annotationFontSize) + 2 * padding.y;

            mainChartGroup.append("rect")
                .attr("class", "other value-label-background")
                .attr("x", textX - rectWidth / 2)
                .attr("y", textY - rectHeight / 2)
                .attr("width", rectWidth)
                .attr("height", rectHeight)
                .attr("fill", fillStyle.valueLabelBackground)
                .attr("rx", 3);

            mainChartGroup.append("text")
                .attr("class", "label value-label text")
                .attr("x", textX)
                .attr("y", textY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-family", fillStyle.typography.annotationFontFamily)
                .attr("font-size", fillStyle.typography.annotationFontSize)
                .attr("font-weight", fillStyle.typography.annotationFontWeight)
                .attr("fill", fillStyle.valueLabelText)
                .text(labelText);
        }
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
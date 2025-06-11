/* REQUIREMENTS_BEGIN
{
  "chart_type": "Radial Spline Chart",
  "chart_name": "radial_spline_plain_chart_01",
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

  "elementAlignment": "none",
  "xAxis": "minimal",
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
    const chartDataInput = data.data; // Assuming data.data contains { data: [], columns: [] }
    const chartDataArray = chartDataInput ? chartDataInput.data : [];
    const dataColumns = chartDataInput ? chartDataInput.columns || [] : [];
    const variables = data.variables || {};
    const typography = data.typography || {};
    const colors = data.colors || data.colors_dark || {}; // Prioritize data.colors, fallback to data.colors_dark
    const images = data.images || {}; // Not used in this chart, but parsed for consistency

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === 'x');
    const valueFieldDef = dataColumns.find(col => col.role === 'y');

    if (!categoryFieldDef || !valueFieldDef) {
        const missing = [];
        if (!categoryFieldDef) missing.push("x role field");
        if (!valueFieldDef) missing.push("y role field");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))].filter(c => c != null); // Filter out null/undefined categories

    if (categories.length < 3) {
        const errorMsg = "Error: Insufficient number of distinct categories for Radial Spline Chart. Minimum 3 categories required.";
        console.error(errorMsg + ` Found: ${categories.length}`);
         if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (typography.title && typography.title.font_family) ? typography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (typography.title && typography.title.font_size) ? typography.title.font_size : '18px',
            titleFontWeight: (typography.title && typography.title.font_weight) ? typography.title.font_weight : 'bold',
            
            labelFontFamily: (typography.label && typography.label.font_family) ? typography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typography.label && typography.label.font_size) ? typography.label.font_size : '16px', // Original: 16px
            labelFontWeight: (typography.label && typography.label.font_weight) ? typography.label.font_weight : 'bold', // Original: bold

            annotationFontFamily: (typography.annotation && typography.annotation.font_family) ? typography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typography.annotation && typography.annotation.font_size) ? typography.annotation.font_size : '14px', // Original: 14px
            annotationFontWeight: (typography.annotation && typography.annotation.font_weight) ? typography.annotation.font_weight : 'normal',
        },
        primaryColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4',
        axisLineColor: (colors.other && colors.other.grid_lines) ? colors.other.grid_lines : '#BBBBBB', // Original: #bbb
        categoryLabelColor: colors.text_color || '#333333',
        pointStrokeColor: colors.background_color || '#FFFFFF', // For contrast against point fill
        valueLabelBackgroundColor: (colors.other && colors.other.primary) ? colors.other.primary : '#1f77b4', // Same as primary for consistency
        valueLabelTextColor: '#FFFFFF', // Assuming primary is dark enough for white text
        chartBackground: colors.background_color || 'transparent', // Use transparent if not specified
    };
    
    // Constants for fixed visual properties not covered by `variables` or `colors`/`typography`
    const LINE_STROKE_WIDTH = 6;
    const POINT_RADIUS = 6;
    const POINT_STROKE_WIDTH = 3;
    const LABEL_PADDING = 20; // For category labels from edge
    const VALUE_LABEL_OFFSET = 30; // For value labels from point
    const VALUE_LABEL_BG_PADDING_X = 4;
    const VALUE_LABEL_BG_PADDING_Y = 2; // Adjusted for typical font height
    const VALUE_LABEL_RECT_HEIGHT = parseFloat(fillStyle.typography.annotationFontSize) + 2 * VALUE_LABEL_BG_PADDING_Y;


    const estimateTextWidth = (text, fontProps) => {
        if (!text || String(text).trim() === "") return 0;
        const tempSvgForTextEstimation = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('font-family', fontProps.font_family);
        textNode.setAttribute('font-size', fontProps.font_size);
        textNode.setAttribute('font-weight', fontProps.font_weight);
        textNode.textContent = text;
        tempSvgForTextEstimation.appendChild(textNode);
        let bboxWidth = 0;
        try {
            bboxWidth = textNode.getBBox().width;
        } catch (e) {
            console.warn("getBBox on unattached text element failed. Text width estimation might be inaccurate.", e);
        }
        return bboxWidth;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "other") // Standardized class for root SVG
        .style("background-color", fillStyle.chartBackground);


    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 }; // Original fixed margins
    // Adjust margins if labels are large
    const maxCategoryLabelWidth = categories.reduce((max, cat) => {
        return Math.max(max, estimateTextWidth(cat, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        }));
    }, 0);
    
    // Ensure margins accommodate labels. This is a simplified heuristic.
    const dynamicMargin = Math.max(50, maxCategoryLabelWidth / 2 + LABEL_PADDING); // Heuristic for radial labels
    chartMargins.top = chartMargins.bottom = chartMargins.left = chartMargins.right = dynamicMargin;


    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`)
        .attr("class", "mark"); // Main group for chart elements

    // Block 5: Data Preprocessing & Transformation
    const allValues = chartDataArray.map(d => d[valueFieldName]).filter(v => typeof v === 'number' && !isNaN(v));
    const minValue = Math.min(0, d3.min(allValues) || 0); // Ensure 0 is included if all values positive
    const maxValue = d3.max(allValues) || 0;

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensures distinct points

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue * 1.1]) // Add padding, handle single value case
        .range([0, radius])
        .nice();
    
    const effectiveRadiusScaleMax = radiusScale.range()[1]; // Actual max radius after .nice()

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const radialAxisLinesGroup = mainChartGroup.append("g").attr("class", "axis radial-axes");
    radialAxisLinesGroup.selectAll(".radial-axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => effectiveRadiusScaleMax * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y2", d => effectiveRadiusScaleMax * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.axisLineColor)
        .attr("stroke-width", 1);

    const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "label category-labels");
    categoryLabelsGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (effectiveRadiusScaleMax + LABEL_PADDING) * Math.cos(angleScale(d) - Math.PI / 2))
        .attr("y", d => (effectiveRadiusScaleMax + LABEL_PADDING) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d); // 0 to 2PI range
            // Check if angle is close to vertical (PI/2 or 3PI/2) or horizontal (0 or PI)
            if (Math.abs(angle - Math.PI / 2) < 0.01 || Math.abs(angle - 3 * Math.PI / 2) < 0.01) return "middle"; // Top/Bottom
            return (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) ? "end" : "start"; // Left side : Right side
        })
        .attr("dominant-baseline", d => {
            const angle = angleScale(d);
            if (Math.abs(angle) < 0.01 || Math.abs(angle - Math.PI) < 0.01) return "middle"; // Right/Left middle
            return (angle > 0 && angle < Math.PI) ? "hanging" : "auto"; // Top half : Bottom half
        })
        .attr("fill", fillStyle.categoryLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const lineDataPoints = categories.map(cat => {
        const pointData = chartDataArray.find(item => item[categoryFieldName] === cat);
        const value = pointData ? pointData[valueFieldName] : 0; // Default to 0 if data missing for a category
        const angle = angleScale(cat) - Math.PI / 2; // Rotate to start at top
        const distance = radiusScale(typeof value === 'number' && !isNaN(value) ? value : minValue); // Use minValue for non-numeric/NaN
        return {
            x: distance * Math.cos(angle),
            y: distance * Math.sin(angle),
            value: pointData ? pointData[valueFieldName] : undefined, // Keep original value for labels
            category: cat,
            angle: angle, // Store for label positioning
            distance: distance // Store for label positioning
        };
    });

    const lineGenerator = d3.line()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveCatmullRomClosed.alpha(0.5));

    mainChartGroup.append("path")
        .datum(lineDataPoints)
        .attr("class", "mark data-line")
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", fillStyle.primaryColor)
        .attr("stroke-width", LINE_STROKE_WIDTH);

    const dataPointsGroup = mainChartGroup.append("g").attr("class", "mark data-points");
    dataPointsGroup.selectAll(".data-point")
        .data(lineDataPoints.filter(d => d.value !== undefined)) // Only draw points for actual data
        .enter()
        .append("circle")
        .attr("class", "mark data-point")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", POINT_RADIUS)
        .attr("fill", fillStyle.primaryColor)
        .attr("stroke", fillStyle.pointStrokeColor)
        .attr("stroke-width", POINT_STROKE_WIDTH);

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    const valueLabelsGroup = mainChartGroup.append("g").attr("class", "label value-labels");
    lineDataPoints.filter(d => d.value !== undefined).forEach((d, i) => { // Only for actual data points
        const labelText = String(d.value);
        const textFontProps = {
            font_family: fillStyle.typography.annotationFontFamily,
            font_size: fillStyle.typography.annotationFontSize,
            font_weight: fillStyle.typography.annotationFontWeight
        };
        const estimatedWidth = estimateTextWidth(labelText, textFontProps);

        let textX = (d.distance + VALUE_LABEL_OFFSET) * Math.cos(d.angle);
        let textY = (d.distance + VALUE_LABEL_OFFSET) * Math.sin(d.angle);

        // Original specific adjustment for the first label - preserved for visual consistency
        if (i === 0 && categories.length > 1) { // Ensure there's more than one category for this specific logic
             textX = (d.distance + VALUE_LABEL_OFFSET) * Math.cos(d.angle) - (VALUE_LABEL_OFFSET / 2); // Adjusted original logic
             textY = (d.distance + VALUE_LABEL_OFFSET / 2) * Math.sin(d.angle); // Adjusted original logic
        }
        
        const rectWidth = estimatedWidth + 2 * VALUE_LABEL_BG_PADDING_X;
        const rectHeight = VALUE_LABEL_RECT_HEIGHT;

        valueLabelsGroup.append("rect")
            .attr("class", "other value-label-background")
            .attr("x", textX - rectWidth / 2)
            .attr("y", textY - rectHeight / 2)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            // .attr("rx", 0) // Sharp corners as per directive (no complex effects)
            .attr("fill", fillStyle.valueLabelBackgroundColor);

        valueLabelsGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", textX)
            .attr("y", textY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", textFontProps.font_family)
            .style("font-size", textFontProps.font_size)
            .style("font-weight", textFontProps.font_weight)
            .attr("fill", fillStyle.valueLabelTextColor)
            .text(labelText);
    });

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
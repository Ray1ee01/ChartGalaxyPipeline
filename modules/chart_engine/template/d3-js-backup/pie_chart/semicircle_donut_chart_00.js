/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Donut Chart",
  "chart_name": "semicircle_donut_chart_00",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "center",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function

    // Block 1: Configuration Parsing & Validation
    const chartInputData = data;
    const chartDataArray = chartInputData.data.data || [];
    const configVariables = chartInputData.variables || {};
    const rawTypography = chartInputData.typography || {};
    const rawColors = chartInputData.colors || {}; // Could be colors_dark too, logic to pick one could be here if needed
    const configImages = chartInputData.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = chartInputData.data.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !categoryFieldDef.name || !valueFieldDef || !valueFieldDef.name) {
        console.error("Critical chart config missing: Category ('x') or Value ('y') field names not defined in data.data.columns. Cannot render.");
        if (containerSelector) {
            d3.select(containerSelector).html("<div style='color:red;'>Error: Critical chart configuration missing (category or value field). Cannot render.</div>");
        }
        return null;
    }
    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

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
        chartBackground: rawColors.background_color || '#FFFFFF', // Not used directly on SVG, but available
        defaultSegmentColor: (rawColors.other && rawColors.other.primary) || '#4682B4',
        labelLineColor: '#888888', // Default subtle color for label lines
    };

    fillStyle.getSegmentColor = (categoryName, index) => {
        if (rawColors.field && rawColors.field[categoryName]) {
            return rawColors.field[categoryName];
        }
        if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            return rawColors.available_colors[index % rawColors.available_colors.length];
        }
        // Fallback to a programmatic scheme if available_colors is not sufficient or not provided
        const defaultScheme = d3.schemeCategory10;
        return defaultScheme[index % defaultScheme.length] || fillStyle.defaultSegmentColor;
    };
    
    function estimateTextWidth(text, fontWeight, fontSize, fontFamily) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        return context.measureText(text).width;
    }

    function midAngle(d) {
        return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = configVariables.width || 800;
    const containerHeight = configVariables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg-root")
        .style("background-color", fillStyle.chartBackground); // Optional: apply background to SVG itself

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 80, bottom: 60, left: 80 }; // Adjusted for labels/legend
    
    // Center of the SVG, not accounting for margins initially for pie charts
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Radius calculation: consider margins to ensure labels fit.
    // The donut itself should fit within a box defined by these margins.
    const effectiveWidth = containerWidth - chartMargins.left - chartMargins.right;
    const effectiveHeight = (containerHeight - chartMargins.top - chartMargins.bottom) * 2; // Semicircle uses height more effectively
    const donutOuterRadius = Math.min(effectiveWidth, effectiveHeight) / 2 * 0.9; // 0.9 factor for some padding
    const donutInnerRadius = donutOuterRadius * 0.75;
    const labelArcRadius = donutOuterRadius * 1.1;


    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const dataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) : 0
    }));

    // Block 6: Scale Definition & Configuration
    const pieGenerator = d3.pie()
        .value(d => d.percentage)
        .sort(null) // Keep original data order
        .startAngle(-Math.PI / 2) // -90 degrees (top)
        .endAngle(Math.PI / 2);   // 90 degrees (bottom)

    const arcGenerator = d3.arc()
        .innerRadius(donutInnerRadius)
        .outerRadius(donutOuterRadius)
        .padAngle(0.02); // No cornerRadius as per simplification

    const labelArcGenerator = d3.arc()
        .innerRadius(labelArcRadius)
        .outerRadius(labelArcRadius);

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const legendCategories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    const legendItemHeight = 20;
    const legendRectSize = 12;
    const legendSpacing = 5;
    const legendPadding = 10;

    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    let currentX = 0;
    const legendItems = legendGroup.selectAll(".legend-item")
        .data(legendCategories)
        .enter()
        .append("g")
        .attr("class", "legend-item label") // Added 'label' class
        .attr("transform", (d, i) => {
            const itemWidth = legendRectSize + legendSpacing + estimateTextWidth(
                d,
                fillStyle.typography.labelFontWeight,
                fillStyle.typography.labelFontSize,
                fillStyle.typography.labelFontFamily
            ) + legendPadding;
            const xPos = currentX;
            currentX += itemWidth;
            return `translate(${xPos}, 0)`;
        });

    legendItems.append("rect")
        .attr("width", legendRectSize)
        .attr("height", legendRectSize)
        .attr("y", (legendItemHeight - legendRectSize) / 2)
        .attr("fill", (d, i) => fillStyle.getSegmentColor(d, i))
        .attr("class", "mark"); // Added 'mark' class

    legendItems.append("text")
        .attr("x", legendRectSize + legendSpacing)
        .attr("y", legendItemHeight / 2)
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => d)
        .attr("class", "text"); // Added 'text' class

    const legendWidth = currentX - legendPadding; // Total width of all legend items
    legendGroup.attr("transform", `translate(${(containerWidth - legendWidth) / 2}, ${chartMargins.top / 2 - legendItemHeight / 2})`);


    // Block 8: Main Data Visualization Rendering (e.g., Bars, Lines, Points, Areas)
    const pieArcsData = pieGenerator(dataWithPercentages);

    const arcPaths = mainChartGroup.selectAll(".chart-arc")
        .data(pieArcsData)
        .enter().append("path")
        .attr("class", d => `chart-arc mark series-${d.index}`) // Added 'mark' class
        .attr("fill", d => fillStyle.getSegmentColor(d.data[categoryFieldName], d.index))
        .attr("d", arcGenerator);

    // Add labels and polylines
    const labelElementsGroup = mainChartGroup.selectAll(".label-group")
        .data(pieArcsData)
        .enter()
        .append("g")
        .attr("class", "label-group label"); // Added 'label' class

    labelElementsGroup.append("polyline")
        .attr("class", "label-line other") // Added 'other' class
        .attr("points", d => {
            const pos = arcGenerator.centroid(d);
            const midPos = labelArcGenerator.centroid(d);
            const angle = midAngle(d);
            
            const textPos = [
                midPos[0] * 1.15, // Adjust multiplier for distance
                midPos[1] * 1.15
            ];
            
            // Ensure polyline points towards correct side for semicircle
            if (angle > 0) { // Right side
                textPos[0] = Math.abs(textPos[0]);
            } else { // Left side
                textPos[0] = -Math.abs(textPos[0]);
            }
            return [pos, midPos, textPos];
        })
        .attr("stroke", fillStyle.labelLineColor)
        .attr("fill", "none")
        .attr("stroke-width", 1);

    labelElementsGroup.append("text")
        .attr("class", "data-label text") // Added 'text' class
        .attr("transform", d => {
            const midPos = labelArcGenerator.centroid(d);
            const angle = midAngle(d);
            const textPos = [
                midPos[0] * 1.2, // Adjust multiplier for distance
                midPos[1] * 1.2
            ];
             // Ensure text is positioned correctly for semicircle
            if (angle > 0) { // Right side
                textPos[0] = Math.abs(textPos[0]);
            } else { // Left side
                textPos[0] = -Math.abs(textPos[0]);
            }
            return `translate(${textPos})`;
        })
        .attr("text-anchor", d => midAngle(d) < 0 ? "end" : "start")
        .attr("dominant-baseline", "middle")
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .attr("fill", fillStyle.textColor)
        .text(d => {
            const percentage = (d.data.percentage * 100).toFixed(1) + '%';
            return `${d.data[categoryFieldName]}: ${percentage}`;
        });

    // Block 9: Optional Enhancements & Post-Processing (e.g., Annotations, Icons, Interactive Elements)
    // No optional enhancements in this simplified version.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
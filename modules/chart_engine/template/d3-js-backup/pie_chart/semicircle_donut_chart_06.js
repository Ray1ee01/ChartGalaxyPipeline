/* REQUIREMENTS_BEGIN
{
  "chart_type": "Semicircle Donut Chart",
  "chart_name": "semicircle_donut_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y"],
  "hierarchy": [],
  "required_fields_type": [["categorical"], ["numerical"]],
  "required_fields_range": [[2, 20], [0, "inf"]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["x"],
  "required_other_colors": [],
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
  "valueSortDirection": "none",
  "iconographyUsage": "categorical_markers_overlay_internal"
}
REQUIREMENTS_END */



// Block 0: Metadata & Other Function-Level Comments (The /* REQUIREMENTS_BEGIN... */ block is now external to the function)

function makeChart(containerSelector, data) {
    // Block 1: Configuration Parsing & Validation
    d3.select(containerSelector).html(""); // Clear previous contents

    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || data.colors_dark || {}; // Assuming dark theme might be passed similarly
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    const categoryFieldDef = dataColumns.find(col => col.role === "x");
    const valueFieldDef = dataColumns.find(col => col.role === "y");

    if (!categoryFieldDef || !valueFieldDef) {
        const missing = [];
        if (!categoryFieldDef) missing.push("x-role column");
        if (!valueFieldDef) missing.push("y-role column");
        const errorMsg = `Critical chart config missing: ${missing.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).append("div")
            .style("color", "red")
            .style("font-family", "Arial, sans-serif")
            .style("padding", "20px")
            .html(errorMsg);
        return null;
    }

    const categoryFieldName = categoryFieldDef.name;
    const valueFieldName = valueFieldDef.name;

    const chartDataArray = chartDataInput.filter(d => d[valueFieldName] != null && d[valueFieldName] > 0);

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data to render the chart after filtering.";
        console.error(errorMsg);
         d3.select(containerSelector).append("div")
            .style("color", "orange")
            .style("font-family", "Arial, sans-serif")
            .style("padding", "20px")
            .html(errorMsg);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        textColor: colorsConfig.text_color || '#0f223b',
        chartBackground: colorsConfig.background_color || '#FFFFFF',
        segmentStrokeColor: '#FFFFFF', // For separation between segments
        defaultSegmentColor: (colorsConfig.other && colorsConfig.other.primary) || '#4682B4',
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || 'normal',
            labelValueFontWeight: 'bold', // Percentages are typically emphasized
        }
    };

    const d3CategoryColors = d3.schemeCategory10;
    fillStyle.getSegmentColor = (category, index) => {
        if (colorsConfig.field && colorsConfig.field[category]) {
            return colorsConfig.field[category];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
        }
        return d3CategoryColors[index % d3CategoryColors.length];
    };

    fillStyle.getIconUrl = (category) => {
        if (imagesConfig.field && imagesConfig.field[category]) {
            return imagesConfig.field[category];
        }
        if (imagesConfig.other && imagesConfig.other.primary) {
            return imagesConfig.other.primary; // Fallback to a generic primary icon if specified
        }
        return null;
    };
    
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.setAttribute('font-family', fontFamily);
        tempText.setAttribute('font-size', fontSize);
        tempText.setAttribute('font-weight', fontWeight);
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        // Document append/remove is not strictly necessary for getBBox if SVG is fully defined,
        // but some browsers might need it for full style computation.
        // For this helper, direct measurement without DOM append is preferred.
        // document.body.appendChild(tempSvg); 
        const width = tempText.getBBox().width;
        // document.body.removeChild(tempSvg);
        return width;
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: variables.margin_top || 60, right: variables.margin_right || 60, bottom: variables.margin_bottom || 40, left: variables.margin_left || 60 };
    const chartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const outerRadius = Math.min(chartWidth / 2, chartHeight); // For upper semicircle, height is more critical
    const innerRadiusRatio = variables.innerRadiusRatio || 0.5; // e.g. 0.5 means donut hole is 50% of outerRadius
    const innerRadiusValue = outerRadius * innerRadiusRatio;
    
    const fixedIconSize = variables.iconSize || Math.min(30, (outerRadius - innerRadiusValue) * 0.6);


    // Center of the semicircle's base
    const centerX = containerWidth / 2;
    const centerY = chartMargins.top + outerRadius; // Base of the upper semicircle aligns with this Y

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${centerX}, ${centerY})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const totalValue = d3.sum(chartDataArray, d => d[valueFieldName]);
    const chartDataWithPercentages = chartDataArray.map(d => ({
        ...d,
        percentage: totalValue > 0 ? (d[valueFieldName] / totalValue) * 100 : 0
    }));

    // Block 6: Scale Definition & Configuration (d3.pie, d3.arc)
    const pieGenerator = d3.pie()
        .value(d => d[valueFieldName])
        .sort(null) // Keep original data order
        .startAngle(-Math.PI / 2) // West (9 o'clock)
        .endAngle(Math.PI / 2);   // East (3 o'clock) - for an upper semicircle

    const arcGenerator = d3.arc()
        .innerRadius(innerRadiusValue)
        .outerRadius(outerRadius)
        .padAngle(variables.padAngle || 0.01); // Small padding for segment separation

    const sectorsData = pieGenerator(chartDataWithPercentages);

    // Arc generator for icon centroids (middle of the segment's radial thickness)
    const iconArcCentroidGenerator = d3.arc()
        .innerRadius(innerRadiusValue + (outerRadius - innerRadiusValue) / 2)
        .outerRadius(innerRadiusValue + (outerRadius - innerRadiusValue) / 2);

    // Block 7: Chart Component Rendering (No Axes, Gridlines, Legend for this chart)
    // (This chart type does not typically have axes or gridlines)
    // (Legend removed as per requirements)

    // Block 8: Main Data Visualization Rendering
    const sectorGroups = mainChartGroup.selectAll(".sector-group")
        .data(sectorsData)
        .enter()
        .append("g")
        .attr("class", "sector-group");

    sectorGroups.append("path")
        .attr("class", "mark sector-path")
        .attr("d", arcGenerator)
        .attr("fill", (d, i) => fillStyle.getSegmentColor(d.data[categoryFieldName], i))
        .attr("stroke", fillStyle.segmentStrokeColor)
        .attr("stroke-width", 2);

    // Render icons on sectors
    sectorGroups.each(function(d, i) {
        const group = d3.select(this);
        const iconUrl = fillStyle.getIconUrl(d.data[categoryFieldName]);
        
        if (iconUrl) {
            const [iconX, iconY] = iconArcCentroidGenerator.centroid(d);

            // White background circle for icon contrast
            group.append("circle")
                .attr("class", "icon-background other")
                .attr("cx", iconX)
                .attr("cy", iconY)
                .attr("r", fixedIconSize / 2 + 2) // Slightly larger for padding
                .attr("fill", "white");

            group.append("image")
                .attr("class", "icon image")
                .attr("xlink:href", iconUrl)
                .attr("x", iconX - fixedIconSize / 2)
                .attr("y", iconY - fixedIconSize / 2)
                .attr("width", fixedIconSize)
                .attr("height", fixedIconSize);
        }
    });
    
    // Render labels outside sectors
    const labelOffset = variables.labelOffset || 20; // Distance from outer radius to label
    const labelRadius = outerRadius + labelOffset;

    sectorGroups.each(function(d) {
        const group = d3.select(this);
        const angle = (d.startAngle + d.endAngle) / 2; // Mid-angle of the sector

        // Label position: angle 0 is North (12 o'clock), positive is clockwise
        const labelX = Math.sin(angle) * labelRadius; // sin for X because 0 angle is North
        const labelY = -Math.cos(angle) * labelRadius; // -cos for Y

        let textAnchor;
        // Angle system: -PI/2 (West), 0 (North), PI/2 (East)
        if (angle < Math.PI / 12 && angle > -Math.PI / 12) { // Near North (top)
            textAnchor = "middle";
        } else if (angle >= Math.PI / 12) { // North-East to East
            textAnchor = "start";
        } else { // North-West to West
            textAnchor = "end";
        }
        
        const categoryText = d.data[categoryFieldName];
        const percentageText = `${d.data.percentage.toFixed(1)}%`;

        // Category Name Label
        group.append("text")
            .attr("class", "label text category-label")
            .attr("x", labelX)
            .attr("y", labelY - (parseFloat(fillStyle.typography.labelFontSize) / 2)) // Position above value
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(categoryText);

        // Percentage Value Label
        group.append("text")
            .attr("class", "label text value-label")
            .attr("x", labelX)
            .attr("y", labelY + (parseFloat(fillStyle.typography.labelFontSize) / 2) + 4) // Position below category, +4 for spacing
            .attr("text-anchor", textAnchor)
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelValueFontWeight) // Value often bold
            .style("fill", fillStyle.textColor)
            .text(percentageText);
    });


    // Block 9: Optional Enhancements & Post-Processing
    // (No main title, no complex effects as per requirements)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
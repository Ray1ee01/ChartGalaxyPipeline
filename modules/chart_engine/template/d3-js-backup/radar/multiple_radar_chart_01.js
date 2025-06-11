/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Radar Chart",
  "chart_name": "multiple_radar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[3, 7], [0, "inf"], [1, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
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
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {}; // or data.colors_dark
    // const imagesInput = data.images || {}; // Not used in this chart type
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldCol = dataColumns.find(col => col.role === 'x');
    const valueFieldCol = dataColumns.find(col => col.role === 'y');
    const groupFieldCol = dataColumns.find(col => col.role === 'group');

    const categoryFieldName = categoryFieldCol ? categoryFieldCol.name : undefined;
    const valueFieldName = valueFieldCol ? valueFieldCol.name : undefined;
    const groupFieldName = groupFieldCol ? groupFieldCol.name : undefined;

    const missingFieldMessages = [];
    if (!categoryFieldName) missingFieldMessages.push("Column with role 'x' (for category/axes)");
    if (!valueFieldName) missingFieldMessages.push("Column with role 'y' (for value)");
    if (!groupFieldName) missingFieldMessages.push("Column with role 'group' (for series grouping)");

    if (missingFieldMessages.length > 0) {
        const errorMsg = `Critical chart configuration missing: ${missingFieldMessages.join(', ')}. Cannot render chart.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family:sans-serif; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const chartDataArray = chartDataInput;

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        chartBackground: colorsInput.background_color || "none",
        textColor: colorsInput.text_color || "#333333",
        gridLineColor: (colorsInput.other && colorsInput.other.grid) || "#BBBBBB",
        axisLineColor: (colorsInput.other && colorsInput.other.axis) || "#BBBBBB",
        pointStrokeColor: (colorsInput.other && colorsInput.other.point_stroke) || "#FFFFFF",
        defaultRadarFillOpacity: variables.radar_fill_opacity !== undefined ? variables.radar_fill_opacity : 0.2,
        defaultRadarStrokeWidth: variables.radar_stroke_width !== undefined ? variables.radar_stroke_width : 2,
        typography: {}
    };

    const defaultTypographyStyles = {
        categoryLabel: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "bold" },
        tickLabel: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" },
        legendLabel: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }
    };

    fillStyle.typography.categoryLabel = {
        font_family: (typographyInput.title && typographyInput.title.font_family) || defaultTypographyStyles.categoryLabel.font_family,
        font_size: (typographyInput.title && typographyInput.title.font_size) || defaultTypographyStyles.categoryLabel.font_size,
        font_weight: (typographyInput.title && typographyInput.title.font_weight) || defaultTypographyStyles.categoryLabel.font_weight,
    };
    fillStyle.typography.tickLabel = {
        font_family: (typographyInput.annotation && typographyInput.annotation.font_family) || defaultTypographyStyles.tickLabel.font_family,
        font_size: (typographyInput.annotation && typographyInput.annotation.font_size) || defaultTypographyStyles.tickLabel.font_size,
        font_weight: (typographyInput.annotation && typographyInput.annotation.font_weight) || defaultTypographyStyles.tickLabel.font_weight,
    };
    fillStyle.typography.legendLabel = {
        font_family: (typographyInput.label && typographyInput.label.font_family) || defaultTypographyStyles.legendLabel.font_family,
        font_size: (typographyInput.label && typographyInput.label.font_size) || defaultTypographyStyles.legendLabel.font_size,
        font_weight: (typographyInput.label && typographyInput.label.font_weight) || defaultTypographyStyles.legendLabel.font_weight,
    };
    
    fillStyle.categoryLabelColor = (typographyInput.title && typographyInput.title.color) || colorsInput.text_color || "#333333";
    fillStyle.tickLabelColor = (typographyInput.annotation && typographyInput.annotation.color) || (colorsInput.other && colorsInput.other.secondary_text) || "#666666";
    fillStyle.legendLabelColor = (typographyInput.label && typographyInput.label.color) || colorsInput.text_color || "#333333";


    const availableColors = colorsInput.available_colors || d3.schemeCategory10;
    const colorAccessor = (groupName, groupIndex) => {
        if (colorsInput.field && colorsInput.field[groupName]) {
            return colorsInput.field[groupName];
        }
        return availableColors[groupIndex % availableColors.length];
    };

    function estimateTextWidth(text, style = {}) {
        if (!text) return 0;
        const { fontFamily = 'sans-serif', fontSize = '12px', fontWeight = 'normal' } = style;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        let width = 0;
        try {
            width = textElement.getBBox().width;
        } catch (e) {
            // console.warn("Could not measure text width for:", text, e);
        }
        return width;
    }

    function layoutLegend(legendContainerGroup, legendData, groupColorAccessor, styleOptions) {
        const {
            itemSpacing = 10,
            shapeSize = 10,
            textOffset = 5,
            typography = fillStyle.typography.legendLabel,
            textColor = fillStyle.legendLabelColor
        } = styleOptions;

        legendContainerGroup.attr("class", "legend");
        let currentX = 0;
        let legendHeight = 0;

        legendData.forEach((itemText, index) => {
            const itemGroup = legendContainerGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, 0)`);

            itemGroup.append("rect")
                .attr("class", "legend-swatch mark")
                .attr("width", shapeSize)
                .attr("height", shapeSize)
                .attr("fill", groupColorAccessor(itemText, index));

            itemGroup.append("text")
                .attr("class", "label legend-label")
                .attr("x", shapeSize + textOffset)
                .attr("y", shapeSize / 2)
                .attr("dy", "0.35em")
                .style("font-family", typography.font_family)
                .style("font-size", typography.font_size)
                .style("font-weight", typography.font_weight)
                .style("fill", textColor)
                .text(itemText);
            
            const textWidth = estimateTextWidth(itemText, typography);
            currentX += shapeSize + textOffset + textWidth + itemSpacing;
            const itemHeight = Math.max(shapeSize, parseFloat(typography.font_size) * 1.2);
            if (itemHeight > legendHeight) legendHeight = itemHeight;
        });
        
        const finalWidth = Math.max(0, currentX - itemSpacing);
        return { width: finalWidth, height: legendHeight };
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg multiple-radar-chart")
        .style("background-color", fillStyle.chartBackground === "none" ? "transparent" : fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || Math.max(60, containerHeight * 0.1), 
        right: variables.margin_right || Math.max(50, containerWidth * 0.1), 
        bottom: variables.margin_bottom || Math.max(50, containerHeight * 0.1), 
        left: variables.margin_left || Math.max(50, containerWidth * 0.1)
    };

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-content")
        .attr("transform", `translate(${chartMargins.left + innerWidth / 2}, ${chartMargins.top + innerHeight / 2})`);

    const radius = Math.min(innerWidth, innerHeight) / 2 * 0.9; // 0.9 factor to give labels space

    // Block 5: Data Preprocessing & Transformation
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    if (chartDataArray.length === 0) {
        // console.warn("Chart data is empty. Rendering an empty chart area.");
        // An empty chart will be drawn, which is acceptable.
    } else if (categories.length < 3) {
         console.warn(`Radar chart requires at least 3 categories (axes). Found ${categories.length}. Chart may not render as expected.`);
         // Allow to proceed, may result in a degenerate chart.
    }

    const groupAvgs = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartDataArray.filter(d_filter => d_filter[groupFieldName] === group), d_mean => d_mean[valueFieldName]) || 0
        }))
        .sort((a, b) => b.avg - a.avg);
    
    const groups = groupAvgs.map(d => d.group);

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / (categories.length || 1))]); // Avoid division by zero if categories is empty

    const allValues = chartDataArray.map(d => d[valueFieldName]).filter(v => typeof v === 'number' && !isNaN(v));
    const minValueForScale = 0; 
    const maxValueForScale = allValues.length > 0 ? d3.max(allValues) : (categories.length > 0 ? 1 : 0); // Default max to 1 if data, else 0

    const radiusScale = d3.scaleLinear()
        .domain([minValueForScale, maxValueForScale])
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    if (categories.length > 0) {
        const ticks = radiusScale.ticks(5).filter(t => t >= minValueForScale && t <= radiusScale.domain()[1]);

        mainChartGroup.append("g").attr("class", "axis grid circular-grid")
            .selectAll(".circular-grid-line")
            .data(ticks)
            .enter()
            .append("circle")
            .attr("class", "grid-line circular-grid-line")
            .attr("r", d => radiusScale(d))
            .attr("fill", "none")
            .attr("stroke", fillStyle.gridLineColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "4,4");

        const radialAxesGroup = mainChartGroup.append("g").attr("class", "axis grid radial-grid");
        radialAxesGroup.selectAll(".radial-grid-line")
            .data(categories)
            .enter()
            .append("line")
            .attr("class", "grid-line radial-grid-line")
            .attr("x1", 0).attr("y1", 0)
            .attr("x2", (d, i) => radiusScale(maxValueForScale) * Math.cos(angleScale(d) - Math.PI / 2))
            .attr("y2", (d, i) => radiusScale(maxValueForScale) * Math.sin(angleScale(d) - Math.PI / 2))
            .attr("stroke", fillStyle.axisLineColor)
            .attr("stroke-width", 1);

        const categoryLabelsGroup = mainChartGroup.append("g").attr("class", "labels category-labels");
        categoryLabelsGroup.selectAll(".category-label")
            .data(categories)
            .enter()
            .append("text")
            .attr("class", "label category-label")
            .attr("x", d => (radiusScale(maxValueForScale) + 15) * Math.cos(angleScale(d) - Math.PI / 2))
            .attr("y", d => (radiusScale(maxValueForScale) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
            .style("font-family", fillStyle.typography.categoryLabel.font_family)
            .style("font-size", fillStyle.typography.categoryLabel.font_size)
            .style("font-weight", fillStyle.typography.categoryLabel.font_weight)
            .style("fill", fillStyle.categoryLabelColor)
            .text(d => d)
            .attr("text-anchor", d => {
                const adjustedAngle = (angleScale(d) - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI); // Ensure positive
                if (Math.abs(adjustedAngle - 0) < 0.01 || Math.abs(adjustedAngle - Math.PI) < 0.01) return "middle";
                return adjustedAngle > Math.PI ? "end" : "start";
            })
            .attr("dominant-baseline", d => {
                const adjustedAngle = (angleScale(d) - Math.PI / 2 + 4 * Math.PI) % (2 * Math.PI);
                if (Math.abs(adjustedAngle - Math.PI / 2) < 0.01 || Math.abs(adjustedAngle - 3 * Math.PI / 2) < 0.01) return "middle";
                return (adjustedAngle > Math.PI / 2 && adjustedAngle < 3 * Math.PI / 2) ? "auto" : "hanging";
            });

        const tickLabelsGroup = mainChartGroup.append("g").attr("class", "labels tick-labels");
        tickLabelsGroup.selectAll(".tick-label")
            .data(ticks.filter(t => t > minValueForScale))
            .enter()
            .append("text")
            .attr("class", "label tick-label")
            .attr("x", 5)
            .attr("y", d => -radiusScale(d))
            .style("font-family", fillStyle.typography.tickLabel.font_family)
            .style("font-size", fillStyle.typography.tickLabel.font_size)
            .style("font-weight", fillStyle.typography.tickLabel.font_weight)
            .style("fill", fillStyle.tickLabelColor)
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "middle")
            .text(d => d);
    }

    if (groups.length > 0) {
        const legendGroup = svgRoot.append("g");
        const legendSize = layoutLegend(legendGroup, groups, colorAccessor, {});
        
        let legendX = chartMargins.left + (innerWidth - legendSize.width) / 2;
        let legendY = chartMargins.top / 2 - legendSize.height / 2;
        legendX = Math.max(10, legendX); // Ensure legend is not off-screen
        legendY = Math.max(10, legendY); // Ensure legend is not off-screen
        legendGroup.attr("transform", `translate(${legendX}, ${legendY})`);
    }

    // Block 8: Main Data Visualization Rendering
    if (categories.length >= 3 && groups.length > 0) { // Ensure enough categories for a polygon
        const lineGenerator = d3.lineRadial()
            .angle(d => angleScale(d[categoryFieldName]) - Math.PI / 2)
            .radius(d => radiusScale(d[valueFieldName]))
            .defined(d => typeof d[valueFieldName] === 'number' && !isNaN(d[valueFieldName]))
            .curve(d3.curveLinearClosed);

        const radarSeriesGroup = mainChartGroup.append("g").attr("class", "series-group");

        groups.forEach((groupName, groupIndex) => {
            const groupSeries = radarSeriesGroup.append("g").attr("class", `series series-${groupName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '')}`);
            
            const currentGroupData = chartDataArray.filter(d => d[groupFieldName] === groupName);
            const orderedGroupPathData = categories.map(cat => {
                const point = currentGroupData.find(d => d[categoryFieldName] === cat);
                return point && typeof point[valueFieldName] === 'number' && !isNaN(point[valueFieldName]) ? 
                       point : 
                       { [categoryFieldName]: cat, [valueFieldName]: minValueForScale };
            });

            groupSeries.append("path")
                .datum(orderedGroupPathData)
                .attr("class", "mark radar-area")
                .attr("d", lineGenerator)
                .attr("fill", colorAccessor(groupName, groupIndex))
                .attr("fill-opacity", fillStyle.defaultRadarFillOpacity)
                .attr("stroke", colorAccessor(groupName, groupIndex))
                .attr("stroke-width", fillStyle.defaultRadarStrokeWidth)
                .attr("stroke-linejoin", "miter");

            const pointsGroup = groupSeries.append("g").attr("class", "radar-points");
            orderedGroupPathData.forEach(pointData => {
                if (typeof pointData[valueFieldName] === 'number' && !isNaN(pointData[valueFieldName]) && pointData[valueFieldName] >= minValueForScale) {
                    const angle = angleScale(pointData[categoryFieldName]) - Math.PI / 2;
                    const r = radiusScale(pointData[valueFieldName]);
                    
                    if (r >= 0) { // Only draw if radius is non-negative (it should be with scale starting at 0)
                        pointsGroup.append("circle")
                            .attr("class", "mark radar-point")
                            .attr("cx", r * Math.cos(angle))
                            .attr("cy", r * Math.sin(angle))
                            .attr("r", variables.point_radius || 4)
                            .attr("fill", colorAccessor(groupName, groupIndex))
                            .attr("stroke", fillStyle.pointStrokeColor)
                            .attr("stroke-width", variables.point_stroke_width || 1);
                    }
                }
            });
        });
    }

    // Block 9: Optional Enhancements & Post-Processing
    // (Not applicable for this chart based on original features)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
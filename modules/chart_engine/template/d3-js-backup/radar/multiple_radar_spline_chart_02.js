/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Radar Spline Chart",
  "chart_name": "multiple_radar_spline_chart_02",
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
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "subtle",
  "legend": "normal",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const chartDataArray = data.data?.data || [];
    const dataColumns = data.data?.columns || [];
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || {}; // Using dark theme colors as per original
    // const imagesConfig = data.images || {}; // Not used in this chart

    d3.select(containerSelector).html(""); // Clear container

    const categoryFieldName = dataColumns.find(col => col.role === 'x')?.name;
    const valueFieldName = dataColumns.find(col => col.role === 'y')?.name;
    const groupFieldName = dataColumns.find(col => col.role === 'group')?.name;

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push("x role (category)");
        if (!valueFieldName) missingFields.push("y role (value)");
        if (!groupFieldName) missingFields.push("group role");
        
        const errorMsg = `Critical chart config missing: Field name(s) for ${missingFields.join(', ')} not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif;'>${errorMsg}</div>`);
        }
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {};
    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" },
        annotation: { font_family: "Arial, sans-serif", font_size: "10px", font_weight: "normal" }
    };

    fillStyle.typography = {
        labelFontFamily: typographyConfig.label?.font_family || defaultTypography.label.font_family,
        labelFontSize: typographyConfig.label?.font_size || defaultTypography.label.font_size,
        labelFontWeight: typographyConfig.label?.font_weight || defaultTypography.label.font_weight,
        // Add other typography styles if needed (e.g., title, annotation)
    };
    
    const defaultColorsDark = {
        field: {},
        other: { primary: "#5294E2", secondary: "#cccccc" },
        available_colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"], // d3.schemeCategory10 or Tableau10
        background_color: "#1E1E1E",
        text_color: "#E0E0E0"
    };

    fillStyle.backgroundColor = colorsConfig.background_color || defaultColorsDark.background_color;
    fillStyle.textColor = colorsConfig.text_color || defaultColorsDark.text_color;
    fillStyle.axisLabelColor = fillStyle.textColor;
    fillStyle.gridLineColor = (colorsConfig.other && colorsConfig.other.secondary) || "#444444"; // Subtle grid for dark bg
    fillStyle.pointBorderColor = "#FFFFFF"; // For contrast on points, typically white on dark themes

    fillStyle.getGroupColor = (groupName, groupIndex) => {
        if (colorsConfig.field && colorsConfig.field[groupFieldName] && colorsConfig.field[groupFieldName][groupName]) {
            return colorsConfig.field[groupFieldName][groupName];
        }
        if (colorsConfig.field && colorsConfig.field[groupName]) { // Fallback to direct groupName key in colors.field
             return colorsConfig.field[groupName];
        }
        const availableColors = colorsConfig.available_colors || defaultColorsDark.available_colors;
        return availableColors[groupIndex % availableColors.length];
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        if (!text) return 0;
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // document.body.appendChild(tempSvg); // Temporarily append to measure accurately
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox might fail on non-rendered elements
            return (text || '').length * (parseInt(fontSize, 10) * 0.6);
        } finally {
            // if (tempSvg.parentNode === document.body) document.body.removeChild(tempSvg);
        }
    }

    function layoutLegendHelper(legendContainerElement, legendItemNames, fillStyleRef, textEstimator, options) {
        const { itemSpacing = 10, shapeSize = 10, shapePadding = 5, verticalSpacing = 5 } = options;
        let currentX = 0;
        let currentY = 0; // For multi-line, not implemented here simply
        let maxWidth = 0;
        const legendHeight = parseInt(fillStyleRef.typography.labelFontSize, 10) + verticalSpacing;


        legendItemNames.forEach((itemText, index) => {
            const itemGroup = legendContainerElement.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            itemGroup.append("circle")
                .attr("class", "mark legend-shape")
                .attr("cx", shapeSize / 2)
                .attr("cy", shapeSize / 2 - (parseInt(fillStyleRef.typography.labelFontSize, 10)/8) ) // Align with text better
                .attr("r", shapeSize / 2)
                .attr("fill", fillStyleRef.getGroupColor(itemText, index));

            const textWidth = textEstimator(
                itemText,
                fillStyleRef.typography.labelFontFamily,
                fillStyleRef.typography.labelFontSize,
                fillStyleRef.typography.labelFontWeight
            );

            itemGroup.append("text")
                .attr("class", "label legend-text")
                .attr("x", shapeSize + shapePadding)
                .attr("y", shapeSize / 2 + (parseInt(fillStyleRef.typography.labelFontSize, 10)/4)) // Vertical alignment
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyleRef.textColor)
                .style("font-family", fillStyleRef.typography.labelFontFamily)
                .style("font-size", fillStyleRef.typography.labelFontSize)
                .style("font-weight", fillStyleRef.typography.labelFontWeight)
                .text(itemText);
            
            const itemWidth = shapeSize + shapePadding + textWidth;
            currentX += itemWidth + itemSpacing;
            maxWidth = Math.max(maxWidth, currentX - itemSpacing); // currentX includes the last itemSpacing
        });
        return { width: maxWidth, height: legendHeight };
    }


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = parseFloat(chartConfig.width) || 800;
    const containerHeight = parseFloat(chartConfig.height) || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.backgroundColor);
    
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-render-group") // Changed class name
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 50, right: 50, bottom: 50, left: 50 }; // As per original, fixed
    const effectiveChartWidth = containerWidth - chartMargins.left - chartMargins.right;
    const effectiveChartHeight = containerHeight - chartMargins.top - chartMargins.bottom;
    const radius = Math.min(effectiveChartWidth, effectiveChartHeight) / 2;

    // Block 5: Data Preprocessing & Transformation
    if (chartDataArray.length === 0) {
        console.warn("Chart data is empty. Rendering placeholder.");
         mainChartGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("fill", fillStyle.textColor)
            .text("No data available to display chart.");
        return svgRoot.node();
    }
    
    const categories = [...new Set(chartDataArray.map(d => d[categoryFieldName]))];
    
    const groupAvgs = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .map(group => ({
            group,
            avg: d3.mean(chartDataArray.filter(d => d[groupFieldName] === group), d => d[valueFieldName]) || 0
        }))
        .sort((a, b) => b.avg - a.avg); // Descending sort
    
    const sortedGroupNames = groupAvgs.map(d => d.group);
    const groupedData = d3.group(chartDataArray, d => d[groupFieldName]);

    // Block 6: Scale Definition & Configuration
    const angleScale = d3.scalePoint()
        .domain(categories)
        .range([0, 2 * Math.PI - (2 * Math.PI / categories.length)]); // Ensure distinct points

    const allValues = chartDataArray.map(d => d[valueFieldName]).filter(v => typeof v === 'number' && !isNaN(v));
    const minValue = Math.min(0, d3.min(allValues) || 0); // Ensure 0 is included, handle empty allValues
    const maxValue = d3.max(allValues) || 0; // Handle empty allValues

    const radiusScale = d3.scaleLinear()
        .domain([minValue, maxValue === minValue ? minValue + 1 : maxValue * 1.1]) // Adjust domain if min=max, add headroom
        .range([0, radius])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend)
    const ticks = radiusScale.ticks(5);

    mainChartGroup.selectAll(".grid-circle")
        .data(ticks)
        .enter()
        .append("circle")
        .attr("class", "grid-line circular")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", d => radiusScale(d))
        .attr("fill", "none")
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4,4");

    mainChartGroup.selectAll(".axis-line")
        .data(categories)
        .enter()
        .append("line")
        .attr("class", "axis radial-axis-line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", d => radiusScale(maxValue * 1.1) * Math.cos(angleScale(d) - Math.PI / 2)) // Extend to max radius
        .attr("y2", d => radiusScale(maxValue * 1.1) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", 1);

    mainChartGroup.selectAll(".category-label")
        .data(categories)
        .enter()
        .append("text")
        .attr("class", "label category-label")
        .attr("x", d => (radiusScale(maxValue * 1.1) + 15) * Math.cos(angleScale(d) - Math.PI / 2)) // Position beyond max radius
        .attr("y", d => (radiusScale(maxValue * 1.1) + 15) * Math.sin(angleScale(d) - Math.PI / 2))
        .attr("text-anchor", d => {
            const angle = angleScale(d);
            if (Math.abs(angle % (2 * Math.PI)) < 0.01 || Math.abs(angle % (2 * Math.PI) - Math.PI) < 0.01) return "middle";
            return (angle % (2 * Math.PI)) > Math.PI ? "end" : "start";
        })
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.axisLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", fillStyle.typography.labelFontSize)
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    mainChartGroup.selectAll(".tick-label")
        .data(ticks.filter(t => t !== 0)) // Don't label 0 at center usually
        .enter()
        .append("text")
        .attr("class", "label tick-label")
        .attr("x", 5)
        .attr("y", d => -radiusScale(d))
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", fillStyle.axisLabelColor)
        .style("font-family", fillStyle.typography.labelFontFamily)
        .style("font-size", parseInt(fillStyle.typography.labelFontSize, 10) * 0.9 + "px") // Slightly smaller
        .style("font-weight", fillStyle.typography.labelFontWeight)
        .text(d => d);

    const legendGroup = svgRoot.append("g").attr("class", "legend");
    const legendOptions = { itemSpacing: 15, shapeSize: 10, shapePadding: 5 };
    const legendSize = layoutLegendHelper(legendGroup, sortedGroupNames, fillStyle, estimateTextWidth, legendOptions);
    
    const legendX = (containerWidth - legendSize.width) / 2;
    const legendY = chartMargins.top / 2 - legendSize.height / 2; // Center in top margin
    legendGroup.attr("transform", `translate(${legendX}, ${Math.max(legendY, 5)})`); // Ensure not too high


    // Block 8: Main Data Visualization Rendering
    const lineGenerator = (dataForGroup) => {
        const points = categories.map(cat => {
            const pointData = dataForGroup.find(item => item[categoryFieldName] === cat);
            if (pointData) {
                const angle = angleScale(cat) - Math.PI / 2; // Adjust for top start
                const distance = radiusScale(pointData[valueFieldName]);
                return [distance * Math.cos(angle), distance * Math.sin(angle)];
            }
            return [0, 0]; // Default to center if data missing for a category
        });
        return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(points);
    };

    groupedData.forEach((values, groupKey) => {
        const groupIndex = sortedGroupNames.indexOf(groupKey);
        const groupColor = fillStyle.getGroupColor(groupKey, groupIndex);
        const sanitizedGroupKey = String(groupKey).replace(/[^a-zA-Z0-9-_]/g, '_');

        mainChartGroup.append("path")
            .datum(values)
            .attr("class", `mark radar-line series-${sanitizedGroupKey}`)
            .attr("d", lineGenerator)
            .attr("fill", "none") // Original had fill-opacity: 0, so effectively no fill
            .attr("stroke", groupColor)
            .attr("stroke-width", 3); // Original was 4

        categories.forEach(cat => {
            const pointData = values.find(item => item[categoryFieldName] === cat);
            if (pointData) {
                const angle = angleScale(cat) - Math.PI / 2;
                const distance = radiusScale(pointData[valueFieldName]);
                
                mainChartGroup.append("circle")
                    .attr("class", `mark radar-point series-${sanitizedGroupKey} category-${String(cat).replace(/[^a-zA-Z0-9-_]/g, '_')}`)
                    .attr("cx", distance * Math.cos(angle))
                    .attr("cy", distance * Math.sin(angle))
                    .attr("r", 4) // Original was 6
                    .attr("fill", groupColor)
                    .attr("stroke", fillStyle.pointBorderColor) // Contrast border
                    .attr("stroke-width", 1.5); // Original was 2
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this refactoring)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
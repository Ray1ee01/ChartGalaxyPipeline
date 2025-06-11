/* REQUIREMENTS_BEGIN
{
  "chart_type": "Small Multiples of Radial Spline Charts",
  "chart_name": "small_multiple_radial_spline_plain_chart_01",
  "is_composite": false,
  "required_fields": ["group", "x", "y"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["categorical"], ["numerical"]],
  "required_fields_range": [[2, 7], [3, 12], [0, "inf"]],
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
  "gridLineType": "subtle",
  "legend": "normal",
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
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {}; // Assuming light theme if not specified
    const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;
    const categoryFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;

    const criticalFields = {};
    if (!groupFieldName) criticalFields["Group Field (role='group')"] = "undefined";
    if (!categoryFieldName) criticalFields["Category Field (role='x')"] = "undefined";
    if (!valueFieldName) criticalFields["Value Field (role='y')"] = "undefined";

    if (Object.keys(criticalFields).length > 0) {
        const missingFieldsMsg = Object.entries(criticalFields)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        console.error(`Critical chart config missing: ${missingFieldsMsg}. Cannot render.`);
        d3.select(containerSelector).html(
            `<div style='color:red; font-family: sans-serif; padding: 10px;'>Error: Critical chart configuration missing. Required field roles (group, x, y) not found in data columns. ${missingFieldsMsg}</div>`
        );
        return null;
    }
    
    // Filter out data points with missing critical fields
    const chartData = rawChartData.filter(d => 
        d[groupFieldName] !== undefined && 
        d[categoryFieldName] !== undefined && 
        d[valueFieldName] !== undefined &&
        d[valueFieldName] !== null // Ensure value is not null
    );

    if (chartData.length === 0 && rawChartData.length > 0) {
        console.warn("All data points were filtered out due to missing critical fields or null values. Rendering an empty chart or an error message.");
         d3.select(containerSelector).html(
            `<div style='color:orange; font-family: sans-serif; padding: 10px;'>Warning: No valid data to display after filtering. Please check data integrity.</div>`
        );
        return null;
    }
     if (chartData.length === 0) {
        console.warn("No data provided to render the chart.");
         d3.select(containerSelector).html(
            `<div style='color:orange; font-family: sans-serif; padding: 10px;'>Warning: No data provided to render the chart.</div>`
        );
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            title: { // Not used for main title, but could be for other prominent text
                fontFamily: rawTypography.title?.font_family || 'Arial, sans-serif',
                fontSize: rawTypography.title?.font_size || '18px',
                fontWeight: rawTypography.title?.font_weight || 'bold',
            },
            label: { // For axis labels, legend text, group titles
                fontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
                fontSize: rawTypography.label?.font_size || '14px',
                fontWeight: rawTypography.label?.font_weight || 'normal',
            },
            annotation: { // For data value labels
                fontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
                fontSize: rawTypography.annotation?.font_size || '12px',
                fontWeight: rawTypography.annotation?.font_weight || 'normal',
            }
        },
        textColor: rawColors.text_color || '#333333',
        primaryPlotColor: rawColors.other?.primary || '#1f77b4',
        gridLineColor: rawColors.other?.grid || d3.color(rawColors.text_color || '#CCCCCC').copy({opacity: 0.3}).toString(),
        backgroundColor: rawColors.background_color || '#FFFFFF', // Not directly used on SVG background
        categoryColor: (categoryValue, index) => {
            if (rawColors.field && rawColors.field[categoryFieldName] && rawColors.field[categoryFieldName][categoryValue]) {
                return rawColors.field[categoryFieldName][categoryValue];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[index % rawColors.available_colors.length];
            }
            return d3.schemeCategory10[index % 10];
        }
    };

    const estimateTextWidth = (text, fontStyle) => {
        const svgNS = "http://www.w3.org/2000/svg";
        const tempSvg = document.createElementNS(svgNS, "svg");
        const tempText = document.createElementNS(svgNS, "text");
        tempText.setAttributeNS(null, "font-family", fontStyle.fontFamily);
        tempText.setAttributeNS(null, "font-size", fontStyle.fontSize);
        if (fontStyle.fontWeight) {
            tempText.setAttributeNS(null, "font-weight", fontStyle.fontWeight);
        }
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        let width = 0;
        try {
            width = tempText.getBBox().width;
        } catch (e) {
            console.warn("estimateTextWidth: getBBox failed on unattached SVG. Using approximate measurement.", e);
            width = text.length * (parseFloat(fontStyle.fontSize) || 10) * 0.6; // Basic fallback
        }
        return width;
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-root-svg")
        .style("background-color", fillStyle.backgroundColor); // Optional: set background on SVG

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 120, right: 50, bottom: 80, left: 50 }; // Initial top, will be adjusted by legend

    // Block 5: Data Preprocessing & Transformation
    let groups = [...new Set(chartData.map(d => d[groupFieldName]))];
    if (groups.length > 6) groups = groups.slice(0, 6); // Limit groups

    const groupedData = {};
    const groupMaxValues = {};
    groups.forEach(group => {
        groupedData[group] = chartData.filter(d => d[groupFieldName] === group);
        groupMaxValues[group] = d3.max(groupedData[group], d => +d[valueFieldName]);
    });

    const sortedGroups = [...groups].sort((a, b) => groupMaxValues[b] - groupMaxValues[a]);
    const allValues = chartData.map(d => +d[valueFieldName]);
    const maxValue = d3.max(allValues) || 0; // Ensure maxValue is not undefined

    let allCategories = [];
    groups.forEach(group => {
        const categoriesInGroup = groupedData[group].map(d => d[categoryFieldName]);
        allCategories = [...allCategories, ...categoriesInGroup];
    });
    allCategories = [...new Set(allCategories)].sort(); // Sort categories for consistent angle assignment

    if (allCategories.length === 0) {
        console.warn("No categories found in the data. Cannot render radial charts.");
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-family", fillStyle.typography.label.fontFamily)
            .attr("font-size", fillStyle.typography.label.fontSize)
            .attr("fill", fillStyle.textColor)
            .text("No category data available to render charts.");
        return svgRoot.node();
    }


    // Block 6: Scale Definition & Configuration
    const categoryColorScale = d3.scaleOrdinal()
        .domain(allCategories)
        .range(allCategories.map((cat, i) => fillStyle.categoryColor(cat, i)));

    const angleScale = d3.scalePoint()
        .domain(allCategories)
        .range([0, 2 * Math.PI - (2 * Math.PI / allCategories.length)]); // Ensure categories don't overlap at 0/2PI

    // Radius scale will be defined later, per small multiple, or globally if max values are similar.
    // For simplicity and consistency with original, using a global maxValue for radiusScale.
    const globalRadiusScale = d3.scaleLinear()
        .domain([0, Math.max(1, maxValue * 1.1)]) // Ensure domain is not [0,0]
        .range([0, 100]) // Placeholder, will be updated with actual radius
        .nice();


    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g").attr("class", "other legend-group");
    const legendConfig = {
        itemSpacing: 15, rowSpacing: 8, iconSize: 10, iconTextSpacing: 6,
        maxWidth: containerWidth - 100, // Max width for legend block
        xOffset: 50, yOffset: 20 // Initial position
    };
    
    const legendFont = {
        fontFamily: fillStyle.typography.label.fontFamily,
        fontSize: fillStyle.typography.label.fontSize, // Use label font size for legend
        fontWeight: fillStyle.typography.label.fontWeight
    };

    const legendItems = allCategories.map(cat => {
        return {
            label: cat,
            color: categoryColorScale(cat),
            width: legendConfig.iconSize + legendConfig.iconTextSpacing + estimateTextWidth(cat, legendFont)
        };
    });

    const legendRows = [];
    let currentLegendRow = [], currentLegendRowWidth = 0;
    legendItems.forEach(item => {
        const itemTotalWidth = item.width + (currentLegendRow.length > 0 ? legendConfig.itemSpacing : 0);
        if (currentLegendRow.length === 0 || (currentLegendRowWidth + itemTotalWidth) <= legendConfig.maxWidth) {
            currentLegendRow.push(item);
            currentLegendRowWidth += itemTotalWidth;
        } else {
            legendRows.push({ items: currentLegendRow, width: currentLegendRowWidth - legendConfig.itemSpacing }); // Adjust width
            currentLegendRow = [item];
            currentLegendRowWidth = item.width;
        }
    });
    if (currentLegendRow.length > 0) {
        legendRows.push({ items: currentLegendRow, width: currentLegendRowWidth });
    }
    
    const legendItemHeight = parseFloat(legendFont.fontSize);
    const totalLegendHeight = legendRows.length * legendItemHeight + Math.max(0, legendRows.length - 1) * legendConfig.rowSpacing;
    
    let currentLegendY = legendConfig.yOffset;
    legendRows.forEach(row => {
        const rowStartX = (containerWidth - row.width) / 2; // Center each row
        let currentLegendX = rowStartX;
        row.items.forEach(item => {
            const itemGroup = legendGroup.append("g")
                .attr("transform", `translate(${currentLegendX}, ${currentLegendY})`)
                .attr("class", "other legend-item");
            
            itemGroup.append("circle")
                .attr("cx", legendConfig.iconSize / 2)
                .attr("cy", legendItemHeight / 2 - legendConfig.iconSize / 4) // Adjust for better vertical alignment
                .attr("r", legendConfig.iconSize / 2)
                .attr("fill", item.color)
                .attr("class", "mark legend-mark");

            itemGroup.append("text")
                .attr("x", legendConfig.iconSize + legendConfig.iconTextSpacing)
                .attr("y", legendItemHeight / 2)
                .attr("dominant-baseline", "middle")
                .attr("fill", fillStyle.textColor)
                .style("font-family", legendFont.fontFamily)
                .style("font-size", legendFont.fontSize)
                .style("font-weight", legendFont.fontWeight)
                .attr("class", "label legend-label")
                .text(item.label);
            
            currentLegendX += item.width + legendConfig.itemSpacing;
        });
        currentLegendY += legendItemHeight + legendConfig.rowSpacing;
    });

    chartMargins.top = legendConfig.yOffset + totalLegendHeight + 30; // Update top margin

    // Recalculate chart area based on updated margins
    const chartAreaWidth = containerWidth - chartMargins.left - chartMargins.right;
    const chartAreaHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Small Multiples Layout
    const numCharts = sortedGroups.length;
    let layoutRows, layoutCols;
    if (numCharts <= 0) { // Should be caught by earlier checks, but defensive
        // No groups to display
    } else if (numCharts <= 3) {
        layoutRows = 1; layoutCols = numCharts;
    } else if (numCharts === 4) {
        layoutRows = 2; layoutCols = 2;
    } else { // numCharts 5 or 6 (max)
        layoutRows = 2; layoutCols = Math.ceil(numCharts / 2);
    }
    
    if (numCharts === 0) { // If somehow groups became empty after initial checks
        svgRoot.append("text").attr("x", containerWidth/2).attr("y", containerHeight/2).attr("text-anchor", "middle").text("No data groups to display.");
        return svgRoot.node();
    }

    const cellWidth = chartAreaWidth / layoutCols;
    const cellHeight = chartAreaHeight / layoutRows;

    const innerCellPaddingFactor = 0.15; // 15% padding within cell
    const plotRadius = Math.min(cellWidth * (1 - innerCellPaddingFactor), cellHeight * (1 - innerCellPaddingFactor)) / 2.2;
    globalRadiusScale.range([0, plotRadius]); // Update range with actual radius


    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Group title font size adjustment
    const groupTitleBaseFontSize = parseFloat(fillStyle.typography.label.fontSize);
    let maxGroupLabelWidth = 0;
    if (sortedGroups.length > 0) {
         maxGroupLabelWidth = d3.max(sortedGroups, g => estimateTextWidth(g, fillStyle.typography.label));
    }
    const maxAllowedTitleWidth = plotRadius * 2; // Title should not exceed plot diameter
    const groupTitleScaleFactor = maxGroupLabelWidth > maxAllowedTitleWidth ? maxAllowedTitleWidth / maxGroupLabelWidth : 1;
    const adjustedGroupTitleFontSize = `${Math.floor(groupTitleBaseFontSize * groupTitleScaleFactor)}px`;


    const createSplineGenerator = (currentGroupData) => {
        return () => {
            const points = allCategories.map(cat => {
                const pointData = currentGroupData.find(item => item[categoryFieldName] === cat);
                const value = pointData ? +pointData[valueFieldName] : 0;
                const angle = angleScale(cat) - Math.PI / 2; // Adjust for top start
                const distance = globalRadiusScale(value);
                return [distance * Math.cos(angle), distance * Math.sin(angle)];
            });
            // Close the path by adding the first point at the end if not using curveCardinalClosed
            // points.push(points[0]); // Not needed for curveCardinalClosed
            return d3.line().curve(d3.curveCardinalClosed.tension(0.5))(points);
        };
    };

    let groupIndex = 0;
    for (let r = 0; r < layoutRows; r++) {
        const numColsInThisRow = (r < layoutRows - 1 || numCharts % layoutCols === 0) ? layoutCols : numCharts % layoutCols;
        const rowHorizontalOffset = (chartAreaWidth - numColsInThisRow * cellWidth) / 2; // Center rows with fewer cols

        for (let c = 0; c < numColsInThisRow; c++) {
            if (groupIndex >= numCharts) break;

            const groupName = sortedGroups[groupIndex];
            const currentGroupData = groupedData[groupName];

            const cellCenterX = rowHorizontalOffset + (c + 0.5) * cellWidth;
            const cellCenterY = (r + 0.5) * cellHeight;

            const smallMultipleGroup = mainChartGroup.append("g")
                .attr("transform", `translate(${cellCenterX}, ${cellCenterY})`)
                .attr("class", "other small-multiple-group");

            // Render Circular Gridlines (Part of Block 7 conceptually, but rendered per small multiple)
            const gridTicks = globalRadiusScale.ticks(4).filter(t => t > 0); // Exclude 0 tick
            smallMultipleGroup.selectAll(".grid-circle")
                .data(gridTicks)
                .enter()
                .append("circle")
                .attr("class", "gridline")
                .attr("r", d => globalRadiusScale(d))
                .attr("fill", "none")
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");

            // Render Radial Axis Lines (Part of Block 7 conceptually)
            smallMultipleGroup.selectAll(".radial-axis-line")
                .data(allCategories)
                .enter()
                .append("line")
                .attr("class", "axis radial-axis")
                .attr("x1", 0).attr("y1", 0)
                .attr("x2", d => plotRadius * Math.cos(angleScale(d) - Math.PI / 2))
                .attr("y2", d => plotRadius * Math.sin(angleScale(d) - Math.PI / 2))
                .attr("stroke", fillStyle.gridLineColor)
                .attr("stroke-width", 0.5);
            
            // Render Spline Path
            const splineGenerator = createSplineGenerator(currentGroupData);
            smallMultipleGroup.append("path")
                .attr("class", "mark data-spline")
                .attr("d", splineGenerator())
                .attr("fill", "none")
                .attr("stroke", fillStyle.primaryPlotColor)
                .attr("stroke-width", 1.5)
                .attr("stroke-linejoin", "round");

            // Render Data Points and Value Labels
            allCategories.forEach(cat => {
                const pointData = currentGroupData.find(item => item[categoryFieldName] === cat);
                if (pointData) {
                    const value = +pointData[valueFieldName];
                    const angle = angleScale(cat) - Math.PI / 2;
                    const distance = globalRadiusScale(value);
                    const pointColor = categoryColorScale(cat);

                    // Data Point
                    smallMultipleGroup.append("circle")
                        .attr("class", "mark data-point")
                        .attr("cx", distance * Math.cos(angle))
                        .attr("cy", distance * Math.sin(angle))
                        .attr("r", 3)
                        .attr("fill", pointColor)
                        .attr("stroke", fillStyle.backgroundColor) // For a "halo" effect
                        .attr("stroke-width", 0.5);

                    // Value Label
                    const labelText = value.toString();
                    const labelDistance = Math.max(distance + 12, plotRadius * 0.15); // Place outside, ensure min distance
                    const textX = labelDistance * Math.cos(angle);
                    const textY = labelDistance * Math.sin(angle);

                    smallMultipleGroup.append("text")
                        .attr("class", "value data-value-label")
                        .attr("x", textX)
                        .attr("y", textY)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .style("font-family", fillStyle.typography.annotation.fontFamily)
                        .style("font-size", fillStyle.typography.annotation.fontSize)
                        .style("font-weight", fillStyle.typography.annotation.fontWeight)
                        .attr("fill", pointColor) // Use category color for label
                        .text(labelText);
                }
            });

            // Render Group Title
            smallMultipleGroup.append("text")
                .attr("class", "label group-title")
                .attr("x", 0)
                .attr("y", -plotRadius - 15) // Position above the radial plot
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.label.fontFamily)
                .style("font-size", adjustedGroupTitleFontSize)
                .style("font-weight", fillStyle.typography.label.fontWeight)
                .attr("fill", fillStyle.textColor)
                .text(groupName);

            groupIndex++;
        }
    }

    // Block 9: Optional Enhancements & Post-Processing
    // None in this chart.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
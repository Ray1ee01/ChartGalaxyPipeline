/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Group Bar Chart",
  "chart_name": "horizontal_group_bar_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [5,7]],
  "required_fields_icons": ["x"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "left",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data?.data || [];
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors || {};
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldName = dataColumns.find(col => col.role === "x")?.name;
    const valueFieldName = dataColumns.find(col => col.role === "y")?.name;
    const groupFieldName = dataColumns.find(col => col.role === "group")?.name;

    const criticalFields = { dimensionFieldName, valueFieldName, groupFieldName };
    const missingFields = Object.keys(criticalFields).filter(key => !criticalFields[key]);

    if (missingFields.length > 0) {
        const errorMsg = `Error: Critical chart configuration missing for role(s): ${missingFields.map(f => f.replace('FieldName','')).join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    const dimensionUnit = dataColumns.find(col => col.role === "x")?.unit !== "none" ? dataColumns.find(col => col.role === "x")?.unit : "";
    const valueUnit = dataColumns.find(col => col.role === "y")?.unit !== "none" ? dataColumns.find(col => col.role === "y")?.unit : "";
    // const groupUnit = dataColumns.find(col => col.role === "group")?.unit !== "none" ? dataColumns.find(col => col.role === "group")?.unit : ""; // Not used

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: typographyInput.label?.font_family || 'Arial, sans-serif',
            labelFontSize: typographyInput.label?.font_size || '12px',
            labelFontWeight: typographyInput.label?.font_weight || 'normal',
            annotationFontFamily: typographyInput.annotation?.font_family || 'Arial, sans-serif',
            annotationFontSize: typographyInput.annotation?.font_size || '10px',
            annotationFontWeight: typographyInput.annotation?.font_weight || 'normal',
        },
        colors: {
            textColor: colorsInput.text_color || '#333333',
            chartBackground: colorsInput.background_color || '#FFFFFF', // Not directly applied to SVG background, but available
            defaultCapsuleColor: '#CCCCCC',
            // groupColorMapping will be populated in Block 5 after groups are known
        },
        images: {
            getDimensionIcon: (dimensionName) => imagesInput.field?.[dimensionName] || imagesInput.other?.[dimensionName] || null,
        }
    };

    function estimateTextWidth(text, fontStyle) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontStyle.font_family;
        tempText.style.fontSize = fontStyle.font_size;
        tempText.style.fontWeight = fontStyle.font_weight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        try {
            return tempText.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on detached elements is problematic
            const avgCharWidth = parseFloat(fontStyle.font_size) * 0.6; // Crude fallback
            return text.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    // Layout constants
    const MAX_CAPSULES = 30;
    const CAPSULE_WIDTH = 5;
    const CAPSULE_SPACING = 2;
    const ICON_SIZE_RATIO = 0.6;
    const MAX_ICON_SIZE = 25;
    const LABEL_ICON_PADDING = 5;
    const ICON_BAR_PADDING = 10; // Padding between icon and start of capsules
    const GROUP_SPACING_RATIO = 0.1; // Spacing between groups within a dimension band

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.colors.chartBackground); // Optional: apply background color

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = {
        top: 100, // For legend
        right: 30,
        bottom: 60,
        left: 60
    };

    const dimensions = [...new Set(chartData.map(d => d[dimensionFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        maxDimLabelWidth = Math.max(maxDimLabelWidth, estimateTextWidth(labelText, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        }));
    });
    
    const overallMaxForLabel = d3.max(chartData, d => Math.abs(+d[valueFieldName])) || 0;
    let maxValueLabelWidth = 0;
    const formattedMaxValueForLabel = valueUnit ? `${formatValue(overallMaxForLabel)}${valueUnit}` : `${formatValue(overallMaxForLabel)}`;
    maxValueLabelWidth = estimateTextWidth(formattedMaxValueForLabel, {
        font_family: fillStyle.typography.annotationFontFamily,
        font_size: fillStyle.typography.annotationFontSize,
        font_weight: fillStyle.typography.annotationFontWeight
    });

    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + LABEL_ICON_PADDING + MAX_ICON_SIZE + ICON_BAR_PADDING);
    const maxCapsulesWidth = MAX_CAPSULES * (CAPSULE_WIDTH + CAPSULE_SPACING);
    chartMargins.right = Math.max(chartMargins.right, maxCapsulesWidth + maxValueLabelWidth + 10); // 10px extra spacing

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    const overallMax = d3.max(chartData, d => Math.abs(+d[valueFieldName])) || 0;
    const valuePerCapsule = overallMax > 0 ? Math.ceil(overallMax / MAX_CAPSULES) : 1;
    const valueToCapsules = (value) => {
        if (valuePerCapsule === 0) return 0;
        return Math.min(MAX_CAPSULES, Math.ceil(Math.abs(value) / valuePerCapsule));
    };

    // Populate groupColorMapping
    const groupColorMapping = {};
    const defaultCategoricalColors = d3.schemeCategory10;
    groups.forEach((group, idx) => {
        if (colorsInput.field && colorsInput.field[group]) {
            groupColorMapping[group] = colorsInput.field[group];
        } else if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
            groupColorMapping[group] = colorsInput.available_colors[idx % colorsInput.available_colors.length];
        } else {
            groupColorMapping[group] = defaultCategoricalColors[idx % defaultCategoricalColors.length];
        }
    });
    fillStyle.colors.getGroupColor = (group) => groupColorMapping[group] || fillStyle.colors.defaultCapsuleColor;


    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(0.3); // Dimension group padding

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(0, ${chartMargins.top * 0.6})`);

    const legendCapsuleHeight = 10;
    const legendCapsuleWidth = 15;
    const legendTextPadding = 5;
    const legendItemPadding = 15; // Horizontal padding between items
    const legendVerticalSpacing = 10; // Vertical padding between rows
    const legendRowHeight = legendCapsuleHeight + legendVerticalSpacing;

    const legendItemsData = [];
    groups.forEach((group, i) => {
        const textWidth = estimateTextWidth(group, {
            font_family: fillStyle.typography.labelFontFamily,
            font_size: fillStyle.typography.labelFontSize,
            font_weight: fillStyle.typography.labelFontWeight
        });
        const itemContentWidth = legendCapsuleWidth + legendTextPadding + textWidth;
        const itemWidth = itemContentWidth + legendItemPadding;
        legendItemsData.push({ group: group, width: itemWidth, contentWidth: itemContentWidth, index: i });
    });

    const legendRows = [];
    let currentRow = [];
    let currentRowWidth = 0;
    const maxLegendWidthForRow = containerWidth - chartMargins.left - chartMargins.right; // Use available width

    legendItemsData.forEach(itemData => {
        if (currentRow.length > 0 && currentRowWidth + itemData.width > maxLegendWidthForRow) {
            legendRows.push({ items: currentRow, totalWidth: currentRowWidth - legendItemPadding });
            currentRow = [itemData];
            currentRowWidth = itemData.width;
        } else {
            currentRow.push(itemData);
            currentRowWidth += itemData.width;
        }
    });
    if (currentRow.length > 0) {
        legendRows.push({ items: currentRow, totalWidth: currentRowWidth - legendItemPadding });
    }

    let currentLegendY = 0;
    legendRows.forEach(row => {
        const startX = (containerWidth - row.totalWidth) / 2;
        let currentLegendX = startX;

        row.items.forEach(itemData => {
            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendX}, ${currentLegendY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-mark")
                .attr("x", 0)
                .attr("y", -legendCapsuleHeight / 2)
                .attr("width", legendCapsuleWidth)
                .attr("height", legendCapsuleHeight)
                .attr("rx", legendCapsuleHeight / 2)
                .attr("ry", legendCapsuleHeight / 2)
                .style("fill", fillStyle.colors.getGroupColor(itemData.group));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendCapsuleWidth + legendTextPadding)
                .attr("y", 0)
                .attr("dy", "0.35em") // Vertical alignment
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(itemData.group);
            
            currentLegendX += itemData.width;
        });
        currentLegendY += legendRowHeight;
    });
    // Adjust top margin if legend is taller than initially allocated
    const legendActualHeight = currentLegendY - legendVerticalSpacing + legendCapsuleHeight; // Approximate height
     if (legendActualHeight > chartMargins.top) {
        const diff = legendActualHeight - chartMargins.top + 20; // 20 for some padding
        chartMargins.top = legendActualHeight + 20;
        // Re-calculate innerHeight and update mainChartGroup transform and yScale range
        // This is a bit complex to do post-hoc. For simplicity, we assume initial margin is enough or legend might overflow.
        // A more robust solution would calculate legend height first, then set margins.
        // For this refactoring, we'll stick to the simpler flow.
        // The original code also set legend Y based on margin.top * 0.7, implying fixed space.
    }


    // Block 8: Main Data Visualization Rendering
    dimensions.forEach(dimension => {
        const dimensionData = chartData.filter(d => d[dimensionFieldName] === dimension);
        if (dimensionData.length === 0) return;

        const dimensionY = yScale(dimension);
        const dimensionBandwidth = yScale.bandwidth();

        const numGroups = groups.length;
        const totalGroupSpacingHeight = dimensionBandwidth * GROUP_SPACING_RATIO * (numGroups > 1 ? numGroups - 1 : 0);
        const availableGroupHeight = dimensionBandwidth - totalGroupSpacingHeight;
        const groupCapsuleRowHeight = Math.max(4, availableGroupHeight / numGroups); // Min height 4px
        const actualGroupSpacing = dimensionBandwidth * GROUP_SPACING_RATIO;

        const iconSize = Math.min(MAX_ICON_SIZE, dimensionBandwidth * ICON_SIZE_RATIO);
        const iconY = dimensionY + (dimensionBandwidth - iconSize) / 2;
        const iconUrl = fillStyle.images.getDimensionIcon(dimension);
        
        let finalLabelX;
        const labelCenterY = dimensionY + dimensionBandwidth / 2;

        if (iconUrl) {
            const iconX = -ICON_BAR_PADDING - iconSize;
            finalLabelX = iconX - LABEL_ICON_PADDING;

            mainChartGroup.append("image")
                .attr("class", "icon dimension-icon")
                .attr("x", iconX)
                .attr("y", iconY)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .attr("xlink:href", iconUrl);
        } else {
            finalLabelX = -ICON_BAR_PADDING; 
        }

        const dimensionLabelText = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
        mainChartGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", finalLabelX)
            .attr("y", labelCenterY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(dimensionLabelText);

        groups.forEach((group, groupIndex) => {
            const dataPoint = dimensionData.find(d => d[groupFieldName] === group);
            if (dataPoint) {
                const value = parseFloat(dataPoint[valueFieldName]);
                const capsuleCount = valueToCapsules(value);
                const groupY = dimensionY + (groupIndex * (groupCapsuleRowHeight + actualGroupSpacing));

                for (let j = 0; j < capsuleCount; j++) {
                    const capsuleX = j * (CAPSULE_WIDTH + CAPSULE_SPACING);
                    mainChartGroup.append("rect")
                        .attr("class", "mark capsule-mark")
                        .attr("x", capsuleX)
                        .attr("y", groupY)
                        .attr("width", CAPSULE_WIDTH)
                        .attr("height", groupCapsuleRowHeight)
                        .attr("rx", CAPSULE_WIDTH / 2) // For capsule shape
                        .attr("ry", CAPSULE_WIDTH / 2) // For capsule shape
                        .style("fill", fillStyle.colors.getGroupColor(group));
                }

                const formattedValueText = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                const lastCapsuleEnd = capsuleCount > 0 ? capsuleCount * (CAPSULE_WIDTH + CAPSULE_SPACING) - CAPSULE_SPACING : 0;
                const valueLabelX = lastCapsuleEnd + 5; // 5px padding after capsules

                mainChartGroup.append("text")
                    .attr("class", "label value-label")
                    .attr("x", valueLabelX)
                    .attr("y", groupY + groupCapsuleRowHeight / 2)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "start")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", fillStyle.typography.annotationFontSize) // Use configured size
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.colors.textColor)
                    .text(formattedValueText);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No optional enhancements in this refactoring.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
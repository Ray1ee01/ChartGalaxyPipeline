/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_grouped_bar_chart_07",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
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
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    const rawImages = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear the container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => dataColumns.find(col => col.role === role)?.name;
    const getFieldUnitByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return (col && col.unit !== "none") ? col.unit : "";
    };
    
    const categoryFieldName = getFieldNameByRole(xFieldRole);
    const valueFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    if (!categoryFieldName || !valueFieldName || !groupFieldName) {
        const missingFields = [];
        if (!categoryFieldName) missingFields.push(`field with role '${xFieldRole}'`);
        if (!valueFieldName) missingFields.push(`field with role '${yFieldRole}'`);
        if (!groupFieldName) missingFields.push(`field with role '${groupFieldRole}'`);
        
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const categoryFieldUnit = getFieldUnitByRole(xFieldRole);
    const valueFieldUnit = getFieldUnitByRole(yFieldRole);
    // const groupFieldUnit = getFieldUnitByRole(groupFieldRole); // Not used in rendering

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            dimensionLabelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            dimensionLabelFontSize: rawTypography.label?.font_size || '12px',
            dimensionLabelFontWeight: rawTypography.label?.font_weight || 'normal',
            valueLabelFontFamily: rawTypography.annotation?.font_family || 'Arial, sans-serif',
            valueLabelFontSize: rawTypography.annotation?.font_size || '10px',
            valueLabelFontWeight: rawTypography.annotation?.font_weight || 'normal',
            legendLabelFontFamily: rawTypography.label?.font_family || 'Arial, sans-serif',
            legendLabelFontSize: rawTypography.label?.font_size || '12px',
            legendLabelFontWeight: rawTypography.label?.font_weight || 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        defaultCapsuleColor: '#CCCCCC',
        getCapsuleColor: (groupName, groupIndex, totalGroups) => {
            if (rawColors.field && rawColors.field[groupName]) {
                return rawColors.field[groupName];
            }
            if (rawColors.available_colors && rawColors.available_colors.length > 0) {
                return rawColors.available_colors[groupIndex % rawColors.available_colors.length];
            }
            // Fallback to d3.schemeCategory10 if d3 is available and no other colors defined
            if (typeof d3 !== 'undefined' && d3.schemeCategory10 && d3.schemeCategory10.length > 0) {
                 return d3.schemeCategory10[groupIndex % d3.schemeCategory10.length];
            }
            return fillStyle.defaultCapsuleColor;
        },
        getIconUrl: (dimensionName) => rawImages.field && rawImages.field[dimensionName] ? rawImages.field[dimensionName] : null,
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvg.style.visibility = 'hidden'; // Not strictly needed for detached
        // tempSvg.style.position = 'absolute'; // Not strictly needed for detached
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('font-family', fontFamily);
        textElement.setAttribute('font-size', fontSize);
        textElement.setAttribute('font-weight', fontWeight);
        textElement.textContent = text;
        tempSvg.appendChild(textElement);
        // Appending to body and removing is safer for getBBox, but prompt forbids.
        // This relies on browser supporting getBBox on detached elements.
        try {
            return textElement.getBBox().width;
        } catch (e) {
            // Fallback if getBBox fails (e.g. in some test environments without full SVG support)
            // This is a rough estimate.
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return text.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (Math.abs(value) >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (Math.abs(value) >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (Math.abs(value) >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    const maxCapsulesPerGroup = variables.maxCapsulesPerGroup || 30; // Max capsules per group
    let valuePerCapsule = 1; // Default if overallMax is 0 or data is empty

    const valueToCapsules = (value) => {
        if (valuePerCapsule === 0) return 0;
        return Math.min(maxCapsulesPerGroup, Math.ceil(Math.abs(value) / valuePerCapsule));
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
    const categories = [...new Set(chartData.map(d => d[categoryFieldName]))];
    const groups = [...new Set(chartData.map(d => d[groupFieldName]))];

    const iconSizeRatio = 0.6;
    const maxIconSize = variables.maxIconSize || 25;
    const iconPadding = 5;
    const capsuleWidth = variables.capsuleWidth || 5;
    const capsuleSpacing = variables.capsuleSpacing !== undefined ? variables.capsuleSpacing : 2;
    
    let maxCategoryLabelWidth = 0;
    categories.forEach(cat => {
        const formattedCat = categoryFieldUnit ? `${cat}${categoryFieldUnit}` : `${cat}`;
        maxCategoryLabelWidth = Math.max(maxCategoryLabelWidth, estimateTextWidth(
            formattedCat,
            fillStyle.typography.dimensionLabelFontFamily,
            fillStyle.typography.dimensionLabelFontSize,
            fillStyle.typography.dimensionLabelFontWeight
        ));
    });

    const overallMaxAbsValue = d3.max(chartData, d => Math.abs(Number(d[valueFieldName]))) || 0;
    valuePerCapsule = overallMaxAbsValue > 0 ? Math.ceil(overallMaxAbsValue / maxCapsulesPerGroup) : 1;


    let maxValueLabelWidth = 0;
    if (chartData.length > 0) {
         const formattedMaxValueWithUnit = `${formatValue(overallMaxAbsValue)}${valueFieldUnit}`;
         maxValueLabelWidth = estimateTextWidth(
            formattedMaxValueWithUnit,
            fillStyle.typography.valueLabelFontFamily,
            fillStyle.typography.valueLabelFontSize,
            fillStyle.typography.valueLabelFontWeight
        );
    }

    const legendItemPadding = 15;
    const legendCapsuleWidth = 15;
    const legendCapsuleHeight = 10;
    const legendTextToCapsulePadding = 5;
    const legendVerticalSpacing = 10;
    const legendRowHeight = legendCapsuleHeight + legendVerticalSpacing;
    const legendBaseTopPadding = 20;
    const legendPaddingBelow = 20;
    
    let calculatedLegendHeight = 0;
    if (groups.length > 0) {
        let currentX = 0;
        let currentY = legendCapsuleHeight; // Start with one row height
        const maxLegendWidthAvailable = containerWidth - (variables.marginLeft || 20) - (variables.marginRight || 20);

        groups.forEach(group => {
            const textWidth = estimateTextWidth(
                group,
                fillStyle.typography.legendLabelFontFamily,
                fillStyle.typography.legendLabelFontSize,
                fillStyle.typography.legendLabelFontWeight
            );
            const itemWidth = legendCapsuleWidth + legendTextToCapsulePadding + textWidth;
            if (currentX > 0 && currentX + itemWidth + legendItemPadding > maxLegendWidthAvailable) {
                currentX = 0;
                currentY += legendRowHeight;
            }
            currentX += itemWidth + legendItemPadding;
        });
        calculatedLegendHeight = currentY;
    }


    const chartMargins = {
        top: calculatedLegendHeight > 0 ? legendBaseTopPadding + calculatedLegendHeight + legendPaddingBelow : (variables.marginTop || 30),
        right: variables.marginRight || 30,
        bottom: variables.marginBottom || 60,
        left: variables.marginLeft || 60
    };
    
    const labelIconPadding = 5;
    const iconBarPadding = 10;
    chartMargins.left = Math.max(chartMargins.left, maxCategoryLabelWidth + labelIconPadding + maxIconSize + iconBarPadding);
    
    const maxCapsulesTotalWidth = maxCapsulesPerGroup * (capsuleWidth + capsuleSpacing) - (maxCapsulesPerGroup > 0 ? capsuleSpacing : 0);
    const requiredRightWidth = maxCapsulesTotalWidth + maxValueLabelWidth + 10; // 10px extra spacing
    chartMargins.right = Math.max(chartMargins.right, requiredRightWidth);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    // (overallMaxAbsValue, valuePerCapsule already calculated in Block 4 for layout)
    // (categories, groups already extracted in Block 4)

    // Block 6: Scale Definition & Configuration
    const yScale = d3.scaleBand()
        .domain(categories)
        .range([0, innerHeight])
        .padding(variables.categoryGroupPadding || 0.3); // Padding between category groups

    // Block 7: Chart Component Rendering (Legend)
    if (groups.length > 0) {
        const legendGroup = svgRoot.append("g")
            .attr("class", "legend other")
            .attr("transform", `translate(${chartMargins.left}, ${legendBaseTopPadding})`);

        let currentX = 0;
        let currentY = 0; 
        const maxLegendLayoutWidth = containerWidth - chartMargins.left - chartMargins.right;


        groups.forEach((group, i) => {
            const textWidth = estimateTextWidth(
                group,
                fillStyle.typography.legendLabelFontFamily,
                fillStyle.typography.legendLabelFontSize,
                fillStyle.typography.legendLabelFontWeight
            );
            const itemWidth = legendCapsuleWidth + legendTextToCapsulePadding + textWidth;

            if (currentX > 0 && currentX + itemWidth + legendItemPadding > maxLegendLayoutWidth) {
                currentX = 0;
                currentY += legendRowHeight;
            }

            const legendItem = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentX}, ${currentY})`);

            legendItem.append("rect")
                .attr("class", "mark legend-capsule")
                .attr("x", 0)
                .attr("y", -legendCapsuleHeight / 2 + legendRowHeight/2 - legendVerticalSpacing/2) // Vertically center capsule in its allocated space
                .attr("width", legendCapsuleWidth)
                .attr("height", legendCapsuleHeight)
                .attr("rx", legendCapsuleHeight / 2)
                .attr("ry", legendCapsuleHeight / 2)
                .style("fill", fillStyle.getCapsuleColor(group, i, groups.length));

            legendItem.append("text")
                .attr("class", "label legend-label")
                .attr("x", legendCapsuleWidth + legendTextToCapsulePadding)
                .attr("y", legendRowHeight/2 - legendVerticalSpacing/2) // Align with capsule center
                .attr("dy", "0.35em") // Vertical alignment adjustment
                .style("font-family", fillStyle.typography.legendLabelFontFamily)
                .style("font-size", fillStyle.typography.legendLabelFontSize)
                .style("font-weight", fillStyle.typography.legendLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group);

            currentX += itemWidth + legendItemPadding;
        });
    }
    
    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group other")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    categories.forEach(category => {
        const categoryData = chartData.filter(d => d[categoryFieldName] === category);
        
        if (categoryData.length > 0) {
            const categoryY = yScale(category);
            if (categoryY === undefined) return; // Skip if category not in scale (e.g. empty categories array)
            
            const categoryBandwidth = yScale.bandwidth();
            
            const groupOuterPaddingRatio = variables.groupPaddingRatioInBand || 0.1; // Spacing between group-rows within a category band
            const numGroupsInCat = groups.length; // Assuming all groups can appear for any category
            const totalGroupSpacingHeight = categoryBandwidth * groupOuterPaddingRatio * (numGroupsInCat > 1 ? numGroupsInCat - 1 : 0);
            const availableHeightForGroupCapsules = categoryBandwidth - totalGroupSpacingHeight;
            const groupCapsuleRowHeight = Math.max(4, availableHeightForGroupCapsules / numGroupsInCat); // Min height 4px
            const actualGroupSpacing = categoryBandwidth * groupOuterPaddingRatio;

            const iconUrl = fillStyle.getIconUrl(category);
            const effectiveIconSize = Math.min(maxIconSize, categoryBandwidth * iconSizeRatio);
            const iconYPos = categoryY + (categoryBandwidth - effectiveIconSize) / 2;
            
            let categoryLabelXPos;
            if (iconUrl) {
                const iconXPos = -iconBarPadding - effectiveIconSize;
                categoryLabelXPos = iconXPos - labelIconPadding;

                mainChartGroup.append("image")
                    .attr("class", "icon dimension-icon")
                    .attr("x", iconXPos)
                    .attr("y", iconYPos)
                    .attr("width", effectiveIconSize)
                    .attr("height", effectiveIconSize)
                    .attr("preserveAspectRatio", "xMidYMid meet")
                    .attr("xlink:href", iconUrl);
            } else {
                categoryLabelXPos = -iconBarPadding;
            }
            
            const formattedCategoryText = categoryFieldUnit ? `${category}${categoryFieldUnit}` : `${category}`;
            mainChartGroup.append("text")
                .attr("class", "label dimension-label")
                .attr("x", categoryLabelXPos)
                .attr("y", categoryY + categoryBandwidth / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "end")
                .style("font-family", fillStyle.typography.dimensionLabelFontFamily)
                .style("font-size", fillStyle.typography.dimensionLabelFontSize)
                .style("font-weight", fillStyle.typography.dimensionLabelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(formattedCategoryText);
            
            groups.forEach((group, groupIndex) => {
                const dataPoint = categoryData.find(d => d[groupFieldName] === group);
                
                if (dataPoint) {
                    const value = parseFloat(dataPoint[valueFieldName]);
                    if (isNaN(value)) return; // Skip if value is not a number

                    const numCapsules = valueToCapsules(value);
                    const groupCapsuleYPos = categoryY + (groupIndex * (groupCapsuleRowHeight + actualGroupSpacing));
                    
                    for (let j = 0; j < numCapsules; j++) {
                        const capsuleX = j * (capsuleWidth + capsuleSpacing);
                        mainChartGroup.append("rect")
                            .attr("class", "mark capsule")
                            .attr("x", capsuleX)
                            .attr("y", groupCapsuleYPos)
                            .attr("width", capsuleWidth)
                            .attr("height", groupCapsuleRowHeight)
                            .attr("rx", Math.min(capsuleWidth / 2, groupCapsuleRowHeight / 2)) // Rounded ends
                            .attr("ry", Math.min(capsuleWidth / 2, groupCapsuleRowHeight / 2)) // Rounded ends
                            .style("fill", fillStyle.getCapsuleColor(group, groupIndex, groups.length));
                    }
                    
                    const formattedValueText = `${formatValue(value)}${valueFieldUnit}`;
                    const lastCapsuleEndX = (numCapsules > 0 ? numCapsules * (capsuleWidth + capsuleSpacing) - capsuleSpacing : 0);
                    const valueLabelXPos = lastCapsuleEndX + 5; // 5px padding after capsules
                    
                    const valueLabelFontSizeActual = Math.max(
                        groupCapsuleRowHeight * 0.5, // At least half the capsule height
                        parseFloat(fillStyle.typography.valueLabelFontSize) // But not smaller than configured min
                    );

                    mainChartGroup.append("text")
                        .attr("class", "label value-label")
                        .attr("x", valueLabelXPos)
                        .attr("y", groupCapsuleYPos + groupCapsuleRowHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", "start")
                        .style("font-family", fillStyle.typography.valueLabelFontFamily)
                        .style("font-size", `${valueLabelFontSizeActual}px`)
                        .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                        .style("fill", fillStyle.textColor)
                        .text(formattedValueText);
                }
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (No complex effects like shadows, gradients, patterns as per requirements)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
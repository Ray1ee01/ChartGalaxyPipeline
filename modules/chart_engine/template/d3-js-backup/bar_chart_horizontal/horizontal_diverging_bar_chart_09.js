/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Diverging Bar Chart",
  "chart_name": "horizontal_diverging_bar_chart_09",
  "is_composite": false,
  "required_fields": ["x", "y", "group", "group2"],
  "hierarchy": ["group2", "x"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 2], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
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
    // The /* REQUIREMENTS_BEGIN... */ block is now external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {};
    const imagesConfig = data.images || {}; // Not used in this chart, but extracted for consistency
    const dataColumns = data.data.columns || [];
    let chartDataArray = data.data.data;

    d3.select(containerSelector).html(""); // Clear the container

    const parentTypeFieldRole = "x";
    const valueFieldRole = "y";
    const genderFieldRole = "group";
    const careerImpactFieldRole = "group2";

    const getFieldName = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : undefined;
    };

    const parentTypeFieldName = getFieldName(parentTypeFieldRole);
    const valueFieldName = getFieldName(valueFieldRole);
    const genderFieldName = getFieldName(genderFieldRole);
    const careerImpactFieldName = getFieldName(careerImpactFieldRole);

    const criticalFields = {
        parentTypeFieldName,
        valueFieldName,
        genderFieldName,
        careerImpactFieldName
    };
    const missingFields = Object.entries(criticalFields)
        .filter(([, value]) => !value)
        .map(([key]) => key.replace("Name", ""));

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: [${missingFields.join(', ')} field names not found in data.data.columns]. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        }
        return null;
    }
    
    let valueFieldUnit = "";
    const yColumn = dataColumns.find(col => col.role === valueFieldRole);
    if (yColumn && yColumn.unit && yColumn.unit !== "none") {
        valueFieldUnit = yColumn.unit;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            impactTitleFontFamily: (typographyConfig.title && typographyConfig.title.font_family) || "Arial, sans-serif",
            impactTitleFontSize: (typographyConfig.title && typographyConfig.title.font_size) || "16px",
            impactTitleFontWeight: (typographyConfig.title && typographyConfig.title.font_weight) || "bold",

            parentTypeLabelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || "Arial, sans-serif",
            parentTypeLabelFontSize: (typographyConfig.label && typographyConfig.label.font_size) || "12px",
            parentTypeLabelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || "normal",

            legendFontFamily: (typographyConfig.label && typographyConfig.label.font_family) || "Arial, sans-serif",
            legendFontSize: (typographyConfig.label && typographyConfig.label.font_size) || "12px",
            legendFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) || "bold", // Legend labels often bold

            valueLabelFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) || "Arial, sans-serif",
            valueLabelFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) || "10px",
            valueLabelFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) || "normal",
        },
        colors: {
            textColor: colorsConfig.text_color || "#333333",
            chartBackground: colorsConfig.background_color || "#FFFFFF", // Not directly used for SVG background, but available
            getGenderColor: (genderValue, genderIndex, totalGenders) => {
                if (colorsConfig.field && colorsConfig.field[genderValue]) {
                    return colorsConfig.field[genderValue];
                }
                if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                    return colorsConfig.available_colors[genderIndex % colorsConfig.available_colors.length];
                }
                // Fallback to a simple scheme if nothing else is provided
                const defaultScheme = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];
                return defaultScheme[genderIndex % defaultScheme.length];
            }
        },
        images: { // Placeholder for image sourcing, not used in this chart
            getImageUrl: (fieldValue) => {
                if (imagesConfig.field && imagesConfig.field[fieldValue]) {
                    return imagesConfig.field[fieldValue];
                }
                if (imagesConfig.other && imagesConfig.other.primary) {
                    return imagesConfig.other.primary;
                }
                return null;
            }
        }
    };

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        // Apply styles directly as attributes for SVG text elements
        tempTextNode.setAttribute('font-family', fontFamily);
        tempTextNode.setAttribute('font-size', fontSize);
        tempTextNode.setAttribute('font-weight', fontWeight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        // getBBox might be 0 if not in DOM and styles aren't fully computed.
        // For robust measurement, appending to DOM is usually needed, but directive forbids it.
        // getComputedTextLength() is an alternative but works on text content, not full bbox.
        try {
            return tempTextNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on non-DOM elements fails (e.g. JSDOM)
            // Basic character count estimation
            const avgCharWidth = parseFloat(fontSize) * 0.6;
            return text.length * avgCharWidth;
        }
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };
    
    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("class", "chart-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const legendAreaHeight = 60; // Space for legend at the top
    const chartMargins = {
        top: legendAreaHeight,
        right: 20, // Initial right margin, will be adjusted
        bottom: 50,
        left: 20   // Initial left margin, will be adjusted
    };

    let maxValueLabelWidth = 0;
    chartDataArray.forEach(d => {
        const valueText = `${formatValue(d[valueFieldName])}${valueFieldUnit}`;
        const textWidth = estimateTextWidth(
            valueText,
            fillStyle.typography.valueLabelFontFamily,
            fillStyle.typography.valueLabelFontSize,
            fillStyle.typography.valueLabelFontWeight
        );
        maxValueLabelWidth = Math.max(maxValueLabelWidth, textWidth);
    });
    
    const valueLabelPadding = 10;
    chartMargins.left = Math.max(chartMargins.left, maxValueLabelWidth + valueLabelPadding);
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + valueLabelPadding);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    // Block 5: Data Preprocessing & Transformation
    const parentTypes = [...new Set(chartDataArray.map(d => d[parentTypeFieldName]))];
    const genders = [...new Set(chartDataArray.map(d => d[genderFieldName]))];
    const careerImpacts = [...new Set(chartDataArray.map(d => d[careerImpactFieldName]))];

    if (genders.length !== 2) {
        const errorMsg = `The '${genderFieldName}' field (role: group) must have exactly 2 unique values for this chart type. Found ${genders.length}.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding:20px;'>${errorMsg}</div>`);
        return null;
    }

    const leftGender = genders[1]; // Assign consistently
    const rightGender = genders[0];

    const impactTitleFontSizePx = parseFloat(fillStyle.typography.impactTitleFontSize);
    const parentTypeLabelFontSizePx = parseFloat(fillStyle.typography.parentTypeLabelFontSize);

    const totalImpactGroups = careerImpacts.length;
    const impactGroupHeight = innerHeight / totalImpactGroups;
    
    // Spacing within each impact group
    const impactGroupTitleAreaHeight = impactTitleFontSizePx + 20; // Space for impact title + padding
    const impactGroupContentHeight = impactGroupHeight - impactGroupTitleAreaHeight;

    const subGroupHeight = impactGroupContentHeight / parentTypes.length;
    const parentTypeLabelAreaHeight = parentTypeLabelFontSizePx + 5; // Space for parent type label + padding
    
    const barAreaHeight = subGroupHeight - parentTypeLabelAreaHeight;
    const barPadding = barAreaHeight * 0.2; // 20% of bar area for top/bottom padding
    const barHeight = Math.max(1, barAreaHeight - barPadding); // Ensure barHeight is at least 1px


    // Block 6: Scale Definition & Configuration
    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, maxValue || 1]) // Ensure domain is not [0,0] if maxValue is 0
        .range([0, innerWidth / 2 * 0.9]); // Each side takes up 90% of half width to leave center gap

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    const chartCenterX = innerWidth / 2;

    // Render Legend
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${containerWidth / 2}, ${chartMargins.top / 2})`);

    const legendCircleRadius = 8;
    const legendSpacing = 10; // Between circle and text
    const legendInterItemSpacing = 20; // Between left and right legend items

    const leftLegendTextWidth = estimateTextWidth(
        leftGender,
        fillStyle.typography.legendFontFamily,
        fillStyle.typography.legendFontSize,
        fillStyle.typography.legendFontWeight
    );
    const rightLegendTextWidth = estimateTextWidth(
        rightGender,
        fillStyle.typography.legendFontFamily,
        fillStyle.typography.legendFontSize,
        fillStyle.typography.legendFontWeight
    );

    // Left legend item
    const leftLegendItemX = -(legendInterItemSpacing / 2) - leftLegendTextWidth - legendSpacing - legendCircleRadius;
    legendGroup.append("circle")
        .attr("cx", leftLegendItemX + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", fillStyle.colors.getGenderColor(leftGender, genders.indexOf(leftGender), genders.length))
        .attr("class", "legend-item mark");
    legendGroup.append("text")
        .attr("x", leftLegendItemX + legendCircleRadius * 2 + legendSpacing)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.legendFontFamily)
        .style("font-size", fillStyle.typography.legendFontSize)
        .style("font-weight", fillStyle.typography.legendFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(leftGender)
        .attr("class", "legend-item label");

    // Right legend item
    const rightLegendItemX = legendInterItemSpacing / 2;
    legendGroup.append("circle")
        .attr("cx", rightLegendItemX + legendCircleRadius)
        .attr("cy", 0)
        .attr("r", legendCircleRadius)
        .attr("fill", fillStyle.colors.getGenderColor(rightGender, genders.indexOf(rightGender), genders.length))
        .attr("class", "legend-item mark");
    legendGroup.append("text")
        .attr("x", rightLegendItemX + legendCircleRadius * 2 + legendSpacing)
        .attr("y", 0)
        .attr("dy", "0.35em")
        .attr("text-anchor", "start")
        .style("font-family", fillStyle.typography.legendFontFamily)
        .style("font-size", fillStyle.typography.legendFontSize)
        .style("font-weight", fillStyle.typography.legendFontWeight)
        .style("fill", fillStyle.colors.textColor)
        .text(rightGender)
        .attr("class", "legend-item label");

    // Block 8: Main Data Visualization Rendering
    careerImpacts.forEach((impact, impactIndex) => {
        const impactGroupY = impactIndex * impactGroupHeight;

        // Render Impact Title (Section Header)
        mainChartGroup.append("text")
            .attr("x", chartCenterX)
            .attr("y", impactGroupY + impactTitleFontSizePx / 2) // Position at top of group area
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.impactTitleFontFamily)
            .style("font-size", fillStyle.typography.impactTitleFontSize)
            .style("font-weight", fillStyle.typography.impactTitleFontWeight)
            .style("fill", fillStyle.colors.textColor)
            .text(impact)
            .attr("class", "label section-title");

        parentTypes.forEach((parentType, parentIndex) => {
            const subGroupYOffset = impactGroupTitleAreaHeight + parentIndex * subGroupHeight;
            const currentBarY = impactGroupY + subGroupYOffset + parentTypeLabelAreaHeight + (barPadding / 2);

            // Render Parent Type Label (Category Label)
            mainChartGroup.append("text")
                .attr("x", chartCenterX)
                .attr("y", impactGroupY + subGroupYOffset + parentTypeLabelFontSizePx / 2)
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.parentTypeLabelFontFamily)
                .style("font-size", fillStyle.typography.parentTypeLabelFontSize)
                .style("font-weight", fillStyle.typography.parentTypeLabelFontWeight)
                .style("fill", fillStyle.colors.textColor)
                .text(parentType)
                .attr("class", "label category-label");

            genders.forEach((gender) => {
                const dataPoint = chartDataArray.find(d =>
                    d[parentTypeFieldName] === parentType &&
                    d[genderFieldName] === gender &&
                    d[careerImpactFieldName] === impact
                );

                if (dataPoint) {
                    const value = +dataPoint[valueFieldName];
                    const currentBarWidth = xScale(value);
                    let barXPos, textXPos, textAnchor;

                    if (gender === leftGender) {
                        barXPos = chartCenterX - currentBarWidth;
                        textXPos = barXPos - valueLabelPadding / 2;
                        textAnchor = "end";
                    } else { // rightGender
                        barXPos = chartCenterX;
                        textXPos = chartCenterX + currentBarWidth + valueLabelPadding / 2;
                        textAnchor = "start";
                    }

                    // Render Bar
                    mainChartGroup.append("rect")
                        .attr("x", barXPos)
                        .attr("y", currentBarY)
                        .attr("width", currentBarWidth)
                        .attr("height", barHeight)
                        .attr("fill", fillStyle.colors.getGenderColor(gender, genders.indexOf(gender), genders.length))
                        .attr("class", "mark bar");

                    // Render Value Label
                    mainChartGroup.append("text")
                        .attr("x", textXPos)
                        .attr("y", currentBarY + barHeight / 2)
                        .attr("dy", "0.35em")
                        .attr("text-anchor", textAnchor)
                        .style("font-family", fillStyle.typography.valueLabelFontFamily)
                        .style("font-size", fillStyle.typography.valueLabelFontSize)
                        .style("font-weight", fillStyle.typography.valueLabelFontWeight)
                        .style("fill", fillStyle.colors.textColor)
                        .text(`${formatValue(value)}${valueFieldUnit}`)
                        .attr("class", "label value-label");
                }
            });
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // Removed: mouseover effects, shadows, gradients, rounded corners, strokes.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Grouped Bar Chart",
  "chart_name": "horizontal_group_bar_chart_13",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary", "pattern1_base", "pattern2_base", "label_pattern_base", "pattern_lines", "label_pattern_lines"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "minimal",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "hand_drawn",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartData = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || {};
    // const images = data.images || {}; // Not used in this chart
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const xFieldDef = dataColumns.find(col => col.role === xFieldRole);
    const yFieldDef = dataColumns.find(col => col.role === yFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    if (!xFieldDef || !yFieldDef || !groupFieldDef) {
        const missing = [];
        if (!xFieldDef) missing.push(xFieldRole);
        if (!yFieldDef) missing.push(yFieldRole);
        if (!groupFieldDef) missing.push(groupFieldRole);
        const errorMsg = `Critical chart config missing: role(s) '${missing.join("', '")}' not found in dataColumns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>${errorMsg}</div>`);
        return null;
    }

    const dimensionField = xFieldDef.name;
    const valueField = yFieldDef.name;
    const groupField = groupFieldDef.name;

    const dimensionUnit = xFieldDef.unit !== "none" ? xFieldDef.unit : "";
    const valueUnit = yFieldDef.unit !== "none" ? yFieldDef.unit : "";
    // const groupUnit = groupFieldDef.unit !== "none" ? groupFieldDef.unit : ""; // Not typically used for display

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) || 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) || '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) || 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) || 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) || '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) || 'normal',
            legendTextFontSize: '12px', // Base for legend, might be adjusted
            legendNumberFontSize: '16px',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF', // Not directly used on SVG, but good to have
        
        sketchPatternLeftBase: (rawColors.other && rawColors.other.pattern1_base) || '#4269d0',
        sketchPatternRightBase: (rawColors.other && rawColors.other.pattern2_base) || '#ff725c',
        sketchPatternLabelBase: (rawColors.other && rawColors.other.label_pattern_base) || '#FFFFFF',
        sketchPatternLines: (rawColors.other && rawColors.other.pattern_lines) || '#FFFFFF', // Lines on colored base
        sketchPatternLabelLines: (rawColors.other && rawColors.other.label_pattern_lines) || '#CCCCCC', // Lines on white base

        barStrokeColor: '#555555',
        barStrokeWidth: '0.8px',
        labelBgStrokeColor: '#AAAAAA',
        labelBgStrokeWidth: '0.5px',
    };
    
    fillStyle.sketchPatternLeftId = "pattern-sketch-left";
    fillStyle.sketchPatternRightId = "pattern-sketch-right";
    fillStyle.sketchPatternLabelId = "pattern-label-sketch";

    const SKETCH_PADDING = 5; // Used for text backgrounds

    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // tempSvgNode.style.position = 'absolute'; // Avoid layout shift if appended
        // tempSvgNode.style.visibility = 'hidden'; // Avoid display
        // tempSvgNode.style.width = '0px';
        // tempSvgNode.style.height = '0px';

        const tempTextNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextNode.setAttribute('font-family', fontFamily);
        tempTextNode.setAttribute('font-size', fontSize);
        tempTextNode.setAttribute('font-weight', fontWeight);
        tempTextNode.textContent = text;
        tempSvgNode.appendChild(tempTextNode);
        // document.body.appendChild(tempSvgNode); // Temporarily append for reliable BBox
        let width = 0;
        try {
             // For reliable getBBox, element must be in the DOM and rendered.
             // The directive says "MUST NOT be appended to the document DOM".
             // This makes getBBox potentially unreliable or return 0.
             // A common robust way is to append, measure, remove.
             // Sticking to the directive, this might be less accurate.
            width = tempTextNode.getBBox().width;
        } catch (e) {
            // Fallback for environments where getBBox on unattached elements is problematic
            width = text.length * (parseFloat(fontSize) || 12) * 0.6; 
        }
        // tempSvgNode.remove();
        return width;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    };

    function getGroupColor(group, groupsArray, colorsConfig) {
        if (colorsConfig.field && colorsConfig.field[group]) {
            return colorsConfig.field[group];
        }
        if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
            const groupIndex = groupsArray.indexOf(group);
            return colorsConfig.available_colors[groupIndex % colorsConfig.available_colors.length];
        }
        if (colorsConfig.other && colorsConfig.other.primary) {
            const groupIndex = groupsArray.indexOf(group);
            const factor = 1 - (groupIndex * 0.15);
            try {
                return d3.color(colorsConfig.other.primary).brighter(factor * 0.5).darker(factor * 0.2).toString();
            } catch (e) { /* ignore color error, fallback below */ }
        }
        const groupIndex = groupsArray.indexOf(group);
        const defaultColors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];
        return defaultColors[groupIndex % defaultColors.length];
    }

    function wrapText(d3TextSelection, text, maxWidth, lineHeightEm) {
        d3TextSelection.each(function() {
            const textNode = d3.select(this);
            const words = text.split(/\s+/).reverse();
            let word;
            let line = [];
            let lineNumber = 0;
            const x = textNode.attr("x");
            const y = textNode.attr("y");
            // dy is relative to previous tspan or initial y if first tspan
            // For dominant-baseline="hanging", the first line hangs from y.
            // Subsequent lines are offset by lineHeightEm from the previous line's baseline.
            textNode.text(null);
            let tspan = textNode.append("tspan").attr("x", x).attr("dy", "0em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    lineNumber++;
                    tspan = textNode.append("tspan").attr("x", x).attr("dy", lineHeightEm + "em").text(word);
                }
            }
        });
    }


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

    const defs = svgRoot.append("defs");

    const patternLeft = defs.append("pattern")
        .attr("id", fillStyle.sketchPatternLeftId)
        .attr("width", 8).attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(45)");
    patternLeft.append("rect").attr("width", 8).attr("height", 8).attr("fill", fillStyle.sketchPatternLeftBase);
    patternLeft.append("path").attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0").attr("stroke", fillStyle.sketchPatternLines).attr("stroke-width", 0.8);

    const patternRight = defs.append("pattern")
        .attr("id", fillStyle.sketchPatternRightId)
        .attr("width", 8).attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("patternTransform", "rotate(-45)");
    patternRight.append("rect").attr("width", 8).attr("height", 8).attr("fill", fillStyle.sketchPatternRightBase);
    patternRight.append("path").attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0").attr("stroke", fillStyle.sketchPatternLines).attr("stroke-width", 0.8);

    const patternLabelSketch = defs.append("pattern")
         .attr("id", fillStyle.sketchPatternLabelId)
         .attr("width", 8).attr("height", 8)
         .attr("patternUnits", "userSpaceOnUse")
         .attr("patternTransform", "rotate(45)");
     patternLabelSketch.append("rect").attr("width", 8).attr("height", 8).attr("fill", fillStyle.sketchPatternLabelBase);
     patternLabelSketch.append("path").attr("d", "M -1,2 l 10,0 M -1,5 l 10,0 M -1,8 l 10,0").attr("stroke", fillStyle.sketchPatternLabelLines).attr("stroke-width", 0.6);

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { top: 60, right: 30, bottom: 80, left: 60 }; // Adjusted top/bottom for legend

    const dimensions = [...new Set(chartData.map(d => d[dimensionField]))];
    const groups = [...new Set(chartData.map(d => d[groupField]))];

    let maxDimLabelWidth = 0;
    dimensions.forEach(dim => {
        const labelText = dimensionUnit ? `${dim}${dimensionUnit}` : `${dim}`;
        const width = estimateTextWidth(labelText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
        maxDimLabelWidth = Math.max(maxDimLabelWidth, width + 2 * SKETCH_PADDING);
    });
    chartMargins.left = Math.max(chartMargins.left, maxDimLabelWidth + 15); // Add space for label + padding

    let maxValueLabelWidth = 0;
    chartData.forEach(d => {
        const valueText = valueUnit ? `${formatValue(d[valueField])}${valueUnit}` : `${formatValue(d[valueField])}`;
        const width = estimateTextWidth(valueText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelWidth = Math.max(maxValueLabelWidth, width + 2 * SKETCH_PADDING);
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelWidth + 15);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated inner chart dimensions are too small. Adjust width/height or margins.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: Arial, sans-serif; font-size: 14px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 5: Data Preprocessing & Transformation
    // Data is already in chartData. Groups and dimensions extracted. No further transformation needed for this chart type.

    // Block 6: Scale Definition & Configuration
    const barPadding = 0.1;
    const yScale = d3.scaleBand()
        .domain(dimensions)
        .range([0, innerHeight])
        .padding(barPadding);

    const xScale = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => +d[valueField]) || 1])
        .range([0, innerWidth]);

    // Block 7: Chart Component Rendering (Legend)
    const legendGroup = svgRoot.append("g")
        .attr("class", "legend");

    const initialLegendFontSize = parseFloat(fillStyle.typography.legendTextFontSize);
    const minLegendFontSize = 8;
    let finalLegendFontSize = initialLegendFontSize;
    let legendNeedsWrapping = false;

    const legendAvailableTotalWidth = containerWidth * 0.8;
    const numGroups = groups.length || 1;
    const legendItemTargetWidth = Math.min(innerWidth / numGroups, legendAvailableTotalWidth / numGroups);
    
    const legendTextPadding = 3; // Padding around text within its available space
    const legendGroupNameAvailableWidth = Math.max(10, legendItemTargetWidth - 2 * legendTextPadding);

    groups.forEach(group => {
        let measuredWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, `${initialLegendFontSize}px`, fillStyle.typography.labelFontWeight);
        if (measuredWidth > legendGroupNameAvailableWidth) {
            finalLegendFontSize = minLegendFontSize;
            measuredWidth = estimateTextWidth(group, fillStyle.typography.labelFontFamily, `${minLegendFontSize}px`, fillStyle.typography.labelFontWeight);
            if (measuredWidth > legendGroupNameAvailableWidth) {
                legendNeedsWrapping = true;
            }
        }
    });
    
    const legendBarHeight = 15;
    const legendTextOffsetY = 8;
    const legendStartY = containerHeight - chartMargins.bottom + 20;

    let currentLegendX = 0;
    groups.forEach((group, i) => {
        const groupItem = legendGroup.append("g")
            .attr("class", "legend-item")
            .attr("transform", `translate(${currentLegendX}, 0)`);

        groupItem.append("rect")
            .attr("class", "mark legend-swatch")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", legendItemTargetWidth)
            .attr("height", legendBarHeight)
            .attr("fill", getGroupColor(group, groups, rawColors))
            .attr("stroke", fillStyle.barStrokeColor)
            .attr("stroke-width", fillStyle.barStrokeWidth);

        const groupNameText = groupItem.append("text")
            .attr("class", "text legend-label")
            .attr("x", legendItemTargetWidth / 2) // Centered under the swatch
            .attr("y", legendBarHeight + legendTextOffsetY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "hanging")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${finalLegendFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor);

        if (legendNeedsWrapping && legendGroupNameAvailableWidth > 10) {
            wrapText(groupNameText, group, legendGroupNameAvailableWidth, 1.1);
        } else {
            groupNameText.text(group);
        }
        currentLegendX += legendItemTargetWidth;
    });

    const totalLegendWidthCalculated = currentLegendX;
    const legendStartXCentered = (containerWidth - totalLegendWidthCalculated) / 2;
    legendGroup.attr("transform", `translate(${legendStartXCentered}, ${legendStartY})`);


    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "main-chart-group")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    dimensions.forEach(dimension => {
        const dimensionData = chartData.filter(d => d[dimensionField] === dimension);
        const barGroupY = yScale(dimension);
        const barGroupHeight = yScale.bandwidth();

        if (dimensionData.length > 0 && barGroupY !== undefined && barGroupHeight > 0) {
            // Dimension Label
            const dimLabelGroup = mainChartGroup.append("g")
                .attr("class", "label group dimension-label-group");

            const dimLabelTextContent = dimensionUnit ? `${dimension}${dimensionUnit}` : `${dimension}`;
            const dimLabelBaseFontSize = parseFloat(fillStyle.typography.labelFontSize);
            const dimLabelMaxHeight = barGroupHeight * 0.8;
            const dimLabelFontSize = Math.min(dimLabelBaseFontSize, dimLabelMaxHeight);
            const dimLabelTargetY = barGroupY + barGroupHeight / 2;

            const tempDimLabelWidth = estimateTextWidth(dimLabelTextContent, fillStyle.typography.labelFontFamily, `${dimLabelFontSize}px`, fillStyle.typography.labelFontWeight);
            const tempDimLabelHeight = dimLabelFontSize; // Approximation

            const dimLabelBgWidth = tempDimLabelWidth + 2 * SKETCH_PADDING;
            const dimLabelBgHeight = tempDimLabelHeight + 1.5 * SKETCH_PADDING;
            const dimLabelBgX = -10 - dimLabelBgWidth;
            const dimLabelBgY = dimLabelTargetY - dimLabelBgHeight / 2;

            dimLabelGroup.append("rect")
                .attr("class", "mark background dimension-label-bg")
                .attr("x", dimLabelBgX)
                .attr("y", dimLabelBgY)
                .attr("width", dimLabelBgWidth)
                .attr("height", dimLabelBgHeight)
                .attr("fill", `url(#${fillStyle.sketchPatternLabelId})`)
                .attr("stroke", fillStyle.labelBgStrokeColor)
                .attr("stroke-width", fillStyle.labelBgStrokeWidth);

            dimLabelGroup.append("text")
                .attr("class", "text dimension-label")
                .attr("x", -10 - SKETCH_PADDING)
                .attr("y", dimLabelTargetY)
                .attr("text-anchor", "end")
                .attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", `${dimLabelFontSize}px`)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(dimLabelTextContent);

            // Bars and Value Labels per group
            const groupBarHeight = barGroupHeight / (groups.length || 1);
            groups.forEach((group, groupIndex) => {
                const dataPoint = dimensionData.find(d => d[groupField] === group);
                if (dataPoint) {
                    const value = parseFloat(dataPoint[valueField]) || 0;
                    const barWidth = xScale(value);
                    const currentGroupY = barGroupY + (groupIndex * groupBarHeight);
                    const barActualY = currentGroupY + groupBarHeight * 0.1;
                    const barActualHeight = Math.max(0, groupBarHeight * 0.8);

                    if (barActualHeight > 0 && barWidth >= 0) {
                        const barPatternId = groupIndex % 2 === 0 ? fillStyle.sketchPatternLeftId : fillStyle.sketchPatternRightId;
                        
                        mainChartGroup.append("rect")
                            .attr("class", `mark bar group-${groupIndex}`)
                            .attr("x", 0)
                            .attr("y", barActualY)
                            .attr("width", barWidth)
                            .attr("height", barActualHeight)
                            .attr("fill", `url(#${barPatternId})`)
                            .attr("stroke", fillStyle.barStrokeColor)
                            .attr("stroke-width", fillStyle.barStrokeWidth);

                        // Value Label
                        const valueTextContent = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
                        const valueBaseFontSize = parseFloat(fillStyle.typography.annotationFontSize);
                        const valueFontSize = Math.min(valueBaseFontSize, barActualHeight * 0.7, maxValueLabelWidth > 0 ? parseFloat(fillStyle.typography.annotationFontSize) : valueBaseFontSize); // Ensure font size is reasonable

                        if (valueFontSize > 5) { // Only draw if font size is somewhat readable
                            const valueLabelGroup = mainChartGroup.append("g")
                                .attr("class", "label group value-label-group");

                            const tempValueLabelWidth = estimateTextWidth(valueTextContent, fillStyle.typography.annotationFontFamily, `${valueFontSize}px`, fillStyle.typography.annotationFontWeight);
                            const tempValueLabelHeight = valueFontSize;

                            const valueBgWidth = tempValueLabelWidth + 2 * SKETCH_PADDING;
                            const valueBgHeight = tempValueLabelHeight + 1.5 * SKETCH_PADDING;
                            
                            // Position background and text centered within the valueLabelGroup
                            const valueBgX_local = -valueBgWidth / 2;
                            const valueBgY_local = -valueBgHeight / 2;

                            valueLabelGroup.append("rect")
                                .attr("class", "mark background value-label-bg")
                                .attr("x", valueBgX_local)
                                .attr("y", valueBgY_local)
                                .attr("width", valueBgWidth)
                                .attr("height", valueBgHeight)
                                .attr("fill", `url(#${fillStyle.sketchPatternLabelId})`)
                                .attr("stroke", fillStyle.labelBgStrokeColor)
                                .attr("stroke-width", fillStyle.labelBgStrokeWidth);

                            valueLabelGroup.append("text")
                                .attr("class", "text value-label")
                                .attr("x", 0) // Centered in its group
                                .attr("y", 0) // Centered in its group
                                .attr("text-anchor", "middle")
                                .attr("dominant-baseline", "middle")
                                .style("font-family", fillStyle.typography.annotationFontFamily)
                                .style("font-size", `${valueFontSize}px`)
                                .style("font-weight", fillStyle.typography.annotationFontWeight) // Original used bold
                                .style("fill", fillStyle.textColor)
                                .text(valueTextContent);
                            
                            const valueLabelTargetX = barWidth + 8 + valueBgWidth / 2;
                            const valueLabelTargetY = barActualY + barActualHeight / 2;
                            valueLabelGroup.attr("transform", `translate(${valueLabelTargetX}, ${valueLabelTargetY})`);
                        }
                    }
                }
            });
        }
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None in this chart beyond what's in rendering blocks)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
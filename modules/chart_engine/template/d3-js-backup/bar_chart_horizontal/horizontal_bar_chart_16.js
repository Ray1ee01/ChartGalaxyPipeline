/*
REQUIREMENTS_BEGIN
{
  "chart_type": "Horizontal Bar Chart",
  "chart_name": "horizontal_bar_chart_16",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[5, 20], [0, "inf"], [2, 6]],
  "required_fields_icons": [],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": ["primary"],
  "min_height": 400,
  "min_width": 400,
  "background": "no",

  "elementAlignment": "none",
  "xAxis": "none",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "outside",
  "artisticStyle": "clean",
  "valueSortDirection": "descending",
  "iconographyUsage": "none"
}
REQUIREMENTS_END
*/

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataArray = data.data && data.data.data ? data.data.data : [];
    const variables = data.variables || {};
    const rawTypography = data.typography || {};
    const rawColors = data.colors || data.colors_dark || {};
    // const images = data.images || {}; // Not used in this chart, but extracted per spec
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];

    d3.select(containerSelector).html(""); // Clear the container

    const dimensionFieldConfig = dataColumns.find(col => col.role === "x");
    const valueFieldConfig = dataColumns.find(col => col.role === "y");
    const groupFieldConfig = dataColumns.find(col => col.role === "group");

    const dimensionFieldName = dimensionFieldConfig ? dimensionFieldConfig.name : undefined;
    const valueFieldName = valueFieldConfig ? valueFieldConfig.name : undefined;
    const groupFieldName = groupFieldConfig ? groupFieldConfig.name : undefined;

    let missingFields = [];
    if (!dimensionFieldName) missingFields.push("x role (dimension field name)");
    if (!valueFieldName) missingFields.push("y role (value field name)");
    if (!groupFieldName) missingFields.push("group role (group field name)");

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; font-family: sans-serif; padding: 10px;'>${errorMsg}</div>`);
        return null;
    }
    
    const dimensionUnit = dimensionFieldConfig.unit && dimensionFieldConfig.unit !== "none" ? dimensionFieldConfig.unit : "";
    const valueUnit = valueFieldConfig.unit && valueFieldConfig.unit !== "none" ? valueFieldConfig.unit : "";

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: (rawTypography.title && rawTypography.title.font_family) ? rawTypography.title.font_family : 'Arial, sans-serif',
            titleFontSize: (rawTypography.title && rawTypography.title.font_size) ? rawTypography.title.font_size : '18px',
            titleFontWeight: (rawTypography.title && rawTypography.title.font_weight) ? rawTypography.title.font_weight : 'bold',
            labelFontFamily: (rawTypography.label && rawTypography.label.font_family) ? rawTypography.label.font_family : 'Arial, sans-serif',
            labelFontSize: (rawTypography.label && rawTypography.label.font_size) ? rawTypography.label.font_size : '12px',
            labelFontWeight: (rawTypography.label && rawTypography.label.font_weight) ? rawTypography.label.font_weight : 'normal',
            annotationFontFamily: (rawTypography.annotation && rawTypography.annotation.font_family) ? rawTypography.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (rawTypography.annotation && rawTypography.annotation.font_size) ? rawTypography.annotation.font_size : '10px',
            annotationFontWeight: (rawTypography.annotation && rawTypography.annotation.font_weight) ? rawTypography.annotation.font_weight : 'normal',
        },
        textColor: rawColors.text_color || '#333333',
        chartBackground: rawColors.background_color || '#FFFFFF',
        defaultPrimaryColor: (rawColors.other && rawColors.other.primary) ? rawColors.other.primary : '#1f77b4',
        defaultCategoricalColor: d3.scaleOrdinal(d3.schemeCategory10) // Fallback if no other colors defined
    };

    const groupColorCache = {};
    let colorIndex = 0;
    const uniqueGroupsForColor = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    fillStyle.getGroupColor = (groupValue) => {
        if (groupColorCache[groupValue]) {
            return groupColorCache[groupValue];
        }

        let color;
        if (rawColors.field && rawColors.field[groupValue]) {
            color = rawColors.field[groupValue];
        } else if (rawColors.available_colors && rawColors.available_colors.length > 0) {
            const groupIndex = uniqueGroupsForColor.indexOf(groupValue);
            color = rawColors.available_colors[groupIndex % rawColors.available_colors.length];
        } else {
            color = fillStyle.defaultCategoricalColor(groupValue);
        }
        groupColorCache[groupValue] = color;
        return color;
    };
    
    function estimateTextWidth(text, fontFamily, fontSize, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const tempTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempTextElement.setAttribute('font-family', fontFamily);
        tempTextElement.setAttribute('font-size', fontSize);
        tempTextElement.setAttribute('font-weight', fontWeight);
        tempTextElement.textContent = text;
        tempSvg.appendChild(tempTextElement);
        // getBBox should work on detached elements with explicitly set font properties
        return tempTextElement.getBBox().width;
    }

    const formatValue = (value) => {
        if (value == null || isNaN(value)) return "N/A";
        if (Math.abs(value) >= 1000000000) return d3.format("~.2s")(value).replace('G', 'B');
        if (Math.abs(value) >= 1000000) return d3.format("~.2s")(value);
        if (Math.abs(value) >= 1000) return d3.format("~.2s")(value);
        return d3.format("~g")(value);
    };

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("class", "chart-root-svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackground);

    // Block 4: Core Chart Dimensions & Layout Calculation
    let chartMargins = {
        top: variables.legend_ präsent ? 90 : 20, // Adjusted if legend is present later
        right: 20, // Base right margin
        bottom: 20, // Base bottom margin
        left: 20   // Base left margin
    };
    
    // Estimate text widths for dynamic margin calculation
    const tempInnerHeightEst = containerHeight - chartMargins.top - chartMargins.bottom;
    const numDimensions = (new Set(chartDataArray.map(d => d[dimensionFieldName]))).size || 1;
    const estBarHeight = Math.max(1, tempInnerHeightEst / numDimensions);
    const estCircleRadius = Math.max(5, estBarHeight / 2 * 0.8);
    const circlePadding = 10;

    let maxDimLabelDynamicWidth = 0;
    chartDataArray.forEach(d => {
        const dimText = d[dimensionFieldName] + dimensionUnit;
        const dynamicFontSize = `${Math.min(30, Math.max(10, estBarHeight * 0.6))}px`;
        const textW = estimateTextWidth(dimText, fillStyle.typography.labelFontFamily, dynamicFontSize, fillStyle.typography.labelFontWeight);
        maxDimLabelDynamicWidth = Math.max(maxDimLabelDynamicWidth, textW);
    });
    chartMargins.left = Math.max(chartMargins.left, (estCircleRadius * 2) + circlePadding + maxDimLabelDynamicWidth + 25);


    let maxValueLabelDynamicWidth = 0;
    chartDataArray.forEach(d => {
        const valText = formatValue(+d[valueFieldName]) + valueUnit;
        const dynamicFontSize = `${Math.min(30, Math.max(10, estBarHeight * 0.5))}px`;
        const textW = estimateTextWidth(valText, fillStyle.typography.annotationFontFamily, dynamicFontSize, fillStyle.typography.annotationFontWeight);
        maxValueLabelDynamicWidth = Math.max(maxValueLabelDynamicWidth, textW);
    });
    chartMargins.right = Math.max(chartMargins.right, maxValueLabelDynamicWidth + 10);


    // Block 5: Data Preprocessing & Transformation
    const sortedChartData = [...chartDataArray].sort((a, b) => +b[valueFieldName] - +a[valueFieldName]);
    const sortedDimensionNames = sortedChartData.map(d => d[dimensionFieldName]);
    
    // Block 7: Chart Component Rendering (Legend) - Placed before final innerHeight calc
    const uniqueGroupNames = [...new Set(chartDataArray.map(d => d[groupFieldName]))];
    let legendGroup = null;
    let legendHeight = 0;
    const legendPaddingAboveChart = 15;

    if (uniqueGroupNames.length > 1) {
        const legendItemHeight = 20;
        const legendItemHTextPadding = 5; // Padding inside rect around text
        const legendItemMargin = 8; // Margin between legend items
        const maxLegendWidthContainer = containerWidth * 0.9; // Max 90% of container width for legend

        const legendItemsData = uniqueGroupNames.map(groupName => {
            const textWidth = estimateTextWidth(groupName, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
            return {
                group: groupName,
                itemTotalWidth: textWidth + legendItemHTextPadding * 2,
            };
        });

        let currentLegendLineWidth = 0;
        let legendRows = 1;
        
        legendItemsData.forEach((item, i) => {
            const neededMargin = (currentLegendLineWidth === 0) ? 0 : legendItemMargin;
            if (currentLegendLineWidth !== 0 && (currentLegendLineWidth + neededMargin + item.itemTotalWidth > maxLegendWidthContainer)) {
                currentLegendLineWidth = 0;
                legendRows++;
            }
            currentLegendLineWidth += neededMargin + item.itemTotalWidth;
        });
        legendHeight = (legendRows * legendItemHeight) + ((legendRows - 1) * 5); // 5px vertical spacing between rows
        
        chartMargins.top = legendHeight + legendPaddingAboveChart;
        
        const legendGroupTranslateY = legendPaddingAboveChart / 2; // Position from top of SVG
        
        legendGroup = svgRoot.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(0, ${legendGroupTranslateY})`);

        currentLegendLineWidth = 0; // Reset for actual drawing
        let currentLegendY = 0;
        let legendBlockActualWidth = 0; // To center the whole legend block

        legendItemsData.forEach((item) => {
            const neededMargin = (currentLegendLineWidth === 0) ? 0 : legendItemMargin;
            if (currentLegendLineWidth !== 0 && (currentLegendLineWidth + neededMargin + item.itemTotalWidth > maxLegendWidthContainer)) {
                legendBlockActualWidth = Math.max(legendBlockActualWidth, currentLegendLineWidth - neededMargin); // Store max line width
                currentLegendLineWidth = 0;
                currentLegendY += legendItemHeight + 5; // Move to next row
            }
            
            const legendItemG = legendGroup.append("g")
                .attr("class", "legend-item")
                .attr("transform", `translate(${currentLegendLineWidth + neededMargin}, ${currentLegendY})`);

            legendItemG.append("rect")
                .attr("class", "mark")
                .attr("width", item.itemTotalWidth)
                .attr("height", legendItemHeight)
                .attr("fill", fillStyle.getGroupColor(item.group));

            legendItemG.append("text")
                .attr("class", "label")
                .attr("x", item.itemTotalWidth / 2)
                .attr("y", legendItemHeight / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .style("font-family", fillStyle.typography.annotationFontFamily)
                .style("font-size", fillStyle.typography.annotationFontSize)
                .style("font-weight", fillStyle.typography.annotationFontWeight)
                .style("fill", d3.hsl(fillStyle.getGroupColor(item.group)).l > 0.5 ? '#000000' : '#FFFFFF')
                .text(item.group);
            
            currentLegendLineWidth += neededMargin + item.itemTotalWidth;
        });
        legendBlockActualWidth = Math.max(legendBlockActualWidth, currentLegendLineWidth - (currentLegendLineWidth > 0 ? legendItemMargin : 0) );
        legendGroup.attr("transform", `translate(${(containerWidth - legendBlockActualWidth) / 2}, ${legendGroupTranslateY})`);
    } else {
        chartMargins.top = 20; // Default top margin if no legend
    }
    
    // Recalculate inner dimensions after legend height is known
    let innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    let innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "14px")
            .style("fill", "red")
            .text("Insufficient space to render chart with current margins and dimensions.");
        return svgRoot.node();
    }

    // Block 6: Scale Definition & Configuration (Finalized)
    const barPaddingFactor = 0.2; 

    const yScale = d3.scaleBand()
        .domain(sortedDimensionNames)
        .range([0, innerHeight])
        .padding(barPaddingFactor);

    const maxVal = d3.max(chartDataArray, d => +d[valueFieldName]);
    const xScale = d3.scaleLinear()
        .domain([0, (maxVal > 0 ? maxVal : 1) * 1.05]) // Ensure domain is not [0,0] if maxVal is 0
        .range([0, innerWidth]);


    // Block 8: Main Data Visualization Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("class", "chart-area")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`);

    const barHeight = yScale.bandwidth();
    const actualCircleRadius = Math.max(1, barHeight / 2); // Ensure radius is at least 1

    sortedChartData.forEach((dataPoint, index) => {
        const dimensionName = dataPoint[dimensionFieldName];
        const value = +dataPoint[valueFieldName];
        const groupValue = dataPoint[groupFieldName];
        const barColor = fillStyle.getGroupColor(groupValue);

        const scaledValue = xScale(value);
        
        const itemGroup = mainChartGroup.append("g").attr("class", "chart-item mark");

        const circleY = yScale(dimensionName) + barHeight / 2;
        const circleX = -actualCircleRadius - circlePadding; // Circle to the left of 0-axis

        // Bar
        itemGroup.append("rect")
            .attr("class", "mark bar-segment")
            .attr("x", circleX) // Bar starts from the circle's x position
            .attr("y", yScale(dimensionName))
            .attr("width", Math.max(0, scaledValue - circleX)) // Ensure width is non-negative
            .attr("height", barHeight)
            .attr("fill", barColor)
            .on("mouseover", function() { d3.select(this).style("opacity", 0.8); })
            .on("mouseout", function() { d3.select(this).style("opacity", 1); });

        // Circle with number
        itemGroup.append("circle")
            .attr("class", "mark decorative-circle")
            .attr("cx", circleX)
            .attr("cy", circleY)
            .attr("r", actualCircleRadius)
            .attr("fill", "#000000");

        itemGroup.append("text")
            .attr("class", "label rank-label")
            .attr("x", circleX)
            .attr("y", circleY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${Math.max(8, barHeight * 0.5)}px`)
            .style("font-weight", "bold")
            .style("fill", "#FFFFFF")
            .text(index + 1);

        // Dimension Label
        const formattedDimLabel = dimensionUnit ? `${dimensionName}${dimensionUnit}` : `${dimensionName}`;
        itemGroup.append("text")
            .attr("class", "label dimension-label")
            .attr("x", circleX - actualCircleRadius - 5) 
            .attr("y", circleY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${Math.min(30, Math.max(10, barHeight * 0.6))}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(formattedDimLabel);

        // Value Label
        const formattedValLabel = valueUnit ? `${formatValue(value)}${valueUnit}` : `${formatValue(value)}`;
        itemGroup.append("text")
            .attr("class", "label value-label")
            .attr("x", scaledValue + 5) 
            .attr("y", circleY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", `${Math.min(30, Math.max(10, barHeight * 0.5))}px`)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", barColor)
            .text(formattedValLabel);
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (Hover effects are included in bar rendering)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
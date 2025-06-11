/* REQUIREMENTS_BEGIN
{
  "chart_type": "Stacked Bar Chart",
  "chart_name": "stacked_bar_chart_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["categorical"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 20], [0, "inf"], [2, 5]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 600,
  "min_width": 800,
  "background": "dark",

  "elementAlignment": "center",
  "xAxis": "visible",
  "yAxis": "none",
  "gridLineType": "none",
  "legend": "normal",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data || [];
    const variables = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors_dark || data.colors || {}; // Prefer dark theme if available
    const imagesConfig = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xCol = dataColumns.find(col => col.role === "x");
    const yCol = dataColumns.find(col => col.role === "y");
    const groupCol = dataColumns.find(col => col.role === "group");

    if (!xCol || !yCol || !groupCol) {
        console.error("Critical chart config missing: Roles for x, y, or group fields are not defined in dataColumns. Cannot render.");
        d3.select(containerSelector).append("div")
            .style("color", "red").style("text-align", "center").style("font-family", "sans-serif")
            .html("Error: Critical chart configuration missing (x, y, or group role not defined).");
        return null;
    }

    const xFieldName = xCol.name;
    const yFieldName = yCol.name;
    const groupFieldName = groupCol.name;

    if (!xFieldName || !yFieldName || !groupFieldName) {
        console.error("Critical chart config missing: Field names for x, y, or group are empty. Cannot render.");
        d3.select(containerSelector).append("div")
            .style("color", "red").style("text-align", "center").style("font-family", "sans-serif")
            .html("Error: Critical chart configuration missing (empty x, y, or group field name).");
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            titleFontFamily: typographyConfig.title?.font_family || "Arial, sans-serif",
            titleFontSize: typographyConfig.title?.font_size || "16px",
            titleFontWeight: typographyConfig.title?.font_weight || "bold",
            labelFontFamily: typographyConfig.label?.font_family || "Arial, sans-serif",
            labelFontSize: typographyConfig.label?.font_size || "12px",
            labelFontWeight: typographyConfig.label?.font_weight || "normal",
            annotationFontFamily: typographyConfig.annotation?.font_family || "Arial, sans-serif",
            annotationFontSize: typographyConfig.annotation?.font_size || "10px",
            annotationFontWeight: typographyConfig.annotation?.font_weight || "normal",
        },
        colors: {
            textColor: colorsConfig.text_color || "#F0F0F0",
            backgroundColor: colorsConfig.background_color || "#1A1A1A",
            axisLabelColor: colorsConfig.text_color || "#FFFFFF",
            dataLabelColorInternal: "#364d51", 
            dataLabelBackgroundExternal: "#364d51",
            getGroupColor: (group, index) => {
                if (colorsConfig.field && colorsConfig.field[group]) {
                    return colorsConfig.field[group];
                }
                if (colorsConfig.available_colors) {
                    return colorsConfig.available_colors[index % colorsConfig.available_colors.length];
                }
                return d3.schemeCategory10[index % 10];
            },
        },
        images: {
            groupIcons: imagesConfig.field || {},
        }
    };
    
    function estimateTextWidth(text, fontProps) {
        const fp = {
            font_family: fontProps?.font_family || fillStyle.typography.labelFontFamily,
            font_size: fontProps?.font_size || fillStyle.typography.labelFontSize,
            font_weight: fontProps?.font_weight || fillStyle.typography.labelFontWeight,
        };
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textNode.setAttribute("font-family", fp.font_family);
        textNode.setAttribute("font-size", fp.font_size);
        textNode.setAttribute("font-weight", fp.font_weight);
        textNode.textContent = text;
        tempSvg.appendChild(textNode);
        // Not appended to DOM
        const width = textNode.getBBox().width;
        return width;
    }

    function formatValue(value) { // Not used in current bar labels, kept as utility
        if (value >= 1000000000) return d3.format("~g")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format("~g")(value / 1000000) + "M";
        if (value >= 1000) return d3.format("~g")(value / 1000) + "K";
        return d3.format("~g")(value);
    }

    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.colors.backgroundColor)
        .attr("class", "chart-svg-root other"); // Added class

    const chartMargins = { top: 100, right: 5, bottom: 10, left: 5 };

    // Block 4: Core Chart Dimensions & Layout Calculation
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group other"); // Added class

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = JSON.parse(JSON.stringify(chartDataInput)); 

    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))]
        .sort((a, b) => {
            const avgA = d3.mean(chartDataArray.filter(d => d[groupFieldName] === a), d => parseFloat(d[yFieldName]) || 0);
            const avgB = d3.mean(chartDataArray.filter(d => d[groupFieldName] === b), d => parseFloat(d[yFieldName]) || 0);
            return avgB - avgA; 
        });

    const xValuesByGroup = {};
    groups.forEach(group => {
        xValuesByGroup[group] = new Set(
            chartDataArray.filter(d => d[groupFieldName] === group).map(d => d[xFieldName])
        );
    });

    let commonXValues = groups.length > 0 ? [...xValuesByGroup[groups[0]]] : [];
    for (let i = 1; i < groups.length; i++) {
        commonXValues = commonXValues.filter(x => xValuesByGroup[groups[i]].has(x));
    }
    
    commonXValues.sort((a, b) => {
        const aIndex = chartDataArray.findIndex(d => d[xFieldName] === a);
        const bIndex = chartDataArray.findIndex(d => d[xFieldName] === b);
        return aIndex - bIndex;
    });

    const filteredData = chartDataArray.filter(d => commonXValues.includes(d[xFieldName]));
    const groupedDataForStacking = d3.group(filteredData, d => d[xFieldName]);
    
    let stackInputData = Array.from(groupedDataForStacking, ([key, values]) => {
        const obj = { category: key };
        values.forEach(v => {
            obj[v[groupFieldName]] = parseFloat(v[yFieldName]) || 0;
        });
        return obj;
    });

    stackInputData.forEach(d => {
        groups.forEach(group => {
            if (d[group] === undefined) d[group] = 0;
        });
    });

    stackInputData.sort((a, b) => commonXValues.indexOf(a.category) - commonXValues.indexOf(b.category));

    let maxTotal = 0;
    stackInputData.forEach(d => {
        const total = groups.reduce((sum, group) => sum + (d[group] || 0), 0);
        if (total > maxTotal) maxTotal = total;
    });
    
    const baselineTotal = maxTotal > 0 ? maxTotal * 1.1 : 1; 

    stackInputData.forEach(d => {
        groups.forEach(group => {
            d[group] = baselineTotal > 0 ? ((d[group] || 0) / baselineTotal) * 100 : 0;
        });
    });

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(commonXValues)
        .range([0, innerWidth])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, innerHeight]); 

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines, Legend - NO Main Titles/Subtitles)
    const xAxisLabelsGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis"); // Added class

    commonXValues.forEach(category => {
        xAxisLabelsGroup.append("text")
            .attr("class", "label x-axis-label")
            .attr("x", xScale(category) + xScale.bandwidth() / 2)
            .attr("y", -10) 
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "14px") 
            .style("font-weight", "bold")
            .style("fill", fillStyle.colors.axisLabelColor)
            .text(category);
    });

    const legendRadius = 25;
    const legendIconSize = legendRadius * 1.2;
    const legendItemWidth = 120; 

    const legendGroup = mainChartGroup.append("g")
        .attr("class", "legend other") // Added class
        .attr("transform", `translate(${innerWidth / 2 - (groups.length * legendItemWidth / 2)}, -75)`);

    groups.forEach((group, i) => {
        const groupColor = fillStyle.colors.getGroupColor(group, i);
        const legendItemXPos = i * legendItemWidth;

        const legendItem = legendGroup.append("g")
            .attr("class", "legend-item other") // Added class
            .attr("transform", `translate(${legendItemXPos + legendItemWidth/2}, 0)`);

        legendItem.append("text")
            .attr("class", "label legend-label text") // Added class
            .attr("x", 0) 
            .attr("y", 0) 
            .attr("text-anchor", "middle")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("fill", groupColor)
            .text(group);

        const semicircleYOffset = parseFloat(fillStyle.typography.labelFontSize) + 5 + legendRadius; 
        const semicircle = d3.arc()
            .innerRadius(0)
            .outerRadius(legendRadius)
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2);

        legendItem.append("path")
            .attr("class", "legend-mark mark") // Added class
            .attr("d", semicircle)
            .attr("transform", `translate(0, ${semicircleYOffset})`)
            .attr("fill", groupColor);

        const groupIconUrl = fillStyle.images.groupIcons[group];
        if (groupIconUrl) {
            const iconYOffset = semicircleYOffset + legendRadius + 5; 
            legendItem.append("image")
                .attr("class", "icon legend-icon image") // Added class
                .attr("x", -legendIconSize / 2)
                .attr("y", iconYOffset)
                .attr("width", legendIconSize)
                .attr("height", legendIconSize)
                .attr("xlink:href", groupIconUrl)
                .attr("preserveAspectRatio", "xMidYMid meet");
        }
    });

    // Block 8: Main Data Visualization Rendering
    const barsGroup = mainChartGroup.append("g").attr("class", "marks bar-marks other"); // Added class

    commonXValues.forEach(categoryXValue => {
        const categoryData = stackInputData.find(d => d.category === categoryXValue);
        if (!categoryData) return;

        const barX = xScale(categoryXValue);
        const barWidth = xScale.bandwidth();
        let cumulativeHeight = 0;

        groups.forEach((groupName, groupIndex) => {
            const percentageValue = categoryData[groupName] || 0;
            const segmentHeight = yScale(percentageValue); 

            if (segmentHeight <= 0) return; 

            const segmentY = cumulativeHeight;
            const groupColor = fillStyle.colors.getGroupColor(groupName, groupIndex);

            barsGroup.append("rect")
                .attr("class", "mark bar-segment value") // Added class
                .attr("x", barX)
                .attr("y", segmentY)
                .attr("width", barWidth)
                .attr("height", segmentHeight)
                .attr("fill", groupColor);

            const minHeightForInternalLabel = 20; 
            const labelText = `${percentageValue.toFixed(1)}%`;
            const dataLabelFontProps = { 
                font_family: fillStyle.typography.labelFontFamily, 
                font_size: "12px", 
                font_weight: "bold" 
            };
            
            if (segmentHeight >= minHeightForInternalLabel) {
                barsGroup.append("text")
                    .attr("class", "label data-label data-label-internal text") // Added class
                    .attr("x", barX + barWidth / 2)
                    .attr("y", segmentY + segmentHeight / 2) 
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", dataLabelFontProps.font_family)
                    .style("font-size", dataLabelFontProps.font_size)
                    .style("font-weight", dataLabelFontProps.font_weight)
                    .attr("fill", fillStyle.colors.dataLabelColorInternal)
                    .text(labelText);
            } else if (groupIndex === groups.length - 1 && percentageValue > 0) {
                const externalLabelY = segmentY + segmentHeight + 15; 
                const textMetricsWidth = estimateTextWidth(labelText, dataLabelFontProps);
                const textHeight = parseFloat(dataLabelFontProps.font_size); 
                const padding = 2;

                barsGroup.append("rect") // Background for external label
                    .attr("class", "data-label-background data-label-external-background other") // Added class
                    .attr("x", barX + barWidth / 2 - textMetricsWidth / 2 - padding)
                    .attr("y", externalLabelY - textHeight / 2 - padding - (textHeight*0.15)) // Adjusted for dominant-baseline
                    .attr("width", textMetricsWidth + padding * 2)
                    .attr("height", textHeight + padding * 2)
                    .attr("fill", fillStyle.colors.dataLabelBackgroundExternal);
                
                barsGroup.append("text")
                    .attr("class", "label data-label data-label-external text") // Added class
                    .attr("x", barX + barWidth / 2)
                    .attr("y", externalLabelY)
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "middle")
                    .style("font-family", dataLabelFontProps.font_family)
                    .style("font-size", dataLabelFontProps.font_size)
                    .style("font-weight", dataLabelFontProps.font_weight)
                    .attr("fill", groupColor) 
                    .text(labelText);
            }
            cumulativeHeight += segmentHeight;
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // (None)

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
/* REQUIREMENTS_BEGIN
{
  "chart_type": "Sorted Lines Chart",
  "chart_name": "bump_plain_chart_03",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[2, 12], [0, "inf"], [4, 10]],
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
  "gridLineType": "none",
  "legend": "none",
  "dataLabelPosition": "auto",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "none"
}
REQUIREMENTS_END */

function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to this function.

    // Block 1: Configuration Parsing & Validation
    const chartConfig = data.variables || {};
    const typographyConfig = data.typography || {};
    const colorsConfig = data.colors || {}; // Assumes data.colors for light theme, or data.colors_dark if specified by caller
    const imagesConfig = data.images || {}; // Not used in this chart, but parsed for completeness
    const dataColumns = data.data && data.data.columns ? data.data.columns : [];
    let chartDataArray = data.data && data.data.data ? data.data.data : [];

    d3.select(containerSelector).html(""); // Clear the container

    const timeFieldRole = "x";
    const valueFieldRole = "y";
    const groupFieldRole = "group";

    const timeFieldDef = dataColumns.find(col => col.role === timeFieldRole);
    const valueFieldDef = dataColumns.find(col => col.role === valueFieldRole);
    const groupFieldDef = dataColumns.find(col => col.role === groupFieldRole);

    const missingFields = [];
    if (!timeFieldDef) missingFields.push(`role: ${timeFieldRole}`);
    if (!valueFieldDef) missingFields.push(`role: ${valueFieldRole}`);
    if (!groupFieldDef) missingFields.push(`role: ${groupFieldRole}`);

    if (missingFields.length > 0) {
        const errorMsg = `Critical chart config missing: Field definitions for ${missingFields.join(', ')}. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }

    const timeFieldName = timeFieldDef.name;
    const valueFieldName = valueFieldDef.name;
    const groupFieldName = groupFieldDef.name;

    if (!timeFieldName || !valueFieldName || !groupFieldName) {
        const errorMsg = `Critical chart config missing: Field names are undefined for required roles. Cannot render.`;
        console.error(errorMsg);
        if (containerSelector) {
            d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        }
        return null;
    }


    // Block 2: Style Configuration & Helper Definitions
    const fillStyle = {
        typography: {
            labelFontFamily: (typographyConfig.label && typographyConfig.label.font_family) ? typographyConfig.label.font_family : 'Arial, sans-serif',
            labelFontSize: (typographyConfig.label && typographyConfig.label.font_size) ? typographyConfig.label.font_size : '12px',
            labelFontWeight: (typographyConfig.label && typographyConfig.label.font_weight) ? typographyConfig.label.font_weight : 'normal',
            annotationFontFamily: (typographyConfig.annotation && typographyConfig.annotation.font_family) ? typographyConfig.annotation.font_family : 'Arial, sans-serif',
            annotationFontSize: (typographyConfig.annotation && typographyConfig.annotation.font_size) ? typographyConfig.annotation.font_size : '10px',
            annotationFontWeight: (typographyConfig.annotation && typographyConfig.annotation.font_weight) ? typographyConfig.annotation.font_weight : 'normal',
        },
        textColor: colorsConfig.text_color || '#0f223b',
        backgroundColor: colorsConfig.background_color || '#FFFFFF', // Not directly used to fill SVG background, but available
        defaultLineStrokeWidth: 2,
        hexagonStrokeColor: '#FFFFFF',
        hexagonStrokeWidth: 1,
    };

    function estimateTextMetrics(text, fontSize, fontFamily, fontWeight) {
        const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        tempSvg.style.position = 'absolute';
        tempSvg.style.visibility = 'hidden';
        tempSvg.style.width = '0px'; // Important for some browsers
        tempSvg.style.height = '0px'; // Important for some browsers

        const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tempText.style.fontFamily = fontFamily;
        tempText.style.fontSize = fontSize;
        tempText.style.fontWeight = fontWeight;
        tempText.textContent = text;
        tempSvg.appendChild(tempText);
        
        // Appending to body temporarily to ensure getBBox works reliably in all browsers
        // This is a common pattern, though the directive prefers not appending to DOM.
        // However, for getBBox, it often needs to be part of a rendered tree.
        // Let's try without appending first, as per strict directive.
        // If issues arise, this might need reconsideration for reliability.
        // document.body.appendChild(tempSvg); // Temporarily append
        const bbox = tempText.getBBox();
        // document.body.removeChild(tempSvg); // Clean up

        return { width: bbox.width, height: bbox.height };
    }
    
    function getAdaptedFontSize(text, maxWidth, initialFontSizePx, fontFamily, fontWeight) {
        let fontSize = initialFontSizePx;
        if (fontSize <= 1) return 1; // Minimum practical font size

        let textWidth = estimateTextMetrics(text, `${fontSize}px`, fontFamily, fontWeight).width;

        while (textWidth > maxWidth && fontSize > 1) {
            fontSize -= 1;
            textWidth = estimateTextMetrics(text, `${fontSize}px`, fontFamily, fontWeight).width;
        }
        return fontSize;
    }

    function hexagonPath(cx, cy, r) {
        const angles = d3.range(6).map(i => (i * Math.PI / 3) + (Math.PI / 6));
        const points = angles.map(angle => [
            cx + r * Math.sin(angle),
            cy - r * Math.cos(angle)
        ]);
        return d3.line()(points) + "Z";
    }

    function isColorLight(hexColor) {
        const color = d3.color(hexColor);
        if (!color) return false;
        const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b);
        return luminance > 160;
    }

    const formatValue = (value) => {
        if (value >= 1000000000) return d3.format(".1f")(value / 1000000000) + "B";
        if (value >= 1000000) return d3.format(".1f")(value / 1000000) + "M";
        if (value >= 1000) return d3.format(".0f")(value / 1000) + "K";
        return d3.format(".0f")(value);
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = chartConfig.width || 800;
    const containerHeight = chartConfig.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("class", "chart-svg")
        .style("background-color", fillStyle.backgroundColor);


    // Block 4: Core Chart Dimensions & Layout Calculation
    // Initial margins, left margin will be adjusted after label measurement
    const chartMargins = {
        top: chartConfig.marginTop || 60, // Increased for time labels
        right: chartConfig.marginRight || 50,
        bottom: chartConfig.marginBottom || 50,
        left: chartConfig.marginLeft || 120 // Initial, will be adjusted
    };


    // Block 5: Data Preprocessing & Transformation
    if (!chartDataArray || chartDataArray.length === 0) {
        svgRoot.append("text")
            .attr("x", containerWidth / 2)
            .attr("y", containerHeight / 2)
            .attr("text-anchor", "middle")
            .text("No data available.")
            .attr("class", "label no-data-label")
            .style("fill", fillStyle.textColor);
        return svgRoot.node();
    }
    
    const timePoints = [...new Set(chartDataArray.map(d => d[timeFieldName]))].sort((a, b) => {
        // Basic sort, assumes timePoints are comparable (e.g. years as numbers, or lexicographical for strings)
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    });
    const groups = [...new Set(chartDataArray.map(d => d[groupFieldName]))];

    let allDataPresent = true;
    for (const group of groups) {
        for (const timePoint of timePoints) {
            const dataExists = chartDataArray.some(d => d[groupFieldName] === group && d[timeFieldName] === timePoint);
            if (!dataExists) {
                allDataPresent = false;
                break;
            }
        }
        if (!allDataPresent) break;
    }

    if (!allDataPresent) {
        const errorMsg = "Data is incomplete: each group must have data for all time points. Chart cannot be rendered.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }

    let maxGroupLabelWidth = 0;
    const groupLabelFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
    groups.forEach(group => {
        const metrics = estimateTextMetrics(group, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontWeight);
        maxGroupLabelWidth = Math.max(maxGroupLabelWidth, metrics.width);
    });
    
    const groupLabelPadding = 15; // Space between label and chart elements
    chartMargins.left = Math.max(chartMargins.left, maxGroupLabelWidth + groupLabelPadding);

    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) {
        const errorMsg = "Calculated chart dimensions (innerWidth or innerHeight) are not positive. Cannot render.";
        console.error(errorMsg);
         d3.select(containerSelector).html(`<div style='color:red; text-align:center; padding: 20px;'>${errorMsg}</div>`);
        return null;
    }

    const maxValue = d3.max(chartDataArray, d => +d[valueFieldName]);


    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleBand()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(groups)
        .range([0, innerHeight])
        .padding(0.2);

    const colorScale = d3.scaleOrdinal()
        .domain(groups)
        .range(groups.map((group, i) => {
            if (colorsConfig.field && colorsConfig.field[group]) {
                return colorsConfig.field[group];
            }
            if (colorsConfig.available_colors && colorsConfig.available_colors.length > 0) {
                return colorsConfig.available_colors[i % colorsConfig.available_colors.length];
            }
            return d3.schemeCategory10[i % 10];
        }));
    
    const minCircleRadius = 2;
    const maxRadiusForBandwidth = Math.min(xScale.bandwidth() / 2, yScale.bandwidth() / 2) * 0.9; // 0.9 for padding
    const minCircleArea = Math.PI * Math.pow(minCircleRadius, 2);
    const maxCircleArea = Math.PI * Math.pow(maxRadiusForBandwidth, 2);

    const areaScale = d3.scaleLinear()
        .domain([0, maxValue > 0 ? maxValue : 1]) // Ensure domain max is positive
        .range([minCircleArea, maxCircleArea])
        .clamp(true);


    // Block 7: Chart Component Rendering
    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left}, ${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Render group labels (left side)
    groups.forEach(group => {
        const groupY = yScale(group) + yScale.bandwidth() / 2;
        mainChartGroup.append("text")
            .attr("x", -groupLabelPadding) // Position to the left of the chart area
            .attr("y", groupY)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("class", "label group-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", fillStyle.typography.labelFontSize)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(group);
    });

    // Render time point labels (top side)
    const timeLabelInitialFontSizePx = parseFloat(fillStyle.typography.labelFontSize);
    timePoints.forEach(timePoint => {
        const availableWidthForTimeLabel = xScale.bandwidth();
        const adaptedTimeLabelFontSize = getAdaptedFontSize(
            String(timePoint),
            availableWidthForTimeLabel,
            timeLabelInitialFontSizePx,
            fillStyle.typography.labelFontFamily,
            fillStyle.typography.labelFontWeight
        );

        mainChartGroup.append("text")
            .attr("x", xScale(timePoint) + xScale.bandwidth() / 2)
            .attr("y", -chartMargins.top / 2.5) // Position above the chart area
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("class", "label time-label")
            .style("font-family", fillStyle.typography.labelFontFamily)
            .style("font-size", `${adaptedTimeLabelFontSize}px`)
            .style("font-weight", fillStyle.typography.labelFontWeight)
            .style("fill", fillStyle.textColor)
            .text(timePoint);
    });


    // Block 8: Main Data Visualization Rendering
    groups.forEach(group => {
        const groupData = chartDataArray
            .filter(d => d[groupFieldName] === group)
            .sort((a, b) => timePoints.indexOf(a[timeFieldName]) - timePoints.indexOf(b[timeFieldName]));

        // Render lines
        if (groupData.length >= 2) {
            const lineGenerator = d3.line()
                .x(d => xScale(d[timeFieldName]) + xScale.bandwidth() / 2)
                .y(d => yScale(d[groupFieldName]) + yScale.bandwidth() / 2);

            mainChartGroup.append("path")
                .datum(groupData)
                .attr("class", "mark line")
                .attr("fill", "none")
                .attr("stroke", colorScale(group))
                .attr("stroke-width", fillStyle.defaultLineStrokeWidth)
                .attr("d", lineGenerator);
        }

        // Render hexagons and value labels
        groupData.forEach(d => {
            const cx = xScale(d[timeFieldName]) + xScale.bandwidth() / 2;
            const cy = yScale(d[groupFieldName]) + yScale.bandwidth() / 2;
            const value = +d[valueFieldName];

            const circleArea = areaScale(value);
            const circleRadius = Math.sqrt(circleArea / Math.PI);

            let finalHexColor = colorScale(group);
            if (timePoints.length > 1) {
                const baseColorObject = d3.color(colorScale(group));
                if (baseColorObject) {
                    const brightnessParamMax = chartConfig.brightnessParamMax || 1; // Max factor for brighter/darker
                    const timePointIndex = timePoints.indexOf(d[timeFieldName]);
                    // kFactor ranges from -brightnessParamMax to +brightnessParamMax
                    const kFactor = brightnessParamMax * (-1 + (2 * timePointIndex) / (timePoints.length - 1));
                    
                    if (kFactor > 0) finalHexColor = baseColorObject.brighter(kFactor).toString();
                    else if (kFactor < 0) finalHexColor = baseColorObject.darker(Math.abs(kFactor)).toString();
                    // else, kFactor is 0, use base color
                }
            }

            mainChartGroup.append("path")
                .attr("class", "mark hexagon")
                .attr("d", hexagonPath(cx, cy, circleRadius))
                .attr("fill", finalHexColor)
                .attr("stroke", fillStyle.hexagonStrokeColor)
                .attr("stroke-width", fillStyle.hexagonStrokeWidth);

            const formattedValue = formatValue(value);
            const annotationInitialFontSizePx = parseFloat(fillStyle.typography.annotationFontSize);
            const annotationMaxWidth = xScale.bandwidth() * 0.9; // Max width for label inside hexagon or below

            const annotationFontSize = getAdaptedFontSize(
                formattedValue,
                annotationMaxWidth,
                annotationInitialFontSizePx,
                fillStyle.typography.annotationFontFamily,
                fillStyle.typography.annotationFontWeight
            );
            
            const textMetrics = estimateTextMetrics(
                formattedValue, 
                `${annotationFontSize}px`, 
                fillStyle.typography.annotationFontFamily, 
                fillStyle.typography.annotationFontWeight
            );

            const innerHexagonRadiusFactor = 0.866; // sqrt(3)/2
            const canFitInside = (circleRadius * innerHexagonRadiusFactor * 2) >= (textMetrics.width + 4) && (circleRadius * innerHexagonRadiusFactor * 2) >= (textMetrics.height + 2) ;

            if (canFitInside) {
                mainChartGroup.append("text")
                    .attr("x", cx)
                    .attr("y", cy)
                    .attr("class", "label value-label value-label-inside")
                    .attr("dominant-baseline", "central")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${annotationFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", isColorLight(finalHexColor) ? '#000000' : '#FFFFFF')
                    .text(formattedValue);
            } else {
                const labelPaddingBelowHexagon = 5;
                mainChartGroup.append("text")
                    .attr("x", cx)
                    .attr("y", cy + circleRadius + labelPaddingBelowHexagon)
                    .attr("class", "label value-label value-label-outside")
                    .attr("dominant-baseline", "hanging")
                    .attr("text-anchor", "middle")
                    .style("font-family", fillStyle.typography.annotationFontFamily)
                    .style("font-size", `${annotationFontSize}px`)
                    .style("font-weight", fillStyle.typography.annotationFontWeight)
                    .style("fill", fillStyle.textColor)
                    .text(formattedValue);
            }
        });
    });

    // Block 9: Optional Enhancements & Post-Processing
    // No complex visual effects, gradients, patterns, or shadows as per directives.

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}
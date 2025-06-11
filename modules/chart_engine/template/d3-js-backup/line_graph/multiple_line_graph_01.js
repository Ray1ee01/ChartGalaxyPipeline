/* REQUIREMENTS_BEGIN
{
  "chart_type": "Multiple Line Graph",
  "chart_name": "multiple_line_graph_01",
  "is_composite": false,
  "required_fields": ["x", "y", "group"],
  "hierarchy": ["group"],
  "required_fields_type": [["temporal"], ["numerical"], ["categorical"]],
  "required_fields_range": [[4, 30], ["-inf", "inf"], [2, 8]],
  "required_fields_icons": ["group"],
  "required_other_icons": [],
  "required_fields_colors": ["group"],
  "required_other_colors": [],
  "min_height": 400,
  "min_width": 600,
  "background": "dark",

  "elementAlignment": "none",
  "xAxis": "minimal",
  "yAxis": "minimal",
  "gridLineType": "subtle",
  "legend": "detailed",
  "dataLabelPosition": "none",
  "artisticStyle": "clean",
  "valueSortDirection": "none",
  "iconographyUsage": "adjacent_indicator"
}
REQUIREMENTS_END */


function makeChart(containerSelector, data) {
    // Block 0: Metadata & Other Function-Level Comments
    // The /* REQUIREMENTS_BEGIN... */ block is external to the function.

    // Block 1: Configuration Parsing & Validation
    const chartDataInput = data.data?.data;
    const variables = data.variables || {};
    const typographyInput = data.typography || {};
    const colorsInput = data.colors_dark || data.colors || {}; // Prefer dark, fallback to light/generic
    const imagesInput = data.images || {};
    const dataColumns = data.data?.columns || [];

    d3.select(containerSelector).html(""); // Clear container

    const xFieldRole = "x";
    const yFieldRole = "y";
    const groupFieldRole = "group";

    const getFieldNameByRole = (role) => {
        const col = dataColumns.find(c => c.role === role);
        return col ? col.name : undefined;
    };

    const xFieldName = getFieldNameByRole(xFieldRole);
    const yFieldName = getFieldNameByRole(yFieldRole);
    const groupFieldName = getFieldNameByRole(groupFieldRole);

    if (!xFieldName || !yFieldName || !groupFieldName) {
        const missingFields = [
            !xFieldName ? `role '${xFieldRole}'` : null,
            !yFieldName ? `role '${yFieldRole}'` : null,
            !groupFieldName ? `role '${groupFieldRole}'` : null
        ].filter(Boolean).join(', ');
        const errorMsg = `Critical chart config missing: Field names for roles (${missingFields}) not found in data.data.columns. Cannot render.`;
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    if (!chartDataInput || chartDataInput.length === 0) {
        const errorMsg = "Chart data is missing or empty. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }

    // Block 2: Style Configuration & Helper Definitions
    const estimateTextWidth = (text, fontFamily, fontSize, fontWeight) => {
        if (!text) return 0;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.visibility = 'hidden'; // Keep it off-screen and non-disruptive
        svg.style.position = 'absolute';
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-size', fontSize);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.textContent = text;
        svg.appendChild(textEl);
        document.body.appendChild(svg); // Momentarily append to DOM for reliable getBBox
        let width = 0;
        try {
            width = textEl.getBBox().width;
        } catch (e) {
            console.warn("getBBox failed in estimateTextWidth, using fallback.", e);
            const avgCharWidth = parseFloat(fontSize) * 0.6; // Rough estimate
            width = text.length * avgCharWidth;
        }
        document.body.removeChild(svg); // Clean up
        return width;
    };


    const defaultTypography = {
        title: { font_family: "Arial, sans-serif", font_size: "16px", font_weight: "bold" },
        label: { font_family: "Arial, sans-serif", font_size: "14px", font_weight: "bold" }, // Original had bold labels
        annotation: { font_family: "Arial, sans-serif", font_size: "12px", font_weight: "normal" }
    };

    const fillStyle = {
        textColor: colorsInput.text_color || "#FFFFFF",
        textColorOnPrimary: colorsInput.text_color_on_primary || "#FFFFFF", // For text on colored backgrounds
        textColorOnWhite: colorsInput.text_color_on_white || "#333333", // For text on white backgrounds (like year label)
        chartBackgroundColor: colorsInput.background_color || "transparent",
        gridLineColor: "#FFFFFF",
        gridLineOpacity: 0.3,
        gridLineZeroOpacity: 1,
        gridLineZeroStrokeWidth: 2,
        gridLineStrokeWidth: 1,
        lineStrokeWidth: 3,
        areaOpacity: 0.2,
        referenceLineColor: "#FFFFFF",
        referenceLineWidth: 1,
        markerRadius: 5,
        typography: {
            labelFontFamily: typographyInput.label?.font_family || defaultTypography.label.font_family,
            labelFontSize: typographyInput.label?.font_size || defaultTypography.label.font_size,
            labelFontWeight: typographyInput.label?.font_weight || defaultTypography.label.font_weight,
            annotationFontFamily: typographyInput.annotation?.font_family || defaultTypography.annotation.font_family,
            annotationFontSize: typographyInput.annotation?.font_size || defaultTypography.annotation.font_size,
            annotationFontWeight: typographyInput.annotation?.font_weight || defaultTypography.annotation.font_weight,
        },
        getLineColor: (group) => {
            if (colorsInput.field && colorsInput.field[group]) return colorsInput.field[group];
            const sortedGroups = Array.from(new Set(chartDataInput.map(d => d[groupFieldName]))).sort();
            const groupIndex = sortedGroups.indexOf(group);
            if (colorsInput.available_colors && colorsInput.available_colors.length > 0) {
                return colorsInput.available_colors[groupIndex % colorsInput.available_colors.length];
            }
            const defaultScheme = d3.schemeCategory10;
            return defaultScheme[groupIndex % defaultScheme.length];
        },
        getImageUrl: (group) => {
            return imagesInput.field && imagesInput.field[group] ? imagesInput.field[group] : null;
        }
    };
    
    const parseDate = (dateStr) => {
        if (dateStr === null || typeof dateStr === 'undefined') return null;
        let d;
        // Check if it's just a year (numeric or string)
        if (/^\d{4}$/.test(String(dateStr))) {
            d = d3.utcParse("%Y")(String(dateStr));
        } else {
            // Try parsing as a more complete date string
            d = new Date(dateStr);
        }
        return !isNaN(d?.getTime()) ? d : null;
    };


    // Block 3: Initial SVG Setup & Global Utilities Definition
    const containerWidth = variables.width || 800;
    const containerHeight = variables.height || 600;

    const svgRoot = d3.select(containerSelector)
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .style("background-color", fillStyle.chartBackgroundColor === "transparent" ? null : fillStyle.chartBackgroundColor)
        .attr("class", "chart-svg-root");

    // Block 4: Core Chart Dimensions & Layout Calculation
    const chartMargins = { 
        top: variables.margin_top || 40, 
        right: variables.margin_right || 180, // Original had large right margin
        bottom: variables.margin_bottom || 60, 
        left: variables.margin_left || 80 
    };
    const innerWidth = containerWidth - chartMargins.left - chartMargins.right;
    const innerHeight = containerHeight - chartMargins.top - chartMargins.bottom;

    const mainChartGroup = svgRoot.append("g")
        .attr("transform", `translate(${chartMargins.left},${chartMargins.top})`)
        .attr("class", "main-chart-group");

    // Block 5: Data Preprocessing & Transformation
    let chartDataArray = chartDataInput.map(d => ({
        ...d,
        [xFieldName]: parseDate(d[xFieldName]),
        [yFieldName]: parseFloat(d[yFieldName])
    })).filter(d => d[xFieldName] instanceof Date && !isNaN(d[xFieldName]) && !isNaN(d[yFieldName]));

    if (chartDataArray.length === 0) {
        const errorMsg = "No valid data points after parsing dates and numbers. Cannot render.";
        console.error(errorMsg);
        d3.select(containerSelector).html(`<div style='color:red; padding:10px;'>${errorMsg}</div>`);
        return null;
    }
    
    chartDataArray.sort((a, b) => a[xFieldName] - b[xFieldName]);

    const groups = Array.from(new Set(chartDataArray.map(d => d[groupFieldName]))).sort();
    const xValuesDates = Array.from(new Set(chartDataArray.map(d => d[xFieldName]))).sort((a,b) => a - b);

    // Block 6: Scale Definition & Configuration
    const xScale = d3.scaleTime()
        .domain(d3.extent(chartDataArray, d => d[xFieldName]))
        .range([0, innerWidth]);

    const yMin = d3.min(chartDataArray, d => d[yFieldName]);
    const yMax = d3.max(chartDataArray, d => d[yFieldName]);
    const yScale = d3.scaleLinear()
        .domain([Math.min(0, yMin * 1.1), Math.max(0.0001, yMax * 1.1)]) // Ensure max is not 0 if all data is 0
        .range([innerHeight, 0])
        .nice();

    // Block 7: Chart Component Rendering (e.g., Axes, Gridlines)
    const gridExtension = 30;

    const yTicks = yScale.ticks(5);
    const maxYTickValue = yTicks.length > 0 ? yTicks[yTicks.length - 1] : yScale.domain()[1];
    const maxYTickPos = yScale(maxYTickValue);

    mainChartGroup.append("g")
        .attr("class", "grid y-grid")
        .selectAll("line")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("class", "grid-line-y mark")
        .attr("x1", -gridExtension)
        .attr("y1", d => yScale(d))
        .attr("x2", innerWidth)
        .attr("y2", d => yScale(d))
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", d => d === 0 ? fillStyle.gridLineZeroStrokeWidth : fillStyle.gridLineStrokeWidth)
        .attr("opacity", d => d === 0 ? fillStyle.gridLineZeroOpacity : fillStyle.gridLineOpacity);

    const xTickValues = xScale.ticks(Math.min(xValuesDates.length, 7));
     mainChartGroup.append("g")
        .attr("class", "grid x-grid")
        .selectAll("line")
        .data(xTickValues)
        .enter()
        .append("line")
        .attr("class", "grid-line-x mark")
        .attr("x1", d => xScale(d))
        .attr("y1", Math.max(0, maxYTickPos))
        .attr("x2", d => xScale(d))
        .attr("y2", innerHeight)
        .attr("stroke", fillStyle.gridLineColor)
        .attr("stroke-width", fillStyle.gridLineStrokeWidth)
        .attr("opacity", fillStyle.gridLineOpacity);

    const xAxisFormat = xValuesDates.length > 1 && (xValuesDates[1].getUTCFullYear() - xValuesDates[0].getUTCFullYear() >=1) ? d3.utcFormat("%Y") : d3.utcFormat("%b %Y");
    const xAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale)
            .tickValues(xTickValues) // Use pre-calculated tick values
            .tickFormat(xAxisFormat)
            .tickSize(0)
        );
    xAxisGroup.select(".domain").remove();
    xAxisGroup.selectAll(".tick text")
        .attr("class", "label text")
        .style("font-family", fillStyle.typography.annotationFontFamily) // Use annotation for axis text
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor);

    const yAxisGroup = mainChartGroup.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(yScale)
            .tickValues(yTicks) // Use pre-calculated tick values
            .tickSize(0)
        );
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll(".tick text")
        .attr("class", "label text")
        .attr("x", -gridExtension)
        .attr("dy", "-0.5em")
        .style("font-family", fillStyle.typography.annotationFontFamily) // Use annotation for axis text
        .style("font-size", fillStyle.typography.annotationFontSize)
        .style("font-weight", fillStyle.typography.annotationFontWeight)
        .style("fill", fillStyle.textColor)
        .style("opacity", 0.8)
        .style("text-anchor", "start")
        .text((d, i) => {
            const yCol = dataColumns.find(col => col.role === yFieldRole);
            const yUnitOrName = yCol?.unit || (yCol?.label || yFieldName);
            return i === yTicks.length - 1 ? `${d3.format(".2s")(d)} ${yUnitOrName}` : d3.format(".2s")(d);
        });
    
    yAxisGroup.selectAll(".tick:last-child text")
        .each(function() {
            const textElement = d3.select(this);
            const fullText = textElement.text();
            const parts = fullText.split(' ');
            if (parts.length > 1) {
                textElement.text('');
                textElement.append("tspan").text(parts[0]);
                textElement.append("tspan").text(` ${parts.slice(1).join(' ')}`).style("font-weight", fillStyle.typography.annotationFontWeight); // Unit less prominent
            }
        });

    // Block 8: Main Data Visualization Rendering
    const lineGenerator = d3.line()
        .x(d => xScale(d[xFieldName]))
        .y(d => yScale(d[yFieldName]));

    const areaGenerator = d3.area()
        .x(d => xScale(d[xFieldName]))
        .y0(innerHeight)
        .y1(d => yScale(d[yFieldName]));

    groups.forEach(group => {
        const groupData = chartDataArray.filter(d => d[groupFieldName] === group);
        if (groupData.length < 2) return; // Need at least 2 points for a line/area

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "area mark")
            .attr("fill", fillStyle.getLineColor(group))
            .style("opacity", fillStyle.areaOpacity)
            .attr("d", areaGenerator);

        mainChartGroup.append("path")
            .datum(groupData)
            .attr("class", "line mark")
            .attr("fill", "none")
            .attr("stroke", fillStyle.getLineColor(group))
            .attr("stroke-width", fillStyle.lineStrokeWidth)
            .attr("d", lineGenerator);
    });

    // Block 9: Optional Enhancements & Post-Processing
    if (xValuesDates.length > 0) {
        const lastXDate = xValuesDates[xValuesDates.length - 1];
        const lastXPos = xScale(lastXDate);

        mainChartGroup.append("line")
            .attr("class", "reference-line other")
            .attr("x1", lastXPos)
            .attr("y1", 0)
            .attr("x2", lastXPos)
            .attr("y2", innerHeight)
            .attr("stroke", fillStyle.referenceLineColor)
            .attr("stroke-width", fillStyle.referenceLineWidth)
            .attr("stroke-dasharray", "4,2");

        const yearLabelGroup = mainChartGroup.append("g")
            .attr("class", "annotation-group other year-label-group")
            .attr("transform", `translate(${lastXPos}, 0)`);

        const yearLabelText = xAxisFormat(lastXDate);
        const yearLabelTextWidth = estimateTextWidth(yearLabelText, fillStyle.typography.annotationFontFamily, fillStyle.typography.annotationFontSize, fillStyle.typography.annotationFontWeight);
        const yearLabelRectWidth = yearLabelTextWidth + 10;
        const yearLabelRectHeight = parseFloat(fillStyle.typography.annotationFontSize) + 8;

        yearLabelGroup.append("rect")
            .attr("class", "label-background other")
            .attr("x", -yearLabelRectWidth / 2)
            .attr("y", -yearLabelRectHeight - 5)
            .attr("width", yearLabelRectWidth)
            .attr("height", yearLabelRectHeight)
            .attr("fill", fillStyle.referenceLineColor)
            .attr("rx", 3).attr("ry", 3);

        yearLabelGroup.append("path")
            .attr("class", "label-decorator other")
            .attr("d", "M0,0 L5,5 L-5,5 Z") // Triangle pointing down
            .attr("transform", `translate(0, -5)`)
            .attr("fill", fillStyle.referenceLineColor);

        yearLabelGroup.append("text")
            .attr("class", "label text annotation-text")
            .attr("x", 0).attr("y", -yearLabelRectHeight / 2 - 5)
            .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
            .style("font-family", fillStyle.typography.annotationFontFamily)
            .style("font-size", fillStyle.typography.annotationFontSize)
            .style("font-weight", fillStyle.typography.annotationFontWeight)
            .style("fill", fillStyle.textColorOnWhite)
            .text(yearLabelText);

        let labelPositions = [];
        const imageWidth = 80; 
        const imageHeight = 50;
        const baseLabelVerticalSpacing = parseFloat(fillStyle.typography.labelFontSize) + 20; // Text part + padding

        groups.forEach((group) => {
            const groupData = chartDataArray.filter(d => d[groupFieldName] === group && d[xFieldName] <= lastXDate);
            if (groupData.length === 0) return;
            
            const lastPoint = groupData.reduce((prev, current) => (prev[xFieldName].getTime() >= current[xFieldName].getTime() ? prev : current));
            if (!lastPoint) return;

            const circleY = yScale(lastPoint[yFieldName]);
            let targetLabelY = circleY;
            
            const imageUrl = fillStyle.getImageUrl(group);
            const currentLabelHeight = baseLabelVerticalSpacing + (imageUrl ? imageHeight : 0);

            let placed = false;
            let attempts = 0;
            const maxAttempts = groups.length * 2;

            while(!placed && attempts < maxAttempts) {
                attempts++;
                let collision = false;
                for (const pos of labelPositions) {
                    if (Math.abs(targetLabelY - pos.y) < (currentLabelHeight + pos.height) / 2) { // Check overlap based on combined heights
                        targetLabelY = pos.y + (pos.height / 2) + (currentLabelHeight / 2) + 5; // Push down
                        collision = true;
                        break;
                    }
                }
                if (!collision) placed = true;
            }
             // Clamp label Y to be within innerHeight bounds
            targetLabelY = Math.max(currentLabelHeight / 2, targetLabelY);
            targetLabelY = Math.min(innerHeight - currentLabelHeight / 2, targetLabelY);


            labelPositions.push({ y: targetLabelY, height: currentLabelHeight });
            labelPositions.sort((a,b) => a.y - b.y);

            mainChartGroup.append("circle")
                .attr("class", "mark point data-marker")
                .attr("cx", xScale(lastPoint[xFieldName]))
                .attr("cy", circleY)
                .attr("r", fillStyle.markerRadius)
                .attr("fill", fillStyle.getLineColor(group));

            const endLabelGroup = mainChartGroup.append("g")
                .attr("class", "annotation-group other end-of-line-label")
                .attr("transform", `translate(${innerWidth + 20}, ${targetLabelY})`);

            const valueText = `${Math.round(lastPoint[yFieldName])}`;
            const valueTextEstWidth = estimateTextWidth(valueText, fillStyle.typography.labelFontFamily, fillStyle.typography.labelFontSize, fillStyle.typography.labelFontWeight);
            const valueRectWidth = valueTextEstWidth + 20;
            const valueRectHeight = parseFloat(fillStyle.typography.labelFontSize) + 10;

            endLabelGroup.append("rect")
                .attr("class", "label-background other")
                .attr("x", 0).attr("y", -valueRectHeight / 2)
                .attr("width", valueRectWidth).attr("height", valueRectHeight)
                .attr("fill", fillStyle.getLineColor(group))
                .attr("rx", 5).attr("ry", 5);
            
            const relativeCircleY = circleY - targetLabelY;
            const triangleHeight = 10; 
            let triangleTipY = Math.max(-valueRectHeight/2 + triangleHeight/2, Math.min(valueRectHeight/2 - triangleHeight/2, relativeCircleY));
            
            endLabelGroup.append("path")
                .attr("class", "label-decorator other")
                .attr("d", `M -8,${triangleTipY} L 0,${triangleTipY - triangleHeight/2} L 0,${triangleTipY + triangleHeight/2} Z`)
                .attr("fill", fillStyle.getLineColor(group));

            endLabelGroup.append("text")
                .attr("class", "label text value-text")
                .attr("x", valueRectWidth / 2).attr("y", 0)
                .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColorOnPrimary)
                .text(valueText);

            let currentXOffset = valueRectWidth + 10;
            if (imageUrl) {
                endLabelGroup.append("image")
                    .attr("class", "icon image group-icon")
                    .attr("x", currentXOffset).attr("y", -imageHeight / 2)
                    .attr("width", imageWidth).attr("height", imageHeight)
                    .attr("xlink:href", imageUrl);
                currentXOffset += imageWidth + 10;
            }

            endLabelGroup.append("text")
                .attr("class", "label text group-name-text")
                .attr("x", currentXOffset).attr("y", 0)
                .attr("text-anchor", "start").attr("dominant-baseline", "middle")
                .style("font-family", fillStyle.typography.labelFontFamily)
                .style("font-size", fillStyle.typography.labelFontSize)
                .style("font-weight", fillStyle.typography.labelFontWeight)
                .style("fill", fillStyle.textColor)
                .text(group);
        });
    }

    // Block 10: Cleanup & SVG Node Return
    return svgRoot.node();
}